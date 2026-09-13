import app, { ArenaCoordinator } from "./activity-single-script-entry.js";
import { liveActivityHtml } from "./activity-live.js";
import { ACTIVITY_LIVE_CLIENT } from "./activity-live-client.js";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "./generated/discord-sdk-source.js";

export { ArenaCoordinator };

const ACTIVITY_BUILD = "20260913-15";
const ACTIVITY_CLIENT_PATH = "/activity/veil-arena-20260913-15.js";
const TEST_GUILD_ID = "1504257112094539798";
const DISCORD_API = "https://discord.com/api/v10";
let cachedApplication = null;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  headers.set("x-veil-sdk", `official-${OFFICIAL_DISCORD_SDK_VERSION}`);
  return headers;
}

function javascript(source) {
  const headers = noStore(new Headers());
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(source, { status: 200, headers });
}

async function resolveDiscordApplication(env) {
  const envId = String(env.DISCORD_APPLICATION_ID || "");
  const now = Date.now();
  if (cachedApplication?.expiresAt > now) return { ...cachedApplication, envId };

  if (!env.DISCORD_BOT_TOKEN) {
    const fallback = { id: envId, source: "worker-env-fallback", expiresAt: now + 30000 };
    cachedApplication = fallback;
    return { ...fallback, envId };
  }

  try {
    const response = await fetch(`${DISCORD_API}/applications/@me`, {
      headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
    });
    const data = await response.json().catch(() => null);
    const botApplicationId = String(data?.id || "");
    if (!response.ok || !/^\d{15,22}$/.test(botApplicationId)) {
      throw new Error(`Discord application lookup failed (${response.status}).`);
    }
    const resolved = {
      id: botApplicationId,
      name: String(data?.name || "Veil"),
      source: "discord-bot-token",
      expiresAt: now + 5 * 60 * 1000
    };
    cachedApplication = resolved;
    return { ...resolved, envId };
  } catch {
    const fallback = { id: envId, source: "worker-env-fallback", expiresAt: now + 30000 };
    cachedApplication = fallback;
    return { ...fallback, envId };
  }
}

function correctedEnv(env, applicationId) {
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "DISCORD_APPLICATION_ID") return applicationId;
      return Reflect.get(target, property, receiver);
    }
  });
}

