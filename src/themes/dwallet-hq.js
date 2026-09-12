import { DWALLET_THEME as DWALLET_CORE_THEME, DWALLET_NARRATION_COUNT as DWALLET_CORE_COUNT } from "./dwallet.js";

// DWallet HQ expansion.
// The original DWallet pack contributes 13,000 deterministic templates.
// This layer creates one additional HQ-specific variant for every original template,
// bringing the live DWallet theme to exactly 26,000 deterministic narrations.
// Flavor only: no wallet balances, private data, claims, or financial actions are read or changed.

const HQ_CONTEXTS = {
  playerKills: [
    "Inside Crek's Lair, every monitor flashes red at once.",
    "Peach's Lair goes dead quiet right before somebody makes a terrible decision.",
    "Peach reaches suspiciously close to the red button in HQ.",
    "Crek looks away from the control wall for exactly one second.",
    "Drop Control sounds an alarm nobody remembers installing.",
    "The giant claim board in Claim Hall lights up like it wants blood.",
    "The DWallet Vault seals one door and accidentally leaves the dangerous one open.",
    "Bot Basement reports a completely normal system status during extremely abnormal circumstances.",
    "The Server Room fans spin up like they know a fight is coming.",
    "The Sticker Lab launches three reaction stickers before anything has even happened.",
    "The Treasury floor displays a giant purple warning nobody bothers to read.",
    "The Drop Chamber starts a countdown with absolutely no context.",
    "Wallet Ops loses control of the big screen at the worst possible moment.",
    "The Community Floor starts chanting before anybody knows who they are chanting for.",
    "The Rooftop Relay catches the whole disaster in perfect signal quality.",
    "The Purple Corridor suddenly has way too many spectators and nowhere near enough common sense.",
    "The QR Room projects a code onto the wall while everyone wisely ignores it for once.",
    "The Transaction Bay dings like somebody just got a receipt for violence.",
    "The Degen Lounge empties into the hallway because apparently nobody can mind their business.",
    "The Mod War Room immediately agrees this is somebody else's problem.",
    "Cold Storage unlocks with a hiss dramatic enough to make the entire HQ turn around.",
    "The Tip Tunnel starts firing notifications like a slot machine with anxiety.",
    "The Ledger Hall display updates one second before the people in the room do.",
    "The Notification Nest goes from annoying to catastrophic in under a second.",
    "The Claim Queue collectively forgets it was supposed to be a queue.",
    "The API Closet produces a noise no closet should ever produce.",
    "The Drop Map in HQ marks one player with a giant blinking target for no useful reason.",
    "A sign in DWallet HQ says PLEASE REMAIN CALM, so naturally nobody does.",
    "The main HQ feed zooms in with the confidence of a camera crew that smells disaster.",
    "Someone in Peach's Lair whispers 'do it' and Peach absolutely should not have heard that.",
    "Crek's Lair receives a system alert reading CREK ME UP, which helps nobody.",
    "The central DWallet command deck switches from COMMUNITY MODE to OH NO.",
    "A purple beacon over HQ activates even though nobody knows what it is connected to.",
    "The VIP claim balcony gets front-row seats to consequences.",
    "The wallet elevator opens directly into chaos and immediately closes again.",
    "The DWallet war table redraws the Arena boundary like it is trying to warn somebody.",
    "HQ Security watches the feed, considers intervening, and chooses entertainment instead.",
    "The giant DWALLET sign flickers exactly once before everything goes sideways.",
    "Peach's red button cover flips open by itself. Nobody likes that.",
    "Crek's Lair starts recording in 4K because apparently humiliation needs archival quality."
  ],

  selfKills: [
    "Crek's Lair has a perfectly good floor plan, which makes what happens next worse.",
    "Peach's Lair contains one clearly marked DO NOT TOUCH button.",
    "The Drop Chamber paints a bright safety line across the floor and somebody still ignores it.",
    "Claim Hall announces WATCH YOUR STEP with prophetic timing.",
    "The DWallet Vault opens one completely harmless door and somehow causes panic anyway.",
    "Bot Basement emits one tiny notification ping with devastating consequences.",
    "The Server Room floor lights guide everyone toward safety except the person who needs them.",
    "The Sticker Lab deploys a giant laughing reaction before the mistake is even complete.",
    "The Community Floor collectively sees the disaster coming and fails to stop it.",
    "Wallet Ops displays a helpful arrow that somehow gets interpreted backward.",
    "The Rooftop Relay gets a crystal-clear broadcast of an avoidable tragedy.",
    "The Purple Corridor has exactly one obstacle and apparently that is enough.",
    "The QR Room flashes a warning square large enough to be seen from space.",
    "The Transaction Bay marks the safe zone in bright purple. This information goes unused.",
    "The Degen Lounge starts chanting NO NO NO about half a second too late.",
    "The Mod War Room pauses all conversation to watch somebody become their own worst enemy.",
    "The Claim Queue parts politely and somehow creates a runway for disaster.",
    "The Tip Tunnel pings at the exact frequency required to ruin somebody's concentration.",
    "The Ledger Hall records the mistake before the victim fully understands it.",
    "The Notification Nest sends a STAY FOCUSED alert with breathtakingly bad timing.",
    "Peach glances at the red button and somebody panics for absolutely no reason.",
    "Crek's control wall displays USER ERROR in letters that feel unnecessarily personal.",
    "The HQ intercom says PLEASE DO NOT RUN, immediately inspiring the opposite behavior.",
    "The main DWallet lobby provides a huge open space and somebody still finds the edge."
  ],

  pinDuels: [
    "Crek's Lair locks every camera onto the showdown.",
    "Peach's Lair dims the lights like somebody scheduled this drama.",
    "Peach puts one hand on the red button and waits for the count.",
    "Drop Control throws the pin onto every screen in HQ.",
    "Claim Hall abandons the claim feed and starts counting instead.",
    "The DWallet Vault doors pulse once for every count.",
    "Bot Basement briefly stops scrolling logs because even the bots are watching.",
    "The Server Room status wall replaces uptime with ONE TWO THREE.",
    "The Sticker Lab queues twenty victory reactions and refuses to say for whom.",
    "The Community Floor turns into one giant synchronized countdown.",
    "Wallet Ops puts both usernames on the command wall in enormous letters.",
    "The Rooftop Relay broadcasts the duel to every screen in the building.",
    "The Purple Corridor empties as everybody crowds around the nearest display.",
    "The Transaction Bay freezes every decorative ticker on the two fighters.",
    "The Degen Lounge begins arguing about the outcome before the first count lands.",
    "The Mod War Room opens an unofficial betting board made entirely of reaction emojis.",
    "The Ledger Hall prepares one line for a survivor and one for somebody about to be crossed out.",
    "The Notification Nest mercifully shuts up for three whole seconds.",
    "Crek says nothing, which somehow makes the room louder.",
    "The central HQ display flashes COMMUNITY SHOWDOWN and refuses to blink."
  ],

  multiPins: [
    "Crek's Lair runs out of camera boxes trying to frame the entire pileup.",
    "Peach's Lair puts the red button behind glass for everybody's safety.",
    "Drop Control gives up on assigning separate nameplates and just labels the screen CHAOS.",
    "Claim Hall loses track of who is on top of whom almost immediately.",
    "The DWallet Vault alarm starts counting along with the crowd.",
    "Bot Basement attempts to parse the pile and returns absolutely nothing useful.",
    "The Server Room status board uses more bandwidth on this mess than on the actual server.",
    "The Sticker Lab starts auto-generating confused reactions in real time.",
    "The Community Floor becomes one enormous argument with a three-count underneath it.",
    "Wallet Ops zooms out twice and still cannot fit the full disaster on one screen.",
    "The Rooftop Relay broadcasts several limbs and zero clear answers.",
    "The Purple Corridor crowd starts pointing in six different directions at once.",
    "The Transaction Bay displays PROCESSING because frankly that is all anyone can do.",
    "The Degen Lounge declares four different winners before the count even starts.",
    "The Mod War Room unanimously votes to let the official figure this nonsense out.",
    "The Ledger Hall opens multiple elimination rows and hopes at least one is correct.",
    "The Notification Nest fires so many alerts they merge into one continuous tone.",
    "Crek's control wall simply displays ??? in giant purple text.",
    "Peach watches the pileup and very slowly removes his hand from the red button.",
    "The main HQ feed labels the scene COMMUNITY SHOWDOWN and then stops pretending it understands."
  ],

  revivalDuels: [
    "Crek's Lair reactivates one crossed-out player slot and leaves two names fighting for it.",
    "Peach's Lair lights the red button green for the first time all night.",
    "Drop Control opens a single return lane back into the Arena.",
    "Claim Hall replaces CLAIM NOW with SECOND CHANCE.",
    "The DWallet Vault unlocks one active-player slot and no more.",
    "Bot Basement resurrects one status icon and waits to see who earns it.",
    "The Server Room restores one connection from the eliminated list.",
    "The Sticker Lab prepares both a welcome-back sticker and a stay-dead sticker.",
    "The Community Floor starts screaming for two people who were already supposed to be gone.",
    "Wallet Ops drags two eliminated names back onto the command wall.",
    "The Rooftop Relay announces RETURN WINDOW OPEN across the building.",
    "The Purple Corridor floor lights create one path back toward active play.",
    "The Transaction Bay changes one status from FINAL to MAYBE.",
    "The Degen Lounge treats the revival pit like the main event it clearly believes it is.",
    "The Mod War Room reopens a file everyone thought was closed.",
    "The Ledger Hall uncrosses exactly one blank line and waits for a name.",
    "The Notification Nest sends two identical SECOND CHANCE alerts to two very different fates.",
    "Crek's control wall flashes RETURN for two names and has room for only one.",
    "Peach leans over the red button like he personally controls resurrection now.",
    "The central HQ display moves two names from ELIMINATED to PENDING."
  ],

  normalEvents: [
    "Crek's Lair is somehow calm for once.",
    "Peach's Lair survives an entire ten seconds without the red button becoming relevant.",
    "Drop Control continues pretending this is a professional operation.",
    "Claim Hall keeps the queue moving despite the Arena happening ten feet away.",
    "The DWallet Vault hums ominously for no actual reason.",
    "Bot Basement completes a routine cycle and nobody trusts how routine it feels.",
    "The Server Room lights blink in a pattern everyone decides not to investigate.",
    "The Sticker Lab produces a reaction that is somehow appropriate before the event occurs.",
    "The Community Floor spends the round arguing over something from three rounds ago.",
    "Wallet Ops updates the board with the confidence of people making this up as they go.",
    "The Rooftop Relay keeps perfect signal through completely imperfect behavior.",
    "The Purple Corridor traffic briefly reaches something resembling order.",
    "The QR Room projects a perfectly valid code nobody has time to scan.",
    "The Transaction Bay displays ALL SYSTEMS NORMAL, which feels like tempting fate.",
    "The Degen Lounge continues providing commentary nobody officially requested.",
    "The Mod War Room takes notes that will absolutely become memes later.",
    "The Ledger Hall quietly records another round of nonsense for posterity.",
    "The Notification Nest pings just often enough to remain irritating.",
    "Crek checks one monitor, sighs, and decides it can become tomorrow's problem.",
    "Peach's red button sits untouched, glowing with wasted potential."
  ],

  rareEvents: [
    "Crek's Lair receives a signal from a monitor that is not plugged into anything.",
    "Peach's red button lights up before Peach gets anywhere near it.",
    "Peach's Lair displays PEACH HAS ENTERED THE CHAT even though Peach is already standing there.",
    "Drop Control announces a drop with no sender, no amount, and no timestamp.",
    "Claim Hall opens a claim window for something that does not appear to exist.",
    "The DWallet Vault inventory screen briefly lists one item called DO NOT ASK.",
    "Bot Basement logs a successful command that nobody sent.",
    "The Server Room clock jumps ahead seven seconds and then acts innocent.",
    "The Sticker Lab generates a sticker of the current moment before the current moment finishes.",
    "The Community Floor gets one message from a username nobody can click.",
    "Wallet Ops watches an extra player dot appear on the HQ map and vanish when selected.",
    "The Rooftop Relay catches a transmission labeled FROM LATER.",
    "The Purple Corridor lights switch off one fixture at a time toward the Arena.",
    "The QR Room displays a code that leads back to the QR Room display.",
    "The Transaction Bay marks an event CONFIRMED several seconds before it happens.",
    "The Degen Lounge jukebox turns itself down so everyone can hear absolutely nothing.",
    "The Mod War Room receives a system notice signed by the Mod War Room.",
    "The Ledger Hall adds one blank entry between two real names and refuses to delete it.",
    "The Notification Nest sends the same alert to every phone except the one being held by Crek.",
    "The main HQ sign briefly reads DWALLET HEADQUARTERS // OCCUPANCY: +1."
  ]
};

