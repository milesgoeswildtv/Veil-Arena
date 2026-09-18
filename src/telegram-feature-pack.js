export function applyTelegramFeaturePack(html) {
  if (typeof html !== "string" || !html) return html;

  const css = `<style id="veil-feature-pack-css">
.connection-chip{display:inline-flex;align-items:center;justify-content:center;flex:none;width:94px;gap:6px;margin-left:auto;margin-right:8px;padding:6px 7px;border:1px solid #49355e;border-radius:999px;background:#0a0710cc;color:#b8a9c3;font:850 8px/1 ui-monospace,monospace;letter-spacing:.08em;white-space:nowrap;overflow:hidden}.connection-dot{width:7px;height:7px;border-radius:50%;background:#e3b64d;box-shadow:0 0 8px #e3b64d88}.connection-chip.live .connection-dot{background:#55e2ae;box-shadow:0 0 8px #55e2ae99}.connection-chip.offline .connection-dot{background:#ef526f;box-shadow:0 0 8px #ef526f99}.feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.feature-card{border:1px solid #3f2b4c;border-radius:14px;background:linear-gradient(155deg,#120d18e8,#09070deb);padding:14px;min-width:0}.feature-card summary{cursor:pointer;list-style:none;color:#d9c5e8;font:950 10px/1.2 ui-monospace,monospace;letter-spacing:.14em}.feature-card summary::-webkit-details-marker{display:none}.feature-body{margin-top:12px;color:#b9acc4;font-size:12px;line-height:1.45}.feature-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #ffffff0b}.feature-row:last-child{border-bottom:0}.feature-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.feature-mini{appearance:none;border:1px solid #654676;border-radius:9px;background:#160e1d;color:#fff;padding:8px 10px;font-weight:900;font-size:11px}.feature-mini.primary{border-color:#a867e8;background:#472361}.feature-mini.danger{border-color:#8f2c3e;background:#341018}.feature-mini:disabled{opacity:.42}.final-five-strip{display:none;margin:0 0 12px;padding:10px 12px;border:1px solid #9b7338;border-radius:12px;background:linear-gradient(90deg,#2b1a0d,#1a0d22,#2b1a0d);color:#f2c968;text-align:center;font:1000 11px/1.2 ui-monospace,monospace;letter-spacing:.18em}.final-five-mode .final-five-strip{display:block}.final-five-mode .state-shell{box-shadow:0 26px 80px #000b,inset 0 0 0 1px #e3b64d44,0 0 34px #c58d3150}.history-entry{padding:8px 0;border-bottom:1px solid #ffffff0b}.history-entry:last-child{border-bottom:0}.reaction-bar{display:none;position:sticky;bottom:8px;z-index:40;margin-top:10px;padding:8px;border:1px solid #553866;border-radius:14px;background:#09060de8;backdrop-filter:blur(10px);grid-template-columns:repeat(6,1fr);gap:6px}.reaction-bar.show{display:grid}.reaction-label{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:1px 2px 3px;color:#c8b5d5;font:950 8px/1.2 ui-monospace,monospace;letter-spacing:.14em}.reaction-label span{color:#826f90;font-size:7px;letter-spacing:.08em}.reaction-button{border:1px solid #4b3559;border-radius:10px;background:#140d1a;color:#fff;font-size:21px;padding:8px}.reaction-layer{position:fixed;inset:0;pointer-events:none;z-index:998;overflow:hidden}.reaction-float{position:absolute;bottom:12%;font-size:30px;animation:reactionFloat 2.4s ease-out both;filter:drop-shadow(0 3px 8px #000)}@keyframes reactionFloat{0%{opacity:0;transform:translateY(30px) scale(.7)}15%{opacity:1}100%{opacity:0;transform:translateY(-58vh) translateX(var(--drift)) scale(1.25) rotate(var(--rot))}}.audio-range{width:100%;accent-color:#a45ee8}.diag-modal{display:none;position:fixed;inset:0;z-index:1200;background:#050308e8;padding:18px;place-items:center}.diag-modal.show{display:grid}.diag-box{width:min(560px,100%);max-height:80vh;overflow:auto;border:1px solid #6a477e;border-radius:18px;background:#0d0912;padding:18px}.diag-box pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#cbbfd6;font:12px/1.55 ui-monospace,monospace}.share-code{font:950 13px/1 ui-monospace,monospace;letter-spacing:.18em;color:#d8b7f2}.paused-mark{color:#f2c968!important}.hall-list{display:grid;gap:6px}.hall-item{display:flex;justify-content:space-between;gap:10px;padding:8px;border:1px solid #352642;border-radius:10px;background:#0b080f}.utility-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}@media(max-width:760px){.feature-grid{grid-template-columns:1fr}.connection-chip{margin-left:0}}
</style>`;

  const script = `<script id="veil-feature-pack-js">
(() => {
  const featureEsc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const featureButton = (label, action, cls = '', extra = '') => '<button type="button" class="feature-mini '+cls+'" data-feature-action="'+action+'" '+extra+'>'+featureEsc(label)+'</button>';
  const seenReactions = new Set();
  let hallLoaded = false;
  let lastConnectionAt = 0;

  function installFeatureDom(){
    if(document.getElementById('featureGrid')) return;
    const top = document.querySelector('.topline');
    if(top){
      const chip = document.createElement('div');
      chip.id='connectionChip'; chip.className='connection-chip';
      chip.innerHTML='<span class="connection-dot"></span><span id="connectionText">CONNECTING</span>';
      top.insertBefore(chip, document.getElementById('stateBadge'));
    }
    const content=document.querySelector('.state-content');
    if(content){
      content.insertAdjacentHTML('beforeend','<div class="feature-grid" id="featureGrid">'
        +'<details class="feature-card" id="historyPanel"><summary>EVENT HISTORY</summary><div class="feature-body" id="historyList"></div></details>'
        +'<details class="feature-card" id="audioPanel"><summary>AUDIO CONTROL</summary><div class="feature-body"><div class="feature-row"><span>Music</span><button class="feature-mini" id="musicToggle">ON</button></div><div class="feature-row"><span>SFX</span><button class="feature-mini" id="sfxToggle">ON</button></div><div class="feature-row" style="display:block"><div style="margin-bottom:7px">Master volume</div><input class="audio-range" id="audioVolume" type="range" min="0" max="100" step="5" value="100"></div></div></details>'
        +'<details class="feature-card" id="hallPanel"><summary>HALL OF DEGENS</summary><div class="feature-body" id="hallBody">Open to load Arena history.</div></details>'
        +'<section class="feature-card"><div style="font:950 10px ui-monospace,monospace;letter-spacing:.14em;color:#d9c5e8">ARENA ACCESS</div><div class="feature-body"><div class="feature-row"><span>Game code</span><span class="share-code" id="arenaCode">--------</span></div><div class="utility-row"><button class="feature-mini" data-feature-action="share">SHARE ARENA</button><button class="feature-mini" data-feature-action="reload">RELOAD ARENA</button></div></div></section>'
        +'</div><div class="reaction-bar" id="reactionBar"><div class="reaction-label">SPECTATOR REACTIONS <span>SHOWDOWN VOTING OPENS HERE</span></div>'+['💀','🔥','😂','😈','👀','💜'].map(x=>'<button class="reaction-button" data-reaction="'+x+'">'+x+'</button>').join('')+'</div>');
    }
    document.body.insertAdjacentHTML('beforeend','<div class="reaction-layer" id="reactionLayer"></div><div class="diag-modal" id="diagModal"><div class="diag-box"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><strong>HOST DIAGNOSTICS</strong><button class="feature-mini" id="diagClose">CLOSE</button></div><pre id="diagText"></pre></div></div>');
    wireAudioControls();
    wireHall();
    wireDiagnostics();
  }

  function setConnection(mode){
    const chip=document.getElementById('connectionChip'); const text=document.getElementById('connectionText');
    if(!chip||!text)return;
    chip.className='connection-chip '+(mode==='live'?'live':mode==='offline'?'offline':'');
    text.textContent=mode==='live'?'LIVE':mode==='offline'?'OFFLINE':'SYNCING';
    if(mode==='live') lastConnectionAt=Date.now();
  }

  const originalApi = api;
  api = async function featureApi(path, body){
    try{
      const result=await originalApi(path,body);
      setConnection('live');
      return result;
    }catch(error){
      setConnection(navigator.onLine===false?'offline':'syncing');
      throw error;
    }
  };
  window.addEventListener('offline',()=>setConnection('offline'));
  window.addEventListener('online',()=>setConnection('syncing'));
  setInterval(()=>{if(!document.hidden&&lastConnectionAt&&Date.now()-lastConnectionAt>10000)setConnection(navigator.onLine===false?'offline':'syncing')},2000);

  function audioSettings(){
    return {
      music: localStorage.getItem('veil.music.enabled')!=='0',
      sfx: localStorage.getItem('veil.sfx.enabled')!=='0',
      volume: Math.max(0,Math.min(1,Number(localStorage.getItem('veil.audio.volume')||'1')))
    };
  }
  function pushAudioSettings(){ window.dispatchEvent(new CustomEvent('veil-audio-settings',{detail:audioSettings()})); }
  function wireAudioControls(){
    const music=document.getElementById('musicToggle'),sfx=document.getElementById('sfxToggle'),volume=document.getElementById('audioVolume');
    if(!music||!sfx||!volume)return;
    const paint=()=>{const a=audioSettings();music.textContent=a.music?'ON':'OFF';sfx.textContent=a.sfx?'ON':'OFF';volume.value=String(Math.round(a.volume*100));};
    music.addEventListener('click',()=>{const a=audioSettings();localStorage.setItem('veil.music.enabled',a.music?'0':'1');paint();pushAudioSettings()});
    sfx.addEventListener('click',()=>{const a=audioSettings();localStorage.setItem('veil.sfx.enabled',a.sfx?'0':'1');paint();pushAudioSettings()});
    volume.addEventListener('input',()=>{localStorage.setItem('veil.audio.volume',String(Number(volume.value)/100));pushAudioSettings()});
    paint(); setTimeout(pushAudioSettings,0);
  }

  function wireHall(){
    const panel=document.getElementById('hallPanel'); if(!panel)return;
    panel.addEventListener('toggle',async()=>{
      if(!panel.open||hallLoaded)return;
      const body=document.getElementById('hallBody'); body.textContent='Loading…';
      try{
        const data=await api('/telegram/api/hall'); hallLoaded=true;
        const recent=(data.recentWinners||[]).map(row=>'<div class="hall-item"><span>'+featureEsc(row.display_name)+'</span><span>R'+Number(row.rounds||0)+'</span></div>').join('')||'<div class="empty">No winners recorded yet.</div>';
        const legends=(data.legends||[]).map(row=>'<div class="hall-item"><span>'+featureEsc(row.display_name)+'</span><span>'+Number(row.wins||0)+' W · '+Number(row.total_kills||0)+' KO</span></div>').join('')||'<div class="empty">No lifetime records yet.</div>';
        body.innerHTML='<strong>RECENT WINNERS</strong><div class="hall-list" style="margin:8px 0 14px">'+recent+'</div><strong>HALL RECORDS</strong><div class="hall-list" style="margin-top:8px">'+legends+'</div>';
      }catch(error){body.textContent=error.message}
    });
  }

  function wireDiagnostics(){
    const crest=document.querySelector('.crest'); if(!crest)return;
    let timer=null;
    const clear=()=>{if(timer){clearTimeout(timer);timer=null}};
    crest.addEventListener('pointerdown',()=>{if(!state?.viewer?.isHost)return;clear();timer=setTimeout(()=>{renderDiagnostics();document.getElementById('diagModal')?.classList.add('show')},2000)});
    ['pointerup','pointercancel','pointerleave'].forEach(name=>crest.addEventListener(name,clear));
    document.getElementById('diagClose')?.addEventListener('click',()=>document.getElementById('diagModal')?.classList.remove('show'));
    document.getElementById('diagModal')?.addEventListener('click',e=>{if(e.target.id==='diagModal')e.currentTarget.classList.remove('show')});
  }
  function renderDiagnostics(){
    const target=document.getElementById('diagText'); if(!target||!state?.viewer?.isHost)return;
    target.textContent=JSON.stringify({...state.diagnostics,serverTime:new Date(state.serverTime||Date.now()).toISOString(),connection:lastConnectionAt?new Date(lastConnectionAt).toISOString():null},null,2);
  }

  function renderHistory(){
    const target=document.getElementById('historyList'); if(!target)return;
    const rows=(state?.displayLog||[]).slice().reverse();
    target.innerHTML=rows.length?rows.map(row=>'<div class="history-entry">'+richText(row?.text||'')+'</div>').join(''):'<div class="empty">No events recorded yet.</div>';
  }


  function renderReactions(){
    const bar=document.getElementById('reactionBar'); if(bar)bar.classList.toggle('show',Boolean(state?.status==='running'&&!state?.viewer?.alive));
    const layer=document.getElementById('reactionLayer'); if(!layer)return;
    for(const reaction of state?.reactions||[]){
      const key=String(reaction.user_id)+'|'+String(reaction.created_at); if(seenReactions.has(key))continue; seenReactions.add(key);
      const node=document.createElement('div'); node.className='reaction-float'; node.textContent=reaction.emoji; node.style.left=(8+Math.random()*84)+'%'; node.style.setProperty('--drift',(-60+Math.random()*120)+'px'); node.style.setProperty('--rot',(-25+Math.random()*50)+'deg'); layer.appendChild(node); setTimeout(()=>node.remove(),2600);
    }
    if(seenReactions.size>200){const keep=[...seenReactions].slice(-80);seenReactions.clear();keep.forEach(x=>seenReactions.add(x))}
  }

  function appendMainControls(){
    const controls=document.getElementById('controls'); if(!controls||!state)return;
    const join=controls.querySelector('[data-action="join"]');
    if(join&&state.registrationLocked&&!state.viewer.joined){join.disabled=true;join.textContent='REGISTRATION LOCKED'}
    else if(join&&state.viewer.rematchEligible){join.textContent='REJOIN REMATCH'}

    if(state.status==='registration'&&state.viewer.joined&&!state.viewer.isHost){
      controls.insertAdjacentHTML('beforeend',featureButton(state.viewer.ready?'NOT READY':'READY',state.viewer.ready?'unready':'ready',state.viewer.ready?'':'primary'));
    }
  }

  function renderFeaturePack(){
    installFeatureDom(); if(!state)return;
    document.body.classList.toggle('final-five-mode',state.status==='running'&&Number(state.aliveCount)<=5&&Number(state.aliveCount)>1);
    document.getElementById('arenaCode').textContent=state.arenaCode||'--------';
    appendMainControls(); renderHistory(); renderReactions(); renderDiagnostics();
    const status=document.getElementById('status'); if(status&&state.paused){status.textContent='Arena paused by host';status.classList.add('paused-mark')}else status?.classList.remove('paused-mark');
    const timer=document.getElementById('timer'); const timerRow=document.getElementById('timerRow'); if(state.paused&&timer&&timerRow){timer.textContent='PAUSED';timerRow.style.display='flex'}
  }

  function renderPausedTimer(){
    if(!state?.paused)return;
    const timer=document.getElementById('timer');
    const row=document.getElementById('timerRow');
    if(timer&&row){timer.textContent='PAUSED';row.style.display='flex'}
  }

  installFeatureDom();
  registerRenderHook(renderFeaturePack);
  registerTimerHook(renderPausedTimer);

  document.addEventListener('click',async event=>{
    const feature=event.target.closest('[data-feature-action]');
    if(feature){
      const action=feature.dataset.featureAction;
      if(action==='reload'){await refresh({quiet:false});return}
      if(action==='share'){
        try{const data=await api('/telegram/api/share');const text='Veil Arena '+data.arenaCode;if(tg?.openTelegramLink){tg.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(data.url)+'&text='+encodeURIComponent(text))}else if(navigator.share){await navigator.share({title:'Veil Arena',text,url:data.url})}else{await navigator.clipboard.writeText(data.url);err('Arena link copied.') }}catch(error){err(error.message)}return;
      }
      if(action==='pause'&&!confirm('Pause Arena and freeze the current timer?'))return;
      if(action==='remove'&&!confirm('Remove this player from registration?'))return;
      await act(action,action==='remove'?{targetId:feature.dataset.targetId}:{}); return;
    }
    const reaction=event.target.closest('[data-reaction]'); if(reaction){await act('reaction',{emoji:reaction.dataset.reaction});return}
  });

  document.addEventListener('click',event=>{
    const force=event.target.closest('[data-action="forceclose"]');
    if(force){event.preventDefault();event.stopImmediatePropagation();if(confirm('Force-close this Arena? This ends the current match immediately.'))act('forceclose')}
  },true);

  if(state)renderFeaturePack();
})();
</script>`;

  let out = html;
  if (!out.includes('veil-feature-pack-css')) out = out.replace('</head>', css + '\n</head>');
  if (!out.includes('veil-feature-pack-js')) out = out.replace('</body>', script + '\n</body>');
  return out;
}
