export const FULL_TILT_GUILD_ID = "1419791730777260153";

export function themeForGuild(guildId, fallbackThemeId = "vibe_queen_slots") {
  if (guildId === FULL_TILT_GUILD_ID) return "full_tilt";
  return fallbackThemeId;
}
