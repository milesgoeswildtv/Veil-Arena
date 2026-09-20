import { TELEGRAM_VISUAL_CSS, TELEGRAM_VISUAL_ASSETS } from "./generated/telegram-visuals.js";

export function telegramFxMiniAppHtml() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#08060d">
<title>DWallet Arena</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
${TELEGRAM_VISUAL_CSS}
:root{
  color-scheme:dark;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --bg:#07050a;
  --panel:#0e0a12ee;
  --panel-2:#141019e8;
  --text:#fbf8ff;
  --muted:#b9acc4;
  --violet:#c45cff;
  --violet-soft:#9a54ff;
  --red:#ef526f;
  --green:#55e2ae;
  --gold:#f2c968;
}
*{box-sizing:border-box}
html,body{
  margin:0;
  min-height:var(--tg-viewport-stable-height,100vh);
  background:var(--bg);
  color:var(--text);
}
body{
  min-height:var(--tg-viewport-stable-height,100vh);
  overflow-x:hidden;
  overscroll-behavior-y:none;
  background:
    radial-gradient(circle at 50% -10%,#3b175b55 0,transparent 36rem),
    radial-gradient(circle at 15% 85%,#38104b2f 0,transparent 30rem),
    #07050a;
}
body:before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  opacity:.22;
  background-image:
    linear-gradient(#ffffff05 1px,transparent 1px),
    linear-gradient(90deg,#ffffff04 1px,transparent 1px);
  background-size:28px 28px;
  mask-image:linear-gradient(to bottom,#000,transparent 78%);
}
button{font:inherit}
img{display:block;max-width:100%}
.app{
  width:min(1180px,100%);
  margin:0 auto;
  padding:14px 12px max(74px,env(safe-area-inset-bottom));
}
.state-shell{
  position:relative;
  isolation:isolate;
  min-height:calc(var(--tg-viewport-stable-height,100vh) - 28px);
  border-radius:32px;
  background:linear-gradient(165deg,#0d0912f2,#050407f8 48%,#09060df2);
  box-shadow:0 26px 80px #000b,inset 0 0 0 1px #ffffff08;
  overflow:hidden;
}
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
.state-frame{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  z-index:1;
  pointer-events:none;
  object-fit:fill;
  opacity:.96;
}
.state-content{
  position:relative;
  z-index:2;
  min-height:inherit;
  padding:clamp(30px,5vw,64px);
  overflow-anchor:none;
}
.topline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  min-width:0;
  margin-bottom:clamp(14px,2vw,24px);
}
.brand{
  display:flex;
  align-items:center;
  gap:14px;
  min-width:0;
}
.crest{width:clamp(152px,24vw,255px);height:auto;filter:drop-shadow(0 8px 18px #0008)}
.brand-copy{min-width:0}
.kicker{
  display:flex;
  align-items:center;
  gap:7px;
  color:#d7cce0;
  font:900 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.18em;
  text-transform:uppercase;
}
.kicker img{width:18px;height:18px}
.brand-copy strong{
  display:block;
  margin-top:4px;
  font-size:clamp(15px,2vw,20px);
  letter-spacing:.04em;
}
.status-badge,.player-badge{
  position:relative;
  display:inline-grid;
  place-items:center;
  flex:none;
  min-width:112px;
  height:30px;
  padding:0 18px;
  background-position:center;
  background-size:100% 100%;
  background-repeat:no-repeat;
  font:950 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.14em;
  text-transform:uppercase;
  text-shadow:0 2px 5px #000;
}
.status-badge.pending{background-image:url("/telegram/veil_ui_badge_pending.svg")}
.status-badge.live{background-image:url("/telegram/veil_ui_badge_live.svg")}
.status-badge.ready{background-image:url("/telegram/veil_ui_badge_ready.svg")}
body[data-arena-phase="registration"] #stateBadge{
  width:96px;
  min-width:96px;
  height:30px;
  padding:0 8px;
  transform:translate(-12px,48px);
  font-size:8px;
  letter-spacing:.1em;
}
.main-grid{
  display:grid;
  grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);
  align-items:start;
  gap:14px;
}
.panel{
  position:relative;
  min-width:0;
  padding:clamp(20px,2.6vw,30px);
  border:0;
  overflow:hidden;
  background:linear-gradient(155deg,#120e18ed,#08060ced);
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
#hero:before,#eventCard:before,#voteCard:before{
  background-size:100% 100%;
  background-position:center;
  background-repeat:no-repeat;
}
#hero.asset-panel-lobby:before{background-image:url("/telegram/veil_ui_lobby_panel.svg")}
#hero.asset-panel-stats:before{background-image:url("/telegram/veil_ui_stats_panel.svg")}
#hero.asset-panel-results:before{background-image:url("/telegram/veil_ui_results_panel.svg")}
#eventCard.asset-panel-live:before{display:none;background:none}
#voteCard:before{background-image:url("/telegram/veil_ui_vote_panel.svg")}
#hero.asset-panel-lobby,
#hero.asset-panel-stats,
#hero.asset-panel-results,
#voteCard{background:linear-gradient(155deg,#0e0b12e9,#070509ee)}
#eventCard.asset-panel-live{
  background:transparent;
  filter:none;
  overflow:visible;
}
#hero.asset-panel-lobby{padding:clamp(22px,2.8vw,34px) clamp(24px,3.2vw,38px) clamp(14px,1.8vw,22px)}
#hero.asset-panel-stats{padding:clamp(14px,2vw,22px) clamp(18px,2.4vw,28px)}
#hero.asset-panel-results{padding:clamp(34px,4vw,50px);opacity:var(--av-results-opacity,1)}
#eventCard.asset-panel-live{padding:14px}
#voteCard{padding:16px}
body[data-arena-phase="registration"][data-arena-view="arena"] .main-grid{grid-template-columns:1fr}
body[data-arena-phase="registration"][data-arena-view="arena"] .stack{display:none}
body[data-arena-phase="running"][data-arena-view="arena"] .main-grid{grid-template-columns:1fr;gap:8px}
body[data-arena-phase="running"] #eventCard{box-shadow:0 0 0 1px #c45cff16,0 12px 28px #0007}
body.crowd-vote-open #eventCard{display:none}
body.crowd-vote-open #voteCard{display:block}
body.crowd-vote-open .stack{gap:0}
body.crowd-vote-open #viewerStateCard.live-compact{margin-bottom:0}
body[data-arena-phase="running"] #timerRow{
  min-height:46px;
  margin-top:12px;
  padding:9px 13px;
  border:1px solid #4d335c;
  border-radius:12px;
  background:#0a0710;
  color:#dbc6e8;
  font:950 12px/1 ui-monospace,monospace;
  letter-spacing:.08em;
}
body[data-arena-phase="running"] #timerRow img{width:23px;height:23px}
body[data-arena-phase="running"][data-arena-view="arena"] #eventCard .section-head h2:after{content:" // LIVE";color:#b56ee4}
.hero-panel{min-height:100%}
.hero-panel.registration-mode{min-height:0}
.arena-title{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:4px;
}
.arena-title img{
  width:clamp(38px,5vw,52px);
  height:clamp(38px,5vw,52px);
  filter:drop-shadow(0 0 14px #bd64ff66);
}
.arena-title h1{
  margin:0;
  font-size:clamp(34px,7vw,68px);
  line-height:.86;
  letter-spacing:-.055em;
  font-weight:1000;
}
.arena-live-logo{display:none}
.status-line{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:26px;
  color:var(--muted);
  margin:9px 0 18px;
  font-weight:750;
}
.status-line img{width:20px;height:20px;opacity:.9}
.registration-inline{
  display:none;
  grid-template-columns:auto minmax(72px,1fr) auto;
  align-items:center;
  gap:8px;
  margin:2px 0 10px;
  min-width:0;
}
.registration-inline.show{display:grid}
.registration-ready{
  color:#d9cbe3;
  font:950 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.11em;
  white-space:nowrap;
}
.registration-track{
  height:6px;
  border-radius:999px;
  overflow:hidden;
  background:#211329;
  box-shadow:inset 0 0 0 1px #6c428033;
}
.registration-track span{
  display:block;
  width:0;
  height:100%;
  border-radius:inherit;
  background:linear-gradient(90deg,#8e4fe7,#cc66ff);
  box-shadow:0 0 10px #b45cff55;
  transition:width .2s ease;
}
.registration-lock{
  padding:4px 7px;
  border:1px solid #684579;
  border-radius:999px;
  color:#d8c6e2;
  font:900 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.1em;
  white-space:nowrap;
}
.registration-lock.locked{border-color:#82642f;color:#ebca72}
.pregame-ready-stage{display:contents}
.pregame-ready-frame{display:none}
.hero-panel.registration-mode .status-line{margin:4px 0 6px;min-height:20px}
.hero-panel.registration-mode .registration-inline{margin:0 0 6px}
.hero-panel.registration-mode .stats{gap:var(--av-stats-gap,5px);opacity:var(--av-stats-opacity,1)}
.hero-panel.registration-mode .stat{padding:7px 7px}
.hero-panel.registration-mode .stat b{margin-top:4px;font-size:clamp(18px,3.2vw,25px)}
.hero-panel.registration-mode .readout{min-height:36px;margin-top:6px;padding:5px 11px;font-size:9px}
.hero-panel.registration-mode .readout img{width:16px;height:16px}
.hero-panel.host-registration #viewerReadout{display:none}
.hero-panel.registration-mode .controls{
  gap:5px;
  margin-top:6px;
}
.hero-panel.host-registration .controls{
  grid-template-columns:repeat(3,minmax(0,1fr));
}
.hero-panel.registration-mode .veil-button{
  min-height:36px;
  padding:6px 5px;
  font-size:9px;
  line-height:1.05;
}
.hero-panel.registration-mode .veil-button-icon{
  width:16px;
  height:16px;
  margin-right:4px;
  vertical-align:-4px;
}
.hero-panel.registration-mode{
  overflow:visible;
  background:transparent;
}
#hero.asset-panel-lobby.registration-mode:before{display:none}
.hero-panel.registration-mode .arena-heading{
  display:block;
}
.hero-panel.registration-mode .arena-title{
  display:block;
  width:clamp(205px,53vw,270px);
  max-width:72%;
  margin:-14px auto -8px;
  transform:translateX(0);
}
.hero-panel.registration-mode .arena-title .arena-mark,
.hero-panel.registration-mode .arena-title h1{
  display:none;
}
.hero-panel.registration-mode .arena-live-logo{
  display:block;
  width:100%;
  height:auto;
  max-height:96px;
  object-fit:contain;
  filter:drop-shadow(0 0 15px #bd64ff66);
}
.hero-panel.registration-mode .status-line{
  display:none;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .pregame-ready-stage{
  position:relative;
  display:block;
  width:100%;
  aspect-ratio:3/1;
  margin:-6px 0 -34px;
  isolation:isolate;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .pregame-ready-frame{
  position:absolute;
  inset:0;
  z-index:0;
  display:block;
  width:100%;
  height:100%;
  max-width:none;
  object-fit:fill;
  pointer-events:none;
  user-select:none;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .registration-inline{
  position:absolute;
  z-index:1;
  left:8%;
  right:8%;
  top:20%;
  height:15%;
  margin:0;
  grid-template-columns:auto minmax(72px,1fr) auto;
  gap:8px;
  align-items:center;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stats{
  position:absolute;
  z-index:1;
  left:5.3%;
  right:5.3%;
  top:38%;
  height:38%;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:2.2%;
  align-items:stretch;
  opacity:1;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat{
  display:flex;
  flex-direction:column;
  justify-content:center;
  min-height:0;
  padding:6% 9%;
  border:0;
  border-radius:0;
  overflow:visible;
  background:transparent;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat:after{display:none}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat-head{
  font-size:clamp(7px,1.8vw,10px);
  letter-spacing:.1em;
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat-head img{
  width:clamp(13px,3vw,18px);
  height:clamp(13px,3vw,18px);
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat b{
  margin-top:5px;
  font-size:clamp(20px,5vw,34px);
}
body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .controls{
  transform:none;
  margin-top:-2px;
}
body[data-arena-phase="registration"][data-arena-view="arena"] .roster-panel .section-head{
  transform:translate(clamp(42px,16vw,72px),-35px);
}
.hero-panel.live-dashboard{
  min-height:0;
  display:grid;
  grid-template-columns:minmax(54px,1fr) minmax(200px,270px) minmax(96px,1fr);
  grid-template-areas:
    "status logo host"
    "stats stats stats"
    "error error error"
    "controls controls controls";
  align-items:center;
  column-gap:5px;
  row-gap:1px;
}
#hero.asset-panel-stats.live-dashboard{
  padding:3px 9px 8px;
}
.hero-panel.live-dashboard .arena-heading{
  display:contents;
}
.hero-panel.live-dashboard .arena-title{
  grid-area:logo;
  display:block;
  width:clamp(210px,36vw,270px);
  max-width:100%;
  margin:-10px 0 -5px;
  justify-self:center;
}
.hero-panel.live-dashboard .arena-title .arena-mark,
.hero-panel.live-dashboard .arena-title h1{
  display:none;
}
.hero-panel.live-dashboard .arena-live-logo{
  display:block;
  width:100%;
  height:auto;
  max-height:118px;
  object-fit:contain;
  filter:drop-shadow(0 0 16px #bd64ff70);
}
.hero-panel.live-dashboard .status-line{
  grid-area:status;
  justify-self:start;
  min-height:0;
  margin:0;
  gap:5px;
  font-size:8px;
  white-space:nowrap;
}
.hero-panel.live-dashboard .status-line:before{
  content:"";
  flex:none;
  width:6px;
  height:6px;
  border-radius:50%;
  background:#c45cff;
  box-shadow:0 0 9px #c45cffaa;
}
.hero-panel.live-dashboard .status-line img{display:none}
.hero-panel.live-dashboard .stats{
  grid-area:stats;
  gap:var(--av-stats-gap,5px);
  opacity:var(--av-stats-opacity,1);
}
.hero-panel.live-dashboard .stat{
  min-height:43px;
  padding:4px 7px;
  border-radius:9px;
}
.hero-panel.live-dashboard .stat-head{
  font-size:7px;
  letter-spacing:.08em;
}
.hero-panel.live-dashboard .stat-head img{width:12px;height:12px}
.hero-panel.live-dashboard .stat b{
  margin-top:2px;
  font-size:18px;
}
.hero-panel.live-dashboard #viewerReadout{display:none}
.hero-panel.live-dashboard #error{grid-area:error;margin-top:0}
.hero-panel.live-dashboard #controls{grid-area:controls;margin-top:0}
.hero-panel.live-dashboard #controls:empty{display:none}
/* LIVE EVENT: canonical visual owner. Plate + heading + 2x2 copy move as one stage. */
.live-event-stage{
  position:relative;
  min-width:0;
  overflow:hidden;
  border-radius:10px;
  opacity:var(--av-event-opacity,1);
}
.live-event-stage .live-event-plate{
  display:none;
}
#eventCard.asset-panel-live .live-event-stage{
  padding:clamp(10px,1.4vw,14px) clamp(8px,1.2vw,12px) clamp(12px,1.7vw,18px);
  overflow:visible;
}
#eventCard.asset-panel-live .live-event-plate{
  position:absolute;
  inset:0;
  z-index:0;
  display:block;
  width:100%;
  height:100%;
  max-width:none;
  object-fit:fill;
  transform:scale(1.04,1.28);
  transform-origin:center center;
  pointer-events:none;
  user-select:none;
}
#eventCard.asset-panel-live .section-head,
#eventCard.asset-panel-live .event{
  position:relative;
  z-index:1;
}
#eventCard.asset-panel-live .section-head{
  min-height:34px;
  margin:0 0 6px;
  padding:0 clamp(28px,6vw,44px);
  justify-content:center;
  text-align:center;
}
#eventCard.asset-panel-live .section-head img{
  position:absolute;
  left:clamp(4px,1vw,10px);
  top:50%;
  transform:translateY(-50%);
}
#eventCard.asset-panel-live .section-head h2{
  width:100%;
  text-align:center;
}
.live-event-grid{
  display:block;
  min-width:0;
  padding:0;
  overflow:visible;
  background:none;
}
.live-event-content{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  align-items:stretch;
  min-width:0;
  gap:var(--av-event-gap,0px);
  padding:clamp(8px,1vw,12px) var(--av-event-padding,15px) clamp(10px,1.25vw,14px);
}
.live-event-entry{
  min-width:0;
  min-height:0;
  padding:clamp(7px,.9vw,10px) clamp(7px,1.05vw,12px);
  background:transparent;
}
.live-event-copy{
  color:var(--av-event-color,#f4eef8);
  font-size:var(--av-event-font-size,11px);
  line-height:var(--av-event-line-height,1.38);
  overflow-wrap:anywhere;
}
.live-event-entry.dense .live-event-copy{
  font-size:calc(var(--av-event-font-size,11px) - 1px);
  line-height:1.28;
}
.live-event-entry.ultra-dense .live-event-copy{
  font-size:calc(var(--av-event-font-size,11px) - 2px);
  line-height:1.22;
}
.live-event-copy .event-head{
  margin-bottom:3px;
  font-size:1em;
}
.stats{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
}
.stat{
  position:relative;
  min-width:0;
  padding:13px 12px;
  border:1px solid #56366d88;
  background:linear-gradient(160deg,#160d1dd9,#0a080ed9);
  border-radius:13px;
  overflow:hidden;
}
.stat:after{
  content:"";
  position:absolute;
  width:48px;
  height:48px;
  border-radius:50%;
  right:-20px;
  top:-20px;
  background:#ba5cff19;
}
.stat-head{
  display:flex;
  align-items:center;
  gap:6px;
  color:#b9a9c6;
  font:850 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.13em;
}
.stat-head img{width:16px;height:16px;opacity:.86}
.stat b{
  display:block;
  margin-top:8px;
  font-size:clamp(22px,4vw,34px);
  line-height:1;
}
.readout{
  display:flex;
  align-items:center;
  gap:9px;
  min-height:54px;
  margin-top:12px;
  padding:11px 24px;
  background:url("/telegram/input_frame.svg") center/100% 100% no-repeat;
  color:#cbbbd8;
  font:800 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.06em;
}
.readout img{width:22px;height:22px}
.controls{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  margin-top:12px;
}
.veil-button{
  position:relative;
  isolation:isolate;
  min-width:0;
  min-height:52px;
  padding:11px 17px;
  border:0;
  background:transparent;
  color:#fff;
  font-size:13px;
  font-weight:950;
  letter-spacing:.025em;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  transition:transform .15s ease,filter .15s ease,opacity .15s ease;
}
.veil-button-icon{
  width:20px;
  height:20px;
  display:inline-block;
  vertical-align:-5px;
  margin-right:7px;
}
.veil-button:before{
  content:"";
  position:absolute;
  z-index:-1;
  inset:0;
  background:url("/telegram/veil_ui_button_secondary.svg") center/100% 100% no-repeat;
}
.veil-button.primary:before{background-image:url("/telegram/VEIL%20UI%20BAR%20.svg")}
.veil-button.danger{color:#ffd5dd}
.veil-button.danger:before{filter:hue-rotate(315deg) saturate(1.35)}
.veil-button.selected{filter:drop-shadow(0 0 12px #c368ff99)}
.veil-button:active{transform:scale(.98)}
.veil-button:focus-visible{outline:2px solid #f0c8ff;outline-offset:2px}
.busy .veil-button{pointer-events:none;opacity:.56}
.error{
  display:none;
  gap:9px;
  align-items:flex-start;
  margin-top:12px;
  padding:12px 14px;
  border:1px solid #ae4057;
  border-radius:12px;
  background:#351018e8;
  color:#ffe1e7;
  font-size:13px;
}
.error img{width:22px;height:22px;flex:none}
.stack{display:grid;gap:14px}
.section-head{
  display:flex;
  align-items:center;
  gap:9px;
  margin-bottom:12px;
}
.section-head img{width:25px;height:25px}
.section-head h2{
  margin:0;
  color:#decbea;
  font:950 11px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.17em;
  text-transform:uppercase;
}
.event{
  position:relative;
  min-height:148px;
  padding:24px 26px;
  overflow:hidden;
  background-color:transparent;
  border-radius:10px;
  white-space:pre-wrap;
  line-height:1.52;
  font-size:15px;
  overflow-wrap:anywhere;
}
#eventCard.asset-panel-live .section-head{margin-bottom:8px}
#eventCard.asset-panel-live .section-head img{width:20px;height:20px}
#eventCard.asset-panel-live .section-head h2{font-size:9px}
#eventCard.asset-panel-live .event{min-height:0;padding:0}
#eventCard.asset-panel-live .timer{margin-top:7px;min-height:24px;font-size:10px}
.event strong{font-weight:950}
.event em{font-style:italic}
.event s{opacity:.52;text-decoration-thickness:2px}
.event-head{
  display:block;
  margin-bottom:4px;
  font-weight:1000;
  font-size:1.08em;
  letter-spacing:.02em;
}
.timer{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:30px;
  margin-top:10px;
  color:#a99ab5;
  font-size:12px;
  font-weight:800;
}
.timer img{width:20px;height:20px}
.vote-panel{display:none}
.vote-panel.live{animation:voteGlow 1.25s ease-in-out infinite alternate}
.showdown-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  margin-bottom:9px;
}
.showdown-header .section-head{margin:0}
.showdown-status{
  text-align:right;
  color:#d7b0ef;
  font:950 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.12em;
  text-transform:uppercase;
}
.showdown-countdown{
  display:block;
  margin-top:4px;
  color:#fff;
  font-size:12px;
  letter-spacing:.05em;
}
.vote-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
}
.showdown-contender{
  --showdown-select:none;
  position:relative;
  min-width:0;
  min-height:112px;
  padding:13px 12px 11px;
  background-image:var(--showdown-select),url("/telegram/veil_ui_player_state_alive.svg"),url("/telegram/veil_ui_player_card.svg");
  background-position:center,center,center;
  background-repeat:no-repeat,no-repeat,no-repeat;
  background-size:100% 100%,100% 100%,100% 100%;
  filter:drop-shadow(0 8px 14px #0008);
}
.showdown-contender.selected{
  --showdown-select:url("/telegram/veil_ui_player_state_selected.svg");
  filter:drop-shadow(0 0 15px #c06cff77) drop-shadow(0 8px 14px #0008);
}
.showdown-contender-name{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  padding-right:6px;
  font-size:13px;
  font-weight:1000;
}
.showdown-contender-sub{
  margin-top:3px;
  color:#9f91aa;
  font:850 7px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.1em;
}
.showdown-bar{
  height:7px;
  margin-top:16px;
  overflow:hidden;
  border-radius:999px;
  background:#24172d;
  box-shadow:inset 0 0 0 1px #ffffff0a;
}
.showdown-bar span{
  display:block;
  width:0;
  height:100%;
  border-radius:inherit;
  background:linear-gradient(90deg,#8551d7,#d06cff);
  transition:width .2s ease;
}
.showdown-meta{
  display:flex;
  justify-content:space-between;
  gap:8px;
  margin-top:5px;
  color:#bcaec6;
  font:850 7px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.08em;
}
.showdown-vote{
  width:100%;
  min-height:30px;
  margin-top:9px;
  border:1px solid #68437a;
  border-radius:8px;
  background:#130b1a;
  color:#fff;
  font:950 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.12em;
}
.showdown-vote.selected{
  border-color:#c178f3;
  background:#4a2364;
  box-shadow:0 0 12px #c178f344;
}
.showdown-vote:disabled{opacity:.46}
.showdown-note{
  grid-column:1/-1;
  padding:8px 10px;
  border:1px solid #493258;
  border-radius:9px;
  background:#0a0710;
  color:#b8a9c3;
  font-size:9px;
  line-height:1.4;
}
.roster-panel{
  margin-top:14px;
  padding:10px 0 0;
  overflow:visible;
  background:transparent;
  filter:none;
}
.roster-panel:before{display:none;background:none}
.roster-panel .section-head{padding:0 8px;margin-bottom:8px}
.roster{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:var(--av-roster-gap,8px);
  opacity:var(--av-roster-opacity,1);
}
.player{
  --veil-player-state:url("/telegram/veil_ui_player_state_alive.svg");
  --veil-player-select:none;
  position:relative;
  display:block;
  width:100%;
  aspect-ratio:2.72/1;
  min-width:0;
  min-height:0;
  padding:0;
  border:0;
  border-radius:0;
  overflow:hidden;
  background-color:transparent;
  background-image:var(--veil-player-select),var(--veil-player-state),url("/telegram/veil_ui_player_card.svg");
  background-position:center,center,center;
  background-repeat:no-repeat,no-repeat,no-repeat;
  background-size:100% 100%,100% 100%,100% 100%;
  filter:drop-shadow(0 10px 18px #0008);
  transition:filter .22s ease,opacity .22s ease,transform .22s ease;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.player.asset-alive{--veil-player-state:url("/telegram/veil_ui_player_state_alive.svg")}
.player.asset-dead{--veil-player-state:url("/telegram/veil_ui_player_state_dead.svg");opacity:.72}
.player.asset-revived{--veil-player-state:url("/telegram/veil_ui_player_state_revived.svg");opacity:1}
.player.asset-winner{--veil-player-state:url("/telegram/veil_ui_player_state_winner.svg");opacity:1;filter:drop-shadow(0 0 20px #a56cff66) drop-shadow(0 10px 18px #0008)}
.player.asset-selected{--veil-player-select:url("/telegram/veil_ui_player_state_selected.svg");opacity:1;filter:drop-shadow(0 0 20px #c689ff88) drop-shadow(0 10px 18px #0008)}
.player:active{transform:scale(.992)}
.player-name{
  position:absolute;
  left:29%;
  right:6%;
  top:20%;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:clamp(14px,2.2vw,20px);
  line-height:1.15;
  font-weight:950;
  letter-spacing:.015em;
  text-shadow:0 2px 8px #000;
}
.bot-tag{
  display:inline-block;
  margin-left:6px;
  padding:2px 5px;
  border:1px solid #654676;
  border-radius:5px;
  color:#bdaaca;
  font:800 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  vertical-align:2px;
}
.player-meta{
  position:absolute;
  left:29%;
  right:6%;
  bottom:13%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:7px;
  min-width:0;
}
.player-kos{
  color:#c0b0ca;
  font-size:9px;
  font-weight:850;
  white-space:nowrap;
}
.player-badge{
  min-width:72px;
  height:24px;
  padding:0 12px;
  font-size:7px;
}
.player-badge.alive{background-image:url("/telegram/veil_ui_badge_alive.svg")}
.player-badge.dead{background-image:url("/telegram/veil_ui_badge_dead.svg")}
.player-portrait-token{
  position:absolute;
  left:6.2%;
  top:18%;
  width:18.5%;
  height:64%;
  display:grid;
  place-items:center;
  pointer-events:none;
}
.player-portrait-token img{width:42%;height:auto;filter:drop-shadow(0 0 8px #a966ff88)}
.new-dead{animation:playerOut 1.1s ease both}
.revived-now{animation:playerBack 1.4s ease both}
/* VIEWER STATUS: canonical visual owner. Do not add breakpoint overrides elsewhere. */
.viewer-state-card{
  opacity:var(--av-viewer-opacity,1);
  display:none;
}
.viewer-state-card.live-compact{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  width:max-content;
  max-width:min(calc(100% - 16px),420px);
  min-height:36px;
  margin:7px auto 2px;
  padding:5px 10px;
  overflow:hidden;
  border:1px solid #4d335c;
  border-radius:999px;
  background:linear-gradient(145deg,#100b15e8,#08060ceb);
  box-shadow:0 8px 18px #0007;
}
.viewer-state-card.live-compact .viewer-portrait{
  position:static;
  width:26px;
  height:26px;
  display:grid;
  place-items:center;
}
.viewer-state-card.live-compact .viewer-portrait img{
  width:19px;
  height:19px;
  object-fit:contain;
  filter:drop-shadow(0 0 8px #a966ff66);
}
.viewer-state-card.live-compact .viewer-state-copy{
  position:static;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  min-width:0;
}
.viewer-state-card.live-compact .viewer-state-copy > div{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:0;
  white-space:nowrap;
}
.viewer-state-card.live-compact .viewer-state-label{
  flex:none;
  color:#cdb9d9;
  font:950 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.13em;
  text-transform:uppercase;
}
.viewer-state-card.live-compact .viewer-state-copy strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
  line-height:1;
  font-weight:1000;
  letter-spacing:.02em;
}
.viewer-state-card.live-compact .viewer-state-copy > span{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:#9e90a8;
  font-size:7px;
  line-height:1.1;
  text-align:center;
}
.viewer-state-card.live-compact.asset-alive{
  border-color:#315f55;
  background:linear-gradient(145deg,#0d1716e8,#080b0beb);
}
.viewer-state-card.live-compact.asset-alive .viewer-state-label{color:#7ce7c2}
.viewer-state-card.live-compact.asset-dead{
  border-color:#633544;
  background:linear-gradient(145deg,#1a0d13e8,#0b0709eb);
}
.viewer-state-card.live-compact.asset-dead .viewer-state-label{color:#ef7a90}
.viewer-state-card.live-compact.asset-revived{
  border-color:#3d806e;
  background:linear-gradient(145deg,#0c1d19e8,#080d0beb);
  box-shadow:0 0 16px #56e5bb22,0 8px 18px #0007;
}
.viewer-state-card.live-compact.asset-revived .viewer-state-label{color:#7ce7c2}
.viewer-state-card.live-compact.asset-revived .viewer-state-copy strong{color:#eafff7}
.viewer-state-card.live-compact.asset-winner{
  border-color:#786032;
  background:linear-gradient(145deg,#1b160ce8,#0c0907eb);
}
.viewer-state-card.live-compact.revived-now{animation:playerBack 1.4s ease both}
.footer-row{
  display:flex;
  align-items:flex-start;
  justify-content:flex-end;
  gap:12px;
  margin-top:14px;
  color:#9f91aa;
  font-size:11px;
}
.footer-mark{
  display:flex;
  align-items:center;
  gap:6px;
  white-space:nowrap;
  font:850 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.1em;
}
.footer-mark img{width:18px;height:18px}
.rules{max-width:620px}
.rules summary{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:7px;
  cursor:pointer;
  list-style:none;
  color:#bcaac9;
  font-weight:850;
}
.rules summary::-webkit-details-marker{display:none}
.rules summary img{width:18px;height:18px}
.rules-copy{
  margin-top:8px;
  padding:10px 12px;
  border:1px solid #392744;
  border-radius:10px;
  background:#09070dcf;
  line-height:1.5;
}
.empty{color:#9789a2;font-size:12px}
.fx-layer{
  position:fixed;
  inset:0;
  z-index:999;
  pointer-events:none;
  overflow:hidden;
}
.fx-flash{position:absolute;inset:0;opacity:0}
.fx-banner{
  position:absolute;
  left:50%;
  top:42%;
  transform:translate(-50%,-50%) scale(.72);
  width:min(88vw,560px);
  padding:25px 22px 22px;
  text-align:center;
  border:0;
  overflow:hidden;
  background:#08050cee;
  filter:drop-shadow(0 0 28px #8d57e877);
  opacity:0;
}
.fx-banner:before{
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  background:url("/telegram/panel_frame.svg") center/100% 100% no-repeat;
}
.fx-icon{
  width:52px;
  height:52px;
  margin:0 auto;
  filter:drop-shadow(0 0 14px #c261ff77);
}
.fx-title{font-weight:1000;font-size:clamp(24px,7vw,32px);letter-spacing:.07em;margin-top:8px}
.fx-sub{font:850 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em;margin-top:7px;color:#c7b7d3}
.fx-particle{position:absolute;left:50%;top:48%;font-size:20px;opacity:0;will-change:transform,opacity}
.fx-layer.active .fx-banner{animation:bannerIn 1.65s cubic-bezier(.2,.8,.2,1) both}
.fx-layer.active .fx-flash{animation:flash 1s ease-out both}
.fx-layer.mass .fx-flash,.fx-layer.elimination .fx-flash,.fx-layer.showdown .fx-flash{background:radial-gradient(circle,#c52d4c77 0,#6b153f44 35%,transparent 70%)}
.fx-layer.revival .fx-flash{background:radial-gradient(circle,#31e0a755 0,#1b7d6844 35%,transparent 72%)}
.fx-layer.vote .fx-flash,.fx-layer.glitch .fx-flash{background:radial-gradient(circle,#9c5eff55 0,#5d21a144 40%,transparent 72%)}
.fx-layer.finalfive .fx-flash,.fx-layer.winner .fx-flash{background:radial-gradient(circle,#f5c45c66 0,#9f6d2444 42%,transparent 74%)}
.screen-shake{animation:shake .58s cubic-bezier(.36,.07,.19,.97) both}
.hero-event{animation:heroPulse .9s ease}
.glitching{animation:glitch .65s steps(2,end)}
.fx-particle.burst{animation:burst 1.35s ease-out var(--delay,0ms) both}
.fx-particle.rise{animation:rise 1.6s ease-out var(--delay,0ms) both}
.fx-particle.confetti{top:-8%;animation:confetti 2.4s linear var(--delay,0ms) both}
.ambient-pulse{animation:ambientPulse .75s ease}
.winner-glow{animation:winnerGlow 1.7s ease-in-out 2}
.final-five-glow{animation:finalFiveGlow 1.5s ease-in-out 2}
@keyframes voteGlow{from{filter:drop-shadow(0 16px 25px #0008)}to{filter:drop-shadow(0 16px 34px #9a62ee66)}}
@keyframes bannerIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.72);filter:blur(8px)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.05);filter:blur(0) drop-shadow(0 0 28px #8d57e877)}28%,72%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 28px #8d57e877)}100%{opacity:0;transform:translate(-50%,-54%) scale(.94)}}
@keyframes flash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
@keyframes shake{10%,90%{transform:translate3d(-2px,0,0)}20%,80%{transform:translate3d(4px,0,0)}30%,50%,70%{transform:translate3d(-7px,0,0)}40%,60%{transform:translate3d(7px,0,0)}}
@keyframes heroPulse{0%{filter:drop-shadow(0 16px 25px #0008)}35%{filter:drop-shadow(0 0 30px #9e63e877)}100%{filter:drop-shadow(0 16px 25px #0008)}}
@keyframes glitch{0%,100%{transform:none;filter:none}20%{transform:translateX(-4px);filter:hue-rotate(35deg)}40%{transform:translateX(5px) skewX(1deg);filter:hue-rotate(-35deg)}60%{transform:translateX(-2px);filter:contrast(1.25)}80%{transform:translateX(3px)}}
@keyframes burst{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r)) scale(1.25)}}
@keyframes rise{0%{opacity:0;transform:translate(-50%,20px) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--x)),-65vh) scale(1.35)}}
@keyframes confetti{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(112vh) rotate(var(--r))}}
@keyframes playerOut{0%{transform:scale(1);opacity:1}22%{transform:scale(1.025)}55%{transform:translateX(-5px)}100%{transform:scale(.98);opacity:.56}}
@keyframes playerBack{0%{opacity:.2;transform:scale(.94)}35%{opacity:1;transform:scale(1.035)}100%{transform:scale(1)}}
@keyframes ambientPulse{35%{background-color:#160a20}100%{background-color:#08060d}}
@keyframes winnerGlow{50%{filter:drop-shadow(0 0 36px #efc15c77)}}
@keyframes finalFiveGlow{50%{filter:drop-shadow(0 0 30px #eab64d66)}}
@media(max-width:760px){
  .app{padding-left:6px;padding-right:6px}
  .state-shell{border-radius:22px}
  .arena-splash-bg{opacity:.17;object-position:center top}
  .state-content{padding:30px 22px 44px}
  .topline{align-items:flex-start;gap:8px}
  .brand-copy{display:none}
  .status-badge{min-width:98px;height:27px;padding:0 12px;font-size:8px}
  .main-grid{grid-template-columns:1fr}
  .stack{gap:10px}
  .panel{padding:18px}
  #hero.asset-panel-lobby{padding:18px 16px 10px}
  #hero.asset-panel-stats{padding:12px}
  #hero.asset-panel-results{padding:30px 24px}
  #eventCard.asset-panel-live{padding:12px 10px}
  #voteCard{padding:13px 11px}
  .event{min-height:132px;padding:22px}
  #hero.asset-panel-lobby .readout{min-height:42px;padding:7px 14px}
  .readout{min-height:50px;padding:10px 20px}
  .roster{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--av-roster-gap,7px)}
  .roster .player:last-child:nth-child(odd){grid-column:1/-1;width:calc(50% - 3.5px);justify-self:center}
  .footer-row{flex-direction:column;align-items:stretch}
  .rules summary{justify-content:flex-start}
}
@media(max-width:440px){
  .state-content{padding:18px 12px 30px}
  .crest{width:138px}
  .topline{margin-bottom:10px}
  .arena-title{gap:8px}
  .arena-title img{width:34px;height:34px}
  .arena-title h1{font-size:36px}
  .stats{gap:var(--av-stats-gap,5px)}
  .stat{padding:8px 7px}
  .stat-head{font-size:7px;letter-spacing:.06em}
  .controls{grid-template-columns:1fr}
  .hero-panel.registration-mode .controls{grid-template-columns:1fr}
  .hero-panel.host-registration .controls{grid-template-columns:repeat(3,minmax(0,1fr))}
  .hero-panel.registration-mode .veil-button{min-height:34px;font-size:8px;padding:5px 3px}
  .registration-inline{grid-template-columns:auto minmax(58px,1fr) auto;gap:6px;margin-bottom:7px}
  .registration-ready{font-size:8px;letter-spacing:.08em}
  .registration-lock{font-size:6px;padding:4px 6px}
  #hero.asset-panel-lobby{padding:14px 12px 7px}
  #hero.asset-panel-stats{padding:10px 9px}
  #hero.asset-panel-results{padding:26px 19px}
  #eventCard.asset-panel-live{padding:10px 8px}
  #voteCard{padding:11px 9px}
  #hero.asset-panel-lobby .readout{min-height:38px;padding:6px 12px}
  .readout{padding:9px 16px}
  body[data-arena-phase="registration"] #stateBadge{width:96px;min-width:96px;height:30px;padding:0 8px;transform:translate(-12px,48px);font-size:8px}
  .hero-panel.registration-mode .arena-title{width:215px;max-width:72%;margin:-16px auto -8px;transform:translateX(0)}
  .hero-panel.registration-mode .arena-live-logo{width:100%;height:auto;max-height:96px}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .pregame-ready-stage{margin:-8px 0 -30px}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .registration-inline{left:8%;right:8%;top:20%;height:15%;gap:6px}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .registration-ready{font-size:7px;letter-spacing:.07em}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .registration-lock{font-size:6px;padding:3px 6px}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .registration-track{height:5px}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stats{left:5.3%;right:5.3%;top:38%;height:38%;gap:2.2%}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat{padding:5% 8%}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .stat b{font-size:clamp(18px,5vw,28px)}
  body[data-arena-phase="registration"][data-arena-view="arena"] #hero.registration-mode .controls{margin-top:-2px}
  body[data-arena-phase="registration"][data-arena-view="arena"] .roster-panel .section-head{transform:translate(64px,-35px)}
  .hero-panel.live-dashboard{padding-top:0}
  #hero.asset-panel-stats.live-dashboard{padding:2px 7px 7px}
  .hero-panel.live-dashboard{grid-template-columns:minmax(46px,1fr) minmax(0,220px) minmax(88px,1fr);column-gap:3px;row-gap:0}
  .hero-panel.live-dashboard .arena-live-logo{width:100%;height:auto;max-height:108px}
  .hero-panel.live-dashboard .arena-title{width:220px;margin:-2px 0 -4px}
  .hero-panel.live-dashboard .status-line{font-size:7px;gap:4px}
  .hero-panel.live-dashboard .status-line:before{width:5px;height:5px}
  .hero-panel.live-dashboard .stat{min-height:38px;padding:3px 5px}
  .hero-panel.live-dashboard .stat b{font-size:17px}
  .showdown-contender{min-height:98px;padding:10px 9px 8px}
  .showdown-contender-name{font-size:11px}
  .showdown-bar{margin-top:12px}
  .showdown-status{font-size:7px}
  .showdown-countdown{font-size:11px}
  .roster{gap:var(--av-roster-gap,6px)}
  .player-name{left:28%;right:5%;top:18%;font-size:clamp(9px,2.8vw,12px);line-height:1.05}
  .bot-tag{margin-left:3px;padding:1px 3px;border-radius:4px;font-size:5px;vertical-align:1px}
  .player-meta{left:28%;right:5%;bottom:10%;gap:3px}
  .player-kos{font-size:6px}
  .player-badge{min-width:48px;height:18px;padding:0 7px;font-size:5px;letter-spacing:.08em}
  .player-portrait-token{left:5.5%;top:16%;width:18%;height:68%}
  .player-portrait-token img{width:38%}
  .vote-grid{grid-template-columns:1fr}
  .event{min-height:90px}
}
@media(min-width:1000px){
  .roster{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(hover:hover) and (pointer:fine){
  .veil-button:hover{transform:translateY(-1px);filter:brightness(1.12)}
}
@media(prefers-reduced-motion:reduce){
  *,*:before,*:after{scroll-behavior:auto!important}
  .fx-layer *,.screen-shake,.hero-event,.glitching,.ambient-pulse,.winner-glow,.final-five-glow,.new-dead,.revived-now,.vote-panel.live{animation:none!important}
  .fx-layer{display:none}
}
</style>
</head>
<body>
<div class="fx-layer" id="fxLayer" aria-hidden="true">
  <div class="fx-flash"></div>
  <div class="fx-banner">
    <img class="fx-icon" id="fxIcon" src="/telegram/veil_ui_icon_arena.svg" alt="">
    <div class="fx-title" id="fxTitle">ARENA</div>
    <div class="fx-sub" id="fxSub"></div>
  </div>
  <div id="fxParticles"></div>
</div>

<main class="app" id="app">
  <section class="state-shell" id="stateShell">
    <img class="arena-splash-bg" src="/telegram/Veil%20Arena%20Universal%20Master%20Splash%20Art.PNG" alt="" aria-hidden="true">
    <img class="state-frame" id="stateFrame" src="/telegram/lobby_frame.svg" alt="" aria-hidden="true">
    <div class="state-content">
      <div class="topline">
        <div class="brand">
          <img class="crest" src="/telegram/lobby_crest.svg" alt="Veil Arena">
          <div class="brand-copy">
            <div class="kicker"><img src="/telegram/veil_ui_icon_sponsor.svg" alt="">DWALLET // VEIL</div>
            <strong>Telegram Arena</strong>
          </div>
        </div>
        <div class="status-badge pending" id="stateBadge">CONNECTING</div>
      </div>

      <div class="main-grid">
        <section class="panel hero-panel" id="hero">
          <div class="arena-heading">
            <div class="arena-title">
              <img class="arena-mark" src="/telegram/veil_ui_icon_arena.svg" alt="">
              <h1>ARENA</h1>
              <img class="arena-live-logo" src="/telegram/CrashoutArenaLogoNew.svg" alt="Crashout Arena">
            </div>
            <div class="status-line" id="statusLine">
              <img id="statusIcon" src="/telegram/veil_ui_icon_timer.svg" alt="">
              <span id="status">Connecting to Telegram…</span>
            </div>
          </div>

          <div class="pregame-ready-stage">
            <img class="pregame-ready-frame" src="/telegram/crashout%20ui/PregameReadyCheckFrame.PNG" alt="" aria-hidden="true">
            <div class="registration-inline" id="registrationInline" aria-live="polite">
              <span class="registration-ready" id="registrationReady">0 / 0 READY</span>
              <span class="registration-track"><span id="registrationProgress"></span></span>
              <span class="registration-lock" id="registrationLock">OPEN</span>
            </div>

            <div class="stats">
              <div class="stat">
                <div class="stat-head"><img src="/telegram/veil_ui_icon_timer.svg" alt="">ROUND</div>
                <b id="round">0</b>
              </div>
              <div class="stat">
                <div class="stat-head"><img src="/telegram/veil_ui_icon_stats.svg" alt="">PLAYERS</div>
                <b id="players">0</b>
              </div>
              <div class="stat">
                <div class="stat-head"><img src="/telegram/veil_ui_icon_skull.svg" alt="">ALIVE</div>
                <b id="alive">0</b>
              </div>
            </div>
          </div>

          <div class="readout" id="viewerReadout">
            <img id="viewerIcon" src="/telegram/veil_ui_icon_spectate.svg" alt="">
            <span id="viewerText">Connecting viewer…</span>
          </div>

          <div class="error" id="error">
            <img src="/telegram/veil_ui_icon_warning.svg" alt="">
            <span id="errorText"></span>
          </div>
          <div class="controls" id="controls"></div>
        </section>

        <div class="final-five-strip" id="finalFiveStrip">FINAL FIVE // SPECIAL EVENTS LOCKED OUT</div>

        <section class="viewer-state-card asset-spectator" id="viewerStateCard" aria-label="Your Arena state">
          <div class="viewer-portrait"><img id="viewerStateIcon" src="/telegram/veil_ui_icon_spectate.svg" alt=""></div>
          <div class="viewer-state-copy">
            <div>
              <span class="viewer-state-label" id="viewerStateLabel">SPECTATOR</span>
              <strong id="viewerStateTitle">YOU</strong>
            </div>
            <span id="viewerStateDetail">Watching Arena.</span>
          </div>
        </section>

        <div class="stack">
          <section class="panel" id="eventCard">
            <div class="live-event-stage" id="liveEventStage">
              <img class="live-event-plate" src="${TELEGRAM_VISUAL_ASSETS.eventPlate}" alt="" aria-hidden="true">
              <div class="section-head">
                <img id="eventIcon" src="/telegram/veil_ui_icon_timer.svg" alt="">
                <h2 id="eventHeading">Live Event</h2>
              </div>
              <div class="event" id="event">Waiting for Arena…</div>
            </div>
            <div class="timer" id="timerRow">
              <img src="/telegram/veil_ui_icon_timer.svg" alt="">
              <span id="timer"></span>
            </div>
          </section>

          <section class="panel vote-panel" id="voteCard">
            <div class="showdown-header">
              <div class="section-head">
                <img src="/telegram/veil_ui_icon_vote.svg" alt="">
                <h2>Community Showdown</h2>
              </div>
              <div class="showdown-status">
                <span id="voteStateText">SPECTATORS VOTING</span>
                <span class="showdown-countdown" id="voteCountdown"></span>
              </div>
            </div>
            <div class="vote-grid" id="voteGrid"></div>
          </section>
        </div>
      </div>

      <section class="panel roster-panel">
        <div class="section-head">
          <img src="/telegram/veil_ui_icon_leaderboard.svg" alt="">
          <h2 id="rosterHeading">Live Roster</h2>
        </div>
        <div class="roster" id="roster"></div>
      </section>


      <div class="footer-row">
        <details class="rules">
          <summary><img src="/telegram/veil_ui_icon_rules.svg" alt="">QUICK RULES</summary>
          <div class="rules-copy">
            Join while registration is open. Once Arena starts, the game resolves live. Eliminated players keep watching and may vote when a Community Showdown opens. Last player alive wins.
          </div>
        </details>
      </div>
    </div>
  </section>
</main>

<script>
const tg=window.Telegram&&window.Telegram.WebApp;
const initData=tg?.initData||'';
const afterdarkPreview=new URLSearchParams(location.search).get('afterdarkPreview')==='1';
const A='/telegram/';
const icons={
  arena:A+'veil_ui_icon_arena.svg',
  crown:A+'veil_ui_icon_crown.svg',
  leaderboard:A+'veil_ui_icon_leaderboard.svg',
  revive:A+'veil_ui_icon_revive.svg',
  rules:A+'veil_ui_icon_rules.svg',
  skull:A+'veil_ui_icon_skull.svg',
  spectate:A+'veil_ui_icon_spectate.svg',
  sponsor:A+'veil_ui_icon_sponsor.svg',
  stats:A+'veil_ui_icon_stats.svg',
  success:A+'veil_ui_icon_success.svg',
  timer:A+'veil_ui_icon_timer.svg',
  vote:A+'veil_ui_icon_vote.svg',
  wallet:A+'veil_ui_icon_wallet.svg',
  warning:A+'veil_ui_icon_warning.svg'
};
const frames={
  registration:A+'lobby_frame.svg',
  running:A+'active_match_frame.svg',
  vote:A+'vote_frame.svg',
  finished:A+'results_frame.svg'
};
let state=null,busy=false,lastFxKey='',finalFiveSeen=false,lastStateSignature='',refreshTimer=null,refreshing=false;
const changeUntil=new Map();
const playerRows=new Map();
const renderHooks=[];
const timerHooks=[];

function registerRenderHook(fn){
  if(typeof fn!=='function'||renderHooks.includes(fn))return;
  renderHooks.push(fn);
}
function registerTimerHook(fn){
  if(typeof fn!=='function'||timerHooks.includes(fn))return;
  timerHooks.push(fn);
}
function runRenderHooks(){
  for(const hook of renderHooks){try{hook()}catch(error){console.error('Arena render hook failed',error)}}
}
function runTimerHooks(){
  for(const hook of timerHooks){try{hook()}catch(error){console.error('Arena timer hook failed',error)}}
}

if(tg){
  try{
    tg.ready();
    tg.expand();
    if(typeof tg.disableVerticalSwipes==='function')tg.disableVerticalSwipes();
    tg.setHeaderColor('#08060d');
    tg.setBackgroundColor('#08060d');
  }catch{}
}

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stateSignature(value){
  return JSON.stringify(value,(key,item)=>{
    if(key==='serverTime'||key==='cooldownText')return undefined;
    if(key==='cooldownRemainingMs')return Number(item||0)>0;
    return item;
  });
}

function richText(value=''){
  let out=esc(value);
  out=out.replaceAll(String.fromCharCode(92)+'.','.');
  out=out.replace(/^##\\s+(.+)$/gm,'<span class="event-head">$1</span>');
  out=out.replace(/~~\\*\\*\\*([^\\n]+?)\\*\\*\\*~~/g,'<s><strong><em>$1</em></strong></s>');
  out=out.replace(/\\*\\*\\*([^\\n]+?)\\*\\*\\*/g,'<strong><em>$1</em></strong>');
  out=out.replace(/~~([^\\n]+?)~~/g,'<s>$1</s>');
  out=out.replace(/\\*\\*([^\\n]+?)\\*\\*/g,'<strong>$1</strong>');
  out=out.replace(/(^|[^*])\\*([^*\\n]+?)\\*(?!\\*)/g,'$1<em>$2</em>');
  return out;
}

function err(message=''){
  const box=$('error');
  $('errorText').textContent=message;
  box.style.display=message?'flex':'none';
}

async function api(path,body){
  const r=await fetch(path,{
    method:body?'POST':'GET',
    headers:{'content-type':'application/json','x-telegram-init-data':initData},
    body:body?JSON.stringify(body):undefined
  });
  const d=await r.json().catch(()=>({error:'Bad server response'}));
  if(!r.ok||d.error)throw new Error(d.error||'Request failed');
  return d;
}

function haptic(kind='light',notice=null){
  try{
    const h=tg&&tg.HapticFeedback;
    if(!h)return;
    if(notice)h.notificationOccurred(notice);
    else h.impactOccurred(kind);
  }catch{}
}

function clearFx(){
  const layer=$('fxLayer');
  layer.className='fx-layer';
  $('fxParticles').innerHTML='';
  $('app').classList.remove('screen-shake','glitching');
  $('hero').classList.remove('hero-event','winner-glow','final-five-glow');
  document.body.classList.remove('ambient-pulse');
}

function particles(mode,count,chars){
  const box=$('fxParticles');
  box.innerHTML='';
  for(let i=0;i<count;i++){
    const p=document.createElement('span');
    p.className='fx-particle '+mode;
    p.textContent=chars[i%chars.length];
    const angle=(Math.PI*2*i/count)+(Math.random()*.4);
    const dist=90+Math.random()*220;
    p.style.setProperty('--x',Math.round(Math.cos(angle)*dist)+'px');
    p.style.setProperty('--y',Math.round(Math.sin(angle)*dist)+'px');
    p.style.setProperty('--r',(Math.round(Math.random()*620)-310)+'deg');
    p.style.setProperty('--delay',Math.round(Math.random()*180)+'ms');
    if(mode==='confetti'){
      p.style.left=Math.round(Math.random()*100)+'%';
      p.style.top=(-5-Math.random()*15)+'%';
    }
    box.appendChild(p);
  }
}

function showFx(type,title,sub,iconKey,particleMode='burst',particleChars=['✦'],particleCount=18){
  clearFx();
  const layer=$('fxLayer');
  $('fxIcon').src=icons[iconKey]||icons.arena;
  $('fxTitle').textContent=title;
  $('fxSub').textContent=sub||'';
  layer.className='fx-layer active '+type;
  if(particleCount)particles(particleMode,particleCount,particleChars);
  $('hero').classList.add('hero-event');
  setTimeout(clearFx,2500);
}

function markRosterChanges(next,prev){
  if(!prev)return;
  const old=new Map((prev.players||[]).map(p=>[String(p.id),p]));
  for(const p of next.players||[]){
    const before=old.get(String(p.id));
    if(!before)continue;
    if(before.alive&&!p.alive)changeUntil.set(String(p.id),{kind:'out',until:Date.now()+2600});
    if(!before.alive&&p.alive)changeUntil.set(String(p.id),{kind:'back',until:Date.now()+3200});
  }
}

function triggerEventFx(next,prev){
  markRosterChanges(next,prev);
  if(prev&&prev.aliveCount>5&&next.aliveCount===5&&!finalFiveSeen){
    finalFiveSeen=true;
    showFx('finalfive','FINAL FIVE','SPECIAL EVENTS LOCK OUT','crown','burst',['Ⅴ','✦','◆'],22);
    $('hero').classList.add('final-five-glow');
    haptic('medium','warning');
    return;
  }
  if(next.status==='finished'&&(!prev||prev.status!=='finished')){
    showFx('winner','ARENA CHAMPION','ONE PLAYER REMAINS','crown','confetti',['✦','◆','●','💜'],34);
    $('hero').classList.add('winner-glow');
    haptic('heavy','success');
    return;
  }
  const ev=next.lastEvent;
  if(!ev)return;
  const key=[ev.type,ev.round,ev.at].join('|');
  if(key===lastFxKey)return;
  lastFxKey=key;
  const text=String(ev.text||'');
  if(text.includes('DWALLET GLITCH')){
    showFx('glitch','DWALLET GLITCH','SOMETHING IS OFF','warning','burst',['◉','✦','⌁'],24);
    $('app').classList.add('glitching');
    haptic('medium','warning');
    return;
  }
  if(ev.type==='mass_brawl'){
    showFx('mass','MASS BRAWL','EVERYBODY MOVE','skull','burst',['⚔','✕','◆','✦'],30);
    $('app').classList.add('screen-shake');
    haptic('heavy');
    return;
  }
  if(ev.type==='revival'){
    showFx('revival','SECOND CHANCE','ONE PLAYER RETURNS','revive','rise',['✦','●','↟'],24);
    haptic('light','success');
    return;
  }
  if(ev.type==='crowd_vote_open'){
    showFx('vote','THE CHAT CHOOSES','30 SECONDS TO VOTE','vote','burst',['◉','✦','◆'],20);
    haptic('medium','warning');
    return;
  }
  if(ev.type==='crowd_result'){
    showFx('showdown','COMMUNITY SHOWDOWN','ONE SURVIVES','vote','burst',['✕','◆','✦'],26);
    $('app').classList.add('screen-shake');
    haptic('heavy');
    return;
  }
  const lost=prev&&Number(prev.aliveCount)>Number(next.aliveCount);
  if(lost){
    showFx('elimination','ELIMINATION','THE ROSTER JUST GOT SMALLER','skull','burst',['✕','◆','✦'],16);
    $('app').classList.add('screen-shake');
    haptic('medium');
    return;
  }
  document.body.classList.remove('ambient-pulse');
  void document.body.offsetWidth;
  document.body.classList.add('ambient-pulse');
  $('hero').classList.remove('hero-event');
  void $('hero').offsetWidth;
  $('hero').classList.add('hero-event');
  haptic('light');
}

function acceptState(next,force=false){
  const signature=stateSignature(next);
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
}

async function act(action,extra={}){
  if(busy)return;
  busy=true;
  document.body.classList.add('busy');
  try{
    err();
    acceptState(await api('/telegram/api/action',{action,...extra}),true);
    scheduleRefresh();
  }catch(e){
    err(e.message);
    haptic('light','error');
  }finally{
    busy=false;
    document.body.classList.remove('busy');
  }
}

function button(label,action,cls='',iconKey=''){
  const icon=iconKey?'<img class="veil-button-icon" src="'+esc(icons[iconKey]||icons.arena)+'" alt="">':'';
  return '<button type="button" class="veil-button '+cls+'" data-action="'+action+'">'+icon+esc(label)+'</button>';
}

function statusPresentation(){
  if(!state)return {label:'CONNECTING',cls:'pending',icon:'timer'};
  if(state.status==='registration'){
    return state.playerCount>=2?{label:'READY',cls:'ready',icon:'success'}:{label:'PENDING',cls:'pending',icon:'timer'};
  }
  if(state.status==='running')return {label:'LIVE',cls:'live',icon:'arena'};
  if(state.status==='finished')return {label:'COMPLETE',cls:'ready',icon:'success'};
  return {label:String(state.status||'STATUS').toUpperCase(),cls:'pending',icon:'warning'};
}

function eventIconKey(){
  const t=String(state?.lastEvent?.type||'');
  const text=String(state?.lastEvent?.text||'');
  if(state?.status==='finished')return 'crown';
  if(text.includes('DWALLET GLITCH'))return 'warning';
  if(t==='revival')return 'revive';
  if(t==='crowd_vote_open'||t==='crowd_result')return 'vote';
  if(t==='mass_brawl')return 'skull';
  return 'timer';
}

function updateTimerOnly(){
  if(!state)return;
  const timer=$('timer');
  const timerRow=$('timerRow');
  const voteDeadline=Number(state.crowdVote?.closesAt||0);
  const voteCountdown=$('voteCountdown');
  if(voteDeadline){
    const sec=Math.max(0,Math.ceil((voteDeadline-Date.now())/1000));
    if(voteCountdown)voteCountdown.textContent=sec?sec+'s':'RESOLVING…';
    timer.textContent='';
    timerRow.style.display='none';
  }else if(state.status==='running'&&state.nextAdvanceAt){
    if(voteCountdown)voteCountdown.textContent='';
    const sec=Math.max(0,Math.ceil((state.nextAdvanceAt-Date.now())/1000));
    timer.textContent=sec?'Next event in '+sec+'s':'Resolving…';
    timerRow.style.display='flex';
  }else{
    if(voteCountdown)voteCountdown.textContent='';
    timer.textContent='';
    timerRow.style.display='none';
  }
  const now=Date.now();
  let expiredRosterFx=false;
  for(const [id,change] of changeUntil){
    if(change.until<=now){changeUntil.delete(id);expiredRosterFx=true}
  }
  if(expiredRosterFx){
    renderRoster();
    renderViewerStateCard();
  }
  const cooldown=document.querySelector('.cooldown-note');
  if(cooldown&&state.cooldownRemainingMs>0&&state.cooldownText)cooldown.textContent='Next Arena in '+state.cooldownText;
  runTimerHooks();
}

function playerVisualMode(player){
  const live=changeUntil.get(String(player.id));
  if(state.status==='finished'&&state.winnerId&&String(state.winnerId)===String(player.id))return 'winner';
  if(live?.kind==='back')return 'revived';
  return player.alive?'alive':'dead';
}

function makePlayerRow(player){
  const row=document.createElement('div');
  row.className='player asset-player-card';
  row.dataset.playerId=String(player.id);
  row.setAttribute('role','button');
  row.setAttribute('tabindex','0');
  row.innerHTML='<div class="player-portrait-token"><img class="player-state-icon" alt=""></div><div class="player-name"></div><div class="player-meta"><span class="player-kos"></span><span class="player-badge"></span></div>';
  playerRows.set(String(player.id),row);
  return row;
}

function renderRoster(){
  const roster=$('roster');
  const players=state.players||[];
  const now=Date.now();
  const liveIds=new Set(players.map(player=>String(player.id)));
  for(const [id,row] of playerRows){
    if(!liveIds.has(id)){row.remove();playerRows.delete(id)}
  }
  const empty=roster.querySelector('.empty');
  if(empty)empty.remove();
  for(const player of players){
    const id=String(player.id);
    const change=changeUntil.get(id);
    if(change&&change.until<=now)changeUntil.delete(id);
    const row=playerRows.get(id)||makePlayerRow(player);
    const mode=playerVisualMode(player);
    row.className='player asset-player-card asset-'+mode;
    const activeChange=changeUntil.get(id);
    if(activeChange?.kind==='out')row.classList.add('new-dead');
    if(activeChange?.kind==='back')row.classList.add('revived-now');
    const selectedId=state.crowdVote?.selectedId;
    if(selectedId!=null&&String(selectedId)===id)row.classList.add('asset-selected');
    row.setAttribute('aria-label','View '+String(player.displayName||'player')+' stats');
    const name=row.querySelector('.player-name');
    name.textContent=player.displayName||'Player';
    if(player.simulated){
      const bot=document.createElement('span');bot.className='bot-tag';bot.textContent='BOT';name.appendChild(bot);
    }
    const kos=row.querySelector('.player-kos');
    kos.textContent=player.eliminations?player.eliminations+' KO':'';
    kos.style.visibility=player.eliminations?'visible':'hidden';
    const badge=row.querySelector('.player-badge');
    badge.className='player-badge '+(player.alive?'alive':'dead');
    badge.textContent=mode==='revived'?'REVIVED':(player.alive?'ALIVE':'OUT');
    const icon=row.querySelector('.player-state-icon');
    icon.src=mode==='winner'?icons.crown:(mode==='dead'?icons.skull:(mode==='revived'?icons.revive:icons.arena));
    roster.appendChild(row);
  }
  if(!players.length)roster.innerHTML='<div class="empty">No players yet.</div>';
}

function renderAssetPanels(){
  const hero=$('hero');
  if(hero){
    hero.classList.remove('asset-panel-lobby','asset-panel-stats','asset-panel-results');
    if(state.status==='registration')hero.classList.add('asset-panel-lobby');
    else if(state.status==='finished')hero.classList.add('asset-panel-results');
    else hero.classList.add('asset-panel-stats');
  }
  const eventCard=$('eventCard');
  if(hero){
    hero.classList.toggle('registration-mode',state.status==='registration');
    hero.classList.toggle('host-registration',state.status==='registration'&&Boolean(state.viewer?.isHost));
    hero.classList.toggle('live-dashboard',state.status==='running');
  }
  if(eventCard)eventCard.classList.toggle('asset-panel-live',state.status==='running');
}

function renderRegistrationInline(){
  const box=$('registrationInline');
  if(!box)return;
  if(state.status!=='registration'){
    box.classList.remove('show');
    return;
  }
  const total=Math.max(1,Number(state.playerCount||0));
  const ready=Math.min(total,Number(state.readyCount||0));
  const pct=Math.max(0,Math.min(100,Math.round(ready*100/total)));
  $('registrationReady').textContent=ready+' / '+total+' READY';
  $('registrationProgress').style.width=pct+'%';
  const lock=$('registrationLock');
  const locked=Boolean(state.registrationLocked);
  lock.textContent=locked?'LOCKED':'OPEN';
  lock.classList.toggle('locked',locked);
  box.classList.add('show');
}

function renderViewerStateCard(){
  const card=$('viewerStateCard');
  if(!card)return;
  if(state.status==='registration'){
    card.style.display='none';
    return;
  }

  const viewerId=String(state.viewer?.id||'');
  const transition=changeUntil.get(viewerId);
  const revivedNow=state.status==='running'&&state.viewer?.joined&&state.viewer?.alive&&transition?.kind==='back';
  const eliminatedNow=state.status==='running'&&state.viewer?.joined&&!state.viewer?.alive&&transition?.kind==='out';

  let mode='spectator';
  let label='SPECTATOR';
  let title='YOU';
  let icon='spectate';
  let detail='Watching Arena.';

  if(state.status==='running'){
    if(revivedNow){
      mode='revived';
      label='REVIVED';
      title='BACK IN THE ARENA';
      icon='revive';
      detail='Second chance active.';
    }else if(state.viewer.alive){
      mode='alive';
      label='ALIVE';
      title='YOU';
      icon='arena';
      detail='Still alive.';
    }else if(state.viewer.joined){
      mode='dead';
      label=eliminatedNow?'ELIMINATED':'SPECTATING';
      title='OUT';
      icon='skull';
      detail=eliminatedNow
        ?'Spectator mode unlocked.'
        :state.viewer.canVote
          ?'Showdown open · vote now.'
          :'Reactions open · waiting for Showdown.';
    }else{
      mode='spectator';
      label='SPECTATOR';
      title='WATCHING';
      icon='spectate';
      detail=state.viewer.canVote
        ?'Showdown open · vote now.'
        :'Watching live · reactions open.';
    }
  }

  if(state.status==='finished'){
    const won=state.winnerId&&String(state.winnerId)===viewerId;
    if(won){
      mode='winner';
      label='WINNER';
      title='ARENA CHAMPION';
      icon='crown';
      detail='You won the Arena.';
    }else{
      mode='spectator';
      label='COMPLETE';
      title='MATCH OVER';
      icon='success';
      detail='Final result locked.';
    }
  }

  card.className='viewer-state-card asset-'+mode+(state.status==='running'?' live-compact':'')+(revivedNow?' revived-now':'')+(eliminatedNow?' new-dead':'');
  if(state.status==='running')card.style.removeProperty('display');
  else card.style.display='block';
  $('viewerStateLabel').textContent=label;
  $('viewerStateTitle').textContent=title;
  $('viewerStateDetail').textContent=detail;
  $('viewerStateIcon').src=icons[icon]||icons.spectate;
}

function currentRoundEvents(){
  const source=String(state?.lastEvent?.text||'').trim();
  if(!source)return [];
  const normalized=source.replaceAll(String.fromCharCode(92)+'.','.');
  const firstNumber=normalized.search(/^\\s*1\\.\\s+/m);
  const body=(firstNumber>=0?normalized.slice(firstNumber):normalized)
    .replace(/^\\s*[^\\n]*ROUND\\s+\\d+[^\\n]*\\n*/i,'')
    .trim();
  const parts=body
    .split(/(?=^\\s*\\d+\\.\\s+)/m)
    .map(part=>part.replace(/^\\s*\\d+\\.\\s+/,'').trim())
    .filter(Boolean);
  return (parts.length?parts:[body]).filter(Boolean).slice(0,4);
}

function renderEventText(){
  const target=$('event');
  const heading=$('eventHeading');
  if(!target)return;
  if(state.status==='running'){
    const rows=currentRoundEvents();
    const cells=(rows.length?rows:['Waiting for the next Arena event…']).slice(0,4);
    while(cells.length<4)cells.push('');
    const eventCell=text=>{
      const length=String(text||'').length;
      const density=length>280?' ultra-dense':length>190?' dense':'';
      return '<article class="live-event-entry'+density+'"><div class="live-event-copy">'+(text?richText(text):'')+'</div></article>';
    };
    target.classList.add('live-event-grid');
    if(heading)heading.textContent='ROUND '+Number(state.round||0);
    target.innerHTML='<div class="live-event-content">'+cells.map(eventCell).join('')+'</div>';
    return;
  }
  target.classList.remove('live-event-grid');
  if(heading)heading.textContent='LIVE EVENT';
  const last=state.lastEvent?.text
    ||state.displayLog?.at(-1)?.text
    ||(state.status==='registration'?'Players are entering the Arena.':'No event yet.');
  target.innerHTML=richText(last);
}

function renderCrowdVote(){
  const card=$('voteCard');
  const grid=$('voteGrid');
  if(!card||!grid)return;
  const vote=state.crowdVote;
  document.body.classList.toggle('crowd-vote-open',Boolean(vote));
  if(!vote){
    card.style.display='none';
    card.classList.remove('live');
    grid.innerHTML='';
    return;
  }

  card.style.display='block';
  card.classList.add('live');
  const totals=vote.totals||{};
  const ids=vote.eligibleIds||[];
  const totalVotes=Object.values(totals).reduce((sum,value)=>sum+Number(value||0),0);
  const selectedId=vote.selectedId==null?null:String(vote.selectedId);
  const canVote=Boolean(state.viewer?.canVote);
  const stateText=$('voteStateText');
  if(stateText)stateText.textContent=canVote?(selectedId?'VOTE LOCKED':'YOU CAN VOTE'):'SPECTATORS VOTING';

  grid.innerHTML=ids.map(id=>{
    const key=String(id);
    const player=(state.players||[]).find(item=>String(item.id)===key);
    const votes=Number(totals[id]??totals[key]??0);
    const pct=totalVotes?Math.round(votes*100/totalVotes):0;
    const selected=selectedId===key;
    const button=canVote
      ?'<button type="button" class="showdown-vote '+(selected?'selected':'')+'" data-vote="'+esc(key)+'">'+(selected?'VOTED':'VOTE')+'</button>'
      :'';
    return '<article class="showdown-contender '+(selected?'selected':'')+'">'
      +'<div class="showdown-contender-name">'+esc(player?.displayName||'Player')+'</div>'
      +'<div class="showdown-contender-sub">COMMUNITY TARGET</div>'
      +'<div class="showdown-bar"><span style="width:'+pct+'%"></span></div>'
      +'<div class="showdown-meta"><span>'+votes+' VOTE'+(votes===1?'':'S')+'</span><span>'+pct+'%</span></div>'
      +button
      +'</article>';
  }).join('')+(canVote?'':'<div class="showdown-note">You are still in the Arena. Eliminated players and spectators are choosing who enters the showdown.</div>');
}

function render(){
  if(!state)return;
  document.body.dataset.arenaPhase=state.status==='cancelled'?'finished':state.status;
  renderAssetPanels();
  renderRegistrationInline();
  const present=statusPresentation();
  const badge=$('stateBadge');
  badge.className='status-badge '+present.cls;
  badge.textContent=present.label;

  const statusText=state.status==='registration'
    ?'Registration is open'
    :state.status==='running'
      ?'Arena is live'
      :state.status==='finished'
        ?'Arena complete'
        :String(state.status||'').toUpperCase();
  $('status').textContent=statusText;
  $('statusIcon').src=icons[present.icon]||icons.arena;
  $('round').textContent=state.round;
  $('players').textContent=state.playerCount;
  $('alive').textContent=state.aliveCount;
  const rosterHeading=$('rosterHeading');
  if(rosterHeading)rosterHeading.textContent=state.status==='running'?'PLAYERS':'LIVE ROSTER';

  const frameKey=state.crowdVote?'vote':state.status;
  $('stateFrame').src=frames[frameKey]||frames.running;

  let viewerText='';
  let viewerIcon='spectate';
  if(state.status==='registration'){
    viewerText=state.viewer.joined
      ?(state.viewer.isHost?'You are hosting this Arena.':'You are registered for this Arena.')
      :'You are watching registration. Join before the host starts.';
    viewerIcon=state.viewer.joined?'success':'spectate';
  }else if(state.status==='running'){
    const viewerTransition=changeUntil.get(String(state.viewer?.id||''));
    if(state.viewer.alive&&viewerTransition?.kind==='back'){viewerText='Back in the Arena. You are alive again.';viewerIcon='revive'}
    else if(state.viewer.alive){viewerText='You are still alive in the Arena.';viewerIcon='arena'}
    else if(state.viewer.joined){viewerText=state.viewer.canVote?'You are out. Community Showdown is open.':'You are out. Spectating the Arena.';viewerIcon='skull'}
    else{viewerText=state.viewer.canVote?'Community Showdown is open.':'Spectator mode.';viewerIcon='spectate'}
  }else if(state.status==='finished'){
    const won=state.winnerId&&String(state.winnerId)===String(state.viewer.id);
    viewerText=won?'You won the Arena.':'Match complete. Final result locked.';
    viewerIcon=won?'crown':'success';
  }else{
    viewerText='Arena status: '+String(state.status||'unknown');
    viewerIcon='warning';
  }
  $('viewerText').textContent=viewerText;
  $('viewerIcon').src=icons[viewerIcon]||icons.spectate;

  let controls='';
  if(state.status==='registration'){
    if(!state.viewer.joined)controls+=button('JOIN ARENA','join','primary','arena');
    else if(!state.viewer.isHost)controls+=button('LEAVE','leave','','spectate');
    if(state.viewer.isHost){
      controls+=button('START ARENA','start','primary','success');
      if(state.testMode){
        controls+=button('ADD 4 BOTS','add4','','stats');
        controls+=button('FILL TO 12','fill','','leaderboard');
      }
    }
  }
  $('controls').innerHTML=controls;

  renderEventText();
  $('eventIcon').src=icons[eventIconKey()]||icons.timer;

  updateTimerOnly();
  renderRoster();
  renderViewerStateCard();

  renderCrowdVote();

  runRenderHooks();
}

document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action]');
  if(a)act(a.dataset.action);
  const v=e.target.closest('[data-vote]');
  if(v)act('vote',{targetId:v.dataset.vote});
});

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

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

if(!afterdarkPreview){
  bootTelegram();
  setInterval(updateTimerOnly,500);
  document.addEventListener('visibilitychange',()=>scheduleRefresh(250));
}
</script>
</body>
</html>`;
}
