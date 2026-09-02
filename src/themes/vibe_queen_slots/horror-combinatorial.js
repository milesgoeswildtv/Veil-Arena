// Vibe Queen Slots — combinatorial horror narration.
// These pools intentionally compose authored horror fragments into clear actor -> action -> victim -> result lines.
// Vibe Queen herself is never an actor; only the Lair/property/branding/environment is referenced.

const KILL_SETUPS = [
  "The lights in Vibe Queen's Lair cut out, and when the emergency bulbs return,",
  "A dead slot machine suddenly starts paying out black tickets as",
  "The basement door unlocks itself just as",
  "A child's laugh crawls through the ceiling speakers while",
  "Every mirror in the haunted casino fogs over at once as",
  "The EXIT sign changes to DON'T as",
  "A masked silhouette appears at the far end of the hall while",
  "The old service elevator dings from a floor that doesn't exist as",
  "Something scratches three times from inside the walls while",
  "The security monitors show the Arena ten seconds in the future as",
  "A row of porcelain dolls turns its head in perfect unison while",
  "The chandelier begins swinging despite the dead-still air as",
  "A phone rings beneath the ring, and on the third ring,",
  "The fog pouring from Vibe Queen's Lair turns unnaturally cold as",
  "An unplugged television flashes PLEASE RUN while",
  "The hallway behind the Arena stretches twice its normal length as",
  "A dusty portrait starts whispering the contestants' names while",
  "The cursed jackpot bell rings thirteen times as",
  "A shadow crosses the ceiling with nothing there to cast it while",
  "Every door in the haunted house slams shut except one as"
];

const KILL_ACTIONS = [
  "{killer} drives {victim} backward through the wrong doorway",
  "{killer} catches {victim} staring into the mirror and sends them over the boundary",
  "{killer} rushes {victim} and launches them straight into the waiting fog",
  "{killer} traps {victim} between the ropes and a door that was not there before",
  "{killer} yanks {victim} away from the cursed machine and throws them out of the Arena",
  "{killer} appears behind {victim} and sends them stumbling beyond the boundary",
  "{killer} uses the blackout to blindside {victim} and knock them clean out",
  "{killer} chases {victim} down the impossible hallway and forces them through the exit",
  "{killer} corners {victim} beside the basement stairs and knocks them out of competition",
  "{killer} catches {victim} listening to the walls and sends them straight over the edge",
  "{killer} ducks beneath a swinging light and shoves {victim} through the ropes",
  "{killer} turns {victim}'s panic into an opening and launches them out",
  "{killer} blocks {victim}'s escape route and redirects them beyond the Arena boundary",
  "{killer} springs from the fog and knocks {victim} out before they can turn around",
  "{killer} catches {victim} backing away from the mannequin and finishes the elimination",
  "{killer} forces {victim} toward the flickering EXIT sign and sends them through it",
  "{killer} ambushes {victim} beside the dead television and throws them out",
  "{killer} uses the haunted-house chaos to send {victim} tumbling beyond the boundary",
  "{killer} cuts off {victim}'s retreat and drives them directly out of the match",
  "{killer} catches {victim} frozen by the whispering speakers and knocks them from the Arena"
];

const KILL_AFTERMATHS = [
  "The door locks behind them. {victim} is ELIMINATED; {killer} gets the kill.",
  "The lights blink once. {victim} is ELIMINATED by {killer}.",
  "The Lair goes silent. {victim} is OUT, and the elimination belongs to {killer}.",
  "Something laughs in the walls. {victim} is ELIMINATED. Killer: {killer}.",
  "The scoreboard updates before anyone touches it: {victim} — ELIMINATED by {killer}.",
  "A bell rings from downstairs. {victim} is OUT. {killer} caused the elimination.",
  "The fog closes behind {victim}. ELIMINATED by {killer}. No ambiguity there.",
  "The security feed freezes on {killer}. {victim} is officially ELIMINATED.",
  "The haunted house keeps {victim}. {killer} gets credit for the elimination.",
  "The EXIT sign finally behaves normally. {victim} is ELIMINATED by {killer}."
];

const SELF_SETUPS = [
  "A voice from Vibe Queen's basement whispers their name, and",
  "The mirror writes RUN backward in the condensation, so",
  "A dead slot machine displays their username and",
  "Something under the ring knocks three times, causing",
  "The hallway lights switch off one by one behind them until",
  "A porcelain doll appears where there was definitely no doll before, and",
  "Their own voice comes through an unplugged radio, making",
  "The service elevator opens onto complete darkness, and",
  "Every mannequin in the Lair turns toward them at once, so",
  "A pale face appears on every security monitor, prompting",
  "The basement key slides across the floor by itself toward them, and",
  "A music box starts playing backward somewhere overhead, causing",
  "A shadow waves from inside the mirror, convincing",
  "The cursed jackpot counter starts counting down from ten, and",
  "A child's handprint appears on the wall beside them, making"
];

