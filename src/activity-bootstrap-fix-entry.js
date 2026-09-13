import app, { ArenaCoordinator } from "./activity-doctor-entry.js";

export { ArenaCoordinator };

const ACTIVITY_SESSION_MS = 12 * 60 * 60 * 1000;
const ACTIVITY_BUILD = "20260913-4";
const SDK_STANDALONE_URL = "https://esm.sh/@discord/embedded-app-sdk@2.5.0?standalone&target=es2020";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
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
  if (!env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID is missing on the Worker.");
  if (!env.DISCORD_CLIENT_SECRET) throw new Error("DISCORD_CLIENT_SECRET is missing on the Worker.");

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
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

async function handleActivityOAuth(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const guildId = String(body.guildId || "");
    const channelId = String(body.channelId || "");
    if (!body.code) throw new Error("Discord authorization code is missing.");
    if (!/^\d{15,22}$/.test(guildId)) throw new Error("Discord Activity did not provide a valid server ID.");
    if (!/^\d{15,22}$/.test(channelId)) throw new Error("Discord Activity did not provide a valid voice-channel ID.");

    const token = await exchangeDiscordCode(body.code, env);
    const [user, guilds] = await Promise.all([
      discordBearer("/users/@me", token.access_token),
      discordBearer("/users/@me/guilds", token.access_token)
    ]);

    if (!user?.id) throw new Error("Discord did not return the authenticated user.");
    if (!Array.isArray(guilds) || !guilds.some(guild => String(guild.id) === guildId)) {
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
      access_token: token.access_token,
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

async function standaloneSdk() {
  try {
    const upstream = await fetch(SDK_STANDALONE_URL, {
      headers: { "user-agent": "Veil-Arena-Activity/1.0" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!upstream.ok) {
      return new Response(`Veil could not fetch Discord Embedded App SDK (${upstream.status}).`, {
        status: 502,
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return new Response(await upstream.text(), {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-veil-sdk": `standalone-${ACTIVITY_BUILD}`
      }
    });
  } catch (error) {
    return new Response(`throw new Error(${JSON.stringify(`Discord SDK server fetch failed: ${String(error?.message || error)}`)});`, {
      status: 200,
      headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }
    });
  }
}

async function patchedLiveClient(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  let source = await original.text();

  source = source.replace(
    'const sdkPath = "/activity/sdk.js";',
    `const sdkPath = "/activity/sdk.js?v=${ACTIVITY_BUILD}";`
  );

  source = source.replace(
    'const { DiscordSDK } = await import(sdkPath);',
    `const bootPut = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };\n  bootPut("connection", "CLIENT BOOTING");\n  bootPut("round", "CLIENT BOOTING");\n  bootPut("headline", "LOADING DISCORD SDK…");\n  bootPut("event", "Veil client ${ACTIVITY_BUILD} loaded. Loading Discord Embedded App SDK now.");\n  bootPut("notice", "Client loaded // waiting for Discord SDK");\n  let DiscordSDK;\n  try {\n    ({ DiscordSDK } = await import(sdkPath));\n  } catch (error) {\n    const message = error?.message || String(error || "Unknown SDK load error");\n    bootPut("connection", "SDK LOAD FAILED");\n    bootPut("system", "CLIENT ERROR");\n    bootPut("round", "DISCORD SDK FAILED");\n    bootPut("headline", "VEIL COULD NOT LOAD DISCORD");\n    bootPut("event", message);\n    bootPut("notice", "Discord SDK load failed: " + message);\n    throw error;\n  }`
  );

  source = source.replace(
    'text(ui.connection, connection);\n    text(ui.system, "AUTHENTICATING");',
    'text(ui.connection, connection);\n    text(ui.round, connection);\n    text(ui.system, "AUTHENTICATING");'
  );

  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-veil-bootstrap", `cache-bust-${ACTIVITY_BUILD}`);
  return new Response(source, { status: original.status, headers });
}

async function patchedActivityHtml(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("text/html")) return original;
  let source = await original.text();
  source = source.replace("ARENA OFFLINE", "CONNECTING TO DISCORD");
  source = source.replace('src="/activity/live.js"', `src="/activity/live.js?v=${ACTIVITY_BUILD}"`);
  source = source.replace(
    '<div class="event" id="event"><div class="spinner"></div></div>',
    `<div class="event" id="event">Loading Veil client ${ACTIVITY_BUILD}…<div class="spinner"></div></div>`
  );
  source = source.replace(
    "The Activity is connecting to the Arena engine.",
    `Loading Veil Activity client ${ACTIVITY_BUILD}…`
  );
  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-veil-bootstrap", `cache-bust-${ACTIVITY_BUILD}`);
  return new Response(source, { status: original.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/activity/oauth/token") {
      return handleActivityOAuth(request, env);
    }

    if (request.method === "GET" && url.pathname === "/activity/sdk.js") {
      return standaloneSdk();
    }

    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return patchedLiveClient(request, env, ctx);
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      return patchedActivityHtml(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
