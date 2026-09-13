const KILL_ZONES = [
  "At the main poker table",
  "Under the FULL TILT neon",
  "Beside the high-roller rail",
  "At the cashier cage",
  "Across the roulette pit",
  "Between two screaming slot banks",
  "At the sportsbook counter",
  "On the blackjack floor",
  "Near the craps rail",
  "Inside the VIP poker room"
];

const KILL_OPENERS = [
  "a dealer freezes mid-pitch as",
  "the rail starts chanting ALL IN while",
  "a tower of purple chips tips over when",
  "the bad-beat siren picks the worst possible moment and",
  "the odds board suspends action just before",
  "someone yells SHIP IT with criminal confidence and",
  "the table camera catches every stupid second as",
  "the pit boss looks away for exactly one second and",
  "the felt becomes a deeply irresponsible battlefield when",
  "the house music cuts out just in time for"
];

const KILL_MOVES = [
  "{killer} sends {victim} sliding across the felt and straight out of the hand",
  "{killer} folds {victim} over the rail like the ugliest mucked hand in history",
  "{killer} launches a chip rack through {victim}'s entire comeback plan",
  "{killer} turns a dealer button into a ridiculous but effective problem for {victim}",
  "{killer} shoves {victim} into the rail with the confidence of someone open-jamming seven deuce",
  "{killer} bounces {victim} off the poker table and calls the result a clean value bet",
  "{killer} sends {victim} through a pile of losing tickets and keeps walking",
  "{killer} cashes {victim} out with one spectacularly irresponsible casino-chair shot",
  "{killer} catches {victim} reaching for chips and converts it into a one-way trip to the rail",
  "{killer} punts {victim} out of the Arena harder than a tilted stack at four in the morning"
];

const KILL_ENDINGS = [
  "{victim} is ELIMINATED. {killer} gets the credit. Full Tilt keeps the rake.",
  "BAD BEAT CONFIRMED: {victim} is OUT. {killer} remains live money.",
  "TABLE CLOSED for {victim}. {killer} survives with chips in front.",
  "{victim} goes BUST. {killer} gets the receipt and absolutely no sympathy.",
  "CASH OUT: {victim}. {killer} stays in action. The rail immediately starts talking shit."
];

const SELF_CONTEXTS = [
  "Trying to bluff furniture",
  "After open-jamming with no plan",
  "While celebrating before the river",
  "During a completely unnecessary victory lap",
  "After arguing with the dealer button",
  "While chasing one loose chip across the floor",
  "After declaring THIS IS THE ONE",
  "While trying to rebuy into a fight that has no rebuy"
];

const SELF_MISHAPS = [
  "{victim} trips over the rail",
  "{victim} slips on a stack of chips",
  "{victim} dives across the felt and misses everything",
  "{victim} shoulder-checks a slot cabinet they absolutely saw coming",
  "{victim} gets tangled in the VIP rope",
  "{victim} launches a chip rack that immediately comes back at them",
  "{victim} hits the wrong CASH OUT button",
  "{victim} attempts to vault the poker table and loses the argument with gravity",
  "{victim} sprints into the sportsbook counter",
  "{victim} tries to kick a casino chair and somehow the chair wins"
];

const SELF_CONSEQUENCES = [
  "and removes themselves from the hand",
  "and turns their own stack into a memorial",
  "and discovers that tilt is not a movement strategy",
  "and gets sent directly to the rail by pure hubris",
  "and makes the surveillance review incredibly easy",
  "and converts zero opponent pressure into a full elimination",
  "and proves the house really can win without helping",
  "and creates a bad beat entirely from scratch",
  "and somehow punts the whole Arena with nobody touching them",
  "and makes everyone watching say 'how the fuck did that happen?'"
];

const SELF_ENDINGS = [
  "SELF-ELIMINATION: {victim}. Nobody gets kill credit.",
  "BUST: {victim}. Killer: also {victim}.",
  "{victim} is OUT. Full Tilt records the cause as 'unforced error.'"
];

