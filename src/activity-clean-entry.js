import app, { ArenaCoordinator } from "./activity-bootstrap-fix-entry.js";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "./generated/discord-sdk-source.js";
import { activityCleanClientSource } from "./activity-clean-client.js";
import { cleanActivityHtml } from "./activity-clean-ui.js";

export { ArenaCoordinator };

const BUILD = "20260913-17";
const CLIENT_PATH = `/activity/veil-clean-${BUILD}.js`;
const DISCORD_API = "https://discord.com/api/v10";
let cachedApplication = null;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", BUILD);
  headers.set("x-veil-activity-stack", "clean-proxy-identity");
  return headers;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: noStore(new Headers({ "content-type": "application/json; charset=utf-8" }))
  });
}

async function resolveApplication(env) {
  const envId = String(env.DISCORD_APPLICATION_ID || "");
  const now = Date.now();
  if (cachedApplication?.expiresAt > now) return { ...cachedApplication, envId };

  if (!env.DISCORD_BOT_TOKEN) {
    const fallback = { id: envId, source: "worker-env", expiresAt: now + 30000 };
    cachedApplication = fallback;
    return { ...fallback, envId };
  }

  try {
    const response = await fetch(`${DISCORD_API}/applications/@me`, {
      headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
    });
    const data = await response.json().catch(() => null);
    const id = String(data?.id || "");
    if (!response.ok || !/^\d{15,22}$/.test(id)) throw new Error("Discord application lookup failed.");
    const resolved = { id, source: "discord-bot-token", expiresAt: now + 5 * 60 * 1000 };
    cachedApplication = resolved;
    return { ...resolved, envId };
  } catch {
    const fallback = { id: envId, source: "worker-env", expiresAt: now + 30000 };
    cachedApplication = fallback;
    return { ...fallback, envId };
  }
}

function envWithApplicationId(env, applicationId) {
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "DISCORD_APPLICATION_ID") return applicationId;
      return Reflect.get(target, property, receiver);
    }
  });
}

async function forward(request, env, ctx, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  const forwarded = new Request(url.toString(), request);
  return app.fetch(forwarded, env, ctx);
}

function launchIdentityBootstrap(workerApplicationId) {
  return `(() => {
    const body = document.body;
    const workerId = ${JSON.stringify(String(workerApplicationId || ""))};
    const host = window.location.hostname;
    const match = host.match(/^(\\d+)\\.discordsays\\.com$/i);
    const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    body.dataset.workerDiscordClientId = workerId;
    body.dataset.activityHost = host;

    if (!match) {
      globalThis.__VEIL_PROXY_BLOCKED__ = true;
      put("status", "CONFIGURATION ERROR");
      put("step", "DISCORD ACTIVITY PROXY MISSING");
      put("detail", "Veil loaded from " + host + " instead of <application-id>.discordsays.com. Disable Application URL Override and keep the Activity URL Mapping on /.");
      put("notice", "Discord READY cannot work until Veil is launched through the Activity proxy.");
      return;
    }

    const launchId = match[1];
    body.dataset.discordClientId = launchId;
    body.dataset.launchDiscordClientId = launchId;
    body.dataset.appIdMismatch = workerId && workerId !== launchId ? "YES" : "NO";

    if (workerId && workerId !== launchId) {
      put("detail", "APP ID MISMATCH — Discord launched " + launchId + " but the Worker/bot credentials belong to " + workerId + ". Veil will use the launch app for READY so the mismatch becomes explicit at OAuth.");
      put("notice", "Your Discord Activity app and Worker credentials are from different applications.");
    }

    if (window.parent === window) {
      globalThis.__VEIL_PROXY_BLOCKED__ = true;
      put("status", "CONFIGURATION ERROR");
      put("step", "DISCORD PARENT RPC MISSING");
      put("detail", "Veil is not inside Discord's Activity iframe. The SDK has no parent RPC server to answer READY.");
      put("notice", "Launch Veil from Discord's Activity surface, not a direct web URL.");
    }
  })();`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const application = await resolveApplication(env);
    const fixedEnv = envWithApplicationId(env, application.id);

    if (request.method === "GET" && ["/", "/activity", "/activity/", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      const html = cleanActivityHtml(application.id, BUILD, CLIENT_PATH);
      return new Response(html, {
        status: 200,
        headers: noStore(new Headers({ "content-type": "text/html; charset=utf-8", "x-veil-app-id-source": application.source }))
      });
    }

    if (request.method === "GET" && url.pathname === CLIENT_PATH) {
      const bootstrap = launchIdentityBootstrap(application.id);
      const client = `if (!globalThis.__VEIL_PROXY_BLOCKED__) {\n${activityCleanClientSource()}\n}`;
      const source = `${OFFICIAL_DISCORD_SDK_SOURCE}\n${bootstrap}\n${client}`;
      return new Response(source, {
        status: 200,
        headers: noStore(new Headers({
          "content-type": "application/javascript; charset=utf-8",
          "x-content-type-options": "nosniff",
          "x-veil-sdk": `official-${OFFICIAL_DISCORD_SDK_VERSION}`
        }))
      });
    }

    if (request.method === "POST" && url.pathname === "/api/token") {
      return forward(request, fixedEnv, ctx, "/activity/oauth/token");
    }

    if (request.method === "GET" && url.pathname === "/activity/clean-health") {
      return json({
        ok: Boolean(application.id),
        build: BUILD,
        sdk: OFFICIAL_DISCORD_SDK_VERSION,
        applicationId: application.id || null,
        applicationIdSource: application.source,
        workerIdMatches: !application.envId || application.envId === application.id,
        hasClientSecret: Boolean(env.DISCORD_CLIENT_SECRET),
        hasBotToken: Boolean(env.DISCORD_BOT_TOKEN),
        hasPublicKey: Boolean(env.DISCORD_PUBLIC_KEY),
        clientPath: CLIENT_PATH
      });
    }

    return app.fetch(request, fixedEnv, ctx);
  }
};
