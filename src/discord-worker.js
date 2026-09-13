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
  registerGuildCommands,
  createChannelMessage,
  createChannelTextFile
} from "./discord.js";
import { createGame, addPlayer, removePlayer, startGame, castCrowdVote } from "./core/engine.js";
import { addFakeContestants } from "./core/simulation.js";
import {
  ensureSchema,
  saveGame,
  loadGame,
  loadActiveGameForChannel,
  loadFinishedGameForGuild,
  getGuildConfig,
  setGuildTheme,
  loadPlayerStats,
  loadArenaLeaderboard
} from "./storage.js";
import { getTheme } from "./themes/index.js";
import { rulesForTheme } from "./rules.js";
import { themeForGuild } from "./server-config.js";
import { buildArenaLog } from "./logs.js";
import { upsertSponsorship, sponsorshipSummary } from "./sponsorships.js";
import {
  normalizeDwalletAmount,
  normalizeDwalletCurrency,
  discoverDwalletPotUserId,
  verifyArenaFunding,
  fundingStatusText
} from "./dwallet-payout.js";
import { ArenaCoordinator } from "./coordinator.js";

export { ArenaCoordinator };

function playerList(game) {
  const players = Object.values(game.players || {});
  if (!players.length) return "Nobody has entered yet.";
  return players.map((p, i) => `${i + 1}. **${p.displayName}**`).join("\n");
}

function prizeLine(game) {
  const p = game?.dwalletWinnerPayout;
  if (!p) return "";
  if (p.status === "funded") return `\n\n💜 **WINNER PRIZE: ${p.amount} ${p.currency} — FUNDED**`;
  return `\n\n💜 **WINNER PRIZE: ${p.amount} ${p.currency} — AWAITING HOST FUNDING**`;
}

function registrationMessage(game) {
  const theme = getTheme(game.themeId);
  const sponsor = sponsorshipSummary(game);
  return `# ${theme.labels.arena}\nRegistration is open.\n🎭 **SERVER THEME: ${theme.displayName}**\n\n${playerList(game)}\n\n**${Object.keys(game.players || {}).length} entered**${prizeLine(game)}${sponsor ? `\n\n${sponsor}` : ""}`;
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
  const select = {
    type: 3,
    custom_id: `arena:vote_cast:${game.id}:${safe}`,
    placeholder: "Choose a player...",
    min_values: 1,
    max_values: 1,
    options: ids.map(id => ({ label: game.players[id]?.displayName?.slice(0, 100) || "Unknown", value: id }))
  };
  const rows = [{ type: 1, components: [select] }];
  if (total > 1) rows.push(actionRow(
    button(`arena:vote_open:${game.id}:${safe - 1}`, "PREV", 2, safe === 0),
    button(`arena:vote_open:${game.id}:${safe + 1}`, "NEXT", 2, safe >= total - 1)
  ));
  return { rows, page: safe, totalPages: total };
}

async function kickCoordinator(env, channelId, action = "kick") {
  if (!env.ARENA_COORDINATOR) throw new Error("Arena coordinator binding is missing.");
  const id = env.ARENA_COORDINATOR.idFromName(channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, channelId, platform: "discord" })
  });
}

async function themeIdForGuild(env, guildId) {
  const config = await getGuildConfig(env.DB, guildId);
  const themeId = themeForGuild(guildId, config.theme_id);
  if (themeId !== config.theme_id) await setGuildTheme(env.DB, guildId, themeId);
  return themeId;
}

async function requireHostRegistration(interaction, env, purpose) {
  if (!interaction.guild_id) return { error: interactionMessage(`Arena ${purpose} can only be used inside a server.`, [], true) };
  if (!env.DB) return { error: interactionMessage("Arena database is not configured yet.", [], true) };
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || game.guildId !== interaction.guild_id) return { error: interactionMessage("Start an Arena registration first with `/arena start`.", [], true) };
  if (game.status !== "registration") return { error: interactionMessage(`Arena ${purpose} can only be changed while registration is open.`, [], true) };
  const user = userFromInteraction(interaction);
  if (!user || user.id !== game.hostId) return { error: interactionMessage(`Only the Arena host can change ${purpose}.`, [], true) };
  return { game, user };
}

