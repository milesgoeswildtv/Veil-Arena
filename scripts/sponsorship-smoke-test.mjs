import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  upsertSponsorship,
  calculatePayouts,
  payoutReportText,
  sponsorshipSummary,
  SPONSOR_AWARDS
} from "../src/sponsorships.js";
import { applyTelegramPrizePack } from "../src/telegram-prize-pack.js";
import { applyTelegramProductPass } from "../src/telegram-product-pass.js";
import { telegramFxMiniAppHtml } from "../src/telegram-fx-app.js";
import { buildTelegramMiniAppHtml } from "../src/telegram-ui.js";
import {
  compileTelegramVisualManifest,
  TELEGRAM_VISUAL_DEFAULT_MANIFEST,
  TELEGRAM_VISUAL_CAPABILITIES
} from "../src/telegram-visual-contract.js";

const game = {
  id: "test-arena",
  status: "registration",
  winnerId: null,
  sponsorships: [],
  players: {
    a: { id: "a", displayName: "Sam", alive: true, eliminations: 0, revivals: 0, crowdPinsSurvived: 0 },
    b: { id: "b", displayName: "Crek", alive: true, eliminations: 0, revivals: 0, crowdPinsSurvived: 0 },
    c: { id: "c", displayName: "Peach", alive: true, eliminations: 0, revivals: 0, crowdPinsSurvived: 0 }
  },
  history: []
};

const sam = upsertSponsorship(game, { id: "s1", displayName: "Sam" }, { winner: 5, most_kills: 2 });
assert.equal(sam.awards.winner, 500);
assert.equal(sam.awards.most_kills, 200);
assert(sponsorshipSummary(game).includes("Sam sponsors this Arena"));

const crek = upsertSponsorship(game, { id: "s2", displayName: "Crek" }, { winner: 10, runner_up: 3 });
assert.equal(crek.awards.winner, 1000);
assert.equal(game.sponsorships.length, 2);

upsertSponsorship(game, { id: "s1", displayName: "Sam" }, { winner: 5, most_kills: 4 });
assert.equal(game.sponsorships.length, 2);
assert.equal(game.sponsorships.find(item => item.sponsorId === "s1").awards.most_kills, 400);

game.status = "finished";
game.winnerId = "a";
game.players.a.eliminations = 3;
game.players.b.eliminations = 3;
game.players.c.eliminations = 1;
game.players.a.alive = true;
game.players.b.alive = false;
game.players.c.alive = false;
game.history.push(
  { type: "elimination", playerId: "c", round: 8 },
  { type: "elimination", playerId: "b", round: 9 }
);

const result = calculatePayouts(game);
const samKill = result.awards.find(item => item.sponsorId === "s1" && item.awardId === "most_kills");
assert.equal(samKill.shares.length, 2);
assert.deepEqual(samKill.shares.map(item => item.cents), [200, 200]);
const winnerAwards = result.awards.filter(item => item.awardId === "winner");
assert.equal(winnerAwards.reduce((sum, item) => sum + item.shares[0].cents, 0), 1500);
const runner = result.awards.find(item => item.awardId === "runner_up");
assert.equal(runner.shares[0].playerId, "b");
assert.equal(runner.shares[0].cents, 300);

const report = payoutReportText(game);
assert(report.includes("SPONSORED ARENA — PAYOUT REPORT"));
assert(report.includes("Sam"));
assert(report.includes("Crek"));
assert(report.includes("$5.00"));
assert(report.includes("$10.00"));
assert.throws(() => upsertSponsorship(game, { id: "s3", displayName: "Late" }, { winner: 1 }), /lock/i);

const labels = Object.fromEntries(SPONSOR_AWARDS.map(item => [item.id, item.label]));
assert.equal(labels.most_kills, "Most Eliminations");
assert.equal(labels.most_showdowns, "Most Community Showdowns Survived");
assert.equal(labels.most_mass_brawls, "Most Mass Brawls Survived");

