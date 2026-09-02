const EVENT_WEIGHTS = [
  ["attack", 30], ["counter", 18], ["double_team", 11],
  ["weapon", 9], ["near_elimination", 12], ["elimination", 14],
  ["self_elimination", 6]
];

export const SPECIAL_EVENT_CUTOFF = 5;
export const NORMAL_OUTCOMES_PER_ROUND = 4;

const randomIndex = (length, rng = Math.random) => Math.floor(rng() * length);
const pick = (list, rng = Math.random) => list?.length ? list[randomIndex(list.length, rng)] : null;

function uniqueRandom(list, count, rng = Math.random) {
  const pool = [...list];
  const out = [];
  while (pool.length && out.length < count) out.push(pool.splice(randomIndex(pool.length, rng), 1)[0]);
  return out;
}

function weightedPick(entries, rng = Math.random) {
  let roll = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries.at(-1)[0];
}

export function createGame({ guildId, channelId, hostId, themeId = "vibe_queen_slots" }) {
  return { id: crypto.randomUUID(), guildId, channelId, hostId, themeId, status: "registration", round: 0, players: {}, aliveIds: [], eliminatedIds: [], history: [], crowdVote: null, winnerId: null, createdAt: new Date().toISOString() };
}

export function addPlayer(game, player) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (!player?.id) throw new Error("Player id is required.");
  if (game.players[player.id]) return game;
  game.players[player.id] = { id: player.id, displayName: player.displayName || player.username || `Player ${Object.keys(game.players).length + 1}`, username: player.username || null, alive: true, eliminations: 0, revivals: 0, crowdPinsSurvived: 0 };
  game.aliveIds.push(player.id);
  return game;
}

export function removePlayer(game, playerId) { if (game.status !== "registration") throw new Error("Registration is closed."); delete game.players[playerId]; game.aliveIds = game.aliveIds.filter(id => id !== playerId); return game; }
export function startGame(game) { if (game.status !== "registration") throw new Error("Game already started."); if (game.aliveIds.length < 2) throw new Error("At least 2 players are required."); game.status = "running"; game.history.push({ type: "game_started", aliveIds: [...game.aliveIds] }); return game; }

export function eliminate(game, playerId, reason, byPlayerId = null) {
  const player = game.players[playerId]; if (!player?.alive) return false;
  player.alive = false; game.aliveIds = game.aliveIds.filter(id => id !== playerId);
  if (!game.eliminatedIds.includes(playerId)) game.eliminatedIds.push(playerId);
  if (byPlayerId && game.players[byPlayerId]) game.players[byPlayerId].eliminations++;
  game.history.push({ type: "elimination", playerId, byPlayerId, reason, round: game.round }); return true;
}

export function revive(game, playerId) { const player = game.players[playerId]; if (!player || player.alive) return false; player.alive = true; player.revivals++; game.eliminatedIds = game.eliminatedIds.filter(id => id !== playerId); if (!game.aliveIds.includes(playerId)) game.aliveIds.push(playerId); game.history.push({ type: "revival", playerId, round: game.round }); return true; }
export function specialEventsEnabled(game) { return game.aliveIds.length > SPECIAL_EVENT_CUTOFF; }

export function getRoundPhases(round) {
  const phases = ["normal"];
  // Revival wins overlap rounds. Crowd Vote is skipped rather than stacking two specials.
  if (round % 3 === 0) phases.push("revival");
  else if (round % 5 === 0) phases.push("crowd_vote");
  return phases;
}

export function beginNextRound(game) { if (game.status !== "running") throw new Error("Game is not running."); if (game.aliveIds.length <= 1) { checkWinner(game); return { round: game.round, phases: [] }; } game.round++; return { round: game.round, phases: getRoundPhases(game.round) }; }

function resolveNormalBeat(game, rng = Math.random, forcedElimination = false) {
  if (game.aliveIds.length <= 1) return { type: "no_op", round: game.round, actorIds: [], eliminatedIds: [] };
  const alive = game.aliveIds.map(id => game.players[id]);
  const type = forcedElimination ? (rng() < 0.16 ? "self_elimination" : "elimination") : weightedPick(EVENT_WEIGHTS, rng);
  const actorCount = type === "self_elimination" ? 1 : Math.min(alive.length, type === "double_team" ? 3 : 2);
  const actors = uniqueRandom(alive, actorCount, rng); const [attacker, target, third] = actors;
  const result = { type, round: game.round, actorIds: actors.map(p => p.id), eliminatedIds: [] };
  const knockOut = (id, reason, by) => { if (game.aliveIds.length <= 1) return; if (eliminate(game, id, reason, by)) result.eliminatedIds.push(id); };
  const pressure = game.aliveIds.length <= 5 ? 0.42 : game.aliveIds.length <= 10 ? 0.22 : 0;
  if (type === "self_elimination") knockOut(attacker.id, "self_elimination", null);
  else if (type === "elimination") knockOut(target.id, "normal_round", attacker.id);
  else if (type === "near_elimination" && rng() < 0.28 + pressure) knockOut(target.id, "failed_save", attacker.id);
  else if (type === "weapon" && rng() < 0.18 + pressure) knockOut(target.id, "weapon_spot", attacker.id);
  else if (type === "counter" && rng() < 0.12 + pressure) knockOut(attacker.id, "countered", target.id);
  else if (type === "double_team" && third && rng() < 0.16 + pressure) knockOut(third.id, "double_team", attacker.id);
  game.history.push(result); return result;
}