const DUEL_SETUPS = [
  "THE FINAL BET locks in as",
  "The poker rail pounds the table while",
  "The dealer burns one last card and",
  "The sportsbook closes every line when",
  "The FULL TILT sign flickers overhead as",
  "The high-limit room goes silent when",
  "A single purple chip spins across the felt as",
  "The pit boss points at the center table and",
  "The table camera zooms in just as",
  "Every surviving degen crowds the rail while"
];

const DUEL_ACTIONS = [
  "{winner} stacks {loser} across the felt",
  "{winner} catches {loser} on the rail and steals the count",
  "{winner} turns {loser}'s all-in charge into a brutal cover",
  "{winner} folds {loser} into a pile of losing slips",
  "{winner} traps {loser} beneath a spilled mountain of chips",
  "{winner} shoves {loser} off balance beside the dealer box",
  "{winner} catches {loser} reaching for the chip rack and closes the hand",
  "{winner} rolls through {loser}'s last-second escape attempt",
  "{winner} survives the table scramble and keeps {loser} under the count",
  "{winner} turns a filthy river-sized comeback into {loser}'s final bad beat"
];

const DUEL_ENDINGS = [
  "THREE. {winner} survives. {loser} is ELIMINATED.",
  "FINAL BET PAID: {winner}. {loser} goes BUST.",
  "No chop. No refund. {winner} stays and {loser} is OUT.",
  "The rail explodes. {winner} advances; {loser} is dead money.",
  "Ticket settled: {winner} WIN. {loser} CASHED OUT.",
  "The hand is over. {winner} remains seated; {loser} hits the rail.",
  "{winner} gets the pot. {loser} gets the walk of shame.",
  "Full Tilt keeps one stack alive: {winner}. {loser} is gone.",
  "The count lands. {winner} survives; {loser} is eliminated.",
  "The table breaks in {winner}'s favor. {loser} is OUT.",
  "{loser} cannot suck out this time. {winner} survives.",
  "River card, final count, same result: {winner} stays; {loser} leaves.",
  "The dealer pushes the imaginary pot to {winner}. {loser} is eliminated.",
  "One player still has chips: {winner}. {loser} is officially busted.",
  "FULL TILT // FINAL BET COMPLETE: {winner} survives. {loser} does not."
];

const MULTI_SETUPS = [
  "A table-wide all-in detonates when",
  "THE FINAL BET ties three stacks together as",
  "The rail screams for one survivor while",
  "A mountain of chips spills into the showdown as",
  "The high-limit room becomes a disaster when",
  "The sportsbook posts ONE SURVIVOR and locks the line as",
  "The dealer abandons the box when",
  "The FULL TILT table camera somehow catches everything as"
];

const MULTI_ACTIONS = [
  "{winner} slips out of the pile while every other qualifier gets trapped under the count",
  "{winner} keeps one stack upright while the rest of the table collapses",
  "{winner} crawls clear of the chip avalanche and leaves the others buried in the cover",
  "{winner} survives the rail-side pileup while every other qualifier gets counted out",
  "{winner} ducks beneath the table scramble and emerges as the only live stack",
  "{winner} turns a multi-way punt into everybody else's problem",
  "{winner} breaks free at two while the rest stay trapped until three",
  "{winner} survives the all-in collision and leaves every other stack at zero",
  "{winner} finds the one clean exit while the rest of the qualifiers fold into each other",
  "{winner} somehow scoops the entire ugly fucking pot and leaves nobody else standing"
];