const SELF_ACTIONS = [
  "{victim} bolts blindly through the nearest exit",
  "{victim} backpedals straight over the Arena boundary",
  "{victim} sprints away without checking where the ropes are",
  "{victim} dives through the first open doorway and leaves the match",
  "{victim} panics, turns the wrong direction, and runs themselves out",
  "{victim} decides survival matters more than dignity and evacuates the Arena",
  "{victim} jumps away from absolutely nothing and lands outside the boundary",
  "{victim} follows the glowing EXIT sign directly out of competition",
  "{victim} tries to flee the haunted room and crosses the elimination line alone",
  "{victim} screams, runs, and removes themselves from the match with impressive efficiency",
  "{victim} attempts an emergency escape and accidentally completes a self-elimination",
  "{victim} refuses to investigate and launches themselves out of the Arena instead",
  "{victim} takes one look at the darkness and personally exits the competition",
  "{victim} makes a full-speed retreat and forgets the Arena has a boundary",
  "{victim} chooses 'anywhere but here' and unfortunately chooses outside the match"
];

const SELF_AFTERMATHS = [
  "Nobody touched them. {victim} SELF-ELIMINATED.",
  "That was entirely self-inflicted: {victim} is ELIMINATED.",
  "No killer. No assist. {victim} eliminated themselves.",
  "The Lair didn't even need help. {victim} SELF-ELIMINATED.",
  "Official ruling: {victim} is OUT by self-elimination.",
  "The replay confirms it. {victim} eliminated themselves.",
  "There is nobody else to blame. {victim} is ELIMINATED by their own panic.",
  "The scoreboard reluctantly records SELF-ELIMINATION: {victim}.",
  "The haunted house gets no kill credit. {victim} did this to themselves.",
  "Clear as day: {victim} crossed the boundary alone and is ELIMINATED."
];

const PIN_SETUPS = [
  "The lights pulse red with every count as",
  "The cursed jackpot bell begins counting along while",
  "The fog closes around the Final Scare as",
  "Every television in the Lair switches to the same live feed while",
  "A figure stands motionless behind the referee as",
  "The basement door pounds once per count while",
  "The mirrors show the pin from angles that do not exist as",
  "The chandelier stops swinging the instant",
  "The Arena speakers whisper ONE before the referee does as",
  "Every slot machine freezes on three matching skulls while"
];

const PIN_ACTIONS = [
  "{winner} traps {loser}'s shoulders and refuses to let them turn",
  "{winner} catches {loser} in a sudden cover and holds tight",
  "{winner} rolls {loser} into the pin and hooks the leg",
  "{winner} drags {loser} away from the ropes and locks down the cover",
  "{winner} reverses {loser}'s escape and plants both shoulders",
  "{winner} survives the scramble and stacks {loser} into the count",
  "{winner} catches {loser} looking toward the darkness and steals the pin",
  "{winner} forces {loser} flat and keeps them there through the count",
  "{winner} turns {loser}'s last escape attempt into a decisive cover",
  "{winner} drops onto {loser} for the pin before the lights can flicker again"
];

const PIN_AFTERMATHS = [
  "ONE. TWO. THREE. {winner} SURVIVES. {loser} is ELIMINATED.",
  "The third count lands. Winner: {winner}. Eliminated: {loser}.",
  "THREE. {loser} is OUT. {winner} survives the Final Scare.",
  "The bell rings. {winner} stays. {loser} is ELIMINATED.",
  "The Lair chooses its survivor: {winner}. {loser} is gone.",
  "Count complete. {winner} advances; {loser} is ELIMINATED.",
  "No kickout. {winner} survives and {loser} is officially OUT.",
  "The scoreboard flashes SURVIVOR: {winner}. ELIMINATED: {loser}.",
  "Three counts, one survivor. {winner} remains; {loser} is ELIMINATED.",
  "The lights return on THREE. {winner} is standing. {loser} is OUT."
];

const REVIVAL_SETUPS = [
  "The Veil tears open beneath the dead slot machines as",
  "The basement lights turn on for the first time all night as",
  "A second heartbeat begins pounding through the Lair speakers while",
  "The old elevator returns from below floor zero as",
  "Every mirror cracks down the center while",
  "The security feed rewinds itself to an earlier elimination as",
  "The fog retreats from one doorway and gathers around another as",
  "A phone rings in the empty Arena and answers itself as",
  "The cursed jackpot flashes SECOND CHANCE while",
  "The lights spell RETURN one bulb at a time as"
];

