import { createGame, addPlayer, removePlayer, startGame, castCrowdVote } from "./core/engine.js";
import { addFakeContestants } from "./core/simulation.js";
import { ensureSchema, saveGame, loadGame, loadActiveGameForChannel, getGuildConfig, setGuildTheme } from "./storage.js";
import { getTheme } from "./themes/index.js";
import { rulesForTheme } from "./rules.js";
import { upsertSponsorship, sponsorshipSummary } from "./sponsorships.js";
import {
  InteractionType,
  InteractionResponseType,
  verifyDiscordRequest,
  jsonResponse,
  interactionMessage,
  interactionUpdate,
  button,
  actionRow,
  userFromInteraction,
  canManageGuild,
  registerGuildCommands
} from "./discord.js";
import {
  normalizeDwalletAmount,
  normalizeDwalletCurrency,
  discoverDwalletPotUserId,
  verifyArenaFunding,
  fundingStatusText
} from "./dwallet-payout.js";

const validThemes = new Set(["vibe_queen_slots", "full_tilt", "dwallet"]);

function optionValue(sub, name) { return sub?.options?.find(x => x.name === name)?.value; }
function playerList(game) {
  const players = Object.values(game.players || {});
  return players.length ? players.map((p, i) => `${i + 1}. **${p.displayName}**${p.simulated ? " 🤖" : ""}`).join("\n") : "Nobody has entered yet.";
}
function registrationMessage(game) {
  const theme = getTheme(game.themeId);
  const extras = [sponsorshipSummary(game), fundingStatusText(game)].filter(Boolean).join("\n\n");
  return `# ${theme?.labels?.arena || "ARENA"}\nRegistration is open.\n🎭 **SERVER THEME: ${theme?.displayName || game.themeId}**\n\n${playerList(game)}\n\n**${Object.keys(game.players || {}).length} entered**${extras ? `\n\n${extras}` : ""}`;
}
function registrationComponents(game) {
  return [actionRow(
    button(`arena:join:${game.id}`, "ENTER ARENA", 3, false, "⚔️"),
    button(`arena:leave:${game.id}`, "LEAVE", 2),
    button(`arena:start:${game.id}`, "START", 1, false, "▶️")
  )];
}
function voteSelect(game, page = 0) {
  const per = 25;
  const total = Math.max(1, Math.ceil(game.aliveIds.length / per));
  const safe = Math.max(0, Math.min(page, total - 1));
  const ids = game.aliveIds.slice(safe * per, (safe + 1) * per);
  const rows = [{ type: 1, components: [{
    type: 3,
    custom_id: `arena:vote_cast:${game.id}:${safe}`,
    placeholder: "Choose a player...",
    min_values: 1,
    max_values: 1,
    options: ids.map(id => ({ label: game.players[id]?.displayName?.slice(0, 100) || "Unknown", value: id }))
  }] }];
  if (total > 1) rows.push(actionRow(
    button(`arena:vote_open:${game.id}:${safe - 1}`, "PREV", 2, safe === 0),
    button(`arena:vote_open:${game.id}:${safe + 1}`, "NEXT", 2, safe >= total - 1)
  ));
  return { rows, page: safe, totalPages: total };
}
async function coordinator(env, channelId, action) {
  if (!env.ARENA_COORDINATOR) return;
  const id = env.ARENA_COORDINATOR.idFromName(String(channelId));
  await env.ARENA_COORDINATOR.get(id).fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, channelId: String(channelId) })
  });
}
async function themeForGuild(env, guildId) {
  const cfg = await getGuildConfig(env.DB, guildId);
  return validThemes.has(cfg?.theme_id) ? cfg.theme_id : "vibe_queen_slots";
}
async function activeGame(interaction, env) {
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  return game && String(game.guildId) === String(interaction.guild_id) ? game : null;
}
function hostOrAdmin(interaction, game, user) { return user?.id === game.hostId || canManageGuild(interaction); }

