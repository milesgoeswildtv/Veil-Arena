import { addPlayer, removePlayer, startGame, castCrowdVote } from "./core/engine.js";
import { ensureSchema, loadGame, saveGame } from "./storage.js";
import { getTheme } from "./themes/index.js";
import { userFromTelegram, telegramUserInChat, editTelegramMessage, telegramArenaLauncherKeyboard } from "./telegram.js";

const encoder = new TextEncoder();
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

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

async function loadTelegramGame(env, gameId) {
  await ensureSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
  return game;
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
    const game = await loadTelegramGame(env, gameId);
    assertChatInstance(game, auth);
    await verifyGroupMember(env, game, auth.user.id);
    if (!game.telegramChatInstance && auth.chatInstance) game.telegramChatInstance = auth.chatInstance;

    if (action === "join") {
      addPlayer(game, auth.user);
      await saveGame(env.DB, game);
    } else if (action === "leave") {
      if (auth.user.id === game.hostId) throw new Error("The Arena host cannot leave registration.");
      removePlayer(game, auth.user.id);
      await saveGame(env.DB, game);
    } else if (action === "start") {
      if (auth.user.id !== game.hostId) throw new Error("Only the Arena host can start the game.");
      startGame(game);
      await saveGame(env.DB, game);
      await updateLauncherForStartedGame(env, game);
      await kickCoordinator(env, game.channelId, "kick", "telegram");
    } else if (action === "vote") {
      if (!game.crowdVote || game.crowdVote.status !== "open") throw new Error("The community vote is closed.");
      if (game.crowdVote.closesAt && Date.now() >= game.crowdVote.closesAt) throw new Error("Voting time is up.");
      if (game.aliveIds.includes(auth.user.id)) throw new Error("You're still fighting. Spectators get this vote.");
      const targetId = String(body.targetId || "");
      if (!game.players[targetId]?.alive) throw new Error("That player is not available for this vote.");
      castCrowdVote(game, auth.user.id, targetId);
      await saveGame(env.DB, game);
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
let state=null,busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').replace(/~~/g,'').replace(/\*\*\*/g,'').replace(/\*\*/g,'').replace(/^#{1,2}\\s+/gm,'').replace(/\\\\\./g,'.');
const api=async(path,opts={})=>{const r=await fetch(path,{...opts,headers:{'content-type':'application/json','x-telegram-init-data':initData,...(opts.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!j.ok)throw new Error(j.error||'Arena request failed');return j};
function haptic(type='light'){try{tg?.HapticFeedback?.impactOccurred(type)}catch{}}
function notify(message){if(tg?.showAlert)tg.showAlert(message);else alert(message)}
function playerName(id){return state?.players?.find(p=>p.id===id)?.displayName||'Unknown'}
function latestLogs(){return(state?.displayLog||[]).slice().reverse()}
function render(){if(!state){root.innerHTML='<div class="empty pulse">Syncing Arena…</div>';return}const me=state.viewer;const players=[...(state.players||[])].sort((a,b)=>Number(b.alive)-Number(a.alive)||a.displayName.localeCompare(b.displayName));let html='<div class="top"><div class="brand">DWALLET • VEIL</div><div class="title">'+esc(state.title)+'</div><div class="stats"><div class="stat"><b>'+state.round+'</b><span>ROUND</span></div><div class="stat"><b>'+state.aliveCount+'</b><span>ALIVE</span></div><div class="stat"><b>'+state.playerCount+'</b><span>ENTERED</span></div></div></div>';
if(state.status==='registration'){html+='<div class="card"><h2>⚔️ Registration Open</h2><div class="muted">Join here. The DWallet group stays clean while Arena runs in this window.</div><div class="actions" style="margin-top:14px">';if(!me.joined)html+='<button onclick="act(\'join\')">ENTER ARENA</button>';else if(!me.isHost)html+='<button class="secondary" onclick="act(\'leave\')">LEAVE</button>';if(me.isHost)html+='<button onclick="act(\'start\')">START ARENA</button>';html+='</div></div>'}
if(state.crowdVote){const left=Math.max(0,Math.ceil((Number(state.crowdVote.closesAt||Date.now())-Date.now())/1000));html+='<div class="card"><div class="round">THE CHAT CHOOSES</div><div class="countdown">'+left+'s</div><h2>👁️ Community Showdown</h2>';if(me.canVote){html+='<div class="muted" style="margin-bottom:10px">Tap a player. You can change your vote until the timer ends.</div><div class="voteGrid">';for(const id of state.crowdVote.eligibleIds){const selected=state.crowdVote.voteTargetId===id?' selected':'';html+='<button class="'+selected+'" onclick="vote(\''+esc(id)+'\')">'+esc(playerName(id))+(selected?' ✓':'')+'</button>'}html+='</div>'}else html+='<div class="muted">You are still fighting or voting time has ended. Spectators and eliminated players control this vote.</div>';html+='</div>'}
if(state.status==='finished'){html+='<div class="card winner"><div class="crown">🏆</div><h2>'+esc(playerName(state.winnerId))+' WINS</h2><div class="muted">The Arena is closed. The group cooldown has begun.</div></div>'}
if(state.status!=='registration'&&(state.displayLog||[]).length){html+='<div class="card"><h3>LIVE ARENA</h3>';for(const item of latestLogs()){html+='<div class="player" style="display:block"><div class="round">ROUND '+esc(item.round)+'</div><div class="log">'+esc(clean(item.text))+'</div></div>'}html+='</div>'}
html+='<div class="card"><h3>'+(state.status==='registration'?'PLAYERS':'ROSTER')+'</h3>';if(!players.length)html+='<div class="empty">Nobody entered yet.</div>';for(const p of players){html+='<div class="player '+(p.alive?'':'dead')+'"><div><div class="name">'+esc(p.displayName)+(p.id===state.hostId?' 👑':'')+'</div><div class="muted" style="font-size:11px">'+p.eliminations+' kills • '+p.revivals+' revives</div></div><span class="tag">'+(p.alive?'ACTIVE':'OUT')+'</span></div>'}html+='</div>';root.innerHTML=html}
async function refresh(){if(!gameId||!initData){root.innerHTML='<div class="error">Open this Arena from Veil’s button inside the DWallet Telegram group.</div>';return}try{const j=await api('/telegram/miniapp/state?game='+encodeURIComponent(gameId));state=j.state;render()}catch(e){root.innerHTML='<div class="error">'+esc(e.message)+'</div>'}}
window.act=async action=>{if(busy)return;busy=true;haptic('medium');try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action})});state=j.state;render()}catch(e){notify(e.message)}finally{busy=false}};
window.vote=async targetId=>{if(busy)return;busy=true;haptic('light');try{const j=await api('/telegram/miniapp/action',{method:'POST',body:JSON.stringify({gameId,action:'vote',targetId})});state=j.state;render()}catch(e){notify(e.message)}finally{busy=false}};
refresh();setInterval(refresh,1200);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
</script>
</body>
</html>`;
}
