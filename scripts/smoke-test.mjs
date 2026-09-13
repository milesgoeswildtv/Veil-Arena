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
  MIN_NORMAL_OUTCOMES_PER_ROUND,
  MAX_NORMAL_OUTCOMES_PER_ROUND,
  MASS_BRAWL_CHANCE,
  MASS_BRAWL_MIN_ALIVE,
  forceNextMassBrawl,
  massBrawlEligibleRound
} from "../src/core/engine.js";
import { addFakeContestants, setSimulatedCrowd, castSimulatedCrowdVotes } from "../src/core/simulation.js";
import { advanceArenaGame } from "../src/core/orchestrator.js";
import { VQS_HORROR_COMBINATORIAL_COUNT } from "../src/themes/vibe_queen_slots/horror-combinatorial.js";
import { VQS_NORMAL_RARE_COUNT } from "../src/themes/vibe_queen_slots/horror-normal-rare.js";
import { FULL_TILT_MEGA_COUNT } from "../src/themes/full_tilt/gamba-mega.js";
import { getTheme, themeNarrationCount } from "../src/themes/index.js";
import { buildMassBrawl, MASS_BRAWL_COMBINATIONS_PER_THEME } from "../src/themes/brawls.js";
import { rulesForTheme } from "../src/rules.js";

const player = id => ({ id, username: id, displayName: id.toUpperCase() });

assert.equal(SPECIAL_EVENT_CUTOFF, 5);
assert.equal(MIN_NORMAL_OUTCOMES_PER_ROUND, 4);
assert.equal(MAX_NORMAL_OUTCOMES_PER_ROUND, 4);
assert.equal(MASS_BRAWL_CHANCE, 0.025);
assert.equal(MASS_BRAWL_MIN_ALIVE, 6);
assert.equal(MASS_BRAWL_COMBINATIONS_PER_THEME, 1000);
assert.equal(massBrawlEligibleRound(1), true);
assert.equal(massBrawlEligibleRound(5), false);
assert.equal(massBrawlEligibleRound(7), false);
assert.equal(massBrawlEligibleRound(36), true);
assert.deepEqual(getRoundPhases(3), ["normal"]);
assert.deepEqual(getRoundPhases(5), ["normal", "crowd_vote"]);
assert.deepEqual(getRoundPhases(7), ["normal", "revival"]);
assert.deepEqual(getCrowdQualifiers({ a: 22, b: 21, c: 21 }, () => 0), ["a", "b"]);

assert(VQS_HORROR_COMBINATORIAL_COUNT >= 10000);
assert.equal(VQS_NORMAL_RARE_COUNT, 2000);
assert.equal(FULL_TILT_MEGA_COUNT, 5000);
const vqs = getTheme("vibe_queen_slots");
const fullTilt = getTheme("full_tilt");
const dwallet = getTheme("dwallet");
assert(themeNarrationCount(vqs) >= 12000);
assert(themeNarrationCount(fullTilt) >= 10000);
assert(themeNarrationCount(dwallet) >= 26000);
assert(rulesForTheme("vibe_queen_slots").includes("THE HAUNTED ARENA"));
assert(rulesForTheme("full_tilt").includes("FULL TILT ARENA"));

for (const roll of [0.24, 0.49, 0.74, 0.999]) {
  const game = createGame({ guildId: "g", channelId: `normal-${roll}`, hostId: "p1" });
  for (let i = 1; i <= 30; i++) addPlayer(game, player(`p${i}`));
  startGame(game);
  beginNextRound(game);
  let calls = 0;
  const rng = () => calls++ === 0 ? 0.5 : roll;
  const batch = resolveNormalRound(game, rng);
  assert.equal(batch.type, "normal_round_batch");
  assert.equal(batch.outcomes.length, 4);
  assert(batch.eliminatedIds.length >= 1);
}

const brawl = createGame({ guildId: "g", channelId: "brawl", hostId: "p1", themeId: "vibe_queen_slots" });
for (let i = 1; i <= 12; i++) addPlayer(brawl, player(`p${i}`));
startGame(brawl);
beginNextRound(brawl);
forceNextMassBrawl(brawl);
const brawlResult = resolveNormalRound(brawl, () => 0.5);
assert.equal(brawlResult.type, "mass_brawl");
assert(brawlResult.participantIds.length >= 4 && brawlResult.participantIds.length <= 7);
assert(brawlResult.eliminatedIds.length >= 1);
assert(brawlResult.survivorIds.length >= 1);
const vqsStory = buildMassBrawl("vibe_queen_slots", brawlResult.participantIds, brawlResult.survivorIds, () => 0.5);
const ftStory = buildMassBrawl("full_tilt", brawlResult.participantIds, brawlResult.survivorIds, () => 0.5);
assert(vqsStory.length > 100);
assert(ftStory.length > 100);
assert.notEqual(vqsStory, ftStory);

const crowdGame = createGame({ guildId: "g", channelId: "crowd", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f"]) addPlayer(crowdGame, player(id));
startGame(crowdGame);
openCrowdVote(crowdGame);
for (const [spectator, candidate] of [["x1", "a"], ["x2", "a"], ["x3", "b"], ["x4", "c"]]) castCrowdVote(crowdGame, spectator, candidate);
const crowd = resolveCrowdVote(crowdGame, () => 0);
assert.deepEqual(crowd.qualifiers, ["a", "b"]);
assert.equal(crowd.eliminatedIds.length, 1);

const finalFive = createGame({ guildId: "g", channelId: "final-five", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f", "g"]) addPlayer(finalFive, player(id));
startGame(finalFive);
eliminate(finalFive, "f", "test");
eliminate(finalFive, "g", "test");
assert.equal(specialEventsEnabled(finalFive), false);
assert.equal(openCrowdVote(finalFive), null);

const revival = createGame({ guildId: "g", channelId: "revival", hostId: "a" });
for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) addPlayer(revival, player(id));
startGame(revival);
eliminate(revival, "g", "test");
eliminate(revival, "h", "test");
const revived = resolveRevivalPit(revival, () => 0);
assert.equal(revival.players[revived.winnerId].alive, true);

const simulated = createGame({ guildId: "g", channelId: "sim", hostId: "host" });
addPlayer(simulated, player("host"));
addFakeContestants(simulated, 12);
setSimulatedCrowd(simulated, true);
startGame(simulated);
openCrowdVote(simulated);
assert(castSimulatedCrowdVotes(simulated, () => 0.5) >= 24);

const orchestrated = createGame({ guildId: "g", channelId: "orchestrated", hostId: "p1", themeId: "full_tilt" });
for (let i = 1; i <= 12; i++) addPlayer(orchestrated, player(`o${i}`));
startGame(orchestrated);
const tick = advanceArenaGame(orchestrated, { rng: () => 0.5 });
assert.equal(tick.round, 1);
assert(["normal", "mass_brawl"].includes(tick.type));
assert.equal(typeof tick.text, "string");
assert(tick.text.length > 20);

console.log(`Arena core smoke tests passed. VQS: ${themeNarrationCount(vqs)}. Full Tilt: ${themeNarrationCount(fullTilt)}. DWallet: ${themeNarrationCount(dwallet)}.`);
