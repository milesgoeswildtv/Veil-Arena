const DEFAULT_EVENT_WEIGHTS = [
  ["attack", 35],
  ["counter", 20],
  ["double_team", 12],
  ["weapon", 10],
  ["near_elimination", 13],
  ["elimination", 10]
];

function randomInt(max, rng = Math.random) {
  return Math.floor(rng() * max);
}

function pick(list, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[randomInt(list.length, rng)];
}

function weightedPick(entries, rng = Math.random) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}

function uniqueRandom(list, count, rng = Math.random) {
  const pool = [...list];
  const out = [];
  while (pool.length && out.length < count) {
    out.push(pool.splice(randomInt(pool.length, rng), 1)[0]);
  }
  return out;
}

export function createGame({ guildId, channelId, hostId, themeId = "vibe_queen_slots" }) {
  return {
    id: crypto.randomUUID(),
    guildId,
    channelId,
    hostId,
    themeId,
    status: "registration",
    round: 0,
    players: {},
    aliveIds: [],
    eliminatedIds: [],
    history: [],
    crowdVote: null,
    winnerId: null,
    createdAt: new Date().toISOString()
  };
}

export function addPlayer(game, player) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (!player?.id) throw new Error("Player id is required.");
  if (game.players[player.id]) return game;

  game.players[player.id] = {
    id: player.id,
    displayName: player.displayName || player.username || `Player ${Object.keys(game.players).length + 1}`,
    username: player.username || null,
    avatarUrl: player.avatarUrl || null,
    alive: true,
    eliminations: 0,
    revivals: 0,
    crowdPinsSurvived: 0
  };
  game.aliveIds.push(player.id);
  return game;
}

export function removePlayer(game, playerId) {
  if (game.status !== "registration") throw new Error("Registration is closed.");
  if (!game.players[playerId]) return game;
  delete game.players[playerId];
  game.aliveIds = game.aliveIds.filter(id => id !== playerId);
  return game;
}

export function startGame(game) {
  if (game.status !== "registration") throw new Error("Game already started.");
  if (game.aliveIds.length < 2) throw new Error("At least 2 players are required.");
  game.status = "running";
  game.history.push({ type: "game_started", at: new Date().toISOString(), aliveIds: [...game.aliveIds] });
  return game;
}

export function eliminate(game, playerId, reason, byPlayerId = null) {
  const player = game.players[playerId];
  if (!player || !player.alive) return false;

  player.alive = false;
  game.aliveIds = game.aliveIds.filter(id => id !== playerId);
  if (!game.eliminatedIds.includes(playerId)) game.eliminatedIds.push(playerId);
  if (byPlayerId && game.players[byPlayerId]) game.players[byPlayerId].eliminations += 1;

  game.history.push({ type: "elimination", playerId, byPlayerId, reason, round: game.round });
  return true;
}

export function revive(game, playerId) {
  const player = game.players[playerId];
  if (!player || player.alive) return false;
  player.alive = true;
  player.revivals += 1;
  game.eliminatedIds = game.eliminatedIds.filter(id => id !== playerId);
  if (!game.aliveIds.includes(playerId)) game.aliveIds.push(playerId);
  game.history.push({ type: "revival", playerId, round: game.round });
  return true;
}

export function getRoundPhases(round) {
  const phases = ["normal"];
  if (round % 3 === 0) phases.push("revival");
  if (round % 5 === 0) phases.push("crowd_vote");
  return phases;
}

export function resolveNormalRound(game, rng = Math.random) {
  if (game.status !== "running") throw new Error("Game is not running.");
  if (game.aliveIds.length <= 1) return { type: "no_op" };

  const alive = game.aliveIds.map(id => game.players[id]);
  const eventType = weightedPick(DEFAULT_EVENT_WEIGHTS, rng);
  const actors = uniqueRandom(alive, Math.min(alive.length, eventType === "double_team" ? 3 : 2), rng);

  const attacker = actors[0];
  const target = actors[1] || actors[0];
  const third = actors[2] || null;
  const result = { type: eventType, round: game.round, actorIds: actors.map(p => p.id), eliminatedIds: [] };

  if (eventType === "elimination") {
    if (eliminate(game, target.id, "normal_round", attacker.id)) result.eliminatedIds.push(target.id);
  } else if (eventType === "near_elimination") {
    if (rng() < 0.28 && eliminate(game, target.id, "failed_save", attacker.id)) result.eliminatedIds.push(target.id);
  } else if (eventType === "weapon") {
    if (rng() < 0.18 && eliminate(game, target.id, "weapon_spot", attacker.id)) result.eliminatedIds.push(target.id);
  } else if (eventType === "counter") {
    if (rng() < 0.12 && eliminate(game, attacker.id, "countered", target.id)) result.eliminatedIds.push(attacker.id);
  } else if (eventType === "double_team" && third) {
    if (rng() < 0.16 && eliminate(game, third.id, "double_team", attacker.id)) result.eliminatedIds.push(third.id);
  }

  game.history.push(result);
  checkWinner(game);
  return result;
}

