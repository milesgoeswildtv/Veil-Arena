import app, { ArenaCoordinator } from "./activity-official-entry.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { addFakeContestants } from "./core/simulation.js";
import {
  normalizeDwalletAmount,
  normalizeDwalletCurrency,
  discoverDwalletPotUserId,
  verifyArenaFunding,
  fundingStatusText
} from "./dwallet-payout.js";

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

function isStartButton(interaction) {
  return interaction?.type === InteractionType.MESSAGE_COMPONENT &&
    String(interaction?.data?.custom_id || "").startsWith("arena:start:");
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
  if (["funded", "sending", "paid", "refunded"].includes(game.dwalletWinnerPayout?.status)) {
    return interactionMessage("That Arena prize is already funded and can no longer be changed.", [], true);
  }

  const sub = interaction.data?.options?.[0];
  const amountRaw = sub?.options?.find(option => option.name === "amount")?.value;
  const currencyRaw = sub?.options?.find(option => option.name === "currency")?.value;

  try {
    const amount = normalizeDwalletAmount(amountRaw);
    const currency = normalizeDwalletCurrency(currencyRaw);
    const potUserId = await discoverDwalletPotUserId(env);
    if (!potUserId) {
      return interactionMessage(
        "Veil cannot identify the DWallet prize-pot account yet. Set `DWALLET_POT_USER_ID` on the Worker to the Discord user ID linked to this DWallet API key, then run `/arena payout` again.",
        [],
        true
      );
    }

    game.dwalletWinnerPayout = {
      amount,
      currency,
      hostId: user.id,
      hostName: user.displayName,
      potUserId,
      configuredAt: new Date().toISOString(),
      status: "awaiting_funding"
    };
    await saveGame(env.DB, game);

    return interactionMessage(
      `💜 **Winner prize created — funding required.**\n\n🏆 Prize: **${amount} ${currency}**\nHost: **${user.displayName}**\nPrize pot: <@${potUserId}>\n\nUse DWallet to send **exactly ${amount} ${currency}** from your own DWallet balance to <@${potUserId}>. Then run \`/arena fund\`.\n\nVeil will not allow this Arena to START until that incoming DWallet tip from **your Discord user ID** is confirmed. After the match, the same funded amount is tipped from the pot to the winner.`
    );
  } catch (error) {
    return interactionMessage(String(error?.message || error), [], true);
  }
}

async function handleFundCommand(interaction, env) {
  const context = await activeHostGame(interaction, env, "prize funding");
  if (context.error) return context.error;
  const { game } = context;
  if (!game.dwalletWinnerPayout) {
    return interactionMessage("Set the winner prize first with `/arena payout`.", [], true);
  }

  try {
    const payout = await verifyArenaFunding(env, game, saveGame);
    if (payout?.status === "funded") {
      return interactionMessage(
        `✅ **WINNER PRIZE FUNDED**\n\n🏆 **${payout.amount} ${payout.currency}** is now locked in the Arena pot.${payout.fundingTipId ? `\nIncoming DWallet tip: **#${payout.fundingTipId}**` : ""}\n\nThe Arena can start. When a real player wins, Veil automatically sends that exact prize to their DWallet account.`,
        [],
        false
      );
    }
    if (payout?.status === "funding_ambiguous") {
      return interactionMessage(fundingStatusText(game), [], true);
    }
    return interactionMessage(
      `⏳ I do not see the host funding yet.\n\nSend **exactly ${payout.amount} ${payout.currency}** from your DWallet account to <@${payout.potUserId}> and run \`/arena fund\` again.`,
      [],
      true
    );
  } catch (error) {
    return interactionMessage(`DWallet funding check failed: ${String(error?.message || error)}`, [], true);
  }
}

async function handleStartFundingGate(interaction, env) {
  if (!env.DB) return null;
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || game.status !== "registration" || !game.dwalletWinnerPayout) return null;

  const user = userFromInteraction(interaction);
  if (!user || user.id !== game.hostId) return null;

  try {
    const payout = await verifyArenaFunding(env, game, saveGame);
    if (payout?.status === "funded") return null;
    return interactionMessage(
      `⛔ **This prize Arena cannot start until the pot is funded.**\n\n${fundingStatusText(game)}\n\nSend the exact prize through DWallet to <@${payout?.potUserId || game.dwalletWinnerPayout.potUserId}> and run \`/arena fund\`, then press START again.`,
      [],
      true
    );
  } catch (error) {
    return interactionMessage(`DWallet funding check failed, so Veil is refusing to start a prize Arena: ${String(error?.message || error)}`, [], true);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      const raw = await request.clone().text().catch(() => "");
      let interaction = null;
      try { interaction = JSON.parse(raw); } catch {}
      const subcommand = arenaSubcommand(interaction);
      const handledHere = subcommand === "bots" || subcommand === "payout" || subcommand === "fund" || isStartButton(interaction);

      if (handledHere) {
        if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) {
          return new Response("Bad signature", { status: 401 });
        }
        if (subcommand === "bots") return handleBotsCommand(interaction, env);
        if (subcommand === "payout") return handlePayoutCommand(interaction, env);
        if (subcommand === "fund") return handleFundCommand(interaction, env);
        if (isStartButton(interaction)) {
          const blocked = await handleStartFundingGate(interaction, env);
          if (blocked) return blocked;
        }
      }
    }

    return app.fetch(request, env, ctx);
  }
};
