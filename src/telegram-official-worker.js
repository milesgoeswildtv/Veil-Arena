import { ArenaCoordinator } from "./coordinator.js";
import { createGame, addPlayer } from "./core/engine.js";
import {
  ensureSchema,
  loadActiveGameForChannel,
  loadFinishedGameForGuild,
  loadPlayerStats,
  loadArenaLeaderboard,
  saveGame
} from "./storage.js";
import { rulesForTheme } from "./rules.js";
import { buildArenaLog } from "./logs.js";
import { getArenaCooldownRemaining, formatCooldown } from "./cooldown.js";
import {
  TELEGRAM_ALLOWED_UPDATES,
  configureTelegramBot,
  telegramWebhookAuthorized,
  telegramScope,
  isTelegramGroup,
  userFromTelegram,
  telegramArenaLaunchUrl,
  telegramArenaLauncherKeyboard,
  sendTelegramMessage,
  sendTelegramTextFile
} from "./telegram.js";
import {
  handleOfficialMiniAppState,
  handleOfficialMiniAppAction,
  authenticateTelegramArenaRequest
} from "./telegram-official-miniapp.js";
import { miniAppHtml } from "./miniapp.js";
import { injectMiniAppHubHtml } from "./hub.js";
import { upsertSponsorship } from "./sponsorships.js";
import { SPONSOR_PANEL_CLIENT } from "./sponsor-panel-client.js";
import { TEST_PANEL_CLIENT } from "./test-panel-client.js";
import { arenaTestModeEnabled, handleTelegramTestMode, markNewTestGame } from "./test-mode.js";

export { ArenaCoordinator };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
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

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function commandParts(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  const command = (parts.shift() || "").toLowerCase().split("@")[0];
  return { command, args: parts };
}

function statsText(user, stats) {
  const games = Number(stats?.games_played || 0);
  const wins = Number(stats?.wins || 0);
  const rate = games ? ((wins / games) * 100).toFixed(1) : "0.0";
  return `# ⚔️ ${user.displayName}'S ARENA STATS\n\n**Arenas Played:** ${games}\n**Wins:** ${wins}\n**Total Eliminations:** ${Number(stats?.total_kills || 0)}\n**Total Revivals:** ${Number(stats?.total_revivals || 0)}\n**Most Eliminations in One Arena:** ${Number(stats?.max_kills_single_game || 0)}\n**Community Showdowns Survived:** ${Number(stats?.crowd_survivals || 0)}\n**Win Rate:** ${rate}%`;
}

function boardSection(title, rows) {
  if (!rows?.length) return `**${title}**\nNo records yet.`;
  return `**${title}**\n${rows.map((r, i) => `${i + 1}. ${r.display_name} — **${r.value}**`).join("\n")}`;
}

function leaderboardText(board) {
  return [
    "# 🏆 DWALLET ARENA LEADERBOARD",
    boardSection("⚔️ MOST ARENAS PLAYED", board.gamesPlayed),
    boardSection("👑 MOST WINS", board.wins),
    boardSection("💀 TOTAL ELIMINATIONS", board.kills),
    boardSection("🕯️ TOTAL REVIVALS", board.revivals),
    boardSection("🔥 BEST SINGLE GAME", board.singleGameKills),
    boardSection("👁️ SHOWDOWNS SURVIVED", board.crowdSurvivals)
  ].join("\n\n");
}

async function postArenaLauncher(env, game, user, label = "⚔️ ENTER / WATCH ARENA") {
  const launchUrl = game.telegramLaunchUrl || await telegramArenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
  const posted = await sendTelegramMessage(game.channelId, env.TELEGRAM_BOT_TOKEN, {
    text: `# 💜 DWALLET ARENA\nRegistration is open. **${user?.displayName || game.players?.[game.hostId]?.displayName || "Host"}** is hosting.\n\nTap below to open the Arena. Telegram binds this direct Mini App launch to this group.`,
    reply_markup: telegramArenaLauncherKeyboard(launchUrl, label)
  });
  game.telegramLaunchUrl = launchUrl;
  if (!game.telegramLauncherMessageId) game.telegramLauncherMessageId = posted?.id || null;
  await saveGame(env.DB, game);
  return posted;
}

