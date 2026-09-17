import { telegramState as baseTelegramState, telegramAction as baseTelegramAction } from "./telegram-live-api-host-controls.js";
import { createGame, addPlayer } from "./core/engine.js";
import { loadGame, saveGame } from "./storage.js";
import { getArenaCooldownRemaining, formatCooldown } from "./cooldown.js";
import { arenaLaunchUrl } from "./telegram.js";

let featureSchemaReady = false;
const REACTION_TTL_MS = 8_000;
const REACTION_RATE_MS = 900;
const REACTIONS = new Set(["💀", "🔥", "😂", "😈", "👀", "💜"]);

async function ensureFeatureSchema(db) {
  if (featureSchemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS telegram_arena_ready (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ready INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (game_id, user_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS telegram_arena_reactions (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (game_id, user_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_telegram_reactions_game_time ON telegram_arena_reactions(game_id, created_at DESC)")
  ]);
  featureSchemaReady = true;
}

function assertHost(game, viewer, action) {
  if (String(game.hostId) !== String(viewer.id)) throw new Error(`Only the Arena host can ${action}.`);
}

function terminalStatus(status) {
  return ["finished", "cancelled", "aborted"].includes(String(status || ""));
}

async function authenticatedContext(request, env) {
  await ensureFeatureSchema(env.DB);
  const state = await baseTelegramState(request, env);
  const game = await loadGame(env.DB, state.id);
  if (!game) throw new Error("That Arena no longer exists.");
  return { state, game, viewer: state.viewer };
}

function recapFor(state, game) {
  if (state.status !== "finished") return null;
  const players = (state.players || []).filter(player => !player.simulated);
  const winner = players.find(player => String(player.id) === String(state.winnerId));
  const maxKills = Math.max(0, ...players.map(player => Number(player.eliminations || 0)));
  const maxRevives = Math.max(0, ...players.map(player => Number(player.revivals || 0)));
  const killLeaders = maxKills > 0 ? players.filter(player => Number(player.eliminations || 0) === maxKills).map(player => player.displayName) : [];
  const reviveLeaders = maxRevives > 0 ? players.filter(player => Number(player.revivals || 0) === maxRevives).map(player => player.displayName) : [];
  return {
    winnerName: winner?.displayName || "No winner",
    rounds: Number(state.round || 0),
    playerCount: players.length,
    maxKills,
    killLeaders,
    maxRevives,
    reviveLeaders,
    crowdSurvivors: Object.values(game.players || {})
      .filter(player => !player.simulated && Number(player.crowdPinsSurvived || 0) > 0)
      .sort((a, b) => Number(b.crowdPinsSurvived || 0) - Number(a.crowdPinsSurvived || 0))
      .slice(0, 3)
      .map(player => ({ displayName: player.displayName, survived: Number(player.crowdPinsSurvived || 0) }))
  };
}

async function augmentState(request, env, suppliedState = null) {
  await ensureFeatureSchema(env.DB);
  const state = suppliedState || await baseTelegramState(request, env);
  const game = await loadGame(env.DB, state.id);
  if (!game) return state;

  const readyRows = state.status === "registration"
    ? await env.DB.prepare("SELECT user_id, ready FROM telegram_arena_ready WHERE game_id = ?").bind(game.id).all()
    : { results: [] };
  const readyMap = new Map((readyRows?.results || []).map(row => [String(row.user_id), Boolean(row.ready)]));

  state.players = (state.players || []).map(player => ({
    ...player,
    ready: String(player.id) === String(game.hostId) ? true : Boolean(readyMap.get(String(player.id))),
    crowdPinsSurvived: Number(game.players?.[player.id]?.crowdPinsSurvived || 0)
  }));
  state.readyCount = state.status === "registration" ? state.players.filter(player => player.ready).length : 0;
  state.registrationLocked = Boolean(game.registrationLocked);
  state.paused = Boolean(game.paused);
  state.rematchOfGameId = game.rematchOfGameId || null;
  state.viewer.ready = state.viewer.isHost ? true : Boolean(readyMap.get(String(state.viewer.id)));
  state.viewer.rematchEligible = Array.isArray(game.rematchRosterIds) && game.rematchRosterIds.includes(String(state.viewer.id));
  state.arenaCode = String(game.id).replace(/-/g, "").slice(-8).toUpperCase();
  state.diagnostics = state.viewer.isHost ? {
    gameId: game.id,
    channelId: game.channelId,
    status: game.status,
    paused: Boolean(game.paused),
    nextAdvanceAt: game.nextAdvanceAt || null,
    lastEventAt: game.lastEvent?.at || null,
    coordinator: game.status === "running" ? (game.paused ? "paused" : "active") : "idle"
  } : null;
  state.recap = recapFor(state, game);

  if (state.status === "running") {
    const cutoff = Date.now() - REACTION_TTL_MS;
    const reactionRows = await env.DB.prepare(`
      SELECT user_id, display_name, emoji, created_at
      FROM telegram_arena_reactions
      WHERE game_id = ? AND created_at >= ?
      ORDER BY created_at ASC
      LIMIT 20
    `).bind(game.id, cutoff).all();
    state.reactions = reactionRows?.results || [];
  } else {
    state.reactions = [];
  }

  if (state.viewer.isHost && terminalStatus(state.status)) {
    const remaining = await getArenaCooldownRemaining(env.DB, game.channelId);
    state.cooldownRemainingMs = remaining;
    state.cooldownText = remaining > 0 ? formatCooldown(remaining) : "";
  } else {
    state.cooldownRemainingMs = 0;
    state.cooldownText = "";
  }

  return state;
}

async function wakeCoordinator(env, game, delayMs = 250) {
  if (!env.ARENA_COORDINATOR) throw new Error("Arena coordinator binding is missing.");
  const id = env.ARENA_COORDINATOR.idFromName(game.channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  const response = await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "wake", channelId: game.channelId, platform: "telegram", delayMs: Math.max(250, Number(delayMs) || 250) })
  });
  if (!response.ok) throw new Error(`Arena coordinator could not resume (${response.status}).`);
}

