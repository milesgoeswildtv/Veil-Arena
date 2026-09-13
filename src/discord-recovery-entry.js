import app, { ArenaCoordinator } from "./test-entry.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, interactionUpdate, button, actionRow, userFromInteraction } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, loadGame, saveGame } from "./storage.js";
import { addPlayer } from "./core/engine.js";

export { ArenaCoordinator };

const QA_BOT_BASE = 899900000000000000n;
const FULL_TILT_BOTS = [
  "TEST // River Rat",
  "TEST // Tilt Goblin",
  "TEST // Chip Gremlin",
  "TEST // Railbird",
  "TEST // Bad Beat",
  "TEST // Felt Menace",
  "TEST // All-In Andy",
  "TEST // Cooler Dealer",
  "TEST // Pit Gremlin",
  "TEST // Cage Rat",
  "TEST // High Limit Goblin",
  "TEST // River Demon",
  "TEST // Chip Vacuum",
  "TEST // Punted Stack",
  "TEST // Table Menace",
  "TEST // Last Card Larry"
];
const VQS_BOTS = [
  "TEST // Basement Thing",
  "TEST // Hallway Creep",
  "TEST // Static Child",
  "TEST // Red Room",
  "TEST // Door Scratcher",
  "TEST // Attic Noise",
  "TEST // Mirror Thing",
  "TEST // Night Shift"
];
const DEFAULT_BOTS = [
  "TEST // Arena Bot 01","TEST // Arena Bot 02","TEST // Arena Bot 03","TEST // Arena Bot 04",
  "TEST // Arena Bot 05","TEST // Arena Bot 06","TEST // Arena Bot 07","TEST // Arena Bot 08"
];

function botNames(themeId) {
  if (themeId === "full_tilt") return FULL_TILT_BOTS;
  if (themeId === "vibe_queen_slots") return VQS_BOTS;
  return DEFAULT_BOTS;
}

function isQaBot(player) {
  return Boolean(player?.discordTestBot || player?.simulated === "qa_bot");
}

function qaBotId(index) {
  return (QA_BOT_BASE + BigInt(index + 1)).toString();
}

function addQaBots(game, count) {
  if (game.status !== "registration") throw new Error("Test bots can only be changed during registration.");
  const requested = Math.max(0, Math.min(24, Math.floor(Number(count) || 0)));
  const names = botNames(game.themeId);
  let added = 0;
  for (let i = 0; i < 50 && added < requested; i++) {
    const id = qaBotId(i);
    if (game.players?.[id]) continue;
    const base = names[i % names.length];
    const displayName = i >= names.length ? `${base} ${Math.floor(i / names.length) + 1}` : base;
    addPlayer(game, { id, username: `discord_qa_bot_${i + 1}`, displayName });
    game.players[id].discordTestBot = true;
    game.players[id].simulated = "qa_bot";
    added++;
  }
  game.testMode = { ...(game.testMode || {}), discordQa: true };
  return added;
}

function removeQaBots(game) {
  if (game.status !== "registration") throw new Error("Test bots can only be changed during registration.");
  const ids = Object.values(game.players || {}).filter(isQaBot).map(p => p.id);
  for (const id of ids) {
    delete game.players[id];
    game.aliveIds = (game.aliveIds || []).filter(x => x !== id);
    game.eliminatedIds = (game.eliminatedIds || []).filter(x => x !== id);
  }
  return ids.length;
}

function qaSummary(game) {
  const players = Object.values(game.players || {});
  const bots = players.filter(isQaBot).length;
  const humans = players.length - bots;
  return `🧪 **DISCORD TEST ROSTER**\n\n**Humans:** ${humans}\n**Test Bots:** ${bots}\n**Total:** ${players.length}\n\nTest bots are real Arena engine participants. They can eliminate, die, revive, enter special rounds, and win. They never count toward player stats.`;
}

function qaControls(game) {
  return [
    actionRow(
      button(`arena:qa_add4:${game.id}`, "ADD 4 TEST BOTS", 2, false, "🤖"),
      button(`arena:qa_fill12:${game.id}`, "FILL TO 12", 1, false, "🧪"),
      button(`arena:qa_remove:${game.id}`, "REMOVE BOTS", 2, false, "🧹")
    ),
    actionRow(
      button(`arena:start:${game.id}`, "START ARENA", 3, false, "▶️"),
      button(`arena:cancel_stale:${game.id}`, "CANCEL REGISTRATION", 4, false, "🗑️")
    )
  ];
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

    return interactionMessage(qaSummary(game), qaControls(game), true);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id || "";
    const parts = customId.split(":");
    const action = parts[1];
    const gameId = parts[2];
    if (!["qa_add4", "qa_fill12", "qa_remove", "cancel_stale"].includes(action)) return null;

    const user = userFromInteraction(interaction);
    if (!gameId || !user) return interactionMessage("Arena couldn't read that test action.", [], true);

    await ensureSchema(env.DB);
    const game = await loadGame(env.DB, gameId);
    if (!game) return interactionUpdate("✅ That Arena is already gone.", []);
    if (String(user.id) !== String(game.hostId)) return interactionMessage("Only the Arena host can use the Discord test controls.", [], true);
    if (game.status !== "registration") return interactionUpdate(`That Arena is no longer in registration. Current status: **${game.status}**.`, []);

    if (action === "qa_add4") {
      addQaBots(game, 4);
      await saveGame(env.DB, game);
      return interactionUpdate(qaSummary(game), qaControls(game));
    }

    if (action === "qa_fill12") {
      const need = Math.max(0, 12 - Object.keys(game.players || {}).length);
      addQaBots(game, need);
      await saveGame(env.DB, game);
      return interactionUpdate(qaSummary(game), qaControls(game));
    }

    if (action === "qa_remove") {
      removeQaBots(game);
      await saveGame(env.DB, game);
      return interactionUpdate(qaSummary(game), qaControls(game));
    }

    game.status = "cancelled";
    game.cancelledAt = new Date().toISOString();
    game.cancelReason = "discord_host_registration_cancel";
    await saveGame(env.DB, game);
    return interactionUpdate("✅ **Arena registration cancelled.**\n\nNothing was added to stats. You can run `/arena start` now.", []);
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
