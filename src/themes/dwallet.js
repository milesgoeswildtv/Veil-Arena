// DWallet — Telegram/community/crypto Arena narration.
// Exactly 13,000 deterministic unique narration templates are composed at module load.
// Keep these as flavor only: no wallet balances, private data, or financial actions are read or changed.

const KILL_SETUPS = [
  "A DWallet drop notification hits the chat at the worst possible second, and",
  "The Telegram chat starts flying faster than anyone can read while",
  "A purple DWallet alert flashes across every screen as",
  "The community feed erupts with emotes just as",
  "A fake 'CLAIMED' banner flickers over the Arena while",
  "The DWallet bot posts a perfectly timed notification as",
  "A flood of tip animations lights up the edge of the Arena while",
  "The group chat starts chanting somebody's username and",
  "A transaction spinner hangs on ninety-nine percent as",
  "The DWallet logo pulses like it knows something everyone else does not as",
  "A click-to-claim button appears in the middle of the chaos and",
  "The chat briefly goes dead silent before exploding again as",
  "A wall of Telegram stickers covers half the scoreboard while",
  "A DWallet reward banner drops over the action just as",
  "The community counter jumps for absolutely no useful reason while",
  "A notification sound fires three times in a row as",
  "The bot calmly posts 'GOOD LUCK' into a situation where luck has clearly left and",
  "A burst of purple confetti triggers several rounds too early while",
  "The Arena feed refreshes and shows the wrong winner for half a second as",
  "Every phone in the chat vibrates at once while"
];

const KILL_ACTIONS = [
  "{killer} catches {victim} checking the chat and sends them straight over the boundary",
  "{killer} uses the notification distraction to launch {victim} out of the Arena",
  "{killer} redirects {victim}'s full-speed charge into a very public exit",
  "{killer} shoves {victim} away from the claim button and directly out of competition",
  "{killer} catches {victim} celebrating a drop too early and completes the elimination",
  "{killer} turns one missed dodge from {victim} into a clean eviction",
  "{killer} blocks {victim}'s escape route and sends them beyond the Arena edge",
  "{killer} catches {victim} typing instead of fighting and removes the problem",
  "{killer} rushes {victim} before they can finish reading the pinned message",
  "{killer} uses {victim}'s own momentum to send them out with suspicious efficiency",
  "{killer} cuts off {victim} beside the glowing DWallet panel and knocks them clear",
  "{killer} fakes toward {third}, pivots, and sends {victim} out instead",
  "{killer} lets {victim} think they survived, then taps them off the edge",
  "{killer} catches {victim} staring at the live feed and converts distraction into elimination",
  "{killer} drags {victim} away from the center and dumps them over the boundary",
  "{killer} survives the scramble and leaves {victim} with nothing but the spectator view",
  "{killer} catches {victim} mid-taunt and turns the entire chat against them in one move",
  "{killer} shoulder-checks {victim} hard enough to move them from player list to eliminated list",
  "{killer} reads {victim}'s move perfectly and sends them out before the chat can react",
  "{killer} traps {victim} at the edge and wins the shortest negotiation in DWallet history",
  "{killer} steals the angle, steals the moment, and sends {victim} out of the match",
  "{killer} turns a messy pileup into a very clean elimination of {victim}",
  "{killer} catches {victim} one step from safety and makes that step completely irrelevant",
  "{killer} waits for {victim} to look at the scoreboard and chooses exactly that second",
  "{killer} uses the chaos around {third} as cover and launches {victim} from the Arena"
];

const KILL_AFTERMATHS = [
  "The chat updates instantly: {victim} is ELIMINATED. Kill credit goes to {killer}.",
  "DWallet posts the only receipt that matters here: {victim} OUT, {killer} responsible.",
  "The player list refreshes. {victim} disappears from alive status; {killer} gets the elimination.",
  "No pending status on this one. {victim} is ELIMINATED by {killer}.",
  "The feed catches up and confirms it: {killer} eliminated {victim}.",
  "The community reacts before the scoreboard does. {victim} is OUT; {killer} gets the kill.",
  "A purple banner flashes ELIMINATED: {victim}. Credited to {killer}.",
  "The bot does not ask for confirmation. {victim} is gone and {killer} caused it.",
  "The Arena log records {victim} as eliminated by {killer}. Clean result.",
  "One less name in the active list. {victim} is OUT, and {killer} owns the elimination."
];

