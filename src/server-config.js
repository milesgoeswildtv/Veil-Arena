export const FULL_TILT_GUILD_ID = "1419791730777260153";
export const VIBE_QUEEN_GUILD_ID = "1320206528720146533";
export const VEIL_ACTIVITY_TEST_GUILD_ID = "1504257112094539798";

export const SELECTABLE_THEME_IDS = ["full_tilt", "dwallet", "base"];

export function themeForGuild(guildId, configuredThemeId = "") {
  const configured = String(configuredThemeId || "");
  if (SELECTABLE_THEME_IDS.includes(configured)) return configured;
  if (guildId === FULL_TILT_GUILD_ID) return "full_tilt";
  if (guildId === VEIL_ACTIVITY_TEST_GUILD_ID) return "dwallet";
  return "base";
}
