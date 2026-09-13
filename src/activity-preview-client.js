export const ACTIVITY_PREVIEW_CLIENT = String.raw`(() => {
  const shell = document.getElementById('shell');
  const stage = document.getElementById('stage');
  const arena = document.getElementById('arena');
  const overlay = document.getElementById('overlay');
  const locationEl = document.getElementById('location');
  const sys = document.getElementById('sys');
  const hapticEl = document.getElementById('haptic');
  const toast = document.getElementById('toast');
  const names = ['SAM','CREK','PEACH','KASS','RUBY','ZERO','WRAITH','MIA','JAX'];
  let timers = [];
  let voteTimer = null;
  let sequence = false;
  let sequenceTimer = null;

  const fail = message => {
    if (sys) sys.textContent = 'CONTROLS FAILED';
    if (toast) {
      toast.textContent = 'ACTIVITY ERROR // ' + String(message || 'UNKNOWN');
      toast.classList.add('show');
    }
  };
  window.addEventListener('error', event => fail(event?.message));
  window.addEventListener('unhandledrejection', event => fail(event?.reason?.message || event?.reason));

  if (!shell || !stage || !arena || !overlay || !locationEl || !sys || !hapticEl || !toast) {
    fail('MISSING ACTIVITY DOM');
    return;
  }

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  function clearFx(){
    timers.forEach(clearTimeout); timers = [];
    if (voteTimer) clearInterval(voteTimer); voteTimer = null;
    shell.classList.remove('lockdown','glitching','finalfive');
    overlay.classList.remove('show'); overlay.innerHTML = '';
    locationEl.textContent = 'LOCATION // DWALLET HQ';
    hapticEl.textContent = 'IDLE';
  }
  function stopSequence(){
    sequence = false;
    if (sequenceTimer) clearTimeout(sequenceTimer);
    sequenceTimer = null;
  }
  function haptic(type){ hapticEl.textContent = type.toUpperCase(); flash('TELEGRAM HAPTIC // ' + type.toUpperCase()); }
  function flash(text){ toast.textContent = text; toast.classList.add('show'); later(() => toast.classList.remove('show'), 900); }
  function roster(active = names.slice(0,8), out = []){
    return '<div class="roster">' + active.map(n => '<div class="fighter '+(out.includes(n)?'out':'')+'"><span>'+n+'</span><span>'+(out.includes(n)?'OUT':'ACTIVE')+'</span></div>').join('') + '</div>';
  }
  function normal(){
    clearFx();
    sys.textContent='CONTROLS ONLINE // SYSTEM NOMINAL';
    arena.innerHTML = '<div class="normalCard"><div class="round">ROUND 4 // DWALLET HQ</div><div class="headline">THE ARENA IS LIVE</div><div class="copy">Baseline presentation. Feature rounds temporarily take over this screen, then return here.</div>'+roster(names.slice(0,8),['JAX'])+'</div>';
  }
  function panel(kicker,title,sub,body=''){
    overlay.innerHTML = '<div class="fxPanel"><div class="fxKicker">'+kicker+'</div><div class="fxTitle">'+title+'</div><div class="fxSub">'+sub+'</div>'+body+'</div>';
    overlay.classList.add('show');
  }
  function brawl(){
    clearFx(); shell.classList.add('lockdown'); locationEl.textContent='LOCATION // HQ LOCKDOWN'; sys.textContent='SECURITY OVERRIDE'; haptic('heavy');
    panel('⚠ DWALLET HQ SECURITY OVERRIDE','MASS BRAWL','Six players have been dragged into the same problem.','<div class="chips"><span class="chip">SAM</span><span class="chip">CREK</span><span class="chip">PEACH</span><span class="chip">KASS</span><span class="chip">RUBY</span><span class="chip">ZERO</span></div>');
    later(()=>{ const chips=overlay.querySelector('.chips'); if(chips) chips.innerHTML='<span class="chip live">SAM</span><span class="chip dead">CREK</span><span class="chip live">PEACH</span><span class="chip dead">KASS</span><span class="chip live">RUBY</span><span class="chip dead">ZERO</span>'; haptic('heavy'); },1400);
    later(()=>panel('HQ LOCKDOWN // COMPLETE','3 SURVIVORS','The doors unlock. Barely.','<div class="chips"><span class="chip live">SAM</span><span class="chip live">PEACH</span><span class="chip live">RUBY</span></div>'),2600);
  }
  function vote(){
    clearFx(); locationEl.textContent='LOCATION // COMMUNITY FLOOR'; sys.textContent='THE CHAT HAS CONTROL'; haptic('warning');
    let left=30; const scores={SAM:2,CREK:5,PEACH:4,KASS:1};
    panel('👁 COMMUNITY OVERRIDE','THE CHAT CHOOSES','Spectators have control for 30 seconds.','<div class="voteWrap"><div class="ring" id="fxRing" style="--pct:100"><strong id="fxTime">30</strong></div><div class="bars" id="fxBars"></div></div>');
    const paint=()=>{const max=Math.max(...Object.values(scores),1);const bars=document.getElementById('fxBars');if(bars)bars.innerHTML=Object.entries(scores).map(([n,v])=>'<div class="barRow"><span>'+n+'</span><div class="bar"><i style="width:'+Math.round(v/max*100)+'%"></i></div><b>'+v+'</b></div>').join('');const time=document.getElementById('fxTime');if(time)time.textContent=left;const ring=document.getElementById('fxRing');if(ring)ring.style.setProperty('--pct',Math.round(left/30*100));};
    paint(); voteTimer=setInterval(()=>{left=Math.max(0,left-1);if(left%2===0){const keys=Object.keys(scores);scores[keys[Math.floor(Math.random()*keys.length)]]++;haptic('light');}paint();if(left<=0){clearInterval(voteTimer);voteTimer=null;showdown();}},1000);
  }
  function showdown(){
    clearFx(); locationEl.textContent='LOCATION // COMMUNITY SHOWDOWN'; sys.textContent='VOTE LOCKED'; haptic('warning');
    panel('VOTE LOCKED // TOP TWO','COMMUNITY SHOWDOWN','One survives. One gets deleted from the active roster.','<div class="vs"><div class="vsName">CREK</div><div class="vsBadge">VS</div><div class="vsName">PEACH</div></div>');
    later(()=>{panel('SHOWDOWN COMPLETE','PEACH SURVIVES','Crek has been eliminated.','<div class="chips"><span class="chip dead">CREK</span><span class="chip live">PEACH</span></div>');haptic('success');},1800);
  }
  function revival(){
    clearFx(); locationEl.textContent='LOCATION // RECOVERY BAY'; sys.textContent='RECOVERY PROTOCOL'; haptic('warning');
    panel('⚡ DWALLET HQ // RECOVERY PROTOCOL','SECOND CHANCE','Two eliminated players were selected. One record can be restored.','<div class="chips"><span class="chip dead">ZERO</span><span class="chip dead">WRAITH</span></div>');
    later(()=>{panel('RESTORE COMPLETE','ZERO // ACTIVE','Wraith remains eliminated.','<div class="chips restore"><span class="chip live">ZERO // STATUS: ACTIVE</span><span class="chip dead">WRAITH // RESTORE FAILED</span></div>');haptic('success');},1900);
  }
  function crek(){
    clearFx(); locationEl.textContent="LOCATION // CREK'S LAIR"; sys.textContent='MONITOR TAKEOVER'; haptic('medium');
    const monitors=Array.from({length:9},(_,i)=>'<div class="monitor '+([1,4,7].includes(i)?'hot':'')+'">FEED '+String(i+1).padStart(2,'0')+'<br>'+(i===4?'CREK ME UP':'TRACKING')+'</div>').join('');
    panel('🖥 DWALLET HQ SUBSYSTEM',"CREK'S LAIR",'All feeds have snapped onto the Arena.','<div class="monitorGrid">'+monitors+'</div>');
  }
  function peach(){
    clearFx(); locationEl.textContent="LOCATION // PEACH'S LAIR"; sys.textContent='UNAUTHORIZED BUTTON DETECTED'; haptic('warning');
    panel('🍑 PEACH HAS ENTERED THE CHAT','DO NOT PRESS','Nobody knows why this button is connected to anything.','<div id="peachButton" class="redButton"></div>');
    later(()=>{document.getElementById('peachButton')?.classList.add('pressed');sys.textContent='...HE PRESSED IT';haptic('heavy');},1600);
    later(()=>{shell.classList.add('glitching');flash('PEACH APPROVED // PROBABLY');},2200);
  }
  function glitch(){
    clearFx(); shell.classList.add('glitching'); locationEl.textContent='LOCATION // ???'; sys.textContent='PLAYER COUNT: 13'; haptic('warning');
    panel('📡 HQ FEED ANOMALY','SIGNAL CORRUPTED','The system is reporting information that should not exist.','<div class="chips"><span class="chip">SAM</span><span class="chip">SAM</span><span class="chip">UNKNOWN USER</span><span class="chip">PEACH?</span></div>');
    later(()=>{sys.textContent='OCCUPANCY +1 // SOURCE UNKNOWN';},900);
    later(()=>{sys.textContent='SYSTEM NOMINAL // NOTHING HAPPENED';shell.classList.remove('glitching');haptic('light');},2600);
  }
  function finalFive(){
    clearFx(); shell.classList.add('finalfive'); locationEl.textContent='LOCATION // FINAL FIVE'; sys.textContent='SPECIAL PROTOCOLS DISABLED'; haptic('heavy');
    panel('☠ DWALLET HQ // ENDGAME','FINAL FIVE','No revivals. No audience intervention. Nobody is coming to save you.','<div class="chips"><span class="chip live">SAM</span><span class="chip live">PEACH</span><span class="chip live">RUBY</span><span class="chip live">MIA</span><span class="chip live">CREK</span></div>');
  }
  const handlers={normal,brawl,vote,showdown,revival,crek,peach,glitch,final:finalFive};
  function fx(name){
    stopSequence();
    (handlers[name]||normal)();
  }
  function runAll(){
    stopSequence();
    sequence=true;
    const steps=[
      ['brawl',4300],
      ['vote',6500],
      ['showdown',3600],
      ['revival',3600],
      ['crek',3000],
      ['peach',3800],
      ['glitch',3600],
      ['final',5000]
    ];
    let index=0;
    const next=()=>{
      if(!sequence)return;
      const [name,duration]=steps[index++];
      (handlers[name]||normal)();
      if(index<steps.length) sequenceTimer=setTimeout(next,duration);
      else sequenceTimer=setTimeout(()=>{sequence=false;sequenceTimer=null;},duration);
    };
    next();
  }
  const controls=[...document.querySelectorAll('[data-fx]')];
  controls.forEach(btn=>btn.addEventListener('click',()=>btn.dataset.fx==='all'?runAll():fx(btn.dataset.fx)));
  if (!controls.length) {
    fail('NO ACTIVITY CONTROLS FOUND');
    return;
  }
  normal();
})();`;
