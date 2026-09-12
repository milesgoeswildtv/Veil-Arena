import { addPlayer, startGame } from "./core/engine.js";
import { ensureSchema, loadGame, saveGame } from "./storage.js";
import { getTheme } from "./themes/index.js";
import { userFromTelegram, telegramUserInChat, editTelegramMessage, telegramArenaLauncherKeyboard } from "./telegram.js";

const encoder = new TextEncoder();
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;
let miniSchemaReady = false;

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

async function telegramWebAppSecret(botToken) {
  return hmacSha256(encoder.encode("WebAppData"), botToken);
}

function dataCheckString(params, excludeSignature = false) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash" && (!excludeSignature || key !== "signature"))
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

  const secret = await telegramWebAppSecret(botToken);
  const primary = bytesToHex(await hmacSha256(secret, dataCheckString(params, false)));
  let valid = constantTimeEqual(primary, suppliedHash);
  if (!valid && params.has("signature")) {
    const compatibility = bytesToHex(await hmacSha256(secret, dataCheckString(params, true)));
    valid = constantTimeEqual(compatibility, suppliedHash);
  }
  if (!valid) throw new Error("Telegram Mini App authentication failed.");

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

function gameIdFromStartParam(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
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

function playerView(game) {
  return Object.values(game.players).map(p => ({
    id: p.id,
    displayName: p.displayName,
    username: p.username || null,
    alive: Boolean(p.alive),
    eliminations: p.eliminations || 0,
    revivals: p.revivals || 0
  }));
}

function featureView(game, vote) {
  if (vote) {
    return {
      type: "community_vote",
      eligibleIds: [...vote.eligibleIds],
      totals: { ...(vote.totals || {}) },
      closesAt: vote.closesAt || null
    };
  }
  const roundItems = (game.history || []).filter(item => Number(item?.round) === Number(game.round));
  const findLast = type => [...roundItems].reverse().find(item => item?.type === type);
  const mass = findLast("mass_brawl");
  if (mass) {
    return {
      type: "mass_brawl",
      participantIds: [...(mass.participantIds || [])],
      survivorIds: [...(mass.survivorIds || [])],
      eliminatedIds: [...(mass.eliminatedIds || [])]
    };
  }
  const revival = findLast("revival_pit");
  if (revival) {
    return {
      type: "revival",
      selectedIds: [...(revival.selectedIds || [])],
      winnerId: revival.winnerId || null,
      loserId: revival.loserId || null
    };
  }
  const revivalSkipped = findLast("revival_skipped");
  if (revivalSkipped) return { type: "revival_skipped", reason: revivalSkipped.reason || "unknown" };
  const crowd = findLast("crowd_pin");
  if (crowd) {
    return {
      type: "community_result",
      qualifierIds: [...(crowd.qualifiers || [])],
      survivorId: crowd.survivorId || null,
      eliminatedIds: [...(crowd.eliminatedIds || [])],
      totals: { ...(crowd.totals || {}) }
    };
  }
  return null;
}

function publicState(game, viewer) {
  const theme = getTheme(game.themeId);
  const current = game.players[viewer.id] || null;
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  const voteTargetId = vote?.votesBySpectator?.[viewer.id] || null;
  const log = Array.isArray(game.displayLog) ? game.displayLog.slice(-16) : [];
  const voteOpenedAt = vote ? [...log].reverse().find(item => Number(item?.round) === Number(game.round) && String(item?.text || "").includes(theme.labels.crowdVote))?.at : null;
  const inferredClosesAt = voteOpenedAt ? Date.parse(voteOpenedAt) + 30000 : null;
  const closesAt = vote?.closesAt || inferredClosesAt;
  const aliveCount = game.aliveIds.length;
  return {
    id: game.id,
    platform: game.platform,
    themeId: game.themeId,
    themeName: theme.displayName,
    title: theme.labels.arena,
    status: game.status,
    round: game.round,
    hostId: game.hostId,
    winnerId: game.winnerId,
    playerCount: Object.keys(game.players).length,
    aliveCount,
    eliminatedCount: game.eliminatedIds.length,
    players: playerView(game),
    aliveIds: game.aliveIds,
    eliminatedIds: game.eliminatedIds,
    displayLog: log,
    finalFive: game.status === "running" && aliveCount <= 5,
    specialEventsEnabled: game.status === "running" && aliveCount > 5,
    feature: featureView(game, vote),
    crowdVote: vote ? {
      status: vote.status,
      eligibleIds: vote.eligibleIds,
      closesAt,
      voteTargetId,
      totals: { ...(vote.totals || {}) }
    } : null,
    viewer: {
      id: viewer.id,
      displayName: viewer.displayName,
      joined: Boolean(current),
      alive: Boolean(current?.alive),
      isHost: viewer.id === game.hostId,
      canVote: Boolean(vote && !game.aliveIds.includes(viewer.id) && (!closesAt || Date.now() < closesAt))
    }
  };
}

async function authenticatedRequest(request, env) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("DWallet Arena is not configured.");
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.chatType || !["group", "supergroup"].includes(auth.chatType)) throw new Error("Open Arena from the DWallet Telegram group.");
  return auth;
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

