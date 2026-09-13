import { createGame, addPlayer } from "./core/engine.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { getArenaCooldownRemaining, formatCooldown } from "./cooldown.js";
import { rulesForTheme } from "./rules.js";
import {
  telegramScope,
  isTelegramGroup,
  userFromTelegram,
  webhookAuthorized,
  configureTelegram,
  sendTelegramMessage,
  arenaLaunchUrl,
  getTelegramBot,
  getTelegramWebhook
} from "./telegram.js";
import { telegramMiniAppHtml, telegramState, telegramAction } from "./telegram-app.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

function commandParts(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  return { command: (parts.shift() || "").toLowerCase().split("@")[0], args: parts };
}

async function launchKeyboard(env, game, label = "⚔️ OPEN ARENA") {
  const url = game.telegramLaunchUrl || await arenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
  if (!game.telegramLaunchUrl) {
    game.telegramLaunchUrl = url;
    await saveGame(env.DB, game);
  }
  return { inline_keyboard: [[{ text: label, url }]] };
}

async function startArena(message, env) {
  const chatId = message?.chat?.id;
  const scope = telegramScope(chatId);
  if (!isTelegramGroup(message?.chat)) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Arena runs in a Telegram group. Add Veil to a group, then use /arena there.");
  }

  const user = userFromTelegram(message.from);
  if (!user) return;
  await ensureSchema(env.DB);
  let game = await loadActiveGameForChannel(env.DB, scope);
  if (game) {
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "💜 There is already an Arena active in this group.", await launchKeyboard(env, game, "⚔️ OPEN ACTIVE ARENA"));
  }

  if (env.TELEGRAM_TEST_MODE !== "true") {
    const remaining = await getArenaCooldownRemaining(env.DB, scope);
    if (remaining > 0) {
      return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, `⏳ Arena is cooling down. Try again in ${formatCooldown(remaining)}.`);
    }
  }

  game = createGame({ guildId: scope, channelId: scope, hostId: user.id, themeId: "dwallet", platform: "telegram" });
  addPlayer(game, user);
  game.displayLog = [];
  game.telegramChatInstance = null;
  await saveGame(env.DB, game);
  const keyboard = await launchKeyboard(env, game, "⚔️ ENTER / WATCH ARENA");
  const mode = env.TELEGRAM_TEST_MODE === "true" ? "\n\n🧪 TEST MODE is ON: host bot-fill/reset controls are enabled and cooldown is bypassed." : "";
  return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, `💜 DWALLET ARENA\n\nRegistration is open. ${user.displayName} is hosting. Tap below to enter the live Arena window.${mode}`, keyboard);
}

async function statusArena(message, env) {
  const scope = telegramScope(message?.chat?.id);
  if (!isTelegramGroup(message?.chat)) return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Use /arenastatus in a Telegram group.");
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, scope);
  if (!game) return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "No Arena is active. Use /arena to open one.");
  return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, `💜 Arena is ${game.status}. Round ${Number(game.round) || 0}.`, await launchKeyboard(env, game));
}

async function handleMessage(message, env) {
  const { command, args } = commandParts(message?.text || "");
  const scope = telegramScope(message?.chat?.id);
  if (!command) return;
  if (command === "/ping") return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "💜 Veil is online.");
  if (command === "/start") return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, isTelegramGroup(message.chat) ? "💜 Veil is connected. Use /arena." : "💜 Veil is connected. Add me to a group, then use /arena there.");
  if (command === "/arena") {
    const sub = String(args[0] || "").toLowerCase();
    if (!sub || sub === "start") return startArena(message, env);
    if (sub === "rules") return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, rulesForTheme("dwallet"));
    return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "Use /arena to open Arena or /arenarules for the rules.");
  }
  if (command === "/arenastatus") return statusArena(message, env);
  if (command === "/arenarules") return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, rulesForTheme("dwallet"));
  if (command === "/arenahelp") return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, "/arena — open/reopen Arena\n/arenastatus — status\n/arenarules — rules\n/ping — bot check");
}

async function handleWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return new Response("Telegram is not configured", { status: 503 });
  if (!webhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return new Response("Bad Telegram webhook secret", { status: 401 });
  const update = await request.json().catch(() => null);
  if (!update) return new Response("Bad Telegram update", { status: 400 });
  if (update.message?.text) await handleMessage(update.message, env);
  return json({ ok: true });
}

