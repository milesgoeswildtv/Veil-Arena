import { createGame, addPlayer, startGame, castCrowdVote } from "./core/engine.js";
import { addFakeContestants, setSimulatedCrowd } from "./core/simulation.js";
import { advanceArenaGame } from "./core/orchestrator.js";
import { ensureSchema, loadGame, loadActiveGameForChannel, saveGame, recordFinishedGame } from "./storage.js";
import { themeForGuild } from "./server-config.js";

const DISCORD_API = "https://discord.com/api/v10";
let activitySchemaReady = false;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function activityScope(guildId, channelId) {
  return `activity:${guildId}:${channelId}`;
}

async function ensureActivitySchema(db) {
  await ensureSchema(db);
  if (activitySchemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS activity_sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      instance_id TEXT,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_activity_sessions_expires ON activity_sessions(expires_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS arena_registrations (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (game_id, user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activity_tick_leases (
      game_id TEXT PRIMARY KEY,
      lease_until INTEGER NOT NULL DEFAULT 0
    )`)
  ]);
  activitySchemaReady = true;
}

async function discordBearer(path, accessToken) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Discord OAuth ${response.status}: ${data?.message || "request failed"}`);
  return data;
}

async function exchangeCode(code, env) {
  if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_CLIENT_SECRET) throw new Error("Discord Activity OAuth credentials are missing.");
  if (!code) throw new Error("Discord authorization code is missing.");
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: String(env.DISCORD_APPLICATION_ID),
      client_secret: String(env.DISCORD_CLIENT_SECRET),
      grant_type: "authorization_code",
      code: String(code)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`Discord token exchange failed: ${data?.error_description || data?.error || response.status}`);
  return data;
}

function bearerFrom(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function createActivitySession(request, env) {
  if (!env.DB) throw new Error("Arena database is not configured.");
  await ensureActivitySchema(env.DB);
  const accessToken = bearerFrom(request);
  if (!accessToken) throw new Error("Discord access token is missing.");
  const body = await request.json().catch(() => ({}));
  const guildId = String(body.guildId || "");
  const channelId = String(body.channelId || "");
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId)) throw new Error("Discord Activity guild/channel context is missing.");

  const [user, guilds] = await Promise.all([
    discordBearer("/users/@me", accessToken),
    discordBearer("/users/@me/guilds", accessToken)
  ]);
  if (!Array.isArray(guilds) || !guilds.some(guild => String(guild.id) === guildId)) throw new Error("Your Discord authorization does not include this server.");

  const displayName = user.global_name || user.username || `Discord ${user.id}`;
  const session = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  await env.DB.prepare(`
    INSERT INTO activity_sessions (session_token, user_id, display_name, guild_id, channel_id, channel_name, instance_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    session,
    String(user.id),
    displayName,
    guildId,
    channelId,
    String(body.channelName || "Discord Activity").slice(0, 120),
    body.instanceId ? String(body.instanceId).slice(0, 160) : null,
    expiresAt
  ).run();
  return { session, expiresAt };
}

async function requireSession(request, env) {
  if (!env.DB) throw new Error("Arena database is not configured.");
  await ensureActivitySchema(env.DB);
  const token = request.headers.get("x-veil-session") || "";
  if (!token) throw new Error("Veil Activity session is missing.");
  const row = await env.DB.prepare(`
    SELECT session_token, user_id, display_name, guild_id, channel_id, channel_name, instance_id, expires_at
    FROM activity_sessions WHERE session_token = ?
  `).bind(token).first();
  if (!row || Number(row.expires_at) <= Date.now()) throw new Error("Veil Activity session expired. Reopen the Activity.");
  return {
    token,
    user: { id: String(row.user_id), displayName: row.display_name, username: null },
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    channelName: row.channel_name || "Discord Activity",
    instanceId: row.instance_id || null,
    scope: activityScope(row.guild_id, row.channel_id)
  };
}

async function hydrateRegistrations(db, game) {
  if (!game || game.status !== "registration") return game;
  const rows = await db.prepare(`
    SELECT user_id, display_name, username FROM arena_registrations
    WHERE game_id = ? ORDER BY joined_at ASC
  `).bind(game.id).all();
  const hydrated = structuredClone(game);
  for (const row of rows?.results || []) {
    const id = String(row.user_id);
    if (hydrated.players[id]) continue;
    addPlayer(hydrated, { id, displayName: row.display_name, username: row.username || null });
  }
  return hydrated;
}

async function latestFinishedGame(db, scope) {
  const row = await db.prepare(`
    SELECT state_json FROM games WHERE channel_id = ? AND status = 'finished'
    ORDER BY updated_at DESC LIMIT 1
  `).bind(scope).first();
  return row?.state_json ? JSON.parse(row.state_json) : null;
}

async function currentGame(env, session, includeFinished = true) {
  let game = await loadActiveGameForChannel(env.DB, session.scope);
  if (!game && includeFinished) game = await latestFinishedGame(env.DB, session.scope);
  return hydrateRegistrations(env.DB, game);
}

async function acquireTickLease(db, gameId, now) {
  const result = await db.prepare(`
    INSERT INTO activity_tick_leases (game_id, lease_until) VALUES (?, ?)
    ON CONFLICT(game_id) DO UPDATE SET lease_until = excluded.lease_until
    WHERE activity_tick_leases.lease_until < ?
  `).bind(gameId, now + 4000, now).run();
  return Boolean(result?.meta?.changes);
}

async function releaseTickLease(db, gameId) {
  await db.prepare("UPDATE activity_tick_leases SET lease_until = 0 WHERE game_id = ?").bind(gameId).run();
}

async function maybeAdvance(env, game) {
  if (!game || game.status !== "running") return game;
  const now = Date.now();
  if (Number(game.nextAdvanceAt || 0) > now) return game;
  if (!await acquireTickLease(env.DB, game.id, now)) return loadGame(env.DB, game.id);
  try {
    const fresh = await loadGame(env.DB, game.id);
    if (!fresh || fresh.status !== "running" || Number(fresh.nextAdvanceAt || 0) > Date.now()) return fresh || game;
    const event = advanceArenaGame(fresh);
    fresh.lastEvent = { type: event.type, round: event.round, text: event.text || null, at: new Date().toISOString() };
    fresh.nextAdvanceAt = event.finished ? null : Date.now() + Math.max(750, Number(event.waitMs) || 1500);
    await saveGame(env.DB, fresh);
    if (fresh.status === "finished") await recordFinishedGame(env.DB, fresh);
    return fresh;
  } finally {
    await releaseTickLease(env.DB, game.id);
  }
}

function publicState(game, session, env) {
  if (!game || game.status === "cancelled" || game.status === "aborted") {
    return { game: null, viewer: { ...session.user, joined: false, alive: false, isHost: false, canVote: false }, channelName: session.channelName, testMode: env.DISCORD_ACTIVITY_TEST_MODE === "true" };
  }
  const viewer = game.players?.[session.user.id] || null;
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  return {
    channelName: session.channelName,
    testMode: env.DISCORD_ACTIVITY_TEST_MODE === "true",
    viewer: {
      id: session.user.id,
      displayName: session.user.displayName,
      joined: Boolean(viewer),
      alive: Boolean(viewer?.alive),
      isHost: String(game.hostId) === String(session.user.id),
      canVote: Boolean(vote && !(game.aliveIds || []).includes(session.user.id) && (!vote.closesAt || Date.now() < vote.closesAt))
    },
    game: {
      id: game.id,
      status: game.status,
      round: Number(game.round) || 0,
      hostId: String(game.hostId),
      winnerId: game.winnerId || null,
      playerCount: Object.keys(game.players || {}).length,
      aliveCount: (game.aliveIds || []).length,
      players: Object.values(game.players || {}).map(player => ({
        id: String(player.id),
        displayName: player.displayName,
        alive: Boolean(player.alive),
        simulated: Boolean(player.simulated),
        eliminations: Number(player.eliminations || 0),
        revivals: Number(player.revivals || 0)
      })),
      displayLog: Array.isArray(game.displayLog) ? game.displayLog.slice(-20) : [],
      lastEvent: game.lastEvent || null,
      crowdVote: vote ? {
        eligibleIds: [...vote.eligibleIds],
        totals: { ...(vote.totals || {}) },
        closesAt: vote.closesAt || null,
        selectedId: vote.votesBySpectator?.[session.user.id] || null
      } : null
    }
  };
}

async function actionOpen(env, session) {
  let active = await loadActiveGameForChannel(env.DB, session.scope);
  if (active) return hydrateRegistrations(env.DB, active);
  const themeId = themeForGuild(session.guildId, "vibe_queen_slots");
  const game = createGame({ guildId: session.guildId, channelId: session.scope, hostId: session.user.id, themeId, platform: "activity" });
  game.discordChannelId = session.channelId;
  game.discordInstanceId = session.instanceId;
  addPlayer(game, session.user);
  await saveGame(env.DB, game);
  return game;
}

async function actionJoin(env, game, user) {
  if (!game || game.status !== "registration") throw new Error("Registration is not open.");
  if (game.players?.[user.id]) return game;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO arena_registrations (game_id, user_id, display_name, username)
    VALUES (?, ?, ?, ?)
  `).bind(game.id, user.id, user.displayName, user.username || null).run();
  return hydrateRegistrations(env.DB, game);
}

