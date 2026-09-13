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
import { isVeilTipAdmin, veilTipAdminEntry, sendDirectDwalletTip } from "./dwallet-direct-tip.js";

function commandParts(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  return { command: (parts.shift() || "").toLowerCase().split("@")[0], args: parts };
}

function webhookAck() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function telegramAdminStatus(message, env) {
  try {
    const member = await telegramRequest(env.TELEGRAM_BOT_TOKEN, "getChatMember", {
      chat_id: message.chat.id,
      user_id: message.from.id
    });
    return member?.status || "";
  } catch {
    return "";
  }
}

async function isTelegramAdmin(message, env) {
  const status = await telegramAdminStatus(message, env);
  return status === "creator" || status === "administrator";
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

async function handleVeilTip(message, args, env) {
  const scope = telegramScope(message?.chat?.id);
  if (!isTelegramGroup(message?.chat)) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Use /veiltip in a Telegram group by replying to the person you want to tip.");
  }

  const user = userFromTelegram(message.from);
  if (!user) return;
  const platformAdmin = env.VEIL_TIP_ALLOW_PLATFORM_ADMINS === "true" && await isTelegramAdmin(message, env);
  if (!isVeilTipAdmin(env, "telegram", user.id) && !platformAdmin) {
    const entry = veilTipAdminEntry("telegram", user.id);
    return sendTelegramMessage(
      scope,
      env.TELEGRAM_BOT_TOKEN,
      `You are not authorized to spend Veil's DWallet balance.\n\nYour allowlist entry is ${entry}. Add it to the Cloudflare secret/variable VEIL_TIP_ADMIN_IDS (comma-separated if there are multiple approved spenders).`
    );
  }

  if (!env.DWALLET_API_KEY) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Veil's DWallet API key is not configured on this Worker.");
  }

  const target = message?.reply_to_message?.from;
  if (!target?.id) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Reply to the recipient's message with `/veiltip $5 SOL` (or a raw amount like `/veiltip 0.01 SOL`).");
  }
  if (target.is_bot) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Veil direct tips are for Telegram users, not bot accounts.");
  }

  const amount = args[0];
  const currency = args[1];
  if (!amount || !currency) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Usage: reply to a user's message with `/veiltip $5 SOL`. You can add a note after the asset ticker.");
  }

  const targetName = [target.first_name, target.last_name].filter(Boolean).join(" ").trim() || target.username || `Telegram ${target.id}`;
  const suppliedNote = args.slice(2).join(" ").trim();
  const note = suppliedNote || `Veil direct tip authorized by ${user.displayName}`;

  try {
    const sent = await sendDirectDwalletTip(env, {
      toUserId: target.id,
      amount,
      currency,
      note
    });
    return sendTelegramMessage(
      scope,
      env.TELEGRAM_BOT_TOKEN,
      `💜 Veil tipped ${targetName} ${sent.amount} ${sent.currency}.${sent.tipId ? `\nDWallet tip #${sent.tipId}` : ""}\nAuthorized by ${user.displayName}.`
    );
  } catch (error) {
    return sendTelegramMessage(
      scope,
      env.TELEGRAM_BOT_TOKEN,
      `⚠️ Veil tip failed: ${String(error?.message || error)}\n\nNo automatic retry was attempted. Check Veil's DWallet history before trying again so an ambiguous timeout cannot cause a duplicate payment.`
    );
  }
}

export async function handleTelegramRoute(request, env) {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/telegram/webhook" && env.TELEGRAM_WEBHOOK_SECRET && webhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) {
    const update = await request.clone().json().catch(() => null);
    const message = update?.message;
    if (message?.text) {
      const { command, args } = commandParts(message.text);
      const sub = String(args[0] || "").toLowerCase();
      if (command === "/veiltip") {
        await handleVeilTip(message, args, env);
        return webhookAck();
      }
      if (command === "/arenaforceclose" || (command === "/arena" && (sub === "forceclose" || sub === "close" || sub === "reset"))) {
        await forceCloseTelegramArena(message, env);
        return webhookAck();
      }
    }
  }

  return baseHandleTelegramRoute(request, env);
}
