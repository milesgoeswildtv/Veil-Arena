import app, { ArenaCoordinator } from "./activity-entry.js";
import { TEST_PANEL_CLIENT } from "./test-panel-client.js";
import { arenaTestModeEnabled, handleTelegramTestMode, markNewTestGame } from "./test-mode.js";
import { createGame, addPlayer } from "./core/engine.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import {
  telegramWebhookAuthorized,
  userFromTelegram,
  sendTelegramMessage,
  telegramArenaLaunchUrl,
  telegramArenaLauncherKeyboard
} from "./telegram.js";

export { ArenaCoordinator };

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function tgScope(chatId) {
  return `tg:${chatId}`;
}

function commandParts(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  const command = (parts.shift() || "").toLowerCase().split("@")[0];
  return { command, args: parts };
}

function isGroup(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

function testPanelHtml() {
  return `<section id="arenaTestPanel" class="arenaTestPanel">
<style>
.arenaTestPanel{max-width:760px;margin:12px auto 24px;padding:15px;border:1px solid #78445f;border-radius:18px;background:linear-gradient(180deg,#24101b,#120b12);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 0 34px rgba(255,76,126,.08)}.arenaTestPanel h3{margin:0 0 4px}.qaStripe{font:900 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#ff97b4;margin-bottom:10px}.qaSummary{font-size:11px;line-height:1.45;color:#d2bec8;background:#10090e;border:1px solid #3e2632;border-radius:11px;padding:9px;margin-bottom:10px}.qaWarning{font-size:11px;color:#ffb8ca;margin-bottom:10px}.qaControls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.qaControls button{display:grid;gap:3px;text-align:left;border:1px solid #603346;background:#351523;color:white;border-radius:12px;padding:11px;min-height:64px}.qaControls button b{font-size:12px}.qaControls button span{font-size:9px;color:#d5afbd;font-weight:700;line-height:1.25}.qaControls button:disabled{opacity:.5}.qaNote{font-size:11px;color:#c8b4bd;padding:8px 0}.qaHost{font-size:9px;color:#9b818c;margin:8px 0 0}@media(max-width:560px){.qaControls{grid-template-columns:1fr}}
</style>
<div class="qaStripe">⚠ TEST WORKER // PRIVATE QA ONLY</div>
<h3>🧪 Arena Test Controls</h3>
<div class="qaWarning">Nothing here exists on the production DWallet bot. QA bots are full engine participants and the 30-minute production cooldown is bypassed.</div>
<div class="qaSummary" data-test-summary>CONNECTING TO QA ENGINE…</div>
<div data-test-host-only class="qaHost">HOST CONTROLS</div>
<div class="qaControls" data-test-controls></div>
<script src="/telegram/test/app.js"></script>
</section>`;
}

function injectTestPanel(source) {
  const html = String(source);
  if (html.includes('id="arenaTestPanel"')) return html;
  return html.replace("</body>", `${testPanelHtml()}</body>`);
}

async function handleTestArenaLaunch(request, env) {
  if (!arenaTestModeEnabled(env)) return null;
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.DB) return null;
  if (!telegramWebhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return null;
  const update = await request.clone().json().catch(() => null);
  const message = update?.message;
  if (!message?.text) return null;
  const { command, args } = commandParts(message.text);
  const sub = String(args[0] || "").toLowerCase();
  if (command !== "/arena" || (sub && sub !== "start")) return null;

  const chat = message.chat;
  if (!isGroup(chat)) {
    await sendTelegramMessage(String(chat?.id || ""), env.TELEGRAM_BOT_TOKEN, {
      text: "QA Arena must be opened from the private test Telegram group."
    });
    return ok();
  }
  const user = userFromTelegram(message.from);
  if (!user) return ok();

  await ensureSchema(env.DB);
  const channelId = tgScope(chat.id);
  const active = await loadActiveGameForChannel(env.DB, channelId);
  if (active) {
    const controls = active.telegramLaunchUrl
      ? telegramArenaLauncherKeyboard(active.telegramLaunchUrl, "🧪 OPEN QA ARENA")
      : undefined;
    await sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
      text: "# 🧪 DWALLET ARENA — TEST MODE\nA QA Arena is already active. **There is no test cooldown.**\n\nOpen it below or use ABORT / RESET TEST inside the QA panel.",
      reply_markup: controls
    });
    return ok();
  }

  const game = markNewTestGame(createGame({
    guildId: channelId,
    channelId,
    hostId: user.id,
    themeId: "dwallet",
    platform: "telegram"
  }));
  addPlayer(game, user);
  await saveGame(env.DB, game);

  const launchUrl = await telegramArenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
  const posted = await sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
    text: `# 🧪 DWALLET ARENA — TEST MODE\nRegistration is open. **${user.displayName}** is hosting.\n\nHave the four human testers enter first, then the host can use **FILL TO 12** in the QA panel. Synthetic contestants use the real Arena engine.\n\n**TEST RULE:** no 30-minute cooldown. Abort/reset whenever you want.`,
    reply_markup: telegramArenaLauncherKeyboard(launchUrl, "🧪 ENTER / WATCH QA ARENA")
  });
  game.telegramLaunchUrl = launchUrl;
  game.telegramLauncherMessageId = posted?.id || null;
  await saveGame(env.DB, game);
  return ok();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const testEnabled = arenaTestModeEnabled(env);

    if (testEnabled && request.method === "GET" && url.pathname === "/telegram/test/app.js") {
      return new Response(TEST_PANEL_CLIENT, {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }
      });
    }

    if (testEnabled && url.pathname === "/telegram/miniapp/test" && ["GET", "POST"].includes(request.method)) {
      return handleTelegramTestMode(request, env);
    }

    if (testEnabled && url.pathname === "/telegram/webhook" && request.method === "POST") {
      const handled = await handleTestArenaLaunch(request, env);
      if (handled) return handled;
    }

    if (testEnabled && request.method === "GET" && (url.pathname === "/tg" || url.pathname === "/telegram/arena")) {
      const original = await app.fetch(request, env, ctx);
      const type = original.headers.get("content-type") || "";
      if (!type.includes("text/html")) return original;
      const headers = new Headers(original.headers);
      headers.set("cache-control", "no-store");
      headers.set("x-arena-test-mode", "1");
      return new Response(injectTestPanel(await original.text()), { status: original.status, headers });
    }

    return app.fetch(request, env, ctx);
  }
};
