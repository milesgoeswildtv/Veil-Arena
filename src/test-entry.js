import app, { ArenaCoordinator } from "./activity-entry.js";
import { TEST_PANEL_CLIENT } from "./test-panel-client.js";
import { arenaTestModeEnabled, handleTelegramTestMode, markNewTestGame } from "./test-mode.js";
import { createGame, addPlayer } from "./core/engine.js";
import { ensureSchema, loadActiveGameForChannel, saveGame, setGuildTheme } from "./storage.js";
import { registerGuildCommands } from "./discord.js";
import {
  telegramWebhookAuthorized,
  userFromTelegram,
  sendTelegramMessage,
  telegramArenaLaunchUrl,
  telegramArenaLauncherKeyboard
} from "./telegram.js";

export { ArenaCoordinator };

const DISCORD_THEMES = new Set(["dwallet", "full_tilt", "vibe_queen_slots"]);

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
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

function discordSetupPage(origin, env) {
  const checks = [
    ["Discord Application ID", Boolean(env.DISCORD_APPLICATION_ID)],
    ["Discord Bot Token", Boolean(env.DISCORD_BOT_TOKEN)],
    ["Discord Public Key", Boolean(env.DISCORD_PUBLIC_KEY)],
    ["Arena Database", Boolean(env.DB)],
    ["ADMIN_SECRET", Boolean(env.ADMIN_SECRET)]
  ];
  const rows = checks.map(([label, ready]) => `<div class="check ${ready ? "ready" : "missing"}"><span>${ready ? "✓" : "✕"}</span><b>${esc(label)}</b><em>${ready ? "READY" : "MISSING"}</em></div>`).join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Discord Arena Setup</title><style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0c0911;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,600px);background:linear-gradient(180deg,#1c1428,#120d19);border:1px solid #3a2a4d;padding:24px;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin:0 0 6px}.muted{color:#b4a5c1;font-size:13px;line-height:1.5}.checks{display:grid;gap:6px;margin:16px 0}.check{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:#0e0a13;font-size:12px}.check em{font-style:normal;font-size:10px;font-weight:900;letter-spacing:.08em}.ready{color:#9af0c1}.missing{color:#ff9bb4}label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#cfb8e6;margin:12px 0}input,select,button{width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:16px}input,select{background:#0b0810;color:#fff;border:1px solid #463356}button{border:0;background:#8f59f7;color:#fff;font-weight:900;margin-top:8px}code{background:#0a0710;padding:2px 5px;border-radius:5px}.hint{font-size:11px;color:#9588a0;margin-top:14px}</style></head><body><div class="card">
<h1>⚔️ Veil Discord Arena Setup</h1>
<p class="muted">This refreshes Arena's Discord slash commands for one server, including <b>/arena sponsor</b>. This form does not depend on JavaScript.</p>
<div class="checks">${rows}</div>
<form method="post" action="/admin/discord/register">
<label>Discord Server / Guild ID<input name="guildId" inputmode="numeric" pattern="[0-9]{15,22}" placeholder="123456789012345678" required></label>
<label>Arena Theme<select name="themeId"><option value="dwallet">DWallet</option><option value="full_tilt">Full Tilt</option><option value="vibe_queen_slots">Vibe Queen Slots</option></select></label>
<label>Cloudflare ADMIN_SECRET<input name="adminSecret" type="password" placeholder="ADMIN_SECRET" autocomplete="current-password" required></label>
<button type="submit">REGISTER / REFRESH DISCORD COMMANDS</button>
</form>
<p class="hint">Worker: ${esc(origin)}<br>If a credential above says MISSING, fix that Cloudflare variable/secret before registering.</p>
</div></body></html>`;
}

function discordSetupResultPage({ ok: success, message, guildId, themeId, commandsRegistered }) {
  const title = success ? "✅ Discord registered" : "❌ Discord setup failed";
  const detail = esc(message || "");
  const meta = success ? `<p><b>Server:</b> ${esc(guildId || "")}</p><p><b>Theme:</b> ${esc(themeId || "")}</p><p><b>Commands registered:</b> ${esc(commandsRegistered ?? "unknown")}</p><p class="success">Go back to Discord and type <b>/arena</b>. The <b>sponsor</b> subcommand should now be present.</p>` : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui;margin:0;background:#0c0911;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,580px);background:#17101f;border:1px solid #392849;padding:24px;border-radius:18px}.detail{background:#0b0810;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-word;color:#d8cce2}.success{color:#96efbd}a{color:#c8a7ff}</style></head><body><div class="card"><h1>${title}</h1>${meta}<div class="detail">${detail || (success ? "Discord command registration completed successfully." : "Registration failed.")}</div><p><a href="/setup/discord">Back to Discord setup</a></p></div></body></html>`;
}