async function setReady(env, game, viewer, ready) {
  if (game.status !== "registration") throw new Error("Ready check is only available during registration.");
  if (!viewer.joined) throw new Error("Join Arena before marking ready.");
  if (viewer.isHost) return;
  await env.DB.prepare(`
    INSERT INTO telegram_arena_ready (game_id, user_id, ready, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET ready = excluded.ready, updated_at = excluded.updated_at
  `).bind(game.id, String(viewer.id), ready ? 1 : 0, Date.now()).run();
}

async function setRegistrationLock(env, game, viewer, locked) {
  assertHost(game, viewer, locked ? "lock registration" : "unlock registration");
  if (game.status !== "registration") throw new Error("Registration can only be changed before Arena starts.");
  game.registrationLocked = Boolean(locked);
  await saveGame(env.DB, game);
}

async function removePlayer(env, game, viewer, targetId) {
  assertHost(game, viewer, "remove players");
  if (game.status !== "registration") throw new Error("Players can only be removed during registration.");
  const id = String(targetId || "");
  if (!id) throw new Error("Choose a player to remove.");
  if (id === String(game.hostId)) throw new Error("The host cannot remove themselves.");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ? AND user_id = ?").bind(game.id, id),
    env.DB.prepare("DELETE FROM telegram_arena_ready WHERE game_id = ? AND user_id = ?").bind(game.id, id)
  ]);
  if (game.players?.[id]) {
    delete game.players[id];
    game.aliveIds = (game.aliveIds || []).filter(playerId => String(playerId) !== id);
    await saveGame(env.DB, game);
  }
}

async function pauseArena(env, game, viewer) {
  assertHost(game, viewer, "pause Arena");
  if (game.status !== "running") throw new Error("Only a live Arena can be paused.");
  if (game.paused) return;
  const now = Date.now();
  game.paused = true;
  game.pausedAt = now;
  game.pausedRemainingMs = Math.max(250, Number(game.nextAdvanceAt || now + 1000) - now);
  game.nextAdvanceAt = null;
  if (game.crowdVote?.status === "open") {
    game.pausedVoteRemainingMs = Math.max(250, Number(game.crowdVote.closesAt || now + 1000) - now);
    game.crowdVote.closesAt = null;
  }
  await saveGame(env.DB, game);
}

async function resumeArena(env, game, viewer) {
  assertHost(game, viewer, "resume Arena");
  if (game.status !== "running") throw new Error("Only a live Arena can be resumed.");
  if (!game.paused) return;
  const delayMs = Math.max(250, Number(game.crowdVote?.status === "open" ? game.pausedVoteRemainingMs : game.pausedRemainingMs) || 1000);
  game.paused = false;
  game.pausedAt = null;
  game.nextAdvanceAt = Date.now() + delayMs;
  if (game.crowdVote?.status === "open") game.crowdVote.closesAt = Date.now() + delayMs;
  game.pausedRemainingMs = null;
  game.pausedVoteRemainingMs = null;
  await saveGame(env.DB, game);
  await wakeCoordinator(env, game, delayMs);
}

async function react(env, game, viewer, emoji) {
  if (game.status !== "running") throw new Error("Reactions are available while Arena is live.");
  if (viewer.alive) throw new Error("Reactions are for eliminated players and spectators.");
  if (!REACTIONS.has(emoji)) throw new Error("That reaction is not available.");
  const now = Date.now();
  const previous = await env.DB.prepare("SELECT created_at FROM telegram_arena_reactions WHERE game_id = ? AND user_id = ?")
    .bind(game.id, String(viewer.id)).first();
  if (previous?.created_at && now - Number(previous.created_at) < REACTION_RATE_MS) throw new Error("Reaction is cooling down.");
  await env.DB.prepare(`
    INSERT INTO telegram_arena_reactions (game_id, user_id, display_name, emoji, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET display_name = excluded.display_name, emoji = excluded.emoji, created_at = excluded.created_at
  `).bind(game.id, String(viewer.id), viewer.displayName || "Spectator", emoji, now).run();
}

