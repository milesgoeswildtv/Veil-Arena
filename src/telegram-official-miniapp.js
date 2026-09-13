import { startGame } from "./core/engine.js";
import { ensureSchema, loadGame, saveGame } from "./storage.js";
import { getTheme } from "./themes/index.js";
import { userFromTelegram, telegramUserInChat, editTelegramMessage, telegramArenaLauncherKeyboard } from "./telegram.js";

const encoder = new TextEncoder();
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;
let miniSchemaReady = false;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(data));
}

function dataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export async function validateTelegramInitData(initData, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!initData || !botToken) throw new Error("Telegram Mini App authentication is missing.");
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!suppliedHash || !authDate) throw new Error("Telegram Mini App authentication is incomplete.");
  if (Math.abs(nowSeconds - authDate) > MAX_INIT_DATA_AGE_SECONDS) throw new Error("Telegram Mini App session expired. Reopen Arena from Telegram.");

  // Telegram's documented bot-token validation:
  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  // hash       = HMAC_SHA256(data_check_string, key=secret_key)
  const secret = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const calculated = bytesToHex(await hmacSha256(secret, dataCheckString(params)));
  if (!constantTimeEqual(calculated, suppliedHash)) throw new Error("Telegram Mini App authentication failed.");

  let rawUser = null;
  try { rawUser = JSON.parse(params.get("user") || "null"); } catch {}
  const user = userFromTelegram(rawUser);
  if (!user) throw new Error("Telegram user identity is missing.");

  return {
    user,
    chatType: params.get("chat_type") || null,
    chatInstance: params.get("chat_instance") || null,
    startParam: params.get("start_param") || null,
    authDate
  };
}

