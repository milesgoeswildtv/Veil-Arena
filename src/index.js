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
  registerGuildCommands
} from "./discord.js";
import {
  createGame,
  addPlayer,
  removePlayer,
  startGame,
  castCrowdVote
} from "./core/engine.js";
import { addFakeContestants, setSimulatedCrowd } from "./core/simulation.js";
import {
  ensureSchema,
  saveGame,
  loadGame,
  loadActiveGameForChannel,
  getGuildConfig
} from "./storage.js";
import { getTheme } from "./themes/index.js";
export { ArenaCoordinator } from "./coordinator.js";

const TEST_GUILD_ID = "868235267188871189";

function playerList(game) {
  const players = Object.values(game.players);
  if (!players.length) return "Nobody has entered yet.";
  return players.map((p, i) => `${i + 1}. **${p.displayName}**${p.simulated ? " *(sim)*" : ""}`).join("\n");
}

function registrationMessage(game) {
  const theme = getTheme(game.themeId);
  const testBits = [];
  if (game.testMode?.fakeContestants) testBits.push("simulated contestants");
  if (game.testMode?.simulatedCrowd) testBits.push("simulated crowd voting");
  const testLine = testBits.length ? `\n\n🧪 **TEST MODE:** ${testBits.join(" + ")}` : "";
  return `# ${theme.labels.arena}\nRegistration is open.\n\n${playerList(game)}\n\n**${Object.keys(game.players).length} entered**${testLine}`;
}

function registrationComponents(game) {
  return [
    actionRow(
      button(`arena:join:${game.id}`, "ENTER ARENA", 3, false, "⚔️"),
      button(`arena:leave:${game.id}`, "LEAVE", 2),
      button(`arena:start:${game.id}`, "START", 1, false, "▶️")
    )
  ];
}

function voteSelect(game, page = 0) {
  const perPage = 25;
  const totalPages = Math.max(1, Math.ceil(game.aliveIds.length / perPage));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const ids = game.aliveIds.slice(safePage * perPage, (safePage + 1) * perPage);
  const select = {
    type: 3,
    custom_id: `arena:vote_cast:${game.id}:${safePage}`,
    placeholder: "Choose a player...",
    min_values: 1,
    max_values: 1,
    options: ids.map(id => ({
      label: game.players[id]?.displayName?.slice(0, 100) || "Unknown",
      value: id
    }))
  };
  const rows = [{ type: 1, components: [select] }];
  if (totalPages > 1) {
    rows.push(actionRow(
      button(`arena:vote_open:${game.id}:${safePage - 1}`, "PREV", 2, safePage === 0),
      button(`arena:vote_open:${game.id}:${safePage + 1}`, "NEXT", 2, safePage >= totalPages - 1)
    ));
  }
  return { rows, page: safePage, totalPages };
}

async function kickCoordinator(env, channelId, action = "kick") {
  if (!env.ARENA_COORDINATOR) return;
  const id = env.ARENA_COORDINATOR.idFromName(channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, channelId })
  });
}

