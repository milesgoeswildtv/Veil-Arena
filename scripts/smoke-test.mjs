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
  resolveRevivalPit
} from "../src/core/engine.js";

function fakePlayer(id) {
  return { id, username: id, displayName: id.toUpperCase() };
}

assert.deepEqual(getRoundPhases(3), ["normal", "revival"]);
assert.deepEqual(getRoundPhases(5), ["normal", "crowd_vote"]);
assert.deepEqual(getRoundPhases(15), ["normal", "revival", "crowd_vote"]);

assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 15 }), ["a", "b"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 21, c: 21 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 15 }), ["a", "b", "c"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 22, c: 22, d: 22 }), ["a", "b", "c", "d"]);

const game = createGame({ guildId: "g", channelId: "c", hostId: "a" });
for (const id of ["a", "b", "c", "d"]) addPlayer(game, fakePlayer(id));
startGame(game);
openCrowdVote(game);
for (const [voter, choice] of [["x1", "a"], ["x2", "a"], ["x3", "b"], ["x4", "c"]]) {
  castCrowdVote(game, voter, choice);
}
const crowd = resolveCrowdVote(game, () => 0);
assert.deepEqual(crowd.qualifiers, ["a", "b", "c"]);
assert.equal(crowd.survivorId, "a");
assert.equal(game.players.b.alive, false);
assert.equal(game.players.c.alive, false);

// Revival Pit always selects exactly two eliminated players and returns one.
const revivalGame = createGame({ guildId: "g", channelId: "r", hostId: "a" });
for (const id of ["a", "b", "c", "d"]) addPlayer(revivalGame, fakePlayer(id));
startGame(revivalGame);
eliminate(revivalGame, "b", "test");
eliminate(revivalGame, "c", "test");
const revival = resolveRevivalPit(revivalGame, () => 0);
assert.equal(revival.type, "revival_pit");
assert.equal(revivalGame.players[revival.winnerId].alive, true);

console.log("Arena smoke tests passed.");