const SELF_SETUPS = [
  "A DWallet claim alert appears and",
  "The group chat suddenly scrolls at terminal velocity, so",
  "A Telegram sticker covers the one part of the screen that mattered and",
  "The bot posts a notification directly over the action, causing",
  "A purple reward animation fires way too early and",
  "The chat starts screaming 'GO GO GO' for no clear reason, making",
  "A click-to-claim button appears off to the side and",
  "The scoreboard refreshes twice in one second, convincing",
  "A tip notification pings loudly enough to distract",
  "The words DROP LIVE hit the screen and",
  "A fake loading spinner appears over the Arena feed, causing",
  "The community counter jumps unexpectedly and",
  "A flood of reaction emojis covers the lower half of the action while",
  "A DWallet popup says CONGRATS to absolutely nobody yet, so",
  "The chat tags the wrong person and somehow spooks",
  "A bot message arrives with perfect comedic timing and",
  "A purple confetti burst blocks the edge marker for half a second, causing",
  "The live feed briefly freezes and then catches up, leaving",
  "A Telegram notification stack becomes a small novel and distracts",
  "The bot calmly posts 'STAY SHARP' immediately before"
];

const SELF_ACTIONS = [
  "{victim} backpedals directly out of the Arena",
  "{victim} dodges an attack that never existed and crosses the boundary alone",
  "{victim} lunges toward the wrong side and removes themselves from play",
  "{victim} celebrates, takes one step backward, and instantly regrets the geometry",
  "{victim} tries to multitask between chat and combat and loses to both",
  "{victim} runs for what looks like safety and discovers it is actually elimination",
  "{victim} jumps away from the notification and lands outside the match",
  "{victim} spins to check the feed and simply keeps rotating out of competition",
  "{victim} tries to recover near the edge and accidentally finishes the elimination themselves",
  "{victim} takes a confident shortcut that exits the Arena entirely",
  "{victim} attempts an evasive move so effective it evades the whole game",
  "{victim} chooses 'anywhere but here' and unfortunately picks outside the boundary"
];

const SELF_AFTERMATHS = [
  "Nobody touched them. {victim} SELF-ELIMINATED.",
  "The replay is brutal: {victim} eliminated themselves.",
  "No killer gets credit. {victim} is OUT by self-elimination.",
  "DWallet cannot refund bad footwork. {victim} SELF-ELIMINATED.",
  "The bot records it exactly as it happened: {victim} removed themselves from the match.",
  "The chat goes silent for half a second. {victim} is ELIMINATED by their own move.",
  "Official result: SELF-ELIMINATION — {victim}.",
  "There is nobody else to blame. {victim} is OUT.",
  "The active list refreshes without drama: {victim} eliminated themselves.",
  "A thousand reactions arrive at once. {victim} is still very much ELIMINATED."
];

const PIN_SETUPS = [
  "The DWallet feed freezes on the showdown as",
  "The chat starts counting before the official does while",
  "A purple countdown bar appears across the screen as",
  "Every reaction in the group becomes the same wide-eyed emoji while",
  "The bot posts FINAL COUNT and",
  "A drop notification arrives mid-cover while",
  "The community feed explodes into ONE TWO THREE messages as",
  "The Arena status panel locks onto both names while",
  "A Telegram poll from earlier gets completely ignored as",
  "The DWallet logo pulses once for every count while",
  "The spectator chat starts arguing about the kickout before it happens as",
  "A claim button lights up and nobody dares touch it while",
  "The live counter spikes as everyone realizes the pin is real and",
  "The bot posts no commentary at all, which somehow makes it louder, while",
  "The whole DWallet chat seems to hold one collective breath as"
];

