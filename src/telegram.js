const API_ROOT = "https://api.telegram.org";

function rawChatId(channelId) {
  return String(channelId || "").replace(/^tg:/, "");
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function discordishToTelegramHtml(input) {
  let text = escapeHtml(input);
  text = text.replace(/^##\s+(.+)$/gm, "<b>$1</b>");
  text = text.replace(/^#\s+(.+)$/gm, "<b>$1</b>");
  text = text.replace(/~~\*\*\*(.+?)\*\*\*~~/g, "<s><b><i>$1</i></b></s>");
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  text = text.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<i>$1</i>");
  text = text.replace(/\\\./g, ".");
  return text;
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

export async function sendTelegramMessage(channelId, token, { text, reply_markup = undefined } = {}) {
  const result = await telegramRequest(token, "sendMessage", {
    chat_id: rawChatId(channelId),
    text: discordishToTelegramHtml(text || ""),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(reply_markup ? { reply_markup } : {})
  });
  return { id: String(result?.message_id || ""), raw: result };
}

export async function editTelegramMessage(channelId, messageId, token, { text, reply_markup = undefined } = {}) {
  const result = await telegramRequest(token, "editMessageText", {
    chat_id: rawChatId(channelId),
    message_id: Number(messageId),
    text: discordishToTelegramHtml(text || ""),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(reply_markup ? { reply_markup } : {})
  });
  return { id: String(result?.message_id || messageId), raw: result };
}

export async function deleteTelegramMessage(channelId, messageId, token) {
  if (!messageId) return false;
  try {
    await telegramRequest(token, "deleteMessage", {
      chat_id: rawChatId(channelId),
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

export async function configureTelegramBot(token, webhookUrl, webhookSecret) {
  await telegramRequest(token, "setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false
  });
  await telegramRequest(token, "setMyCommands", {
    commands: [
      { command: "arena", description: "Open a DWallet Arena" },
      { command: "arenastats", description: "View your Arena stats" },
      { command: "arenaleaderboard", description: "View Arena leaders" }
    ]
  });
  return true;
}

export function telegramWebhookAuthorized(request, expectedSecret) {
  if (!expectedSecret) return false;
  return request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
}
