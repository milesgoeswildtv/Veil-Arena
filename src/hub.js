import { validateTelegramInitData } from "./miniapp.js";
import { ensureSchema, loadGame, loadPlayerStats, loadArenaLeaderboard } from "./storage.js";
import { telegramUserInChat } from "./telegram.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function gameIdFromStartParam(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("arena_")) return null;
  const id = raw.slice(6);
  return /^[a-f0-9-]{20,64}$/i.test(id) ? id : null;
}

function personalStats(stats) {
  const games = Number(stats?.games_played || 0);
  const wins = Number(stats?.wins || 0);
  return {
    games,
    wins,
    losses: Math.max(0, games - wins),
    winRate: games ? Number(((wins / games) * 100).toFixed(1)) : 0,
    eliminations: Number(stats?.total_kills || 0),
    bestGame: Number(stats?.max_kills_single_game || 0),
    revivals: Number(stats?.total_revivals || 0),
    showdownSurvivals: Number(stats?.crowd_survivals || 0)
  };
}

async function authenticatedHubContext(request, env) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("DWallet Arena is not configured.");
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.chatType || !["group", "supergroup"].includes(auth.chatType)) {
    throw new Error("Open DWallet Arena from its Telegram group.");
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("game") || gameIdFromStartParam(auth.startParam);
  if (!requested) throw new Error("Missing Arena ID.");
  const launched = gameIdFromStartParam(auth.startParam);
  if (launched && launched !== requested) throw new Error("That Arena does not match this Telegram launch.");

  await ensureSchema(env.DB);
  const game = await loadGame(env.DB, requested);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") {
    throw new Error("That DWallet Arena no longer exists.");
  }
  if (game.telegramChatInstance && auth.chatInstance !== game.telegramChatInstance) {
    throw new Error("Open this Arena from its original DWallet group message.");
  }

  const member = await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN);
  if (!member) throw new Error("Only members of this Telegram group can view its Arena stats.");
  return { auth, game };
}

export async function handleMiniAppHub(request, env) {
  try {
    const { auth, game } = await authenticatedHubContext(request, env);
    const view = new URL(request.url).searchParams.get("view") || "stats";

    if (view === "stats") {
      const stats = await loadPlayerStats(env.DB, game.guildId, auth.user.id);
      return json({
        ok: true,
        viewer: { id: auth.user.id, displayName: auth.user.displayName },
        stats: personalStats(stats)
      });
    }

    if (view === "leaderboard") {
      const board = await loadArenaLeaderboard(env.DB, game.guildId, 5);
      return json({ ok: true, leaderboard: board });
    }

    return json({ ok: false, error: "Unknown Mini App hub view." }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 401);
  }
}

