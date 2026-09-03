import { VQS_HORROR } from "./vibe_queen_slots/horror.js";
import { VQS_HORROR_SEGMENT_2 } from "./vibe_queen_slots/horror-segment-2.js";
import { VQS_HORROR_SEGMENT_3_VIBE_LAIR } from "./vibe_queen_slots/horror-segment-3-vibe-lair.js";
import { VQS_HORROR_SEGMENT_4 } from "./vibe_queen_slots/horror-segment-4.js";
import { VQS_HORROR_SEGMENT_5 } from "./vibe_queen_slots/horror-segment-5.js";
import { VQS_HORROR_COMBINATORIAL } from "./vibe_queen_slots/horror-combinatorial.js";
import { VQS_HORROR_EXPANSION } from "./vibe_queen_slots/horror-expansion.js";
import { VQS_NORMAL_RARE } from "./vibe_queen_slots/horror-normal-rare.js";
import { FULL_TILT_GAMBA } from "./full_tilt/gamba.js";
import { FULL_TILT_EXPANSION } from "./full_tilt/gamba-expansion.js";
import { FULL_TILT_MEGA } from "./full_tilt/gamba-mega.js";
import { PLAYER_KILLS, SELF_KILLS, PIN_DUELS, MULTI_PIN, REVIVAL_DUELS } from "../content/base/deaths.js";
import { PLAYER_KILLS_SEGMENT_2, SELF_KILLS_SEGMENT_2, PIN_DUELS_SEGMENT_2, MULTI_PIN_SEGMENT_2, REVIVAL_DUELS_SEGMENT_2 } from "../content/base/deaths-segment-2.js";
import { PLAYER_KILLS_SEGMENT_3, SELF_KILLS_SEGMENT_3, PIN_DUELS_SEGMENT_3, MULTI_PIN_SEGMENT_3, REVIVAL_DUELS_SEGMENT_3 } from "../content/base/deaths-segment-3.js";
import { PLAYER_KILLS_SEGMENT_4, SELF_KILLS_SEGMENT_4, PIN_DUELS_SEGMENT_4, MULTI_PIN_SEGMENT_4, REVIVAL_DUELS_SEGMENT_4 } from "../content/base/deaths-segment-4.js";
import { PLAYER_KILLS_SEGMENT_5, SELF_KILLS_SEGMENT_5, PIN_DUELS_SEGMENT_5, MULTI_PIN_SEGMENT_5, REVIVAL_DUELS_SEGMENT_5 } from "../content/base/deaths-segment-5.js";

export const DEFAULT_THEME_ID = "vibe_queen_slots";

const BASE_THEME = {
  id: "base",
  displayName: "Arena",
  tone: "chaotic",
  labels: { arena: "THE ARENA", revival: "REVIVAL PIT", crowdVote: "THE CROWD CHOOSES", crowdPin: "CROWD PIN" },
  playerKills: [...PLAYER_KILLS, ...PLAYER_KILLS_SEGMENT_2, ...PLAYER_KILLS_SEGMENT_3, ...PLAYER_KILLS_SEGMENT_4, ...PLAYER_KILLS_SEGMENT_5],
  selfKills: [...SELF_KILLS, ...SELF_KILLS_SEGMENT_2, ...SELF_KILLS_SEGMENT_3, ...SELF_KILLS_SEGMENT_4, ...SELF_KILLS_SEGMENT_5],
  pinDuels: [...PIN_DUELS, ...PIN_DUELS_SEGMENT_2, ...PIN_DUELS_SEGMENT_3, ...PIN_DUELS_SEGMENT_4, ...PIN_DUELS_SEGMENT_5],
  multiPins: [...MULTI_PIN, ...MULTI_PIN_SEGMENT_2, ...MULTI_PIN_SEGMENT_3, ...MULTI_PIN_SEGMENT_4, ...MULTI_PIN_SEGMENT_5],
  revivalDuels: [...REVIVAL_DUELS, ...REVIVAL_DUELS_SEGMENT_2, ...REVIVAL_DUELS_SEGMENT_3, ...REVIVAL_DUELS_SEGMENT_4, ...REVIVAL_DUELS_SEGMENT_5]
};