export function resolveRevivalPit(game, rng = Math.random) {
  if (game.eliminatedIds.length < 2) {
    const result = { type: "revival_skipped", round: game.round, reason: "not_enough_eliminated" };
    game.history.push(result);
    return result;
  }

  const selectedIds = uniqueRandom(game.eliminatedIds, 2, rng);
  const winnerId = pick(selectedIds, rng);
  const loserId = selectedIds.find(id => id !== winnerId);
  revive(game, winnerId);

  const result = { type: "revival_pit", round: game.round, selectedIds, winnerId, loserId };
  game.history.push(result);
  return result;
}

export function openCrowdVote(game) {
  if (game.aliveIds.length < 2) return null;
  game.crowdVote = {
    round: game.round,
    status: "open",
    eligibleIds: [...game.aliveIds],
    votesBySpectator: {},
    totals: Object.fromEntries(game.aliveIds.map(id => [id, 0]))
  };
  return game.crowdVote;
}

export function castCrowdVote(game, spectatorId, playerId) {
  const vote = game.crowdVote;
  if (!vote || vote.status !== "open") throw new Error("No crowd vote is open.");
  if (!vote.eligibleIds.includes(playerId)) throw new Error("That player is not eligible.");

  const previous = vote.votesBySpectator[spectatorId];
  if (previous === playerId) return vote;
  if (previous && vote.totals[previous] > 0) vote.totals[previous] -= 1;

  vote.votesBySpectator[spectatorId] = playerId;
  vote.totals[playerId] += 1;
  return vote;
}

export function getCrowdQualifiers(totals) {
  const entries = Object.entries(totals)
    .filter(([, votes]) => votes > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return [];
  if (entries.length === 1) return [entries[0][0]];

  const distinctScores = [...new Set(entries.map(([, votes]) => votes))];
  const cutoffScore = distinctScores.length >= 2 ? distinctScores[1] : distinctScores[0];
  return entries.filter(([, votes]) => votes >= cutoffScore).map(([id]) => id);
}

export function resolveCrowdVote(game, rng = Math.random) {
  const vote = game.crowdVote;
  if (!vote || vote.status !== "open") throw new Error("No crowd vote is open.");
  vote.status = "closed";

  let qualifiers = getCrowdQualifiers(vote.totals);
  if (qualifiers.length < 2) {
    const remaining = vote.eligibleIds.filter(id => !qualifiers.includes(id));
    qualifiers = [...qualifiers, ...uniqueRandom(remaining, 2 - qualifiers.length, rng)];
  }

  const survivorId = pick(qualifiers, rng);
  const eliminatedIds = qualifiers.filter(id => id !== survivorId);
  for (const id of eliminatedIds) eliminate(game, id, "crowd_pin", survivorId);
  if (game.players[survivorId]) game.players[survivorId].crowdPinsSurvived += 1;

  const result = {
    type: "crowd_pin",
    round: game.round,
    qualifiers,
    survivorId,
    eliminatedIds,
    totals: { ...vote.totals }
  };
  game.history.push(result);
  game.crowdVote = null;
  checkWinner(game);
  return result;
}

export function beginNextRound(game) {
  if (game.status !== "running") throw new Error("Game is not running.");
  if (checkWinner(game)) return { round: game.round, phases: [] };
  game.round += 1;
  return { round: game.round, phases: getRoundPhases(game.round) };
}

export function checkWinner(game) {
  if (game.status !== "running") return game.winnerId;
  if (game.aliveIds.length === 1) {
    game.winnerId = game.aliveIds[0];
    game.status = "finished";
    game.history.push({ type: "winner", playerId: game.winnerId, round: game.round });
    return game.winnerId;
  }
  if (game.aliveIds.length === 0) {
    game.status = "finished";
    game.winnerId = null;
    game.history.push({ type: "no_winner", round: game.round });
  }
  return game.winnerId;
}
