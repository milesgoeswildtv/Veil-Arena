import { handleTelegramRoute } from "./telegram-control.js";
import { handleDiscordRoute, ArenaCoordinator } from "./discord-control.js";

export { ArenaCoordinator };

const BASELINE = "2026-09-13-discord-dwallet-live";
const TELEGRAM_BUILD = "2026-09-13-telegram-forceclose-2";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/telegram/")) {
      const response = await handleTelegramRoute(request, env);
      if (response) return response;
    }

    const discordResponse = await handleDiscordRoute(request, env);
    if (discordResponse) return discordResponse;

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "veil-arena",
        baseline: BASELINE,
        gameCore: "preserved",
        discord: env.DISCORD_BOT_TOKEN && env.DISCORD_PUBLIC_KEY && env.DISCORD_APPLICATION_ID ? "configured" : "waiting-for-keys",
        dwalletPayouts: env.DWALLET_API_KEY ? "configured" : "waiting-for-api-key",
        telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "waiting-for-keys",
        telegramBuild: TELEGRAM_BUILD,
        telegramTestMode: env.TELEGRAM_TEST_MODE === "true",
        databaseBound: Boolean(env.DB),
        coordinatorBound: Boolean(env.ARENA_COORDINATOR)
      });
    }

    return new Response(
      "Veil Arena is online. Discord Arena and Telegram Arena are both connected.",
      {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-veil-baseline": BASELINE,
          "x-veil-telegram-build": TELEGRAM_BUILD
        }
      }
    );
  }
};