async function startArenaFromGroup(message, env) {
  if (!isTelegramGroup(message.chat)) {
    return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, {
      text: "Arena runs inside a Telegram group or supergroup. Add Veil to a group, then use /arena there."
    });
  }
  const user = userFromTelegram(message.from);
  if (!user) return null;
  await ensureSchema(env.DB);
  const channelId = telegramScope(message.chat.id);
  let game = await loadActiveGameForChannel(env.DB, channelId);
  if (game) {
    const url = game.telegramLaunchUrl || await telegramArenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
    game.telegramLaunchUrl = url;
    await saveGame(env.DB, game);
    return sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
      text: "💜 There is already an Arena active in this group.",
      reply_markup: telegramArenaLauncherKeyboard(url, "⚔️ OPEN ACTIVE ARENA")
    });
  }

  if (!arenaTestModeEnabled(env)) {
    const remaining = await getArenaCooldownRemaining(env.DB, channelId);
    if (remaining > 0) {
      return sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
        text: `⏳ DWallet Arena is cooling down. Try again in **${formatCooldown(remaining)}**.`
      });
    }
  }

  game = createGame({ guildId: channelId, channelId, hostId: user.id, themeId: "dwallet", platform: "telegram" });
  addPlayer(game, user);
  if (arenaTestModeEnabled(env)) markNewTestGame(game);
  await saveGame(env.DB, game);
  return postArenaLauncher(env, game, user, arenaTestModeEnabled(env) ? "🧪 ENTER / WATCH QA ARENA" : "⚔️ ENTER / WATCH ARENA");
}

async function commandStatus(message, env) {
  if (!isTelegramGroup(message.chat)) return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, { text: "Use /arenastatus inside a Telegram group." });
  await ensureSchema(env.DB);
  const channelId = telegramScope(message.chat.id);
  const game = await loadActiveGameForChannel(env.DB, channelId);
  if (game) {
    const url = game.telegramLaunchUrl || await telegramArenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
    return sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
      text: `💜 Arena is **${game.status}**. Round **${Number(game.round) || 0}**.`,
      reply_markup: telegramArenaLauncherKeyboard(url, "⚔️ OPEN ARENA")
    });
  }
  const remaining = arenaTestModeEnabled(env) ? 0 : await getArenaCooldownRemaining(env.DB, channelId);
  return sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
    text: remaining > 0 ? `⏳ No Arena is active. Cooldown: **${formatCooldown(remaining)}**.` : "No Arena is active. Use `/arena` to open one."
  });
}

async function commandStats(message, env) {
  if (!isTelegramGroup(message.chat)) return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, { text: "Arena stats are scoped to Telegram groups." });
  const user = userFromTelegram(message.from);
  if (!user) return null;
  await ensureSchema(env.DB);
  const scope = telegramScope(message.chat.id);
  const stats = await loadPlayerStats(env.DB, scope, user.id);
  return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, { text: statsText(user, stats) });
}

async function commandLeaderboard(message, env) {
  if (!isTelegramGroup(message.chat)) return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, { text: "Arena leaderboards are scoped to Telegram groups." });
  await ensureSchema(env.DB);
  const scope = telegramScope(message.chat.id);
  const board = await loadArenaLeaderboard(env.DB, scope, 5);
  return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, { text: leaderboardText(board) });
}

async function commandHistory(message, env) {
  if (!isTelegramGroup(message.chat)) return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, { text: "Arena history is scoped to Telegram groups." });
  await ensureSchema(env.DB);
  const scope = telegramScope(message.chat.id);
  const lines = ["# 📚 DWALLET ARENA HISTORY"];
  for (let offset = 0; offset < 5; offset++) {
    const game = await loadFinishedGameForGuild(env.DB, scope, offset);
    if (!game) break;
    const winner = game.players?.[game.winnerId]?.displayName || "No winner";
    lines.push(`${offset + 1}. **${winner}** — ${Number(game.round) || 0} rounds`);
  }
  if (lines.length === 1) lines.push("No completed Arenas yet.");
  return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, { text: lines.join("\n") });
}