async function handleArenaCommand(interaction, env) {
  if (!interaction.guild_id) return interactionMessage("Arena can only run inside a server.", [], true);
  if (!env.DB) return interactionMessage("Arena database is not configured yet.", [], true);
  await ensureSchema(env.DB);

  const subcommand = interaction.data?.options?.[0];
  const sub = subcommand?.name || "status";
  const channelId = interaction.channel_id;
  const guildId = interaction.guild_id;
  const user = userFromInteraction(interaction);
  let game = await loadActiveGameForChannel(env.DB, channelId);

  if (sub === "start") {
    if (game) return interactionMessage("There is already an Arena game active in this channel.", [], true);
    const config = await getGuildConfig(env.DB, guildId);
    game = createGame({ guildId, channelId, hostId: user.id, themeId: config.theme_id });
    addPlayer(game, user);
    await saveGame(env.DB, game);
    return interactionMessage(registrationMessage(game), registrationComponents(game));
  }

  if (sub === "cancel") {
    if (!game) return interactionMessage("There is no active Arena game here.", [], true);
    if (game.hostId !== user.id) return interactionMessage("Only the Arena host can cancel this game.", [], true);
    game.status = "cancelled";
    await saveGame(env.DB, game);
    return interactionMessage("Arena cancelled.", [], true);
  }

  if (sub === "testfill") {
    if (!game) return interactionMessage("Start an Arena lobby first with `/arena start`.", [], true);
    if (game.hostId !== user.id) return interactionMessage("Only the Arena host can use test mode.", [], true);
    if (game.status !== "registration") return interactionMessage("Fake contestants can only be added before the match starts.", [], true);
    const count = subcommand?.options?.find(option => option.name === "count")?.value ?? 20;
    const added = addFakeContestants(game, count);
    await saveGame(env.DB, game);
    return interactionMessage(`🧪 Added **${added.length} simulated contestants**. The lobby now has **${game.aliveIds.length} players**.`, [], true);
  }

  if (sub === "testcrowd") {
    if (!game) return interactionMessage("Start an Arena lobby first with `/arena start`.", [], true);
    if (game.hostId !== user.id) return interactionMessage("Only the Arena host can use test mode.", [], true);
    const enabled = Boolean(subcommand?.options?.find(option => option.name === "enabled")?.value);
    setSimulatedCrowd(game, enabled);
    await saveGame(env.DB, game);
    return interactionMessage(`🧪 Simulated crowd voting is now **${enabled ? "ON" : "OFF"}**.`, [], true);
  }

  if (!game) return interactionMessage("There is no active Arena game in this channel.", [], true);

  const alive = game.aliveIds.length;
  const eliminated = game.eliminatedIds.length;
  const testStatus = game.testMode?.simulatedCrowd || game.testMode?.fakeContestants
    ? `\nTest mode: **${game.testMode?.fakeContestants ? "fake contestants" : ""}${game.testMode?.fakeContestants && game.testMode?.simulatedCrowd ? " + " : ""}${game.testMode?.simulatedCrowd ? "simulated crowd" : ""}**`
    : "";
  return interactionMessage(`**Arena status**\nRound: **${game.round}**\nAlive: **${alive}**\nEliminated: **${eliminated}**\nStatus: **${game.status}**${testStatus}`, [], true);
}

async function handleComponent(interaction, env) {
  const customId = interaction.data?.custom_id || "";
  const parts = customId.split(":");
  const action = parts[1];
  const gameId = parts[2];
  const user = userFromInteraction(interaction);
  if (!gameId || !user || !env.DB) return interactionMessage("Arena couldn't read that action.", [], true);
  await ensureSchema(env.DB);

  const game = await loadGame(env.DB, gameId);
  if (!game) return interactionMessage("That Arena game no longer exists.", [], true);

  if (action === "join") {
    try {
      addPlayer(game, user);
      await saveGame(env.DB, game);
      return interactionUpdate(registrationMessage(game), registrationComponents(game));
    } catch (error) {
      return interactionMessage(error.message, [], true);
    }
  }

  if (action === "leave") {
    try {
      removePlayer(game, user.id);
      await saveGame(env.DB, game);
      return interactionUpdate(registrationMessage(game), registrationComponents(game));
    } catch (error) {
      return interactionMessage(error.message, [], true);
    }
  }

  if (action === "start") {
    if (user.id !== game.hostId) return interactionMessage("Only the Arena host can start the game.", [], true);
    try {
      startGame(game);
      await saveGame(env.DB, game);
      await kickCoordinator(env, game.channelId, "kick");
      const theme = getTheme(game.themeId);
      const simLine = game.testMode?.simulatedCrowd ? "\n🧪 Simulated spectators are watching too." : "";
      return interactionUpdate(`# ${theme.labels.arena}\nThe doors close. **${game.aliveIds.length} players** are inside.${simLine}\n\nThe first round begins now.`, []);
    } catch (error) {
      return interactionMessage(error.message, [], true);
    }
  }

  if (action === "vote_open") {
    if (!game.crowdVote || game.crowdVote.status !== "open") {
      return interactionMessage("The audience vote is closed.", [], true);
    }
    if (game.aliveIds.includes(user.id)) {
      return interactionMessage("You're still fighting. The audience gets this vote.", [], true);
    }
    const requestedPage = Number(parts[3] || 0);
    const { rows, page, totalPages } = voteSelect(game, requestedPage);
    return interactionMessage(`**Choose who enters the Final Scare.**\nPage ${page + 1}/${totalPages}\nYou may change your vote until voting closes.`, rows, true);
  }

  if (action === "vote_cast") {
    if (!game.crowdVote || game.crowdVote.status !== "open") {
      return interactionMessage("The audience vote is closed.", [], true);
    }
    if (game.aliveIds.includes(user.id)) {
      return interactionMessage("You're still fighting. The audience gets this vote.", [], true);
    }
    const playerId = interaction.data?.values?.[0];
    try {
      castCrowdVote(game, user.id, playerId);
      await saveGame(env.DB, game);
      return interactionMessage(`Vote locked on **${game.players[playerId]?.displayName || "Unknown"}**. You can change it before time runs out.`, [], true);
    } catch (error) {
      return interactionMessage(error.message, [], true);
    }
  }

  return interactionMessage("Unknown Arena action.", [], true);
}