const REVIVAL_ACTIONS = [
  "{winner} claws their way back toward the Arena while {loser} is dragged deeper into the dark",
  "{winner} reaches the open doorway first and {loser} is shut behind it",
  "{winner} follows the emergency lights back while {loser} follows the wrong voice",
  "{winner} breaks through the fog first and {loser} disappears behind them",
  "{winner} grabs the final handhold and leaves {loser} on the dead side of the Veil",
  "{winner} wins the race toward the living Arena while {loser} is swallowed by the hallway",
  "{winner} forces the elevator doors open while {loser} remains below floor zero",
  "{winner} finds the one unlocked exit while {loser} reaches a door with no handle",
  "{winner} follows their own reflection home while {loser}'s reflection walks the other way",
  "{winner} reaches the light first while the darkness closes around {loser}"
];

const REVIVAL_AFTERMATHS = [
  "REVIVED: {winner}. Still eliminated: {loser}.",
  "{winner} RETURNS TO THE ARENA. {loser} remains ELIMINATED.",
  "Second chance awarded to {winner}. {loser} stays out.",
  "The Veil releases {winner}. It keeps {loser}.",
  "Back from elimination: {winner}. No return for {loser}.",
  "{winner} is ALIVE IN THE MATCH again. {loser} remains gone.",
  "The scoreboard restores {winner}. {loser} stays crossed out.",
  "One comes back: {winner}. One does not: {loser}.",
  "Revival winner: {winner}. Revival loser: {loser}.",
  "The Lair gives {winner} another round. {loser} remains ELIMINATED."
];

function combine3(a, b, c) {
  const out = [];
  for (const first of a) for (const second of b) for (const third of c) out.push(`${first} ${second}. ${third}`);
  return out;
}

// 20*20*10 = 4,000 player-kill lines
// 15*15*10 = 2,250 self-elimination lines
// 10*10*10 = 1,000 pin-duel lines
// 10*10*10 = 1,000 revival lines
// Multi-pin reuses the pin grammar with explicit survivor wording below.
const playerKills = combine3(KILL_SETUPS, KILL_ACTIONS, KILL_AFTERMATHS);
const selfKills = combine3(SELF_SETUPS, SELF_ACTIONS, SELF_AFTERMATHS);
const pinDuels = combine3(PIN_SETUPS, PIN_ACTIONS, PIN_AFTERMATHS);
const revivalDuels = combine3(REVIVAL_SETUPS, REVIVAL_ACTIONS, REVIVAL_AFTERMATHS);

const MULTI_SETUPS = [...PIN_SETUPS, ...REVIVAL_SETUPS];
const MULTI_ACTIONS = [
  "{winner} survives the pileup while every other selected fighter is trapped beneath the count",
  "{winner} slips free at the last second while the rest of the Final Scare collapses into one enormous pin",
  "{winner} escapes the cover while everyone else is caught when the referee drops for the count",
  "{winner} crawls clear as the remaining fighters become one deeply unfortunate stack of shoulders",
  "{winner} is the only fighter to break free before the third count begins",
  "{winner} rolls out of danger while the rest are pinned in the chaos",
  "{winner} finds daylight while every other selected contestant is swallowed by the cover",
  "{winner} escapes the heap and leaves the others underneath when the count starts",
  "{winner} breaks from the fog alone while the remaining fighters are caught in the pin",
  "{winner} reaches the ropes while everyone else is locked beneath the Final Scare"
];
const MULTI_AFTERMATHS = [
  "THREE. ONLY {winner} SURVIVES. Every other selected fighter is ELIMINATED.",
  "The count lands. Survivor: {winner}. All other Final Scare contestants are OUT.",
  "The scoreboard keeps one name: {winner}. Everyone else selected is ELIMINATED.",
  "ONE survivor. {winner} remains. Every other fighter in the pin is gone.",
  "The bell rings for {winner}. All other selected contestants are ELIMINATED.",
  "Final Scare complete: {winner} survives; everybody else involved is OUT.",
  "The Lair releases {winner}. It eliminates every other fighter in the showdown.",
  "Only {winner} gets up after THREE. Everyone else selected is ELIMINATED.",
  "Survivor confirmed: {winner}. The rest of the showdown is wiped out.",
  "The lights return with {winner} alone. All other selected fighters are OUT."
];
const multiPins = combine3(MULTI_SETUPS, MULTI_ACTIONS, MULTI_AFTERMATHS);

export const VQS_HORROR_COMBINATORIAL = { playerKills, selfKills, pinDuels, multiPins, revivalDuels };
export const VQS_HORROR_COMBINATORIAL_COUNT = playerKills.length + selfKills.length + pinDuels.length + multiPins.length + revivalDuels.length;
