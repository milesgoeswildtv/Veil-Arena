import app, { ArenaCoordinator } from "./activity-doctor-entry.js";
import { OFFICIAL_ACTIVITY_CLIENT_SOURCE } from "./generated/activity-official-client-source.js";
import { officialActivityHtml } from "./activity-official-ui.js";

export { ArenaCoordinator };

const BUILD = "20260913-official-1";
const CLIENT_PATH = `/activity/veil-official-${BUILD}.js`;
const ACTIVITY_SESSION_MS = 12 * 60 * 60 * 1000;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", BUILD);
  headers.set("x-veil-activity-stack", "discord-official");
  return headers;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: noStore(new Headers({ "content-type": "application/json; charset=utf-8" }))
  });
}

function b64urlFromBytes(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlFromString(value) {
  return b64urlFromBytes(new TextEncoder().encode(value));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signSession(payload, secret) {
  const body = b64urlFromString(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(body)
  );
  return `${body}.${b64urlFromBytes(signature)}`;
}

async function exchangeDiscordCode(code, env) {
  if (!env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID is missing.");
  if (!env.DISCORD_CLIENT_SECRET) throw new Error("DISCORD_CLIENT_SECRET is missing.");

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_APPLICATION_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: String(code || "")
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Discord OAuth token exchange failed (${response.status}).`);
  }
  return data;
}

async function discordBearer(path, accessToken) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Discord user verification failed at ${path} (${response.status}).`);
  return data;
}

async function handleToken(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.code) throw new Error("Discord authorization code is missing.");
    const token = await exchangeDiscordCode(body.code, env);
    return json({ access_token: token.access_token });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }
}

async function handleSession(request, env) {
  try {
    if (!env.DISCORD_CLIENT_SECRET) throw new Error("DISCORD_CLIENT_SECRET is missing.");

    const body = await request.json().catch(() => ({}));
    const accessToken = String(body.access_token || "");
    const guildId = String(body.guildId || "");
    const channelId = String(body.channelId || "");

    if (!accessToken) throw new Error("Discord access token is missing.");
    if (!/^\d{15,22}$/.test(guildId)) throw new Error("Discord Activity did not provide a valid server ID.");
    if (!/^\d{15,22}$/.test(channelId)) throw new Error("Discord Activity did not provide a valid voice-channel ID.");

    const [user, guilds] = await Promise.all([
      discordBearer("/users/@me", accessToken),
      discordBearer("/users/@me/guilds", accessToken)
    ]);

    if (!user?.id) throw new Error("Discord did not return the authenticated user.");
    if (!Array.isArray(guilds) || !guilds.some((guild) => String(guild.id) === guildId)) {
      throw new Error("Your Discord account is not a member of the server that launched this Activity.");
    }

    const displayName = user.global_name || user.username || "Discord User";
    const session = await signSession({
      id: String(user.id),
      username: user.username || null,
      displayName,
      guildId,
      channelId,
      exp: Date.now() + ACTIVITY_SESSION_MS
    }, env.DISCORD_CLIENT_SECRET);

    return json({
      ok: true,
      session,
      user: {
        id: String(user.id),
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && ["/", "/activity", "/activity/", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      const html = officialActivityHtml(env.DISCORD_APPLICATION_ID || "", BUILD, CLIENT_PATH);
      return new Response(html, {
        status: 200,
        headers: noStore(new Headers({ "content-type": "text/html; charset=utf-8" }))
      });
    }

    if (request.method === "GET" && url.pathname === CLIENT_PATH) {
      return new Response(OFFICIAL_ACTIVITY_CLIENT_SOURCE, {
        status: 200,
        headers: noStore(new Headers({
          "content-type": "application/javascript; charset=utf-8",
          "x-content-type-options": "nosniff"
        }))
      });
    }

    if (request.method === "POST" && url.pathname === "/api/token") {
      return handleToken(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/session") {
      return handleSession(request, env);
    }

    if (request.method === "GET" && url.pathname === "/activity/official-health") {
      return json({
        ok: Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_CLIENT_SECRET),
        build: BUILD,
        applicationId: env.DISCORD_APPLICATION_ID || null,
        hasClientSecret: Boolean(env.DISCORD_CLIENT_SECRET),
        clientPath: CLIENT_PATH,
        stack: "discord-official"
      });
    }

    return app.fetch(request, env, ctx);
  }
};
