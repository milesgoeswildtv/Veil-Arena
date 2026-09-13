import app, { ArenaCoordinator } from "./activity-live-entry.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { FULL_TILT_GUILD_ID } from "./server-config.js";

export { ArenaCoordinator };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function html(body, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Arena Reset</title><style>body{margin:0;background:#0b0811;color:#f5f1ff;font-family:system-ui,-apple-system,sans-serif;padding:24px}.card{max-width:620px;margin:24px auto;background:#171020;border:1px solid #3d2c50;border-radius:20px;padding:20px}h1{margin:0 0 8px}.muted{color:#aaa1b7;line-height:1.45}label{display:block;font-weight:800;margin:16px 0 6px}input{width:100%;box-sizing:border-box;background:#0f0b16;color:#fff;border:1px solid #4a3560;border-radius:10px;padding:12px;font-size:16px}button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:11px;background:#b3264f;color:#fff;font-weight:950;font-size:15px}.ok{color:#70e8ad}.bad{color:#ff8fa9}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0d0a12;border:1px solid #30243d;border-radius:8px;padding:8px;word-break:break-all}</style></head><body><div class="card">${body}</div></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function resetPage(message = "", error = false) {
  const msg = message ? `<p class="${error ? "bad" : "ok"}">${String(message).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</p>` : "";
  return html(`<h1>Veil Arena Hard Reset</h1><p class="muted">Use this when Discord is stuck on an old Arena. This cancels active Discord/Activity matches for the selected server without recording a winner, loss, stats, or payout.</p>${msg}<form method="post" action="/admin/arena/reset"><label>Discord Server / Guild ID</label><input name="guild_id" value="${FULL_TILT_GUILD_ID}" required pattern="[0-9]{15,22}"><label>ADMIN_SECRET</label><input name="admin_secret" type="password" required autocomplete="off"><button type="submit">HARD RESET ACTIVE ARENA</button></form><p class="muted">Full Tilt is prefilled: <span class="code">${FULL_TILT_GUILD_ID}</span></p>`);
}

function b64urlToString(value) {
  const raw = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value || "").length + 3) % 4);
  const binary = atob(raw);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyActivitySession(request, env) {
  const token = request.headers.get("x-arena-session") || "";
  const [body, sigText] = String(token).split(".");
  if (!body || !sigText || !env.DISCORD_CLIENT_SECRET) throw new Error("Activity session is missing or invalid.");

  const sigRaw = sigText.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((sigText.length + 3) % 4);
  const sigBinary = atob(sigRaw);
  const sig = Uint8Array.from(sigBinary, c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(env.DISCORD_CLIENT_SECRET),
    sig,
    new TextEncoder().encode(body)
  );
  if (!ok) throw new Error("Activity session signature failed.");

  const payload = JSON.parse(b64urlToString(body));
  if (!payload.exp || Date.now() > payload.exp) throw new Error("Activity session expired. Reopen the Activity.");
  return payload;
}

function emptyState(session) {
  return {
    gameId: null,
    status: null,
    themeId: null,
    themeName: null,
    round: 0,
    playerCount: 0,
    aliveCount: 0,
    players: [],
    latestDisplay: null,
    crowdVote: null,
    payoutReport: null,
    winnerName: null,
    viewer: {
      id: session.id,
      displayName: session.displayName,
      joined: false,
      alive: false,
      isHost: false,
      canVote: false,
      vote: null
    }
  };
}

async function latestChannelStatus(db, channelId) {
  try {
    return await db.prepare(
      "SELECT status, updated_at FROM games WHERE channel_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1"
    ).bind(channelId).first();
  } catch {
    return null;
  }
}

