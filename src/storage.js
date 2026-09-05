let schemaReady = false;

export async function ensureSchema(db) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  if (schemaReady) return;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      theme_id TEXT NOT NULL DEFAULT 'vibe_queen_slots',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      host_id TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      status TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_games_guild_status ON games(guild_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_games_channel_status ON games(channel_id, status)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      winner_id TEXT,
      rounds INTEGER NOT NULL,
      player_count INTEGER NOT NULL,
      finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_results_guild ON game_results(guild_id, finished_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS arena_stat_games (
      game_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS arena_player_stats (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      total_kills INTEGER NOT NULL DEFAULT 0,
      total_revivals INTEGER NOT NULL DEFAULT 0,
      max_kills_single_game INTEGER NOT NULL DEFAULT 0,
      crowd_survivals INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_arena_stats_guild ON arena_player_stats(guild_id)")
  ]);

  schemaReady = true;
}

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

export async function loadFinishedGameForGuild(db, guildId, offset = 0) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const row = await db.prepare(`
    SELECT state_json FROM games
    WHERE guild_id = ? AND status = 'finished'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1 OFFSET ?
  `).bind(guildId, safeOffset).first();
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
  if (!db || game.status !== "finished") return false;
  const ledger = await db.prepare(`
    INSERT OR IGNORE INTO arena_stat_games (game_id, guild_id)
    VALUES (?, ?)
  `).bind(game.id, game.guildId).run();
  if (!ledger?.meta?.changes) return false;

  await db.prepare(`
    INSERT INTO game_results (game_id, guild_id, winner_id, rounds, player_count)
    VALUES (?, ?, ?, ?, ?)
  `).bind(game.id, game.guildId, game.winnerId, game.round, Object.keys(game.players).length).run();

  const realPlayers = Object.values(game.players).filter(p => !p.simulated && p.id);
  if (realPlayers.length) {
    await db.batch(realPlayers.map(p => db.prepare(`
      INSERT INTO arena_player_stats (
        guild_id, user_id, display_name, games_played, wins, total_kills,
        total_revivals, max_kills_single_game, crowd_survivals, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        games_played = arena_player_stats.games_played + 1,
        wins = arena_player_stats.wins + excluded.wins,
        total_kills = arena_player_stats.total_kills + excluded.total_kills,
        total_revivals = arena_player_stats.total_revivals + excluded.total_revivals,
        max_kills_single_game = MAX(arena_player_stats.max_kills_single_game, excluded.max_kills_single_game),
        crowd_survivals = arena_player_stats.crowd_survivals + excluded.crowd_survivals,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      game.guildId,
      p.id,
      p.displayName || p.username || "Unknown",
      p.id === game.winnerId ? 1 : 0,
      p.eliminations || 0,
      p.revivals || 0,
      p.eliminations || 0,
      p.crowdPinsSurvived || 0
    )));
  }
  return true;
}

export async function loadPlayerStats(db, guildId, userId) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  return db.prepare(`
    SELECT guild_id, user_id, display_name, games_played, wins, total_kills,
           total_revivals, max_kills_single_game, crowd_survivals
    FROM arena_player_stats WHERE guild_id = ? AND user_id = ?
  `).bind(guildId, userId).first();
}

export async function loadArenaLeaderboard(db, guildId, limit = 5) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  const metrics = [
    ["games_played", "gamesPlayed"],
    ["wins", "wins"],
    ["total_kills", "kills"],
    ["total_revivals", "revivals"],
    ["max_kills_single_game", "singleGameKills"],
    ["crowd_survivals", "crowdSurvivals"]
  ];
  const out = {};
  for (const [column, key] of metrics) {
    const result = await db.prepare(`
      SELECT user_id, display_name, ${column} AS value
      FROM arena_player_stats
      WHERE guild_id = ? AND ${column} > 0
      ORDER BY ${column} DESC, games_played ASC, display_name COLLATE NOCASE ASC
      LIMIT ?
    `).bind(guildId, limit).all();
    out[key] = result?.results || [];
  }
  return out;
}
