export const SPONSOR_PANEL_CLIENT = String.raw`(() => {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const unsafe = tg?.initDataUnsafe || {};
  const qs = new URLSearchParams(location.search);
  const start = unsafe.start_param || qs.get('tgWebAppStartParam') || '';
  const gameId = start.startsWith('arena_') ? start.slice(6) : '';
  const panel = document.getElementById('arenaSponsorPanel');
  if (!panel || !gameId || !initData) { if (panel) panel.hidden = true; return; }

  const form = panel.querySelector('[data-sponsor-form]');
  const list = panel.querySelector('[data-sponsor-list]');
  const status = panel.querySelector('[data-sponsor-status]');
  const more = panel.querySelector('[data-sponsor-more]');
  const extras = panel.querySelector('[data-sponsor-extras]');
  const submit = panel.querySelector('[data-sponsor-submit]');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = cents => '$' + ((Number(cents)||0)/100).toFixed(2);
  const labels = {winner:'Winner',runner_up:'Runner-Up',most_kills:'Most Eliminations',most_revivals:'Most Revivals',most_showdowns:'Most Community Showdowns Survived',most_mass_brawls:'Most Mass Brawls Survived'};

  async function api(method='GET', body=null){
    const r = await fetch('/telegram/miniapp/sponsor?game=' + encodeURIComponent(gameId), {
      method,
      headers:{'content-type':'application/json','x-telegram-init-data':initData},
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    const j = await r.json().catch(()=>({ok:false,error:'Bad server response'}));
    if(!j.ok) throw new Error(j.error || 'Sponsorship request failed');
    return j;
  }
  function paint(data){
    const items = data.sponsorships || [];
    list.innerHTML = items.length ? items.map(s => '<div class="sponsorEntry"><b>💸 '+esc(s.sponsorName)+' sponsors this Arena</b><div>'+Object.entries(s.awards||{}).map(([id,cents])=>esc(labels[id]||id)+' — <b>'+money(cents)+'</b>').join('<br>')+'</div></div>').join('') : '<div class="sponsorEmpty">No sponsorships yet.</div>';
    const locked = data.status !== 'registration';
    form.hidden = locked;
    status.textContent = locked ? 'SPONSORSHIPS LOCKED — ARENA STARTED' : 'OPTIONAL // SET ONLY THE PRIZES YOU WANT';
  }
  async function refresh(){try{paint(await api())}catch(e){status.textContent=e.message}}
  more?.addEventListener('click',()=>{extras.hidden=!extras.hidden;more.textContent=extras.hidden?'＋ MORE PRIZE OPTIONS':'− FEWER PRIZE OPTIONS'});
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const awards={};
    new FormData(form).forEach((value,key)=>{const n=Number(value);if(Number.isFinite(n)&&n>0)awards[key]=n;});
    if(!Object.keys(awards).length){tg?.showAlert?.('Enter at least one prize amount.');return;}
    submit.disabled=true;status.textContent='LOCKING SPONSORSHIP…';
    try{
      const data=await api('POST',{gameId,awards});
      paint(data);
      tg?.HapticFeedback?.notificationOccurred?.('success');
      tg?.showAlert?.('Sponsorship saved. You can edit it until the Arena starts.');
    }catch(err){tg?.HapticFeedback?.notificationOccurred?.('error');tg?.showAlert?.(err.message);status.textContent=err.message}
    finally{submit.disabled=false;}
  });
  refresh();
})();`;
