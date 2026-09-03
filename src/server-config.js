export const FULL_TILT_GUILD_ID = "1419791730777260153";
export const VIBE_QUEEN_GUILD_ID = "1320206528720146533";

export function themeForGuild(guildId, fallbackThemeId = "vibe_queen_slots") {
  if (guildId === FULL_TILT_GUILD_ID) return "full_tilt";
  if (guildId === VIBE_QUEEN_GUILD_ID) return "vibe_queen_slots";
  return fallbackThemeId;
}