async function abortActivityArena(request, env) {
  try {
    if (!env.DB) throw new Error("Arena database is missing.");
    const session = await verifyActivitySession(request, env);
    await ensureSchema(env.DB);
    const game = await loadActiveGameForChannel(env.DB, session.channelId);

    if (!game) return json({ ok: true, message: "Arena is already reset.", state: emptyState(session) });
    if (String(game.hostId) !== String(session.id)) throw new Error("Only the Arena host can abort/reset it.");
    if (!(game.activityMode || game.platform === "activity")) throw new Error("That Arena was not launched from this Discord Activity.");
    if (!["registration", "starting", "running"].includes(game.status)) throw new Error(`Arena cannot be reset from status: ${game.status}.`);

    const wasRunning = game.status === "running" || game.status === "starting";
    game.status = "cancelled";
    game.cancelledAt = new Date().toISOString();
    game.cancelReason = wasRunning ? "discord_activity_host_abort" : "discord_activity_host_cancel";
    game.crowdVote = null;
    game.winnerId = null;
    game.payoutReport = null;
    await saveGame(env.DB, game);

    return json({
      ok: true,
      message: "Arena aborted and reset. No winner, loss, stats, or payout was recorded.",
      state: emptyState(session)
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

async function hardResetGuild(request, env) {
  try {
    if (!env.DB) throw new Error("Arena database is missing.");
    if (!env.ADMIN_SECRET) throw new Error("ADMIN_SECRET is missing on this Worker.");
    const type = request.headers.get("content-type") || "";
    let body = {};
    if (type.includes("application/json")) body = await request.json().catch(() => ({}));
    else {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    }
    const supplied = String(body.admin_secret || request.headers.get("x-admin-secret") || "");
    if (supplied !== String(env.ADMIN_SECRET)) throw new Error("ADMIN_SECRET does not match this Worker.");
    const guildId = String(body.guild_id || body.guildId || "");
    if (!/^\d{15,22}$/.test(guildId)) throw new Error("Enter a valid Discord Guild ID.");

    await ensureSchema(env.DB);
    const result = await env.DB.prepare(`
      SELECT id, state_json FROM games
      WHERE guild_id = ? AND status IN ('registration', 'starting', 'running')
      ORDER BY created_at DESC
    `).bind(guildId).all();

    const rows = result?.results || [];
    let reset = 0;
    const channels = [];
    for (const row of rows) {
      let game;
      try { game = JSON.parse(row.state_json); } catch { continue; }
      if (game.platform === "telegram") continue;
      const previousStatus = game.status;
      game.status = "cancelled";
      game.cancelledAt = new Date().toISOString();
      game.cancelReason = "admin_hard_reset";
      game.cancelledFromStatus = previousStatus;
      game.crowdVote = null;
      game.winnerId = null;
      game.payoutReport = null;
      await saveGame(env.DB, game);
      reset++;
      if (game.channelId) channels.push(String(game.channelId));
    }

    const message = reset
      ? `Reset ${reset} active Discord Arena${reset === 1 ? "" : "s"} for guild ${guildId}. You can start fresh now.`
      : `No active Discord Arenas were found for guild ${guildId}.`;

    if (type.includes("application/json")) return json({ ok: true, reset, guildId, channels, message });
    return resetPage(message, false);
  } catch (error) {
    const message = String(error?.message || error);
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) return json({ ok: false, error: message }, 400);
    return resetPage(message, true);
  }
}

async function resetAwareState(request, env) {
  try {
    if (!env.DB) return null;
    const session = await verifyActivitySession(request, env);
    await ensureSchema(env.DB);
    const latest = await latestChannelStatus(env.DB, session.channelId);
    if (latest?.status === "cancelled") {
      return json({ ok: true, state: emptyState(session) });
    }
  } catch {
    return null;
  }
  return null;
}

async function patchedLiveClient(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  let source = await original.text();
  source = source.replace(
    'addAction("CANCEL LOBBY", "cancel", "danger");',
    'addAction("ABORT / RESET ARENA", "abort", "danger");'
  );
  source = source.replace(
    'if (state.status === "running") {',
    'if (state.status === "running") {\n      if (state.viewer.isHost) addAction("ABORT / RESET ARENA", "abort", "danger");'
  );
  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store");
  return new Response(source, { status: original.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/setup/reset") {
      return resetPage();
    }
    if (request.method === "POST" && url.pathname === "/admin/arena/reset") {
      return hardResetGuild(request, env);
    }

    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return patchedLiveClient(request, env, ctx);
    }

    if (request.method === "GET" && url.pathname === "/activity/state") {
      const reset = await resetAwareState(request, env);
      if (reset) return reset;
    }

    if (request.method === "POST" && url.pathname === "/activity/action") {
      const body = await request.clone().json().catch(() => ({}));
      if (body.action === "abort") return abortActivityArena(request, env);
    }

    return app.fetch(request, env, ctx);
  }
};
