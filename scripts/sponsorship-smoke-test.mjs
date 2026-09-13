import assert from "node:assert/strict";
import fs from "node:fs";
import { arenaCommands } from "../src/discord.js";
import { ACTIVITY_PREVIEW_CLIENT } from "../src/activity-preview-client.js";
import { SPONSOR_PANEL_CLIENT } from "../src/sponsor-panel-client.js";
import {
  upsertSponsorship,
  calculatePayouts,
  payoutReportText,
  sponsorshipSummary
} from "../src/sponsorships.js";

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
assert.equal(game.sponsorships.find(x => x.sponsorId === "s1").awards.most_kills, 400);

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
const samKill = result.awards.find(x => x.sponsorId === "s1" && x.awardId === "most_kills");
assert.equal(samKill.shares.length, 2);
assert.deepEqual(samKill.shares.map(x => x.cents), [200, 200]);
const winnerAwards = result.awards.filter(x => x.awardId === "winner");
assert.equal(winnerAwards.reduce((sum, x) => sum + x.shares[0].cents, 0), 1500);
const runner = result.awards.find(x => x.awardId === "runner_up");
assert.equal(runner.shares[0].playerId, "b");
assert.equal(runner.shares[0].cents, 300);
const report = payoutReportText(game);
assert(report.includes("SPONSORED ARENA — PAYOUT REPORT"));
assert(report.includes("Sam"));
assert(report.includes("Crek"));
assert(report.includes("$5.00"));
assert(report.includes("$10.00"));

assert.throws(() => upsertSponsorship(game, { id: "s3", displayName: "Late" }, { winner: 1 }), /lock/i);

const arena = arenaCommands().find(x => x.name === "arena");
const sponsor = arena.options.find(x => x.name === "sponsor");
assert(sponsor);
for (const field of ["winner","runner_up","most_kills","most_revivals","most_showdowns","most_mass_brawls"]) {
  assert(sponsor.options.some(x => x.name === field), `Missing Discord sponsor field ${field}`);
}

new Function(ACTIVITY_PREVIEW_CLIENT);
new Function(SPONSOR_PANEL_CLIENT);
assert(ACTIVITY_PREVIEW_CLIENT.includes("data-fx"));
assert(ACTIVITY_PREVIEW_CLIENT.includes("CONTROLS ONLINE"));
assert(ACTIVITY_PREVIEW_CLIENT.includes("CONTROLS FAILED"));
assert(SPONSOR_PANEL_CLIENT.includes("/telegram/miniapp/sponsor"));

const activityEntry = fs.readFileSync(new URL("../src/activity-entry.js", import.meta.url), "utf8");
assert(activityEntry.includes('url.pathname === "/activity-preview/health"'));
assert(activityEntry.includes('url.pathname === "/setup/discord"'));
assert(activityEntry.includes('url.pathname === "/admin/discord/register"'));
assert(activityEntry.includes("registerGuildCommands"));
assert(activityEntry.includes("/arena sponsor"));

console.log("Arena sponsorship + Discord Activity/setup smoke tests passed.");