async function handleArenaCommand(interaction, env) {
  if (!interaction.guild_id) return interactionMessage("Arena can only run inside a Discord server.", [], true);
  if (!env.DB) return interactionMessage("Arena database is not configured.", [], true);
  const sub = interaction.data?.options?.[0];
  const name = sub?.name || "start";
  const user = userFromInteraction(interaction);
  if (!user) return interactionMessage("Discord user information was missing.", [], true);
  await ensureSchema(env.DB);

  if (name === "rules") return interactionMessage(rulesForTheme(await themeForGuild(env, interaction.guild_id)), [], true);

  let game = await activeGame(interaction, env);
  if (name === "start") {
    if (game) return interactionMessage(`There is already an Arena **${game.status}** in this channel. If it is stuck, the host or a server admin can run \`/arena forceclose\`.`, [], true);
    const themeId = await themeForGuild(env, interaction.guild_id);
    game = createGame({ guildId: interaction.guild_id, channelId: interaction.channel_id, hostId: user.id, themeId, platform: "discord" });
    addPlayer(game, user);
    game.displayLog = [];
    await saveGame(env.DB, game);
    return interactionMessage(registrationMessage(game), registrationComponents(game));
  }

  if (name === "status") {
    if (!game) return interactionMessage("No Arena is active in this channel.", [], true);
    return interactionMessage(`⚔️ Arena is **${game.status}**. Round **${game.round || 0}**. **${game.aliveIds?.length || 0}/${Object.keys(game.players || {}).length}** players alive. Host: <@${game.hostId}>.`, [], true);
  }

  if (name === "forceclose") {
    if (!game) return interactionMessage("No active Arena exists in this channel. You're already clear to start another.", [], true);
    if (!hostOrAdmin(interaction, game, user)) return interactionMessage("Only the Arena host or a server admin can force-close it.", [], true);
    game.status = "aborted";
    game.abortedAt = new Date().toISOString();
    game.abortedBy = user.id;
    await saveGame(env.DB, game);
    await coordinator(env, game.channelId, "stop").catch(() => null);
    const prizeWarning = game.dwalletWinnerPayout?.status === "funded" ? "\n\n⚠️ This Arena had a funded DWallet prize. The game is closed, but that funded prize must be reconciled/refunded before reuse." : "";
    return interactionMessage(`🛑 **Arena force-closed.** The stuck active state is cleared and a new Arena can be started in this channel now.${prizeWarning}`);
  }

  if (!game) return interactionMessage("Start an Arena first with `/arena start`.", [], true);
  if (game.status !== "registration") return interactionMessage(`That can only be changed during registration. This Arena is **${game.status}**.`, [], true);

  if (name === "bots") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can add bots.", [], true);
    const amount = Math.max(1, Math.min(50, Math.floor(Number(optionValue(sub, "amount")) || 10)));
    const room = Math.max(0, 50 - Object.values(game.players || {}).filter(p => p?.simulated).length);
    if (!room) return interactionMessage("This Arena already has the maximum simulated contestants.", [], true);
    const added = addFakeContestants(game, Math.min(amount, room));
    await saveGame(env.DB, game);
    return interactionMessage(`🤖 Added **${added.length}** Arena bot${added.length === 1 ? "" : "s"}. There are now **${Object.keys(game.players).length} entrants**.`);
  }

  if (name === "sponsor") {
    const awards = {};
    for (const id of ["winner", "runner_up", "most_kills", "most_revivals", "most_showdowns", "most_mass_brawls"]) {
      const value = optionValue(sub, id);
      if (value != null) awards[id] = value;
    }
    try {
      upsertSponsorship(game, user, awards);
      await saveGame(env.DB, game);
      return interactionMessage(`💸 **Sponsorship saved.**\n\n${sponsorshipSummary(game)}`);
    } catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }

  if (name === "payout") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can configure the automatic winner payout.", [], true);
    if (!env.DWALLET_API_KEY) return interactionMessage("DWallet automatic payouts are not configured on this Worker yet.", [], true);
    if (["funded", "sending", "paid", "refunded"].includes(game.dwalletWinnerPayout?.status)) return interactionMessage("That Arena prize is already funded and locked.", [], true);
    try {
      const amount = normalizeDwalletAmount(optionValue(sub, "amount"));
      const currency = normalizeDwalletCurrency(optionValue(sub, "currency"));
      const potUserId = await discoverDwalletPotUserId(env);
      if (!potUserId) return interactionMessage("Veil cannot identify the DWallet prize-pot account. Set `DWALLET_POT_USER_ID` on the Worker first.", [], true);
      game.dwalletWinnerPayout = { amount, currency, hostId: user.id, hostName: user.displayName, potUserId, configuredAt: new Date().toISOString(), status: "awaiting_funding" };
      await saveGame(env.DB, game);
      return interactionMessage(`💜 **Winner prize created.**\n\n🏆 **${amount} ${currency}**\nSend exactly that amount from your DWallet account to <@${potUserId}>, then run \`/arena fund\`. Arena START stays locked until funding is verified.`);
    } catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }

  if (name === "fund") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can verify prize funding.", [], true);
    if (!game.dwalletWinnerPayout) return interactionMessage("Set the winner prize first with `/arena payout`.", [], true);
    try {
      const payout = await verifyArenaFunding(env, game, saveGame);
      return interactionMessage(payout?.status === "funded" ? `✅ **WINNER PRIZE FUNDED**\n\n${payout.amount} ${payout.currency} is locked. The Arena can start.` : fundingStatusText(game), [], payout?.status !== "funded");
    } catch (error) { return interactionMessage(`DWallet funding check failed: ${String(error?.message || error)}`, [], true); }
  }

  return interactionMessage("Unknown Arena command.", [], true);
}