async function commandLog(message, env, args) {
  if (!isTelegramGroup(message.chat)) return sendTelegramMessage(String(message.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, { text: "Arena logs are scoped to Telegram groups." });
  await ensureSchema(env.DB);
  const scope = telegramScope(message.chat.id);
  const match = Math.max(1, Math.floor(Number(args[0]) || 1));
  const game = await loadFinishedGameForGuild(env.DB, scope, match - 1);
  if (!game) return sendTelegramMessage(scope, env.TELEGRAM_BOT_TOKEN, { text: `I couldn't find completed Arena match #${match} for this group.` });
  return sendTelegramTextFile(scope, env.TELEGRAM_BOT_TOKEN, `arena-match-${match}-${game.id.slice(0, 8)}.txt`, buildArenaLog(game, match), `📜 Arena Match ${match} narration log`);
}

async function handleTelegramMessage(message, env) {
  const { command, args } = commandParts(message?.text || "");
  if (!command) return;
  if (command === "/ping") return sendTelegramMessage(String(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: "💜 Veil is online." });
  if (command === "/start") return sendTelegramMessage(String(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: isTelegramGroup(message.chat) ? "💜 Veil is connected. Use /arena." : "💜 Veil is connected. Add me to a Telegram group, make me an admin, then use /arena there." });
  if (command === "/arena") {
    const sub = String(args[0] || "").toLowerCase();
    if (!sub || sub === "start") return startArenaFromGroup(message, env);
    if (sub === "rules") return sendTelegramMessage(telegramScope(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: rulesForTheme("dwallet") });
    return sendTelegramMessage(String(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: "Use `/arena` to open Arena or `/arenarules` for the rules." });
  }
  if (command === "/arenastatus") return commandStatus(message, env);
  if (command === "/arenarules") return sendTelegramMessage(String(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: rulesForTheme("dwallet") });
  if (command === "/arenahelp") return sendTelegramMessage(String(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: "`/arena` open/reopen • `/arenastatus` status • `/arenarules` rules • `/arenastats` your stats • `/arenaleaderboard` leaders • `/arenahistory` recent winners • `/arenalog 1` newest match log" });
  if (command === "/arenastats") return commandStats(message, env);
  if (command === "/arenaleaderboard") return commandLeaderboard(message, env);
  if (command === "/arenahistory") return commandHistory(message, env);
  if (command === "/arenalog") return commandLog(message, env, args);
}

async function handleWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return new Response("Telegram is not configured", { status: 503 });
  if (!telegramWebhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return new Response("Bad Telegram webhook secret", { status: 401 });
  if (!env.DB) return new Response("Arena database missing", { status: 503 });
  const update = await request.json().catch(() => null);
  if (!update) return new Response("Bad update", { status: 400 });
  if (update.message?.text) await handleTelegramMessage(update.message, env);
  return json({ ok: true });
}

function setupPage(origin, env) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Telegram Setup</title><style>body{font-family:system-ui;margin:0;background:#0d0d10;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,620px);background:#19191d;border:1px solid #34343b;padding:24px;border-radius:20px}input,button{width:100%;box-sizing:border-box;padding:14px;border-radius:12px;font-size:16px}input{background:#0b0b0e;color:#fff;border:1px solid #41414b}button{margin-top:10px;border:0;background:#8f59f7;color:#fff;font-weight:900}.url{background:#0b0b0e;padding:12px;border-radius:10px;word-break:break-all;color:#d4baff}.muted{color:#aaa;font-size:13px;line-height:1.5}</style></head><body><div class="card"><h1>💜 Veil Telegram Arena</h1><p class="muted">Clean Telegram setup. BotFather Main Mini App URL:</p><div class="url">${esc(origin)}/tg</div><p class="muted">REGISTER TELEGRAM clears the old webhook, registers this Worker's <code>/telegram/webhook</code>, applies Telegram's secret-token header, allowed updates, and commands.</p><form method="post" action="/admin/telegram/register"><input type="password" name="adminSecret" placeholder="ADMIN_SECRET" autocomplete="current-password" required><button type="submit">REGISTER TELEGRAM</button></form><p class="muted">Required Worker secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ADMIN_SECRET.</p></div></body></html>`;
}

async function setupTelegram(request, env) {
  const type = request.headers.get("content-type") || "";
  let provided = request.headers.get("x-admin-secret") || "";
  let asHtml = false;
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    provided = provided || String(form?.get("adminSecret") || "");
    asHtml = true;
  }
  const respond = (data, status = 200) => asHtml ? html(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#111;color:#fff;padding:30px"><h1>${data.ok ? "✅ Telegram registered" : "❌ Telegram setup failed"}</h1><pre style="white-space:pre-wrap">${esc(data.ok ? `Bot: @${data.botUsername}\nWebhook: ${data.webhookUrl}\nMini App: ${data.miniAppUrl}\nAllowed updates: ${data.allowedUpdates.join(", ")}` : data.error)}</pre><a style="color:#cdb3ff" href="/setup/telegram">Back</a></body></html>`, status) : json(data, status);
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) return respond({ ok: false, error: "ADMIN_SECRET is missing or does not match." }, 401);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return respond({ ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET is missing." }, 500);
  const origin = new URL(request.url).origin;
  try {
    const configured = await configureTelegramBot(env.TELEGRAM_BOT_TOKEN, `${origin}/telegram/webhook`, env.TELEGRAM_WEBHOOK_SECRET, { dropPendingUpdates: true });
    return respond({
      ok: true,
      botUsername: configured.bot?.username || null,
      webhookUrl: configured.webhook?.url || `${origin}/telegram/webhook`,
      miniAppUrl: `${origin}/tg`,
      allowedUpdates: configured.webhook?.allowed_updates || TELEGRAM_ALLOWED_UPDATES,
      pendingUpdates: configured.webhook?.pending_update_count || 0
    });
  } catch (error) {
    return respond({ ok: false, error: String(error?.message || error) }, 502);
  }
}

function sponsorPanelHtml() {
  return `<section id="arenaSponsorPanel" class="arenaSponsorPanel"><style>.arenaSponsorPanel{max-width:760px;margin:10px auto 24px;padding:15px;border:1px solid #3a2a4d;border-radius:18px;background:linear-gradient(180deg,#1b1327,#120e1a);color:#f7f3ff;font-family:Inter,system-ui,sans-serif}.arenaSponsorPanel h3{margin:0 0 5px}.arenaSponsorPanel .spMeta{font-size:10px;letter-spacing:.1em;color:#cdb3ff;font-weight:900;margin-bottom:12px}.arenaSponsorGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.arenaSponsorField{display:grid;gap:5px;font-size:11px;font-weight:850;color:#c8bed2}.arenaSponsorField input{width:100%;box-sizing:border-box;border:1px solid #403050;border-radius:11px;background:#0c0911;color:#fff;padding:11px;font-size:15px}.arenaSponsorActions{display:flex;gap:8px;margin-top:10px}.arenaSponsorActions button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:900;background:#8f59f7;color:white}.arenaSponsorActions button.secondary{background:#2a2037}.sponsorEntry{padding:10px 0;border-top:1px solid #30233f;font-size:12px;line-height:1.45}.sponsorEmpty{color:#93889e;font-size:12px;padding:7px 0}@media(max-width:560px){.arenaSponsorGrid{grid-template-columns:1fr}}</style><h3>💸 Sponsor this Arena</h3><div class="spMeta" data-sponsor-status>LOADING SPONSORSHIPS…</div><form data-sponsor-form><div class="arenaSponsorGrid"><label class="arenaSponsorField">🏆 Winner ($)<input name="winner" inputmode="decimal" type="number" min="0" step="0.01" placeholder="5.00"></label><label class="arenaSponsorField">💀 Most Eliminations ($)<input name="most_kills" inputmode="decimal" type="number" min="0" step="0.01" placeholder="2.00"></label></div><div data-sponsor-extras hidden><div class="arenaSponsorGrid" style="margin-top:8px"><label class="arenaSponsorField">🥈 Runner-Up ($)<input name="runner_up" inputmode="decimal" type="number" min="0" step="0.01"></label><label class="arenaSponsorField">⚡ Most Revivals ($)<input name="most_revivals" inputmode="decimal" type="number" min="0" step="0.01"></label><label class="arenaSponsorField">👁 Most Showdowns Survived ($)<input name="most_showdowns" inputmode="decimal" type="number" min="0" step="0.01"></label><label class="arenaSponsorField">💥 Most Mass Brawls Survived ($)<input name="most_mass_brawls" inputmode="decimal" type="number" min="0" step="0.01"></label></div></div><div class="arenaSponsorActions"><button type="button" class="secondary" data-sponsor-more>＋ MORE PRIZE OPTIONS</button><button type="submit" data-sponsor-submit>SAVE SPONSORSHIP</button></div></form><div data-sponsor-list style="margin-top:12px"></div><script src="/telegram/sponsor/app.js"></script></section>`;
}

function testPanelHtml() {
  return `<section id="arenaTestPanel" class="arenaTestPanel"><style>.arenaTestPanel{max-width:760px;margin:12px auto 24px;padding:15px;border:1px solid #78445f;border-radius:18px;background:linear-gradient(180deg,#24101b,#120b12);color:#fff;font-family:Inter,system-ui,sans-serif}.arenaTestPanel h3{margin:0 0 4px}.qaStripe{font:900 10px ui-monospace;letter-spacing:.12em;color:#ff97b4;margin-bottom:10px}.qaSummary{font-size:11px;line-height:1.45;color:#d2bec8;background:#10090e;border:1px solid #3e2632;border-radius:11px;padding:9px;margin-bottom:10px}.qaWarning{font-size:11px;color:#ffb8ca;margin-bottom:10px}.qaControls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.qaControls button{display:grid;gap:3px;text-align:left;border:1px solid #603346;background:#351523;color:white;border-radius:12px;padding:11px;min-height:64px}.qaControls button b{font-size:12px}.qaControls button span{font-size:9px;color:#d5afbd;font-weight:700}.qaControls button:disabled{opacity:.5}.qaHost{font-size:9px;color:#9b818c;margin:8px 0 0}@media(max-width:560px){.qaControls{grid-template-columns:1fr}}</style><div class="qaStripe">⚠ TEST WORKER // PRIVATE QA ONLY</div><h3>🧪 Arena Test Controls</h3><div class="qaWarning">QA uses the same Telegram group-bound Mini App authentication as production. The 30-minute production cooldown is bypassed.</div><div class="qaSummary" data-test-summary>CONNECTING TO QA ENGINE…</div><div data-test-host-only class="qaHost">HOST CONTROLS</div><div class="qaControls" data-test-controls></div><script src="/telegram/test/app.js"></script></section>`;
}

function appHtml(env) {
  let source = injectMiniAppHubHtml(miniAppHtml());
  source = source.replace("</body>", `${sponsorPanelHtml()}${arenaTestModeEnabled(env) ? testPanelHtml() : ""}</body>`);
  return source;
}

async function handleHub(request, env) {
  try {
    const { auth, game } = await authenticateTelegramArenaRequest(request, env);
    const view = new URL(request.url).searchParams.get("view") || "stats";
    if (view === "stats") {
      const stats = await loadPlayerStats(env.DB, game.guildId, auth.user.id);
      const games = Number(stats?.games_played || 0), wins = Number(stats?.wins || 0);
      return json({ ok: true, viewer: { id: auth.user.id, displayName: auth.user.displayName }, stats: { games, wins, losses: Math.max(0, games - wins), winRate: games ? Number(((wins / games) * 100).toFixed(1)) : 0, eliminations: Number(stats?.total_kills || 0), bestGame: Number(stats?.max_kills_single_game || 0), revivals: Number(stats?.total_revivals || 0), showdownSurvivals: Number(stats?.crowd_survivals || 0) } });
    }
    if (view === "leaderboard") return json({ ok: true, leaderboard: await loadArenaLeaderboard(env.DB, game.guildId, 5) });
    return json({ ok: false, error: "Unknown Mini App hub view." }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 401);
  }
}

async function handleSponsor(request, env) {
  try {
    const body = request.method === "POST" ? await request.clone().json().catch(() => ({})) : {};
    const { auth, game } = await authenticateTelegramArenaRequest(request, env, body);
    if (request.method === "POST") {
      upsertSponsorship(game, auth.user, body.awards || {});
      await saveGame(env.DB, game);
    }
    return json({ ok: true, status: game.status, sponsorships: game.sponsorships || [] });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, worker: "telegram-official", testMode: arenaTestModeEnabled(env) });
    if (request.method === "GET" && url.pathname === "/setup/telegram") return html(setupPage(url.origin, env));
    if (request.method === "POST" && url.pathname === "/admin/telegram/register") return setupTelegram(request, env);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") return handleWebhook(request, env);

    if (request.method === "GET" && (url.pathname === "/tg" || url.pathname === "/telegram/arena")) return html(appHtml(env));
    if (request.method === "GET" && url.pathname === "/telegram/sponsor/app.js") return new Response(SPONSOR_PANEL_CLIENT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
    if (arenaTestModeEnabled(env) && request.method === "GET" && url.pathname === "/telegram/test/app.js") return new Response(TEST_PANEL_CLIENT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });

    if (request.method === "GET" && url.pathname === "/telegram/miniapp/state") return handleOfficialMiniAppState(request, env);
    if (request.method === "POST" && url.pathname === "/telegram/miniapp/action") return handleOfficialMiniAppAction(request, env);
    if (request.method === "GET" && url.pathname === "/telegram/miniapp/hub") return handleHub(request, env);
    if (["GET", "POST"].includes(request.method) && url.pathname === "/telegram/miniapp/sponsor") return handleSponsor(request, env);
    if (arenaTestModeEnabled(env) && ["GET", "POST"].includes(request.method) && url.pathname === "/telegram/miniapp/test") return handleTelegramTestMode(request, env);

    return new Response("Not found", { status: 404 });
  }
};