const POOL_NAMES = [
  "playerKills",
  "selfKills",
  "pinDuels",
  "multiPins",
  "revivalDuels",
  "normalEvents",
  "rareEvents"
];

function makeHqVariants(poolName, sourcePool) {
  const contexts = HQ_CONTEXTS[poolName];
  if (!Array.isArray(contexts) || contexts.length === 0) {
    throw new Error(`Missing DWallet HQ contexts for ${poolName}`);
  }
  return sourcePool.map((line, index) => `${contexts[index % contexts.length]} ${line}`);
}

const HQ_POOLS = Object.fromEntries(
  POOL_NAMES.map(poolName => [poolName, makeHqVariants(poolName, DWALLET_CORE_THEME[poolName])])
);

export const DWALLET_THEME = {
  ...DWALLET_CORE_THEME,
  tone: "community-crypto-chaos-hq",
  playerKills: [...DWALLET_CORE_THEME.playerKills, ...HQ_POOLS.playerKills],
  selfKills: [...DWALLET_CORE_THEME.selfKills, ...HQ_POOLS.selfKills],
  pinDuels: [...DWALLET_CORE_THEME.pinDuels, ...HQ_POOLS.pinDuels],
  multiPins: [...DWALLET_CORE_THEME.multiPins, ...HQ_POOLS.multiPins],
  revivalDuels: [...DWALLET_CORE_THEME.revivalDuels, ...HQ_POOLS.revivalDuels],
  normalEvents: [...DWALLET_CORE_THEME.normalEvents, ...HQ_POOLS.normalEvents],
  rareEvents: [...DWALLET_CORE_THEME.rareEvents, ...HQ_POOLS.rareEvents]
};

export const DWALLET_HQ_EXPANSION_COUNT = POOL_NAMES.reduce(
  (total, poolName) => total + HQ_POOLS[poolName].length,
  0
);

export const DWALLET_NARRATION_COUNT = POOL_NAMES.reduce(
  (total, poolName) => total + DWALLET_THEME[poolName].length,
  0
);

if (DWALLET_CORE_COUNT !== 13000) {
  throw new Error(`DWallet core narration count drifted: expected 13000, got ${DWALLET_CORE_COUNT}`);
}

if (DWALLET_HQ_EXPANSION_COUNT !== 13000) {
  throw new Error(`DWallet HQ expansion count drifted: expected 13000, got ${DWALLET_HQ_EXPANSION_COUNT}`);
}

if (DWALLET_NARRATION_COUNT !== 26000) {
  throw new Error(`DWallet narration count drifted: expected 26000, got ${DWALLET_NARRATION_COUNT}`);
}
