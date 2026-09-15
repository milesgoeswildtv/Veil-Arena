import {
  telegramState as featureState,
  telegramAction as featureAction,
  telegramHall,
  telegramShare as featureShare
} from "./telegram-feature-api.js";
import { loadGame, saveGame } from "./storage.js";

export { telegramHall };

export async function telegramState(request, env) {
  return featureState(request, env);
}

export async function telegramAction(request, env) {
  const body = await request.clone().json().catch(() => ({}));
  const action = String(body.action || "");
  if (action !== "newgame" && action !== "rematch") return featureAction(request, env);

  const beforeState = await featureState(request, env);
  const beforeGame = await loadGame(env.DB, beforeState.id);
  const result = await featureAction(request, env);
  if (beforeGame?.telegramLaunchUrl && result?.id && result.id !== beforeGame.id) {
    const fresh = await loadGame(env.DB, result.id);
    if (fresh && !fresh.telegramLaunchUrl) {
      fresh.telegramLaunchUrl = beforeGame.telegramLaunchUrl;
      await saveGame(env.DB, fresh);
    }
  }
  return result;
}

export async function telegramShare(request, env) {
  const state = await featureState(request, env);
  const game = await loadGame(env.DB, state.id);
  if (game?.telegramLaunchUrl) {
    return {
      url: game.telegramLaunchUrl,
      arenaCode: String(game.id).replace(/-/g, "").slice(-8).toUpperCase()
    };
  }
  return featureShare(request, env);
}