export function injectMiniAppHubHtml(html) {
  const nav = `<div id="arenaHubNav" class="arenaHubNav" role="tablist" aria-label="DWallet Arena sections">
    <button type="button" class="active" data-hub-tab="arena">ARENA</button>
    <button type="button" data-hub-tab="stats">STATS</button>
    <button type="button" data-hub-tab="leaderboard">LEADERS</button>
    <button type="button" data-hub-tab="rules">RULES</button>
  </div><div id="arenaHubPanel" class="arenaHubPanel" hidden></div>`;

  const css = `
.arenaHubNav{max-width:760px;margin:0 auto 10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;position:sticky;top:calc(4px + env(safe-area-inset-top));z-index:20;padding:6px;background:rgba(9,7,15,.96);border:1px solid var(--line);border-radius:15px;backdrop-filter:blur(12px)}
.arenaHubNav button{min-width:0;min-height:40px;padding:9px 5px;border-radius:10px;background:transparent;color:var(--muted);font-size:11px;letter-spacing:.04em}.arenaHubNav button.active{background:var(--purple);color:white}.arenaHubNav~.app .top{top:58px}.arenaHubPanel{max-width:760px;margin:0 auto}.hubHero{background:linear-gradient(135deg,#211433,#120d1d);border:1px solid var(--line);border-radius:20px;padding:18px;margin:10px 0}.hubEyebrow{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--purple2)}.hubBig{font-size:34px;font-weight:950;line-height:1.05;margin-top:7px}.hubGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hubMetric{background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:13px}.hubMetric b{display:block;font-size:23px}.hubMetric span{font-size:10px;font-weight:850;letter-spacing:.07em;color:var(--muted)}.hubRefresh{width:100%;margin:10px 0;background:#292038}.leaderCats{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.leaderCats::-webkit-scrollbar{display:none}.leaderCats button{white-space:nowrap;min-height:38px;padding:9px 11px;background:#241a33;color:var(--muted)}.leaderCats button.active{background:var(--purple);color:white}.leaderRow{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.leaderRow:first-child{border-top:0}.rank{font-size:18px;font-weight:950;color:var(--purple2)}.leaderValue{font-weight:950}.rulesCard{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:17px;padding:15px;margin:9px 0}.rulesCard h3{margin:0 0 7px}.rulesCard p{margin:0;color:var(--muted);line-height:1.45;font-size:14px}.hubLoading{text-align:center;color:var(--muted);padding:36px 12px}.hubError{background:#381624;border:1px solid #6e2944;border-radius:14px;padding:13px;color:#ffd2df;margin:10px 0}@media(max-width:390px){.arenaHubNav button{font-size:10px}.hubGrid{grid-template-columns:1fr 1fr}}
`;

  const script = `<script>
(()=>{
  const nav=document.getElementById('arenaHubNav');
  const panel=document.getElementById('arenaHubPanel');
  const arena=document.getElementById('app');
  if(!nav||!panel||!arena)return;
  const webApp=window.Telegram?.WebApp;
  const hubInitData=webApp?.initData||'';
  const unsafe=webApp?.initDataUnsafe||{};
  const params=new URLSearchParams(location.search);
  const startParam=unsafe.start_param||params.get('tgWebAppStartParam')||'';
  const hubGameId=startParam.startsWith('arena_')?startParam.slice(6):'';
  const cache={stats:null,leaderboard:null};
  let current='arena';
  let leaderCategory='wins';
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function hubApi(view){
    const r=await fetch('/telegram/miniapp/hub?game='+encodeURIComponent(hubGameId)+'&view='+encodeURIComponent(view),{headers:{'x-telegram-init-data':hubInitData}});
    const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));
    if(!j.ok)throw new Error(j.error||'Could not load '+view);
    return j;
  }

  function activateButton(tab){for(const b of nav.querySelectorAll('button'))b.classList.toggle('active',b.dataset.hubTab===tab)}
  function loading(){panel.innerHTML='<div class="hubLoading">Loading…</div>'}
  function fail(e){panel.innerHTML='<div class="hubError">'+escapeHtml(e.message||e)+'</div>'}

  function statsView(data){
    const s=data.stats||{};
    panel.innerHTML='<div class="hubHero"><div class="hubEyebrow">YOUR DWALLET ARENA RECORD</div><div class="hubBig">'+escapeHtml(data.viewer?.displayName||'PLAYER')+'</div><div class="muted" style="margin-top:6px">Stats for this Telegram group only.</div></div>'+
      '<div class="hubGrid">'+
      metric(s.games,'ARENAS PLAYED')+metric(s.wins,'WINS')+metric(s.losses,'LOSSES')+metric((s.winRate||0)+'%','WIN RATE')+
      metric(s.eliminations,'ELIMINATIONS')+metric(s.bestGame,'BEST SINGLE GAME')+metric(s.revivals,'REVIVALS')+metric(s.showdownSurvivals,'SHOWDOWNS SURVIVED')+
      '</div><button type="button" class="hubRefresh" id="hubRefreshStats">REFRESH STATS</button>';
    document.getElementById('hubRefreshStats')?.addEventListener('click',()=>loadStats(true));
  }
  function metric(value,label){return '<div class="hubMetric"><b>'+escapeHtml(value??0)+'</b><span>'+escapeHtml(label)+'</span></div>'}

  const categories={
    gamesPlayed:['⚔️ ARENAS PLAYED','gamesPlayed',r=>r.value],
    wins:['👑 WINS','wins',r=>r.value],
    winRate:['📈 WIN RATE','winRate',r=>Number(r.value||0).toFixed(1)+'%'],
    kills:['💀 ELIMINATIONS','kills',r=>r.value],
    singleGameKills:['🔥 BEST GAME','singleGameKills',r=>r.value],
    revivals:['🕯️ REVIVALS','revivals',r=>r.value],
    crowdSurvivals:['👁️ SHOWDOWNS','crowdSurvivals',r=>r.value]
  };
  function renderLeaderboard(){
    const board=cache.leaderboard?.leaderboard||{};
    const [title,key,format]=categories[leaderCategory];
    let buttons='';for(const [id,[label]] of Object.entries(categories))buttons+='<button type="button" data-leader-cat="'+id+'" class="'+(id===leaderCategory?'active':'')+'">'+escapeHtml(label)+'</button>';
    const rows=board[key]||[];
    let list=rows.length?'':'<div class="empty">No records in this category yet.</div>';
    rows.forEach((r,i)=>{list+='<div class="leaderRow"><div class="rank">#'+(i+1)+'</div><div><div class="name">'+escapeHtml(r.display_name||'Unknown')+'</div>'+(leaderCategory==='winRate'?'<div class="muted" style="font-size:11px">'+Number(r.wins||0)+' wins • '+Number(r.games_played||0)+' games</div>':'')+'</div><div class="leaderValue">'+escapeHtml(format(r))+'</div></div>'});
    panel.innerHTML='<div class="hubHero"><div class="hubEyebrow">DWALLET ARENA</div><div class="hubBig">LEADERBOARD</div><div class="muted" style="margin-top:6px">Top 5 in this Telegram group. Win rate requires 3 Arenas.</div></div><div class="leaderCats">'+buttons+'</div><div class="card"><h3>'+escapeHtml(title)+'</h3>'+list+'</div><button type="button" class="hubRefresh" id="hubRefreshBoard">REFRESH LEADERBOARD</button>';
    panel.querySelectorAll('[data-leader-cat]').forEach(b=>b.addEventListener('click',()=>{leaderCategory=b.dataset.leaderCat;renderLeaderboard()}));
    document.getElementById('hubRefreshBoard')?.addEventListener('click',()=>loadLeaderboard(true));
  }

  function rulesView(){
    panel.innerHTML='<div class="hubHero"><div class="hubEyebrow">DWALLET ARENA</div><div class="hubBig">RULES</div><div class="muted" style="margin-top:6px">The quick version. The full rules graphic can sit here too once it is uploaded.</div></div>'+
      rule('⚔️ NORMAL ROUNDS','4 events every normal round, with at least 1 elimination guaranteed.')+
      rule('💥 MASS BRAWL','A rare full-round event pulling 4–7 players into one fight. Multiple eliminations can happen.')+
      rule('🕯️ SECOND CHANCE','Every 7th round while specials are active, two eliminated players fight. One returns.')+
      rule('👁️ COMMUNITY SHOWDOWN','Every 5th round while specials are active, spectators and eliminated players get 30 seconds to vote. The top two enter a 1v1; only the loser is eliminated.')+
      rule('👑 FINAL FIVE','Special rounds shut off once five players remain.')+
      rule('⏳ COOLDOWN','After a completed Arena, this Telegram group waits 30 minutes before another can open.');
  }
  function rule(title,text){return '<div class="rulesCard"><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(text)+'</p></div>'}

  async function loadStats(force=false){if(!force&&cache.stats){statsView(cache.stats);return}loading();try{cache.stats=await hubApi('stats');statsView(cache.stats)}catch(e){fail(e)}}
  async function loadLeaderboard(force=false){if(!force&&cache.leaderboard){renderLeaderboard();return}loading();try{cache.leaderboard=await hubApi('leaderboard');renderLeaderboard()}catch(e){fail(e)}}

  async function setTab(tab){
    current=tab;activateButton(tab);
    if(tab==='arena'){panel.hidden=true;arena.hidden=false;return}
    arena.hidden=true;panel.hidden=false;
    if(tab==='stats')await loadStats(false);
    else if(tab==='leaderboard')await loadLeaderboard(false);
    else if(tab==='rules')rulesView();
  }
  nav.querySelectorAll('[data-hub-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.hubTab)));
})();
</script>`;

  return String(html)
    .replace("</style>", `${css}</style>`)
    .replace('<div id="app" class="app">', `${nav}<div id="app" class="app">`)
    .replace("</body>", `${script}</body>`);
}