async function handlePayout(interaction, env) {
  const context = await requireHostRegistration(interaction, env, "winner payout");
  if (context.error) return context.error;
  if (!env.DWALLET_API_KEY) return interactionMessage("DWallet winner payouts are not configured on this Worker yet.", [], true);
  const { game, user } = context;
  if (["funded", "sending", "paid", "refunded"].includes(game.dwalletWinnerPayout?.status)) {
    return interactionMessage("That Arena prize is already funded and can no longer be changed.", [], true);
  }
  const sub = interaction.data?.options?.[0];
  const amountRaw = sub?.options?.find(x => x.name === "amount")?.value;
  const currencyRaw = sub?.options?.find(x => x.name === "currency")?.value;
  try {
    const amount = normalizeDwalletAmount(amountRaw);
    const currency = normalizeDwalletCurrency(currencyRaw);
    const potUserId = await discoverDwalletPotUserId(env);
    if (!potUserId) {
      return interactionMessage("Veil cannot identify the DWallet prize-pot account yet. Set `DWALLET_POT_USER_ID` on the Worker to the Discord user ID linked to this DWallet API key, then run `/arena payout` again.", [], true);
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
      `💜 **Winner prize created — funding required.**\n\n🏆 Prize: **${amount} ${currency}**\nHost: **${user.displayName}**\nPrize pot: <@${potUserId}>\n\nUse DWallet to send **exactly ${amount} ${currency}** from your own DWallet balance to <@${potUserId}>. Then run \`/arena fund\`.\n\nVeil will not allow this Arena to START until that incoming DWallet tip from **your Discord user ID** is confirmed.`
    );
  } catch (error) {
    return interactionMessage(String(error?.message || error), [], true);
  }
}

async function handleFund(interaction, env) {
  const context = await requireHostRegistration(interaction, env, "prize funding");
  if (context.error) return context.error;
  const { game } = context;
  if (!game.dwalletWinnerPayout) return interactionMessage("Set the winner prize first with `/arena payout`.", [], true);
  try {
    const payout = await verifyArenaFunding(env, game, saveGame);
    if (payout?.status === "funded") {
      return interactionMessage(`✅ **WINNER PRIZE FUNDED**\n\n🏆 **${payout.amount} ${payout.currency}** is now locked in the Arena pot.${payout.fundingTipId ? `\nIncoming DWallet tip: **#${payout.fundingTipId}**` : ""}\n\nThe Arena can start. When a real player wins, Veil automatically sends that exact prize to their DWallet account.`);
    }
    return interactionMessage(fundingStatusText(game) || "⏳ Host funding has not been confirmed yet.", [], true);
  } catch (error) {
    return interactionMessage(`DWallet funding check failed: ${String(error?.message || error)}`, [], true);
  }
}

async function handleBots(interaction, env) {
  const context = await requireHostRegistration(interaction, env, "bots");
  if (context.error) return context.error;
  const { game } = context;
  const sub = interaction.data?.options?.[0];
  const requested = Math.max(1, Math.min(50, Math.floor(Number(sub?.options?.find(x => x.name === "amount")?.value) || 10)));
  const existing = Object.values(game.players || {}).filter(p => p?.simulated).length;
  const amount = Math.min(requested, Math.max(0, 50 - existing));
  if (!amount) return interactionMessage("This Arena already has the maximum of **50 bots**.", [], true);
  const ids = addFakeContestants(game, amount);
  await saveGame(env.DB, game);
  return interactionMessage(`🤖 **${ids.length} bot${ids.length === 1 ? "" : "s"} added.**\n\n${registrationMessage(game)}`);
}

async function handleSponsor(interaction, env) {
  if (!interaction.guild_id || !env.DB) return interactionMessage("Arena sponsorships can only be set inside a server.", [], true);
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game || game.status !== "registration") return interactionMessage("Open an Arena registration first.", [], true);
  const user = userFromInteraction(interaction);
  const sub = interaction.data?.options?.[0];
  const raw = {};
  for (const option of sub?.options || []) raw[option.name] = option.value;
  try {
    upsertSponsorship(game, user, raw);
    await saveGame(env.DB, game);
    return interactionMessage(`💸 Sponsorship updated.\n\n${sponsorshipSummary(game)}`);
  } catch (error) {
    return interactionMessage(String(error?.message || error), [], true);
  }
}

async function handleArenaCommand(interaction, env) {
  if (!interaction.guild_id) return interactionMessage("Arena can only run inside a server.", [], true);
  if (!env.DB) return interactionMessage("Arena database is not configured yet.", [], true);
  await ensureSchema(env.DB);
  const option = interaction.data?.options?.[0];
  const sub = option?.name || "start";
  const channelId = interaction.channel_id;
  const guildId = interaction.guild_id;
  const user = userFromInteraction(interaction);

  if (sub === "payout") return handlePayout(interaction, env);
  if (sub === "fund") return handleFund(interaction, env);
  if (sub === "bots") return handleBots(interaction, env);
  if (sub === "sponsor") return handleSponsor(interaction, env);
  if (sub === "rules") {
    const themeId = await themeIdForGuild(env, guildId);
    await createChannelMessage(channelId, env.DISCORD_BOT_TOKEN, { content: rulesForTheme(themeId) });
    return interactionMessage("📜 Arena rules posted.", [], true);
  }

  let game = await loadActiveGameForChannel(env.DB, channelId);
  if (sub === "start") {
    if (game) return interactionMessage("There is already an Arena game active in this channel.", [], true);
    const themeId = await themeIdForGuild(env, guildId);
    game = createGame({ guildId, channelId, hostId: user.id, themeId, platform: "discord" });
    addPlayer(game, user);
    await saveGame(env.DB, game);
    return interactionMessage(registrationMessage(game), registrationComponents(game));
  }
  return interactionMessage("Unknown Arena command.", [], true);
}