async function handleDiscord(request, env) {
  const rawBody = await request.text();
  const valid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, rawBody);
  if (!valid) return new Response("Bad signature", { status: 401 });
  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }
  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "arena") {
    return handleArenaCommand(interaction, env);
  }
  if (interaction.type === InteractionType.MESSAGE_COMPONENT && interaction.data?.custom_id?.startsWith("arena:")) {
    return handleComponent(interaction, env);
  }
  return interactionMessage("Veil doesn't know that Arena action yet.", [], true);
}

async function handleRegister(request, env) {
  const provided = request.headers.get("x-admin-secret");
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) return new Response("Unauthorized", { status: 401 });
  if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_BOT_TOKEN) return jsonResponse({ ok: false, error: "Discord credentials missing" }, 500);
  const body = await request.json().catch(() => ({}));
  if (!body.guildId) return jsonResponse({ ok: false, error: "guildId required" }, 400);
  const commands = await registerGuildCommands(env.DISCORD_APPLICATION_ID, body.guildId, env.DISCORD_BOT_TOKEN);
  return jsonResponse({ ok: true, commands });
}

async function handleTestGuildRegister(env) {
  if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_BOT_TOKEN) {
    return new Response("Discord credentials are missing.", { status: 500 });
  }
  const commands = await registerGuildCommands(env.DISCORD_APPLICATION_ID, TEST_GUILD_ID, env.DISCORD_BOT_TOKEN);
  const arena = commands?.find?.(command => command.name === "arena");
  const names = arena?.options?.map?.(option => option.name).join(", ") || "arena";
  return new Response(`Arena registered to test server. Commands: ${names}\n\nYou can close this page and return to Discord.`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "veil-arena",
        status: "ready",
        database: Boolean(env.DB),
        coordinator: Boolean(env.ARENA_COORDINATOR),
        discordConfigured: Boolean(env.DISCORD_PUBLIC_KEY && env.DISCORD_BOT_TOKEN && env.DISCORD_APPLICATION_ID)
      });
    }

    if (url.pathname === "/interactions" && request.method === "POST") {
      return handleDiscord(request, env);
    }

    if (url.pathname === "/admin/register" && request.method === "POST") {
      return handleRegister(request, env);
    }

    // Temporary test-only convenience route. It can only register the fixed test guild above;
    // it cannot register arbitrary servers or expose credentials.
    if (url.pathname === "/test/register-arena" && request.method === "GET") {
      return handleTestGuildRegister(env);
    }

    return new Response("Veil Arena is online.", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