async function handleComponent(interaction, env) {
  if (!env.DB) return interactionMessage("Arena database is not configured.", [], true);
  const parts = String(interaction.data?.custom_id || "").split(":");
  const action = parts[1], gameId = parts[2], user = userFromInteraction(interaction);
  if (!gameId || !user) return interactionMessage("Arena couldn't read that action.", [], true);
  await ensureSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "discord" || String(game.guildId) !== String(interaction.guild_id)) return interactionMessage("That Arena is no longer available in this server.", [], true);

  if (action === "join") {
    try { addPlayer(game, user); await saveGame(env.DB, game); return interactionUpdate(registrationMessage(game), registrationComponents(game)); }
    catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }
  if (action === "leave") {
    if (user.id === game.hostId) return interactionMessage("The host cannot leave their own registration. Force-close it instead if needed.", [], true);
    try { removePlayer(game, user.id); await saveGame(env.DB, game); return interactionUpdate(registrationMessage(game), registrationComponents(game)); }
    catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }
  if (action === "start") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can start the game.", [], true);
    try {
      if (game.dwalletWinnerPayout) {
        const payout = await verifyArenaFunding(env, game, saveGame);
        if (payout?.status !== "funded") return interactionMessage(`⛔ **This prize Arena cannot start until funding is verified.**\n\n${fundingStatusText(game)}\n\nRun \`/arena fund\`, then press START again.`, [], true);
      }
      startGame(game);
      await saveGame(env.DB, game);
      await coordinator(env, game.channelId, "kick");
      const theme = getTheme(game.themeId);
      return interactionUpdate(`# ${theme?.labels?.arena || "ARENA"}\nThe doors close. **${game.aliveIds.length} players** are inside.\n\nThe first round begins now.`, []);
    } catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }
  if (action === "vote_open") {
    if (!game.crowdVote || game.crowdVote.status !== "open") return interactionMessage("The audience vote is closed.", [], true);
    if (game.aliveIds.includes(user.id)) return interactionMessage("You're still fighting. Spectators get this vote.", [], true);
    const { rows, page, totalPages } = voteSelect(game, Number(parts[3] || 0));
    return interactionMessage(`**Choose who enters the showdown.** Page ${page + 1}/${totalPages}.`, rows, true);
  }
  if (action === "vote_cast") {
    if (!game.crowdVote || game.crowdVote.status !== "open") return interactionMessage("The audience vote is closed.", [], true);
    if (game.aliveIds.includes(user.id)) return interactionMessage("You're still fighting. Spectators get this vote.", [], true);
    const target = interaction.data?.values?.[0];
    try { castCrowdVote(game, user.id, target); await saveGame(env.DB, game); return interactionMessage(`Vote locked on **${game.players[target]?.displayName || "Unknown"}**.`, [], true); }
    catch (error) { return interactionMessage(String(error?.message || error), [], true); }
  }
  return interactionMessage("Unknown Arena action.", [], true);
}

