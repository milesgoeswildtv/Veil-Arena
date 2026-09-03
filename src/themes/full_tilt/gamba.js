const SETUPS = [
  "The roulette wheel screams like it has money on this too when",
  "A tower of casino chips detonates across the floor as",
  "The slot bank flashes JACKPOT for absolutely no fucking reason while",
  "Somebody yells DOUBLE OR NOTHING and",
  "The sportsbook board changes the odds mid-fight because apparently",
  "A dealer abandons the table and lets",
  "The craps stick becomes a deeply irresponsible weapon when",
  "A rain of worthless bonus coins announces that",
  "The cashier cage shutters come down behind",
  "A giant novelty chip rolls through the Arena just as",
  "The roulette ball launches off the wheel like it owes somebody money and",
  "The progressive jackpot siren starts screaming while",
  "A busted slot cabinet spits sparks across the carpet as",
  "The VIP rope snaps and somehow this becomes",
  "The blackjack table gets flipped because basic strategy has failed",
  "A cocktail tray hits the floor and suddenly",
  "The casino PA announces LAST CALL FOR BAD DECISIONS while",
  "A stack of purple chips becomes airborne when",
  "The cage count is short and somehow everyone blames",
  "The fucking ATM declines somebody at the worst possible moment as"
];

const ACTIONS = [
  "{killer} caves the momentum out from under {victim} with a stack of casino chips.",
  "{killer} introduces {victim} to the business end of a slot-machine door.",
  "{killer} sends {victim} ass-first across a blackjack table and straight out of contention.",
  "{killer} weaponizes a roulette wheel against {victim}, which is definitely not in the rulebook.",
  "{killer} launches a chip rack at {victim} like a degenerate discus champion.",
  "{killer} catches {victim} with the world's most financially irresponsible roulette-table clothesline.",
  "{killer} folds {victim} over the craps table and calls it a hard eight.",
  "{killer} bounces {victim} off three slot cabinets and collects absolutely zero free spins.",
  "{killer} buries {victim} beneath enough chips to make the cage manager start sweating.",
  "{killer} hits {victim} with a blackjack shoe and screams HIT ME like a fucking maniac.",
  "{killer} shoves {victim} into the slot bank just as every machine starts screaming BONUS.",
  "{killer} sends {victim} spinning across the roulette layout like a human ball on zero.",
  "{killer} cashes out {victim} with a casino-chair shot nobody saw coming.",
  "{killer} uses a giant promotional chip to flatten {victim}'s entire fucking game plan.",
  "{killer} sends {victim} over the sportsbook counter and immediately celebrates the cover.",
  "{killer} turns a baccarat paddle into a problem for {victim}.",
  "{killer} slams the cash-out button and somehow {victim} is what comes out of the machine.",
  "{killer} throws {victim} into a pile of losing bet slips and adds one more.",
  "{killer} sends {victim} through the velvet VIP rope like comp status means nothing here.",
  "{killer} hits {victim} with the Full Tilt special: terrible judgment followed by immediate consequences."
];

const AFTERMATHS = [
  "{victim} is ELIMINATED. {killer} gets the kill credit and probably still tips like shit.",
  "CASH OUT: {victim} is ELIMINATED by {killer}.",
  "The board marks {victim} DEAD MONEY. {killer} survives.",
  "{victim} has officially gone BUST. Killer: {killer}.",
  "No hand pay. No comeback. {victim} is ELIMINATED by {killer}.",
  "The pit boss checks the tape. Yep. {killer} absolutely eliminated {victim}.",
  "{victim}'s balance hits zero. {killer} gets the fucking receipt.",
  "The cage is closed for {victim}. {killer} remains in action.",
  "BAD BEAT: {victim} is out. {killer} caused it.",
  "The house does not refund {victim}. ELIMINATED by {killer}."
];

const SELF_SETUPS = [
  "{victim} tries to martingale physical violence and",
  "{victim} sees a flashing BONUS symbol and immediately",
  "{victim} attempts to climb the slot bank because apparently",
  "{victim} bets their continued existence on red and",
  "{victim} screams FUCK IT, ALL IN before",
  "{victim} tries to vault the roulette table and",
  "{victim} decides the giant promotional chip looks throwable and",
  "{victim} attempts a victory lap around the craps table before winning anything and",
  "{victim} mistakes the cashier cage for an exit and",
  "{victim} decides basic strategy is for cowards and"
];
const SELF_ACTIONS = [
  "gets absolutely bodied by their own terrible decision.",
  "falls directly into a slot-machine bank and never recovers.",
  "takes themselves out with a ricocheting casino chip. Incredible.",
  "slips on a mountain of losing bet slips and eliminates themselves.",
  "gets launched off the roulette rail by pure fucking hubris.",
  "pulls a chip rack down on themselves and instantly regrets having arms.",
  "dives across the blackjack table, misses everything, and cashes themselves out.",
  "gets tangled in the VIP rope and somehow loses the entire Arena match to furniture.",
  "hits the wrong lever, gets smacked by the slot door, and folds like a bad hand.",
  "manages to turn a harmless casino chair into a career-ending tactical error."
];
const SELF_AFTER = [
  "SELF-ELIMINATION: {victim}. Nobody gets credit for that shit.",
  "{victim} is ELIMINATED by {victim}. Outstanding bankroll management.",
  "BUST: {victim}. Killer: also {victim}.",
  "The house wins. {victim} self-eliminates.",
  "{victim} has cashed themselves the fuck out.",
  "No opponent required. {victim} is ELIMINATED.",
  "The replay confirms it: {victim} did all of that to themselves.",
  "{victim} goes broke in the only currency that matters: being alive in Arena.",
  "That is a self-inflicted bad beat. {victim} is OUT.",
  "Congratulations to absolutely nobody. {victim} eliminated themselves."
];

