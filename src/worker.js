import { handleTelegramRoute } from "./telegram-control-fast.js";
import { telegramFxMiniAppHtml } from "./telegram-fx-app.js";
import { applyTelegramMiniAppAssetBatch2 } from "./telegram-miniapp-assets-batch2.js";
import { applyTelegramMiniAppAssetBatch3 } from "./telegram-miniapp-assets-batch3.js";
import { applyTelegramPerformancePass } from "./telegram-performance.js";
import { applyTelegramFeaturePack } from "./telegram-feature-pack.js";
import { applyTelegramPrizePack } from "./telegram-prize-pack.js";
import { applyTelegramUiPolish } from "./telegram-ui-polish.js";
import { applyTelegramProductPass } from "./telegram-product-pass.js";
import { handleDiscordRoute } from "./discord-control.js";
import { ArenaCoordinator } from "./coordinator-features.js";
import { handleDiscordActivityRoute } from "./discord-activity.js";
import { injectVeilSfx } from "./sfx-integration.js";

export { ArenaCoordinator };

const BASELINE = "2026-09-13-discord-activity-official-1";
const TELEGRAM_BUILD = "2026-09-17-telegram-product-pass-1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function preserveFinishedRoundNarration(url, response) {
  if (!response || url.pathname !== "/telegram/api/state" || !response.ok) return response;
  const data = await response.clone().json().catch(() => null);
  if (!data || data.status !== "finished" || !Array.isArray(data.displayLog)) return response;

  const roundEntry = [...data.displayLog].reverse().find(entry => /ROUND\s+\d+/i.test(String(entry?.text || "")));
  if (!roundEntry?.text) return response;

  const finishEntry = [...data.displayLog].reverse().find(entry => /WINS THE ARENA|ended without a winner/i.test(String(entry?.text || "")));
  const finishText = String(finishEntry?.text || data.lastEvent?.text || "").trim();
  const roundText = String(roundEntry.text).trim();
  const combined = finishText && finishText !== roundText ? `${roundText}\n\n${finishText}` : roundText;

  data.lastEvent = { ...(data.lastEvent || {}), text: combined };
  return json(data, response.status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/telegram/app") {
      const performanceHtml = applyTelegramPerformancePass(telegramFxMiniAppHtml());
      const telegramHtml = applyTelegramMiniAppAssetBatch2(performanceHtml);
      const assetHtml = applyTelegramMiniAppAssetBatch3(telegramHtml);
      const featureHtml = applyTelegramFeaturePack(assetHtml);
      const sponsorHtml = applyTelegramPrizePack(featureHtml);
      return html(applyTelegramProductPass(applyTelegramUiPolish(injectVeilSfx(sponsorHtml))));
    }

    if (url.pathname.startsWith("/telegram/")) {
      const response = await handleTelegramRoute(request, env);
      if (response) return preserveFinishedRoundNarration(url, response);
    }

    if (url.pathname === "/api/token" || url.pathname.startsWith("/api/activity/")) {
      const response = await handleDiscordActivityRoute(request, env);
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
        discordActivity: env.DISCORD_APPLICATION_ID && env.DISCORD_CLIENT_SECRET ? "ready-for-portal" : "waiting-for-oauth-keys",
        discordActivityTestMode: env.DISCORD_ACTIVITY_TEST_MODE === "true",
        dwalletPayouts: env.DWALLET_API_KEY ? "configured" : "waiting-for-api-key",
        telegramDwalletPot: env.DWALLET_TELEGRAM_POT_USERNAME ? "configured" : "waiting-for-pot-username",
        telegramDwalletPayouts: env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true" ? "enabled" : "safety-locked",
        veilTipAdminsConfigured: Boolean(String(env.VEIL_TIP_ADMIN_IDS || "").trim()),
        veilTipPlatformAdminsEnabled: env.VEIL_TIP_ALLOW_PLATFORM_ADMINS === "true",
        telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "waiting-for-keys",
        telegramBuild: TELEGRAM_BUILD,
        telegramTestMode: env.TELEGRAM_TEST_MODE === "true",
        databaseBound: Boolean(env.DB),
        coordinatorBound: Boolean(env.ARENA_COORDINATOR)
      });
    }

    return new Response("Veil Arena backend is online.", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-veil-baseline": BASELINE,
        "x-veil-telegram-build": TELEGRAM_BUILD
      }
    });
  }
};