const PIN_ACTIONS = [
  "{winner} traps {loser}'s shoulders and holds the position",
  "{winner} catches {loser} in a sudden cover and refuses to give an inch",
  "{winner} rolls {loser} into the pin and hooks the leg",
  "{winner} turns {loser}'s escape into a tighter cover",
  "{winner} survives the scramble and stacks {loser} for the count",
  "{winner} catches {loser} looking at the chat and steals the pin",
  "{winner} drags {loser} back into position and locks the shoulders down",
  "{winner} reverses {loser}'s reversal and keeps the cover",
  "{winner} turns one tiny opening into a full three-count attempt",
  "{winner} plants {loser} flat and commits everything to the pin"
];

const PIN_AFTERMATHS = [
  "ONE. TWO. THREE. {winner} SURVIVES. {loser} is ELIMINATED.",
  "The third count lands. {winner} stays in; {loser} is OUT.",
  "No kickout. Survivor: {winner}. Eliminated: {loser}.",
  "The chat explodes on THREE. {winner} advances and {loser} is gone.",
  "DWallet updates the result: {winner} survives, {loser} is ELIMINATED.",
  "Count complete. {winner} remains in the Arena; {loser} does not.",
  "The scoreboard flips instantly: {winner} SAFE, {loser} OUT.",
  "Three counts settle it. {winner} survives the vote; {loser} is eliminated.",
  "The bot posts the final result: {winner} survives. {loser} is OUT.",
  "One survivor from this duel: {winner}. {loser} is ELIMINATED."
];

const MULTI_SETUPS = [
  "The DWallet chat turns into pure unreadable chaos as",
  "Every spectator tries to call the winner at once while",
  "The purple Arena panel starts stacking names faster than it can display them as",
  "A flood of reactions covers the multi-pin while",
  "The bot posts FINAL COUNT over a pile of terrible decisions as",
  "The whole group starts counting in different rhythms while",
  "The live player counter flickers repeatedly as",
  "A wall of Telegram messages rolls past the showdown while",
  "DWallet's status card tries and fails to make the situation look organized as",
  "The Arena feed zooms mentally, not literally, into the pileup as",
  "The chat collectively realizes nobody knows who is pinning whom while",
  "The spectator reactions become one continuous purple blur as"
];

const MULTI_ACTIONS = [
  "{winner} slips free while every other selected fighter gets trapped in the cover",
  "{winner} escapes the pileup as the remaining fighters collapse into one enormous pin",
  "{winner} rolls clear while everyone else is caught when the count begins",
  "{winner} crawls out of the stack and leaves the rest underneath",
  "{winner} is the only fighter to break free before the third count",
  "{winner} finds daylight while every other selected contestant stays pinned",
  "{winner} escapes at the last possible second and leaves the rest tangled together",
  "{winner} breaks from the heap while the remaining fighters lose the scramble",
  "{winner} gets one shoulder clear of the disaster while everyone else stays trapped",
  "{winner} survives the pileup by inches while the rest run out of space"
];

const MULTI_AFTERMATHS = [
  "THREE. ONLY {winner} SURVIVES. Every other selected fighter is ELIMINATED.",
  "The count lands. Survivor: {winner}. Everyone else in the showdown is OUT.",
  "DWallet keeps one active name from the pile: {winner}. The rest are eliminated.",
  "One survivor. {winner} remains; all other selected fighters are gone.",
  "The bot posts the result: {winner} SAFE. Everyone else involved: ELIMINATED.",
  "The Arena clears the stack and leaves {winner} standing alone.",
  "The player list refreshes with {winner} still active and every other qualifier crossed out.",
  "Only {winner} beats the count. The rest of the showdown is finished.",
  "The chat picks through the wreckage and finds one survivor: {winner}.",
  "Final result: {winner} survives the multi-pin. Everyone else selected is OUT."
];

