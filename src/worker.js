import { handleTelegramRoute } from "./telegram-worker.js";
import { handleDiscordRoute } from "./discord-worker.js";
export { ArenaCoordinator } from "./coordinator.js";

const BASELINE = "2026-09-13-clean-reset";
const TELEGRAM_BUILD = "2026-09-13-telegram-clean-1";
const DISCORD_BUILD = "2026-09-13-discord-clean-1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/telegram/")) {
      const response = await handleTelegramRoute(request, env);
      if (response) return response;
    }

    if (url.pathname.startsWith("/discord/") || url.pathname === "/setup/discord" || (url.pathname === "/" && request.method === "POST")) {
      const response = await handleDiscordRoute(request, env);
      if (response) return response;
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "veil-arena",
        baseline: BASELINE,
        gameCore: "preserved",
        discord: env.DISCORD_BOT_TOKEN && env.DISCORD_PUBLIC_KEY ? "configured" : "waiting-for-keys",
        discordBuild: DISCORD_BUILD,
        discordCoordinator: Boolean(env.ARENA_COORDINATOR),
        dwalletPayout: Boolean(env.DWALLET_API_KEY),
        telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "waiting-for-keys",
        telegramBuild: TELEGRAM_BUILD,
        telegramTestMode: env.TELEGRAM_TEST_MODE === "true",
        databaseBound: Boolean(env.DB)
      });
    }

    return new Response("Veil Arena is online. Discord and Telegram use the shared clean Arena core.", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-veil-baseline": BASELINE,
        "x-veil-telegram-build": TELEGRAM_BUILD,
        "x-veil-discord-build": DISCORD_BUILD
      }
    });
  }
};
