import app, { ArenaCoordinator } from "./activity-doctor-entry.js";
import { telegramWebhookAuthorized, sendTelegramMessage, telegramUserInChat } from "./telegram.js";
import { validateTelegramInitData } from "./miniapp.js";
import { loadGame } from "./storage.js";

export { ArenaCoordinator };

const encoder = new TextEncoder();

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function command(text = "") {
  const first = String(text).trim().split(/\s+/)[0] || "";
  const normalized = first.toLowerCase().split("@")[0];
  if (normalized === "/start" || normalized.startsWith("/start=")) return "/start";
  if (normalized === "/ping") return "/ping";
  return normalized;
}

function isGroup(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

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

function miniAppError(message, status = 401) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function gameIdForMiniAppRequest(request, auth) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return url.searchParams.get("game") || gameIdFromStartParam(auth.startParam);
  }
  const body = await request.clone().json().catch(() => ({}));
  return body.gameId || gameIdFromStartParam(auth.startParam);
}

async function addQaGroupContext(request, env) {
  if (String(env.ARENA_TEST_MODE || "").toLowerCase() !== "true") return request;
  if (!env.TELEGRAM_BOT_TOKEN || !env.DB) return request;

  const initData = request.headers.get("x-telegram-init-data") || "";
  if (!initData) return request;

  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (["group", "supergroup"].includes(auth.chatType) && auth.chatInstance) return request;

  const gameId = await gameIdForMiniAppRequest(request, auth);
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

async function rawTelegramSend(chatId, token, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.description || `Telegram sendMessage failed (${response.status})`);
  }
  return body?.result;
}

async function handleTelegramStart(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return null;
  if (!telegramWebhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return null;

  const update = await request.clone().json().catch(() => null);
  const message = update?.message;
  if (!message?.chat?.id) return null;

  const text = String(message?.text || "");
  const cmd = command(text);
  if (cmd !== "/start" && cmd !== "/ping") return null;

  const chatId = String(message.chat.id);

  if (cmd === "/ping") {
    await rawTelegramSend(chatId, env.TELEGRAM_BOT_TOKEN,
      "💜 Veil is online. Telegram webhook and reply path are working."
    ).catch(async () => {
      await sendTelegramMessage(chatId, env.TELEGRAM_BOT_TOKEN, {
        text: "💜 Veil is online. Telegram webhook and reply path are working."
      });
    });
    return ok();
  }

  const reply = isGroup(message.chat)
    ? "💜 VEIL IS ONLINE\n\nConnected to this test group. Use /arena to open the QA Arena. Use /ping to test the connection."
    : "💜 VEIL IS ONLINE\n\nConnected and responding. Add me to your private test group, then use /start there followed by /arena.";

  try {
    await rawTelegramSend(chatId, env.TELEGRAM_BOT_TOKEN, reply);
  } catch (error) {
    console.error("Raw Telegram /start reply failed", error);
    try {
      await sendTelegramMessage(chatId, env.TELEGRAM_BOT_TOKEN, { text: reply });
    } catch (fallbackError) {
      console.error("Formatted Telegram /start fallback failed", fallbackError);
    }
  }
  return ok();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isMiniAppApi(url, request.method)) {
      try {
        request = await addQaGroupContext(request, env);
      } catch (error) {
        return miniAppError(String(error?.message || error));
      }
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const handled = await handleTelegramStart(request, env);
      if (handled) return handled;
    }
    return app.fetch(request, env, ctx);
  }
};