const REVIVAL_SETUPS = [
  "A DWallet notification marked SECOND CHANCE appears as",
  "The eliminated-player list flickers and one name starts glowing while",
  "The chat suddenly gets a RETURN TO ARENA banner as",
  "A purple restore animation runs across the scoreboard while",
  "The bot posts REVIVAL WINDOW OPEN and",
  "The Arena history scrolls backward through old eliminations as",
  "The DWallet feed pulls two crossed-out names back into focus while",
  "A community vote reaction storm erupts around the revival pit as",
  "The player list temporarily refuses to decide who is dead while",
  "The bot posts one mysterious word — RETURN — as",
  "A second-chance icon appears beside two eliminated names while",
  "The purple status panel unlocks one empty active slot as"
];

const REVIVAL_ACTIONS = [
  "{winner} reaches the active side first while {loser} gets shut back out",
  "{winner} wins the scramble toward the open slot and leaves {loser} behind",
  "{winner} breaks through the revival window while {loser} misses it by a heartbeat",
  "{winner} grabs the second chance first and {loser} remains on the eliminated side",
  "{winner} forces their way back into the player list while {loser} gets crossed out again",
  "{winner} claims the return path before {loser} can reach it",
  "{winner} survives the revival duel while {loser} runs out of time",
  "{winner} catches the opening and re-enters the Arena as {loser} is denied",
  "{winner} gets one more round while {loser} stays in spectator status",
  "{winner} wins the race back to active play and leaves {loser} on the wrong side"
];

const REVIVAL_AFTERMATHS = [
  "REVIVED: {winner}. Still eliminated: {loser}.",
  "{winner} RETURNS TO THE ARENA. {loser} remains OUT.",
  "DWallet restores {winner} to active status. {loser} stays eliminated.",
  "Second chance awarded to {winner}. No return for {loser}.",
  "The player list lights {winner} back up. {loser} remains crossed out.",
  "{winner} is ACTIVE again. {loser} remains ELIMINATED.",
  "One comes back: {winner}. One stays out: {loser}.",
  "Revival winner: {winner}. Revival loser: {loser}.",
  "The bot confirms the return of {winner}. {loser} stays in spectator mode.",
  "The Arena takes {winner} back. {loser} remains on the eliminated list."
];

const NORMAL_SETUPS = [
  "A DWallet tip notification slides across the feed while",
  "The Telegram chat starts arguing about the last round as",
  "A small purple reward animation fires in the corner while",
  "The bot posts a routine status message as",
  "A click-to-claim alert appears and immediately gets ignored while",
  "The community feed starts filling with reactions as",
  "A DWallet balance card briefly covers the scoreboard while",
  "The pinned message gets updated at the exact wrong time as",
  "The live player count refreshes while",
  "A wave of stickers hits the group chat as"
];

const NORMAL_ACTIONS = [
  "{killer} rushes {victim}, but neither crosses the boundary",
  "{killer} shoves {victim} toward the edge and {victim} barely recovers",
  "{killer} swings at {victim}, misses, and both stay active",
  "{killer} corners {victim} near the boundary but cannot finish the elimination",
  "{killer} drives {victim} backward until {victim} finds footing",
  "{killer} tries to use the distraction against {victim}, but the plan falls apart",
  "{killer} catches {victim} looking away and nearly gets the elimination",
  "{killer} forces {victim} into a scramble and both survive",
  "{killer} goes for the clean exit on {victim}, but {victim} hangs on",
  "{killer} attacks {victim} while the chat loses its mind, but nobody is eliminated"
];

const NORMAL_ENDINGS = [
  "No elimination. The chat immediately starts pretending it predicted that.",
  "Both survive. DWallet records nothing except more chaos.",
  "Nobody leaves the Arena. The reactions keep coming anyway.",
  "No kill. The active list stays exactly the same.",
  "Both remain in play. The bot offers no explanation.",
  "No elimination this time. The group chat is disappointed.",
  "Everybody stays active. The next notification arrives immediately.",
  "No one goes out. The purple status panel remains unchanged.",
  "Both survive the exchange. Spectators demand more violence from the RNG.",
  "Nothing settles. The round keeps moving."
];

