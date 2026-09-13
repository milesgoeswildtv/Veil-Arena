import app, { ArenaCoordinator } from "./telegram-start-entry.js";
import { validateTelegramInitData } from "./miniapp.js";
import { loadGame } from "./storage.js";
import { telegramUserInChat } from "./telegram.js";

export { ArenaCoordinator };

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(data));
}

async function signedInitData(params, botToken) {
  const secret = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const data = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  params.set("hash", bytesToHex(await hmacSha256(secret, data)));
  return params.toString();
}

function gameIdFromStartParam(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

function isMiniAppApi(url, method) {
  return (method === "GET" && url.pathname === "/telegram/miniapp/state") ||
    (method === "POST" && url.pathname === "/telegram/miniapp/action");
}

function jsonError(message, status = 401) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function gameIdForRequest(request, auth) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return url.searchParams.get("game") || gameIdFromStartParam(auth.startParam);
  }
  const body = await request.clone().json().catch(() => ({}));
  return body.gameId || gameIdFromStartParam(auth.startParam);
}

async function addDemoGroupContext(request, env) {
  if (String(env.ARENA_TEST_MODE || "").toLowerCase() !== "true") return request;
  if (!env.TELEGRAM_BOT_TOKEN || !env.DB) return request;

  const initData = request.headers.get("x-telegram-init-data") || "";
  if (!initData) return request;

  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (["group", "supergroup"].includes(auth.chatType) && auth.chatInstance) return request;

  const gameId = await gameIdForRequest(request, auth);
  if (!gameId) throw new Error("Missing Arena ID.");

  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") {
    throw new Error("That DWallet Arena no longer exists.");
  }

  const isMember = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
  if (!isMember) {
    throw new Error("Open this Arena as a member of the Telegram group that started it.");
  }

  const params = new URLSearchParams(initData);
  if (!auth.chatType) params.set("chat_type", "supergroup");
  if (!auth.chatInstance) {
    const chatId = String(game.channelId || "").replace(/^tg:/, "");
    params.set("chat_instance", `veil-demo-${chatId}`);
  }
  params.delete("hash");

  const headers = new Headers(request.headers);
  headers.set("x-telegram-init-data", await signedInitData(params, env.TELEGRAM_BOT_TOKEN));
  return new Request(request, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isMiniAppApi(url, request.method)) {
      try {
        request = await addDemoGroupContext(request, env);
      } catch (error) {
        return jsonError(String(error?.message || error));
      }
    }
    return app.fetch(request, env, ctx);
  }
};