const sponsorUi = applyTelegramPrizePack("<!doctype html><html><head></head><body></body></html>");
assert(sponsorUi.includes('data-arena-view="arena"'));
assert(sponsorUi.includes('data-arena-view="sponsor"'));
assert(sponsorUi.includes('data-arena-view="more"'));
assert(sponsorUi.includes("SPONSOR THE ARENA"));
assert(sponsorUi.includes("HOW TO USE"));
assert(sponsorUi.includes("BackButton"));
assert(sponsorUi.includes("CHECK FUNDING"));
assert(!sponsorUi.includes("prizePoolCard"));

assert(sponsorUi.includes("bindSponsorHelp"));
assert(sponsorUi.includes("touchend"));
assert(sponsorUi.includes("z-index:5000"));

const baseUi = telegramFxMiniAppHtml();
assert(baseUi.includes("function stateSignature"));
assert(baseUi.includes("key==='serverTime'||key==='cooldownText'"));
assert(baseUi.includes("key==='cooldownRemainingMs'"));
assert(baseUi.includes("const playerRows=new Map()"));
assert(baseUi.includes("function renderRoster()"));
assert(baseUi.includes("veil_ui_player_card.svg"));
assert(baseUi.includes("veil_ui_player_state_alive.svg"));
assert(baseUi.includes('id="registrationInline"'));
assert(baseUi.includes("function renderRegistrationInline"));
assert(baseUi.includes("ADD 4 BOTS"));
assert(baseUi.includes("aspect-ratio:2.72/1"));
assert(baseUi.includes(".roster{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--av-roster-gap,7px)}"));
assert(baseUi.includes(".roster .player:last-child:nth-child(odd)"));
assert(baseUi.includes(".player-badge{min-width:48px;height:18px"));
assert(baseUi.includes(".hero-panel.live-dashboard"));
assert(baseUi.includes('class="arena-live-logo" src="/telegram/CrashoutArenaLogoNew.svg"'));
assert(baseUi.includes('"status logo host"'));
assert(baseUi.includes("#hero.asset-panel-stats.live-dashboard{"));
assert(baseUi.includes(".hero-panel.registration-mode .arena-live-logo{"));
assert(baseUi.includes(".hero-panel.registration-mode .status-line{\n  display:none;"));
assert(baseUi.includes('body[data-arena-phase="registration"] #stateBadge{'));
assert(baseUi.includes("width:96px;"));
assert(baseUi.includes("transform:translate(-14px,34px)"));
assert(baseUi.includes(".hero-panel.registration-mode .arena-title{width:215px;max-width:72%;margin:-16px auto -8px;transform:translateX(0)}"));
assert(baseUi.includes(".hero-panel.registration-mode .arena-live-logo{width:100%;height:auto;max-height:96px}"));
assert(baseUi.includes('class="pregame-ready-stage"'));
assert(baseUi.includes('src="/telegram/crashout%20ui/PregameReadyCheckFrame.PNG"'));
assert(baseUi.includes(".pregame-ready-stage{display:contents}"));
assert(baseUi.includes("#hero.asset-panel-lobby.registration-mode:before{display:none}"));
assert(baseUi.includes("aspect-ratio:3/1"));
assert(baseUi.includes("body[data-arena-phase=\"registration\"][data-arena-view=\"arena\"] #hero.registration-mode .registration-inline{"));
assert(baseUi.includes("body[data-arena-phase=\"registration\"][data-arena-view=\"arena\"] #hero.registration-mode .stats{"));
assert(baseUi.includes("body[data-arena-phase=\"registration\"][data-arena-view=\"arena\"] .roster-panel .section-head{transform:translate(64px,-35px)}"));
assert(baseUi.includes(".hero-panel.live-dashboard .arena-heading{\n  display:contents;"));
assert(baseUi.includes(".hero-panel.live-dashboard .arena-title{width:220px;margin:-2px 0 -4px}"));
assert(baseUi.includes(".hero-panel.live-dashboard .arena-live-logo{width:100%;height:auto;max-height:108px}"));
assert(!baseUi.includes("DWALLET ARENA // POWERED BY VEIL"));
assert(baseUi.includes("function renderEventText"));
assert(baseUi.includes("function currentRoundEvents"));
assert(baseUi.includes("replaceAll(String.fromCharCode(92)+'.','.')"));
assert(baseUi.includes(".split(/(?=^\\s*\\d+\\.\\s+)/m)"));
assert(baseUi.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
assert(baseUi.includes('id="liveEventStage"'));
assert(baseUi.includes('class="live-event-plate"'));
assert(baseUi.includes('src="/telegram/NewEventBackgroundPlate.PNG"'));
assert(baseUi.includes("#eventCard.asset-panel-live .section-head{"));
assert(baseUi.includes("justify-content:center"));
assert(baseUi.includes("#eventCard.asset-panel-live .section-head h2{\n  width:100%;\n  text-align:center;"));
assert(baseUi.includes(".live-event-plate{"));
assert(baseUi.includes("height:100%"));
assert(baseUi.includes("object-fit:fill"));
assert(baseUi.includes("transform:scale(1.04,1.28)"));
assert(baseUi.includes("#eventCard.asset-panel-live .live-event-stage{\n  padding:clamp(10px,1.4vw,14px) clamp(8px,1.2vw,12px) clamp(12px,1.7vw,18px);\n  overflow:visible;"));
assert(baseUi.includes("grid-template-columns:repeat(2,minmax(0,1fr));"));
assert(baseUi.includes('.live-event-content{'));
assert(baseUi.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert(baseUi.includes('.live-event-entry{\n  min-width:0;\n  min-height:0;\n  padding:clamp(7px,.9vw,10px) clamp(7px,1.05vw,12px);\n  background:transparent;'));
assert(baseUi.includes("ultra-dense"));
assert(!baseUi.includes('background:url("/telegram/NewEventBackgroundPlate.PNG") center/100% 100% no-repeat'));
assert(baseUi.includes('.readout{'));
assert(baseUi.includes('background:url("/telegram/input_frame.svg") center/100% 100% no-repeat;'));
assert(baseUi.includes("function renderCrowdVote"));
assert(baseUi.includes("ELIMINATED"));
assert(baseUi.includes("BACK IN THE ARENA"));
assert(baseUi.includes("Spectator mode unlocked"));
assert(baseUi.includes("mode==='revived'?'REVIVED'"));
assert(baseUi.includes("renderViewerStateCard();"));
assert(baseUi.includes("/* VIEWER STATUS: canonical visual owner. Do not add breakpoint overrides elsewhere. */"));
assert(baseUi.includes(".viewer-state-card.live-compact{"));
assert(baseUi.includes("width:max-content"));
assert(baseUi.includes("max-width:min(calc(100% - 16px),420px)"));
assert(baseUi.includes("min-height:36px"));
assert(baseUi.includes("margin:7px auto 2px"));
assert(baseUi.includes("padding:5px 10px"));
assert(baseUi.includes("border-radius:999px"));
assert(baseUi.includes("if(state.status==='running')card.style.removeProperty('display')"));
assert(!baseUi.includes(".event>:not(.live-event-plate)"));
assert(baseUi.includes("/* LIVE EVENT: canonical visual owner. Plate + heading + 2x2 copy move as one stage. */"));
assert.equal(baseUi.split(".viewer-state-card{").length-1,1);
assert.equal(baseUi.split(".viewer-state-card.live-compact{").length-1,1);
assert.equal(baseUi.split("\n.live-event-stage{").length-1,1);
assert.equal(baseUi.split(".live-event-grid{").length-1,1);
assert.equal(baseUi.split(".live-event-content{").length-1,1);
assert.equal(baseUi.split(".live-event-entry{").length-1,1);
assert.equal(baseUi.split("\n.live-event-copy{").length-1,1);
assert(baseUi.includes("Showdown open · vote now."));
assert(baseUi.includes("Reactions open · waiting for Showdown."));
assert(!baseUi.includes(".viewer-state-card.live-compact{\n  width:100%;\n  min-height:72px"));
assert(baseUi.includes("showdown-contender"));
assert(baseUi.includes("voteCountdown"));
assert(baseUi.includes("YOU CAN VOTE"));
assert(baseUi.includes("SPECTATORS VOTING"));
assert(baseUi.includes("state.crowdVote?.closesAt"));
assert(baseUi.includes("crowd-vote-open"));
assert(baseUi.includes("slice(0,4)"));
assert(baseUi.includes("eventHeading"));
assert(baseUi.includes("heading.textContent='ROUND '"));
assert(!baseUi.includes("PREVIOUS"));
assert(!baseUi.includes("live-event-label"));
assert(baseUi.includes("rosterHeading"));
assert(baseUi.includes("live-compact"));
assert(baseUi.includes("hero.classList.toggle('host-registration'"));
assert(baseUi.includes("if(state.status==='registration'){\n    card.style.display='none'"));
assert(baseUi.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
assert(baseUi.includes(".hero-panel.host-registration #viewerReadout{display:none}"));
assert(baseUi.includes("setInterval(updateTimerOnly,500)"));
assert(!baseUi.includes("setInterval(()=>{if(state)render()},500)"));

assert(baseUi.includes("--tg-viewport-stable-height"));
assert(baseUi.includes("disableVerticalSwipes"));
assert(baseUi.includes("function registerRenderHook"));
assert(baseUi.includes("function registerTimerHook"));
assert(baseUi.includes("const afterdarkPreview=new URLSearchParams(location.search).get('afterdarkPreview')==='1'"));
assert(baseUi.includes("--av-event-padding:15px"));
assert(baseUi.includes("var(--av-event-padding,15px)"));
assert(baseUi.includes("var(--av-roster-gap,8px)"));

const compiledVisuals = compileTelegramVisualManifest(structuredClone(TELEGRAM_VISUAL_DEFAULT_MANIFEST));
assert(compiledVisuals.css.includes("--av-event-padding:15px"));
assert(compiledVisuals.css.includes("@media(max-width:440px)"));
assert(!compiledVisuals.css.includes("!important"));
assert.equal(compiledVisuals.assets.eventPlate, "/telegram/NewEventBackgroundPlate.PNG");
assert.deepEqual(compiledVisuals.capabilities, TELEGRAM_VISUAL_CAPABILITIES);
assert.throws(
  () => compileTelegramVisualManifest({ ...structuredClone(TELEGRAM_VISUAL_DEFAULT_MANIFEST), projectId: "not-arena" }),
  /Wrong visual project manifest/
);

const composedUi = buildTelegramMiniAppHtml();
const count = (text, needle) => text.split(needle).length - 1;

// Canonical visual ownership: accepted assets and layout now live in the base UI.
assert(baseUi.includes('class="arena-splash-bg"'));
assert(baseUi.includes('id="viewerStateCard"'));
assert(baseUi.includes('id="finalFiveStrip"'));
assert(!baseUi.includes('class="sponsorship-card"'));
assert(!baseUi.includes("DWALLET × VEIL"));
assert(baseUi.includes("veil_ui_player_state_revived.svg"));
assert(baseUi.includes("#eventCard.asset-panel-live:before{display:none;background:none}"));
assert(baseUi.includes("#eventCard.asset-panel-live{\n  background:transparent;"));
assert(baseUi.includes(".roster-panel:before{display:none;background:none}"));
assert(baseUi.includes("#hero.asset-panel-lobby{padding:14px 12px 7px}"));
assert(baseUi.includes("#hero.asset-panel-stats{padding:10px 9px}"));
assert(baseUi.includes("#eventCard.asset-panel-live{padding:10px 8px}"));
assert(baseUi.includes("#voteCard{padding:11px 9px}"));
assert(!baseUi.includes("veil_ui_live_round_panel.svg"));

// The exact production composition is now testable through one canonical builder.
assert(composedUi.includes('id="veil-feature-pack-css"'));
assert(composedUi.includes('id="veil-prize-pack-css"'));
assert(composedUi.includes('id="veil-product-pass-css"'));
assert(composedUi.includes('/sfx/veil-sfx-core.js'));
assert(composedUi.includes('/sfx/veil-telegram-music.js'));
assert(composedUi.includes('id="afterdark-visual-editor-adapter"'));
assert(composedUi.includes("afterdark:ready"));
assert(composedUi.includes("afterdark:manifest"));
assert.equal(count(composedUi, 'id="afterdark-visual-editor-adapter"'), 1);
assert.equal(count(composedUi, 'id="viewerStateCard"'), 1);
assert.equal(count(composedUi, 'id="finalFiveStrip"'), 1);
assert.equal(count(composedUi, 'class="arena-splash-bg"'), 1);
assert.equal(count(composedUi, 'class="sponsorship-card"'), 0);
assert(!composedUi.includes("background:none!important"));

const statsPanelSource = readFileSync(new URL("../assets/telegram/veil_ui_stats_panel.svg", import.meta.url), "utf8");
assert(statsPanelSource.includes('preserveAspectRatio="none"'));

const pregameHeaderAsset = readFileSync(new URL("../assets/telegram/crashout ui/PregameLobbyHeader.PNG", import.meta.url));
const pregameReadyAsset = readFileSync(new URL("../assets/telegram/crashout ui/PregameReadyCheckFrame.PNG", import.meta.url));
assert(pregameHeaderAsset.length > 1000);
assert(pregameReadyAsset.length > 1000);

const syncAssetsSource = readFileSync(new URL("../scripts/sync-telegram-assets.mjs", import.meta.url), "utf8");
assert(syncAssetsSource.includes("async function copySupportedTree"));
assert(syncAssetsSource.includes("await copySupportedTree(source, destination)"));

const visualAdapterSource = readFileSync(new URL("../src/telegram-visual-editor-adapter.js", import.meta.url), "utf8");
assert(!visualAdapterSource.includes("../core/"));
assert(!visualAdapterSource.includes("/telegram/api/action"));
assert(visualAdapterSource.includes("CAPABILITIES"));
assert(visualAdapterSource.includes("'arena.eventPlate':'#liveEventStage'"));
assert(visualAdapterSource.includes("querySelectorAll('.live-event-plate')"));
assert(visualAdapterSource.includes("stopImmediatePropagation"));

const packageSource = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert(packageSource.scripts["build:activity-client"].startsWith("npm run build:visuals"));
assert(packageSource.scripts.test.startsWith("npm run build:visuals"));

const workerSource = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
assert(!workerSource.includes("telegram-performance.js"));
assert(!workerSource.includes("telegram-ui-polish.js"));
assert(!workerSource.includes("telegram-miniapp-assets-batch2.js"));
assert(!workerSource.includes("telegram-miniapp-assets-batch3.js"));
assert(workerSource.includes('buildTelegramMiniAppHtml()'));

const featureApiSource = readFileSync(new URL("../src/telegram-feature-api.js", import.meta.url), "utf8");
assert(!featureApiSource.includes("state.serverTime = Date.now()"));

const featurePackSource = readFileSync(new URL("../src/telegram-feature-pack.js", import.meta.url), "utf8");
assert(featurePackSource.includes("registerRenderHook(renderFeaturePack)"));
assert(featurePackSource.includes("[ EMOJIS ]"));
assert(featurePackSource.includes("viewerState.insertAdjacentHTML('afterend'"));
assert(featurePackSource.includes("data-reaction-toggle"));
assert(featurePackSource.includes("aria-controls=\"reactionChoices\""));
assert(featurePackSource.includes(".reaction-toggle"));
assert(featurePackSource.includes(".reaction-choices"));
assert(featurePackSource.includes(".reaction-bar.open .reaction-choices{display:grid}"));
assert(featurePackSource.includes("let reactionsOpen = false"));
assert(!featurePackSource.includes("SPECTATOR REACTIONS"));
assert(!featurePackSource.includes("REACT WHILE YOU WATCH"));
assert(!featurePackSource.includes("position:sticky;bottom:8px"));
assert(!featurePackSource.includes("SHOWDOWN VOTING OPENS HERE"));
assert(!featurePackSource.includes(".reaction-label"));
assert(!featurePackSource.includes("function renderVoteProgress"));
assert(!featurePackSource.includes("vote-progress-row"));
assert(!featurePackSource.includes("function renderHostTools"));
assert(!featurePackSource.includes("function renderRecap"));
assert(!featurePackSource.includes('id="hostTools"'));
assert(!featurePackSource.includes('id="recapPanel"'));
assert(!featurePackSource.includes("strip=document.createElement"));
assert(featurePackSource.includes("registerTimerHook(renderPausedTimer)"));
assert(!featurePackSource.includes("render=function featureRender"));
assert(featurePackSource.includes("width:94px"));
assert(featurePackSource.includes('body[data-arena-phase="registration"] #connectionChip{transform:translateY(46px)}'));
assert(featurePackSource.includes("text.textContent=mode==='live'?'LIVE':mode==='offline'?'OFFLINE':'SYNCING'"));
assert(!featurePackSource.includes("setConnection('syncing');\n    try{ const result=await originalApi"));

const productPassSource = readFileSync(new URL("../src/telegram-product-pass.js", import.meta.url), "utf8");
assert(productPassSource.includes("registerRenderHook(renderProductPass)"));
assert(productPassSource.includes("⚙ HOST CONTROLS"));
assert(productPassSource.includes("#hero.live-dashboard #hostTrigger"));
assert(productPassSource.includes("margin-top:5px;min-height:36px"));
assert(productPassSource.includes('#hero.registration-mode #hostTrigger.show'));
assert(productPassSource.includes("top:-20px;left:79px;width:84px;min-width:84px;min-height:28px;padding:0 6px;font-size:7px"));
assert(!productPassSource.includes('body[data-arena-phase="running"][data-arena-view="arena"] .main-grid'));
assert(!productPassSource.includes("body.crowd-vote-open #eventCard"));
assert(!productPassSource.includes("document.body.dataset.arenaPhase=phase()"));
assert(!productPassSource.includes("#controls [data-feature-action"));
assert(!productPassSource.includes("render=function productRender"));

const prizePackSource = readFileSync(new URL("../src/telegram-prize-pack.js", import.meta.url), "utf8");
assert(prizePackSource.includes("width:86%;max-width:620px"));
assert(prizePackSource.includes("margin:-10px auto 4px"));
assert(prizePackSource.includes("min-height:30px"));
assert(prizePackSource.includes("body[data-arena-phase=\"running\"][data-arena-view=\"arena\"] .arena-nav{margin-top:-30px}"));
assert(prizePackSource.includes(".arena-nav{width:84%;gap:3px;padding:2px;margin-top:-12px}"));
assert(prizePackSource.includes("body[data-arena-phase=\"running\"][data-arena-view=\"arena\"] .arena-nav{margin-top:-38px}"));
assert(prizePackSource.includes('PregameLobbyHeader.PNG'));
assert(prizePackSource.includes('body[data-arena-phase="registration"] .arena-nav'));
assert(prizePackSource.includes('>SPONSORS<span'));
assert(prizePackSource.includes("registerRenderHook(renderSponsor)"));
assert(!prizePackSource.includes("render=function prizeRender"));

const productUi = applyTelegramProductPass("<!doctype html><html><head></head><body></body></html>");
assert(productUi.includes("ARENA CHAMPION"));
assert(!productUi.includes('id="phaseBrief"'));
assert(productUi.includes("HOST CONTROL"));
assert(productUi.includes("SHARE RESULTS"));
assert(productUi.includes("SHOWDOWN SURVIVORS"));
assert(productUi.includes("data-product-player-id"));
assert(productUi.includes("lastResultsKey"));

console.log("Arena sponsorship core and Telegram product UI tests passed.");
