export function applyTelegramProductPass(html) {
  if (typeof html !== "string" || !html || html.includes("veil-product-pass-js")) return html;

  const css = `<style id="veil-product-pass-css">
.results-stage{overflow-anchor:none}
.product-loading{display:flex;align-items:center;justify-content:center;gap:9px;margin:0 0 12px;padding:10px 13px;border:1px solid #4a3458;border-radius:12px;background:#0b0711;color:#bcaec7;font:900 9px/1.2 ui-monospace,monospace;letter-spacing:.14em}.product-loading.ready{display:none}.product-loading-dot{width:8px;height:8px;border-radius:50%;background:#c45cff;box-shadow:0 0 12px #c45cffaa;animation:productPulse 1s ease-in-out infinite alternate}
@keyframes productPulse{to{opacity:.35;transform:scale(.72)}}
body:is([data-arena-phase="registration"],[data-arena-phase="running"])[data-arena-view="arena"] .topline #hostTrigger.show{
  position:absolute;
  z-index:20;
  left:0;
  bottom:0;
  display:block;
  width:104px;
  min-width:104px;
  min-height:30px;
  margin:0;
  padding:0 8px;
  border-radius:10px;
  font-size:8px;
  letter-spacing:.08em;
  white-space:nowrap;
}
body:is([data-arena-phase="registration"],[data-arena-phase="running"]):not([data-arena-view="arena"]) .topline #hostTrigger{display:none}
.results-stage{display:none}.results-stage.show{display:block}\nbody:not([data-arena-view="arena"]) .results-stage{display:none}
body[data-arena-phase="finished"][data-arena-view="arena"] .main-grid,
body[data-arena-phase="finished"][data-arena-view="arena"] .roster-panel,
body[data-arena-phase="finished"][data-arena-view="arena"] .viewer-state-card,
body[data-arena-phase="finished"][data-arena-view="arena"] .footer-row{display:none}
.results-hero{position:relative;overflow:hidden;padding:26px 22px;border:1px solid #71582e;border-radius:20px;background:radial-gradient(circle at 50% 0,#f2c9681d,transparent 45%),linear-gradient(155deg,#15100d,#0a0710);text-align:center;box-shadow:0 20px 44px #0008}.results-kicker{color:#e4bd61;font:950 9px/1 ui-monospace,monospace;letter-spacing:.23em}.results-name{margin:10px 0 7px;font-size:clamp(35px,9vw,64px);line-height:.88;font-weight:1000;letter-spacing:-.045em;text-shadow:0 0 28px #f2c96828}.results-sub{color:#b7a7c0;font:850 10px/1.4 ui-monospace,monospace;letter-spacing:.11em}.results-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px}.results-stat{padding:11px 8px;border:1px solid #4b3654;border-radius:12px;background:#0b080ec9}.results-stat span{display:block;color:#8f8298;font:850 8px/1.2 ui-monospace,monospace;letter-spacing:.1em}.results-stat strong{display:block;margin-top:6px;font-size:19px}.results-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.result-card{padding:14px;border:1px solid #402d4b;border-radius:14px;background:linear-gradient(145deg,#110c16,#09070d)}.result-card-label{color:#9e8faa;font:900 8px/1.2 ui-monospace,monospace;letter-spacing:.13em}.result-card-value{margin-top:7px;font-size:15px;font-weight:1000;line-height:1.25}.result-card-note{margin-top:5px;color:#887b90;font-size:10px;line-height:1.4}.result-card.wide{grid-column:1/-1}.result-prize-list{display:grid;gap:7px;margin-top:9px}.result-prize{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid #392846;border-radius:10px;background:#09070d}.result-prize strong{font-size:11px}.result-prize span{display:block;margin-top:3px;color:#94869d;font-size:9px}.result-prize-amount{white-space:nowrap;color:#d6a3f8;font:950 11px/1.2 ui-monospace,monospace}.results-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.results-actions .wide-action{grid-column:1/-1}
.host-trigger{display:none;width:100%;margin-top:5px;min-height:36px;border:1px solid #68437a;border-radius:11px;background:#120b18;color:#dcc8e8;font:950 10px/1 ui-monospace,monospace;letter-spacing:.09em}.host-trigger.show{display:block}.host-drawer{display:none;position:fixed;inset:0;z-index:4900;background:#050308dc;padding:16px;place-items:end center}.host-drawer.show{display:grid}.host-drawer-sheet{width:min(620px,100%);max-height:84vh;overflow:auto;padding:17px;border:1px solid #67457a;border-radius:20px 20px 14px 14px;background:linear-gradient(160deg,#130c19,#09070d);box-shadow:0 -24px 60px #0009}.drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.drawer-title{font:1000 13px/1 ui-monospace,monospace;letter-spacing:.12em}.drawer-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}.drawer-player-list{display:grid;gap:7px;margin-top:14px}.drawer-player{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border:1px solid #392747;border-radius:10px;background:#0b080f}.drawer-player-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:850}
.player-sheet{display:none;position:fixed;inset:0;z-index:4800;background:#050308dc;padding:16px;place-items:end center}.player-sheet.show{display:grid}.player-sheet-card{width:min(520px,100%);padding:17px;border:1px solid #67457a;border-radius:20px 20px 14px 14px;background:linear-gradient(160deg,#130c19,#09070d);box-shadow:0 -24px 60px #0009}.player-sheet-name{font-size:25px;font-weight:1000;line-height:1}.player-sheet-state{margin-top:6px;color:#bcaac8;font:900 9px/1.2 ui-monospace,monospace;letter-spacing:.13em}.player-sheet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:14px}.player-sheet-stat{padding:10px 7px;border:1px solid #3d2b48;border-radius:10px;background:#0a0710;text-align:center}.player-sheet-stat span{display:block;color:#8e8198;font:850 7px/1.2 ui-monospace,monospace;letter-spacing:.1em}.player-sheet-stat strong{display:block;margin-top:5px;font-size:17px}
.more-intro{display:none;margin:0 0 13px;padding:18px;border:1px solid #493257;border-radius:15px;background:linear-gradient(145deg,#120c18,#09070d)}body[data-arena-view="more"] .more-intro{display:block}.more-intro h2{margin:0;font-size:25px}.more-intro p{margin:7px 0 0;color:#96889f;font-size:11px;line-height:1.45}.feature-grid.product-more{grid-template-columns:1fr;gap:9px}.feature-grid.product-more .feature-card{padding:0;overflow:hidden}.feature-grid.product-more .feature-card summary{padding:15px}.feature-grid.product-more .feature-card .feature-body{margin:0;padding:0 15px 15px}.feature-grid.product-more .feature-card:not(details){padding:15px}.feature-grid.product-more .more-rules-card{display:block;margin:0;padding:15px;border:1px solid #3f2b4c;border-radius:14px;background:linear-gradient(155deg,#120d18e8,#09070deb);color:#b9acc4}.feature-grid.product-more .more-rules-card .rules{max-width:none}.feature-grid.product-more .more-rules-card .rules summary{justify-content:flex-start;color:#d9c5e8;font:950 10px/1.2 ui-monospace,monospace;letter-spacing:.14em}.history-entry.product-history{position:relative;padding:10px 0 10px 30px}.history-entry.product-history:before{content:"";position:absolute;left:9px;top:17px;width:7px;height:7px;border-radius:50%;background:#8455a2;box-shadow:0 0 10px #8455a266}.history-entry.product-history[data-kind="elimination"]:before{background:#d54f69}.history-entry.product-history[data-kind="revival"]:before{background:#4ddba8}.history-entry.product-history[data-kind="showdown"]:before{background:#c777ff}.history-entry.product-history[data-kind="winner"]:before{background:#f2c968}
#roster .player{cursor:pointer;-webkit-tap-highlight-color:transparent}#roster .player:active{transform:scale(.992)}
.connection-chip.offline,.connection-chip:not(.live){border-color:#6a4b2d}
body.arena-network-offline .product-loading{display:flex;border-color:#8f2c3e;color:#ffd5dd}body.arena-network-offline .product-loading-dot{background:#ef526f;box-shadow:0 0 12px #ef526f88}
@media(max-width:760px){.results-grid{grid-template-columns:1fr}.result-card.wide{grid-column:auto}.results-actions{grid-template-columns:1fr}.results-actions .wide-action{grid-column:auto}.drawer-actions{grid-template-columns:1fr}.results-hero{padding:22px 16px}}
@media(max-width:440px){body:is([data-arena-phase="registration"],[data-arena-phase="running"])[data-arena-view="arena"] .topline #hostTrigger.show{left:0;bottom:0;width:96px;min-width:96px;min-height:30px;padding:0 7px;font-size:7px}.results-stats{gap:5px}.results-stat{padding:9px 5px}.results-stat strong{font-size:16px}.player-sheet-grid{gap:5px}.player-sheet-stat{padding:9px 5px}.player-sheet-stat strong{font-size:15px}}
@media(prefers-reduced-motion:reduce){.product-loading-dot{animation:none}}
</style>`;

  const script = `<script id="veil-product-pass-js">
(() => {
  const q=id=>document.getElementById(id);
  const pEsc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastResultsKey='';

  function installProductDom(){
    if(q('productLoading'))return;
    const nav=q('arenaNav');
    if(nav){
      nav.insertAdjacentHTML('afterend','<div class="product-loading" id="productLoading"><span class="product-loading-dot"></span><span id="productLoadingText">SYNCING ARENA</span></div><section class="results-stage" id="resultsStage"></section><section class="more-intro" id="moreIntro"><h2>MORE</h2><p>Arena history, Hall of Degens, audio, rules, sharing and utility controls.</p></section>');
    }
    document.body.insertAdjacentHTML('beforeend','<div class="host-drawer" id="hostDrawer"><div class="host-drawer-sheet"><div class="drawer-head"><div class="drawer-title">HOST CONTROL</div><button type="button" class="feature-mini" data-product-close-host>CLOSE</button></div><div id="hostDrawerBody"></div></div></div><div class="player-sheet" id="playerSheet"><div class="player-sheet-card"><div class="drawer-head"><div><div class="player-sheet-name" id="playerSheetName">PLAYER</div><div class="player-sheet-state" id="playerSheetState"></div></div><button type="button" class="feature-mini" data-product-close-player>CLOSE</button></div><div class="player-sheet-grid" id="playerSheetGrid"></div></div></div>');
    const controls=q('controls');
    if(controls&&!q('hostTrigger'))controls.insertAdjacentHTML('afterend','<button type="button" class="host-trigger" id="hostTrigger" data-product-host>⚙ HOST CONTROLS</button>');
    const grid=q('featureGrid');
    if(grid){
      grid.classList.add('product-more');
      const footer=document.querySelector('.footer-row');
      if(footer&&!grid.contains(footer)){footer.classList.add('more-rules-card');grid.prepend(footer)}
      const access=[...grid.children].find(el=>el.textContent.includes('ARENA ACCESS'));if(access)access.id='arenaAccessPanel';
      ['hallPanel','historyPanel','audioPanel','arenaAccessPanel'].forEach(id=>{const el=q(id);if(el)grid.appendChild(el)});
    }
  }

  function renderLoading(){
    const el=q('productLoading');if(!el)return;
    const offline=navigator.onLine===false;
    document.body.classList.toggle('arena-network-offline',offline);
    if(state&&!offline){el.classList.add('ready');return}
    el.classList.remove('ready');
    q('productLoadingText').textContent=offline?'CONNECTION LOST // RETRYING':'SYNCING ARENA';
  }

  function resultPrizeRows(){
    const prizes=state?.prizePool?.prizes||[];
    if(!prizes.length)return '<div class="result-card-note">No sponsored prizes in this Arena.</div>';
    return '<div class="result-prize-list">'+prizes.map(prize=>{
      const recipients=(prize.recipients||[]).map(x=>x.displayName).filter(Boolean).join(', ');
      const status=String(prize.status||'').replaceAll('_',' ').toUpperCase();
      return '<div class="result-prize"><div><strong>'+pEsc(prize.awardLabel||'Prize')+'</strong><span>'+(recipients?'→ '+pEsc(recipients)+' · ':'Sponsored by '+pEsc(prize.sponsorName||'Sponsor')+' · ')+pEsc(status)+'</span></div><div class="result-prize-amount">'+pEsc(prize.amount)+' '+pEsc(prize.currency)+'</div></div>';
    }).join('')+'</div>';
  }

  function renderResults(){
    const stage=q('resultsStage');if(!stage||!state)return;
    if(state.status!=='finished'||!state.recap){lastResultsKey='';stage.classList.remove('show');stage.innerHTML='';return}
    const resultsKey=JSON.stringify({
      id:state.id,status:state.status,recap:state.recap,
      prizes:(state.prizePool?.prizes||[]).map(p=>[p.id,p.status,p.amount,p.currency,p.fundedAmount,(p.recipients||[]).map(r=>[r.displayName,r.status,r.amount])]),
      host:Boolean(state.viewer?.isHost)
    });
    if(stage.classList.contains('show')&&resultsKey===lastResultsKey)return;
    lastResultsKey=resultsKey;
    const r=state.recap;
    const kills=r.killLeaders?.length?pEsc(r.killLeaders.join(', ')):'—';
    const revives=r.reviveLeaders?.length?pEsc(r.reviveLeaders.join(', ')):'—';
    const crowd=r.crowdSurvivors?.length?pEsc(r.crowdSurvivors.map(x=>x.displayName).join(', ')):'—';
    const host=Boolean(state.viewer?.isHost);
    stage.classList.add('show');
    stage.innerHTML='<section class="results-hero"><div class="results-kicker">ARENA CHAMPION</div><div class="results-name">'+pEsc(r.winnerName||'NO WINNER')+'</div><div class="results-sub">'+Number(r.playerCount||0)+' PLAYERS · '+Number(r.rounds||0)+' ROUNDS</div><div class="results-stats"><div class="results-stat"><span>PLAYERS</span><strong>'+Number(r.playerCount||0)+'</strong></div><div class="results-stat"><span>ROUNDS</span><strong>'+Number(r.rounds||0)+'</strong></div><div class="results-stat"><span>PRIZES</span><strong>'+Number(state.prizePool?.prizes?.length||0)+'</strong></div></div></section><div class="results-grid"><section class="result-card"><div class="result-card-label">MOST ELIMINATIONS</div><div class="result-card-value">'+kills+'</div><div class="result-card-note">'+Number(r.maxKills||0)+' elimination'+(Number(r.maxKills||0)===1?'':'s')+'</div></section><section class="result-card"><div class="result-card-label">MOST REVIVALS</div><div class="result-card-value">'+revives+'</div><div class="result-card-note">'+Number(r.maxRevives||0)+' revival'+(Number(r.maxRevives||0)===1?'':'s')+'</div></section><section class="result-card"><div class="result-card-label">SHOWDOWN SURVIVORS</div><div class="result-card-value">'+crowd+'</div><div class="result-card-note">Community pressure survived.</div></section><section class="result-card wide"><div class="result-card-label">SPONSORED AWARDS</div>'+resultPrizeRows()+'</section></div><div class="results-actions">'+(host?'<button type="button" class="veil-button primary" data-feature-action="rematch">REMATCH</button><button type="button" class="veil-button" data-action="newgame">NEW ARENA</button>':'')+'<button type="button" class="veil-button primary wide-action" data-product-share-results>SHARE RESULTS</button></div>';
  }

  function renderHostDrawer(){
    const trigger=q('hostTrigger');if(!trigger||!state)return;
    const hero=q('hero');
    const top=document.querySelector('.topline');
    const heading=document.querySelector('.arena-heading');
    const content=document.querySelector('.state-content');
    if(['registration','running'].includes(state.status)){
      if(content&&top&&heading&&heading.parentElement!==content)content.insertBefore(heading,top);
      if(top&&trigger.parentElement!==top)top.appendChild(trigger);
    }else{
      if(hero&&heading&&heading.parentElement!==hero)hero.insertBefore(heading,hero.firstChild);
      if(hero&&trigger.parentElement!==hero)hero.appendChild(trigger);
    }
    const host=Boolean(state.viewer?.isHost);
    trigger.classList.toggle('show',host&&['registration','running'].includes(state.status));
    if(!host)return;
    const body=q('hostDrawerBody');if(!body)return;
    let actions='';
    if(state.status==='registration')actions='<button class="feature-mini" data-feature-action="'+(state.registrationLocked?'unlock':'lock')+'">'+(state.registrationLocked?'UNLOCK REGISTRATION':'LOCK REGISTRATION')+'</button>';
    if(state.status==='running')actions='<button class="feature-mini '+(state.paused?'primary':'')+'" data-feature-action="'+(state.paused?'resume':'pause')+'">'+(state.paused?'RESUME ARENA':'PAUSE ARENA')+'</button><button class="feature-mini danger" data-action="forceclose">FORCE CLOSE</button>';
    const players=state.status==='registration'?(state.players||[]).filter(p=>String(p.id)!==String(state.hostId)):[];
    body.innerHTML='<div class="drawer-actions">'+actions+'</div>'+(players.length?'<div class="drawer-player-list">'+players.map(p=>'<div class="drawer-player"><div class="drawer-player-name">'+pEsc(p.displayName)+(p.ready?' · READY':' · WAITING')+'</div><button class="feature-mini danger" data-feature-action="remove" data-target-id="'+pEsc(p.id)+'">REMOVE</button></div>').join('')+'</div>':'');
  }

  function renderPlayerRows(){
    if(!state)return;
    document.querySelectorAll('#roster .player[data-player-id]').forEach(row=>{
      row.dataset.productPlayerId=row.dataset.playerId;
    });
  }

  function openPlayer(id){
    if(!state)return;
    const p=(state.players||[]).find(x=>String(x.id)===String(id));if(!p)return;
    q('playerSheetName').textContent=p.displayName||'Player';
    q('playerSheetState').textContent=(p.alive?'ALIVE':'OUT')+(state.status==='registration'?' · '+(p.ready?'READY':'WAITING'):'');
    q('playerSheetGrid').innerHTML='<div class="player-sheet-stat"><span>ELIMS</span><strong>'+Number(p.eliminations||0)+'</strong></div><div class="player-sheet-stat"><span>REVIVES</span><strong>'+Number(p.revivals||0)+'</strong></div><div class="player-sheet-stat"><span>SHOWDOWNS</span><strong>'+Number(p.crowdPinsSurvived||0)+'</strong></div>';
    q('playerSheet').classList.add('show');
  }

  function closePlayer(){q('playerSheet')?.classList.remove('show')}
  function openHost(){q('hostDrawer')?.classList.add('show')}
  function closeHost(){q('hostDrawer')?.classList.remove('show')}

  function renderHistoryKinds(){
    document.querySelectorAll('#historyList .history-entry').forEach(el=>{
      const t=String(el.textContent||'').toLowerCase();
      let kind='event';
      if(/eliminat|knocked|out\\b/.test(t))kind='elimination';
      else if(/reviv|returns|second chance/.test(t))kind='revival';
      else if(/showdown|chat chooses|crowd/.test(t))kind='showdown';
      else if(/wins the arena|champion/.test(t))kind='winner';
      el.classList.add('product-history');el.dataset.kind=kind;
    });
  }

  function renderProductPass(){
    installProductDom();if(!state){renderLoading();return}
    renderLoading();renderResults();renderHostDrawer();renderPlayerRows();renderHistoryKinds();
  }

  installProductDom();
  registerRenderHook(renderProductPass);
  window.addEventListener('offline',renderLoading);window.addEventListener('online',renderLoading);

  document.addEventListener('click',async event=>{
    const row=event.target.closest('#roster .player[data-product-player-id]');if(row){openPlayer(row.dataset.productPlayerId);return}
    if(event.target.closest('[data-product-close-player]')){closePlayer();return}
    if(event.target.id==='playerSheet'){closePlayer();return}
    if(event.target.closest('[data-product-host]')){openHost();return}
    if(event.target.closest('[data-product-close-host]')){closeHost();return}
    if(event.target.id==='hostDrawer'){closeHost();return}
    if(event.target.closest('[data-product-share-results]')){
      try{
        const data=await api('/telegram/api/share');
        const r=state?.recap||{};
        const text='Veil Arena Champion: '+String(r.winnerName||'No winner')+' · '+Number(r.playerCount||0)+' players · '+Number(r.rounds||0)+' rounds';
        if(tg?.openTelegramLink)tg.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(data.url)+'&text='+encodeURIComponent(text));
        else if(navigator.share)await navigator.share({title:'Veil Arena Results',text,url:data.url});
        else{await navigator.clipboard.writeText(text+' '+data.url);err('Results copied.')}
      }catch(error){err(error.message)}
      return;
    }
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const row=event.target.closest('#roster .player[data-product-player-id]');if(row){event.preventDefault();openPlayer(row.dataset.productPlayerId)}
  });

  if(state)renderProductPass();else renderLoading();
})();
</script>`;

  return html.replace("</head>", css + "\n</head>").replace("</body>", script + "\n</body>");
}
