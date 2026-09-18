export function applyTelegramMiniAppAssetBatch3(html) {
  if (typeof html !== "string" || !html) return html;

  const css = `
/* Telegram Mini App asset batch 3 */
#hero:before,
#eventCard:before,
#voteCard:before{
  background-size:100% 100%!important;
  background-position:center!important;
  background-repeat:no-repeat!important;
}

#hero.asset-panel-lobby:before{background-image:url("/telegram/veil_ui_lobby_panel.svg")!important}
#hero.asset-panel-stats:before{background-image:url("/telegram/veil_ui_stats_panel.svg")!important}
#hero.asset-panel-results:before{background-image:url("/telegram/veil_ui_results_panel.svg")!important}
#eventCard.asset-panel-live:before{background-image:url("/telegram/veil_ui_live_round_panel.svg")!important}
#voteCard:before{background-image:url("/telegram/veil_ui_vote_panel.svg")!important}

#hero.asset-panel-lobby,
#hero.asset-panel-stats,
#hero.asset-panel-results,
#eventCard.asset-panel-live,
#voteCard{
  background:linear-gradient(155deg,#0e0b12e9,#070509ee)!important;
}

#hero.asset-panel-lobby{padding:clamp(22px,2.8vw,34px) clamp(24px,3.2vw,38px) clamp(14px,1.8vw,22px)}
#hero.asset-panel-stats{padding:clamp(14px,2vw,22px) clamp(18px,2.4vw,28px)}
#hero.asset-panel-results{padding:clamp(34px,4vw,50px)}
#eventCard.asset-panel-live{padding:14px 14px}
#voteCard{padding:clamp(30px,3.8vw,46px)}
.roster-panel{padding:10px 0 0!important;overflow:visible!important;background:transparent!important;filter:none!important}
.roster-panel:before{display:none!important;background:none!important}
.roster-panel .section-head{padding:0 8px;margin-bottom:8px}

.event{
  position:relative;
  min-height:148px;
  padding:24px 26px;
  overflow:hidden;
  background:none!important;
  border-radius:10px;
}
.event>*{position:relative;z-index:1}
#eventCard.asset-panel-live .section-head{margin-bottom:8px}
#eventCard.asset-panel-live .section-head img{width:20px;height:20px}
#eventCard.asset-panel-live .section-head h2{font-size:9px}
#eventCard.asset-panel-live .event{min-height:0;padding:0}
#eventCard.asset-panel-live .timer{margin-top:7px;min-height:24px;font-size:10px}

.readout{
  min-height:54px;
  padding:11px 24px!important;
  background:url("/telegram/input_frame.svg") center/100% 100% no-repeat!important;
}

.sponsorship-card{
  width:min(720px,100%)!important;
  min-height:150px!important;
  padding:38px 60px!important;
  background:url("/telegram/veil_ui_sponsor_panel.svg") center/100% 100% no-repeat!important;
}
.sponsorship-card img{width:34px;height:34px}
.sponsorship-copy small{font-size:9px}
.sponsorship-copy strong{font-size:15px}

#voteCard.live .veil-button.selected{
  filter:brightness(1.12) drop-shadow(0 0 14px #d3a1ff99)!important;
}

@media(max-width:760px){
  #hero.asset-panel-lobby{padding:18px 16px 10px}
  #hero.asset-panel-stats{padding:12px 12px}
  #hero.asset-panel-results{padding:30px 24px}
  #eventCard.asset-panel-live{padding:12px 10px}
  #voteCard{padding:30px 24px}
  .event{min-height:132px;padding:22px}
  #hero.asset-panel-lobby .readout{min-height:42px;padding:7px 14px!important}
  .readout{min-height:50px;padding:10px 20px!important}
  .sponsorship-card{min-height:126px!important;padding:30px 42px!important}
}

@media(max-width:440px){
  #hero.asset-panel-lobby{padding:14px 12px 7px}
  #hero.asset-panel-stats{padding:10px 9px}
  #hero.asset-panel-results{padding:26px 19px}
  #eventCard.asset-panel-live{padding:10px 8px}
  #voteCard{padding:26px 19px}
  .event{min-height:118px;padding:19px 18px}
  #hero.asset-panel-lobby .readout{min-height:38px;padding:6px 12px!important}
  .readout{padding:9px 16px!important}
  .sponsorship-card{min-height:110px!important;padding:26px 32px!important}
  .sponsorship-card img{width:28px;height:28px}
  .sponsorship-copy strong{font-size:13px}
}
`;

  html = html.replace("</style>", css + "\n</style>");

  return html;
}
