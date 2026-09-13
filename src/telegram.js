const API_ROOT = "https://api.telegram.org";

export const TELEGRAM_COMMANDS = [
  { command: "arena", description: "Open or reopen a DWallet Arena" },
  { command: "arenastatus", description: "Check the current Arena or cooldown" },
  { command: "arenarules", description: "View DWallet Arena rules" },
  { command: "arenahelp", description: "Show all Arena commands" },
  { command: "arenastats", description: "View your Arena stats" },
  { command: "arenaleaderboard", description: "View Arena leaders" },
  { command: "arenahistory", description: "View recent Arena winners" },
  { command: "arenalog", description: "Download a completed match log" }
];

export const TELEGRAM_ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"];

export function rawTelegramChatId(channelId) {
  return String(channelId ?? "").replace(/^tg:/, "");
}

export function telegramScope(chatId) {
  return `tg:${String(chatId)}`;
}

export function telegramWebhookAuthorized(request, expectedSecret) {
  if (!expectedSecret) return false;
  return request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
}

export function userFromTelegram(from) {
  if (!from?.id) return null;
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return {
    id: String(from.id),
    username: from.username || null,
    displayName: displayName || from.username || `Telegram ${from.id}`
  };
}

export function isTelegramGroup(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

async function telegramRequest(token, method, payload = {}) {
  if (!token) throw new Error("Telegram bot token is not configured.");
  const response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data?.description || response.status}`);
  }
  return data?.result;
}

async function telegramMultipartRequest(token, method, form) {
  if (!token) throw new Error("Telegram bot token is not configured.");
  const response = await fetch(`${API_ROOT}/bot${token}/${method}`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data?.description || response.status}`);
  }
  return data?.result;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function decorateDWalletTelegramText(input) {
  const source = String(input ?? "");
  const isArena = /dwallet|arena|community showdown|second chance/i.test(source);
  if (!isArena || source.startsWith("`DWALLET HQ // VEIL TERMINAL`")) return source;
  let text = source;
  text = text.replace(/^Registration is open\.$/gm, "__REGISTRATION OPEN__");
  text = text.replace(/^The Arena is running inside the Mini App\.$/gm, "> The Arena is running inside the Mini App.");
  text = text.replace(/^Open the Arena window to enter or watch\.$/gm, "> Open the Arena window to enter or watch.");
  text = text.replace(/^Tap below to enter the Arena window\. \*\*All rounds, eliminations, revivals and votes happen inside the Mini App\*\* so this chat stays clean\.$/gm,
    "> Tap below to enter the Arena window. **All rounds, eliminations, revivals and votes happen inside the Mini App** so this chat stays clean.");
  text = text.replace(/^The chaos stops\. One player is left\.$/gm, "||The chaos stops. One player is left.||");
  text = text.replace(/^No Arena is active and the group is off cooldown\. Use `\/arena` to open one\.$/gm,
    "> No Arena is active and the group is off cooldown. Use `/arena` to open one.");
  return `\`DWALLET HQ // VEIL TERMINAL\`\n${text}`;
}

export function discordishToTelegramHtml(input) {
  let text = escapeHtml(input);
  text = text.replace(/^&gt;!\s*(.+)$/gm, "<blockquote expandable>$1</blockquote>");
  text = text.replace(/^&gt;\s*(.+)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/^##\s+(.+)$/gm, "<b><u>$1</u></b>");
  text = text.replace(/^#\s+(.+)$/gm, "<b><u>$1</u></b>");
  text = text.replace(/~~\*\*\*(.+?)\*\*\*~~/g, "<s><b><i>$1</i></b></s>");
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+?)__/g, "<u>$1</u>");
  text = text.replace(/\|\|([^|\n]+?)\|\|/g, "<tg-spoiler>$1</tg-spoiler>");
  text = text.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");
  text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  text = text.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<i>$1</i>");
  text = text.replace(/\\\./g, ".");
  return text;
}

export async function telegramBotInfo(token) {
  return telegramRequest(token, "getMe");
}

export async function telegramWebhookInfo(token) {
  return telegramRequest(token, "getWebhookInfo");
}

