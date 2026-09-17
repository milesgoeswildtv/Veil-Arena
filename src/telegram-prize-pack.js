export function applyTelegramPrizePack(html) {
  if (typeof html !== "string" || !html || html.includes("veil-prize-pack-js")) return html;

  const css = `<style id="veil-prize-pack-css">
.arena-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 14px;padding:5px;border:1px solid #4b355a;border-radius:15px;background:#08060ccf;box-shadow:0 10px 24px #0006;backdrop-filter:blur(12px)}
.arena-nav-button{position:relative;min-height:42px;border:1px solid transparent;border-radius:11px;background:transparent;color:#9f91aa;font:950 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;cursor:pointer;transition:.16s ease}.arena-nav-button.active{color:#fff;border-color:#6c4581;background:linear-gradient(145deg,#39204a,#1a1023);box-shadow:inset 0 0 0 1px #ffffff0a,0 0 18px #a45cff22}.arena-nav-button:active{transform:scale(.98)}.arena-nav-count{display:none;position:absolute;right:8px;top:7px;min-width:17px;height:17px;padding:0 5px;border-radius:999px;background:#c45cff;color:#fff;font:950 8px/17px ui-monospace,monospace;letter-spacing:0}.arena-nav-count.show{display:block}
.sponsor-screen{display:none;margin-top:0}.sponsor-shell{display:grid;gap:14px}.sponsor-hero{position:relative;overflow:hidden;padding:22px;border:18px solid transparent;border-image:url("/telegram/veil_ui_panel_frame.svg") 96 fill stretch;background:linear-gradient(155deg,#170d20e8,#09070deb);filter:drop-shadow(0 16px 25px #0008)}.sponsor-hero:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-70px;top:-80px;background:#c45cff18;filter:blur(3px);pointer-events:none}.sponsor-kicker{display:flex;align-items:center;gap:8px;color:#cdb9dc;font:900 9px/1.2 ui-monospace,monospace;letter-spacing:.18em}.sponsor-kicker img{width:19px;height:19px}.sponsor-title{margin:8px 0 5px;font-size:clamp(32px,7vw,58px);line-height:.9;letter-spacing:-.045em;font-weight:1000}.sponsor-sub{max-width:620px;color:#a99ab5;font-size:13px;line-height:1.5}.sponsor-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}.sponsor-metric{padding:11px 12px;border:1px solid #4d365c;border-radius:11px;background:#0a070fbb}.sponsor-metric span{display:block;color:#9d8ea8;font:850 8px/1.2 ui-monospace,monospace;letter-spacing:.12em}.sponsor-metric strong{display:block;margin-top:6px;font-size:20px}.sponsor-metric.funded strong{color:#72e4b9}.sponsor-metric.pending strong{color:#e9c66f}
.sponsor-card{padding:17px;border:1px solid #442f51;border-radius:15px;background:linear-gradient(155deg,#120d18e8,#09070deb)}.sponsor-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}.sponsor-card-title{font:1000 12px/1.2 ui-monospace,monospace;letter-spacing:.13em;color:#e8d3f5}.sponsor-card-note{margin-top:5px;color:#8f8099;font-size:10px}.sponsor-lock{padding:12px;border:1px solid #6d552d;border-radius:11px;background:#24190c;color:#e9c66f;font-size:11px;line-height:1.45}.sponsor-form{display:grid;gap:10px}.sponsor-label{display:grid;gap:6px;color:#9f91aa;font:850 9px/1.2 ui-monospace,monospace;letter-spacing:.12em}.sponsor-input{width:100%;min-width:0;border:1px solid #513660;border-radius:11px;background:#09060d;color:#fff;padding:12px 13px;font:850 13px/1.2 ui-monospace,monospace;outline:none}.sponsor-input:focus{border-color:#a867e8;box-shadow:0 0 0 2px #a867e822}.sponsor-amount-row{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:8px}.sponsor-primary{appearance:none;min-height:48px;border:1px solid #a867e8;border-radius:12px;background:linear-gradient(145deg,#6d348e,#412052);color:#fff;font-weight:1000;letter-spacing:.04em;cursor:pointer}.sponsor-primary:active{transform:scale(.985)}.sponsor-secondary{appearance:none;min-height:42px;border:1px solid #654676;border-radius:11px;background:#160e1d;color:#fff;padding:9px 12px;font-weight:950;font-size:11px;cursor:pointer}.sponsor-secondary.danger{border-color:#8f2c3e;background:#341018;color:#ffd8df}.sponsor-secondary:disabled{opacity:.45}.sponsor-how{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px}.sponsor-how img{width:18px;height:18px}.sponsor-local-error{display:none;margin-top:10px;padding:10px 12px;border:1px solid #91394b;border-radius:10px;background:#321019;color:#f5c2cc;font-size:11px;line-height:1.4}.sponsor-local-error.show{display:block}
.sponsor-list{display:grid;gap:9px}.sponsor-item{border:1px solid #3e2a4c;border-radius:13px;background:#0b080f;padding:12px}.sponsor-item.funded{border-color:#286c58;box-shadow:inset 0 0 0 1px #55e2ae0f}.sponsor-item.problem{border-color:#8e394c}.sponsor-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.sponsor-award{font-weight:1000;color:#f1e8f7;font-size:13px}.sponsor-by{color:#8d8195;font-size:10px;margin-top:4px}.sponsor-status{white-space:nowrap;border:1px solid #4b3559;border-radius:999px;padding:5px 7px;font:900 8px/1 ui-monospace,monospace;color:#b9a9c3}.sponsor-status.funded,.sponsor-status.paid{border-color:#2e765f;color:#72e4b9}.sponsor-status.ready_for_payout{border-color:#8a6c31;color:#e9c66f}.sponsor-status.needs_reconciliation,.sponsor-status.funding_ambiguous{border-color:#91394b;color:#f47b91}.sponsor-amount{font:1000 18px/1.1 ui-monospace,monospace;color:#c881ff;margin-top:9px}.sponsor-funded{font-size:10px;color:#8fe0bd;margin-top:5px}.sponsor-error{margin-top:8px;color:#ef8fa0;font-size:10px;line-height:1.4}.sponsor-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.sponsor-shares{margin-top:9px;padding-top:8px;border-top:1px solid #ffffff0c}.sponsor-share{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:10px}.sponsor-empty{padding:22px 12px;color:#756b7c;text-align:center;font:850 10px/1.5 ui-monospace,monospace}
.sponsor-entry{display:none;width:100%;margin-top:10px;border:1px solid #68437a;border-radius:11px;background:linear-gradient(90deg,#24122f,#130b1b);color:#e8d7f4;padding:10px 12px;text-align:left;font:950 10px/1.2 ui-monospace,monospace;letter-spacing:.06em;cursor:pointer}.sponsor-entry.show{display:flex;align-items:center;justify-content:space-between;gap:10px}.sponsor-entry span:last-child{color:#c881ff}
.sponsor-help-overlay{display:none;position:fixed;inset:0;z-index:5000;background:#050308e8;padding:max(16px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom));place-items:end center}.sponsor-help-overlay.show{display:grid}.sponsor-help-sheet{width:min(620px,100%);max-height:86vh;overflow:auto;border:1px solid #6a477e;border-radius:20px 20px 14px 14px;background:linear-gradient(160deg,#140c1b,#0a0710);padding:18px;box-shadow:0 -20px 60px #0009}.sponsor-help-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.sponsor-help-title{font:1000 15px/1.2 ui-monospace,monospace;letter-spacing:.1em}.sponsor-help-copy{margin-top:14px;color:#b9acc4;font-size:12px;line-height:1.6}.sponsor-help-step{display:grid;grid-template-columns:28px 1fr;gap:9px;margin:11px 0}.sponsor-help-number{width:28px;height:28px;display:grid;place-items:center;border:1px solid #71488a;border-radius:9px;background:#251331;color:#dcaaff;font-weight:1000}.sponsor-help-warning{margin-top:12px;padding:10px 11px;border:1px solid #745b2e;border-radius:10px;background:#21170b;color:#e8c86f;font-size:10px;line-height:1.5}
body[data-arena-view="arena"] #featureGrid{display:none!important}body[data-arena-view="arena"] .sponsor-screen{display:none!important}body[data-arena-view="sponsor"] .main-grid,body[data-arena-view="sponsor"] .roster-panel,body[data-arena-view="sponsor"] .footer-row,body[data-arena-view="sponsor"] #featureGrid,body[data-arena-view="sponsor"] #reactionBar{display:none!important}body[data-arena-view="sponsor"] .sponsor-screen{display:block}body[data-arena-view="more"] .main-grid,body[data-arena-view="more"] .roster-panel,body[data-arena-view="more"] .footer-row,body[data-arena-view="more"] .sponsor-screen,body[data-arena-view="more"] #reactionBar{display:none!important}body[data-arena-view="more"] #featureGrid{display:grid!important}
@media(max-width:760px){.arena-nav{position:sticky;top:max(6px,env(safe-area-inset-top));z-index:80}.sponsor-hero{border-width:13px;padding:17px}.sponsor-title{font-size:36px}.sponsor-metrics{gap:6px}.sponsor-metric{padding:10px 9px}.sponsor-metric strong{font-size:18px}}@media(max-width:440px){.arena-nav-button{letter-spacing:.08em;font-size:9px}.sponsor-amount-row{grid-template-columns:minmax(0,1fr) 82px}.sponsor-card{padding:14px}.sponsor-top{display:block}.sponsor-status{display:inline-block;margin-top:7px}}
</style>`;

  const script = `<script id="veil-prize-pack-js">
(() => {
  const pEsc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLabel=value=>String(value||'').replaceAll('_',' ').toUpperCase();
  let currentView='arena';
  let helpOpen=false;

  function installNavigation(){
    if(document.getElementById('arenaNav'))return;
    const top=document.querySelector('.topline');
    const content=document.querySelector('.state-content');
    if(!top||!content)return;
    const nav=document.createElement('nav');
    nav.id='arenaNav';
    nav.className='arena-nav';
    nav.setAttribute('aria-label','Arena sections');
    nav.innerHTML='<button class="arena-nav-button active" type="button" data-arena-view="arena">ARENA</button><button class="arena-nav-button" type="button" data-arena-view="sponsor">SPONSOR<span class="arena-nav-count" id="sponsorNavCount">0</span></button><button class="arena-nav-button" type="button" data-arena-view="more">MORE</button>';
    top.insertAdjacentElement('afterend',nav);

    const screen=document.createElement('section');
    screen.id='sponsorScreen';
    screen.className='sponsor-screen';
    screen.innerHTML='<div class="sponsor-shell"><section class="sponsor-hero"><div class="sponsor-kicker"><img src="/telegram/veil_ui_icon_sponsor.svg" alt="">DWALLET // ARENA PRIZES</div><h1 class="sponsor-title">SPONSOR THE ARENA</h1><div class="sponsor-sub">Put a prize on an Arena achievement. Sponsorships lock when the match starts, but funded prizes stay visible through settlement.</div><div class="sponsor-metrics"><div class="sponsor-metric"><span>PRIZES</span><strong id="sponsorTotal">0</strong></div><div class="sponsor-metric funded"><span>FUNDED</span><strong id="sponsorFunded">0</strong></div><div class="sponsor-metric pending"><span>PENDING</span><strong id="sponsorPending">0</strong></div></div></section><section class="sponsor-card"><div class="sponsor-card-head"><div><div class="sponsor-card-title">CREATE SPONSORSHIP</div><div class="sponsor-card-note">Choose what you want to reward, then set the amount.</div></div></div><div id="sponsorCreateArea"></div><button type="button" class="sponsor-secondary sponsor-how" data-sponsor-help><img src="/telegram/veil_ui_icon_rules.svg" alt="">HOW TO USE</button><div class="sponsor-local-error" id="sponsorLocalError"></div></section><section class="sponsor-card"><div class="sponsor-card-head"><div><div class="sponsor-card-title">SPONSORED PRIZES</div><div class="sponsor-card-note">Funding and payout status stay visible here.</div></div></div><div class="sponsor-list" id="sponsorList"></div></section></div>';
    nav.insertAdjacentElement('afterend',screen);

    const controls=document.getElementById('controls');
    if(controls){
      const entry=document.createElement('button');
      entry.type='button';entry.id='sponsorEntry';entry.className='sponsor-entry';entry.setAttribute('data-arena-view','sponsor');
      controls.insertAdjacentElement('afterend',entry);
    }

    document.body.insertAdjacentHTML('beforeend','<div class="sponsor-help-overlay" id="sponsorHelpOverlay" role="dialog" aria-modal="true" aria-labelledby="sponsorHelpTitle"><div class="sponsor-help-sheet"><div class="sponsor-help-top"><div class="sponsor-help-title" id="sponsorHelpTitle">HOW TO USE SPONSORSHIPS</div><button type="button" class="sponsor-secondary" data-sponsor-help-close>CLOSE</button></div><div class="sponsor-help-copy" id="sponsorHelpCopy"></div></div></div>');
    document.body.dataset.arenaView='arena';
  }

  function syncBackButton(){
    try{
      const back=window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.BackButton;
      if(!back)return;
      if(helpOpen||currentView!=='arena')back.show();else back.hide();
    }catch{}
  }

  function setView(view){
    if(!['arena','sponsor','more'].includes(view))view='arena';
    currentView=view;
    document.body.dataset.arenaView=view;
    document.querySelectorAll('[data-arena-view].arena-nav-button').forEach(btn=>btn.classList.toggle('active',btn.dataset.arenaView===view));
    syncBackButton();
    try{window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()}catch{}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function openHelp(){
    helpOpen=true;
    document.getElementById('sponsorHelpOverlay')?.classList.add('show');
    syncBackButton();
  }
  function closeHelp(){
    helpOpen=false;
    document.getElementById('sponsorHelpOverlay')?.classList.remove('show');
    syncBackButton();
  }

  function bindSponsorHelp(){
    const button=document.querySelector('[data-sponsor-help]');
    const close=document.querySelector('[data-sponsor-help-close]');
    const overlay=document.getElementById('sponsorHelpOverlay');
    const bind=(element,handler)=>{
      if(!element||element.__veilSponsorTapBound)return;
      element.__veilSponsorTapBound=true;
      element.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();handler()});
      element.addEventListener('touchend',event=>{event.preventDefault();event.stopPropagation();handler()},{passive:false});
    };
    bind(button,openHelp);
    bind(close,closeHelp);
    if(overlay&&!overlay.__veilSponsorBackdropBound){
      overlay.__veilSponsorBackdropBound=true;
      overlay.addEventListener('click',event=>{
        if(event.target!==overlay)return;
        event.preventDefault();
        event.stopPropagation();
        closeHelp();
      });
    }
  }

  function installTelegramBack(){
    try{
      const back=window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.BackButton;
      if(!back||back.__veilArenaBound)return;
      back.__veilArenaBound=true;
      back.onClick(()=>{if(helpOpen)closeHelp();else setView('arena')});
      syncBackButton();
    }catch{}
  }

  function fundingHelp(pool){
    const pot=pool?.potTelegramUsername?'@'+pool.potTelegramUsername:(pool?.potUserId?'DWallet pot ID '+pool.potUserId:'the configured Veil DWallet prize pot');
    const missing=!pool?.potTelegramUsername;
    return '<div class="sponsor-help-step"><div class="sponsor-help-number">1</div><div><strong>CREATE IT HERE</strong><br>Choose the Arena award, enter the amount, and tap SPONSOR.</div></div><div class="sponsor-help-step"><div class="sponsor-help-number">2</div><div><strong>FUND THE PRIZE</strong><br>Send the exact displayed amount and currency from your DWallet to <strong>'+pEsc(pot)+'</strong>. Telegram DWallet tipping uses <strong>@dwalletxbot</strong>. If your wallet started on Discord, run <strong>/link</strong> there first.</div></div><div class="sponsor-help-step"><div class="sponsor-help-number">3</div><div><strong>VERIFY IT</strong><br>Return here and tap CHECK FUNDING. Arena cannot start with an announced prize that is still unfunded.</div></div><div class="sponsor-help-step"><div class="sponsor-help-number">4</div><div><strong>WATCH IT SETTLE</strong><br>After Arena ends, this screen shows the recipient and payout state for each funded prize.</div></div>'+(missing?'<div class="sponsor-help-warning">Prize-pot Telegram username is not configured yet. Set <strong>DWALLET_TELEGRAM_POT_USERNAME</strong> before accepting real sponsorship funding.</div>':'')+(!pool?.payoutsEnabled?'<div class="sponsor-help-warning">Automatic Telegram recipient transfers are currently safety locked. Funding can be verified, but automatic payout requires <strong>DWALLET_TELEGRAM_PAYOUTS_ENABLED=true</strong>.</div>':'');
  }

  function renderSponsor(){
    installNavigation();
    const pool=state?.prizePool;
    if(!pool)return;
    const prizes=pool.prizes||[];
    const total=prizes.length;
    const funded=Number(pool.fundedCount||0);
    const pending=Number(pool.pendingCount||0);
    const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value)};
    setText('sponsorTotal',total);setText('sponsorFunded',funded);setText('sponsorPending',pending);
    const navCount=document.getElementById('sponsorNavCount');if(navCount){navCount.textContent=String(total);navCount.classList.toggle('show',total>0)}
    const entry=document.getElementById('sponsorEntry');if(entry){entry.classList.toggle('show',total>0);entry.innerHTML='<span>💜 '+total+' SPONSORED PRIZE'+(total===1?'':'S')+'</span><span>VIEW →</span>'}

    const create=document.getElementById('sponsorCreateArea');
    if(create){
      if(state.status==='registration'){
        create.innerHTML='<div class="sponsor-form"><label class="sponsor-label">AWARD<select class="sponsor-input" id="prizeAward">'+(pool.awards||[]).map(a=>'<option value="'+pEsc(a.id)+'">'+pEsc(a.label)+'</option>').join('')+'</select></label><label class="sponsor-label">AMOUNT<div class="sponsor-amount-row"><input class="sponsor-input" id="prizeAmount" inputmode="decimal" placeholder="0.05"><input class="sponsor-input" id="prizeCurrency" value="SOL" maxlength="16" placeholder="SOL" aria-label="Currency"></div></label><button class="sponsor-primary" type="button" data-prize-action="create">SPONSOR</button></div>';
      }else{
        create.innerHTML='<div class="sponsor-lock">🔒 Sponsorships are locked because Arena has started. Existing funded prizes remain visible below.</div>';
      }
    }

    const list=document.getElementById('sponsorList');
    if(list){
      list.innerHTML=prizes.length?prizes.map(prize=>{
        const mine=String(prize.sponsorId)===String(state.viewer?.id);const host=Boolean(state.viewer?.isHost);const canCheck=state.status==='registration'&&(mine||host)&&prize.status!=='funded';const canCancel=state.status==='registration'&&(mine||host)&&prize.status!=='funded';
        const cls=prize.status==='funded'||prize.status==='paid'?'funded':prize.status==='funding_ambiguous'||prize.status==='needs_reconciliation'?'problem':'';
        const shares=(prize.recipients||[]).length?'<div class="sponsor-shares">'+prize.recipients.map(s=>'<div class="sponsor-share"><span>'+pEsc(s.displayName||'Recipient')+' · '+pEsc(statusLabel(s.status))+'</span><strong>'+pEsc(s.amount)+' '+pEsc(prize.currency)+'</strong></div>').join('')+'</div>':'';
        return '<div class="sponsor-item '+cls+'"><div class="sponsor-top"><div><div class="sponsor-award">'+pEsc(prize.awardLabel)+'</div><div class="sponsor-by">Sponsored by '+pEsc(prize.sponsorName)+'</div></div><span class="sponsor-status '+pEsc(prize.status)+'">'+pEsc(statusLabel(prize.status))+'</span></div><div class="sponsor-amount">'+pEsc(prize.amount)+' '+pEsc(prize.currency)+'</div>'+(prize.fundedAmount?'<div class="sponsor-funded">✓ '+pEsc(prize.fundedAmount)+' '+pEsc(prize.currency)+' locked in prize pot</div>':'')+(prize.error?'<div class="sponsor-error">'+pEsc(prize.error)+'</div>':'')+shares+((canCheck||canCancel)?'<div class="sponsor-actions">'+(canCheck?'<button class="sponsor-secondary" type="button" data-prize-action="check" data-prize-id="'+pEsc(prize.id)+'">CHECK FUNDING</button>':'')+(canCancel?'<button class="sponsor-secondary danger" type="button" data-prize-action="cancel" data-prize-id="'+pEsc(prize.id)+'">CANCEL</button>':'')+'</div>':'')+'</div>';
      }).join(''):'<div class="sponsor-empty">NO SPONSORED PRIZES YET.<br>BE THE FIRST TO PUT SOMETHING ON THE LINE.</div>';
    }
    const help=document.getElementById('sponsorHelpCopy');if(help)help.innerHTML=fundingHelp(pool);
  }

  const priorErr=err;
  err=function sponsorAwareError(message=''){
    priorErr(message);
    const local=document.getElementById('sponsorLocalError');
    if(local){local.textContent=message||'';local.classList.toggle('show',Boolean(message)&&currentView==='sponsor')}
  };

  const priorRender=render;
  render=function prizeRender(){priorRender();renderSponsor()};

  document.addEventListener('click',async event=>{
    const nav=event.target.closest('[data-arena-view]');if(nav){setView(nav.dataset.arenaView);return}
    if(event.target.closest('[data-sponsor-help]')){openHelp();return}
    if(event.target.closest('[data-sponsor-help-close]')){closeHelp();return}
    if(event.target.id==='sponsorHelpOverlay'){closeHelp();return}
    const el=event.target.closest('[data-prize-action]');if(!el)return;
    const action=el.dataset.prizeAction;
    if(action==='create'){
      const awardId=document.getElementById('prizeAward')?.value||'';const amount=document.getElementById('prizeAmount')?.value?.trim()||'';const currency=document.getElementById('prizeCurrency')?.value?.trim()||'';
      if(!amount||!currency){err('Enter a prize amount and currency.');return}
      await act('sponsor_create',{awardId,amount,currency});return;
    }
    if(action==='check'){await act('sponsor_check',{prizeId:el.dataset.prizeId});return}
    if(action==='cancel'){
      if(!confirm('Cancel this unfunded sponsorship?'))return;
      await act('sponsor_cancel',{prizeId:el.dataset.prizeId});
    }
  });

  installNavigation();installTelegramBack();bindSponsorHelp();if(state)renderSponsor();
})();
</script>`;

  return html.replace('</head>', css + '\n</head>').replace('</body>', script + '\n</body>');
}