function statsText(user, stats) {
  const games = stats?.games_played || 0;
  const wins = stats?.wins || 0;
  const rate = games ? ((wins / games) * 100).toFixed(1) : "0.0";
  return `# ⚔️ ${user.displayName}'S ARENA STATS\n\n**Arenas Played:** ${games}\n**Wins:** ${wins}\n**Total Kills:** ${stats?.total_kills || 0}\n**Total Revivals:** ${stats?.total_revivals || 0}\n**Most Kills in One Arena:** ${stats?.max_kills_single_game || 0}\n**Crowd Votes Survived:** ${stats?.crowd_survivals || 0}\n**Win Rate:** ${rate}%`;
}

async function handleStats(interaction, env) {
  if (!interaction.guild_id || !env.DB) return interactionMessage("Arena stats only exist inside a server.", [], true);
  await ensureSchema(env.DB);
  const user = userFromInteraction(interaction);
  return interactionMessage(statsText(user, await loadPlayerStats(env.DB, interaction.guild_id, user.id)));
}

function boardSection(title, rows) {
  if (!rows?.length) return `**${title}**\nNo records yet.`;
  return `**${title}**\n${rows.map((r, i) => `${i + 1}. ${r.display_name} — **${r.value}**`).join("\n")}`;
}

async function handleLeaderboard(interaction, env) {
  if (!interaction.guild_id || !env.DB) return interactionMessage("Arena leaderboards only exist inside a server.", [], true);
  await ensureSchema(env.DB);
  const b = await loadArenaLeaderboard(env.DB, interaction.guild_id, 5);
  return interactionMessage([
    "# 🏆 ARENA LEADERBOARD",
    boardSection("⚔️ MOST ARENAS PLAYED", b.gamesPlayed),
    boardSection("👑 MOST WINS", b.wins),
    boardSection("💀 TOTAL KILLS", b.kills),
    boardSection("🕯️ TOTAL REVIVALS", b.revivals),
    boardSection("🔥 MOST KILLS IN ONE ARENA", b.singleGameKills),
    boardSection("👁️ CROWD VOTES SURVIVED", b.crowdSurvivals)
  ].join("\n\n"));
}

async function handleLog(interaction, env) {
  if (!interaction.guild_id || !env.DB) return interactionMessage("Arena logs only exist inside a server.", [], true);
  await ensureSchema(env.DB);
  const requested = Math.max(1, Number(interaction.data?.options?.find(x => x.name === "match")?.value || 1));
  const game = await loadFinishedGameForGuild(env.DB, interaction.guild_id, requested - 1);
  if (!game) return interactionMessage(`I couldn't find completed Arena match #${requested} for this server.`, [], true);
  const log = buildArenaLog(game, requested);
  const filename = `arena-match-${requested}-${game.id.slice(0, 8)}.txt`;
  await createChannelTextFile(interaction.channel_id, env.DISCORD_BOT_TOKEN, filename, log, `📜 **Arena Match ${requested} narration log**`);
  return interactionMessage(`Done — I posted **Arena Match ${requested}** as a text file in this channel.`, [], true);
}

