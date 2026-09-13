import app, { ArenaCoordinator } from "./activity-local-sdk-entry.js";
import { MINI_DISCORD_SDK_SOURCE } from "./activity-mini-sdk.js";

export { ArenaCoordinator };

const PREVIOUS_BUILD = "20260913-8";
const ACTIVITY_BUILD = "20260913-9";

function headersFor(original, javascript = false) {
  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  headers.set("x-veil-single-script", "1");
  if (javascript) {
    headers.set("content-type", "application/javascript; charset=utf-8");
    headers.set("x-content-type-options", "nosniff");
  }
  return headers;
}

async function singleScriptClient(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  let source = await original.text();
  source = source.split(PREVIOUS_BUILD).join(ACTIVITY_BUILD);

  const inlineSdk = MINI_DISCORD_SDK_SOURCE
    .replace("export class DiscordSDK", "class InlineDiscordSDK")
    .replace(/^export\s+/gm, "");

  if (!source.includes("import(sdkPath)")) {
    return new Response(
      `${inlineSdk}\nthrow new Error("Veil single-script patch could not find the SDK import in live.js.");\n${source}`,
      { status: 200, headers: headersFor(original, true) }
    );
  }

  source = source.replaceAll(
    "import(sdkPath)",
    "Promise.resolve({ DiscordSDK: InlineDiscordSDK })"
  );
  source = `${inlineSdk}\n\n${source}`;

  return new Response(source, {
    status: original.status,
    headers: headersFor(original, true)
  });
}

function launchDiagnosticHtml(workerApplicationId) {
  const appId = JSON.stringify(String(workerApplicationId || "MISSING"));
  return `<div id="veilLaunchDebug" style="position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:rgba(5,4,9,.94);border:1px solid #614580;border-radius:10px;padding:8px 10px;color:#d8c9e6;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;max-height:34vh;overflow:auto">
<b style="color:#fff">VEIL LAUNCH CONTEXT // ${ACTIVITY_BUILD}</b><div id="veilLaunchDebugText">reading Discord launch IDs…</div></div>
<script>(function(){try{var p=new URLSearchParams(location.search);var lines=[
"Worker Application ID: "+${appId},
"Launch guild_id: "+(p.get("guild_id")||"MISSING"),
"Launch channel_id: "+(p.get("channel_id")||"MISSING"),
"Launch instance_id: "+(p.get("instance_id")||"MISSING"),
"Launch frame_id: "+(p.get("frame_id")||"MISSING"),
"Launch platform: "+(p.get("platform")||"MISSING"),
"mobile_app_version: "+(p.get("mobile_app_version")||"MISSING"),
"referrer origin: "+(document.referrer?(new URL(document.referrer)).origin:"MISSING")
];var el=document.getElementById("veilLaunchDebugText");if(el)el.textContent=lines.join("\n");}catch(e){var el=document.getElementById("veilLaunchDebugText");if(el)el.textContent="launch diagnostic failed: "+(e&&e.message||e);}})();</script>`;
}

async function versionedHtml(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("text/html")) return original;
  let source = await original.text();
  source = source.split(PREVIOUS_BUILD).join(ACTIVITY_BUILD);
  source = source.replace(
    /Loading Veil Activity client [^<]+/,
    `Loading Veil Activity client ${ACTIVITY_BUILD} // single-script mode…`
  );
  const debug = launchDiagnosticHtml(env.DISCORD_APPLICATION_ID);
  source = source.includes("</body>") ? source.replace("</body>", `${debug}</body>`) : `${source}${debug}`;
  return new Response(source, {
    status: original.status,
    headers: headersFor(original, false)
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return singleScriptClient(request, env, ctx);
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      return versionedHtml(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
