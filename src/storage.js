export async function saveGame(db, game) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO games (id, guild_id, channel_id, host_id, theme_id, status, round, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      round = excluded.round,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).bind(
    game.id, game.guildId, game.channelId, game.hostId, game.themeId,
    game.status, game.round, JSON.stringify(game), game.createdAt || now, now
  ).run();
  return game;
}

export async function loadGame(db, gameId) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const row = await db.prepare("SELECT state_json FROM games WHERE id = ?").bind(gameId).first();
  return row ? JSON.parse(row.state_json) : null;
}

export async function loadActiveGameForChannel(db, channelId) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const row = await db.prepare(`
    SELECT state_json FROM games
    WHERE channel_id = ? AND status IN ('registration', 'running')
    ORDER BY created_at DESC LIMIT 1
  `).bind(channelId).first();
  return row ? JSON.parse(row.state_json) : null;
}

export async function getGuildConfig(db, guildId) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const row = await db.prepare("SELECT guild_id, theme_id FROM guild_config WHERE guild_id = ?").bind(guildId).first();
  return row || { guild_id: guildId, theme_id: "vibe_queen_slots" };
}

export async function setGuildTheme(db, guildId, themeId) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  await db.prepare(`
    INSERT INTO guild_config (guild_id, theme_id, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET theme_id = excluded.theme_id, updated_at = CURRENT_TIMESTAMP
  `).bind(guildId, themeId).run();
}

export async function recordFinishedGame(db, game) {
  if (!db || game.status !== "finished") return;
  await db.prepare(`
    INSERT INTO game_results (game_id, guild_id, winner_id, rounds, player_count)
    VALUES (?, ?, ?, ?, ?)
  `).bind(game.id, game.guildId, game.winnerId, game.round, Object.keys(game.players).length).run();
}
