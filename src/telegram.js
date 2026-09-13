const API_ROOT = "https://api.telegram.org";
const encoder = new TextEncoder();

export const TELEGRAM_COMMANDS = [
  { command: "arena", description: "Open or reopen DWallet Arena" },
  { command: "arenastatus", description: "Show the current Arena status" },
  { command: "arenarules", description: "Show DWallet Arena rules" },
  { command: "arenaforceclose", description: "Force-close a stuck Arena" },
  { command: "veiltip", description: "Authorized Veil wallet tip (reply to a user)" },
  { command: "arenahelp", description: "Show Arena commands" },
  { command: "ping", description: "Check whether Veil is online" }
];

export const TELEGRAM_ALLOWED_UPDATES = ["message", "my_chat_member"];

export function telegramScope(chatId) {
  return `tg:${String(chatId)}`;
}

export function rawTelegramChatId(scope) {
  return String(scope ?? "").replace(/^tg:/, "");
}

export function isTelegramGroup(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
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

export function webhookAuthorized(request, expectedSecret) {
  return Boolean(expectedSecret) && request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
}

export async function telegramRequest(token, method, payload = {}) {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  const response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data?.description || response.status}`);
  }
  return data.result;
}

export async function getTelegramBot(token) {
  return telegramRequest(token, "getMe");
}

export async function getTelegramWebhook(token) {
  return telegramRequest(token, "getWebhookInfo");
}

export async function configureTelegram(token, webhookUrl, webhookSecret) {
  const bot = await getTelegramBot(token);
  await telegramRequest(token, "deleteWebhook", { drop_pending_updates: true });
  await telegramRequest(token, "setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    drop_pending_updates: true
  });
  await telegramRequest(token, "setMyCommands", { commands: TELEGRAM_COMMANDS });
  const webhook = await getTelegramWebhook(token);
  return { bot, webhook };
}

export async function sendTelegramMessage(scope, token, text, replyMarkup = undefined) {
  if (text && typeof text === "object") {
    replyMarkup = text.reply_markup ?? replyMarkup;
    text = text.text ?? "";
  }
  return telegramRequest(token, "sendMessage", {
    chat_id: rawTelegramChatId(scope),
    text: String(text || ""),
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function deleteTelegramMessage(scope, messageId, token) {
  if (!messageId) return false;
  try {
    await telegramRequest(token, "deleteMessage", {
      chat_id: rawTelegramChatId(scope),
      message_id: Number(messageId)
    });
    return true;
  } catch {
    return false;
  }
}

export async function telegramUserInChat(scope, userId, token) {
  try {
    const member = await telegramRequest(token, "getChatMember", {
      chat_id: rawTelegramChatId(scope),
      user_id: Number(userId)
    });
    return !["left", "kicked"].includes(member?.status);
  } catch {
    return false;
  }
}

export async function arenaLaunchUrl(token, gameId) {
  const bot = await getTelegramBot(token);
  if (!bot?.username) throw new Error("Telegram bot username is missing.");
  const start = `arena_${String(gameId)}`;
  if (start.length > 64 || !/^[A-Za-z0-9_-]+$/.test(start)) throw new Error("Arena start parameter is invalid.");
  return `https://t.me/${bot.username}?startapp=${encodeURIComponent(start)}&mode=fullscreen`;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(keyBytes, value) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) throw new Error("Open Arena from Telegram.");
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date") || 0);
  if (!suppliedHash || !authDate) throw new Error("Telegram authentication is incomplete.");
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - authDate) > maxAgeSeconds) throw new Error("Telegram session expired. Reopen Arena.");

  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const calculated = hex(await hmac(secret, checkString));
  if (!safeEqual(calculated, suppliedHash)) throw new Error("Telegram authentication failed.");

  let rawUser = null;
  try { rawUser = JSON.parse(params.get("user") || "null"); } catch {}
  const user = userFromTelegram(rawUser);
  if (!user) throw new Error("Telegram user identity is missing.");

  const startParam = params.get("start_param") || "";
  const arenaLaunch = startParam.startsWith("arena_");

  return {
    user,
    startParam,
    // Main Mini App deep links reliably include start_param but some Telegram
    // clients omit chat_type/chat_instance even when the link was tapped in a
    // group. Arena already verifies the authenticated user is a member of the
    // exact originating group via getChatMember, so use the signed Arena ID as
    // a stable internal context key instead of rejecting a valid launch.
    chatType: arenaLaunch ? "group" : (params.get("chat_type") || ""),
    chatInstance: arenaLaunch ? `arena:${startParam.slice(6)}` : (params.get("chat_instance") || ""),
    authDate
  };
}