export function resolveNormalRound(game, rng = Math.random) {
  if (game.status !== "running") throw new Error("Game is not running.");
  if (game.aliveIds.length <= 1) return { type: "normal_round_batch", round: game.round, outcomes: [], eliminatedIds: [] };
  const startingAlive = game.aliveIds.length;
  const minimumEliminations = startingAlive > 10 ? 2 : 1;
  const outcomes = []; const eliminatedIds = [];
  for (let i = 0; i < NORMAL_OUTCOMES_PER_ROUND && game.aliveIds.length > 1; i++) {
    // Above ten players, force enough late beats to guarantee two eliminations.
    // At ten or fewer, every round still guarantees at least one.
    const beatsRemaining = NORMAL_OUTCOMES_PER_ROUND - i;
    const eliminationsNeeded = Math.max(0, minimumEliminations - eliminatedIds.length);
    const mustEliminateNow = eliminationsNeeded >= beatsRemaining;
    const beat = resolveNormalBeat(game, rng, mustEliminateNow);
    outcomes.push(beat); eliminatedIds.push(...beat.eliminatedIds);
  }
  const result = { type: "normal_round_batch", round: game.round, outcomes, eliminatedIds: [...new Set(eliminatedIds)] };
  game.history.push(result); return result;
}

export function resolveRevivalPit(game, rng = Math.random) { if (!specialEventsEnabled(game)) { const result = { type: "revival_skipped", round: game.round, reason: "final_five" }; game.history.push(result); return result; } if (game.eliminatedIds.length < 2) { const result = { type: "revival_skipped", round: game.round, reason: "not_enough_eliminated" }; game.history.push(result); return result; } const selectedIds = uniqueRandom(game.eliminatedIds, 2, rng); const winnerId = pick(selectedIds, rng); const loserId = selectedIds.find(id => id !== winnerId); revive(game, winnerId); const result = { type: "revival_pit", round: game.round, selectedIds, winnerId, loserId }; game.history.push(result); return result; }
export function openCrowdVote(game) { if (!specialEventsEnabled(game)) return null; game.crowdVote = { round: game.round, status: "open", eligibleIds: [...game.aliveIds], votesBySpectator: {}, totals: Object.fromEntries(game.aliveIds.map(id => [id, 0])) }; return game.crowdVote; }
export function castCrowdVote(game, spectatorId, playerId) { const vote = game.crowdVote; if (!vote || vote.status !== "open") throw new Error("No crowd vote is open."); if (!vote.eligibleIds.includes(playerId)) throw new Error("That player is not eligible."); const previous = vote.votesBySpectator[spectatorId]; if (previous === playerId) return vote; if (previous && vote.totals[previous] > 0) vote.totals[previous]--; vote.votesBySpectator[spectatorId] = playerId; vote.totals[playerId]++; return vote; }
export function getCrowdQualifiers(totals) { const entries = Object.entries(totals).filter(([, votes]) => votes > 0).sort((a, b) => b[1] - a[1]); if (entries.length <= 1) return entries.map(([id]) => id); const cutoff = entries[1][1]; return entries.filter(([, votes]) => votes >= cutoff).map(([id]) => id); }
export function resolveCrowdVote(game, rng = Math.random) { const vote = game.crowdVote; if (!vote || vote.status !== "open") throw new Error("No crowd vote is open."); vote.status = "closed"; let qualifiers = getCrowdQualifiers(vote.totals); if (qualifiers.length < 2) { const remaining = vote.eligibleIds.filter(id => !qualifiers.includes(id)); qualifiers.push(...uniqueRandom(remaining, 2 - qualifiers.length, rng)); } const survivorId = pick(qualifiers, rng); const eliminatedIds = qualifiers.filter(id => id !== survivorId); for (const id of eliminatedIds) eliminate(game, id, "crowd_pin", survivorId); game.players[survivorId].crowdPinsSurvived++; const result = { type: "crowd_pin", round: game.round, qualifiers, survivorId, eliminatedIds, totals: { ...vote.totals } }; game.history.push(result); game.crowdVote = null; return result; }
export function checkWinner(game) { if (game.status !== "running") return game.winnerId; if (game.aliveIds.length === 1) { game.winnerId = game.aliveIds[0]; game.status = "finished"; game.history.push({ type: "winner", playerId: game.winnerId, round: game.round }); } else if (game.aliveIds.length === 0) { game.status = "finished"; game.history.push({ type: "no_winner", round: game.round }); } return game.winnerId; }
