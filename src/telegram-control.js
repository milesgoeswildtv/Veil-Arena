import { handleTelegramRoute as baseHandleTelegramRoute } from "./telegram-worker.js";
import {
  telegramScope,
  isTelegramGroup,
  userFromTelegram,
  webhookAuthorized,
  sendTelegramMessage,
  telegramRequest
} from "./telegram.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";

function commandParts(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  return { command: (parts.shift() || "").toLowerCase().split("@")[0], args: parts };
}

async function isTelegramAdmin(message, env) {
  try {
    const member = await telegramRequest(env.TELEGRAM_BOT_TOKEN, "getChatMember", {
      chat_id: message.chat.id,
      user_id: message.from.id
    });
    return member?.status === "creator" || member?.status === "administrator";
  } catch {
    return false;
  }
}

async function forceCloseTelegramArena(message, env) {
  const scope = telegramScope(message?.chat?.id);
  if (!isTelegramGroup(message?.chat)) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Use /arena forceclose inside the Telegram group with the stuck Arena.");
  }

  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, scope);
  if (!game || game.platform !== "telegram") {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "No active Telegram Arena exists in this group. You can start a new one now.");
  }

  const user = userFromTelegram(message.from);
  if (!user) return;
  const allowed = user.id === String(game.hostId) || await isTelegramAdmin(message, env);
  if (!allowed) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Only the Arena host or a Telegram group admin can force-close it.");
  }

  game.status = "aborted";
  game.abortedAt = new Date().toISOString();
  game.abortedBy = user.id;
  game.history = Array.isArray(game.history) ? game.history : [];
  game.history.push({ type: "force_closed", byUserId: user.id, round: game.round || 0, at: game.abortedAt, platform: "telegram" });
  await saveGame(env.DB, game);

  const prizeWarning = game.dwalletWinnerPayout?.status === "funded"
    ? "\n\n⚠️ This Arena had a funded DWallet prize. The Arena state is cleared, but that funded prize still needs to be reconciled/refunded before reuse."
    : "";

  return sendTelegramMessage(
    scope,
    env.TELEGRAM_BOT_TOKEN,
    `🛑 Arena force-closed. The stuck active state is cleared. You can use /arena to start a fresh one now.${prizeWarning}`
  );
}

export async function handleTelegramRoute(request, env) {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/telegram/webhook" && env.TELEGRAM_WEBHOOK_SECRET && webhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) {
    const update = await request.clone().json().catch(() => null);
    const message = update?.message;
    if (message?.text) {
      const { command, args } = commandParts(message.text);
      const sub = String(args[0] || "").toLowerCase();
      if (command === "/arenaforceclose" || (command === "/arena" && (sub === "forceclose" || sub === "close" || sub === "reset"))) {
        return forceCloseTelegramArena(message, env);
      }
    }
  }

  return baseHandleTelegramRoute(request, env);
}
