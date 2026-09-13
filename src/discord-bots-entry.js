import app, { ArenaCoordinator } from "./activity-browser-runtime-fix-entry.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { addFakeContestants } from "./core/simulation.js";

export { ArenaCoordinator };

function botAmount(interaction) {
  const sub = interaction?.data?.options?.[0];
  const amount = sub?.options?.find(option => option.name === "amount")?.value;
  return Math.max(1, Math.min(50, Math.floor(Number(amount) || 10)));
}

function isBotsCommand(interaction) {
  return interaction?.type === InteractionType.APPLICATION_COMMAND &&
    interaction?.data?.name === "arena" &&
    interaction?.data?.options?.[0]?.name === "bots";
}

async function handleBotsCommand(interaction, env) {
  if (!interaction.guild_id) return interactionMessage("Arena bots can only be added inside a server.", [], true);
  if (!env.DB) return interactionMessage("Arena database is not configured yet.", [], true);

  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || game.guildId !== interaction.guild_id) {
    return interactionMessage("Start an Arena registration first with `/arena start`, then add bots.", [], true);
  }
  if (game.status !== "registration") {
    return interactionMessage("Bots can only be added while Arena registration is open.", [], true);
  }

  const user = userFromInteraction(interaction);
  if (!user || user.id !== game.hostId) {
    return interactionMessage("Only the Arena host can add bots.", [], true);
  }

  const existingBots = Object.values(game.players || {}).filter(player => player?.simulated).length;
  const room = Math.max(0, 50 - existingBots);
  if (!room) return interactionMessage("This Arena already has the maximum of **50 bots**.", [], true);

  const requested = botAmount(interaction);
  const amount = Math.min(requested, room);
  const addedIds = addFakeContestants(game, amount);
  await saveGame(env.DB, game);

  const names = addedIds.map(id => game.players[id]?.displayName).filter(Boolean);
  const preview = names.slice(0, 12).map(name => `• ${name}`).join("\n");
  const more = names.length > 12 ? `\n• …and ${names.length - 12} more` : "";
  const total = Object.keys(game.players || {}).length;

  return interactionMessage(
    `🤖 **${addedIds.length} bot${addedIds.length === 1 ? "" : "s"} added to Arena.**\n\n${preview}${more}\n\n**${total} total entrants** are now registered. Bots fight, eliminate, get revived, and can win exactly like players, but simulated accounts are excluded from player stats and leaderboards.`
  );
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      const raw = await request.clone().text().catch(() => "");
      let interaction = null;
      try { interaction = JSON.parse(raw); } catch {}

      if (isBotsCommand(interaction)) {
        if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) {
          return new Response("Bad signature", { status: 401 });
        }
        return handleBotsCommand(interaction, env);
      }
    }

    return app.fetch(request, env, ctx);
  }
};
