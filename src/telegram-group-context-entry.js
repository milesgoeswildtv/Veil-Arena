import app, { ArenaCoordinator } from "./telegram-start-entry.js";
import { validateTelegramInitData } from "./miniapp.js";
import { loadGame } from "./storage.js";
import { telegramUserInChat } from "./telegram.js";

export { ArenaCoordinator };

const encoder = new TextEncoder();

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(data));
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function resignInitData(initData, botToken, chatInstance) {
  const params = new URLSearchParams(initData);
  params.set("chat_type", "group");
  params.set("chat_instance", chatInstance);
  params.delete("hash");
  params.delete("signature");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const hash = bytesToHex(await hmacSha256(secret, dataCheckString));
  params.set("hash", hash);
  return params.toString();
}

function gameIdFromStartParam(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

async function requestedGameId(request, auth) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("game");
  if (fromQuery) return fromQuery;

  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    const body = await request.clone().json().catch(() => ({}));
    if (body?.gameId) return body.gameId;
  }

  return gameIdFromStartParam(auth.startParam);
}

function testMode(env) {
  return ["1", "true", "yes", "on"].includes(String(env?.ARENA_TEST_MODE || "").trim().toLowerCase());
}

async function withOriginatingGroupContext(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.DB) return request;
  const initData = request.headers.get("x-telegram-init-data") || "";
  if (!initData) return request;

  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const gameId = await requestedGameId(request, auth);
  if (!gameId) return request;

  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") return request;

  // In production, verify that the person opening the launch link is still a member of
  // the Telegram group that created this Arena. The private QA worker already performs
  // membership/host checks in its action handlers, so avoid an extra Bot API round-trip
  // on every poll there.
  if (!testMode(env)) {
    const member = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
    if (!member) return request;
  }

  // Telegram Main Mini App launches are inconsistent about supplying chat_type and
  // chat_instance. The game itself already stores its originating Telegram group.
  // Reuse the Arena's already-bound chat instance when it exists; otherwise derive one
  // stable value from that group. This works for ANY group that starts an Arena and does
  // not rely on a hardcoded DWallet group ID.
  const chatInstance = game.telegramChatInstance || `veil:${String(game.channelId).replace(/^tg:/, "")}`;

  // If Telegram already supplied the exact context this Arena expects, leave it alone.
  if (["group", "supergroup"].includes(auth.chatType) && auth.chatInstance === chatInstance) {
    return request;
  }

  const resigned = await resignInitData(initData, env.TELEGRAM_BOT_TOKEN, chatInstance);
  const headers = new Headers(request.headers);
  headers.set("x-telegram-init-data", resigned);
  return new Request(request, { headers });
}

function patchMiniAppHtml(html) {
  let out = String(html);

  // Never allow a Telegram client quirk in ready()/expand() to kill the Arena script
  // before polling begins.
  out = out.replace(
    "if(tg){tg.ready();tg.expand();try{tg.requestFullscreen?.()}catch{};try{tg.setHeaderColor?.('#09070f');tg.setBackgroundColor?.('#09070f')}catch{}}",
    "if(tg){try{tg.ready?.()}catch{};try{tg.expand?.()}catch{};try{tg.requestFullscreen?.()}catch{};try{tg.setHeaderColor?.('#09070f');tg.setBackgroundColor?.('#09070f')}catch{}}"
  );

  // The old client could sit on \"Opening DWallet Arena…\" forever if its first state
  // request stalled. Give each API request a timeout so refresh() can recover and poll
  // again instead of permanently wedging the Mini App.
  out = out.replace(
    "const api=async(path,opts={})=>{const r=await fetch(path,{...opts,headers:{'content-type':'application/json','x-telegram-init-data':initData,...(opts.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!j.ok)throw new Error(j.error||'Arena request failed');return j};",
    "const api=async(path,opts={})=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(path,{...opts,signal:controller.signal,headers:{'content-type':'application/json','x-telegram-init-data':initData,...(opts.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!j.ok)throw new Error(j.error||'Arena request failed');return j}catch(e){if(e?.name==='AbortError')throw new Error('Arena sync timed out. Retrying…');throw e}finally{clearTimeout(timer)}};"
  );

  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Apply the originating-group adapter to every Telegram Mini App API route:
    // Arena state/actions, QA controls, stats/leaderboards, sponsorships, and future
    // Mini App endpoints. Individual handlers still enforce their own permissions.
    if (url.pathname.startsWith("/telegram/miniapp/")) {
      try {
        request = await withOriginatingGroupContext(request, env);
      } catch {
        // Fall through unchanged so the existing handler returns its normal,
        // user-facing authentication/context error rather than masking the cause.
      }
    }

    const response = await app.fetch(request, env, ctx);

    if (request.method === "GET" && (url.pathname === "/tg" || url.pathname === "/telegram/arena")) {
      const type = response.headers.get("content-type") || "";
      if (type.includes("text/html")) {
        const headers = new Headers(response.headers);
        headers.set("cache-control", "no-store");
        return new Response(patchMiniAppHtml(await response.text()), {
          status: response.status,
          headers
        });
      }
    }

    return response;
  }
};