async function loadTelegramGame(env, gameId) {
  await ensureMiniAppSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
  return hydrateRegistrationPlayers(env.DB, game);
}

function assertRequestedGameMatchesLaunch(auth, gameId) {
  const launched = gameIdFromStartParam(auth.startParam);
  if (launched && launched !== gameId) throw new Error("That Arena does not match the Telegram launch link.");
}

function assertChatInstance(game, auth) {
  if (game.telegramChatInstance && auth.chatInstance !== game.telegramChatInstance) throw new Error("Open this Arena from its original DWallet group message.");
}

async function verifyGroupMember(env, game, userId) {
  const ok = await telegramUserInChat(game.channelId, userId, env.TELEGRAM_BOT_TOKEN);
  if (!ok) throw new Error("Only members of this Telegram group can interact with its Arena. Veil should be an admin in the group so membership can be verified reliably.");
}

async function bindChatInstance(env, game, auth) {
  if (game.telegramChatInstance) {
    assertChatInstance(game, auth);
    return game;
  }
  if (!auth.chatInstance) throw new Error("Telegram did not provide the group context. Reopen Arena from its DWallet group message.");
  await env.DB.prepare(`
    UPDATE games
    SET state_json = json_set(state_json, '$.telegramChatInstance', ?), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND json_extract(state_json, '$.telegramChatInstance') IS NULL
  `).bind(auth.chatInstance, game.id).run();
  const rebound = await loadTelegramGame(env, game.id);
  assertChatInstance(rebound, auth);
  return rebound;
}

async function registerPlayerAtomic(env, game, user) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (game.players[user.id]) return game;
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO arena_registrations (game_id, user_id, display_name, username)
    SELECT ?, ?, ?, ?
    FROM games
    WHERE id = ? AND status = 'registration'
  `).bind(game.id, user.id, user.displayName, user.username || null, game.id).run();
  if (!result?.meta?.changes) {
    const refreshed = await loadTelegramGame(env, game.id);
    if (!refreshed.players[user.id]) throw new Error("Registration just closed.");
    return refreshed;
  }
  return loadTelegramGame(env, game.id);
}

async function leaveRegistrationAtomic(env, game, userId) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (userId === game.hostId) throw new Error("The Arena host cannot leave registration.");
  await env.DB.prepare(`
    DELETE FROM arena_registrations
    WHERE game_id = ? AND user_id = ?
      AND EXISTS (SELECT 1 FROM games WHERE id = ? AND status = 'registration')
  `).bind(game.id, userId, game.id).run();
  return loadTelegramGame(env, game.id);
}

async function startRegistrationAtomic(env, game, userId) {
  if (userId !== game.hostId) throw new Error("Only the Arena host can start the game.");
  const claim = await env.DB.prepare(`
    UPDATE games SET status = 'starting', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'registration'
  `).bind(game.id).run();
  if (!claim?.meta?.changes) throw new Error("Arena is already starting or registration is closed.");

  try {
    const stored = await loadGame(env.DB, game.id);
    const hydrated = await hydrateRegistrationPlayers(env.DB, stored);
    if (game.telegramChatInstance) hydrated.telegramChatInstance = game.telegramChatInstance;
    startGame(hydrated);
    await saveGame(env.DB, hydrated);
    await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run();
    return hydrated;
  } catch (error) {
    await env.DB.prepare(`UPDATE games SET status = 'registration', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'starting'`).bind(game.id).run();
    throw error;
  }
}

function telegramIdPath(root, id) {
  const safe = String(id || "");
  if (!/^\d+$/.test(safe)) throw new Error("Invalid Telegram player id.");
  return `${root}."${safe}"`;
}

async function castCrowdVoteAtomic(env, game, voterId, targetId) {
  const vote = game.crowdVote;
  if (!vote || vote.status !== "open") throw new Error("The community vote is closed.");
  const now = Date.now();
  if (vote.closesAt && now >= vote.closesAt) throw new Error("Voting time is up.");
  if (game.aliveIds.includes(voterId)) throw new Error("You're still fighting. Spectators get this vote.");
  if (!vote.eligibleIds.includes(targetId) || !game.players[targetId]?.alive) throw new Error("That player is not available for this vote.");

  const previous = vote.votesBySpectator?.[voterId] || null;
  if (previous === targetId) return game;

  const voterPath = telegramIdPath("$.crowdVote.votesBySpectator", voterId);
  const targetTotalPath = telegramIdPath("$.crowdVote.totals", targetId);
  let result;
  if (previous) {
    const previousTotalPath = telegramIdPath("$.crowdVote.totals", previous);
    result = await env.DB.prepare(`
      UPDATE games
      SET state_json = json_set(
        state_json,
        ?, ?,
        ?, COALESCE(json_extract(state_json, ?), 0) + 1,
        ?, MAX(COALESCE(json_extract(state_json, ?), 0) - 1, 0)
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'running'
        AND json_extract(state_json, '$.crowdVote.status') = 'open'
        AND COALESCE(CAST(json_extract(state_json, '$.crowdVote.closesAt') AS INTEGER), ?) > ?
    `).bind(
      voterPath, targetId,
      targetTotalPath, targetTotalPath,
      previousTotalPath, previousTotalPath,
      game.id, now + 1, now
    ).run();
  } else {
    result = await env.DB.prepare(`
      UPDATE games
      SET state_json = json_set(
        state_json,
        ?, ?,
        ?, COALESCE(json_extract(state_json, ?), 0) + 1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'running'
        AND json_extract(state_json, '$.crowdVote.status') = 'open'
        AND COALESCE(CAST(json_extract(state_json, '$.crowdVote.closesAt') AS INTEGER), ?) > ?
    `).bind(voterPath, targetId, targetTotalPath, targetTotalPath, game.id, now + 1, now).run();
  }
  if (!result?.meta?.changes) throw new Error("Voting time is up.");
  return loadTelegramGame(env, game.id);
}

async function updateLauncherForStartedGame(env, game) {
  if (!game.telegramLauncherMessageId || !game.telegramLaunchUrl) return;
  await editTelegramMessage(game.channelId, game.telegramLauncherMessageId, env.TELEGRAM_BOT_TOKEN, {
    text: `# 💜 DWALLET ARENA\nThe doors are closed. **${game.aliveIds.length} players** entered.\n\nThe Arena is running live inside Telegram.`,
    reply_markup: telegramArenaLauncherKeyboard(game.telegramLaunchUrl, "⚔️ WATCH LIVE")
  }).catch(() => null);
}