async function handleDiscordSetupRegister(request, env) {
  const contentType = request.headers.get("content-type") || "";
  let payload = {};
  let provided = request.headers.get("x-admin-secret") || "";
  let htmlResponse = false;

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    payload = {
      guildId: String(form?.get("guildId") || ""),
      themeId: String(form?.get("themeId") || ""),
      adminSecret: String(form?.get("adminSecret") || "")
    };
    provided = provided || payload.adminSecret;
    htmlResponse = true;
  } else {
    payload = await request.json().catch(() => ({}));
  }

  const respond = (body, status = 200) => {
    if (!htmlResponse) return json(body, status);
    return new Response(discordSetupResultPage({
      ok: status >= 200 && status < 300 && body.ok,
      message: body.error || body.message || "",
      guildId: body.guildId,
      themeId: body.themeId,
      commandsRegistered: body.commandsRegistered
    }), { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  };

  if (!env.ADMIN_SECRET) return respond({ ok: false, error: "ADMIN_SECRET is missing on this Cloudflare Worker." }, 500);
  if (provided !== env.ADMIN_SECRET) return respond({ ok: false, error: "ADMIN_SECRET does not match the value configured on this Worker." }, 401);
  if (!env.DISCORD_APPLICATION_ID) return respond({ ok: false, error: "DISCORD_APPLICATION_ID is missing on this Worker." }, 500);
  if (!env.DISCORD_BOT_TOKEN) return respond({ ok: false, error: "DISCORD_BOT_TOKEN is missing on this Worker." }, 500);
  if (!env.DISCORD_PUBLIC_KEY) return respond({ ok: false, error: "DISCORD_PUBLIC_KEY is missing on this Worker." }, 500);
  if (!env.DB) return respond({ ok: false, error: "Arena database binding DB is missing on this Worker." }, 500);

  const guildId = String(payload.guildId || "").trim();
  const themeId = String(payload.themeId || "dwallet").trim();
  if (!/^\d{15,22}$/.test(guildId)) return respond({ ok: false, error: "Enter a valid numeric Discord Server / Guild ID (15–22 digits)." }, 400);
  if (!DISCORD_THEMES.has(themeId)) return respond({ ok: false, error: "Unknown Arena theme." }, 400);

  try {
    await ensureSchema(env.DB);
    const commands = await registerGuildCommands(env.DISCORD_APPLICATION_ID, guildId, env.DISCORD_BOT_TOKEN);
    await setGuildTheme(env.DB, guildId, themeId);
    return respond({
      ok: true,
      guildId,
      themeId,
      commandsRegistered: Array.isArray(commands) ? commands.length : null,
      message: "Discord accepted the current Arena command schema."
    });
  } catch (error) {
    return respond({ ok: false, error: `Discord registration failed: ${String(error?.message || error)}` }, 502);
  }
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

    if (request.method === "GET" && url.pathname === "/setup/discord") {
      return new Response(discordSetupPage(url.origin, env), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }

    if (request.method === "GET" && url.pathname === "/setup/discord/health") {
      return json({
        ok: true,
        discordApplicationId: Boolean(env.DISCORD_APPLICATION_ID),
        discordBotToken: Boolean(env.DISCORD_BOT_TOKEN),
        discordPublicKey: Boolean(env.DISCORD_PUBLIC_KEY),
        database: Boolean(env.DB),
        adminSecret: Boolean(env.ADMIN_SECRET)
      });
    }

    if (request.method === "POST" && url.pathname === "/admin/discord/register") {
      return handleDiscordSetupRegister(request, env);
    }

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
