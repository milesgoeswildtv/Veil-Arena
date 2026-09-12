import worker from "./index.js";
export { ArenaCoordinator } from "./index.js";

import {
  ensureSchema,
  loadPlayerStats,
  loadArenaLeaderboard,
  loadFinishedGameForGuild,
  loadActiveGameForChannel
} from "./storage.js";
import { rulesForTheme } from "./rules.js";
import { buildArenaLog } from "./logs.js";
import {
  userFromTelegram,
  sendTelegramMessage,
  sendTelegramTextFile,
  telegramWebhookAuthorized,
  telegramArenaLauncherKeyboard
} from "./telegram.js";
import { getArenaCooldownRemaining, formatCooldown } from "./cooldown.js";
import { handleMiniAppHub, injectMiniAppHubHtml } from "./hub.js";

function tgScope(chatId) { return `tg:${chatId}`; }
function tgCommand(text = "") {
  const first = String(text).trim().split(/\s+/)[0] || "";
  return first.toLowerCase().split("@")[0];
}
function tgArgs(text = "") { return String(text).trim().split(/\s+/).slice(1); }
function isGroup(chat) { return chat?.type === "group" || chat?.type === "supergroup"; }
function playerName(game, id) { return game?.players?.[id]?.displayName || game?.players?.[id]?.username || "Unknown"; }
function webhookOk() { return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); }

function personalStatsText(user, stats) {
  const games = stats?.games_played || 0;
  const wins = stats?.wins || 0;
  const kills = stats?.total_kills || 0;
  const revives = stats?.total_revivals || 0;
  const best = stats?.max_kills_single_game || 0;
  const crowd = stats?.crowd_survivals || 0;
  const rate = games ? ((wins / games) * 100).toFixed(1) : "0.0";
  const losses = Math.max(0, games - wins);
  return `# 💜 ${user.displayName}'S DWALLET ARENA STATS\n\n` +
    `**Arenas Played:** ${games}\n` +
    `**Wins:** ${wins}\n` +
    `**Losses:** ${losses}\n` +
    `**Win Rate:** ${rate}%\n` +
    `**Total Eliminations:** ${kills}\n` +
    `**Most Eliminations in One Arena:** ${best}\n` +
    `**Total Revivals:** ${revives}\n` +
    `**Community Showdowns Survived:** ${crowd}\n\n` +
    `*Stats are tracked separately for this Telegram group.*`;
}

function boardSection(title, rows, formatter = row => String(row.value)) {
  if (!rows?.length) return `**${title}**\nNo records yet.`;
  return `**${title}**\n` + rows.map((row, i) => `${i + 1}. ${row.display_name} — **${formatter(row)}**`).join("\n");
}

function leaderboardText(board) {
  return [
    "# 🏆 DWALLET ARENA LEADERBOARD",
    boardSection("⚔️ MOST ARENAS PLAYED", board.gamesPlayed),
    boardSection("👑 MOST WINS", board.wins),
    boardSection("📈 BEST WIN RATE — MIN. 3 ARENAS", board.winRate, row => `${Number(row.value).toFixed(1)}% (${row.wins}-${Math.max(0, row.games_played - row.wins)})`),
    boardSection("💀 TOTAL ELIMINATIONS", board.kills),
    boardSection("🔥 MOST ELIMINATIONS IN ONE ARENA", board.singleGameKills),
    boardSection("🕯️ TOTAL REVIVALS", board.revivals),
    boardSection("👁️ COMMUNITY SHOWDOWNS SURVIVED", board.crowdSurvivals)
  ].join("\n\n");
}

function helpText() {
  return `# 💜 DWALLET ARENA — COMMANDS\n\n` +
    `\`/arena\` — Open a new Arena or reopen the active one.\n` +
    `\`/arenastatus\` — Check registration, the live round, or cooldown.\n` +
    `\`/arenarules\` — Read the full rules.\n` +
    `\`/arenastats\` — View your record in this group.\n` +
    `\`/arenaleaderboard\` — View the group leaderboard.\n` +
    `\`/arenahistory\` — View the five most recent completed Arenas.\n` +
    `\`/arenalog\` — Download the latest completed match log.\n` +
    `\`/arenalog 2\` — Download the previous match, etc.\n\n` +
    `You can also use \`/arena rules\`, \`/arena stats\`, \`/arena leaderboard\`, \`/arena history\`, \`/arena log 2\`, \`/arena status\`, or \`/arena help\`.`;
}

