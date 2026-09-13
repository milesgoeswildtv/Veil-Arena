import { handleDiscordRoute as baseHandleDiscordRoute } from "./discord-worker.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, saveGame } from "./storage.js";
import { isVeilTipAdmin, veilTipAdminEntry, sendDirectDwalletTip } from "./dwallet-direct-tip.js";
import { discordSetupPage, getDiscordSetupStatus, registerDiscordGuildFromRequest } from "./discord-setup.js";

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

function optionValue(interaction, name) {
  return interaction?.data?.options?.find(option => option.name === name)?.value;
}

async function handleVeilTip(interaction, env) {
  if (!interaction.guild_id) return interactionMessage("Use `/veiltip` inside a Discord server.", [], true);
  const user = userFromInteraction(interaction);
  if (!user) return interactionMessage("I couldn't identify who requested this tip.", [], true);

  const allowPlatformAdmin = env.VEIL_TIP_ALLOW_PLATFORM_ADMINS === "true" && canManageGuild(interaction);
  if (!isVeilTipAdmin(env, "discord", user.id) && !allowPlatformAdmin) {
    const entry = veilTipAdminEntry("discord", user.id);
    return interactionMessage(
      `You are not authorized to spend Veil's DWallet balance.\n\nYour allowlist entry is \`${entry}\`. Add it to the Cloudflare secret/variable \`VEIL_TIP_ADMIN_IDS\` (comma-separated if there are multiple approved spenders).`,
      [],
      true
    );
  }

  if (!env.DWALLET_API_KEY) return interactionMessage("Veil's DWallet API key is not configured on this Worker.", [], true);

  const recipientId = String(optionValue(interaction, "user") || "");
  const amount = optionValue(interaction, "amount");
  const currency = optionValue(interaction, "currency");
  const suppliedNote = String(optionValue(interaction, "note") || "").trim();
  if (!recipientId) return interactionMessage("Choose a Discord member to receive the tip.", [], true);

  const resolvedUser = interaction?.data?.resolved?.users?.[recipientId];
  const resolvedMember = interaction?.data?.resolved?.members?.[recipientId];
  const recipientName = resolvedMember?.nick || resolvedUser?.global_name || resolvedUser?.username || `Discord ${recipientId}`;
  const note = suppliedNote || `Veil direct tip authorized by ${user.displayName}`;

  try {
    const sent = await sendDirectDwalletTip(env, {
      toUserId: recipientId,
      amount,
      currency,
      note,
      guildId: interaction.guild_id,
      channelId: interaction.channel_id
    });
    return interactionMessage(
      `💜 **Veil tipped ${recipientName} ${sent.amount} ${sent.currency}.**${sent.tipId ? `\nDWallet tip #${sent.tipId}` : ""}\nAuthorized by **${user.displayName}**.`
    );
  } catch (error) {
    return interactionMessage(
      `⚠️ Veil tip failed: ${String(error?.message || error)}\n\nNo automatic retry was attempted. Check Veil's DWallet history before trying again so an ambiguous timeout cannot cause a duplicate payment.`,
      [],
      true
    );
  }
}

export async function handleDiscordRoute(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/setup/discord") {
    return new Response(await discordSetupPage(request, env), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
    });
  }
  if (request.method === "GET" && url.pathname === "/discord/health") {
    return Response.json(await getDiscordSetupStatus(request, env), { headers: { "cache-control": "no-store" } });
  }
  if (request.method === "POST" && url.pathname === "/admin/discord/register") {
    return registerDiscordGuildFromRequest(request, env);
  }

  if (request.method === "POST" && request.headers.get("x-signature-ed25519")) {
    const raw = await request.clone().text().catch(() => "");
    let interaction = null;
    try { interaction = JSON.parse(raw); } catch {}
    const isCommand = interaction?.type === InteractionType.APPLICATION_COMMAND;
    const commandName = isCommand ? interaction?.data?.name : "";
    const sub = commandName === "arena" ? interaction?.data?.options?.[0]?.name : "";
    if (sub === "status" || sub === "forceclose" || commandName === "veiltip" || commandName === "ping") {
      if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return new Response("Bad signature", { status: 401 });
      if (commandName === "ping") return interactionMessage("💜 Veil Discord interactions are online.", [], true);
      if (commandName === "veiltip") return handleVeilTip(interaction, env);
      if (!interaction.guild_id) return interactionMessage("Arena controls can only be used inside a Discord server.", [], true);
      if (sub === "status") return handleStatus(interaction, env);
      return handleForceClose(interaction, env);
    }
  }
  return baseHandleDiscordRoute(request, env);
}

export { ArenaCoordinator } from "./discord-worker.js";