export async function configureTelegramBot(token, webhookUrl, webhookSecret, { dropPendingUpdates = true } = {}) {
  const bot = await telegramBotInfo(token);
  await telegramRequest(token, "deleteWebhook", { drop_pending_updates: Boolean(dropPendingUpdates) });
  await telegramRequest(token, "setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    drop_pending_updates: Boolean(dropPendingUpdates)
  });
  await telegramRequest(token, "setMyCommands", { commands: TELEGRAM_COMMANDS });
  const webhook = await telegramWebhookInfo(token);
  return { bot, webhook };
}

export function telegramArenaStartParam(gameId) {
  const value = `arena_${String(gameId)}`;
  if (value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Arena start parameter is invalid for Telegram.");
  return value;
}

// Telegram documents Main Mini App direct links as:
// https://t.me/botusername?startapp=<parameter>
// When opened from a chat, Telegram supplies chat_type and chat_instance in initData.
export async function telegramArenaLaunchUrl(token, gameId) {
  const bot = await telegramBotInfo(token);
  if (!bot?.username) throw new Error("Telegram bot username is missing.");
  return `https://t.me/${bot.username}?startapp=${encodeURIComponent(telegramArenaStartParam(gameId))}&mode=fullscreen`;
}

// In groups we intentionally use a normal URL button pointing at Telegram's direct Mini App link.
// Bot API web_app buttons are not the group-launch primitive.
export function telegramArenaLauncherKeyboard(url, text = "⚔️ ENTER / WATCH ARENA") {
  return { inline_keyboard: [[{ text, url }]] };
}

export function telegramRegistrationKeyboard(game) {
  return {
    inline_keyboard: [
      [
        { text: "⚔️ ENTER ARENA", callback_data: `av:j:${game.id}` },
        { text: "LEAVE", callback_data: `av:l:${game.id}` }
      ],
      [{ text: "▶️ START", callback_data: `av:s:${game.id}` }]
    ]
  };
}

export function telegramCrowdVoteKeyboard(game) {
  const buttons = game.aliveIds.map(id => ({
    text: (game.players[id]?.displayName || "Unknown").slice(0, 40),
    callback_data: `av:v:${game.id}:${id}`
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

export async function telegramUserInChat(channelId, userId, token) {
  try {
    const member = await telegramRequest(token, "getChatMember", {
      chat_id: rawTelegramChatId(channelId),
      user_id: Number(userId)
    });
    return !["left", "kicked"].includes(member?.status);
  } catch {
    return false;
  }
}

export async function sendTelegramMessage(channelId, token, { text, reply_markup = undefined } = {}) {
  const prepared = decorateDWalletTelegramText(text || "");
  const result = await telegramRequest(token, "sendMessage", {
    chat_id: rawTelegramChatId(channelId),
    text: discordishToTelegramHtml(prepared),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(reply_markup ? { reply_markup } : {})
  });
  return { id: String(result?.message_id || ""), raw: result };
}

export async function editTelegramMessage(channelId, messageId, token, { text, reply_markup = undefined } = {}) {
  const prepared = decorateDWalletTelegramText(text || "");
  const result = await telegramRequest(token, "editMessageText", {
    chat_id: rawTelegramChatId(channelId),
    message_id: Number(messageId),
    text: discordishToTelegramHtml(prepared),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(reply_markup ? { reply_markup } : {})
  });
  return { id: String(result?.message_id || messageId), raw: result };
}

export async function deleteTelegramMessage(channelId, messageId, token) {
  if (!messageId) return false;
  try {
    await telegramRequest(token, "deleteMessage", {
      chat_id: rawTelegramChatId(channelId),
      message_id: Number(messageId)
    });
    return true;
  } catch {
    return false;
  }
}

export async function answerTelegramCallback(callbackQueryId, token, text = "") {
  if (!callbackQueryId) return false;
  await telegramRequest(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: String(text || "").slice(0, 190),
    show_alert: false
  });
  return true;
}

export async function sendTelegramTextFile(channelId, token, filename, content, caption = "") {
  const form = new FormData();
  form.set("chat_id", rawTelegramChatId(channelId));
  form.set("document", new Blob([String(content ?? "")], { type: "text/plain;charset=utf-8" }), String(filename || "arena-log.txt"));
  if (caption) {
    form.set("caption", discordishToTelegramHtml(decorateDWalletTelegramText(String(caption).slice(0, 900))));
    form.set("parse_mode", "HTML");
  }
  const result = await telegramMultipartRequest(token, "sendDocument", form);
  return { id: String(result?.message_id || ""), raw: result };
}
