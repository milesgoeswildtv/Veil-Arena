import { VQS_HORROR } from "./vibe_queen_slots/horror.js";
import { PLAYER_KILLS, SELF_KILLS, PIN_DUELS, MULTI_PIN, REVIVAL_DUELS } from "../content/base/deaths.js";

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
  playerKills: PLAYER_KILLS,
  selfKills: SELF_KILLS,
  pinDuels: PIN_DUELS,
  multiPins: MULTI_PIN,
  revivalDuels: REVIVAL_DUELS
};

const THEMES = new Map([
  [BASE_THEME.id, BASE_THEME],
  [VQS_HORROR.id, VQS_HORROR]
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
  if (!pool.length) return "The Arena makes its choice.";

  const blocked = new Set(recent.slice(-20));
  const candidates = pool.filter(line => !blocked.has(line));
  const source = candidates.length ? candidates : pool;
  const template = source[Math.floor(rng() * source.length)];
  return { template, text: renderTemplate(template, values) };
}
