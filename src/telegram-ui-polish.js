export function applyTelegramUiPolish(html) {
  if (typeof html !== "string" || !html) return html;

  const css = `<style id="veil-telegram-ui-polish-css">
/* Keep the Live Roster heading, remove the obsolete decorative panel behind player rows. */
.roster-panel:before{display:none!important;background:none!important}
.roster-panel{
  padding:18px 0 0!important;
  overflow:visible!important;
  background:transparent!important;
  filter:none!important;
}
.roster-panel .section-head{padding:0 8px;margin-bottom:12px}
.roster-panel .roster{gap:9px!important}

/* One player = one clean row. This also neutralizes the older asset-player-card treatment if it is present. */
.roster-panel .player,
.roster-panel .player.asset-player-card{
  position:relative!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
  width:100%!important;
  aspect-ratio:auto!important;
  min-height:68px!important;
  padding:13px 16px!important;
  overflow:hidden!important;
  border:1px solid #4a3159!important;
  border-radius:18px!important;
  background-image:none!important;
  background:linear-gradient(145deg,#110c16f2,#09070df2)!important;
  box-shadow:inset 0 0 0 1px #ffffff05,0 10px 22px #0005!important;
  filter:none!important;
}
.roster-panel .player.asset-dead{opacity:.58!important;border-color:#49303a!important}
.roster-panel .player.asset-revived{opacity:1!important;border-color:#347761!important;box-shadow:inset 0 0 0 1px #55e2ae12,0 0 20px #55e2ae20!important}
.roster-panel .player.asset-winner{opacity:1!important;border-color:#8b703d!important;box-shadow:inset 0 0 0 1px #f2c96816,0 0 22px #f2c96822!important}
.roster-panel .player.asset-selected{background-image:none!important;border-color:#8c58aa!important;box-shadow:inset 0 0 0 1px #c689ff16,0 0 20px #c689ff28!important}
.roster-panel .player-portrait-token{display:none!important}
.roster-panel .player-name,
.roster-panel .player.asset-player-card .player-name{
  position:static!important;
  min-width:0!important;
  flex:1 1 auto!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  font-size:clamp(15px,4vw,20px)!important;
  line-height:1.15!important;
  font-weight:950!important;
  letter-spacing:.01em!important;
  text-shadow:0 2px 7px #000!important;
}
.roster-panel .player-meta,
.roster-panel .player.asset-player-card .player-meta{
  position:static!important;
  flex:0 0 auto!important;
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:7px!important;
  margin-left:auto!important;
}
.roster-panel .player-kos,
.roster-panel .player.asset-player-card .player-kos{font-size:9px!important;color:#b9a9c3!important;white-space:nowrap!important}
.roster-panel .player-badge,
.roster-panel .player.asset-player-card .player-badge{min-width:72px!important;height:25px!important;font-size:8px!important}

/* Sponsor instructions must always render above the Telegram Mini App. */
.sponsor-help-overlay{z-index:5000!important;pointer-events:auto!important}
.sponsor-help-overlay.show{display:grid!important}
.sponsor-help-sheet{pointer-events:auto!important}

@media(max-width:440px){
  .roster-panel{padding-top:14px!important}
  .roster-panel .section-head{padding:0 4px}
  .roster-panel .player,
  .roster-panel .player.asset-player-card{min-height:62px!important;padding:11px 13px!important;border-radius:16px!important}
  .roster-panel .player-name,
  .roster-panel .player.asset-player-card .player-name{font-size:15px!important}
  .roster-panel .player-badge,
  .roster-panel .player.asset-player-card .player-badge{min-width:66px!important;height:23px!important;font-size:7px!important}
}
</style>`;

  let out = html.replace("</head>", css + "\n</head>");

  const initMarker = "installNavigation();installTelegramBack();if(state)renderSponsor();";
  const fixedInit = `installNavigation();installTelegramBack();
  const directHelpButton=document.querySelector('[data-sponsor-help]');
  const directHelpClose=document.querySelector('[data-sponsor-help-close]');
  const directHelpOverlay=document.getElementById('sponsorHelpOverlay');
  const bindDirectTap=(element,handler)=>{
    if(!element||element.__veilDirectTapBound)return;
    element.__veilDirectTapBound=true;
    element.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();handler()});
    element.addEventListener('touchend',event=>{event.preventDefault();event.stopPropagation();handler()},{passive:false});
  };
  bindDirectTap(directHelpButton,openHelp);
  bindDirectTap(directHelpClose,closeHelp);
  if(directHelpOverlay&&!directHelpOverlay.__veilBackdropBound){
    directHelpOverlay.__veilBackdropBound=true;
    directHelpOverlay.addEventListener('click',event=>{if(event.target===directHelpOverlay){event.preventDefault();event.stopPropagation();closeHelp()}});
  }
  if(state)renderSponsor();`;
  out = out.replace(initMarker, fixedInit);
  return out;
}
