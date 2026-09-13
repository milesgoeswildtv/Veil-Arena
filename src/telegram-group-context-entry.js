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
  if (request.method === "GET") {
    return url.searchParams.get("game") || gameIdFromStartParam(auth.startParam);
  }
  if (request.method === "POST") {
    const body = await request.clone().json().catch(() => ({}));
    return body.gameId || gameIdFromStartParam(auth.startParam);
  }
  return null;
}

async function withOriginatingGroupContext(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.DB) return request;
  const initData = request.headers.get("x-telegram-init-data") || "";
  if (!initData) return request;

  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (["group", "supergroup"].includes(auth.chatType)) return request;

  const gameId = await requestedGameId(request, auth);
  if (!gameId) return request;

  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") return request;

  const member = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
  if (!member) return request;

  // Main Mini App links may omit chat_type/chat_instance on some Telegram clients even
  // when the user opens the Arena button from the group message. The Arena game already
  // stores the originating Telegram group ID, and membership is verified above, so give
  // the existing Mini App handler a stable server-signed group context for that game.
  const chatInstance = `veil:${String(game.channelId).replace(/^tg:/, "")}`;
  const resigned = await resignInitData(initData, env.TELEGRAM_BOT_TOKEN, chatInstance);
  const headers = new Headers(request.headers);
  headers.set("x-telegram-init-data", resigned);
  return new Request(request, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const miniAppApi = url.pathname === "/telegram/miniapp/state" || url.pathname === "/telegram/miniapp/action";
    if (miniAppApi) {
      try {
        request = await withOriginatingGroupContext(request, env);
      } catch {
        // Fall through unchanged so the existing Mini App handler returns its normal,
        // user-facing authentication/context error rather than masking the real cause.
      }
    }
    return app.fetch(request, env, ctx);
  }
};
