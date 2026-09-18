export function applyTelegramMiniAppAssetBatch2(html) {
  if (typeof html !== "string" || !html) return html;

  const css = `
/* Telegram Mini App asset batch 2 */
.state-shell{background:linear-gradient(165deg,#0d0912f2,#050407f8 48%,#09060df2)}
.arena-splash-bg{
  position:absolute;
  inset:0;
  z-index:0;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center 18%;
  opacity:.20;
  filter:saturate(.92) brightness(.58) contrast(1.08);
  pointer-events:none;
  user-select:none;
}
.state-shell:after{
  content:"";
  position:absolute;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:linear-gradient(180deg,#07050a1c 0,#07050a8a 35%,#07050ae8 84%,#07050af7 100%);
}
.state-frame{z-index:1}
.state-content{z-index:2}
.panel{
  border:0!important;
  overflow:hidden;
  background:linear-gradient(155deg,#120e18ed,#08060ced)!important;
  filter:drop-shadow(0 16px 25px #0008);
}
.panel:before{
  content:"";
  position:absolute;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:url("/telegram/panel_frame.svg") center/100% 100% no-repeat;
}
.panel>*{position:relative;z-index:1}
.fx-banner{
  border:0!important;
  overflow:hidden;
  background:#08050cee!important;
}
.fx-banner:before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  background:url("/telegram/panel_frame.svg") center/100% 100% no-repeat;
}
.viewer-state-card{
  --viewer-state:url("/telegram/veil_ui_player_state_spectator.svg");
  position:relative;
  display:none;
  width:min(520px,100%);
  aspect-ratio:2.72/1;
  margin:14px 0 0 auto;
  overflow:hidden;
  background-image:var(--viewer-state),url("/telegram/veil_ui_player_card.svg");
  background-position:center,center;
  background-repeat:no-repeat,no-repeat;
  background-size:100% 100%,100% 100%;
  filter:drop-shadow(0 12px 24px #0009);
}
.viewer-state-card.asset-alive{--viewer-state:url("/telegram/veil_ui_player_state_alive.svg")}
.viewer-state-card.asset-dead{--viewer-state:url("/telegram/veil_ui_player_state_dead.svg")}
.viewer-state-card.asset-revived{--viewer-state:url("/telegram/veil_ui_player_state_revived.svg");filter:drop-shadow(0 0 18px #56e5bb66) drop-shadow(0 10px 20px #0008)}
.viewer-state-card.asset-spectator{--viewer-state:url("/telegram/veil_ui_player_state_spectator.svg")}
.viewer-state-card.asset-winner{--viewer-state:url("/telegram/veil_ui_player_state_winner.svg")}
.viewer-state-card .viewer-portrait{
  position:absolute;
  left:6.2%;
  top:18%;
  width:18.5%;
  height:64%;
  display:grid;
  place-items:center;
}
.viewer-state-card .viewer-portrait img{width:46%;filter:drop-shadow(0 0 10px #a966ff88)}
.viewer-state-copy{
  position:absolute;
  left:29%;
  right:6%;
  top:19%;
  bottom:14%;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  min-width:0;
}
.viewer-state-copy strong{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:clamp(13px,1.8vw,18px);
  font-weight:1000;
  letter-spacing:.02em;
}
.viewer-state-copy span{
  color:#b8a9c3;
  font-size:clamp(9px,1.15vw,11px);
  line-height:1.25;
}
.viewer-state-label{
  align-self:flex-start;
  color:#e5d8ed!important;
  font:950 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace!important;
  letter-spacing:.16em;
  text-transform:uppercase;
}
.viewer-state-card.live-compact{
  width:100%;
  min-height:72px;
  aspect-ratio:auto;
  margin:7px 0 0;
  background-position:left center,left center;
  background-size:38% 100%,38% 100%;
}
.viewer-state-card.live-compact .viewer-portrait{
  left:4.5%;
  top:13%;
  width:11.5%;
  height:74%;
}
.viewer-state-card.live-compact .viewer-portrait img{width:42%}
.viewer-state-card.live-compact .viewer-state-copy{
  left:41%;
  right:4%;
  top:18%;
  bottom:17%;
  justify-content:center;
  gap:5px;
}
.viewer-state-card.live-compact .viewer-state-copy > div{
  display:flex;
  align-items:center;
  gap:7px;
}
.viewer-state-card.live-compact .viewer-state-label{font-size:7px!important}
.viewer-state-card.live-compact .viewer-state-copy strong{font-size:15px}
.viewer-state-card.live-compact .viewer-state-copy span{font-size:9px;line-height:1.2}
.viewer-state-card.live-compact.asset-dead .viewer-state-label{color:#ef7a90!important}
.viewer-state-card.live-compact.asset-revived .viewer-state-label{color:#7ce7c2!important}
.viewer-state-card.live-compact.asset-revived .viewer-state-copy strong{color:#eafff7}
.viewer-state-card.live-compact.revived-now{animation:playerBack 1.4s ease both}
.sponsorship-card{
  position:relative;
  width:min(660px,100%);
  min-height:116px;
  margin:16px auto 0;
  padding:30px 44px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  text-align:center;
  background:url("/telegram/sponsorship_frame.svg") center/100% 100% no-repeat;
  filter:drop-shadow(0 14px 24px #0008);
}
.sponsorship-card img{width:30px;height:30px;filter:drop-shadow(0 0 10px #ba69ff77)}
.sponsorship-copy small{
  display:block;
  color:#a99ab6;
  font:900 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.18em;
  text-transform:uppercase;
}
.sponsorship-copy strong{display:block;margin-top:5px;font-size:14px;letter-spacing:.08em}
@media(max-width:760px){
  .arena-splash-bg{opacity:.17;object-position:center top}
  .viewer-state-card{width:100%;margin-top:7px}
  .sponsorship-card{min-height:94px;padding:24px 34px}
}
@media(max-width:440px){
  .viewer-state-card.live-compact{min-height:64px}
  .viewer-state-card.live-compact .viewer-state-copy{left:40%;right:3.5%}
  .viewer-state-card.live-compact .viewer-state-copy strong{font-size:13px}
  .viewer-state-card.live-compact .viewer-state-copy span{font-size:8px}
  .sponsorship-card{min-height:84px;padding:20px 28px;gap:10px}
  .sponsorship-card img{width:25px;height:25px}
  .sponsorship-copy strong{font-size:12px}
}
`;

  html = html.replace("</style>", css + "\n</style>");

  html = html.replace(
    '<section class="state-shell" id="stateShell">\n    <img class="state-frame"',
    '<section class="state-shell" id="stateShell">\n    <img class="arena-splash-bg" src="/telegram/Veil%20Arena%20Universal%20Master%20Splash%20Art.PNG" alt="" aria-hidden="true">\n    <img class="state-frame"'
  );

  html = html.replace(
    '        <div class="stack">',
    `        <section class="viewer-state-card asset-spectator" id="viewerStateCard" aria-label="Your Arena state">
          <div class="viewer-portrait"><img id="viewerStateIcon" src="/telegram/veil_ui_icon_spectate.svg" alt=""></div>
          <div class="viewer-state-copy">
            <div>
              <span class="viewer-state-label" id="viewerStateLabel">SPECTATOR</span>
              <strong id="viewerStateTitle">YOU</strong>
            </div>
            <span id="viewerStateDetail">Watching Arena.</span>
          </div>
        </section>

        <div class="stack">`
  );

  html = html.replace(
    '      <div class="footer-row">',
    `      <section class="sponsorship-card" aria-label="Arena sponsor">
        <img src="/telegram/veil_ui_icon_sponsor.svg" alt="">
        <div class="sponsorship-copy">
          <small>Telegram Arena</small>
          <strong>DWALLET × VEIL</strong>
        </div>
      </section>

      <div class="footer-row">`
  );

  return html;
}
