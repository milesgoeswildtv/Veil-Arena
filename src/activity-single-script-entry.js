import app, { ArenaCoordinator } from "./activity-local-sdk-entry.js";
import { MINI_DISCORD_SDK_SOURCE } from "./activity-mini-sdk.js";

export { ArenaCoordinator };

const PREVIOUS_BUILD = "20260913-7";
const ACTIVITY_BUILD = "20260913-8";

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

  // Inline the minimal Discord RPC bridge into the same JS response as Arena.
  // This deliberately eliminates every secondary SDK module request/import on iOS.
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
