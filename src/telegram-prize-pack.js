export function applyTelegramPrizePack(html) {
  if (typeof html !== "string" || !html || html.includes("veil-prize-pack-js")) return html;

  const css = `<style id="veil-prize-pack-css">
.prize-card{grid-column:1/-1;border-color:#62477b;background:radial-gradient(circle at top right,#3b1d5540,transparent 40%),linear-gradient(155deg,#140c1c,#09070d)}.prize-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.prize-title{font:1000 17px/1 ui-monospace,monospace;letter-spacing:.08em;color:#e8ccff}.prize-counts{font:850 9px/1 ui-monospace,monospace;color:#a99bb4;text-align:right}.prize-form{display:grid;grid-template-columns:1.5fr .8fr .65fr auto;gap:8px;margin-top:14px}.prize-input{width:100%;min-width:0;border:1px solid #513660;border-radius:10px;background:#09060d;color:#fff;padding:10px;font:800 11px/1.2 ui-monospace,monospace}.prize-list{display:grid;gap:9px;margin-top:14px}.prize-item{border:1px solid #3e2a4c;border-radius:12px;background:#0b080f;padding:11px}.prize-item.funded{border-color:#286c58}.prize-item.problem{border-color:#8a6331}.prize-top{display:flex;justify-content:space-between;gap:10px}.prize-award{font-weight:950;color:#f1e8f7}.prize-sponsor{color:#94869d;font-size:10px;margin-top:3px}.prize-status{white-space:nowrap;border:1px solid #4b3559;border-radius:999px;padding:4px 7px;font:900 8px/1 ui-monospace,monospace}.prize-status.funded,.prize-status.paid{border-color:#2e765f;color:#72e4b9}.prize-status.ready_for_payout{border-color:#8a6c31;color:#e9c66f}.prize-status.needs_reconciliation,.prize-status.funding_ambiguous{border-color:#91394b;color:#f47b91}.prize-amount{font:1000 16px/1.1 ui-monospace,monospace;color:#c881ff;margin-top:8px}.prize-locked{font-size:10px;color:#8fe0bd;margin-top:4px}.prize-error{margin-top:8px;color:#ef8fa0;font-size:10px}.prize-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.prize-help{margin-top:12px;padding:10px;border:1px dashed #513a60;border-radius:11px;color:#aa9ab4;font-size:10px;line-height:1.55}.prize-help strong{color:#dfc8ee}.prize-settlement{margin-top:8px;padding-top:8px;border-top:1px solid #ffffff0c}.prize-share{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:10px}.prize-safety{margin-top:10px;border:1px solid #745b2e;border-radius:10px;padding:9px;color:#e8c86f;font-size:10px}.prize-empty{padding:13px 0;color:#756b7c;text-align:center;font:850 10px/1.3 ui-monospace,monospace}@media(max-width:760px){.prize-form{grid-template-columns:1fr 1fr}.prize-form select{grid-column:1/-1}.prize-form button{grid-column:1/-1}}
</style>`;

  const script = `<script id="veil-prize-pack-js">
(() => {
  const pEsc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLabel=value=>String(value||'').replaceAll('_',' ').toUpperCase();

  function installPrizeCard(){
    const grid=document.getElementById('featureGrid');
    if(!grid||document.getElementById('prizePoolCard'))return;
    const card=document.createElement('section');card.id='prizePoolCard';card.className='feature-card prize-card';
    card.innerHTML='<div class="prize-head"><div><div class="prize-title">💜 PRIZE POOL</div><div class="prize-sponsor">DWallet-backed Arena sponsorships</div></div><div class="prize-counts" id="prizeCounts"></div></div><div id="prizeCreateArea"></div><div class="prize-list" id="prizeList"></div><div class="prize-help" id="prizeHelp"></div>';
    grid.prepend(card);
  }

  function fundingHelp(pool){
    const pot=pool?.potTelegramUsername?'@'+pool.potTelegramUsername:(pool?.potUserId?'DWallet pot ID '+pool.potUserId:'the configured Veil DWallet prize pot');
    const missing=!pool?.potTelegramUsername;
    return '<strong>HOW FUNDING WORKS</strong><br>Create the sponsorship here first. Then send the exact displayed amount/currency from your DWallet to <strong>'+pEsc(pot)+'</strong>. In Telegram, DWallet tipping is done through <strong>@dwalletxbot</strong>; if your wallet started on Discord, run <strong>/link</strong> there first. Come back and tap CHECK FUNDING. Veil will not let Arena start while an announced sponsorship is unfunded.'+(missing?'<div class="prize-safety">Prize-pot Telegram username is not configured yet. Set <strong>DWALLET_TELEGRAM_POT_USERNAME</strong> to the Telegram account linked to the existing Veil DWallet prize-pot wallet before accepting real sponsorship funding.</div>':'')+(!pool?.payoutsEnabled?'<div class="prize-safety">Automatic Telegram recipient transfers are currently SAFETY LOCKED. Funding and award settlement can be tested, but Veil will not send prize money until Telegram recipient IDs are confirmed and <strong>DWALLET_TELEGRAM_PAYOUTS_ENABLED=true</strong>.</div>':'');
  }

  function renderPrizePool(){
    installPrizeCard();const pool=state?.prizePool;const card=document.getElementById('prizePoolCard');if(!card||!pool)return;
    document.getElementById('prizeCounts').innerHTML=Number(pool.fundedCount||0)+' FUNDED<br>'+Number(pool.pendingCount||0)+' PENDING';
    const create=document.getElementById('prizeCreateArea');
    if(state.status==='registration'){
      create.innerHTML='<div class="prize-form"><select class="prize-input" id="prizeAward">'+(pool.awards||[]).map(a=>'<option value="'+pEsc(a.id)+'">'+pEsc(a.label)+'</option>').join('')+'</select><input class="prize-input" id="prizeAmount" inputmode="decimal" placeholder="$5 or 0.05"><input class="prize-input" id="prizeCurrency" value="SOL" maxlength="16" placeholder="SOL"><button class="feature-mini primary" data-prize-action="create">SPONSOR</button></div>';
    }else create.innerHTML='<div class="prize-locked" style="margin-top:10px">🔒 Sponsorships locked when Arena started.</div>';

    const list=document.getElementById('prizeList');
    const prizes=pool.prizes||[];
    list.innerHTML=prizes.length?prizes.map(prize=>{
      const mine=String(prize.sponsorId)===String(state.viewer?.id);const host=Boolean(state.viewer?.isHost);const canCheck=state.status==='registration'&&(mine||host)&&prize.status!=='funded';const canCancel=state.status==='registration'&&(mine||host)&&prize.status!=='funded';
      const cls=prize.status==='funded'||prize.status==='paid'?'funded':prize.status==='funding_ambiguous'||prize.status==='needs_reconciliation'?'problem':'';
      const shares=(prize.recipients||[]).length?'<div class="prize-settlement">'+prize.recipients.map(s=>'<div class="prize-share"><span>'+pEsc(s.displayName||'Recipient')+' · '+pEsc(statusLabel(s.status))+'</span><strong>'+pEsc(s.amount)+' '+pEsc(prize.currency)+'</strong></div>').join('')+'</div>':'';
      return '<div class="prize-item '+cls+'"><div class="prize-top"><div><div class="prize-award">'+pEsc(prize.awardLabel)+'</div><div class="prize-sponsor">Sponsored by '+pEsc(prize.sponsorName)+'</div></div><span class="prize-status '+pEsc(prize.status)+'">'+pEsc(statusLabel(prize.status))+'</span></div><div class="prize-amount">'+pEsc(prize.amount)+' '+pEsc(prize.currency)+'</div>'+(prize.fundedAmount?'<div class="prize-locked">✓ '+pEsc(prize.fundedAmount)+' '+pEsc(prize.currency)+' locked in prize pot</div>':'')+(prize.error?'<div class="prize-error">'+pEsc(prize.error)+'</div>':'')+shares+((canCheck||canCancel)?'<div class="prize-actions">'+(canCheck?'<button class="feature-mini primary" data-prize-action="check" data-prize-id="'+pEsc(prize.id)+'">CHECK FUNDING</button>':'')+(canCancel?'<button class="feature-mini danger" data-prize-action="cancel" data-prize-id="'+pEsc(prize.id)+'">CANCEL</button>':'')+'</div>':'')+'</div>';
    }).join(''):'<div class="prize-empty">No sponsored prizes yet.</div>';
    document.getElementById('prizeHelp').innerHTML=fundingHelp(pool);
  }

  const priorRender=render;
  render=function prizeRender(){priorRender();renderPrizePool()};
  document.addEventListener('click',async event=>{
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
  installPrizeCard();if(state)renderPrizePool();
})();
</script>`;

  return html.replace('</head>', css + '\n</head>').replace('</body>', script + '\n</body>');
}
