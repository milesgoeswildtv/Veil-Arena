import { VQS_HORROR } from "./vibe_queen_slots/horror.js";
import { VQS_HORROR_SEGMENT_2 } from "./vibe_queen_slots/horror-segment-2.js";
import { VQS_HORROR_SEGMENT_3_VIBE_LAIR } from "./vibe_queen_slots/horror-segment-3-vibe-lair.js";
import { PLAYER_KILLS, SELF_KILLS, PIN_DUELS, MULTI_PIN, REVIVAL_DUELS } from "../content/base/deaths.js";
import {
  PLAYER_KILLS_SEGMENT_2,
  SELF_KILLS_SEGMENT_2,
  PIN_DUELS_SEGMENT_2,
  MULTI_PIN_SEGMENT_2,
  REVIVAL_DUELS_SEGMENT_2
} from "../content/base/deaths-segment-2.js";
import {
  PLAYER_KILLS_SEGMENT_3,
  SELF_KILLS_SEGMENT_3,
  PIN_DUELS_SEGMENT_3,
  MULTI_PIN_SEGMENT_3,
  REVIVAL_DUELS_SEGMENT_3
} from "../content/base/deaths-segment-3.js";

export const DEFAULT_THEME_ID = "vibe_queen_slots";

const BASE_THEME = {
  id: "base",
  displayName: "Arena",
  tone: "chaotic",
  labels: {
    arena: "THE ARENA",
    revival: "REVIVAL PIT",
    crowdVote: "THE CROWD CHOOSES",
    crowdPin: "CROWD PIN"
  },
  playerKills: [...PLAYER_KILLS, ...PLAYER_KILLS_SEGMENT_2, ...PLAYER_KILLS_SEGMENT_3],
  selfKills: [...SELF_KILLS, ...SELF_KILLS_SEGMENT_2, ...SELF_KILLS_SEGMENT_3],
  pinDuels: [...PIN_DUELS, ...PIN_DUELS_SEGMENT_2, ...PIN_DUELS_SEGMENT_3],
  multiPins: [...MULTI_PIN, ...MULTI_PIN_SEGMENT_2, ...MULTI_PIN_SEGMENT_3],
  revivalDuels: [...REVIVAL_DUELS, ...REVIVAL_DUELS_SEGMENT_2, ...REVIVAL_DUELS_SEGMENT_3]
};

const VQS_THEME = {
  ...VQS_HORROR,
  playerKills: [...VQS_HORROR.playerKills, ...VQS_HORROR_SEGMENT_2.playerKills, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.playerKills],
  selfKills: [...VQS_HORROR.selfKills, ...VQS_HORROR_SEGMENT_2.selfKills, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.selfKills],
  pinDuels: [...VQS_HORROR.pinDuels, ...VQS_HORROR_SEGMENT_2.pinDuels, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.pinDuels],
  multiPins: [...VQS_HORROR.multiPins, ...VQS_HORROR_SEGMENT_2.multiPins, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.multiPins],
  revivalDuels: [...VQS_HORROR.revivalDuels, ...VQS_HORROR_SEGMENT_2.revivalDuels, ...VQS_HORROR_SEGMENT_3_VIBE_LAIR.revivalDuels]
};

const THEMES = new Map([
  [BASE_THEME.id, BASE_THEME],
  [VQS_THEME.id, VQS_THEME]
]);

export function getTheme(themeId = DEFAULT_THEME_ID) {
  return THEMES.get(themeId) || THEMES.get(DEFAULT_THEME_ID) || BASE_THEME;
}

export function listThemes() {
  return [...THEMES.values()].map(({ id, displayName, tone }) => ({ id, displayName, tone }));
}

export function renderTemplate(template, values = {}) {
  return String(template || "")
    .replaceAll("{killer}", values.killer || "Someone")
    .replaceAll("{victim}", values.victim || "someone")
    .replaceAll("{winner}", values.winner || "Someone")
    .replaceAll("{loser}", values.loser || "someone")
    .replaceAll("{third}", values.third || "someone else");
}

export function chooseNarration(theme, poolName, values, rng = Math.random, recent = []) {
  const pool = theme?.[poolName] || BASE_THEME[poolName] || [];
  if (!pool.length) return { template: null, text: "The Arena makes its choice." };

  const blocked = new Set(recent.slice(-20));
  const candidates = pool.filter(line => !blocked.has(line));
  const source = candidates.length ? candidates : pool;
  const template = source[Math.floor(rng() * source.length)];
  return { template, text: renderTemplate(template, values) };
}