async function requireGroup(message, env) {
  if (isGroup(message?.chat)) return true;
  await sendTelegramMessage(String(message?.chat?.id || ""), env.TELEGRAM_BOT_TOKEN, {
    text: "DWallet Arena commands are meant to be used inside a Telegram group."
  });
  return false;
}

async function sendStats(message, env) {
  if (!await requireGroup(message, env)) return;
  const user = userFromTelegram(message.from);
  if (!user) return;
  await ensureSchema(env.DB);
  const guildId = tgScope(message.chat.id);
  const stats = await loadPlayerStats(env.DB, guildId, user.id);
  await sendTelegramMessage(guildId, env.TELEGRAM_BOT_TOKEN, { text: personalStatsText(user, stats) });
}

async function sendLeaderboard(message, env) {
  if (!await requireGroup(message, env)) return;
  await ensureSchema(env.DB);
  const guildId = tgScope(message.chat.id);
  const board = await loadArenaLeaderboard(env.DB, guildId, 5);
  await sendTelegramMessage(guildId, env.TELEGRAM_BOT_TOKEN, { text: leaderboardText(board) });
}

async function sendRules(message, env) {
  if (!await requireGroup(message, env)) return;
  await sendTelegramMessage(tgScope(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: rulesForTheme("dwallet") });
}

async function sendHelp(message, env) {
  if (!await requireGroup(message, env)) return;
  await sendTelegramMessage(tgScope(message.chat.id), env.TELEGRAM_BOT_TOKEN, { text: helpText() });
}

async function sendHistory(message, env) {
  if (!await requireGroup(message, env)) return;
  await ensureSchema(env.DB);
  const guildId = tgScope(message.chat.id);
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const game = await loadFinishedGameForGuild(env.DB, guildId, i);
    if (!game) break;
    const winner = game.winnerId ? playerName(game, game.winnerId) : "No winner";
    rows.push(`${i + 1}. **${winner}** — ${Object.keys(game.players || {}).length} players • ${game.round || 0} rounds`);
  }
  const text = rows.length
    ? `# 🧾 RECENT DWALLET ARENAS\n\n${rows.join("\n")}\n\n*#1 is the most recent completed Arena.*`
    : "# 🧾 RECENT DWALLET ARENAS\n\nNo completed Arenas yet.";
  await sendTelegramMessage(guildId, env.TELEGRAM_BOT_TOKEN, { text });
}

async function sendLog(message, env, rawMatch) {
  if (!await requireGroup(message, env)) return;
  await ensureSchema(env.DB);
  const guildId = tgScope(message.chat.id);
  const requested = Math.min(25, Math.max(1, Math.floor(Number(rawMatch) || 1)));
  const game = await loadFinishedGameForGuild(env.DB, guildId, requested - 1);
  if (!game) {
    await sendTelegramMessage(guildId, env.TELEGRAM_BOT_TOKEN, {
      text: `I couldn't find completed Arena match #${requested} for this Telegram group.`
    });
    return;
  }
  const log = buildArenaLog(game, requested);
  const filename = `dwallet-arena-match-${requested}-${game.id.slice(0, 8)}.txt`;
  await sendTelegramTextFile(guildId, env.TELEGRAM_BOT_TOKEN, filename, log, `📜 **DWallet Arena Match ${requested} log**`);
}