const MULTI_ENDINGS = [
  "ONLY {winner} SURVIVES. Everybody else selected is ELIMINATED.",
  "One live stack remains: {winner}. The rest are dead money.",
  "FINAL BET COMPLETE: {winner} stays. Everyone else busts.",
  "The table clears around {winner}. All other qualifiers are OUT.",
  "No side pot saves anybody. {winner} is the sole survivor.",
  "The count finishes. {winner} survives; the rest hit the rail.",
  "Full Tilt pays exactly one seat: {winner}. Everyone else is eliminated.",
  "The rail gets one winner to scream about: {winner}. The rest are gone.",
  "{winner} scoops it. Every other qualifier gets cashed out.",
  "One stack. One chair. One survivor: {winner}.",
  "The multi-way disaster ends with {winner} still active and everybody else out.",
  "The dealer pushes the whole imaginary pot to {winner}. The table is cleared.",
  "Every other stack hits zero. {winner} remains live money.",
  "The bad beat belongs to literally everyone except {winner}.",
  "FULL TILT // TABLE SETTLED: {winner} survives alone."
];

const REVIVE_SETUPS = [
  "DOUBLE OR NOTHING opens when",
  "The elimination lounge gets one last hand as",
  "A SECOND CHANCE chip lands on the felt while",
  "The cashier cage finds one impossible marker as",
  "The sportsbook posts resurrection odds when",
  "The dealer pitches one card marked RETURN TO PLAY as",
  "The bad-beat desk approves exactly one comeback while",
  "The FULL TILT floor announces ONE MORE HAND as"
];

const REVIVE_ACTIONS = [
  "{winner} beats {loser} to the comeback chip",
  "{winner} wins the flip while {loser} watches the last out miss",
  "{winner} reaches the marker before {loser}",
  "{winner} catches the river they needed and leaves {loser} drawing dead",
  "{winner} claims the only open seat before {loser}",
  "{winner} turns one final chip into a return ticket while {loser} blanks",
  "{winner} wins the resurrection race by a single ugly beat",
  "{winner} steals the hand-pay voucher out from under {loser}",
  "{winner} covers the comeback line while {loser} does not",
  "{winner} finds the one surviving out and {loser} bricks everything"
];

const REVIVE_ENDINGS = [
  "REVIVED: {winner}. {loser} remains ELIMINATED.",
  "BANKROLL RESTORED: {winner}. {loser} stays at zero.",
  "{winner} returns to the Arena. {loser} stays busted.",
  "DOUBLE OR NOTHING PAYS {winner}. {loser} gets nothing.",
  "The cage reopens for {winner}. It stays closed for {loser}.",
  "{winner} is LIVE MONEY again. {loser} remains dead money.",
  "One comeback ticket exists and it belongs to {winner}. {loser} stays out.",
  "{winner} gets one more hand. {loser} remains on the rail.",
  "The dealer seats {winner} again. {loser} does not return.",
  "Full Tilt reverses exactly one elimination: {winner}. {loser} remains gone.",
  "{winner} spikes the comeback. {loser} bricks the last chance.",
  "The resurrection pot slides to {winner}. {loser} stays eliminated.",
  "{winner} comes back with one chip and bad intentions. {loser} stays out.",
  "The return light turns green for {winner} and red for {loser}.",
  "SECOND CHANCE COMPLETE: {winner} revives. {loser} remains eliminated."
];

const NORMAL_SETUPS = [
  "At the main poker table",
  "Under the FULL TILT neon",
  "Along the high-limit rail",
  "At the sportsbook counter",
  "Near the cashier cage",
  "Beside the roulette wheel",
  "Between slot banks",
  "At the blackjack tables",
  "Across the craps pit",
  "Inside the VIP room"
];

const NORMAL_ACTIONS = [
  "{killer} fires a chip at {victim} and misses anything important",
  "{killer} shoves {victim} across the felt but cannot finish the hand",
  "{killer} tries to bluff {victim} into eliminating themselves and gets called",
  "{killer} swings a chip rack at {victim} and mostly destroys table etiquette",
  "{killer} sends {victim} into the rail and both somehow stay active",
  "{killer} starts a table-side scrap with {victim} that solves absolutely nothing",
  "{killer} chases {victim} around the dealer box and loses position",
  "{killer} tries to cash {victim} out early and gets DECLINED",
  "{killer} punts a chair toward {victim} and only hurts the furniture",
  "{killer} corners {victim} behind the poker table but cannot close the action"
];

