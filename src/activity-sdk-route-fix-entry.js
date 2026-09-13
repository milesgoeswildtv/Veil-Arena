import app, { ArenaCoordinator } from "./activity-bootstrap-fix-entry.js";

export { ArenaCoordinator };

const PREVIOUS_BUILD = "20260913-4";
const ACTIVITY_BUILD = "20260913-5";
const SDK_ROOT = "https://esm.sh/@discord/embedded-app-sdk@2.5.0?bundle&target=es2020";

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

function rewriteEsmImports(source) {
  return String(source)
    .replace(/(from\s*["'])\/([^"']+)(["'])/g, `$1/activity/sdk-dep/$2$3`)
    .replace(/(import\s*["'])\/([^"']+)(["'])/g, `$1/activity/sdk-dep/$2$3`)
    .replace(/(import\(\s*["'])\/([^"']+)(["']\s*\))/g, `$1/activity/sdk-dep/$2$3`)
    .replace(/(from\s*["'])https:\/\/esm\.sh\/([^"']+)(["'])/g, `$1/activity/sdk-dep/$2$3`)
    .replace(/(import\s*["'])https:\/\/esm\.sh\/([^"']+)(["'])/g, `$1/activity/sdk-dep/$2$3`)
    .replace(/(import\(\s*["'])https:\/\/esm\.sh\/([^"']+)(["']\s*\))/g, `$1/activity/sdk-dep/$2$3`);
}

async function fetchSdkModule(target) {
  try {
    const upstream = await fetch(target, {
      headers: { "user-agent": "Veil-Arena-Activity/1.0" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!upstream.ok) {
      return javascript(`throw new Error(${JSON.stringify(`Veil could not fetch Discord SDK module (${upstream.status}) from ${target}`)});`, {
        "x-veil-sdk-upstream": String(upstream.status)
      });
    }

    const source = rewriteEsmImports(await upstream.text());
    return javascript(source, {
      "x-veil-sdk-upstream": String(upstream.status)
    });
  } catch (error) {
    return javascript(`throw new Error(${JSON.stringify(`Discord SDK server fetch failed: ${String(error?.message || error)}`)});`);
  }
}

async function versionedLiveClient(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("javascript")) return original;

  let source = await original.text();
  source = source.split(PREVIOUS_BUILD).join(ACTIVITY_BUILD);
  source = source.replace('const sdkPath = "/activity/sdk.js?v=' + ACTIVITY_BUILD + '";', 'const sdkPath = "/activity/sdk.js?v=' + ACTIVITY_BUILD + '";');

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
  source = source.split(PREVIOUS_BUILD).join(ACTIVITY_BUILD);

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

    if (request.method === "GET" && url.pathname.startsWith("/activity/sdk-dep/")) {
      const tail = url.pathname.slice("/activity/sdk-dep/".length);
      if (!tail || tail.includes("..")) {
        return javascript('throw new Error("Invalid Discord SDK dependency path.");');
      }
      return fetchSdkModule(`https://esm.sh/${tail}${url.search}`);
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