const PIN_ACTIONS = [
  "{winner} sends {loser} through a roulette table and covers them under a pile of chips.",
  "{winner} jams {loser} against the slot bank until the machine itself seems embarrassed.",
  "{winner} wins the world's least regulated blackjack hand using {loser} as the fucking card.",
  "{winner} rolls {loser} across the craps layout and the stickman calls it OUT.",
  "{winner} drops the giant casino chip on {loser}'s comeback attempt.",
  "{winner} cashes {loser} out at the cage with extreme prejudice.",
  "{winner} spins {loser} around the roulette rail and leaves them on double zero.",
  "{winner} buries {loser} under a mountain of losing slips and sits on the pile.",
  "{winner} uses the blackjack table as a launch ramp and {loser} as the projectile.",
  "{winner} hits the jackpot. Unfortunately the jackpot is eliminating {loser}."
];
const PIN_AFTER = [
  "{winner} SURVIVES. {loser} is ELIMINATED.",
  "FINAL BET SETTLED: {winner} stays. {loser} goes bust.",
  "The crowd gets its action. {winner} survives; {loser} is OUT.",
  "{loser} is dead money. {winner} advances.",
  "CASH OUT: {loser}. {winner} remains in the Arena.",
  "The ticket reads {winner}: WINNER. {loser}: FUCKED.",
  "No push. No refund. {winner} survives and {loser} is eliminated.",
  "{winner} covers the spread. {loser} covers the floor.",
  "The pit confirms it: {winner} stays alive; {loser} is gone.",
  "House lights off for {loser}. {winner} survives."
];

const REVIVE_ACTIONS = [
  "The dead-money table opens and {winner} beats {loser} in one last filthy double-or-nothing.",
  "A slot machine spits out exactly one RETURN TO PLAY ticket. {winner} takes it from {loser}.",
  "The roulette wheel decides somebody gets their bankroll back. It lands on {winner}, not {loser}.",
  "The cage offers one impossible marker. {winner} signs before {loser} can reach the pen.",
  "A jackpot siren goes off in the elimination lounge. {winner} gets the hand pay; {loser} gets nothing.",
  "One busted gambler gets action again. {winner} wins the flip over {loser}.",
  "The casino finds one last chip under the table. {winner} claims it and sends {loser} back to broke-ass purgatory.",
  "The comeback bet is posted. {winner} covers. {loser} absolutely does not.",
  "The sportsbook hangs a line on resurrection. {winner} somehow fucking cashes it.",
  "The house comps one return from the dead. {winner} gets it. {loser} gets the bill."
];
const REVIVE_AFTER = [
  "REVIVED: {winner}. {loser} remains ELIMINATED.",
  "{winner} is BACK IN ACTION. {loser} stays busted.",
  "BANKROLL RESTORED: {winner}. {loser} remains at zero.",
  "{winner} returns to the Arena. {loser} remains dead money.",
  "The comeback ticket belongs to {winner}. {loser} stays out.",
  "{winner} gets one more fucking chance. {loser} does not.",
  "The cage reopens for {winner}. It stays welded shut for {loser}.",
  "{winner} is officially LIVE MONEY again. {loser} remains eliminated.",
  "The house reverses exactly one decision: {winner} returns. {loser} stays gone.",
  "DOUBLE OR NOTHING PAID: {winner} revives. {loser} remains out."
];

function combine3(a, b, c) { const out = []; for (const x of a) for (const y of b) for (const z of c) out.push(`${x} ${y} ${z}`); return out; }
function combine2(a, b) { const out = []; for (const x of a) for (const y of b) out.push(`${x} ${y}`); return out; }

const playerKills = combine3(SETUPS, ACTIONS, AFTERMATHS); // 4,000
const selfKills = combine3(SELF_SETUPS, SELF_ACTIONS, SELF_AFTER); // 1,000
const pinDuels = combine2(PIN_ACTIONS, PIN_AFTER); // 100
const revivalDuels = combine2(REVIVE_ACTIONS, REVIVE_AFTER); // 100
const multiPins = [
  ...pinDuels,
  "The Final Degenerate Table opens. {winner} starts swinging chip racks until every other qualifier is busted. Only {winner} survives.",
  "The roulette wheel demands one survivor. {winner} stays standing while the rest of the table gets cashed the fuck out.",
  "A slot jackpot erupts over the melee. When the lights stop flashing, {winner} is the only qualifier still in action.",
  "Everybody goes ALL IN. {winner} has the only stack left when the smoke clears. Everyone else is ELIMINATED.",
  "The pit boss calls LAST GAMBLER STANDING. {winner} takes that personally and clears the fucking table."
];

export const FULL_TILT_GAMBA = {
  id: "full_tilt",
  displayName: "Full Tilt: Degenerate Casino",
  tone: "vulgar_gamba_chaos",
  contentRating: "vulgar_non_graphic_violence",
  labels: {
    arena: "FULL TILT: ALL IN",
    revival: "DOUBLE OR NOTHING",
    crowdVote: "THE DEGENS CHOOSE",
    crowdPin: "THE FINAL BET"
  },
  playerKills,
  selfKills,
  pinDuels,
  multiPins,
  revivalDuels
};