function setupHtml(origin, configured) {
  const yes = value => value ? "✅" : "❌";
  return `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Telegram Setup</title><style>body{font-family:system-ui;background:#0b0810;color:#fff;padding:22px}.card{max-width:680px;margin:auto;background:#171020;border:1px solid #5a3e75;border-radius:20px;padding:22px}input,button{width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:16px}input{background:#09070d;color:white;border:1px solid #4a365d}button{margin-top:8px;background:#8d57e8;color:white;border:0;font-weight:900}.code{padding:10px;background:#09070d;border-radius:10px;word-break:break-all;color:#d8c3f7}</style><body><div class="card"><h1>💜 Veil Telegram</h1><p>${yes(configured.token)} Bot token &nbsp; ${yes(configured.webhookSecret)} Webhook secret &nbsp; ${yes(configured.adminSecret)} Admin secret &nbsp; ${yes(configured.db)} D1</p><p><b>BotFather Main Mini App URL</b></p><div class="code">${origin}/telegram/app</div><p>After the three secrets are in Cloudflare, register the webhook once:</p><form method="post" action="/telegram/setup/register"><input type="password" name="adminSecret" placeholder="ADMIN_SECRET" required><button>REGISTER TELEGRAM</button></form><p>Testing: set <code>TELEGRAM_TEST_MODE=true</code> to enable host test bots/reset and bypass the 30-minute cooldown.</p></div></body></html>`;
}

async function registerTelegram(request, env) {
  const form = await request.formData().catch(() => null);
  const provided = request.headers.get("x-admin-secret") || String(form?.get("adminSecret") || "");
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) return html("<h1>Unauthorized</h1>", 401);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return html("<h1>Missing Telegram secrets</h1>", 400);
  const origin = new URL(request.url).origin;
  try {
    const result = await configureTelegram(env.TELEGRAM_BOT_TOKEN, `${origin}/telegram/webhook`, env.TELEGRAM_WEBHOOK_SECRET);
    return html(`<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#111;color:white;padding:30px"><h1>✅ Telegram registered</h1><p>Bot: @${result.bot?.username || "unknown"}</p><p>Webhook: ${result.webhook?.url || "missing"}</p><p>Now set BotFather Main Mini App URL to:</p><code>${origin}/telegram/app</code></body>`);
  } catch (error) {
    return html(`<h1>❌ Telegram setup failed</h1><pre>${String(error?.message || error)}</pre>`, 500);
  }
}

export async function handleTelegramRoute(request, env) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/telegram/webhook") return handleWebhook(request, env);
  if (request.method === "GET" && url.pathname === "/telegram/app") return html(telegramMiniAppHtml());
  if (request.method === "GET" && url.pathname === "/telegram/api/state") {
    try { return json(await telegramState(request, env)); } catch (error) { return json({ error: String(error?.message || error) }, 400); }
  }
  if (request.method === "POST" && url.pathname === "/telegram/api/action") {
    try { return json(await telegramAction(request, env)); } catch (error) { return json({ error: String(error?.message || error) }, 400); }
  }
  if (request.method === "GET" && url.pathname === "/telegram/setup") {
    return html(setupHtml(url.origin, {
      token: Boolean(env.TELEGRAM_BOT_TOKEN),
      webhookSecret: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
      adminSecret: Boolean(env.ADMIN_SECRET),
      db: Boolean(env.DB)
    }));
  }
  if (request.method === "POST" && url.pathname === "/telegram/setup/register") return registerTelegram(request, env);
  if (request.method === "GET" && url.pathname === "/telegram/health") {
    let bot = null, webhook = null, error = null;
    if (env.TELEGRAM_BOT_TOKEN) {
      try {
        [bot, webhook] = await Promise.all([getTelegramBot(env.TELEGRAM_BOT_TOKEN), getTelegramWebhook(env.TELEGRAM_BOT_TOKEN)]);
      } catch (e) { error = String(e?.message || e); }
    }
    return json({
      ok: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.DB),
      bot: bot ? { id: bot.id, username: bot.username } : null,
      webhook: webhook ? { url: webhook.url, pendingUpdateCount: webhook.pending_update_count, lastErrorMessage: webhook.last_error_message || null } : null,
      testMode: env.TELEGRAM_TEST_MODE === "true",
      error
    });
  }
  return null;
}
