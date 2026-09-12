import worker from "./index.js";
export { ArenaCoordinator } from "./index.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Short Telegram Mini App alias for BotFather URL-length limits.
    if (url.pathname === "/tg" && request.method === "GET") {
      url.pathname = "/telegram/arena";
      return worker.fetch(new Request(url.toString(), request), env, ctx);
    }

    return worker.fetch(request, env, ctx);
  }
};