const VQS_THEME = {
  ...VQS_HORROR,
  playerKills: [...VQS_HORROR_EXPANSION.playerKills, ...VQS_HORROR_COMBINATORIAL.playerKills, ...VQS_HORROR.playerKills, ...VQS_HORROR_SEGMENT_2.playerKills, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.playerKills, ...VQS_HORROR_SEGMENT_4.playerKills, ...VQS_HORROR_SEGMENT_5.playerKills],
  selfKills: [...VQS_HORROR_COMBINATORIAL.selfKills, ...VQS_HORROR.selfKills, ...VQS_HORROR_SEGMENT_2.selfKills, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.selfKills, ...VQS_HORROR_SEGMENT_4.selfKills, ...VQS_HORROR_SEGMENT_5.selfKills],
  pinDuels: [...VQS_HORROR_COMBINATORIAL.pinDuels, ...VQS_HORROR.pinDuels, ...VQS_HORROR_SEGMENT_2.pinDuels, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.pinDuels, ...VQS_HORROR_SEGMENT_4.pinDuels, ...VQS_HORROR_SEGMENT_5.pinDuels],
  multiPins: [...VQS_HORROR_COMBINATORIAL.multiPins, ...VQS_HORROR.multiPins, ...VQS_HORROR_SEGMENT_2.multiPins, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.multiPins, ...VQS_HORROR_SEGMENT_4.multiPins, ...VQS_HORROR_SEGMENT_5.multiPins],
  revivalDuels: [...VQS_HORROR_COMBINATORIAL.revivalDuels, ...VQS_HORROR.revivalDuels, ...VQS_HORROR_SEGMENT_2.revivalDuels, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.revivalDuels, ...VQS_HORROR_SEGMENT_4.revivalDuels, ...VQS_HORROR_SEGMENT_5.revivalDuels],
  normalEvents: VQS_NORMAL_RARE.normalEvents,
  rareEvents: VQS_NORMAL_RARE.rareEvents
};

const FULL_TILT_THEME = {
  ...FULL_TILT_GAMBA,
  playerKills: [...FULL_TILT_EXPANSION.playerKills, ...FULL_TILT_GAMBA.playerKills],
  selfKills: [...FULL_TILT_MEGA.selfKills, ...FULL_TILT_GAMBA.selfKills],
  pinDuels: [...FULL_TILT_MEGA.pinDuels, ...FULL_TILT_GAMBA.pinDuels],
  multiPins: [...FULL_TILT_MEGA.multiPins, ...FULL_TILT_GAMBA.multiPins],
  revivalDuels: [...FULL_TILT_MEGA.revivalDuels, ...FULL_TILT_GAMBA.revivalDuels],
  normalEvents: FULL_TILT_MEGA.normalEvents,
  rareEvents: FULL_TILT_MEGA.rareEvents
};

const THEMES = new Map([[BASE_THEME.id, BASE_THEME], [VQS_THEME.id, VQS_THEME], [FULL_TILT_THEME.id, FULL_TILT_THEME]]);
export function getTheme(themeId = DEFAULT_THEME_ID) { return THEMES.get(themeId) || THEMES.get(DEFAULT_THEME_ID) || BASE_THEME; }
export function listThemes() { return [...THEMES.values()].map(({ id, displayName, tone }) => ({ id, displayName, tone })); }
export function renderTemplate(template, values = {}) { return String(template || "").replaceAll("{killer}", values.killer || "Someone").replaceAll("{victim}", values.victim || "someone").replaceAll("{winner}", values.winner || "Someone").replaceAll("{loser}", values.loser || "someone").replaceAll("{third}", values.third || "someone else"); }
export function chooseNarration(theme, poolName, values, rng = Math.random, recent = []) { const pool = theme?.[poolName] || BASE_THEME[poolName] || []; if (!pool.length) return { template: null, text: "The Arena makes its choice." }; const blocked = new Set(recent.slice(-150)); const candidates = pool.filter(line => !blocked.has(line)); const source = candidates.length ? candidates : pool; const template = source[Math.floor(rng() * source.length)]; return { template, text: renderTemplate(template, values) }; }
export function themeNarrationCount(theme) { return ["playerKills","selfKills","pinDuels","multiPins","revivalDuels","normalEvents","rareEvents"].reduce((n,key)=>n+(theme?.[key]?.length||0),0); }