const NORMAL_ENDINGS = [
  "Nobody busts. Action continues.",
  "Both remain live money.",
  "No elimination. The rail boos anyway.",
  "The dealer calls it a wash and keeps the hand moving.",
  "Both stacks survive, against all reasonable bankroll management.",
  "The pit refuses to grade that as a kill.",
  "Still active. Still tilted. Still making bad decisions.",
  "No cash-out yet.",
  "The table stays open for both players.",
  "Nothing settles. Full Tilt keeps dealing."
];

const RARE_SETUPS = [
  "The bad-beat jackpot light activates with no qualifying hand and",
  "Every screen in the poker room flashes ALL IN at once and",
  "The table camera briefly labels the dealer button as a player and",
  "A purple chip rolls uphill across the felt and",
  "The sportsbook posts odds on the dealer walking away and",
  "The FULL TILT neon flickers into TILT FULL for three seconds and",
  "The cashier cage printer spits out a receipt dated tomorrow and"
];

const RARE_ACTIONS = [
  "{killer} and {victim} stop fighting long enough to question reality",
  "{killer} tries to exploit the distraction and somehow punts position instead",
  "{victim} points at the anomaly while {killer} demands a floor ruling",
  "{killer} calls for surveillance and {victim} starts laughing",
  "{killer} and {victim} both dive for a chip that should not be moving",
  "{victim} tries to claim the jackpot while {killer} argues the hand is dead",
  "{killer} checks the river that does not exist and {victim} checks behind",
  "{victim} hides behind the dealer box while {killer} searches the wrong table",
  "{killer} calls TIME and the Arena ignores them",
  "{killer} and {victim} both stare at the odds board when it lists them as OFF THE BOARD"
];

const RARE_ENDINGS = [
  "Nobody is eliminated. Full Tilt logs it as 'weird shit.'",
  "Both survive. The floor refuses to explain it.",
  "No kill. Just premium-grade casino nonsense.",
  "Action resumes after an uncomfortable amount of silence.",
  "The table camera cuts away and pretends that never happened.",
  "Both players stay active. The rail immediately invents six conspiracy theories.",
  "The hand continues. Nobody agrees on what they just saw.",
  "No elimination. Surveillance has somehow lost the clip.",
  "The pit writes OTHER on the report and moves on.",
  "Everyone survives. Full Tilt remains deeply unserious."
];

function combine4(a,b,c,d){const out=[];for(const w of a)for(const x of b)for(const y of c)for(const z of d)out.push(`${w}, ${x} ${y}. ${z}`);return out}
function combine3(a,b,c){const out=[];for(const x of a)for(const y of b)for(const z of c)out.push(`${x}, ${y}. ${z}`);return out}

export const FULL_TILT_PASS_2 = {
  playerKills: combine4(KILL_ZONES,KILL_OPENERS,KILL_MOVES,KILL_ENDINGS),       // 5,000
  selfKills: combine4(SELF_CONTEXTS,SELF_MISHAPS,SELF_CONSEQUENCES,SELF_ENDINGS), // 2,400
  pinDuels: combine3(DUEL_SETUPS,DUEL_ACTIONS,DUEL_ENDINGS),                    // 1,500
  multiPins: combine3(MULTI_SETUPS,MULTI_ACTIONS,MULTI_ENDINGS),                // 1,200
  revivalDuels: combine3(REVIVE_SETUPS,REVIVE_ACTIONS,REVIVE_ENDINGS),          // 1,200
  normalEvents: combine3(NORMAL_SETUPS,NORMAL_ACTIONS,NORMAL_ENDINGS),          // 1,000
  rareEvents: combine3(RARE_SETUPS,RARE_ACTIONS,RARE_ENDINGS)                   // 700
};

export const FULL_TILT_PASS_2_COUNT = Object.values(FULL_TILT_PASS_2).reduce((n,pool)=>n+pool.length,0); // 13,000