async function handleDiscordInteraction(request, env) {
  const raw = await request.text();
  if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return new Response("Bad signature", { status: 401 });
  const interaction = JSON.parse(raw);
  if (interaction.type === InteractionType.PING) return jsonResponse({ type: InteractionResponseType.PONG });
  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "arena") return handleArenaCommand(interaction, env);
  if (interaction.type === InteractionType.MESSAGE_COMPONENT && String(interaction.data?.custom_id || "").startsWith("arena:")) return handleComponent(interaction, env);
  return interactionMessage("Veil doesn't know that Arena action yet.", [], true);
}

function setupPage(origin, env, message = "") {
  const yes = value => value ? "✅" : "❌";
  return `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Discord Setup</title><style>body{font-family:system-ui;background:#0e0e13;color:#fff;padding:22px}.card{max-width:680px;margin:auto;background:#191922;border:1px solid #46465b;border-radius:18px;padding:22px}input,select,button{width:100%;box-sizing:border-box;padding:13px;margin:6px 0;border-radius:10px;font-size:16px}input,select{background:#0c0c11;color:white;border:1px solid #55556b}button{background:#5865f2;color:white;border:0;font-weight:900}.code{word-break:break-all;background:#0c0c11;padding:10px;border-radius:8px}</style><body><div class="card"><h1>⚔️ Veil Discord Arena</h1><p>${yes(env.DISCORD_APPLICATION_ID)} App ID &nbsp; ${yes(env.DISCORD_BOT_TOKEN)} Bot token &nbsp; ${yes(env.DISCORD_PUBLIC_KEY)} Public key &nbsp; ${yes(env.DB)} D1</p>${message ? `<p><b>${message}</b></p>` : ""}<p><b>Interactions Endpoint URL</b></p><div class="code">${origin}/discord/interactions</div><form method="post" action="/setup/discord"><input name="guildId" inputmode="numeric" placeholder="Discord Server / Guild ID" required><select name="theme"><option value="vibe_queen_slots">Vibe Queen Slots</option><option value="full_tilt">Full Tilt</option><option value="dwallet">DWallet</option></select><input type="password" name="adminSecret" placeholder="ADMIN_SECRET" required><button>REGISTER / REFRESH COMMANDS</button></form></div></body></html>`;
}

async function setupDiscord(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET") return new Response(setupPage(url.origin, env), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  const form = await request.formData().catch(() => null);
  if (!env.ADMIN_SECRET || String(form?.get("adminSecret") || "") !== env.ADMIN_SECRET) return new Response(setupPage(url.origin, env, "❌ Unauthorized"), { status: 401, headers: { "content-type": "text/html" } });
  const guildId = String(form?.get("guildId") || "").trim();
  const theme = String(form?.get("theme") || "vibe_queen_slots");
  if (!/^\d{15,22}$/.test(guildId) || !validThemes.has(theme)) return new Response(setupPage(url.origin, env, "❌ Invalid guild ID or theme"), { status: 400, headers: { "content-type": "text/html" } });
  try {
    await ensureSchema(env.DB);
    await setGuildTheme(env.DB, guildId, theme);
    await registerGuildCommands(env.DISCORD_APPLICATION_ID, guildId, env.DISCORD_BOT_TOKEN);
    return new Response(setupPage(url.origin, env, `✅ Commands registered for guild ${guildId} with theme ${theme}.`), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    return new Response(setupPage(url.origin, env, `❌ ${String(error?.message || error)}`), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

export async function handleDiscordRoute(request, env) {
  const url = new URL(request.url);
  if ((url.pathname === "/setup/discord" || url.pathname === "/discord/setup") && ["GET", "POST"].includes(request.method)) return setupDiscord(request, env);
  if (url.pathname === "/discord/health" && request.method === "GET") return jsonResponse({ ok: Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_BOT_TOKEN && env.DISCORD_PUBLIC_KEY && env.DB), applicationId: env.DISCORD_APPLICATION_ID || null, coordinator: Boolean(env.ARENA_COORDINATOR), dwalletPayout: Boolean(env.DWALLET_API_KEY) });
  if (request.method === "POST" && (url.pathname === "/discord/interactions" || url.pathname === "/")) return handleDiscordInteraction(request, env);
  return null;
}
