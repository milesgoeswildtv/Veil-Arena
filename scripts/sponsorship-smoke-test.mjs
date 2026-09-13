import assert from "node:assert/strict";
import {
  upsertSponsorship,
  calculatePayouts,
  payoutReportText,
  sponsorshipSummary,
  SPONSOR_AWARDS
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

console.log("Arena sponsorship core tests passed.");
