import { addPlayer, castCrowdVote } from "./engine.js";

const FAKE_NAMES = [
  "Dumpster Wizard", "Cursed Kevin", "Microwave Prophet", "Tax Evasion Tony", "Haunted Gary",
  "Goblin Mode", "Coupon Dracula", "Wet Socks", "Parking Lot Oracle", "Suspicious Dave",
  "Chair Enthusiast", "Possum Attorney", "Basement Steve", "Unpaid Intern", "Cryptid Linda",
  "Emergency Lasagna", "Mall Ninja", "Cemetery Brenda", "Definitely Human", "Trash Panda Prime",
  "Doorway Greg", "Expired Coupon", "Night Shift Nancy", "Vending Machine Ghost", "Little Weird Guy",
  "Concrete Susan", "Bad Omen Brian", "Free Trial Demon", "Wrong Turn Randy", "Mildly Cursed",
  "Ceiling Fan Carl", "Parking Cone", "Haunted JPEG", "Fog Machine Frank", "Unlicensed Wizard",
  "Basement Roomba", "Gas Station Oracle", "Mystery Meat", "Do Not Invite", "Side Quest Steve",
  "Cursed Receipt", "Elevator Music", "Probably Fine", "Unknown Caller", "Backrooms Brenda",
  "Loose Battery", "Shady Craig", "Possessed Toaster", "Swamp Accountant", "Discount Exorcist"
];

export function addFakeContestants(game, count = 20) {
  if (game.status !== "registration") throw new Error("Fake contestants can only be added during registration.");
  const safeCount = Math.max(1, Math.min(Number(count) || 20, 50));
  const added = [];
  const existing = new Set(Object.values(game.players).map(p => p.displayName));

  for (let i = 0; i < safeCount; i++) {
    const base = FAKE_NAMES[(Object.keys(game.players).length + i) % FAKE_NAMES.length];
    let displayName = base;
    let suffix = 2;
    while (existing.has(displayName)) displayName = `${base} ${suffix++}`;
    existing.add(displayName);
    const id = `sim-player-${crypto.randomUUID()}`;
    addPlayer(game, { id, username: displayName.replaceAll(" ", "_").toLowerCase(), displayName });
    game.players[id].simulated = true;
    added.push(id);
  }

  game.testMode = game.testMode || {};
  game.testMode.fakeContestants = true;
  return added;
}

export function setSimulatedCrowd(game, enabled = true) {
  game.testMode = game.testMode || {};
  game.testMode.simulatedCrowd = Boolean(enabled);
  return game.testMode.simulatedCrowd;
}

export function castSimulatedCrowdVotes(game, rng = Math.random) {
  if (!game.testMode?.simulatedCrowd || game.crowdVote?.status !== "open") return 0;
  const eligible = game.crowdVote.eligibleIds || [];
  if (eligible.length < 2) return 0;

  // 24-60 synthetic spectators. Most votes are random, but about a third of the time
  // we deliberately create a cutoff tie so the multi-person crowd-pin logic gets exercised.
  const spectatorCount = 24 + Math.floor(rng() * 37);
  const forceTie = eligible.length >= 3 && rng() < 0.35;
  let votesCast = 0;

  if (forceTie) {
    const shuffled = [...eligible].sort(() => rng() - 0.5);
    const [leader, tiedA, tiedB] = shuffled;
    const tieVotes = Math.max(3, Math.floor(spectatorCount * 0.24));
    const leaderVotes = tieVotes + 1 + Math.floor(rng() * 3);
    let spectator = 0;
    for (let i = 0; i < leaderVotes && spectator < spectatorCount; i++, spectator++) {
      castCrowdVote(game, `sim-spectator-${game.round}-${spectator}`, leader);
      votesCast++;
    }
    for (const target of [tiedA, tiedB]) {
      for (let i = 0; i < tieVotes && spectator < spectatorCount; i++, spectator++) {
        castCrowdVote(game, `sim-spectator-${game.round}-${spectator}`, target);
        votesCast++;
      }
    }
    while (spectator < spectatorCount) {
      const target = eligible[Math.floor(rng() * eligible.length)];
      castCrowdVote(game, `sim-spectator-${game.round}-${spectator}`, target);
      votesCast++;
      spectator++;
    }
    return votesCast;
  }

  for (let i = 0; i < spectatorCount; i++) {
    const target = eligible[Math.floor(rng() * eligible.length)];
    castCrowdVote(game, `sim-spectator-${game.round}-${i}`, target);
    votesCast++;
  }
  return votesCast;
}