async function createSuccessor(env, game, viewer, rematch) {
  assertHost(game, viewer, rematch ? "start a rematch" : "start a new game");
  if (!terminalStatus(game.status)) throw new Error("Finish or force-close the current Arena first.");
  const remaining = await getArenaCooldownRemaining(env.DB, game.channelId);
  if (remaining > 0 && env.TELEGRAM_TEST_MODE !== "true") throw new Error(`Arena is cooling down. Try again in ${formatCooldown(remaining)}.`);

  const fresh = createGame({
    guildId: game.guildId,
    channelId: game.channelId,
    hostId: viewer.id,
    themeId: game.themeId,
    platform: "telegram"
  });
  addPlayer(fresh, { id: String(viewer.id), displayName: viewer.displayName || "Host", username: null });
  fresh.displayLog = [];
  fresh.telegramChatInstance = game.telegramChatInstance || null;
  fresh.telegramLaunchUrl = null;
  fresh.rematchOfGameId = rematch ? game.id : null;
  fresh.rematchRosterIds = rematch
    ? Object.values(game.players || {}).filter(player => !player.simulated && String(player.id) !== String(viewer.id)).map(player => String(player.id))
    : [];
  await saveGame(env.DB, fresh);

  game.telegramSuccessorGameId = fresh.id;
  game.nextAdvanceAt = null;
  await saveGame(env.DB, game);
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
  return fresh.id;
}

export async function telegramState(request, env) {
  return augmentState(request, env);
}

export async function telegramAction(request, env) {
  const body = await request.clone().json().catch(() => ({}));
  const action = String(body.action || "");
  const featureActions = new Set(["ready", "unready", "lock", "unlock", "remove", "pause", "resume", "reaction", "newgame", "rematch"]);

  if (!featureActions.has(action) && action !== "join" && action !== "leave") {
    const state = await baseTelegramAction(request, env);
    return augmentState(request, env, state);
  }

  const { state, game, viewer } = await authenticatedContext(request, env);

  if (action === "join") {
    if (game.registrationLocked && !viewer.joined) throw new Error("Registration is locked by the host.");
    const next = await baseTelegramAction(request, env);
    return augmentState(request, env, next);
  }
  if (action === "leave") {
    const next = await baseTelegramAction(request, env);
    await env.DB.prepare("DELETE FROM telegram_arena_ready WHERE game_id = ? AND user_id = ?").bind(game.id, String(viewer.id)).run();
    return augmentState(request, env, next);
  }
  if (action === "ready") await setReady(env, game, viewer, true);
  else if (action === "unready") await setReady(env, game, viewer, false);
  else if (action === "lock") await setRegistrationLock(env, game, viewer, true);
  else if (action === "unlock") await setRegistrationLock(env, game, viewer, false);
  else if (action === "remove") await removePlayer(env, game, viewer, body.targetId);
  else if (action === "pause") await pauseArena(env, game, viewer);
  else if (action === "resume") await resumeArena(env, game, viewer);
  else if (action === "reaction") await react(env, game, viewer, String(body.emoji || ""));
  else if (action === "newgame" || action === "rematch") {
    const nextId = await createSuccessor(env, game, viewer, action === "rematch");
    const nextState = await baseTelegramState(request, env);
    if (nextState.id !== nextId) throw new Error("The new Arena was created but could not be opened yet. Refresh Arena.");
    return augmentState(request, env, nextState);
  }

  return augmentState(request, env);
}

export async function telegramHall(request, env) {
  const { game } = await authenticatedContext(request, env);
  const recent = await env.DB.prepare(`
    SELECT r.game_id, r.winner_id, r.rounds, r.finished_at,
           COALESCE(s.display_name, 'Unknown') AS display_name
    FROM game_results r
    LEFT JOIN arena_player_stats s ON s.guild_id = r.guild_id AND s.user_id = r.winner_id
    WHERE r.guild_id = ? AND r.winner_id IS NOT NULL
    ORDER BY r.finished_at DESC
    LIMIT 8
  `).bind(game.guildId).all();
  const legends = await env.DB.prepare(`
    SELECT user_id, display_name, games_played, wins, total_kills, total_revivals, crowd_survivals
    FROM arena_player_stats
    WHERE guild_id = ? AND games_played > 0
    ORDER BY wins DESC, total_kills DESC, games_played ASC, display_name COLLATE NOCASE ASC
    LIMIT 8
  `).bind(game.guildId).all();
  return { recentWinners: recent?.results || [], legends: legends?.results || [] };
}

export async function telegramShare(request, env) {
  const { game } = await authenticatedContext(request, env);
  let url = game.telegramLaunchUrl || "";
  if (!url || !url.includes(`arena_${game.id}`)) {
    url = await arenaLaunchUrl(env.TELEGRAM_BOT_TOKEN, game.id);
    game.telegramLaunchUrl = url;
    await saveGame(env.DB, game);
  }
  return { url, arenaCode: String(game.id).replace(/-/g, "").slice(-8).toUpperCase() };
}
