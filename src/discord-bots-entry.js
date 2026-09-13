import app, { ArenaCoordinator } from "./activity-official-entry.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { addFakeContestants } from "./core/simulation.js";
import { normalizeDwalletAmount, normalizeDwalletCurrency } from "./dwallet-payout.js";

export { ArenaCoordinator };

function botAmount(interaction) {
  const sub = interaction?.data?.options?.[0];
  const amount = sub?.options?.find(option => option.name === "amount")?.value;
  return Math.max(1, Math.min(50, Math.floor(Number(amount) || 10)));
}

function arenaSubcommand(interaction) {
  if (interaction?.type !== InteractionType.APPLICATION_COMMAND || interaction?.data?.name !== "arena") return "";
  return interaction?.data?.options?.[0]?.name || "";
}

async function activeHostGame(interaction, env, purpose) {
  if (!interaction.guild_id) return { error: interactionMessage(`Arena ${purpose} can only be used inside a server.`, [], true) };
  if (!env.DB) return { error: interactionMessage("Arena database is not configured yet.", [], true) };
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || game.guildId !== interaction.guild_id) {
    return { error: interactionMessage("Start an Arena registration first with `/arena start`.", [], true) };
  }
  if (game.status !== "registration") {
    return { error: interactionMessage(`Arena ${purpose} can only be changed while registration is open.`, [], true) };
  }
  const user = userFromInteraction(interaction);
  if (!user || user.id !== game.hostId) {
    return { error: interactionMessage(`Only the Arena host can change ${purpose}.`, [], true) };
  }
  return { game, user };
}

async function handleBotsCommand(interaction, env) {
  const context = await activeHostGame(interaction, env, "bots");
  if (context.error) return context.error;
  const { game } = context;
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

async function handlePayoutCommand(interaction, env) {
  const context = await activeHostGame(interaction, env, "winner payout");
  if (context.error) return context.error;
  if (!env.DWALLET_API_KEY) {
    return interactionMessage("DWallet winner payouts are not configured on this Worker yet.", [], true);
  }

  const { game, user } = context;
  const sub = interaction.data?.options?.[0];
  const amountRaw = sub?.options?.find(option => option.name === "amount")?.value;
  const currencyRaw = sub?.options?.find(option => option.name === "currency")?.value;

  try {
    const amount = normalizeDwalletAmount(amountRaw);
    const currency = normalizeDwalletCurrency(currencyRaw);
    game.dwalletWinnerPayout = {
      amount,
      currency,
      hostId: user.id,
      hostName: user.displayName,
      configuredAt: new Date().toISOString(),
      status: "armed"
    };
    await saveGame(env.DB, game);
    return interactionMessage(
      `💜 **DWallet winner payout armed.**\n\n🏆 Winner: **${amount} ${currency}**\nHost: **${user.displayName}**\n\nWhen this Arena finishes, Veil will send the winning Discord user a DWallet tip automatically. The money is debited from the DWallet user linked to this Worker's API key. Run \`/arena payout\` again before START to change it.`
    );
  } catch (error) {
    return interactionMessage(String(error?.message || error), [], true);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      const raw = await request.clone().text().catch(() => "");
      let interaction = null;
      try { interaction = JSON.parse(raw); } catch {}
      const subcommand = arenaSubcommand(interaction);

      if (subcommand === "bots" || subcommand === "payout") {
        if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) {
          return new Response("Bad signature", { status: 401 });
        }
        if (subcommand === "bots") return handleBotsCommand(interaction, env);
        return handlePayoutCommand(interaction, env);
      }
    }

    return app.fetch(request, env, ctx);
  }
};
