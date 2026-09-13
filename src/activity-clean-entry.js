import app, { ArenaCoordinator } from "./activity-bootstrap-fix-entry.js";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "./generated/discord-sdk-source.js";
import { activityCleanClientSource } from "./activity-clean-client.js";
import { cleanActivityHtml } from "./activity-clean-ui.js";

export { ArenaCoordinator };

const BUILD = "20260913-19";
const CLIENT_PATH = `/activity/veil-clean-${BUILD}.js`;
const DISCORD_API = "https://discord.com/api/v10";
let cachedApplication = null;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", BUILD);
  headers.set("x-veil-activity-stack", "clean-direct-official-sdk");
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

function activityDiagnosticsBootstrap(workerApplicationId, applicationSource) {
  return `(() => {
    const body = document.body;
    const params = new URLSearchParams(window.location.search);
    const workerId = ${JSON.stringify(String(workerApplicationId || ""))};
    const host = window.location.hostname;
    const hostMatch = host.match(/^(\\d+)\\.discordsays\\.com$/i);
    const launchId = hostMatch ? hostMatch[1] : "";
    const info = globalThis.__VEIL_ACTIVITY_DIAG__ = {
      build: ${JSON.stringify(BUILD)}, workerId,
      applicationSource: ${JSON.stringify(String(applicationSource || "unknown"))},
      host, launchId,
      guildId: params.get("guild_id") || "", channelId: params.get("channel_id") || "",
      frameId: params.get("frame_id") || "", instanceId: params.get("instance_id") || "",
      platform: params.get("platform") || "", mobileVersion: params.get("mobile_app_version") || "",
      referrer: document.referrer || "", parentIsSelf: window.parent === window,
      parentHasOpener: false, rawMessages: 0, parentMessages: 0,
      lastMessageOrigin: "", lastOpcode: "", clientStarted: false, clientError: ""
    };
    try { info.parentHasOpener = Boolean(window.parent && window.parent.opener); } catch { info.parentHasOpener = "INACCESSIBLE"; }

    const box = document.createElement("div");
    box.id = "veilConnectionFacts";
    box.style.cssText = "border:1px solid #6f4f97;background:#0a0710;border-radius:14px;padding:10px 12px;margin:0 0 12px;color:#d9cbea;font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-all";
    const connect = document.querySelector(".connect");
    if (connect?.parentNode) connect.parentNode.insertBefore(box, connect.nextSibling); else document.body.prepend(box);

    function render() {
      const mismatch = info.launchId && info.workerId && info.launchId !== info.workerId;
      box.textContent = [
        "VEIL CONNECTION FACTS // " + info.build,
        "host: " + (info.host || "MISSING"),
        "launch app id: " + (info.launchId || "MISSING"),
        "worker/bot app id: " + (info.workerId || "MISSING"),
        "app id source: " + info.applicationSource,
        "app id match: " + (info.launchId ? (mismatch ? "NO" : "YES") : "NO PROXY HOST"),
        "guild_id: " + (info.guildId || "MISSING"),
        "channel_id: " + (info.channelId || "MISSING"),
        "frame_id: " + (info.frameId || "MISSING"),
        "instance_id: " + (info.instanceId || "MISSING"),
        "platform: " + (info.platform || "MISSING") + " // mobile " + (info.mobileVersion || "MISSING"),
        "document.referrer: " + (info.referrer || "MISSING"),
        "parent === self: " + (info.parentIsSelf ? "YES" : "NO"),
        "parent.opener present: " + String(info.parentHasOpener),
        "RPC messages seen: " + info.rawMessages + " // from parent: " + info.parentMessages,
        "last RPC origin/opcode: " + (info.lastMessageOrigin || "NONE") + " / " + (info.lastOpcode || "NONE"),
        "Arena client started: " + (info.clientStarted ? "YES" : "NO"),
        "Arena client error: " + (info.clientError || "NONE")
      ].join("\\n");
    }
    globalThis.__VEIL_RENDER_ACTIVITY_DIAG__ = render;
    globalThis.__VEIL_MARK_CLIENT_STARTED__ = () => { info.clientStarted = true; render(); };
    globalThis.__VEIL_MARK_CLIENT_ERROR__ = error => { info.clientError = error?.message || String(error || "Unknown error"); render(); };
    render();

    window.addEventListener("message", event => {
      info.rawMessages += 1;
      if (event.source === window.parent) info.parentMessages += 1;
      info.lastMessageOrigin = event.origin || "EMPTY";
      info.lastOpcode = Array.isArray(event.data) ? String(event.data[0]) : "NON_ARRAY";
      render();
    });

    if (hostMatch) {
      body.dataset.workerDiscordClientId = workerId;
      body.dataset.launchDiscordClientId = launchId;
      body.dataset.discordClientId = launchId;
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
      const diagnostics = activityDiagnosticsBootstrap(application.id, application.source);
      const arenaSource = activityCleanClientSource();
      const client = `try {\n  globalThis.__VEIL_MARK_CLIENT_STARTED__?.();\n  ${arenaSource}\n} catch (error) {\n  globalThis.__VEIL_MARK_CLIENT_ERROR__?.(error);\n  const step = document.getElementById("step"); if (step) step.textContent = "CLIENT BOOT ERROR";\n  const detail = document.getElementById("detail"); if (detail) detail.textContent = error?.message || String(error);\n}`;
      const source = `${OFFICIAL_DISCORD_SDK_SOURCE}\n${diagnostics}\n${client}`;
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
        ok: Boolean(application.id), build: BUILD, sdk: OFFICIAL_DISCORD_SDK_VERSION,
        applicationId: application.id || null, applicationIdSource: application.source,
        workerIdMatches: !application.envId || application.envId === application.id,
        hasClientSecret: Boolean(env.DISCORD_CLIENT_SECRET), hasBotToken: Boolean(env.DISCORD_BOT_TOKEN),
        hasPublicKey: Boolean(env.DISCORD_PUBLIC_KEY), clientPath: CLIENT_PATH
      });
    }

    return app.fetch(request, fixedEnv, ctx);
  }
};
