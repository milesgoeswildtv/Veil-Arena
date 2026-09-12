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

function publicState(game, viewer) {
  const theme = getTheme(game.themeId);
  const current = game.players[viewer.id] || null;
  const vote = game.crowdVote?.status === "open" ? game.crowdVote : null;
  const voteTargetId = vote?.votesBySpectator?.[viewer.id] || null;
  const log = Array.isArray(game.displayLog) ? game.displayLog.slice(-16) : [];
  const voteOpenedAt = vote ? [...log].reverse().find(item => Number(item?.round) === Number(game.round) && String(item?.text || "").includes(theme.labels.crowdVote))?.at : null;
  const inferredClosesAt = voteOpenedAt ? Date.parse(voteOpenedAt) + 30000 : null;
  const closesAt = vote?.closesAt || inferredClosesAt;
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
    aliveCount: game.aliveIds.length,
    eliminatedCount: game.eliminatedIds.length,
    players: playerView(game),
    aliveIds: game.aliveIds,
    eliminatedIds: game.eliminatedIds,
    displayLog: log,
    crowdVote: vote ? { status: vote.status, eligibleIds: vote.eligibleIds, closesAt, voteTargetId } : null,
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
:root{color-scheme:dark;--bg:#09070f;--panel:#141020;--panel2:#1d152d;--purple:#9d68ff;--purple2:#cfb3ff;--text:#f7f3ff;--muted:#aaa0bb;--danger:#ff557f;--good:#57e6a5;--line:#302442}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:calc(12px + env(safe-area-inset-top)) 12px calc(24px + env(safe-area-inset-bottom))}
.app{max-width:760px;margin:0 auto}.top{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,var(--bg) 78%,transparent);padding:4px 0 16px}.brand{font-size:12px;letter-spacing:.2em;color:var(--purple2);font-weight:900}.title{font-size:28px;font-weight:950;line-height:1;margin:7px 0 12px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px}.stat b{display:block;font-size:20px}.stat span{font-size:10px;color:var(--muted);font-weight:800;letter-spacing:.08em}
.card{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:18px;padding:15px;margin:10px 0;box-shadow:0 12px 32px rgba(0,0,0,.22)}.card h2,.card h3{margin:0 0 10px}.muted{color:var(--muted)}.purple{color:var(--purple2)}.danger{color:var(--danger)}.good{color:var(--good)}
button{appearance:none;border:0;border-radius:14px;padding:13px 15px;font-size:14px;font-weight:900;background:var(--purple);color:#fff;min-height:46px}button.secondary{background:#292038}button.dangerBtn{background:#512037}button:disabled{opacity:.45}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{flex:1;min-width:120px}.player{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding:10px 0}.player:first-child{border-top:0}.name{font-weight:850}.dead .name{text-decoration:line-through;color:#857b90}.tag{font-size:10px;border:1px solid var(--line);border-radius:99px;padding:4px 7px;color:var(--muted)}
.log{white-space:pre-wrap;line-height:1.44;font-size:14px}.round{font-size:11px;color:var(--purple2);font-weight:900;letter-spacing:.1em;margin-bottom:6px}.voteGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.voteGrid button{background:#251b35;text-align:left;height:auto}.voteGrid button.selected{outline:2px solid var(--purple);background:#352251}.countdown{font-size:30px;font-weight:950}.winner{text-align:center;padding:24px 12px}.winner .crown{font-size:48px}.error{background:#381624;border:1px solid #6e2944;border-radius:14px;padding:12px;margin:10px 0;color:#ffd2df}.empty{text-align:center;color:var(--muted);padding:26px 10px}.pulse{animation:pulse 1.5s infinite}@keyframes pulse{50%{opacity:.55}}
</style>
</head>
<body>
<div id="app" class="app"><div class="empty pulse">Opening DWallet Arena…</div></div>
<script>
const tg=window.Telegram?.WebApp;const root=document.getElementById('app');
if(tg){tg.ready();tg.expand();try{tg.requestFullscreen?.()}catch{};try{tg.setHeaderColor?.('#09070f');tg.setBackgroundColor?.('#09070f')}catch{}}
const initData=tg?.initData||'';const unsafe=tg?.initDataUnsafe||{};const qs=new URLSearchParams(location.search);const start=unsafe.start_param||qs.get('tgWebAppStartParam')||'';const gameId=start.startsWith('arena_')?start.slice(6):'';
let state=null,busy=false,pollHandle=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').replace(/~~/g,'').replace(/\*\*\*/g,'').replace(/\*\*/g,'').replace(/^#{1,2}\\s+/gm,'').replace(/\\\\\./g,'.');
const api=async(path,opts={})=>{const r=await fetch(path,{...opts,headers:{'content-type':'application/json','x-telegram-init-data':initData,...(opts.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!j.ok)throw new Error(j.error||'Arena request failed');return j};
function haptic(type='light'){try{tg?.HapticFeedback?.impactOccurred(type)}catch{}}
function notify(message){if(tg?.showAlert)tg.showAlert(message);else alert(message)}
function playerName(id){return state?.players?.find(p=>p.id===id)?.displayName||'Unknown'}
function latestLogs(){return(state?.displayLog||[]).slice().reverse()}
function render(){if(!state){root.innerHTML='<div class="empty pulse">Syncing Arena…</div>';return}const me=state.viewer;const players=[...(state.players||[])].sort((a,b)=>Number(b.alive)-Number(a.alive)||a.displayName.localeCompare(b.displayName));let html='<div class="top"><div class="brand">DWALLET • VEIL</div><div class="title">'+esc(state.title)+'</div><div class="stats"><div class="stat"><b>'+state.round+'</b><span>ROUND</span></div><div class="stat"><b>'+state.aliveCount+'</b><span>ALIVE</span></div><div class="stat"><b>'+state.playerCount+'</b><span>ENTERED</span></div></div></div>';
if(state.status==='registration'){html+='<div class="card"><h2>⚔️ Registration Open</h2><div class="muted">Join here. The DWallet group stays clean while Arena runs in this window.</div><div class="actions" style="margin-top:14px">';if(!me.joined)html+='<button onclick="act(\'join\')">ENTER ARENA</button>';else if(!me.isHost)html+='<button class="secondary" onclick="act(\'leave\')">LEAVE</button>';if(me.isHost)html+='<button onclick="act(\'start\')">START ARENA</button>';html+='</div></div>'}
if(state.crowdVote){const left=Math.max(0,Math.ceil((Number(state.crowdVote.closesAt||Date.now())-Date.now())/1000));html+='<div class="card"><div class="round">THE CHAT CHOOSES</div><div class="countdown" id="voteCountdown">'+left+'s</div><h2>👁️ Community Showdown</h2>';if(me.canVote){html+='<div class="muted" style="margin-bottom:10px">Tap a player. You can change your vote until the timer ends.</div><div class="voteGrid">';for(const id of state.crowdVote.eligibleIds){const selected=state.crowdVote.voteTargetId===id?' selected':'';html+='<button class="'+selected+'" onclick="vote(\''+esc(id)+'\')">'+esc(playerName(id))+(selected?' ✓':'')+'</button>'}html+='</div>'}else html+='<div class="muted">You are still fighting or voting time has ended. Spectators and eliminated players control this vote.</div>';html+='</div>'}
if(state.status==='finished'){html+='<div class="card winner"><div class="crown">🏆</div><h2>'+esc(playerName(state.winnerId))+' WINS</h2><div class="muted">The Arena is closed. The group cooldown has begun.</div></div>'}
if(state.status!=='registration'&&(state.displayLog||[]).length){html+='<div class="card"><h3>LIVE ARENA</h3>';for(const item of latestLogs()){html+='<div class="player" style="display:block"><div class="round">ROUND '+esc(item.round)+'</div><div class="log">'+esc(clean(item.text))+'</div></div>'}html+='</div>'}
html+='<div class="card"><h3>'+(state.status==='registration'?'PLAYERS':'ROSTER')+'</h3>';if(!players.length)html+='<div class="empty">Nobody entered yet.</div>';for(const p of players){html+='<div class="player '+(p.alive?'':'dead')+'"><div><div class="name">'+esc(p.displayName)+(p.id===state.hostId?' 👑':'')+'</div><div class="muted" style="font-size:11px">'+p.eliminations+' kills • '+p.revivals+' revives</div></div><span class="tag">'+(p.alive?'ACTIVE':'OUT')+'</span></div>'}html+='</div>';root.innerHTML=html}
async function refresh(){if(!gameId||!initData){root.innerHTML='<div class="error">Open this Arena from Veil’s button inside the DWallet Telegram group.</div>';return}try{const j=await api('/telegram/miniapp/state?game='+encodeURIComponent(gameId));state=j.state;render()}catch(e){root.innerHTML='<div class="error">'+esc(e.message)+'</div>'}}
function nextPollDelay(){const jitter=Math.floor(Math.random()*900);if(document.hidden)return 12000+jitter;if(state?.crowdVote)return 1400+jitter;if(state?.status==='registration')return 4200+jitter;if(state?.status==='running')return 3000+jitter;return 10000+jitter}
async function poll(){await refresh();clearTimeout(pollHandle);pollHandle=setTimeout(poll,nextPollDelay())}
function tickCountdown(){const el=document.getElementById('voteCountdown');if(!el||!state?.crowdVote?.closesAt)return;const left=Math.max(0,Math.ceil((Number(state.crowdVote.closesAt)-Date.now())/1000));el.textContent=left+'s'}
window.act=async action=>{if(busy)return;busy=true;haptic('medium');try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action})});state=j.state;render()}catch(e){notify(e.message)}finally{busy=false}};
window.vote=async targetId=>{if(busy)return;busy=true;haptic('light');try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action:'vote',targetId})});state=j.state;render()}catch(e){notify(e.message)}finally{busy=false}};
poll();setInterval(tickCountdown,250);document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(pollHandle);poll()}});
</script>
</body>
</html>`;
}
