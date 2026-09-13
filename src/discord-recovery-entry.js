import app, { ArenaCoordinator } from "./test-entry.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, interactionUpdate, button, actionRow, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, loadGame, saveGame } from "./storage.js";

export { ArenaCoordinator };

function cancelControls(game) {
  return [actionRow(button(`arena:cancel_stale:${game.id}`, "CANCEL STALE REGISTRATION", 4, false, "🗑️"))];
}

async function inspectDiscordRecovery(request, env) {
  if (!env.DB || !env.DISCORD_PUBLIC_KEY) return null;
  const url = new URL(request.url);
  if (url.pathname !== "/interactions" || request.method !== "POST") return null;

  const raw = await request.clone().text();
  if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return null;
  const interaction = JSON.parse(raw);

  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "arena") {
    const sub = interaction.data?.options?.[0]?.name || "start";
    if (sub !== "start" || !interaction.channel_id) return null;

    await ensureSchema(env.DB);
    const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
    if (!game || game.status !== "registration") return null;

    const user = userFromInteraction(interaction);
    if (!user || String(user.id) !== String(game.hostId)) return null;

    return interactionMessage(
      `⚠️ **An older Arena registration is still open in this channel.**\n\nIt has **${Object.keys(game.players || {}).length} player${Object.keys(game.players || {}).length === 1 ? "" : "s"}** registered and is preventing a new Arena from opening.\n\nCanceling it does **not** count as a played Arena and does not affect stats or sponsorship payouts.`,
      cancelControls(game),
      true
    );
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT && interaction.data?.custom_id?.startsWith("arena:cancel_stale:")) {
    const gameId = interaction.data.custom_id.split(":")[2];
    const user = userFromInteraction(interaction);
    if (!gameId || !user) return interactionMessage("Arena couldn't read that recovery action.", [], true);

    await ensureSchema(env.DB);
    const game = await loadGame(env.DB, gameId);
    if (!game) return interactionUpdate("✅ That old Arena is already gone.", []);
    if (String(user.id) !== String(game.hostId)) return interactionMessage("Only the host of that registration can cancel it.", [], true);
    if (game.status !== "registration") return interactionUpdate(`That Arena is no longer waiting in registration. Current status: **${game.status}**.`, []);

    game.status = "cancelled";
    game.cancelledAt = new Date().toISOString();
    game.cancelReason = "discord_host_stale_registration_recovery";
    await saveGame(env.DB, game);

    return interactionUpdate("✅ **Old Arena registration cancelled.**\n\nNothing was added to stats. You can run `/arena start` now.", []);
  }

  return null;
}

export default {
  async fetch(request, env, ctx) {
    const recovered = await inspectDiscordRecovery(request, env);
    if (recovered) return recovered;
    return app.fetch(request, env, ctx);
  }
};
