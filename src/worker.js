import { handleTelegramRoute } from "./telegram-worker.js";

const BASELINE = "2026-09-13-clean-reset";
const TELEGRAM_BUILD = "2026-09-13-telegram-clean-1";

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

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "veil-arena",
        baseline: BASELINE,
        gameCore: "preserved",
        discord: "not-configured",
        telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "waiting-for-keys",
        telegramBuild: TELEGRAM_BUILD,
        telegramTestMode: env.TELEGRAM_TEST_MODE === "true",
        databaseBound: Boolean(env.DB)
      });
    }

    return new Response(
      "Veil Arena core is online. Telegram has been rebuilt cleanly; Discord remains intentionally disconnected.",
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
