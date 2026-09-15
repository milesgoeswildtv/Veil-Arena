export function applyTelegramPerformancePass(html) {
  if (typeof html !== "string" || !html) return html;
  let out = html;

  out = out.replace(
    "let state=null,busy=false,lastFxKey='',finalFiveSeen=false;",
    "let state=null,busy=false,lastFxKey='',finalFiveSeen=false,lastStateSignature='',refreshTimer=null,refreshing=false;"
  );

  out = out.replace(
`function acceptState(next){
  const prev=state;
  state=next;
  triggerEventFx(next,prev);
  render();
}`,
`function acceptState(next,force=false){
  const signature=JSON.stringify(next);
  if(!force&&signature===lastStateSignature){
    state=next;
    updateTimerOnly();
    return false;
  }
  const prev=state;
  state=next;
  lastStateSignature=signature;
  triggerEventFx(next,prev);
  render();
  return true;
}`
  );

  out = out.replace(
    "acceptState(await api('/telegram/api/action',{action,...extra}));",
    "acceptState(await api('/telegram/api/action',{action,...extra}),true);\n    scheduleRefresh();"
  );

  out = out.replace(
`async function refresh(){
  if(!initData){
    err('Open this Arena from Telegram.');
    $('status').textContent='Telegram is required';
    $('stateBadge').className='status-badge pending';
    $('stateBadge').textContent='TELEGRAM';
    $('viewerText').textContent='Launch Veil Arena from the button inside your Telegram group.';
    return;
  }
  try{
    const next=await api('/telegram/api/state');
    err();
    acceptState(next);
  }catch(e){
    err(e.message);
    $('status').textContent='Connection error';
    $('stateBadge').className='status-badge pending';
    $('stateBadge').textContent='ERROR';
  }
}

refresh();
setInterval(refresh,1500);
setInterval(()=>{if(state)render()},500);`,
`function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function updateTimerOnly(){
  if(!state)return;
  const timer=$('timer');
  const timerRow=$('timerRow');
  if(state.status==='running'&&state.nextAdvanceAt){
    const sec=Math.max(0,Math.ceil((state.nextAdvanceAt-Date.now())/1000));
    timer.textContent=sec?'Next event in '+sec+'s':'Resolving…';
    timerRow.style.display='flex';
  }else{
    timer.textContent='';
    timerRow.style.display='none';
  }
}

function pollDelay(){
  if(document.hidden)return 6000;
  return state&&['registration','running'].includes(state.status)?2000:4000;
}

function scheduleRefresh(delay=pollDelay()){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    await refresh();
    scheduleRefresh();
  },delay);
}

async function refresh({quiet=false}={}){
  if(!initData){
    err('Open this Arena from Telegram.');
    $('status').textContent='Telegram is required';
    $('stateBadge').className='status-badge pending';
    $('stateBadge').textContent='TELEGRAM';
    $('viewerText').textContent='Launch Veil Arena from the button inside your Telegram group.';
    return false;
  }
  if(refreshing)return true;
  refreshing=true;
  try{
    const next=await api('/telegram/api/state');
    err();
    acceptState(next);
    return true;
  }catch(e){
    if(!quiet){
      err(e.message);
      $('status').textContent='Connection error';
      $('stateBadge').className='status-badge pending';
      $('stateBadge').textContent='ERROR';
    }
    return false;
  }finally{
    refreshing=false;
  }
}

async function bootTelegram(){
  for(let attempt=1;attempt<=3;attempt++){
    const ok=await refresh({quiet:attempt<3});
    if(ok){scheduleRefresh();return}
    if(attempt<3)await sleep(650*attempt);
  }
  scheduleRefresh();
}

bootTelegram();
setInterval(updateTimerOnly,500);
document.addEventListener('visibilitychange',()=>scheduleRefresh(250));`
  );

  return out;
}
