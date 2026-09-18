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
import { applyTelegramMiniAppAssetBatch3 } from "../src/telegram-miniapp-assets-batch3.js";

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

const batch2Source = readFileSync(new URL("../src/telegram-miniapp-assets-batch2.js", import.meta.url), "utf8");
assert(batch2Source.includes("aspect-ratio:2.72/1"));

const assetUi = applyTelegramMiniAppAssetBatch3(baseUi);
assert(assetUi.includes(".roster-panel:before{display:none!important"));
assert(assetUi.includes("#hero.asset-panel-lobby{padding:14px 12px 7px}"));
assert(assetUi.includes(".roster-panel{padding:10px 0 0!important"));
assert(!assetUi.includes("decorateAssetBatch3"));

const workerSource = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
assert(!workerSource.includes("telegram-performance.js"));
assert(!workerSource.includes("telegram-ui-polish.js"));

const featureApiSource = readFileSync(new URL("../src/telegram-feature-api.js", import.meta.url), "utf8");
assert(!featureApiSource.includes("state.serverTime = Date.now()"));

const featurePackSource = readFileSync(new URL("../src/telegram-feature-pack.js", import.meta.url), "utf8");
assert(featurePackSource.includes("registerRenderHook(renderFeaturePack)"));
assert(featurePackSource.includes("registerTimerHook(renderPausedTimer)"));
assert(!featurePackSource.includes("render=function featureRender"));
assert(featurePackSource.includes("width:94px"));
assert(featurePackSource.includes("text.textContent=mode==='live'?'LIVE':mode==='offline'?'OFFLINE':'SYNCING'"));
assert(!featurePackSource.includes("setConnection('syncing');\n    try{ const result=await originalApi"));

const productPassSource = readFileSync(new URL("../src/telegram-product-pass.js", import.meta.url), "utf8");
assert(productPassSource.includes("registerRenderHook(renderProductPass)"));
assert(productPassSource.includes("margin-top:5px;min-height:36px"));
assert(!productPassSource.includes('body[data-arena-phase="registration"] #hero .controls{grid-template-columns:repeat(2'));
assert(!productPassSource.includes("render=function productRender"));

const prizePackSource = readFileSync(new URL("../src/telegram-prize-pack.js", import.meta.url), "utf8");
assert(prizePackSource.includes("min-height:38px"));
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