async function sendStatus(message, env) {
  if (!await requireGroup(message, env)) return;
  await ensureSchema(env.DB);
  const channelId = tgScope(message.chat.id);
  const active = await loadActiveGameForChannel(env.DB, channelId);
  if (active) {
    let text;
    if (active.status === "running") {
      text = `# 💜 DWALLET ARENA — LIVE\n\n**Round:** ${active.round || 0}\n**Alive:** ${active.aliveIds?.length || 0}/${Object.keys(active.players || {}).length}\n\nThe Arena is running inside the Mini App.`;
    } else {
      text = `# 💜 DWALLET ARENA — REGISTRATION\n\nRegistration is open. **${playerName(active, active.hostId)}** is hosting.\n\nOpen the Arena window to enter or watch.`;
    }
    const reply_markup = active.telegramLaunchUrl ? telegramArenaLauncherKeyboard(active.telegramLaunchUrl, active.status === "running" ? "⚔️ WATCH LIVE" : "⚔️ ENTER / WATCH ARENA") : undefined;
    await sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, { text, reply_markup });
    return;
  }

  const cooldown = await getArenaCooldownRemaining(env.DB, channelId);
  if (cooldown > 0) {
    await sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
      text: `# ⏳ DWALLET ARENA — COOLDOWN\n\nNext Arena available in **${formatCooldown(cooldown)}**.`
    });
    return;
  }
  await sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
    text: "# 💜 DWALLET ARENA — READY\n\nNo Arena is active and the group is off cooldown. Use `/arena` to open one."
  });
}

function utilityAction(message) {
  const cmd = tgCommand(message?.text || "");
  const args = tgArgs(message?.text || "");
  if (cmd === "/arenastats") return { action: "stats" };
  if (cmd === "/arenaleaderboard") return { action: "leaderboard" };
  if (cmd === "/arenarules") return { action: "rules" };
  if (cmd === "/arenahelp") return { action: "help" };
  if (cmd === "/arenahistory") return { action: "history" };
  if (cmd === "/arenastatus") return { action: "status" };
  if (cmd === "/arenalog") return { action: "log", value: args[0] };
  if (cmd !== "/arena") return null;
  const sub = String(args[0] || "").toLowerCase();
  if (sub === "rules") return { action: "rules" };
  if (sub === "help" || sub === "commands") return { action: "help" };
  if (sub === "stats") return { action: "stats" };
  if (sub === "leaderboard" || sub === "leaders") return { action: "leaderboard" };
  if (sub === "history" || sub === "recent") return { action: "history" };
  if (sub === "status") return { action: "status" };
  if (sub === "log") return { action: "log", value: args[1] };
  return null;
}

async function handleTelegramUtilityWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.DB) return null;
  if (!telegramWebhookAuthorized(request, env.TELEGRAM_WEBHOOK_SECRET)) return null;
  const update = await request.clone().json().catch(() => null);
  const message = update?.message;
  if (!message?.text) return null;
  const util = utilityAction(message);
  if (!util) return null;

  try {
    if (util.action === "stats") await sendStats(message, env);
    else if (util.action === "leaderboard") await sendLeaderboard(message, env);
    else if (util.action === "rules") await sendRules(message, env);
    else if (util.action === "help") await sendHelp(message, env);
    else if (util.action === "history") await sendHistory(message, env);
    else if (util.action === "status") await sendStatus(message, env);
    else if (util.action === "log") await sendLog(message, env, util.value);
  } catch (error) {
    const target = message?.chat?.id ? tgScope(message.chat.id) : null;
    if (target) {
      await sendTelegramMessage(target, env.TELEGRAM_BOT_TOKEN, {
        text: `Arena command failed: ${String(error?.message || error)}`
      }).catch(() => null);
    }
  }
  return webhookOk();
}

async function serveMiniApp(request, env, ctx) {
  const target = new URL(request.url);
  target.pathname = "/telegram/arena";
  const upstream = await worker.fetch(new Request(target.toString(), request), env, ctx);
  const source = await upstream.text();
  const headers = new Headers(upstream.headers);
  headers.set("cache-control", "no-store");
  return new Response(injectMiniAppHubHtml(source), { status: upstream.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/telegram/miniapp/hub" && request.method === "GET") {
      return handleMiniAppHub(request, env);
    }

    if ((url.pathname === "/tg" || url.pathname === "/telegram/arena") && request.method === "GET") {
      return serveMiniApp(request, env, ctx);
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const handled = await handleTelegramUtilityWebhook(request, env);
      if (handled) return handled;
    }

    return worker.fetch(request, env, ctx);
  }
};
