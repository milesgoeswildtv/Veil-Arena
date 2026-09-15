import {
  telegramState as featureState,
  telegramAction as featureAction,
  telegramHall,
  telegramShare
} from "./telegram-feature-api-final.js";
import { loadGame } from "./storage.js";
import {
  telegramPrizePoolState,
  createTelegramPrize,
  cancelTelegramPrize,
  verifyTelegramPrizeFunding,
  assertTelegramPrizesFunded,
  settleTelegramPrizePool
} from "./dwallet-telegram-prizes.js";

export { telegramHall, telegramShare };

async function context(request, env) {
  const state = await featureState(request, env);
  const game = await loadGame(env.DB, state.id);
  if (!game) throw new Error("That Arena no longer exists.");
  return { state, game, viewer: state.viewer };
}

function addPrizeState(state, game, env) {
  state.prizePool = telegramPrizePoolState(game, env);
  return state;
}

export async function telegramState(request, env) {
  const state = await featureState(request, env);
  const game = await loadGame(env.DB, state.id);
  return game ? addPrizeState(state, game, env) : state;
}

export async function telegramAction(request, env) {
  const body = await request.clone().json().catch(() => ({}));
  const action = String(body.action || "");
  const prizeActions = new Set(["sponsor_create", "sponsor_cancel", "sponsor_check"]);

  if (prizeActions.has(action)) {
    const { game, viewer } = await context(request, env);
    if (action === "sponsor_create") {
      await createTelegramPrize(env, game, viewer, {
        awardId: body.awardId,
        amount: body.amount,
        currency: body.currency
      });
    } else if (action === "sponsor_cancel") {
      await cancelTelegramPrize(env, game, viewer, body.prizeId);
    } else if (action === "sponsor_check") {
      await verifyTelegramPrizeFunding(env, game, viewer, body.prizeId);
    }
    return telegramState(request, env);
  }

  if (action === "start") {
    const { game } = await context(request, env);
    assertTelegramPrizesFunded(game);
  }

  const state = await featureAction(request, env);
  const game = await loadGame(env.DB, state.id);
  if (game && ["cancelled", "aborted"].includes(game.status)) await settleTelegramPrizePool(env, game);
  const fresh = game ? await loadGame(env.DB, game.id) : null;
  return fresh ? addPrizeState(state, fresh, env) : state;
}
