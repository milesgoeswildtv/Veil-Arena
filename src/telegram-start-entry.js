import app, { ArenaCoordinator } from "./activity-doctor-entry.js";
import { telegramWebhookAuthorized, sendTelegramMessage } from "./telegram.js";

export { ArenaCoordinator };

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
    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const handled = await handleTelegramStart(request, env);
      if (handled) return handled;
    }
    return app.fetch(request, env, ctx);
  }
};
