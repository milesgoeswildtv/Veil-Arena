import { addPlayer, startGame, castCrowdVote } from "./core/engine.js";
import { addFakeContestants, setSimulatedCrowd } from "./core/simulation.js";
import { advanceArenaGame } from "./core/orchestrator.js";
import { ensureSchema, loadGame, saveGame, recordFinishedGame } from "./storage.js";
import { startArenaCooldown, TELEGRAM_ARENA_COOLDOWN_MS } from "./cooldown.js";
import { getTheme } from "./themes/index.js";
import { validateTelegramInitData, telegramUserInChat } from "./telegram.js";

let telegramSchemaReady = false;

async function ensureTelegramSchema(db) {
  await ensureSchema(db);
  if (telegramSchemaReady) return;
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
    db.prepare(`CREATE TABLE IF NOT EXISTS arena_tick_leases (
      game_id TEXT PRIMARY KEY,
      lease_until INTEGER NOT NULL DEFAULT 0
    )`)
  ]);
  telegramSchemaReady = true;
}

function gameIdFromStartParam(value) {
  const raw = String(value || "");
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

async function hydrateRegistrations(db, game) {
  if (game.status !== "registration") return game;
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

async function authenticate(request, env) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram Arena is not configured yet.");
  await ensureTelegramSchema(env.DB);
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const gameId = gameIdFromStartParam(auth.startParam);
  if (!gameId) throw new Error("This Telegram launch does not contain an Arena ID.");
  let game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
  game = await bindChatInstance(env, game, auth);
  const member = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
  if (!member) throw new Error("Only members of the Telegram group that started this Arena can use it.");
  return { auth, game: await hydrateRegistrations(env.DB, game) };
}

async function acquireTickLease(db, gameId, now) {
  const leaseUntil = now + 4_000;
  const result = await db.prepare(`
    INSERT INTO arena_tick_leases (game_id, lease_until)
    VALUES (?, ?)
    ON CONFLICT(game_id) DO UPDATE SET lease_until = excluded.lease_until
    WHERE arena_tick_leases.lease_until < ?
  `).bind(gameId, leaseUntil, now).run();
  return Boolean(result?.meta?.changes);
}

async function releaseTickLease(db, gameId) {
  await db.prepare("UPDATE arena_tick_leases SET lease_until = 0 WHERE game_id = ?").bind(gameId).run();
}

async function maybeAdvance(env, game) {
  if (game.status !== "running") return game;
  const now = Date.now();
  const due = Number(game.nextAdvanceAt || 0);
  if (due > now) return game;
  if (!await acquireTickLease(env.DB, game.id, now)) return loadGame(env.DB, game.id);

  try {
    const fresh = await loadGame(env.DB, game.id);
    if (!fresh || fresh.status !== "running") return fresh || game;
    if (Number(fresh.nextAdvanceAt || 0) > Date.now()) return fresh;
    const event = advanceArenaGame(fresh);
    fresh.lastEvent = {
      type: event.type,
      round: event.round,
      text: event.text || null,
      at: new Date().toISOString()
    };
    fresh.nextAdvanceAt = event.finished ? null : Date.now() + Math.max(750, Number(event.waitMs) || 1_500);
    await saveGame(env.DB, fresh);
    if (fresh.status === "finished") {
      const recorded = await recordFinishedGame(env.DB, fresh);
      if (recorded && env.TELEGRAM_TEST_MODE !== "true") {
        await startArenaCooldown(env.DB, fresh.channelId, TELEGRAM_ARENA_COOLDOWN_MS);
      }
    }
    return fresh;
  } finally {
    await releaseTickLease(env.DB, game.id);
  }
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
  const advanced = await maybeAdvance(env, game);
  const hydrated = await hydrateRegistrations(env.DB, advanced);
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

export function telegramMiniAppHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>DWallet Arena</title><script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}*{box-sizing:border-box}body{margin:0;background:#08060d;color:#f8f4ff;min-height:100vh}.wrap{max-width:760px;margin:auto;padding:18px 14px 80px}.hero{padding:20px;border:1px solid #5c3f78;border-radius:24px;background:linear-gradient(145deg,#171020,#0d0912);box-shadow:0 18px 50px #0008}.eyebrow{font:800 12px ui-monospace,monospace;letter-spacing:.22em;color:#c6a4ff}.title{font-size:40px;line-height:.95;margin:8px 0 4px;font-weight:950}.status{color:#cbbfd6;margin:0 0 16px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat,.card{border:1px solid #49355e;background:#0d0a11;border-radius:16px;padding:13px}.stat b{display:block;font-size:23px}.controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{appearance:none;border:1px solid #7655a3;border-radius:13px;background:#231432;color:white;padding:12px 14px;font-weight:900;font-size:14px}button.primary{background:#8d57e8;border-color:#aa7aff}button.danger{background:#3a1018;border-color:#8f2c3e}.section{margin-top:14px}.section h3{font:900 12px ui-monospace,monospace;letter-spacing:.18em;color:#c7a8ef;margin:0 0 8px}.event{white-space:pre-wrap;line-height:1.45;font-size:15px}.event strong{font-weight:900}.event em{font-style:italic}.event s{opacity:.55;text-decoration-thickness:2px}.event-head{display:block;font-weight:950;font-size:1.08em;letter-spacing:.02em}.roster{display:grid;gap:6px}.player{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #352642;border-radius:12px;background:#0d0911}.dead{opacity:.45;text-decoration:line-through}.sim{font-size:10px;border:1px solid #59456c;padding:2px 5px;border-radius:6px;margin-left:6px}.voteGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.error{display:none;background:#3a1018;border:1px solid #8f2c3e;border-radius:14px;padding:12px;margin:12px 0;color:#ffdbe2}.small{font-size:12px;color:#9d91a5}.pulse{animation:pulse 1.4s infinite}@keyframes pulse{50%{opacity:.45}}
</style></head><body><div class="wrap"><div class="hero"><div class="eyebrow">DWALLET // VEIL</div><div class="title">ARENA</div><p class="status" id="status">Connecting to Telegram…</p><div class="stats"><div class="stat"><b id="round">0</b><span>ROUND</span></div><div class="stat"><b id="players">0</b><span>PLAYERS</span></div><div class="stat"><b id="alive">0</b><span>ALIVE</span></div></div><div class="error" id="error"></div><div class="controls" id="controls"></div></div><div class="section card"><h3>LIVE EVENT</h3><div class="event" id="event">Waiting for Arena…</div><div class="small" id="timer"></div></div><div class="section card" id="voteCard" style="display:none"><h3>COMMUNITY SHOWDOWN</h3><div class="voteGrid" id="voteGrid"></div></div><div class="section card"><h3>LIVE ROSTER</h3><div class="roster" id="roster"></div></div></div>
<script>
const tg=window.Telegram&&window.Telegram.WebApp;const initData=tg?.initData||'';let state=null,busy=false;
if(tg){try{tg.ready();tg.expand();tg.setHeaderColor('#100b17');tg.setBackgroundColor('#08060d');}catch{}}
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function richText(value=''){
  let out=esc(value);
  out=out.replaceAll(String.fromCharCode(92)+'.','.');
  out=out.replace(/^##\s+(.+)$/gm,'<span class="event-head">$1</span>');
  out=out.replace(/~~\*\*\*([^\n]+?)\*\*\*~~/g,'<s><strong><em>$1</em></strong></s>');
  out=out.replace(/\*\*\*([^\n]+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  out=out.replace(/~~([^\n]+?)~~/g,'<s>$1</s>');
  out=out.replace(/\*\*([^\n]+?)\*\*/g,'<strong>$1</strong>');
  out=out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g,'$1<em>$2</em>');
  return out;
}
function err(message=''){const e=$('error');e.textContent=message;e.style.display=message?'block':'none'}
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-telegram-init-data':initData},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({error:'Bad server response'}));if(!r.ok||d.error)throw new Error(d.error||'Request failed');return d}
async function act(action,extra={}){if(busy)return;busy=true;try{err();state=await api('/telegram/api/action',{action,...extra});render()}catch(e){err(e.message)}finally{busy=false}}
function button(label,action,cls=''){return '<button class="'+cls+'" data-action="'+action+'">'+esc(label)+'</button>'}
function render(){if(!state)return;$('status').textContent=state.status==='registration'?'REGISTRATION OPEN':state.status==='running'?'ARENA LIVE':state.status==='finished'?'ARENA COMPLETE':state.status.toUpperCase();$('round').textContent=state.round;$('players').textContent=state.playerCount;$('alive').textContent=state.aliveCount;
let controls='';if(state.status==='registration'){if(!state.viewer.joined)controls+=button('JOIN ARENA','join','primary');else if(!state.viewer.isHost)controls+=button('LEAVE','leave');if(state.viewer.isHost){controls+=button('START ARENA','start','primary');if(state.testMode){controls+=button('ADD 4 TEST BOTS','add4');controls+=button('FILL TO 12','fill');controls+=button('RESET','reset','danger')}}}else if(state.testMode&&state.viewer.isHost&&state.status==='running')controls+=button('ABORT / RESET','reset','danger');$('controls').innerHTML=controls;
const last=state.lastEvent?.text||state.displayLog?.at(-1)?.text|| (state.status==='registration'?'Players are entering the Arena.':state.status==='running'?'Arena is moving…':'No event yet.');$('event').innerHTML=richText(last);
const timer=$('timer');if(state.status==='running'&&state.nextAdvanceAt){const sec=Math.max(0,Math.ceil((state.nextAdvanceAt-Date.now())/1000));timer.textContent=sec?'Next event in '+sec+'s':'Resolving…';}else timer.textContent='';
$('roster').innerHTML=(state.players||[]).map(p=>'<div class="player '+(p.alive?'':'dead')+'"><span>'+esc(p.displayName)+(p.simulated?'<span class="sim">BOT</span>':'')+'</span><span>'+(p.alive?'ALIVE':'OUT')+(p.eliminations?' · '+p.eliminations+' KO':'')+'</span></div>').join('')||'<div class="small">No players yet.</div>';
const vc=$('voteCard'),vg=$('voteGrid');if(state.crowdVote&&state.viewer.canVote){vc.style.display='block';vg.innerHTML=state.crowdVote.eligibleIds.map(id=>{const p=state.players.find(x=>x.id===id);const selected=state.crowdVote.selectedId===id;return '<button data-vote="'+esc(id)+'" class="'+(selected?'primary':'')+'">'+esc(p?.displayName||'Player')+'</button>'}).join('')}else{vc.style.display='none';vg.innerHTML=''}}
document.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a)act(a.dataset.action);const v=e.target.closest('[data-vote]');if(v)act('vote',{targetId:v.dataset.vote})});
async function refresh(){if(!initData){err('Open this Arena from Telegram.');$('status').textContent='TELEGRAM REQUIRED';return}try{state=await api('/telegram/api/state');err();render()}catch(e){err(e.message);$('status').textContent='CONNECTION ERROR'}}
refresh();setInterval(refresh,1500);setInterval(()=>{if(state)render()},500);
</script></body></html>`;
}