async function handleComponent(interaction, env) {
  const parts = String(interaction.data?.custom_id || "").split(":");
  const action = parts[1];
  const gameId = parts[2];
  const user = userFromInteraction(interaction);
  if (!gameId || !user || !env.DB) return interactionMessage("Arena couldn't read that action.", [], true);
  await ensureSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game) return interactionMessage("That Arena game no longer exists.", [], true);

  if (action === "join") {
    try { addPlayer(game, user); await saveGame(env.DB, game); return interactionUpdate(registrationMessage(game), registrationComponents(game)); }
    catch (e) { return interactionMessage(e.message, [], true); }
  }
  if (action === "leave") {
    try { removePlayer(game, user.id); await saveGame(env.DB, game); return interactionUpdate(registrationMessage(game), registrationComponents(game)); }
    catch (e) { return interactionMessage(e.message, [], true); }
  }
  if (action === "start") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can start the game.", [], true);
    if (game.dwalletWinnerPayout) {
      try {
        const payout = await verifyArenaFunding(env, game, saveGame);
        if (payout?.status !== "funded") return interactionMessage(`⛔ **This prize Arena cannot start until the pot is funded.**\n\n${fundingStatusText(game)}`, [], true);
      } catch (error) {
        return interactionMessage(`DWallet funding check failed, so Veil is refusing to start a prize Arena: ${String(error?.message || error)}`, [], true);
      }
    }
    try {
      startGame(game);
      await saveGame(env.DB, game);
      await kickCoordinator(env, game.channelId);
      const theme = getTheme(game.themeId);
      return interactionUpdate(`# ${theme.labels.arena}\nThe doors close. **${game.aliveIds.length} players** are inside.\n\nThe first round begins now.`, []);
    } catch (e) { return interactionMessage(e.message, [], true); }
  }
  if (action === "vote_open") {
    if (!game.crowdVote || game.crowdVote.status !== "open") return interactionMessage("The audience vote is closed.", [], true);
    if (game.aliveIds.includes(user.id)) return interactionMessage("You're still fighting. The audience gets this vote.", [], true);
    const { rows, page, totalPages } = voteSelect(game, Number(parts[3] || 0));
    return interactionMessage(`**Choose who enters the showdown.**\nPage ${page + 1}/${totalPages}\nYou may change your vote until voting closes.`, rows, true);
  }
  if (action === "vote_cast") {
    if (!game.crowdVote || game.crowdVote.status !== "open") return interactionMessage("The audience vote is closed.", [], true);
    if (game.aliveIds.includes(user.id)) return interactionMessage("You're still fighting. The audience gets this vote.", [], true);
    const id = interaction.data?.values?.[0];
    try { castCrowdVote(game, user.id, id); await saveGame(env.DB, game); return interactionMessage(`Vote locked on **${game.players[id]?.displayName || "Unknown"}**.`, [], true); }
    catch (e) { return interactionMessage(e.message, [], true); }
  }
  return interactionMessage("Unknown Arena action.", [], true);
}

export async function handleDiscordInteraction(request, env) {
  const raw = await request.text();
  if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return new Response("Bad signature", { status: 401 });
  const i = JSON.parse(raw);
  if (i.type === InteractionType.PING) return jsonResponse({ type: InteractionResponseType.PONG });
  if (i.type === InteractionType.APPLICATION_COMMAND) {
    if (i.data?.name === "arena") return handleArenaCommand(i, env);
    if (i.data?.name === "arenastats") return handleStats(i, env);
    if (i.data?.name === "arenaleaderboard") return handleLeaderboard(i, env);
    if (i.data?.name === "arenalog") return handleLog(i, env);
  }
  if (i.type === InteractionType.MESSAGE_COMPONENT && i.data?.custom_id?.startsWith("arena:")) return handleComponent(i, env);
  return interactionMessage("Veil doesn't know that Arena action yet.", [], true);
}

function setupPage() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Discord Setup</title><style>body{font-family:system-ui;background:#0b0910;color:#eee;max-width:620px;margin:40px auto;padding:20px}input,button{width:100%;box-sizing:border-box;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #444;background:#17131e;color:#fff}button{background:#6d36ff;border:0;font-weight:700}</style></head><body><h1>Veil Discord Setup</h1><p>Refresh Arena slash commands for one server.</p><form method="post" action="/admin/discord/register"><input name="guildId" placeholder="Discord Guild ID" required><input name="adminSecret" type="password" placeholder="ADMIN_SECRET" required><button type="submit">REGISTER DISCORD COMMANDS</button></form></body></html>`;
}

export async function handleDiscordRoute(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/setup/discord" && request.method === "GET") {
    return new Response(setupPage(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  if (url.pathname === "/admin/discord/register" && request.method === "POST") {
    const form = await request.formData();
    if (!env.ADMIN_SECRET || String(form.get("adminSecret") || "") !== String(env.ADMIN_SECRET)) return new Response("Bad admin secret", { status: 401 });
    const guildId = String(form.get("guildId") || "").trim();
    if (!/^\d{15,22}$/.test(guildId)) return new Response("Invalid Discord Guild ID", { status: 400 });
    if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_BOT_TOKEN) return new Response("Discord application credentials are missing", { status: 500 });
    const result = await registerGuildCommands(env.DISCORD_APPLICATION_ID, guildId, env.DISCORD_BOT_TOKEN);
    return new Response(`Discord commands registered for ${guildId}.\n\n${JSON.stringify(result, null, 2)}`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (request.method === "POST" && request.headers.get("x-signature-ed25519")) return handleDiscordInteraction(request, env);
  return null;
}
