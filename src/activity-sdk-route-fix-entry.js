import app, { ArenaCoordinator } from "./activity-bootstrap-fix-entry.js";

export { ArenaCoordinator };

const BASE_BUILD = "20260913-4";
const ACTIVITY_BUILD = "20260913-6";
const SDK_ROOT = "https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@2.5.0/+esm";

function javascript(source, headers = {}) {
  return new Response(source, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-veil-sdk-build": ACTIVITY_BUILD,
      ...headers
    }
  });
}

function rewriteJsdelivrImports(source) {
  return String(source)
    // jsDelivr +esm dependencies are normally emitted as root-relative /npm/... URLs.
    .replace(/(["'])\/npm\//g, "$1/activity/sdk-cdn/npm/")
    // Also catch absolute jsDelivr URLs in static or dynamic imports.
    .replace(/(["'])https:\/\/cdn\.jsdelivr\.net\/npm\//g, "$1/activity/sdk-cdn/npm/");
}

async function fetchWithTimeout(target, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(target, {
      headers: { "user-agent": "Veil-Arena-Activity/1.0" },
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSdkModule(target) {
  try {
    const upstream = await fetchWithTimeout(target);
    if (!upstream.ok) {
      return javascript(
        `throw new Error(${JSON.stringify(`Veil could not fetch Discord SDK module (${upstream.status}) from ${target}`)});`,
        { "x-veil-sdk-upstream": String(upstream.status) }
      );
    }

    const source = rewriteJsdelivrImports(await upstream.text());
    return javascript(source, {
      "x-veil-sdk-upstream": String(upstream.status),
      "x-veil-sdk-source": "jsdelivr"
    });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? `Discord SDK upstream timed out while loading ${target}`
      : `Discord SDK server fetch failed: ${String(error?.message || error)}`;
    return javascript(`throw new Error(${JSON.stringify(message)});`);
  }
}

async function versionedLiveClient(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("javascript")) return original;

  let source = await original.text();
  source = source.split(BASE_BUILD).join(ACTIVITY_BUILD);

  // Never allow the SDK import itself to hang forever. If the browser import has not
  // completed in 12 seconds, surface a useful error in the Activity UI.
  source = source.replace(
    "({ DiscordSDK } = await import(sdkPath));",
    `({ DiscordSDK } = await Promise.race([\n      import(sdkPath),\n      new Promise((_, reject) => setTimeout(() => reject(new Error(\"Discord SDK module import timed out after 12 seconds.\")), 12000))\n    ]));`
  );

  const headers = new Headers(original.headers);
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  return new Response(source, { status: original.status, headers });
}

async function versionedActivityHtml(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("text/html")) return original;

  let source = await original.text();
  source = source.split(BASE_BUILD).join(ACTIVITY_BUILD);

  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  return new Response(source, { status: original.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/activity/sdk.js") {
      return fetchSdkModule(SDK_ROOT);
    }

    if (request.method === "GET" && url.pathname.startsWith("/activity/sdk-cdn/npm/")) {
      const tail = url.pathname.slice("/activity/sdk-cdn/npm/".length);
      if (!tail || tail.includes("..")) {
        return javascript('throw new Error("Invalid Discord SDK dependency path.");');
      }
      return fetchSdkModule(`https://cdn.jsdelivr.net/npm/${tail}${url.search}`);
    }

    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return versionedLiveClient(request, env, ctx);
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      return versionedActivityHtml(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