export function gameIdFromTelegramStartParam(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

async function ensureMiniAppSchema(db) {
  await ensureSchema(db);
  if (miniSchemaReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS arena_registrations (
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_arena_registrations_game ON arena_registrations(game_id, joined_at)").run();
  miniSchemaReady = true;
}

async function hydrateRegistrationPlayers(db, game) {
  if (game.status !== "registration") return game;
  const rows = await db.prepare(`
    SELECT user_id, display_name, username
    FROM arena_registrations
    WHERE game_id = ?
    ORDER BY joined_at ASC
  `).bind(game.id).all();
  const hydrated = JSON.parse(JSON.stringify(game));
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

export async function loadOfficialTelegramGame(env, gameId) {
  await ensureMiniAppSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
  return hydrateRegistrationPlayers(env.DB, game);
}

async function requestedGameId(request, auth, body = null) {
  const url = new URL(request.url);
  return String(body?.gameId || url.searchParams.get("game") || gameIdFromTelegramStartParam(auth.startParam) || "");
}

async function bindOfficialChatInstance(env, game, auth) {
  // Telegram documents chat_type/chat_instance for Mini Apps opened through direct links.
  // We require those values; we never invent, rewrite, or server-sign a replacement context.
  if (!["group", "supergroup"].includes(auth.chatType) || !auth.chatInstance) {
    throw new Error("Open this Arena from Veil’s Arena button in the Telegram group that started it.");
  }
  if (game.telegramChatInstance) {
    if (game.telegramChatInstance !== auth.chatInstance) throw new Error("This Arena belongs to a different Telegram group.");
    return game;
  }

  await env.DB.prepare(`
    UPDATE games
    SET state_json = json_set(state_json, '$.telegramChatInstance', ?), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND json_extract(state_json, '$.telegramChatInstance') IS NULL
  `).bind(auth.chatInstance, game.id).run();

  const rebound = await loadOfficialTelegramGame(env, game.id);
  if (rebound.telegramChatInstance !== auth.chatInstance) throw new Error("This Arena belongs to a different Telegram group.");
  return rebound;
}

export async function authenticateTelegramArenaRequest(request, env, body = null) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("DWallet Arena is not configured.");
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const gameId = await requestedGameId(request, auth, body);
  if (!gameId) throw new Error("Missing Arena ID.");

  const launched = gameIdFromTelegramStartParam(auth.startParam);
  if (launched && launched !== gameId) throw new Error("That Arena does not match this Telegram launch.");

  let game = await loadOfficialTelegramGame(env, gameId);
  game = await bindOfficialChatInstance(env, game, auth);

  const member = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
  if (!member) throw new Error("Only members of the Telegram group that started this Arena can use it.");
  return { auth, game, gameId };
}

function playerView(game) {
  return Object.values(game.players || {}).map(p => ({
    id: p.id,
    displayName: p.displayName,
    username: p.username || null,
    alive: Boolean(p.alive),
    eliminations: p.eliminations || 0,
    revivals: p.revivals || 0
  }));
}

function featureView(game) {
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  if (vote) {
    return {
      type: "community_vote",
      eligibleIds: [...vote.eligibleIds],
      totals: { ...(vote.totals || {}) },
      closesAt: vote.closesAt || null
    };
  }
  const roundItems = (game.history || []).filter(item => Number(item?.round) === Number(game.round));
  const last = type => [...roundItems].reverse().find(item => item?.type === type);
  const mass = last("mass_brawl");
  if (mass) return { type: "mass_brawl", participantIds: [...(mass.participantIds || [])], survivorIds: [...(mass.survivorIds || [])], eliminatedIds: [...(mass.eliminatedIds || [])] };
  const revival = last("revival_pit");
  if (revival) return { type: "revival", selectedIds: [...(revival.selectedIds || [])], winnerId: revival.winnerId || null, loserId: revival.loserId || null };
  const skipped = last("revival_skipped");
  if (skipped) return { type: "revival_skipped", reason: skipped.reason || "unknown" };
  const crowd = last("crowd_pin");
  if (crowd) return { type: "community_result", qualifierIds: [...(crowd.qualifiers || [])], survivorId: crowd.survivorId || null, eliminatedIds: [...(crowd.eliminatedIds || [])], totals: { ...(crowd.totals || {}) } };
  return null;
}

function publicState(game, viewer) {
  const theme = getTheme(game.themeId);
  const current = game.players?.[viewer.id] || null;
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  const log = Array.isArray(game.displayLog) ? game.displayLog.slice(-16) : [];
  const aliveCount = (game.aliveIds || []).length;
  return {
    id: game.id,
    platform: game.platform,
    themeId: game.themeId,
    themeName: theme.displayName,
    title: theme.labels.arena,
    status: game.status,
    round: Number(game.round) || 0,
    hostId: game.hostId,
    winnerId: game.winnerId,
    playerCount: Object.keys(game.players || {}).length,
    aliveCount,
    eliminatedCount: (game.eliminatedIds || []).length,
    players: playerView(game),
    aliveIds: [...(game.aliveIds || [])],
    eliminatedIds: [...(game.eliminatedIds || [])],
    displayLog: log,
    finalFive: game.status === "running" && aliveCount <= 5,
    specialEventsEnabled: game.status === "running" && aliveCount > 5,
    feature: featureView(game),
    crowdVote: vote ? {
      status: vote.status,
      eligibleIds: [...vote.eligibleIds],
      closesAt: vote.closesAt || null,
      voteTargetId: vote.votesBySpectator?.[viewer.id] || null,
      totals: { ...(vote.totals || {}) }
    } : null,
    viewer: {
      id: viewer.id,
      displayName: viewer.displayName,
      joined: Boolean(current),
      alive: Boolean(current?.alive),
      isHost: String(viewer.id) === String(game.hostId),
      canVote: Boolean(vote && !(game.aliveIds || []).includes(viewer.id) && (!vote.closesAt || Date.now() < vote.closesAt))
    }
  };
}

async function registerPlayerAtomic(env, game, user) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (game.players?.[user.id]) return game;
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO arena_registrations (game_id, user_id, display_name, username)
    SELECT ?, ?, ?, ? FROM games WHERE id = ? AND status = 'registration'
  `).bind(game.id, user.id, user.displayName, user.username || null, game.id).run();
  if (!result?.meta?.changes) {
    const refreshed = await loadOfficialTelegramGame(env, game.id);
    if (!refreshed.players?.[user.id]) throw new Error("Registration just closed.");
    return refreshed;
  }
  return loadOfficialTelegramGame(env, game.id);
}

async function leaveRegistrationAtomic(env, game, userId) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (String(userId) === String(game.hostId)) throw new Error("The Arena host cannot leave registration.");
  await env.DB.prepare(`
    DELETE FROM arena_registrations
    WHERE game_id = ? AND user_id = ?
      AND EXISTS (SELECT 1 FROM games WHERE id = ? AND status = 'registration')
  `).bind(game.id, userId, game.id).run();
  return loadOfficialTelegramGame(env, game.id);
}

async function startRegistrationAtomic(env, game, userId) {
  if (String(userId) !== String(game.hostId)) throw new Error("Only the Arena host can start the game.");
  const claim = await env.DB.prepare(`UPDATE games SET status = 'starting', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'registration'`).bind(game.id).run();
  if (!claim?.meta?.changes) throw new Error("Arena is already starting or registration is closed.");
  try {
    const stored = await loadGame(env.DB, game.id);
    const hydrated = await hydrateRegistrationPlayers(env.DB, stored);
    hydrated.telegramChatInstance = game.telegramChatInstance;
    startGame(hydrated);
    await saveGame(env.DB, hydrated);
    await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
    return hydrated;
  } catch (error) {
    await env.DB.prepare("UPDATE games SET status = 'registration', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'starting'").bind(game.id).run();
    throw error;
  }
}

function telegramIdPath(root, id) {
  const safe = String(id || "");
  if (!/^\d+$/.test(safe)) throw new Error("Invalid Telegram player id.");
  return `${root}.\"${safe}\"`;
}

async function castCrowdVoteAtomic(env, game, voterId, targetId) {
  const vote = game.crowdVote;
  if (!vote || vote.status !== "open") throw new Error("The community vote is closed.");
  const now = Date.now();
  if (vote.closesAt && now >= vote.closesAt) throw new Error("Voting time is up.");
  if ((game.aliveIds || []).includes(voterId)) throw new Error("You're still fighting. Spectators get this vote.");
  if (!vote.eligibleIds.includes(targetId) || !game.players?.[targetId]?.alive) throw new Error("That player is not available for this vote.");
  const previous = vote.votesBySpectator?.[voterId] || null;
  if (previous === targetId) return game;
  const voterPath = telegramIdPath("$.crowdVote.votesBySpectator", voterId);
  const targetPath = telegramIdPath("$.crowdVote.totals", targetId);
  let result;
  if (previous) {
    const previousPath = telegramIdPath("$.crowdVote.totals", previous);
    result = await env.DB.prepare(`
      UPDATE games SET state_json = json_set(
        state_json, ?, ?, ?, COALESCE(json_extract(state_json, ?), 0) + 1,
        ?, MAX(COALESCE(json_extract(state_json, ?), 0) - 1, 0)
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'running'
        AND json_extract(state_json, '$.crowdVote.status') = 'open'
        AND COALESCE(CAST(json_extract(state_json, '$.crowdVote.closesAt') AS INTEGER), ?) > ?
    `).bind(voterPath, targetId, targetPath, targetPath, previousPath, previousPath, game.id, now + 1, now).run();
  } else {
    result = await env.DB.prepare(`
      UPDATE games SET state_json = json_set(
        state_json, ?, ?, ?, COALESCE(json_extract(state_json, ?), 0) + 1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'running'
        AND json_extract(state_json, '$.crowdVote.status') = 'open'
        AND COALESCE(CAST(json_extract(state_json, '$.crowdVote.closesAt') AS INTEGER), ?) > ?
    `).bind(voterPath, targetId, targetPath, targetPath, game.id, now + 1, now).run();
  }
  if (!result?.meta?.changes) throw new Error("Voting time is up.");
  return loadOfficialTelegramGame(env, game.id);
}

async function wakeCoordinator(env, game) {
  if (!env.ARENA_COORDINATOR || !game?.channelId) return;
  const id = env.ARENA_COORDINATOR.idFromName(game.channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "kick", channelId: game.channelId, platform: "telegram" })
  });
}

