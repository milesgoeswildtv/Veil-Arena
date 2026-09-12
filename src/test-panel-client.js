export const TEST_PANEL_CLIENT = String.raw`(() => {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const unsafe = tg?.initDataUnsafe || {};
  const qs = new URLSearchParams(location.search);
  const start = unsafe.start_param || qs.get('tgWebAppStartParam') || '';
  const gameId = start.startsWith('arena_') ? start.slice(6) : '';
  const panel = document.getElementById('arenaTestPanel');
  if (!panel || !gameId || !initData) { if (panel) panel.hidden = true; return; }

  const summary = panel.querySelector('[data-test-summary]');
  const controls = panel.querySelector('[data-test-controls]');
  const hostOnly = panel.querySelector('[data-test-host-only]');
  let lastPreviewNonce = sessionStorage.getItem('arena-qa-preview:' + gameId) || '';
  let busy = false;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(method='GET', body=null){
    const r = await fetch('/telegram/miniapp/test?game=' + encodeURIComponent(gameId), {
      method,
      headers:{'content-type':'application/json','x-telegram-init-data':initData},
      ...(body ? {body:JSON.stringify({gameId,...body})} : {})
    });
    const j = await r.json().catch(()=>({ok:false,error:'Bad QA server response'}));
    if(!j.ok) throw new Error(j.error || 'QA request failed');
    return j;
  }

  function haptic(kind='medium'){
    try { tg?.HapticFeedback?.impactOccurred?.(kind); } catch {}
  }
  function notify(text){
    try { tg?.showAlert?.(String(text)); } catch {}
  }
  function sharedPreview(preview){
    if(!preview?.nonce || preview.nonce === lastPreviewNonce) return;
    lastPreviewNonce = preview.nonce;
    sessionStorage.setItem('arena-qa-preview:' + gameId, lastPreviewNonce);
    const fx = typeof window.showFx === 'function' ? window.showFx : null;
    if(preview.type === 'crek'){
      haptic('medium');
      fx?.("DWALLET HQ // CREK'S LAIR", 'MONITOR TAKEOVER', 'CREK ME UP // ALL FEEDS LOCKED', 'purple', 2200);
    } else if(preview.type === 'peach'){
      haptic('heavy');
      fx?.("DWALLET HQ // PEACH'S LAIR", 'DO NOT PRESS', 'PEACH CONTROL // RED BUTTON ARMED', 'danger', 2300);
      setTimeout(()=>{ try{ window.notification?.('warning'); }catch{} }, 400);
    } else if(preview.type === 'glitch'){
      document.body.classList.add('mode-glitch');
      try{ window.notification?.('warning'); }catch{ haptic('heavy'); }
      fx?.('DWALLET HQ // SYSTEM ANOMALY', 'SIGNAL CORRUPTED', 'VEIL REFUSES TO ELABORATE', 'danger', 1800);
      setTimeout(()=>document.body.classList.remove('mode-glitch'), 2200);
    } else if(preview.type === 'abort'){
      fx?.('DWALLET HQ // QA', 'TEST ABORTED', 'NO COOLDOWN // RUN /arena AGAIN', 'danger', 1800);
    }
  }

  function render(test){
    if(!test) return;
    summary.innerHTML = '<b>QA WORKER ACTIVE</b> · Round '+esc(test.round)+' · '+esc(test.aliveCount)+' alive · '+esc(test.playerCount)+' entered · '+esc(test.botCount)+' test bots'+(test.simulatedCrowd?' · synthetic crowd ON':'');
    sharedPreview(test.preview);
    hostOnly.hidden = !test.isHost;
    controls.innerHTML = '';
    if(!test.isHost){
      controls.innerHTML = '<div class="qaNote">Only the Arena host sees the force controls. You still receive every forced feature/effect on your screen.</div>';
      return;
    }
    const buttons = [];
    if(test.status === 'registration'){
      buttons.push(['add_bots','＋ 4 TEST BOTS','Add four engine-controlled contestants.','4']);
      buttons.push(['fill_12','FILL TO 12','Fill the roster to twelve after your humans have joined.']);
      buttons.push(['remove_bots','REMOVE TEST BOTS','Clear synthetic contestants before START.']);
    } else if(test.status === 'running'){
      buttons.push(['next_round','NEXT ROUND NOW','Wake the engine immediately.']);
      buttons.push(['mass_brawl','💥 MASS BRAWL','Force the real HQ Lockdown round.']);
      buttons.push(['community_showdown','👁 COMMUNITY SHOWDOWN','Force the real 30-second vote + synthetic crowd.']);
      buttons.push(['revival','⚡ SECOND CHANCE','Force a real revival round; QA bots seed eliminated players if needed.']);
      buttons.push(['preview_crek','🖥 CREK\'S LAIR','Send the monitor takeover to every tester.']);
      buttons.push(['preview_peach','🍑 PEACH BUTTON','Send the red-button takeover to every tester.']);
      buttons.push(['preview_glitch','📡 RARE GLITCH','Send the corrupted-HQ effect to every tester.']);
      buttons.push(['final_five','☠ FINAL FIVE','Remove QA bots until five remain; never kills a real tester.']);
    }
    if(['registration','running','starting'].includes(test.status)) buttons.push(['abort','ABORT / RESET TEST','Kill this QA Arena with no cooldown.']);
    controls.innerHTML = buttons.map(([action,label,note,count]) => '<button type="button" data-qa-action="'+esc(action)+'"'+(count?' data-qa-count="'+esc(count)+'"':'')+'><b>'+esc(label)+'</b><span>'+esc(note)+'</span></button>').join('');
  }

  async function refresh(){
    try { const data = await api(); render(data.test); }
    catch(e){ summary.textContent = 'QA ERROR // ' + e.message; }
  }

  controls.addEventListener('click', async e => {
    const btn = e.target.closest('[data-qa-action]');
    if(!btn || busy) return;
    busy = true;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<b>RUNNING…</b><span>QA command in progress.</span>';
    haptic('medium');
    try{
      const action = btn.dataset.qaAction;
      const body = {action};
      if(btn.dataset.qaCount) body.count = Number(btn.dataset.qaCount);
      const data = await api('POST', body);
      render(data.test);
      try { tg?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
      notify(data.message || 'QA action complete.');
    }catch(err){
      try { tg?.HapticFeedback?.notificationOccurred?.('error'); } catch {}
      notify(err.message);
      btn.innerHTML = original;
    }finally{
      busy = false;
      btn.disabled = false;
      setTimeout(refresh, 650);
    }
  });

  refresh();
  setInterval(refresh, 1500);
})();`;
