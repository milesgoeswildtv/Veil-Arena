import { handleTelegramRoute as baseHandleTelegramRoute } from "./telegram-control.js";
import { telegramState, telegramAction, telegramHall, telegramShare } from "./telegram-feature-api-final.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function handleTelegramRoute(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/telegram/api/state") {
    try {
      return json(await telegramState(request, env));
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400);
    }
  }

  if (request.method === "POST" && url.pathname === "/telegram/api/action") {
    try {
      return json(await telegramAction(request, env));
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400);
    }
  }

  if (request.method === "GET" && url.pathname === "/telegram/api/hall") {
    try {
      return json(await telegramHall(request, env));
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400);
    }
  }

  if (request.method === "GET" && url.pathname === "/telegram/api/share") {
    try {
      return json(await telegramShare(request, env));
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400);
    }
  }

  return baseHandleTelegramRoute(request, env);
}