function directClientSource() {
  const target = '  const sdkPath = "/activity/sdk.js";\n  const { DiscordSDK } = await import(sdkPath);';
  if (!ACTIVITY_LIVE_CLIENT.includes(target)) {
    return `document.body.innerHTML = '<pre style="white-space:pre-wrap;color:#fff;background:#120b18;padding:20px">VEIL CLIENT BUILD ERROR // ${ACTIVITY_BUILD}\\nDirect client patch target was not found.</pre>';`;
  }

  let client = ACTIVITY_LIVE_CLIENT.replace(
    target,
    `  const DiscordSDK = globalThis.__VEIL_OFFICIAL_DISCORD_SDK__;\n  if (!DiscordSDK) throw new Error("Official Discord Embedded App SDK bundle did not initialize.");`
  );

  const setupTarget = '    discordSdk = new DiscordSDK(clientId);\n    await withTimeout(discordSdk.ready(), 12000, "Discord SDK READY");';
  const setupReplacement = `    const expectedProxyHost = \`${'${clientId}'}.discordsays.com\`;\n    const actualHost = window.location.hostname;\n    const ancestorOrigin = (() => { try { return window.location.ancestorOrigins?.[0] || \"\"; } catch { return \"\"; } })();\n    const parentIsSelf = window.parent === window;\n    globalThis.__VEIL_RPC_INFO__ = { expectedProxyHost, actualHost, ancestorOrigin, parentIsSelf, referrer: document.referrer || \"\" };\n    globalThis.__VEIL_RENDER_DIAGNOSTICS__?.();\n    if (actualHost !== expectedProxyHost) {\n      throw new Error(\`Discord Activity proxy mismatch. Veil is running on ${'${actualHost}'} but must run on ${'${expectedProxyHost}'}. In Discord Developer Portal disable Application URL Override and keep the Activity URL Mapping on /.\`);\n    }\n    discordSdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });\n    globalThis.__VEIL_RPC_INFO__.sourceOrigin = discordSdk.sourceOrigin || \"\";\n    globalThis.__VEIL_RPC_INFO__.sourceIsParent = discordSdk.source === window.parent;\n    globalThis.__VEIL_RENDER_DIAGNOSTICS__?.();\n    let readyResolved = false;\n    const readyPromise = discordSdk.ready().then(() => { readyResolved = true; globalThis.__VEIL_RPC_INFO__.ready = true; globalThis.__VEIL_RENDER_DIAGNOSTICS__?.(); });\n    if ((!document.referrer || discordSdk.sourceOrigin === \"*\") && typeof discordSdk.handshake === \"function\") {\n      setTimeout(() => {\n        if (readyResolved) return;\n        const trustedOrigin = /^https:\\/\\/(?:ptb\\.|canary\\.)?discord(?:app)?\\.com$/i.test(ancestorOrigin) ? ancestorOrigin : \"https://discord.com\";\n        try {\n          discordSdk.sourceOrigin = trustedOrigin;\n          discordSdk.handshake();\n          globalThis.__VEIL_RPC_INFO__.fallback = \`RESENT TO ${'${trustedOrigin}'}\`;\n        } catch (error) {\n          globalThis.__VEIL_RPC_INFO__.fallback = \`FAILED: ${'${error?.message || String(error)}'}\`;\n        }\n        globalThis.__VEIL_RENDER_DIAGNOSTICS__?.();\n      }, 2500);\n    }\n    await withTimeout(readyPromise, 12000, \"Discord SDK READY\");`;

  if (!client.includes(setupTarget)) {
    return `document.body.innerHTML = '<pre style="white-space:pre-wrap;color:#fff;background:#120b18;padding:20px">VEIL CLIENT BUILD ERROR // ${ACTIVITY_BUILD}\\nOfficial SDK setup patch target was not found.</pre>';`;
  }
  client = client.replace(setupTarget, setupReplacement);

  const diagnostic = `\n(function veilLaunchDiagnostics(){\n  try {\n    if (\"scrollRestoration\" in history) history.scrollRestoration = \"manual\";\n    window.scrollTo(0, 0);\n    const render = () => {\n      const p = new URLSearchParams(window.location.search);\n      const guild = p.get("guild_id") || "MISSING";\n      const body = document.body?.dataset || {};\n      const rpc = globalThis.__VEIL_RPC_INFO__ || {};\n      const lines = [\n        "Discord SDK: OFFICIAL @discord/embedded-app-sdk ${OFFICIAL_DISCORD_SDK_VERSION}",\n        "Handshake Application ID: " + (body.discordClientId || "MISSING"),\n        "Application ID source: " + (body.appIdSource || "MISSING"),\n        "Launch guild_id: " + guild,\n        "Test guild match: " + (guild === "${TEST_GUILD_ID}" ? "YES" : "NO"),\n        "Launch channel_id: " + (p.get("channel_id") || "MISSING"),\n        "Launch frame_id: " + (p.get("frame_id") || "MISSING"),\n        "Launch platform: " + (p.get("platform") || "MISSING"),\n        "location host: " + window.location.hostname,\n        "expected proxy: " + (rpc.expectedProxyHost || ((body.discordClientId || "MISSING") + ".discordsays.com")),\n        "proxy match: " + (rpc.expectedProxyHost ? (rpc.actualHost === rpc.expectedProxyHost ? "YES" : "NO") : "WAITING"),\n        "document.referrer: " + (document.referrer || "MISSING"),\n        "ancestor origin: " + (rpc.ancestorOrigin || "MISSING"),\n        "parent === self: " + (rpc.parentIsSelf == null ? "WAITING" : rpc.parentIsSelf ? "YES" : "NO"),\n        "SDK sourceOrigin: " + (rpc.sourceOrigin || "WAITING"),\n        "SDK source === parent: " + (rpc.sourceIsParent == null ? "WAITING" : rpc.sourceIsParent ? "YES" : "NO"),\n        "fallback READY: " + (rpc.fallback || "NONE"),\n        "READY received: " + (rpc.ready ? "YES" : "NO"),\n        "client path: ${ACTIVITY_CLIENT_PATH}"\n      ];\n      const el = document.getElementById("veilLaunchDebugText");\n      if (el) el.textContent = lines.join("\\n");\n    };\n    globalThis.__VEIL_RENDER_DIAGNOSTICS__ = render;\n    render();\n    setTimeout(() => { window.scrollTo(0, 0); render(); }, 150);\n  } catch (error) {\n    const el = document.getElementById("veilLaunchDebugText");\n    if (el) el.textContent = "launch diagnostic failed: " + (error?.message || String(error));\n  }\n})();\n`;

  const bootMarker = `\n(function veilDirectBootMarker(){\n  const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };\n  put("connection", "OFFICIAL SDK ONLINE");\n  put("round", "OFFICIAL SDK ONLINE");\n  put("headline", "STARTING DISCORD HANDSHAKE…");\n  put("event", "Veil ${ACTIVITY_BUILD} is using Discord's official Embedded App SDK ${OFFICIAL_DISCORD_SDK_VERSION}. No response-rewriting tracer is active.");\n  put("notice", "Official Discord SDK online // checking Activity proxy and READY handshake");\n})();\n`;

  return `${OFFICIAL_DISCORD_SDK_SOURCE}\n${diagnostic}\n${bootMarker}\n${client}`;
}

