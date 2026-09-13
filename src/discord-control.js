import { handleDiscordRoute as baseHandleDiscordRoute } from "./discord-worker.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";

function canManageGuild(interaction) {
  try {
    const permissions = BigInt(interaction?.member?.permissions || "0");
    return Boolean(permissions & 8n) || Boolean(permissions & 32n);
  } catch {
    return false;
  }
}

async function activeDiscordGame(interaction, env) {
  if (!env.DB) return null;
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || String(game.guildId) !== String(interaction.guild_id) || game.platform !== "discord") return null;
  return game;
}

async function handleStatus(interaction, env) {
  const game = await activeDiscordGame(interaction, env);
  if (!game) return interactionMessage("No Arena is active in this channel.", [], true);
  return interactionMessage(
    `⚔️ Arena is **${game.status}**. Round **${Number(game.round) || 0}**. **${game.aliveIds?.length || 0}/${Object.keys(game.players || {}).length}** players alive. Host: <@${game.hostId}>.`,
    [],
    true
  );
}

async function handleForceClose(interaction, env) {
  const game = await activeDiscordGame(interaction, env);
  if (!game) return interactionMessage("No active Arena exists in this channel. You can start a new one now.", [], true);
  const user = userFromInteraction(interaction);
  if (!user || (user.id !== game.hostId && !canManageGuild(interaction))) {
    return interactionMessage("Only the Arena host or a server admin can force-close it.", [], true);
  }

  game.status = "aborted";
  game.abortedAt = new Date().toISOString();
  game.abortedBy = user.id;
  game.history = Array.isArray(game.history) ? game.history : [];
  game.history.push({ type: "force_closed", byUserId: user.id, round: game.round || 0, at: game.abortedAt });
  await saveGame(env.DB, game);

  const prizeWarning = game.dwalletWinnerPayout?.status === "funded"
    ? "\n\n⚠️ This Arena had a funded DWallet prize. The Arena is closed, but that funded prize still needs to be reconciled/refunded before reuse."
    : "";
  return interactionMessage(`🛑 **Arena force-closed.** The stuck active state is cleared. A new Arena can be started in this channel immediately.${prizeWarning}`);
}

export async function handleDiscordRoute(request, env) {
  if (request.method === "POST" && request.headers.get("x-signature-ed25519")) {
    const raw = await request.clone().text().catch(() => "");
    let interaction = null;
    try { interaction = JSON.parse(raw); } catch {}
    const sub = interaction?.type === InteractionType.APPLICATION_COMMAND && interaction?.data?.name === "arena"
      ? interaction?.data?.options?.[0]?.name
      : "";
    if (sub === "status" || sub === "forceclose") {
      if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return new Response("Bad signature", { status: 401 });
      if (!interaction.guild_id) return interactionMessage("Arena controls can only be used inside a Discord server.", [], true);
      if (sub === "status") return handleStatus(interaction, env);
      return handleForceClose(interaction, env);
    }
  }
  return baseHandleDiscordRoute(request, env);
}

export { ArenaCoordinator } from "./discord-worker.js";
