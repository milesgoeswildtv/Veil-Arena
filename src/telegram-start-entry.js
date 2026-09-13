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
  return first.toLowerCase().split("@")[0];
}

function isGroup(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

async function handleTelegramStart(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return null;
  if (!telegramWebhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return null;

  const update = await request.clone().json().catch(() => null);
  const message = update?.message;
  if (!message?.text || !message?.chat?.id) return null;

  const cmd = command(message.text);
  if (cmd !== "/start" && cmd !== "/ping") return null;

  const chatId = String(message.chat.id);
  try {
    if (cmd === "/ping") {
      await sendTelegramMessage(chatId, env.TELEGRAM_BOT_TOKEN, {
        text: "💜 Veil is online. Telegram webhook and reply path are working."
      });
      return ok();
    }

    const text = isGroup(message.chat)
      ? "# 💜 VEIL ARENA — ONLINE\n\nI'm connected to this test group. Use `/arena` to open the Arena.\n\nUse `/arenahelp` for Arena commands or `/ping` to test the bot connection."
      : "# 💜 VEIL ARENA — ONLINE\n\nI'm connected and responding. Arena games are launched from a Telegram group.\n\nAdd me to your private test group, then use `/start` there followed by `/arena`.";

    await sendTelegramMessage(chatId, env.TELEGRAM_BOT_TOKEN, { text });
  } catch (error) {
    console.error("Telegram /start reply failed", error);
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
