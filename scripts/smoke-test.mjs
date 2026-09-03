import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  startGame,
  beginNextRound,
  resolveNormalRound,
  getRoundPhases,
  getCrowdQualifiers,
  openCrowdVote,
  castCrowdVote,
  resolveCrowdVote,
  eliminate,
  resolveRevivalPit,
  specialEventsEnabled,
  SPECIAL_EVENT_CUTOFF,
  NORMAL_OUTCOMES_PER_ROUND
} from "../src/core/engine.js";
import {
  addFakeContestants,
  setSimulatedCrowd,
  castSimulatedCrowdVotes
} from "../src/core/simulation.js";
import { VQS_HORROR_COMBINATORIAL_COUNT } from "../src/themes/vibe_queen_slots/horror-combinatorial.js";
import { FULL_TILT_MEGA_COUNT } from "../src/themes/full_tilt/gamba-mega.js";
import { getTheme, themeNarrationCount } from "../src/themes/index.js";

function fakePlayer(id) { return { id, username: id, displayName: id.toUpperCase() }; }

assert.equal(SPECIAL_EVENT_CUTOFF, 5);
assert.equal(NORMAL_OUTCOMES_PER_ROUND, 4);
assert.equal(VQS_HORROR_COMBINATORIAL_COUNT >= 10000, true);
assert.equal(FULL_TILT_MEGA_COUNT, 5000);
const fullTilt = getTheme("full_tilt");
assert.equal(fullTilt.id, "full_tilt");
assert.equal(themeNarrationCount(fullTilt) >= 10000, true);
assert.equal(fullTilt.playerKills.length >= 7000, true);
assert.equal(fullTilt.selfKills.length >= 1900, true);
assert.equal(fullTilt.pinDuels.length >= 1000, true);
assert.equal(fullTilt.revivalDuels.length >= 1000, true);
assert.equal(fullTilt.multiPins.length >= 500, true);
assert.equal(fullTilt.normalEvents.length >= 1000, true);
assert.equal(fullTilt.rareEvents.length >= 500, true);

assert.deepEqual(getRoundPhases(3), ["normal", "revival"]);
assert.deepEqual(getRoundPhases(5), ["normal", "crowd_vote"]);
assert.deepEqual(getRoundPhases(15), ["normal", "revival"]);

assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 15 }), ["a", "b"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 21, c: 21 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 15 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 22 }), ["a", "b", "c", "d"]);

const roundGame = createGame({ guildId: "g", channelId: "round", hostId: "p1" });
for (let i = 1; i <= 20; i++) addPlayer(roundGame, fakePlayer(`p${i}`));
startGame(roundGame);
beginNextRound(roundGame);
const batch = resolveNormalRound(roundGame, () => 0.5);
assert.equal(batch.type, "normal_round_batch");
assert.equal(batch.outcomes.length, 4);
assert.equal(batch.eliminatedIds.length >= 1, true);
assert.equal(roundGame.aliveIds.length <= 19, true);

const game = createGame({ guildId: "g", channelId: "c", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f"]) addPlayer(game, fakePlayer(id));
startGame(game);
assert.equal(specialEventsEnabled(game), true);
openCrowdVote(game);
for (const [voter, choice] of [["x1", "a"], ["x2", "a"], ["x3", "b"], ["x4", "c"]]) castCrowdVote(game, voter, choice);
const crowd = resolveCrowdVote(game, () => 0);
assert.deepEqual(crowd.qualifiers, ["a", "b", "c"]);
assert.equal(crowd.survivorId, "a");
assert.equal(game.players.b.alive, false);
assert.equal(game.players.c.alive, false);

const finalFive = createGame({ guildId: "g", channelId: "f5", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f", "g"]) addPlayer(finalFive, fakePlayer(id));
startGame(finalFive);
eliminate(finalFive, "f", "test");
eliminate(finalFive, "g", "test");
assert.equal(finalFive.aliveIds.length, 5);
assert.equal(specialEventsEnabled(finalFive), false);
assert.equal(openCrowdVote(finalFive), null);
const skippedRevival = resolveRevivalPit(finalFive, () => 0);
assert.equal(skippedRevival.type, "revival_skipped");
assert.equal(skippedRevival.reason, "final_five");

const revivalGame = createGame({ guildId: "g", channelId: "r", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) addPlayer(revivalGame, fakePlayer(id));
startGame(revivalGame);
eliminate(revivalGame, "g", "test");
eliminate(revivalGame, "h", "test");
assert.equal(revivalGame.aliveIds.length, 6);
const revival = resolveRevivalPit(revivalGame, () => 0);
assert.equal(revival.type, "revival_pit");
assert.equal(revivalGame.players[revival.winnerId].alive, true);
assert.equal(revivalGame.aliveIds.length, 7);

const simGame = createGame({ guildId: "g", channelId: "sim", hostId: "host" });
addPlayer(simGame, fakePlayer("host"));
const added = addFakeContestants(simGame, 12);
assert.equal(added.length, 12);
assert.equal(simGame.aliveIds.length, 13);
assert.equal(added.every(id => simGame.players[id].simulated === true), true);
setSimulatedCrowd(simGame, true);
startGame(simGame);
openCrowdVote(simGame);
const fakeVotes = castSimulatedCrowdVotes(simGame, () => 0.5);
assert.equal(fakeVotes >= 24, true);
assert.equal(Object.values(simGame.crowdVote.totals).reduce((sum, votes) => sum + votes, 0), fakeVotes);
const simCrowd = resolveCrowdVote(simGame, () => 0);
assert.equal(simCrowd.qualifiers.length >= 2, true);

const paceGame = createGame({ guildId: "g", channelId: "pace", hostId: "p1" });
for (let i = 1; i <= 20; i++) addPlayer(paceGame, fakePlayer(`p${i}`));
startGame(paceGame);
let guard = 0;
while (paceGame.aliveIds.length > 1 && guard < 30) {
  const { phases } = beginNextRound(paceGame);
  resolveNormalRound(paceGame, () => 0.5);
  if (phases.includes("revival") && specialEventsEnabled(paceGame) && paceGame.eliminatedIds.length >= 2) resolveRevivalPit(paceGame, () => 0.5);
  guard++;
}
assert.equal(paceGame.aliveIds.length, 1);
assert.equal(paceGame.round <= 20, true);

console.log(`Arena smoke tests passed. Full Tilt narration: ${themeNarrationCount(fullTilt)} outcomes. 20-player deterministic match: ${paceGame.round} rounds.`);
