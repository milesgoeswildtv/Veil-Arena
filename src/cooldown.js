export const DEFAULT_ARENA_COOLDOWN_MS = 30 * 60 * 1000;
export const TELEGRAM_ARENA_COOLDOWN_MS = DEFAULT_ARENA_COOLDOWN_MS;

async function ensureCooldownSchema(db) {
  if (!db) throw new Error("D1 binding DB is not configured.");
  await db.prepare(`CREATE TABLE IF NOT EXISTS arena_cooldowns (
    scope_key TEXT PRIMARY KEY,
    available_at INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function getArenaCooldownRemaining(db, scopeKey, now = Date.now()) {
  await ensureCooldownSchema(db);
  const row = await db.prepare("SELECT available_at FROM arena_cooldowns WHERE scope_key = ?")
    .bind(String(scopeKey))
    .first();
  if (!row?.available_at) return 0;
  return Math.max(0, Number(row.available_at) - now);
}

export async function startArenaCooldown(db, scopeKey, durationMs = DEFAULT_ARENA_COOLDOWN_MS, now = Date.now()) {
  await ensureCooldownSchema(db);
  const availableAt = now + Math.max(0, Number(durationMs) || 0);
  await db.prepare(`
    INSERT INTO arena_cooldowns (scope_key, available_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(scope_key) DO UPDATE SET
      available_at = excluded.available_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(String(scopeKey), availableAt).run();
  return availableAt;
}

export function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
