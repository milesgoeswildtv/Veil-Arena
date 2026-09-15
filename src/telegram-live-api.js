import { startGame, castCrowdVote } from "./core/engine.js";
import { addFakeContestants, setSimulatedCrowd } from "./core/simulation.js";
import { ensureSchema, loadGame, saveGame } from "./storage.js";
import { getTheme } from "./themes/index.js";
import { validateTelegramInitData, telegramUserInChat } from "./telegram.js";

let telegramLiveSchemaReady = false;
const MEMBERSHIP_CACHE_MS = 60_000;

async function ensureTelegramLiveSchema(db) {
  await ensureSchema(db);
  if (telegramLiveSchemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS arena_registrations (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (game_id, user_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_arena_registrations_game ON arena_registrations(game_id, joined_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS telegram_arena_membership_cache (
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (game_id, user_id)
    )`)
  ]);
  telegramLiveSchemaReady = true;
}

function gameIdFromStartParam(value) {
  const raw = String(value || "");
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

async function hydrateRegistrations(db, game) {
  if (!game || game.status !== "registration") return game;
  const rows = await db.prepare(`
    SELECT user_id, display_name, username
    FROM arena_registrations
    WHERE game_id = ?
    ORDER BY joined_at ASC
  `).bind(game.id).all();
  const hydrated = structuredClone(game);
  for (const row of rows?.results || []) {
    const id = String(row.user_id);
    if (hydrated.players[id]) continue;
    hydrated.players[id] = {
      id,
      displayName: row.display_name || row.username || `Telegram ${id}`,
      username: row.username || null,
      alive: true,
      eliminations: 0,
      revivals: 0,
      crowdPinsSurvived: 0
    };
    if (!hydrated.aliveIds.includes(id)) hydrated.aliveIds.push(id);
  }
  return hydrated;
}

async function bindChatInstance(env, game, auth) {
  if (!["group", "supergroup"].includes(auth.chatType) || !auth.chatInstance) {
    throw new Error("Open Arena from the button inside the Telegram group that started it.");
  }
  if (game.telegramChatInstance && game.telegramChatInstance !== auth.chatInstance) {
    throw new Error("This Arena belongs to a different Telegram group.");
  }
  if (!game.telegramChatInstance) {
    game.telegramChatInstance = auth.chatInstance;
    await saveGame(env.DB, game);
  }
  return game;
}

async function confirmTelegramMembership(env, game, userId) {
  const now = Date.now();
  const cached = await env.DB.prepare(`
    SELECT expires_at FROM telegram_arena_membership_cache
    WHERE game_id = ? AND user_id = ?
  `).bind(game.id, String(userId)).first();
  if (Number(cached?.expires_at || 0) > now) return true;

  const member = await telegramUserInChat(game.channelId, userId, env.TELEGRAM_BOT_TOKEN);
  if (!member) return false;

  await env.DB.prepare(`
    INSERT INTO telegram_arena_membership_cache (game_id, user_id, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET expires_at = excluded.expires_at
  `).bind(game.id, String(userId), now + MEMBERSHIP_CACHE_MS).run();
  return true;
}

async function authenticate(request, env) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram Arena is not configured yet.");
  await ensureTelegramLiveSchema(env.DB);
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const gameId = gameIdFromStartParam(auth.startParam);
  if (!gameId) throw new Error("This Telegram launch does not contain an Arena ID.");
  let game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
  game = await bindChatInstance(env, game, auth);
  if (!await confirmTelegramMembership(env, game, auth.user.id)) {
    throw new Error("Only members of the Telegram group that started this Arena can use it.");
  }
  return { auth, game: await hydrateRegistrations(env.DB, game) };
}

async function kickTelegramCoordinator(env, channelId) {
  if (!env.ARENA_COORDINATOR) throw new Error("Arena coordinator binding is missing.");
  const id = env.ARENA_COORDINATOR.idFromName(channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  const response = await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "kick", channelId, platform: "telegram" })
  });
  if (!response.ok) throw new Error(`Arena coordinator could not start (${response.status}).`);
}

function publicState(game, viewer, testMode) {
  const theme = getTheme(game.themeId);
  const current = game.players?.[viewer.id] || null;
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  const displayLog = Array.isArray(game.displayLog) ? game.displayLog.slice(-20) : [];
  return {
    id: game.id,
    title: theme?.labels?.arena || "DWALLET ARENA",
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
    displayLog,
    lastEvent: game.lastEvent || null,
    nextAdvanceAt: game.nextAdvanceAt || null,
    crowdVote: vote ? {
      eligibleIds: [...vote.eligibleIds],
      totals: { ...(vote.totals || {}) },
      closesAt: vote.closesAt || null,
      selectedId: vote.votesBySpectator?.[viewer.id] || null
    } : null,
    viewer: {
      id: String(viewer.id),
      displayName: viewer.displayName,
      joined: Boolean(current),
      alive: Boolean(current?.alive),
      isHost: String(viewer.id) === String(game.hostId),
      canVote: Boolean(vote && !(game.aliveIds || []).includes(String(viewer.id)) && (!vote.closesAt || Date.now() < vote.closesAt))
    },
    testMode
  };
}

async function joinRegistration(env, game, user) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (game.players?.[user.id]) return game;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO arena_registrations (game_id, user_id, display_name, username)
    VALUES (?, ?, ?, ?)
  `).bind(game.id, user.id, user.displayName, user.username || null).run();
  return hydrateRegistrations(env.DB, game);
}

async function leaveRegistration(env, game, user) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (String(user.id) === String(game.hostId)) throw new Error("The host cannot leave registration.");
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ? AND user_id = ?")
    .bind(game.id, user.id).run();
  return hydrateRegistrations(env.DB, game);
}

async function hostBots(env, game, user, mode) {
  if (env.TELEGRAM_TEST_MODE !== "true") throw new Error("Test controls are disabled.");
  if (String(user.id) !== String(game.hostId)) throw new Error("Only the host can use test controls.");
  if (game.status !== "registration") throw new Error("Bots can only be added during registration.");
  const hydrated = await hydrateRegistrations(env.DB, game);
  const amount = mode === "fill" ? Math.max(0, 12 - Object.keys(hydrated.players).length) : 4;
  if (amount > 0) addFakeContestants(hydrated, amount);
  setSimulatedCrowd(hydrated, true);
  await saveGame(env.DB, hydrated);
  return hydrated;
}

async function startRegistration(env, game, user) {
  if (String(user.id) !== String(game.hostId)) throw new Error("Only the host can start Arena.");
  if (game.status !== "registration") throw new Error("Arena has already started.");
  const hydrated = await hydrateRegistrations(env.DB, game);
  if (Object.keys(hydrated.players).length < 2) throw new Error("Arena needs at least 2 players.");
  if (Object.values(hydrated.players).some(player => player.simulated)) setSimulatedCrowd(hydrated, true);
  startGame(hydrated);
  hydrated.nextAdvanceAt = Date.now() + 1_000;
  hydrated.displayLog = hydrated.displayLog || [];
  await saveGame(env.DB, hydrated);
  await kickTelegramCoordinator(env, hydrated.channelId);
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
  return hydrated;
}

async function resetArena(env, game, user) {
  if (String(user.id) !== String(game.hostId)) throw new Error("Only the host can reset Arena.");
  if (env.TELEGRAM_TEST_MODE !== "true") throw new Error("Reset is available only while Telegram test mode is enabled.");
  game.status = "cancelled";
  game.nextAdvanceAt = null;
  await saveGame(env.DB, game);
  await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
  return game;
}

export async function telegramState(request, env) {
  const { auth, game } = await authenticate(request, env);
  const hydrated = await hydrateRegistrations(env.DB, game);
  return publicState(hydrated, auth.user, env.TELEGRAM_TEST_MODE === "true");
}

export async function telegramAction(request, env) {
  const { auth, game } = await authenticate(request, env);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  let updated = game;

  if (action === "join") updated = await joinRegistration(env, game, auth.user);
  else if (action === "leave") updated = await leaveRegistration(env, game, auth.user);
  else if (action === "add4") updated = await hostBots(env, game, auth.user, "add4");
  else if (action === "fill") updated = await hostBots(env, game, auth.user, "fill");
  else if (action === "start") updated = await startRegistration(env, game, auth.user);
  else if (action === "reset") updated = await resetArena(env, game, auth.user);
  else if (action === "vote") {
    const targetId = String(body.targetId || "");
    castCrowdVote(updated, String(auth.user.id), targetId);
    await saveGame(env.DB, updated);
  } else throw new Error("Unknown Arena action.");

  const hydrated = await hydrateRegistrations(env.DB, updated);
  return publicState(hydrated, auth.user, env.TELEGRAM_TEST_MODE === "true");
}