function launchDiagnosticBox() {
  return `<div id="veilLaunchDebug" style="position:fixed;left:8px;right:8px;top:190px;z-index:99999;background:rgba(5,4,9,.96);border:1px solid #614580;border-radius:10px;padding:8px 10px;color:#d8c9e6;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;max-height:31vh;overflow:auto;pointer-events:none"><b style="color:#fff">VEIL CONNECTION CHECK // ${ACTIVITY_BUILD}</b><div id="veilLaunchDebugText">official SDK client is starting…</div></div>`;
}

function directHtml(application, envApplicationId) {
  const applicationId = String(application.id || "");
  let source = liveActivityHtml(applicationId);
  source = source.replace(
    `<body data-discord-client-id="${applicationId}">`,
    `<body data-discord-client-id="${applicationId}" data-worker-env-app-id="${String(envApplicationId || "").replace(/[^0-9]/g, "")}" data-app-id-source="${application.source}" data-app-id-corrected="${applicationId && applicationId !== String(envApplicationId || "") ? "YES" : "NO"}">`
  );
  source = source.replace("ARENA OFFLINE", "OFFICIAL SDK LOADING");
  source = source.replace("The Activity is connecting to the Arena engine.", `Loading official Discord SDK Activity client ${ACTIVITY_BUILD}…`);
  source = source.replace(
    '<div class="event" id="event"><div class="spinner"></div></div>',
    `<div class="event" id="event">Loading Veil official SDK client ${ACTIVITY_BUILD}…<div class="spinner"></div></div>`
  );
  source = source.replace('src="/activity/live.js"', `src="${ACTIVITY_CLIENT_PATH}"`);
  const debug = launchDiagnosticBox();
  source = source.includes("</body>") ? source.replace("</body>", `${debug}</body>`) : `${source}${debug}`;
  return source;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const application = await resolveDiscordApplication(env);
    const fixedEnv = correctedEnv(env, application.id);

    if (request.method === "GET" && url.pathname === ACTIVITY_CLIENT_PATH) {
      return javascript(directClientSource());
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      const headers = noStore(new Headers({ "content-type": "text/html; charset=utf-8" }));
      return new Response(directHtml(application, application.envId), { status: 200, headers });
    }

    return app.fetch(request, fixedEnv, ctx);
  }
};
