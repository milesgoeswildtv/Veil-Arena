import app, { ArenaCoordinator } from "./activity-live-entry.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";

export { ArenaCoordinator };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
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
    if (!["registration", "running"].includes(game.status)) throw new Error(`Arena cannot be reset from status: ${game.status}.`);

    game.status = "cancelled";
    game.cancelledAt = new Date().toISOString();
    game.cancelReason = game.status === "running" ? "discord_activity_host_abort" : "discord_activity_host_cancel";
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
