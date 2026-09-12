import app, { ArenaCoordinator } from "./entry.js";
import { handleActivityPreview } from "./activity-preview.js";
import { ACTIVITY_PREVIEW_CLIENT } from "./activity-preview-client.js";

export { ArenaCoordinator };

function cspSafeActivityHtml(source) {
  return String(source)
    .replace(/ onclick="fx\('([^']+)'\)"/g, ' data-fx="$1"')
    .replace(/ onclick="runAll\(\)"/g, ' data-fx="all"')
    .replace(/<script>[\s\S]*?<\/script>/, '<script src="/activity-preview/app.js"></script>');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/activity-preview/app.js") {
      return new Response(ACTIVITY_PREVIEW_CLIENT, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }
    if (request.method === "GET" && (url.pathname === "/activity-preview" || url.pathname.startsWith("/activity-preview/"))) {
      const original = await handleActivityPreview();
      const html = cspSafeActivityHtml(await original.text());
      const headers = new Headers(original.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "no-store");
      return new Response(html, { status: original.status, headers });
    }
    return app.fetch(request, env, ctx);
  }
};