const RARE_SETUPS = [
  "Every DWallet notification in the chat arrives at the exact same millisecond and",
  "The bot posts a message from ten seconds in the future while",
  "A claim button appears for a drop that does not exist and",
  "The live player list briefly shows one extra username while",
  "Every reaction on the last hundred messages changes to the same purple eye and",
  "The DWallet status panel marks somebody ELIMINATED before the fight starts and",
  "A Telegram message edits itself three times without anyone touching it as",
  "The Arena log displays the next round before this one has finished and",
  "The bot posts 'DO NOT CLICK' directly above a glowing button while",
  "Every phone in the group receives the same blank notification and"
];

const RARE_ACTIONS = [
  "{killer} and {victim} both stop fighting long enough to check whether everyone else saw that",
  "{killer} tries to use the confusion against {victim}, but both lose track of the boundary",
  "{victim} points at the screen and {killer} immediately decides this is above their pay grade",
  "{killer} rushes {victim}, then both freeze when the player list changes again",
  "{killer} and {victim} back away from the glitch in opposite directions",
  "{killer} swings at {victim} and the feed skips the impact entirely",
  "{victim} ducks while {killer} watches their own username disappear and return",
  "{killer} tries to finish {victim} before the display fixes itself and fails",
  "{killer} and {victim} both check the chat instead of completing the fight",
  "{killer} corners {victim}, but the bot posts something so weird that both abandon the attempt"
];

const RARE_ENDINGS = [
  "Nobody is eliminated. The bot refuses to elaborate.",
  "Both survive. The chat spends the next minute arguing about what just happened.",
  "No kill. Premium DWallet weirdness achieved.",
  "Action resumes after several extremely confused seconds.",
  "Nobody leaves the Arena, but the log definitely looks haunted now.",
  "Both stay active. The impossible notification never appears again.",
  "No elimination. The community agrees to pretend that was normal."
];

function combine3(a, b, c, joiner = (x,y,z) => `${x} ${y}. ${z}`) {
  const out = [];
  for (const first of a) for (const second of b) for (const third of c) out.push(joiner(first, second, third));
  return out;
}

const playerKills = combine3(KILL_SETUPS, KILL_ACTIONS, KILL_AFTERMATHS); // 20*25*10 = 5,000
const selfKills = combine3(SELF_SETUPS, SELF_ACTIONS, SELF_AFTERMATHS); // 20*12*10 = 2,400
const pinDuels = combine3(PIN_SETUPS, PIN_ACTIONS, PIN_AFTERMATHS); // 15*10*10 = 1,500
const multiPins = combine3(MULTI_SETUPS, MULTI_ACTIONS, MULTI_AFTERMATHS); // 12*10*10 = 1,200
const revivalDuels = combine3(REVIVAL_SETUPS, REVIVAL_ACTIONS, REVIVAL_AFTERMATHS); // 12*10*10 = 1,200
const normalEvents = combine3(NORMAL_SETUPS, NORMAL_ACTIONS, NORMAL_ENDINGS); // 10*10*10 = 1,000
const rareEvents = combine3(RARE_SETUPS, RARE_ACTIONS, RARE_ENDINGS); // 10*10*7 = 700

export const DWALLET_THEME = {
  id: "dwallet",
  displayName: "DWallet",
  tone: "community-crypto-chaos",
  labels: {
    arena: "DWALLET ARENA",
    revival: "SECOND CHANCE",
    crowdVote: "THE CHAT CHOOSES",
    crowdPin: "COMMUNITY SHOWDOWN"
  },
  playerKills,
  selfKills,
  pinDuels,
  multiPins,
  revivalDuels,
  normalEvents,
  rareEvents
};

export const DWALLET_NARRATION_COUNT =
  playerKills.length + selfKills.length + pinDuels.length + multiPins.length +
  revivalDuels.length + normalEvents.length + rareEvents.length;

if (DWALLET_NARRATION_COUNT !== 13000) {
  throw new Error(`DWallet narration count drifted: expected 13000, got ${DWALLET_NARRATION_COUNT}`);
}
