const NORMAL_SETUPS = [
  "At the roulette pit,","Under the sportsbook odds board,","Beside a screaming slot bank,","At the blackjack tables,","Across the craps pit,","Near the cashier cage,","Inside the VIP lounge,","At the poker rail,","By the ATM that charges criminal fees,","Under the giant FULL TILT promo sign"
];
const NORMAL_ACTIONS = [
  "{killer} pelts {victim} with chips and somehow misses anything vital","{killer} shoves {victim} across the felt but cannot finish the job","{killer} swings a chip rack at {victim} and catches mostly air","{killer} bounces {victim} off a slot cabinet and both stay standing","{killer} sends {victim} sliding across a roulette layout without eliminating them","{killer} whips a losing bet slip at {victim} like it has stopping power","{killer} attacks {victim} with a blackjack shoe and discovers those are less lethal than expected","{killer} launches a casino chair at {victim} and only destroys furniture","{killer} tries to cash {victim} out early but the machine declines the transaction","{killer} corners {victim} behind the craps table and still cannot close the deal"
];
const NORMAL_ENDINGS = [
  "Both remain live money.","Nobody busts. The degeneracy continues.","Both survive, which feels statistically irresponsible.","No elimination. The house looks disappointed.","Everyone involved remains in action.","The pit boss refuses to grade that as a kill.","Still alive. Still stupid. Still gambling.","No cash-out yet.","The Arena keeps both balances open.","Nothing settles. Action continues."
];

const RARE_SETUPS = [
  "A slot machine hits a jackpot nobody triggered and","The roulette ball jumps the wheel and","A floor-wide power flicker reveals Tony's silhouette for half a second before","The cage accidentally dumps a bucket of promo chips and","The sportsbook suspends betting on the fucking fight itself while","Every slot on the floor screams BONUS simultaneously and","A cocktail waitress calmly steps around the carnage as","A giant inflatable casino chip drops from the ceiling and","The PA announces PLEASE GAMBLE RESPONSIBLY at the funniest possible moment while","A mystery hand-pay light starts flashing over"
];
const RARE_ACTIONS = [
  "{killer} and {victim} stop fighting long enough to stare at the bullshit","{killer} tries to weaponize the distraction against {victim} and fails spectacularly","{victim} ducks while {killer} gets showered in worthless promo chips","{killer} points at {victim} and demands surveillance review","{killer} and {victim} both dive for one completely useless chip","{victim} attempts to claim the jackpot mid-fight while {killer} objects violently","{killer} swings at {victim} and accidentally rings the jackpot bell","{victim} hides behind the nearest slot while {killer} searches the wrong aisle","{killer} tries to call a timeout for bankroll management and {victim} refuses","{killer} and {victim} both freeze when the odds board lists them at +10000"
];
const RARE_ENDINGS = [
  "Nobody is eliminated. This counts as a fucking event anyway.","Both survive. The casino refuses to explain itself.","No kill, just premium-grade Full Tilt nonsense.","Action resumes after several seconds of collective confusion.","The house records this as 'other.'"
];

const PIN_SETUPS = [
  "The Final Bet locks in as","The crowd starts pounding the rail while","The sportsbook closes the line the instant","The roulette wheel starts spinning behind them as","A dealer slaps the table and","The jackpot siren becomes the unofficial bell when","Every surviving degen crowds the rail while","The cage lights dim as","A pile of chips spills into the fight while","The odds board flashes LIVE BETTING CLOSED as"
];
const PIN_ACTIONS = [
  "{winner} stacks {loser} across the blackjack felt","{winner} folds {loser} into a pile of losing tickets","{winner} traps {loser} beneath a giant promo chip","{winner} rolls {loser} away from the ropes and hooks the leg","{winner} pins {loser} against the base of a slot cabinet","{winner} catches {loser} after a roulette-table scramble","{winner} drags {loser} out of the VIP section and into the count","{winner} plants {loser} beside the craps rail","{winner} catches {loser} reaching for a chip rack and steals the cover","{winner} turns {loser}'s all-in charge into a brutal pin"
];
const PIN_ENDINGS = [
  "THREE. {winner} survives. {loser} is ELIMINATED.","Ticket settled: {winner} WINS; {loser} BUSTS.","No push. {winner} stays; {loser} is OUT.","The pit confirms it. {winner} survives and {loser} is eliminated.","FINAL BET PAID: {winner}. CASH OUT: {loser}.","{loser} goes broke. {winner} remains live money.","The count hits three. {winner} advances; {loser} is dead money.","{winner} covers. {loser} covers the fucking floor.","The bell rings for {winner}. {loser} is eliminated.","One bankroll remains in this bet: {winner}. {loser} is OUT."
];

