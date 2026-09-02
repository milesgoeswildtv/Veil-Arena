import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  startGame,
  getRoundPhases,
  getCrowdQualifiers,
  openCrowdVote,
  castCrowdVote,
  resolveCrowdVote,
  eliminate,
  resolveRevivalPit,
  specialEventsEnabled,
  SPECIAL_EVENT_CUTOFF
} from "../src/core/engine.js";

function fakePlayer(id) {
  return { id, username: id, displayName: id.toUpperCase() };
}

assert.equal(SPECIAL_EVENT_CUTOFF, 5);
assert.deepEqual(getRoundPhases(3), ["normal", "revival"]);
assert.deepEqual(getRoundPhases(5), ["normal", "crowd_vote"]);
assert.deepEqual(getRoundPhases(15), ["normal", "revival", "crowd_vote"]);

assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 15 }), ["a", "b"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 21, c: 21 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 15 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 22 }), ["a", "b", "c", "d"]);

// Crowd Vote remains active above the final five.
const game = createGame({ guildId: "g", channelId: "c", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f"]) addPlayer(game, fakePlayer(id));
startGame(game);
assert.equal(specialEventsEnabled(game), true);
openCrowdVote(game);
for (const [voter, choice] of [["x1", "a"], ["x2", "a"], ["x3", "b"], ["x4", "c"]]) {
  castCrowdVote(game, voter, choice);
}
const crowd = resolveCrowdVote(game, () => 0);
assert.deepEqual(crowd.qualifiers, ["a", "b", "c"]);
assert.equal(crowd.survivorId, "a");
assert.equal(game.players.b.alive, false);
assert.equal(game.players.c.alive, false);

// At five remaining, all special events are permanently off for that state.
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
assert.equal(finalFive.aliveIds.length, 5);

// Revival Pit works normally while six or more remain.
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

console.log("Arena smoke tests passed.");