export async function handleMiniAppState(request, env) {
  try {
    const auth = await authenticatedRequest(request, env);
    const url = new URL(request.url);
    const requested = url.searchParams.get("game") || gameIdFromStartParam(auth.startParam);
    if (!requested) return json({ ok: false, error: "Missing Arena ID." }, 400);
    assertRequestedGameMatchesLaunch(auth, requested);
    const game = await loadTelegramGame(env, requested);
    assertChatInstance(game, auth);
    return json({ ok: true, state: publicState(game, auth.user) });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 401);
  }
}

export async function handleMiniAppAction(request, env, kickCoordinator) {
  try {
    const auth = await authenticatedRequest(request, env);
    const body = await request.json().catch(() => ({}));
    const gameId = body.gameId || gameIdFromStartParam(auth.startParam);
    const action = String(body.action || "");
    if (!gameId || !action) return json({ ok: false, error: "Missing Arena action." }, 400);
    assertRequestedGameMatchesLaunch(auth, gameId);

    let game = await loadTelegramGame(env, gameId);
    assertChatInstance(game, auth);
    await verifyGroupMember(env, game, auth.user.id);
    game = await bindChatInstance(env, game, auth);

    if (action === "join") {
      game = await registerPlayerAtomic(env, game, auth.user);
    } else if (action === "leave") {
      game = await leaveRegistrationAtomic(env, game, auth.user.id);
    } else if (action === "start") {
      game = await startRegistrationAtomic(env, game, auth.user.id);
      await updateLauncherForStartedGame(env, game);
      await kickCoordinator(env, game.channelId, "kick", "telegram");
    } else if (action === "vote") {
      const targetId = String(body.targetId || "");
      game = await castCrowdVoteAtomic(env, game, auth.user.id, targetId);
    } else {
      throw new Error("Unknown Arena action.");
    }

    return json({ ok: true, state: publicState(game, auth.user) });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

export function miniAppHtml() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>DWallet Arena</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{color-scheme:dark;--bg:#09070f;--panel:#141020;--panel2:#1d152d;--purple:#9d68ff;--purple2:#cfb3ff;--text:#f7f3ff;--muted:#aaa0bb;--danger:#ff557f;--good:#57e6a5;--warn:#ffd166;--line:#302442;--void:#050308}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:calc(12px + env(safe-area-inset-top)) 12px calc(24px + env(safe-area-inset-bottom));overflow-x:hidden;transition:background .45s,filter .45s}
body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:80;background:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 4px);mix-blend-mode:screen;opacity:.35}
.app{max-width:760px;margin:0 auto;position:relative}.top{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,var(--bg) 78%,transparent);padding:4px 0 16px;transition:.35s}.brand{font-size:12px;letter-spacing:.2em;color:var(--purple2);font-weight:900}.location{font-size:10px;letter-spacing:.14em;color:var(--muted);font-weight:900;margin-top:5px}.title{font-size:28px;font-weight:950;line-height:1;margin:7px 0 12px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px}.stat b{display:block;font-size:20px}.stat span{font-size:10px;color:var(--muted);font-weight:800;letter-spacing:.08em}
.card{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:18px;padding:15px;margin:10px 0;box-shadow:0 12px 32px rgba(0,0,0,.22);transition:transform .25s,border-color .25s,background .35s}.card h2,.card h3{margin:0 0 10px}.muted{color:var(--muted)}.purple{color:var(--purple2)}.danger{color:var(--danger)}.good{color:var(--good)}.warning{color:var(--warn)}
button{appearance:none;border:0;border-radius:14px;padding:13px 15px;font-size:14px;font-weight:900;background:var(--purple);color:#fff;min-height:46px;transition:transform .12s,filter .12s,background .2s}button:active{transform:scale(.97)}button.secondary{background:#292038}button.dangerBtn{background:#512037}button:disabled{opacity:.45}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{flex:1;min-width:120px}.player{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding:10px 0}.player:first-child{border-top:0}.name{font-weight:850}.dead .name{text-decoration:line-through;color:#857b90}.tag{font-size:10px;border:1px solid var(--line);border-radius:99px;padding:4px 7px;color:var(--muted)}
.log{white-space:pre-wrap;line-height:1.44;font-size:14px}.round{font-size:11px;color:var(--purple2);font-weight:900;letter-spacing:.1em;margin-bottom:6px}.winner{text-align:center;padding:24px 12px}.winner .crown{font-size:48px}.error{background:#381624;border:1px solid #6e2944;border-radius:14px;padding:12px;margin:10px 0;color:#ffd2df}.empty{text-align:center;color:var(--muted);padding:26px 10px}.pulse{animation:pulse 1.5s infinite}@keyframes pulse{50%{opacity:.55}}
.feature{overflow:hidden;position:relative;border-color:#5b3a89}.feature:before{content:"";position:absolute;inset:-50%;background:radial-gradient(circle,rgba(157,104,255,.18),transparent 48%);animation:drift 7s linear infinite;pointer-events:none}.feature>*{position:relative}.featureTitle{font-size:25px;font-weight:1000;letter-spacing:-.025em}.system{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.11em;color:var(--purple2)}
.voteHeader{display:flex;align-items:center;gap:14px}.ring{--pct:100;width:78px;height:78px;border-radius:50%;background:conic-gradient(var(--purple) calc(var(--pct)*1%),#271c38 0);display:grid;place-items:center;box-shadow:0 0 28px rgba(157,104,255,.28)}.ring:after{content:"";position:absolute;width:60px;height:60px;border-radius:50%;background:var(--panel)}.ring .countdown{position:relative;z-index:1;font-size:25px;font-weight:1000}.voteRows{display:grid;gap:8px;margin-top:14px}.voteRow{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:13px;background:#171020}.voteBar{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,rgba(157,104,255,.36),rgba(157,104,255,.08));width:0;transition:width .4s}.voteButton{position:relative;z-index:1;width:100%;display:flex;justify-content:space-between;background:transparent;text-align:left}.voteButton.selected{box-shadow:inset 0 0 0 2px var(--purple)}
.duel{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:15px 0}.duelist{padding:16px 10px;border:1px solid var(--line);border-radius:15px;text-align:center;font-weight:950;background:#15101e}.duelist.won{border-color:var(--good);box-shadow:0 0 24px rgba(87,230,165,.18)}.duelist.lost{text-decoration:line-through;color:#8e8098;border-color:#55243a;transform:translateY(8px);opacity:.7}.vs{font-weight:1000;color:var(--danger)}
.brawlNames{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.fighterChip{padding:7px 9px;border:1px solid var(--line);background:#16101f;border-radius:99px;font-size:11px;font-weight:900}.fighterChip.dead{color:#8b7e92;text-decoration:line-through}.fighterChip.survivor{border-color:#356c58;color:#9ff2cd}
.monitorGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0}.monitor{aspect-ratio:1.45;border:1px solid #443258;background:linear-gradient(135deg,#0b0710,#20142c);border-radius:7px;position:relative;overflow:hidden}.monitor:after{content:"LIVE";position:absolute;top:5px;left:5px;font:800 8px ui-monospace;color:#e9d9ff;opacity:.7}.monitor:nth-child(2n){animation:flicker 2.7s infinite}
.redButtonWrap{text-align:center;margin:15px 0}.redButton{width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#ff6b7b,#b70f2d 48%,#5d0618 70%);border:8px solid #26141d;box-shadow:0 9px 0 #3d0b18,0 0 32px rgba(255,49,91,.24);display:inline-grid;place-items:center;font-weight:1000;font-size:10px;letter-spacing:.08em;animation:redPulse 1.9s infinite}.redButton.pressed{transform:translateY(7px);box-shadow:0 2px 0 #3d0b18,0 0 45px rgba(255,49,91,.5)}
#fx{position:fixed;inset:0;z-index:100;pointer-events:none;display:grid;place-items:center;overflow:hidden}.fxCard{max-width:min(92vw,620px);padding:24px 20px;border-radius:20px;background:rgba(8,5,12,.94);border:1px solid #5d4380;box-shadow:0 0 80px rgba(157,104,255,.32);text-align:center;animation:slamIn .35s cubic-bezier(.18,.89,.32,1.28)}.fxCode{font:900 10px ui-monospace;letter-spacing:.18em;color:var(--purple2)}.fxTitle{font-size:31px;font-weight:1000;margin:8px 0}.fxNames{font-weight:900;color:#eadcff}.fxDanger{color:var(--danger)}.fxGood{color:var(--good)}
body.mode-brawl{background:#0d050b}body.mode-brawl .top{background:linear-gradient(180deg,#0d050b 78%,transparent)}body.mode-revival{filter:saturate(.55)}body.mode-final{background:#050307}body.mode-final .top{background:linear-gradient(180deg,#050307 78%,transparent)}body.mode-glitch .app{animation:microGlitch .22s steps(2,end) 3}.shake{animation:shake .42s both}.screenFlash:after{content:"";position:fixed;inset:0;z-index:95;background:rgba(183,79,255,.2);animation:flash .36s forwards;pointer-events:none}
.lockdown{border-color:#783552;background:linear-gradient(180deg,#251019,#130a10)}.lockdown .featureTitle{color:#ff98b0}.finalBanner{border:1px solid #6b2d47;background:#1b0b12;padding:12px;border-radius:14px;text-align:center;margin:10px 0}.finalBanner b{display:block;font-size:18px}.reviveGlow{animation:reviveGlow 1.3s ease-out}.eliminateDrop{animation:eliminateDrop .75s ease-in forwards}
@keyframes drift{to{transform:rotate(360deg)}}@keyframes flicker{0%,95%,100%{opacity:1}96%{opacity:.25}97%{opacity:.9}98%{opacity:.15}}@keyframes redPulse{50%{filter:brightness(1.16);box-shadow:0 9px 0 #3d0b18,0 0 45px rgba(255,49,91,.36)}}@keyframes slamIn{from{opacity:0;transform:scale(1.16)}to{opacity:1;transform:scale(1)}}@keyframes shake{20%{transform:translate(-7px,2px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,3px)}80%{transform:translate(4px,-1px)}}@keyframes flash{to{opacity:0}}@keyframes microGlitch{0%{transform:translate(0)}25%{transform:translate(3px,-1px)}50%{transform:translate(-2px,1px);filter:hue-rotate(25deg)}75%{transform:translate(1px,2px)}100%{transform:translate(0)}}@keyframes reviveGlow{0%{box-shadow:0 0 0 rgba(87,230,165,0)}40%{box-shadow:0 0 40px rgba(87,230,165,.5)}100%{box-shadow:0 0 0 rgba(87,230,165,0)}}@keyframes eliminateDrop{to{transform:translateY(90px) rotate(4deg);opacity:0}}
@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<div id="fx"></div>
<div id="app" class="app"><div class="empty pulse">Opening DWallet Arena…</div></div>
<script>
const tg=window.Telegram?.WebApp;const root=document.getElementById('app');const fx=document.getElementById('fx');
if(tg){tg.ready();tg.expand();try{tg.requestFullscreen?.()}catch{};try{tg.setHeaderColor?.('#09070f');tg.setBackgroundColor?.('#09070f')}catch{}}
const initData=tg?.initData||'';const unsafe=tg?.initDataUnsafe||{};const qs=new URLSearchParams(location.search);const start=unsafe.start_param||qs.get('tgWebAppStartParam')||'';const gameId=start.startsWith('arena_')?start.slice(6):'';
let state=null,busy=false,pollHandle=null,lastFeatureKey='',lastLogKey='',fxTimer=null,previousAlive=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').replace(/~~/g,'').replace(/\*\*\*/g,'').replace(/\*\*/g,'').replace(/^#{1,2}\\s+/gm,'').replace(/\\\\\./g,'.');
const api=async(path,opts={})=>{const r=await fetch(path,{...opts,headers:{'content-type':'application/json','x-telegram-init-data':initData,...(opts.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!j.ok)throw new Error(j.error||'Arena request failed');return j};
function impact(type='light'){try{tg?.HapticFeedback?.impactOccurred(type)}catch{}}
function selection(){try{tg?.HapticFeedback?.selectionChanged()}catch{impact('light')}}
function notification(type='success'){try{tg?.HapticFeedback?.notificationOccurred(type)}catch{impact(type==='error'?'heavy':'medium')}}
function notify(message){if(tg?.showAlert)tg.showAlert(message);else alert(message)}
function playerName(id){return state?.players?.find(p=>p.id===id)?.displayName||'Unknown'}
function latestLogs(){return(state?.displayLog||[]).slice().reverse()}
function latestText(){return clean(latestLogs()[0]?.text||'')}
function idNames(ids){return(ids||[]).map(playerName)}
function locationFromState(){const text=(state?.displayLog||[]).slice(-5).map(x=>clean(x.text)).join(' | ').toLowerCase();const spots=[['crek’s lair','CREK’S LAIR'],["crek's lair",'CREK’S LAIR'],['peach’s lair','PEACH’S LAIR'],["peach's lair",'PEACH’S LAIR'],['drop control','DROP CONTROL'],['claim hall','CLAIM HALL'],['dwallet vault','DWALLET VAULT'],['bot basement','BOT BASEMENT'],['server room','SERVER ROOM'],['sticker lab','STICKER LAB'],['community floor','COMMUNITY FLOOR'],['wallet ops','WALLET OPS'],['rooftop relay','ROOFTOP RELAY'],['transaction bay','TRANSACTION BAY'],['degen lounge','DEGEN LOUNGE'],['mod war room','MOD WAR ROOM'],['ledger hall','LEDGER HALL'],['notification nest','NOTIFICATION NEST'],['qr room','QR ROOM'],['drop chamber','DROP CHAMBER'],['treasury','TREASURY']];for(const pair of spots)if(text.includes(pair[0]))return pair[1];return'DWALLET HQ'}
function featureKey(s){const f=s?.feature;if(!f)return'';if(f.type==='community_vote')return'vote:'+s.round;if(f.type==='mass_brawl')return'brawl:'+s.round+':'+(f.eliminatedIds||[]).join(',');if(f.type==='revival')return'revival:'+s.round+':'+f.winnerId;if(f.type==='community_result')return'community-result:'+s.round+':'+f.survivorId;if(f.type==='revival_skipped')return'revival-skip:'+s.round;return f.type+':'+s.round}
function showFx(code,title,body='',tone='purple',ms=1700){clearTimeout(fxTimer);fx.innerHTML='<div class="fxCard"><div class="fxCode">'+esc(code)+'</div><div class="fxTitle '+(tone==='danger'?'fxDanger':tone==='good'?'fxGood':'')+'">'+esc(title)+'</div>'+(body?'<div class="fxNames">'+esc(body)+'</div>':'')+'</div>';document.body.classList.add('screenFlash');setTimeout(()=>document.body.classList.remove('screenFlash'),450);fxTimer=setTimeout(()=>{fx.innerHTML=''},ms)}
function setMode(){document.body.classList.remove('mode-brawl','mode-revival','mode-final','mode-glitch');const type=state?.feature?.type;if(type==='mass_brawl')document.body.classList.add('mode-brawl');if(type==='revival'||type==='revival_skipped')document.body.classList.add('mode-revival');if(state?.finalFive)document.body.classList.add('mode-final');const txt=latestText().toLowerCase();if(txt.includes('dwallet glitch')||txt.includes('do not click')||txt.includes('from later')||txt.includes('haunted'))document.body.classList.add('mode-glitch')}
function redButtonWanted(){const loc=locationFromState();const feature=state?.feature?.type||'';return loc==='PEACH’S LAIR'||((feature==='community_vote'||feature==='mass_brawl'||feature==='revival')&&Number(state?.round||0)%4===0)}
function monitorsWanted(){return locationFromState()==='CREK’S LAIR'||(state?.feature?.type==='mass_brawl'&&Number(state?.round||0)%3===0)}
function featureCard(){const f=state?.feature;if(!f)return'';const loc=locationFromState();let h='<div class="card feature"><div class="system">LOCATION // '+esc(loc)+'</div>';
if(f.type==='community_vote'){const left=Math.max(0,Math.ceil((Number(state.crowdVote?.closesAt||Date.now())-Date.now())/1000));const pct=Math.max(0,Math.min(100,left/30*100));const totals=state.crowdVote?.totals||{};const max=Math.max(1,...Object.values(totals).map(Number));h+='<div class="voteHeader"><div class="ring" id="voteRing" style="--pct:'+pct+'"><span class="countdown" id="voteCountdown">'+left+'</span></div><div><div class="round">THE CHAT HAS CONTROL</div><div class="featureTitle">👁️ COMMUNITY SHOWDOWN</div></div></div><div class="muted">30 seconds. The top two get ripped into a strict 1v1.</div><div class="voteRows">';for(const id of state.crowdVote.eligibleIds){const votes=Number(totals[id]||0);const width=Math.round(votes/max*100);const selected=state.crowdVote.voteTargetId===id?' selected':'';h+='<div class="voteRow"><div class="voteBar" style="width:'+width+'%"></div><button class="voteButton'+selected+'" '+(state.viewer.canVote?'onclick="vote(\''+esc(id)+'\')"':'disabled')+'><span>'+esc(playerName(id))+(selected?' ✓':'')+'</span><span>'+votes+'</span></button></div>'}h+='</div>'}
else if(f.type==='community_result'){const q=f.qualifierIds||[];h+='<div class="round">VOTE LOCKED // FINAL 1V1</div><div class="featureTitle">THE CHAT CHOSE</div><div class="duel"><div class="duelist '+(q[0]===f.survivorId?'won':'lost')+'">'+esc(playerName(q[0]))+'</div><div class="vs">VS</div><div class="duelist '+(q[1]===f.survivorId?'won':'lost')+'">'+esc(playerName(q[1]))+'</div></div><div class="good"><b>SURVIVOR: '+esc(playerName(f.survivorId))+'</b></div>'}
else if(f.type==='revival'){h+='<div class="round">RECOVERY PROTOCOL</div><div class="featureTitle">⚡ SECOND CHANCE</div><div class="duel"><div class="duelist '+(f.selectedIds?.[0]===f.winnerId?'won':'lost')+'">'+esc(playerName(f.selectedIds?.[0]))+'</div><div class="vs">RETURN</div><div class="duelist '+(f.selectedIds?.[1]===f.winnerId?'won':'lost')+'">'+esc(playerName(f.selectedIds?.[1]))+'</div></div><div class="good"><b>STATUS RESTORED: '+esc(playerName(f.winnerId))+'</b></div><div class="danger">RESTORE FAILED: '+esc(playerName(f.loserId))+'</div>'}
else if(f.type==='revival_skipped'){h+='<div class="round">RECOVERY PROTOCOL</div><div class="featureTitle">⚡ SECOND CHANCE</div><div class="muted">Protocol unavailable. '+esc(f.reason==='final_five'?'Final Five lockdown is active.':'Not enough eliminated players.')+'</div>'}
else if(f.type==='mass_brawl'){h+='<div class="round">⚠ SECURITY OVERRIDE // HQ LOCKDOWN</div><div class="featureTitle">💥 MASS BRAWL</div><div class="brawlNames">';for(const id of f.participantIds||[]){const dead=(f.eliminatedIds||[]).includes(id),surv=(f.survivorIds||[]).includes(id);h+='<span class="fighterChip '+(dead?'dead':surv?'survivor':'')+'">'+esc(playerName(id))+'</span>'}h+='</div><div class="good"><b>SURVIVORS: '+esc(idNames(f.survivorIds).join(' • '))+'</b></div>'}
if(monitorsWanted())h+='<div class="monitorGrid"><div class="monitor"></div><div class="monitor"></div><div class="monitor"></div><div class="monitor"></div><div class="monitor"></div><div class="monitor"></div></div><div class="system">CREK CONTROL WALL // RECORDING</div>';
if(redButtonWanted())h+='<div class="redButtonWrap"><div class="redButton '+(f.type==='community_result'||f.type==='mass_brawl'?'pressed':'')+'">DO NOT<br>PRESS</div><div class="system" style="margin-top:10px">PEACH CONTROL // ARMED</div></div>';
h+='</div>';return h}
function detectTransitions(oldState,newState){const newKey=featureKey(newState);if(newKey&&newKey!==lastFeatureKey){lastFeatureKey=newKey;const f=newState.feature;if(f?.type==='community_vote'){notification('warning');showFx('DWALLET HQ // AUTHORITY TRANSFER','THE CHAT HAS CONTROL','30 SECONDS','danger',1900)}else if(f?.type==='mass_brawl'){impact('heavy');setTimeout(()=>impact('rigid'),120);showFx('DWALLET HQ // SECURITY OVERRIDE','HQ LOCKDOWN','MASS BRAWL','danger',1800)}else if(f?.type==='revival'){notification('success');showFx('DWALLET HQ // RECOVERY PROTOCOL','SECOND CHANCE',playerName(f.winnerId)+' RESTORED','good',1900)}else if(f?.type==='community_result'){impact('heavy');notification('success');showFx('COMMUNITY SHOWDOWN // RESULT',playerName(f.survivorId)+' SURVIVES',idNames(f.eliminatedIds).join(', ')+' ELIMINATED','good',1900)}}
const oldAlive=new Set(oldState?.aliveIds||previousAlive||[]);const newAlive=new Set(newState?.aliveIds||[]);const newlyDead=[...oldAlive].filter(id=>!newAlive.has(id));const revived=[...newAlive].filter(id=>oldState&&!(oldState.aliveIds||[]).includes(id)&&(oldState.eliminatedIds||[]).includes(id));if(newlyDead.length&&!['mass_brawl','community_result'].includes(newState?.feature?.type)){impact('heavy');showFx('DWALLET HQ // PLAYER STATUS','ELIMINATED',newlyDead.map(id=>newState.players.find(p=>p.id===id)?.displayName||id).join(' • '),'danger',1300)}if(revived.length&&newState?.feature?.type!=='revival'){notification('success');showFx('DWALLET HQ // PLAYER STATUS','ACTIVE AGAIN',revived.map(id=>newState.players.find(p=>p.id===id)?.displayName||id).join(' • '),'good',1300)}
const finalKey='dwallet-final-five:'+gameId;if(newState?.finalFive&&!sessionStorage.getItem(finalKey)){sessionStorage.setItem(finalKey,'1');notification('warning');setTimeout(()=>impact('heavy'),180);showFx('DWALLET HQ // SPECIAL PROTOCOLS DISABLED','FINAL FIVE','NOBODY IS COMING TO SAVE YOU NOW.','danger',2600)}
const newest=(newState?.displayLog||[]).at(-1);const logKey=newest?(newest.round+':'+newest.at+':'+newest.text):'';if(logKey&&logKey!==lastLogKey){lastLogKey=logKey;const txt=clean(newest.text).toLowerCase();if(txt.includes('dwallet glitch')||txt.includes('do not click')||txt.includes('from later')||txt.includes('haunted')){notification('warning');document.body.classList.add('mode-glitch');showFx('DWALLET HQ // SYSTEM ANOMALY','SIGNAL CORRUPTED','VEIL REFUSES TO ELABORATE','danger',1250)}}previousAlive=[...(newState?.aliveIds||[])]}
function render(){if(!state){root.innerHTML='<div class="empty pulse">Syncing Arena…</div>';return}setMode();const me=state.viewer;const players=[...(state.players||[])].sort((a,b)=>Number(b.alive)-Number(a.alive)||a.displayName.localeCompare(b.displayName));const loc=locationFromState();let html='<div class="top"><div class="brand">DWALLET • VEIL TERMINAL</div><div class="location">LOCATION // '+esc(loc)+'</div><div class="title">'+esc(state.title)+'</div><div class="stats"><div class="stat"><b>'+state.round+'</b><span>ROUND</span></div><div class="stat"><b>'+state.aliveCount+'</b><span>ALIVE</span></div><div class="stat"><b>'+state.playerCount+'</b><span>ENTERED</span></div></div></div>';
if(state.finalFive)html+='<div class="finalBanner"><span class="system">DWALLET HQ // LOCKDOWN</span><b>FINAL FIVE</b><span class="danger">SPECIAL PROTOCOLS DISABLED</span></div>';
if(state.status==='registration'){html+='<div class="card"><h2>⚔️ Registration Open</h2><div class="muted">Join here. The DWallet group stays clean while Arena runs in this window.</div><div class="actions" style="margin-top:14px">';if(!me.joined)html+='<button onclick="act(\'join\')">ENTER ARENA</button>';else if(!me.isHost)html+='<button class="secondary" onclick="act(\'leave\')">LEAVE</button>';if(me.isHost)html+='<button onclick="act(\'start\')">START ARENA</button>';html+='</div></div>'}
if(state.status==='running'&&state.feature)html+=featureCard();
if(state.status==='finished'){html+='<div class="card winner"><div class="crown">🏆</div><h2>'+esc(playerName(state.winnerId))+' WINS</h2><div class="muted">The Arena is closed. The group cooldown has begun.</div></div>'}
if(state.status!=='registration'&&(state.displayLog||[]).length){html+='<div class="card"><h3>LIVE ARENA</h3>';for(const item of latestLogs()){html+='<div class="player" style="display:block"><div class="round">ROUND '+esc(item.round)+'</div><div class="log">'+esc(clean(item.text))+'</div></div>'}html+='</div>'}
html+='<div class="card"><h3>'+(state.status==='registration'?'PLAYERS':'ROSTER')+'</h3>';if(!players.length)html+='<div class="empty">Nobody entered yet.</div>';for(const p of players){const reviveClass=state.feature?.type==='revival'&&state.feature?.winnerId===p.id?' reviveGlow':'';html+='<div class="player '+(p.alive?'':'dead')+reviveClass+'"><div><div class="name">'+esc(p.displayName)+(p.id===state.hostId?' 👑':'')+'</div><div class="muted" style="font-size:11px">'+p.eliminations+' kills • '+p.revivals+' revives</div></div><span class="tag">'+(p.alive?'ACTIVE':'OUT')+'</span></div>'}html+='</div>';root.innerHTML=html}
async function refresh(){if(!gameId||!initData){root.innerHTML='<div class="error">Open this Arena from Veil’s button inside the DWallet Telegram group.</div>';return}try{const old=state;const j=await api('/telegram/miniapp/state?game='+encodeURIComponent(gameId));state=j.state;detectTransitions(old,state);render()}catch(e){root.innerHTML='<div class="error">'+esc(e.message)+'</div>'}}
function nextPollDelay(){const jitter=Math.floor(Math.random()*700);if(document.hidden)return 12000+jitter;if(state?.crowdVote)return 1000+jitter;if(state?.status==='registration')return 4200+jitter;if(state?.status==='running')return 2200+jitter;return 10000+jitter}
async function poll(){await refresh();clearTimeout(pollHandle);pollHandle=setTimeout(poll,nextPollDelay())}
function tickCountdown(){const el=document.getElementById('voteCountdown'),ring=document.getElementById('voteRing');if(!el||!state?.crowdVote?.closesAt)return;const left=Math.max(0,Math.ceil((Number(state.crowdVote.closesAt)-Date.now())/1000));el.textContent=left;if(ring)ring.style.setProperty('--pct',Math.max(0,Math.min(100,left/30*100)));if(left<=5&&left>0&&Date.now()%1000<300)impact(left<=2?'heavy':'light')}
window.act=async action=>{if(busy)return;busy=true;impact('medium');try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action})});const old=state;state=j.state;detectTransitions(old,state);render()}catch(e){notification('error');notify(e.message)}finally{busy=false}};
window.vote=async targetId=>{if(busy)return;busy=true;selection();try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action:'vote',targetId})});state=j.state;render()}catch(e){notification('error');notify(e.message)}finally{busy=false}};
poll();setInterval(tickCountdown,200);document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(pollHandle);poll()}});
</script>
</body>
</html>`;
}
