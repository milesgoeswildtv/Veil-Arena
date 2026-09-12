import app, { ArenaCoordinator } from "./entry.js";
import { handleActivityPreview } from "./activity-preview.js";

export { ArenaCoordinator };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/activity-preview" || url.pathname.startsWith("/activity-preview/"))) {
      return handleActivityPreview();
    }
    return app.fetch(request, env, ctx);
  }
};