async function actionLeave(env, game, user) {
  if (!game || game.status !== "registration") throw new Error("Registration is closed.");
  if (String(game.hostId) === String(user.id)) throw new Error("The host cannot leave registration.");
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ? AND user_id = ?").bind(game.id, user.id).run();
  return hydrateRegistrations(env.DB, game);
}

async function actionBots(env, game, user, fill) {
  if (env.DISCORD_ACTIVITY_TEST_MODE !== "true") throw new Error("Activity test controls are disabled.");
  if (!game || game.status !== "registration") throw new Error("Bots can only be added during registration.");
  if (String(game.hostId) !== String(user.id)) throw new Error("Only the host can add test bots.");
  const hydrated = await hydrateRegistrations(env.DB, game);
  const count = fill ? Math.max(0, 12 - Object.keys(hydrated.players).length) : 4;
  if (count) addFakeContestants(hydrated, count);
  setSimulatedCrowd(hydrated, true);
  await saveGame(env.DB, hydrated);
  return hydrated;
}

async function actionStart(env, game, user) {
  if (!game || game.status !== "registration") throw new Error("Arena has already started.");
  if (String(game.hostId) !== String(user.id)) throw new Error("Only the host can start Arena.");
  const hydrated = await hydrateRegistrations(env.DB, game);
  if (Object.keys(hydrated.players).length < 2) throw new Error("Arena needs at least 2 players.");
  if (Object.values(hydrated.players).some(player => player.simulated)) setSimulatedCrowd(hydrated, true);
  startGame(hydrated);
  hydrated.nextAdvanceAt = Date.now() + 1000;
  hydrated.displayLog = hydrated.displayLog || [];
  await saveGame(env.DB, hydrated);
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
  return hydrated;
}