const REVIVE_SETUPS = [
  "DOUBLE OR NOTHING opens beneath a flashing hand-pay light as","The elimination lounge gets one last betting window when","A roulette wheel marked RETURN / STAY DEAD starts spinning while","The cage finds one final marker and","A slot cabinet spits out a SECOND CHANCE ticket as","The sportsbook posts resurrection odds and","The pit boss opens one deeply irresponsible comeback line while","A single purple chip rolls out from under the table and","The jackpot meter resets itself to REVIVE as","The casino PA announces ONE MORE FUCKING CHANCE while"
];
const REVIVE_ACTIONS = [
  "{winner} beats {loser} to the ticket","{winner} wins the coin flip over {loser}","{winner} grabs the marker before {loser}","{winner} lands the comeback bet while {loser} misses","{winner} reaches the roulette chip first","{winner} steals the hand-pay voucher from {loser}","{winner} cashes the impossible ticket before {loser}","{winner} covers the resurrection spread and {loser} does not","{winner} gets the only seat back at the table","{winner} takes the last playable chip while {loser} comes up empty"
];
const REVIVE_ENDINGS = [
  "REVIVED: {winner}. {loser} stays busted.","{winner} returns to action. {loser} remains ELIMINATED.","BANKROLL RESTORED: {winner}. {loser} stays at zero.","{winner} gets another fucking chance. {loser} does not.","DOUBLE OR NOTHING PAYS {winner}. {loser} remains out.","The cage reopens for {winner}. It stays closed for {loser}.","{winner} is LIVE MONEY again. {loser} remains dead money.","The comeback ticket belongs to {winner}. {loser} stays gone.","{winner} returns from elimination. {loser} remains eliminated.","One degen comes back: {winner}. The other one, {loser}, stays fucked."
];

const SELF_SETUPS = [
  "Trying to martingale a physical fight,","After screaming ALL IN with no plan,","While climbing onto a slot bank for absolutely no reason,","After betting their own survival on red,","While attempting to steal a giant promotional chip,","After trying to vault a blackjack table,","While arguing with an ATM mid-match,","After celebrating a jackpot they did not win,","While sprinting toward the cashier cage,","After deciding basic strategy is coward shit,"
];
const SELF_ACTIONS = [
  "{victim} slips on chips and removes themselves from contention","{victim} gets folded by their own ricocheting chip rack","{victim} runs directly into a slot cabinet and eliminates themselves","{victim} trips over the VIP rope and crosses the boundary alone","{victim} launches themselves across the roulette table and out of the Arena","{victim} pulls a chair down on themselves with remarkable efficiency","{victim} dives for a loose chip and sails straight out of competition","{victim} gets tangled in losing bet slips and somehow loses to paper","{victim} smashes the wrong CASH OUT button and apparently it works","{victim} attempts a flying attack on nobody and exits the match"
];
const SELF_ENDINGS = [
  "SELF-ELIMINATION: {victim}. Nobody gets kill credit.","{victim} is OUT by their own stupid fucking decision.","BUST: {victim}. Killer: also {victim}.","The house wins. {victim} eliminates themselves.","{victim} cashes themselves the fuck out.","No opponent required. {victim} is ELIMINATED.","Replay confirms {victim} did every bit of that alone.","Bad beat, self-inflicted: {victim} is OUT.","The ticket reads {victim}: SELF-ELIMINATED.","Congratulations to nobody. {victim} eliminated themselves."
];

const MULTI_SETUPS = [
  "The Final Bet turns into a full-table disaster as","A four-way all-in erupts when","The crowd tie creates a degenerate pileup and","The roulette pit becomes the showdown floor as","Every qualifier charges at once when","The sportsbook posts one survivor and immediately locks betting as","The chips hit the floor and all qualifiers dive in while","The jackpot siren starts the multi-pin as","The pit boss abandons the area when","The entire VIP rail collapses into the showdown as"
];
const MULTI_ACTIONS = [
  "{winner} escapes the pile while everyone else gets stacked beneath the count","{winner} rolls free while the rest get trapped under a mountain of chips","{winner} reaches the rail as every other qualifier gets caught in the cover","{winner} survives the casino-floor pileup and leaves the rest pinned","{winner} slips out beneath the roulette table while everyone else gets counted","{winner} is the only degen to break free before three","{winner} crawls out of the chip avalanche while the others remain trapped","{winner} dodges the giant promo chip while every other qualifier gets buried under the cover","{winner} gets clear as the rest collapse into one catastrophic pin","{winner} survives the all-in while every other stack hits zero"
];
const MULTI_ENDINGS = [
  "ONLY {winner} SURVIVES. Everyone else selected is ELIMINATED.","The table clears. {winner} remains; every other qualifier is OUT.","One stack survives: {winner}. The rest are dead money.","FINAL BET COMPLETE: {winner} survives. Everybody else busts.","The count lands. {winner} stays; all other selected fighters are eliminated."
];

function combine3(a,b,c){const out=[];for(const x of a)for(const y of b)for(const z of c)out.push(`${x} ${y}. ${z}`);return out}

export const FULL_TILT_MEGA = {
  normalEvents: combine3(NORMAL_SETUPS,NORMAL_ACTIONS,NORMAL_ENDINGS),        // 1,000
  rareEvents: combine3(RARE_SETUPS,RARE_ACTIONS,RARE_ENDINGS),              // 500
  pinDuels: combine3(PIN_SETUPS,PIN_ACTIONS,PIN_ENDINGS),                   // 1,000
  revivalDuels: combine3(REVIVE_SETUPS,REVIVE_ACTIONS,REVIVE_ENDINGS),      // 1,000
  selfKills: combine3(SELF_SETUPS,SELF_ACTIONS,SELF_ENDINGS),               // 1,000
  multiPins: combine3(MULTI_SETUPS,MULTI_ACTIONS,MULTI_ENDINGS)             // 500
};
export const FULL_TILT_MEGA_COUNT = Object.values(FULL_TILT_MEGA).reduce((n,pool)=>n+pool.length,0); // 5,000