async function updateLauncherForStartedGame(env, game) {
  if (!game.telegramLauncherMessageId || !game.telegramLaunchUrl) return;
  await editTelegramMessage(game.channelId, game.telegramLauncherMessageId, env.TELEGRAM_BOT_TOKEN, {
    text: `# 💜 DWALLET ARENA\nThe doors are closed. **${game.aliveIds.length} players** entered.\n\nThe Arena is running live inside Telegram.`,
    reply_markup: telegramArenaLauncherKeyboard(game.telegramLaunchUrl, "⚔️ WATCH LIVE")
  }).catch(() => null);
}

export async function handleOfficialMiniAppState(request, env) {
  try {
    const { auth, game } = await authenticateTelegramArenaRequest(request, env);
    return json({ ok: true, state: publicState(game, auth.user) });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 401);
  }
}

export async function handleOfficialMiniAppAction(request, env) {
  try {
    const body = await request.clone().json().catch(() => ({}));
    const { auth } = await authenticateTelegramArenaRequest(request, env, body);
    let game = await loadOfficialTelegramGame(env, body.gameId || gameIdFromTelegramStartParam(auth.startParam));
    if (game.telegramChatInstance !== auth.chatInstance) throw new Error("This Arena belongs to a different Telegram group.");
    const action = String(body.action || "");
    if (!action) throw new Error("Missing Arena action.");

    if (action === "join") game = await registerPlayerAtomic(env, game, auth.user);
    else if (action === "leave") game = await leaveRegistrationAtomic(env, game, auth.user.id);
    else if (action === "start") {
      game = await startRegistrationAtomic(env, game, auth.user.id);
      await updateLauncherForStartedGame(env, game);
      await wakeCoordinator(env, game);
    } else if (action === "vote") game = await castCrowdVoteAtomic(env, game, auth.user.id, String(body.targetId || ""));
    else throw new Error("Unknown Arena action.");

    return json({ ok: true, state: publicState(game, auth.user) });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}
