import app, { ArenaCoordinator } from "./activity-clean-entry.js";

export { ArenaCoordinator };

const INNER_BUILD = "20260913-19";
const BUILD = "20260913-20";
const INNER_CLIENT_PATH = `/activity/veil-clean-${INNER_BUILD}.js`;
const CLIENT_PATH = `/activity/veil-clean-${BUILD}.js`;

const BROWSER_RUNTIME = `
var __name = globalThis.__name || function(target, value) {
  try { Object.defineProperty(target, "name", { value: value, configurable: true }); } catch (_) {}
  return target;
};
`;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", BUILD);
  headers.set("x-veil-browser-runtime-fix", "__name");
  return headers;
}

async function innerClient(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = INNER_CLIENT_PATH;
  url.search = "";
  return app.fetch(new Request(url.toString(), { method: "GET", headers: request.headers }), env, ctx);
}

async function fixedClient(request, env, ctx) {
  const original = await innerClient(request, env, ctx);
  if (!original.ok) return original;
  const source = await original.text();
  return new Response(`${BROWSER_RUNTIME}\n${source}`, {
    status: original.status,
    headers: noStore(new Headers({
      "content-type": "application/javascript; charset=utf-8",
      "x-content-type-options": "nosniff"
    }))
  });
}

async function fixedHtml(request, env, ctx) {
  const original = await app.fetch(request, env, ctx);
  if (!original.ok) return original;
  const type = original.headers.get("content-type") || "";
  if (!type.includes("text/html")) return original;

  let source = await original.text();
  source = source.split(INNER_BUILD).join(BUILD);
  source = source.split(INNER_CLIENT_PATH).join(CLIENT_PATH);

  return new Response(source, {
    status: original.status,
    headers: noStore(new Headers(original.headers))
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === CLIENT_PATH) {
      return fixedClient(request, env, ctx);
    }

    if (request.method === "GET" && ["/", "/activity", "/activity/", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      return fixedHtml(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
