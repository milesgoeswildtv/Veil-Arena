import app, { ArenaCoordinator } from "./discord-recovery-entry.js";
import { liveActivityHtml } from "./activity-live.js";
import { ACTIVITY_LIVE_CLIENT } from "./activity-live-client.js";
import { createGame, addPlayer, removePlayer, startGame, castCrowdVote } from "./core/engine.js";
import { ensureSchema, loadActiveGameForChannel, loadGame, saveGame, getGuildConfig, setGuildTheme } from "./storage.js";
import { themeForGuild } from "./server-config.js";
import { getTheme } from "./themes/index.js";

export { ArenaCoordinator };

const SDK_URL = "https://esm.sh/@discord/embedded-app-sdk@2.5.0?bundle&target=es2022";
const ACTIVITY_SESSION_MS = 12 * 60 * 60 * 1000;
const BOT_NAMES = {
  full_tilt: ["TEST // River Rat","TEST // Tilt Goblin","TEST // Chip Gremlin","TEST // Railbird","TEST // Bad Beat","TEST // Felt Menace","TEST // Cooler Dealer","TEST // River Demon","TEST // Pit Boss","TEST // All-In Andy","TEST // Cage Goblin","TEST // High Limit Menace"],
  vibe_queen_slots: ["TEST // Static Doll","TEST // Dead Reel","TEST // Hallway Thing","TEST // Tape Ghost","TEST // Slot Goblin","TEST // Backroom Guest","TEST // Night Shift","TEST // Red Light","TEST // Cold Machine","TEST // Lost Player","TEST // CCTV Thing","TEST // House Guest"],
  dwallet: ["TEST // Drop Goblin","TEST // Wallet Gremlin","TEST // Claim Rat","TEST // Ledger Lurker","TEST // Peach Intern","TEST // Crek Clone","TEST // Bot Basement","TEST // QR Menace","TEST // Vault Thing","TEST // API Closet","TEST // Tip Tunnel","TEST // Degen Intern"]
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function b64urlFromBytes(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlFromString(value) { return b64urlFromBytes(new TextEncoder().encode(value)); }
function b64urlToString(value) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(raw); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signSession(payload, secret) {
  const body = b64urlFromString(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${b64urlFromBytes(sig)}`;
}
async function verifySession(token, secret) {
  const [body, sigText] = String(token || "").split(".");
  if (!body || !sigText || !secret) throw new Error("Activity session is missing or invalid.");
  const sigRaw = sigText.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((sigText.length + 3) % 4);
  const sigBinary = atob(sigRaw); const sig = Uint8Array.from(sigBinary, c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, new TextEncoder().encode(body));
  if (!ok) throw new Error("Activity session signature failed.");
  const payload = JSON.parse(b64urlToString(body));
  if (!payload.exp || Date.now() > payload.exp) throw new Error("Activity session expired. Reopen the Activity.");
  return payload;
}

function rewriteEsmImports(source) {
  return String(source)
    .replace(/(from\s*["'])\/(.*?)(["'])/g, '$1/activity/sdk-proxy/$2$3')
    .replace(/(import\s*["'])\/(.*?)(["'])/g, '$1/activity/sdk-proxy/$2$3');
}
async function sdkProxy(target) {
  const upstream = await fetch(target, { headers: { "user-agent": "Veil-Arena-Activity/1.0" } });
  if (!upstream.ok) return new Response(`Discord SDK proxy failed: ${upstream.status}`, { status: 502 });
  const body = rewriteEsmImports(await upstream.text());
  return new Response(body, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
}

async function exchangeDiscordCode(code, env) {
  if (!env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID is missing.");
  if (!env.DISCORD_CLIENT_SECRET) throw new Error("DISCORD_CLIENT_SECRET is missing on the Worker. Add it from Discord Developer Portal → OAuth2.");
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_APPLICATION_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: String(code || "")
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `Discord OAuth failed (${response.status}).`);
  return data;
}

async function discordBearer(path, accessToken) {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Discord user verification failed (${response.status}).`);
  return data;
}
async function discordBot(path, botToken) {
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN is missing.");
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bot ${botToken}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Discord channel verification failed (${response.status}).`);
  return data;
}

async function handleActivityOAuth(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const guildId = String(body.guildId || "");
    const channelId = String(body.channelId || "");
    if (!body.code || !/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId)) throw new Error("Activity launch context is incomplete.");
    const token = await exchangeDiscordCode(body.code, env);
    const [user, guilds, channel] = await Promise.all([
      discordBearer("/users/@me", token.access_token),
      discordBearer("/users/@me/guilds", token.access_token),
      discordBot(`/channels/${channelId}`, env.DISCORD_BOT_TOKEN)
    ]);
    if (!Array.isArray(guilds) || !guilds.some(g => String(g.id) === guildId)) throw new Error("Your Discord account is not a member of this server.");
    if (String(channel?.guild_id || "") !== guildId) throw new Error("That Activity channel does not belong to this server.");
    const displayName = user.global_name || user.username || "Discord User";
    const session = await signSession({ id: String(user.id), username: user.username || null, displayName, guildId, channelId, exp: Date.now() + ACTIVITY_SESSION_MS }, env.DISCORD_CLIENT_SECRET);
    return json({ ok: true, access_token: token.access_token, session, user: { id: String(user.id), username: user.username, global_name: user.global_name, avatar: user.avatar } });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

async function activitySession(request, env) {
  const token = request.headers.get("x-arena-session") || "";
  return verifySession(token, env.DISCORD_CLIENT_SECRET);
}
async function themeIdForGuild(env, guildId) {
  const cfg = await getGuildConfig(env.DB, guildId);
  const id = themeForGuild(guildId, cfg.theme_id);
  if (id !== cfg.theme_id) await setGuildTheme(env.DB, guildId, id);
  return id;
}
async function latestFinishedForChannel(db, channelId) {
  const row = await db.prepare(`SELECT state_json FROM games WHERE channel_id = ? AND status = 'finished' ORDER BY updated_at DESC, created_at DESC LIMIT 1`).bind(channelId).first();
  return row ? JSON.parse(row.state_json) : null;
}
function isQaBot(player) { return Boolean(player?.testBot || player?.simulated); }
function botId(game, index) { return `activitybot:${game.id}:${index + 1}`; }
function addBots(game, count) {
  if (game.status !== "registration") throw new Error("Test bots can only be added during registration.");
  const names = BOT_NAMES[game.themeId] || BOT_NAMES.full_tilt;
  let added = 0;
  for (let i = 0; i < 48 && added < count; i++) {
    const id = botId(game, i); if (game.players[id]) continue;
    addPlayer(game, { id, username: `veil_test_${i + 1}`, displayName: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : "") });
    game.players[id].testBot = true; game.players[id].simulated = "qa_bot"; added++;
  }
  return added;
}
function removeBots(game) {
  if (game.status !== "registration") throw new Error("Test bots can only be removed during registration.");
  const ids = Object.values(game.players || {}).filter(isQaBot).map(p => p.id);
  for (const id of ids) removePlayer(game, id);
  return ids.length;
}
async function wakeCoordinator(env, channelId) {
  if (!env.ARENA_COORDINATOR) return;
  const stub = env.ARENA_COORDINATOR.get(env.ARENA_COORDINATOR.idFromName(channelId));
  await stub.fetch("https://arena.internal/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "kick", channelId, platform: "activity" }) });
}

function publicState(game, session) {
  if (!game) return { gameId: null, status: null, themeId: null, themeName: null, round: 0, playerCount: 0, aliveCount: 0, players: [], latestDisplay: null, crowdVote: null, payoutReport: null, winnerName: null, viewer: { id: session.id, displayName: session.displayName, joined: false, alive: false, isHost: false, canVote: false, vote: null } };
  const players = Object.values(game.players || {}).map(p => ({ id: String(p.id), displayName: p.displayName || p.username || "Unknown", alive: Boolean(p.alive), eliminations: p.eliminations || 0, revivals: p.revivals || 0, simulated: Boolean(p.simulated) }));
  const me = game.players?.[session.id];
  const vote = game.crowdVote?.status === "open" ? {
    open: true,
    closesAt: game.crowdVote.closesAt,
    totals: game.crowdVote.totals || {}
  } : null;
  const latestDisplay = Array.isArray(game.displayLog) && game.displayLog.length ? game.displayLog.at(-1) : null;
  const winnerName = game.winnerId ? (game.players?.[game.winnerId]?.displayName || "Unknown") : null;
  return {
    gameId: game.id,
    status: game.status,
    themeId: game.themeId,
    themeName: getTheme(game.themeId)?.displayName || game.themeId,
    round: Number(game.round) || 0,
    playerCount: players.length,
    aliveCount: (game.aliveIds || []).length,
    players,
    latestDisplay,
    crowdVote: vote,
    payoutReport: game.payoutReport || null,
    winnerName,
    viewer: {
      id: session.id,
      displayName: session.displayName,
      joined: Boolean(me),
      alive: Boolean(me?.alive),
      isHost: String(game.hostId) === String(session.id),
      canVote: Boolean(game.crowdVote?.status === "open" && !(game.aliveIds || []).includes(session.id)),
      vote: game.crowdVote?.votesBySpectator?.[session.id] || null
    }
  };
}

async function getActivityGame(env, channelId) {
  await ensureSchema(env.DB);
  return await loadActiveGameForChannel(env.DB, channelId) || await latestFinishedForChannel(env.DB, channelId);
}
async function handleActivityState(request, env) {
  try {
    if (!env.DB) throw new Error("Arena database is missing.");
    const session = await activitySession(request, env);
    const game = await getActivityGame(env, session.channelId);
    return json({ ok: true, state: publicState(game, session) });
  } catch (error) { return json({ ok: false, error: String(error?.message || error) }, 401); }
}

async function handleActivityAction(request, env) {
  try {
    if (!env.DB) throw new Error("Arena database is missing.");
    const session = await activitySession(request, env);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    await ensureSchema(env.DB);
    let game = await loadActiveGameForChannel(env.DB, session.channelId);
    let message = "Done.";

    if (action === "create") {
      if (game) throw new Error("An Arena is already active in this voice channel.");
      const themeId = await themeIdForGuild(env, session.guildId);
      game = createGame({ guildId: session.guildId, channelId: session.channelId, hostId: session.id, themeId, platform: "activity" });
      game.activityMode = true;
      addPlayer(game, { id: session.id, username: session.username, displayName: session.displayName });
      await saveGame(env.DB, game);
      message = "Arena lobby opened inside this voice channel Activity.";
    } else {
      if (!game) throw new Error("No active Arena exists in this voice channel.");
      const isHost = String(game.hostId) === String(session.id);
      if (action === "join") {
        addPlayer(game, { id: session.id, username: session.username, displayName: session.displayName }); message = "You entered the Arena.";
      } else if (action === "leave") {
        if (isHost) throw new Error("The host cannot leave. Cancel the lobby instead.");
        removePlayer(game, session.id); message = "You left the Arena lobby.";
      } else if (action === "add_bots") {
        if (!isHost) throw new Error("Only the host can add test bots.");
        const added = addBots(game, 4); message = `Added ${added} test bot${added === 1 ? "" : "s"}.`;
      } else if (action === "fill_bots") {
        if (!isHost) throw new Error("Only the host can fill the roster.");
        const need = Math.max(0, 12 - Object.keys(game.players || {}).length); const added = addBots(game, need); message = added ? `Filled the Arena to ${Object.keys(game.players).length} players.` : "Roster is already at 12+ players.";
      } else if (action === "remove_bots") {
        if (!isHost) throw new Error("Only the host can remove test bots.");
        const removed = removeBots(game); message = `Removed ${removed} test bot${removed === 1 ? "" : "s"}.`;
      } else if (action === "start") {
        if (!isHost) throw new Error("Only the host can start the Arena.");
        startGame(game); game.activityMode = true; game.platform = "activity"; message = "Arena started. The first round is loading now.";
      } else if (action === "cancel") {
        if (!isHost) throw new Error("Only the host can cancel the lobby.");
        if (game.status !== "registration") throw new Error("Only a registration lobby can be cancelled.");
        game.status = "cancelled"; game.cancelledAt = new Date().toISOString(); message = "Arena lobby cancelled. Nothing was added to stats.";
      } else if (action === "vote") {
        if (game.status !== "running" || game.crowdVote?.status !== "open") throw new Error("No Community Showdown vote is open.");
        if ((game.aliveIds || []).includes(session.id)) throw new Error("You are still fighting. Only spectators vote.");
        castCrowdVote(game, session.id, String(body.playerId || "")); message = "Vote updated.";
      } else throw new Error("Unknown Activity action.");
      await saveGame(env.DB, game);
      if (action === "start") await wakeCoordinator(env, game.channelId);
    }

    const state = game?.status === "cancelled" ? publicState(null, session) : publicState(game, session);
    return json({ ok: true, message, state });
  } catch (error) { return json({ ok: false, error: String(error?.message || error) }, 400); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/activity-preview" || url.pathname === "/activity-preview/" || url.pathname === "/activity" || url.pathname === "/")) {
      return new Response(liveActivityHtml(env.DISCORD_APPLICATION_ID || ""), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-arena-activity": "live-v1" } });
    }
    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return new Response(ACTIVITY_LIVE_CLIENT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    }
    if (request.method === "GET" && url.pathname === "/activity/sdk.js") return sdkProxy(SDK_URL);
    if (request.method === "GET" && url.pathname.startsWith("/activity/sdk-proxy/")) {
      const tail = url.pathname.slice("/activity/sdk-proxy/".length);
      return sdkProxy(`https://esm.sh/${tail}${url.search}`);
    }
    if (request.method === "POST" && url.pathname === "/activity/oauth/token") return handleActivityOAuth(request, env);
    if (request.method === "GET" && url.pathname === "/activity/state") return handleActivityState(request, env);
    if (request.method === "POST" && url.pathname === "/activity/action") return handleActivityAction(request, env);
    if (request.method === "GET" && url.pathname === "/activity/health") {
      return json({ ok: true, activity: "Veil Arena Live", oauthReady: Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_CLIENT_SECRET), botReady: Boolean(env.DISCORD_BOT_TOKEN), database: Boolean(env.DB), coordinator: Boolean(env.ARENA_COORDINATOR) });
    }

    return app.fetch(request, env, ctx);
  }
};
