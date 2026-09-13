import app, { ArenaCoordinator } from "./activity-single-script-entry.js";
import { liveActivityHtml } from "./activity-live.js";
import { ACTIVITY_LIVE_CLIENT } from "./activity-live-client.js";
import { MINI_DISCORD_SDK_SOURCE } from "./activity-mini-sdk.js";

export { ArenaCoordinator };

const ACTIVITY_BUILD = "20260913-11";
const ACTIVITY_CLIENT_PATH = "/activity/veil-arena-20260913-11.js";
const TEST_GUILD_ID = "1504257112094539798";

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  headers.set("x-veil-direct-client", "1");
  return headers;
}

function javascript(source) {
  const headers = noStore(new Headers());
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(source, { status: 200, headers });
}

function directClientSource() {
  const target = '  const sdkPath = "/activity/sdk.js";\n  const { DiscordSDK } = await import(sdkPath);';
  if (!ACTIVITY_LIVE_CLIENT.includes(target)) {
    return `document.body.innerHTML = '<pre style="white-space:pre-wrap;color:#fff;background:#120b18;padding:20px">VEIL CLIENT BUILD ERROR // ${ACTIVITY_BUILD}\\nDirect client patch target was not found.</pre>';`;
  }

  const inlineSdk = MINI_DISCORD_SDK_SOURCE
    .replace("export class DiscordSDK", "class InlineDiscordSDK")
    .replace(/^export\s+/gm, "");

  let client = ACTIVITY_LIVE_CLIENT.replace(
    target,
    `  const DiscordSDK = InlineDiscordSDK;`
  );

  // Populate launch diagnostics from the external client itself. Discord's Activity
  // CSP can block inline <script> diagnostics, so this must live in the same external
  // file as Arena.
  const diagnostic = `\n(function veilLaunchDiagnostics(){\n  try {\n    const p = new URLSearchParams(window.location.search);\n    const guild = p.get("guild_id") || "MISSING";\n    const lines = [\n      "Worker Application ID: " + (document.body?.dataset?.discordClientId || "MISSING"),\n      "Expected test guild_id: ${TEST_GUILD_ID}",\n      "Launch guild_id: " + guild,\n      "Test guild match: " + (guild === "${TEST_GUILD_ID}" ? "YES" : "NO"),\n      "Launch channel_id: " + (p.get("channel_id") || "MISSING"),\n      "Launch instance_id: " + (p.get("instance_id") || "MISSING"),\n      "Launch frame_id: " + (p.get("frame_id") || "MISSING"),\n      "Launch platform: " + (p.get("platform") || "MISSING"),\n      "mobile_app_version: " + (p.get("mobile_app_version") || "MISSING"),\n      "referrer origin: " + (document.referrer ? new URL(document.referrer).origin : "MISSING"),\n      "client path: ${ACTIVITY_CLIENT_PATH}",\n      "client mode: DIRECT / NO DYNAMIC IMPORT"\n    ];\n    const el = document.getElementById("veilLaunchDebugText");\n    if (el) el.textContent = lines.join("\\n");\n  } catch (error) {\n    const el = document.getElementById("veilLaunchDebugText");\n    if (el) el.textContent = "launch diagnostic failed: " + (error?.message || String(error));\n  }\n})();\n`;

  // Put a visible marker on screen before Activity auth starts. If this marker changes,
  // the direct client executed and there is no SDK loading stage left to blame.
  const bootMarker = `\n(function veilDirectBootMarker(){\n  const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };\n  put("connection", "DIRECT CLIENT ONLINE");\n  put("round", "DIRECT CLIENT ONLINE");\n  put("headline", "STARTING DISCORD HANDSHAKE…");\n  put("event", "Veil ${ACTIVITY_BUILD} loaded with the Discord bridge embedded directly. No SDK download or dynamic import is running.");\n  put("notice", "Direct client online // starting Discord READY handshake");\n})();\n`;

  return `${inlineSdk}\n${diagnostic}\n${bootMarker}\n${client}`;
}

function launchDiagnosticBox() {
  return `<div id="veilLaunchDebug" style="position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:rgba(5,4,9,.94);border:1px solid #614580;border-radius:10px;padding:8px 10px;color:#d8c9e6;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;max-height:34vh;overflow:auto"><b style="color:#fff">VEIL LAUNCH CONTEXT // ${ACTIVITY_BUILD}</b><div id="veilLaunchDebugText">external client has not populated launch IDs yet…</div></div>`;
}

function directHtml(applicationId) {
  let source = liveActivityHtml(applicationId);
  source = source.replace("ARENA OFFLINE", "DIRECT CLIENT LOADING");
  source = source.replace("The Activity is connecting to the Arena engine.", `Loading direct Activity client ${ACTIVITY_BUILD}…`);
  source = source.replace(
    '<div class="event" id="event"><div class="spinner"></div></div>',
    `<div class="event" id="event">Loading Veil direct client ${ACTIVITY_BUILD}…<div class="spinner"></div></div>`
  );
  source = source.replace(
    'src="/activity/live.js"',
    `src="${ACTIVITY_CLIENT_PATH}"`
  );
  const debug = launchDiagnosticBox();
  source = source.includes("</body>") ? source.replace("</body>", `${debug}</body>`) : `${source}${debug}`;
  return source;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === ACTIVITY_CLIENT_PATH) {
      return javascript(directClientSource());
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      const headers = noStore(new Headers({ "content-type": "text/html; charset=utf-8" }));
      return new Response(directHtml(env.DISCORD_APPLICATION_ID), { status: 200, headers });
    }

    return app.fetch(request, env, ctx);
  }
};