async function actionAbort(env, game, user) {
  if (!game || !["registration", "running", "starting"].includes(game.status)) throw new Error("No active Arena to abort.");
  if (String(game.hostId) !== String(user.id)) throw new Error("Only the host can abort Arena from the Activity.");
  game.status = "cancelled";
  game.nextAdvanceAt = null;
  game.history = Array.isArray(game.history) ? game.history : [];
  game.history.push({ type: "activity_aborted", byUserId: user.id, at: new Date().toISOString() });
  await saveGame(env.DB, game);
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
  return game;
}

async function actionVote(env, game, user, targetId) {
  if (!game?.crowdVote || game.crowdVote.status !== "open") throw new Error("The Community Showdown vote is closed.");
  if ((game.aliveIds || []).includes(user.id)) throw new Error("You're still fighting. Spectators get this vote.");
  castCrowdVote(game, user.id, String(targetId || ""));
  await saveGame(env.DB, game);
  return game;
}

export async function handleDiscordActivityRoute(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/activity/config" && request.method === "GET") {
      if (!env.DISCORD_APPLICATION_ID) return json({ error: "DISCORD_APPLICATION_ID is missing." }, 503);
      return json({ clientId: String(env.DISCORD_APPLICATION_ID), build: "2026-09-13-official-activity-1" });
    }

    if (url.pathname === "/api/token" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const token = await exchangeCode(body.code, env);
      return json({ access_token: token.access_token });
    }

    if (url.pathname === "/api/activity/session" && request.method === "POST") {
      return json(await createActivitySession(request, env));
    }

    if (url.pathname === "/api/activity/state" && request.method === "GET") {
      const session = await requireSession(request, env);
      let game = await currentGame(env, session, true);
      game = await maybeAdvance(env, game);
      if (game) game = await hydrateRegistrations(env.DB, game);
      return json(publicState(game, session, env));
    }

    if (url.pathname === "/api/activity/action" && request.method === "POST") {
      const session = await requireSession(request, env);
      const body = await request.json().catch(() => ({}));
      const action = String(body.action || "");
      let game = await currentGame(env, session, false);
      if (action === "open") game = await actionOpen(env, session);
      else if (action === "join") game = await actionJoin(env, game, session.user);
      else if (action === "leave") game = await actionLeave(env, game, session.user);
      else if (action === "add4") game = await actionBots(env, game, session.user, false);
      else if (action === "fill") game = await actionBots(env, game, session.user, true);
      else if (action === "start") game = await actionStart(env, game, session.user);
      else if (action === "abort") game = await actionAbort(env, game, session.user);
      else if (action === "vote") game = await actionVote(env, game, session.user, body.targetId);
      else throw new Error("Unknown Activity action.");
      if (game) game = await hydrateRegistrations(env.DB, game);
      return json(publicState(game, session, env));
    }
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }
  return null;
}
