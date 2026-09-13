import app, { ArenaCoordinator } from "./activity-sdk-route-fix-entry.js";
import { MINI_DISCORD_SDK_SOURCE } from "./activity-mini-sdk.js";

export { ArenaCoordinator };

const PREVIOUS_BUILD = "20260913-6";
const ACTIVITY_BUILD = "20260913-7";

function javascript(source, headers = {}) {
  return new Response(source, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
      "x-content-type-options": "nosniff",
      "x-veil-sdk-source": "local-minimal",
      "x-veil-activity-build": ACTIVITY_BUILD,
      ...headers
    }
  });
}

async function versioned(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  let source = await original.text();
  source = source.split(PREVIOUS_BUILD).join(ACTIVITY_BUILD);

  const headers = new Headers(original.headers);
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", ACTIVITY_BUILD);
  if (type.includes("javascript")) {
    headers.set("content-type", "application/javascript; charset=utf-8");
    headers.set("x-content-type-options", "nosniff");
  }
  return new Response(source, { status: original.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // No CDN, no package registry, no nested browser imports. This module is served
    // directly by Veil and implements only the Discord RPC operations Arena needs.
    if (request.method === "GET" && url.pathname === "/activity/sdk.js") {
      return javascript(MINI_DISCORD_SDK_SOURCE);
    }

    if (request.method === "GET" && url.pathname === "/activity/live.js") {
      return versioned(request, env, ctx);
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      return versioned(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
