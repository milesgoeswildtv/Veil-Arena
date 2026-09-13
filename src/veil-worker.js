import discordApp, { ArenaCoordinator } from "./discord-bots-entry.js";
import telegramApp from "./telegram-official-worker.js";

export { ArenaCoordinator };

function telegramRoute(url) {
  return url.pathname === "/tg" ||
    url.pathname === "/setup/telegram" ||
    url.pathname === "/admin/telegram/register" ||
    url.pathname === "/telegram/arena" ||
    url.pathname.startsWith("/telegram/");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (telegramRoute(url)) return telegramApp.fetch(request, env, ctx);
    return discordApp.fetch(request, env, ctx);
  }
};
