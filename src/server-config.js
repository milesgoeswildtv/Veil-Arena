export const FULL_TILT_GUILD_ID = "1419791730777260153";
export const VIBE_QUEEN_GUILD_ID = "1320206528720146533";
export const VEIL_ACTIVITY_TEST_GUILD_ID = "1504257112094539798";

export function themeForGuild(guildId, fallbackThemeId = "vibe_queen_slots") {
  if (guildId === FULL_TILT_GUILD_ID) return "full_tilt";
  if (guildId === VEIL_ACTIVITY_TEST_GUILD_ID) return "dwallet";
  if (guildId === VIBE_QUEEN_GUILD_ID) return "vibe_queen_slots";
  return fallbackThemeId;
}
