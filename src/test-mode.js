import { addPlayer, eliminate, forceNextMassBrawl } from "./core/engine.js";
import { ensureSchema, loadGame, saveGame } from "./storage.js";
import { validateTelegramInitData } from "./miniapp.js";
import { telegramUserInChat } from "./telegram.js";

const TEST_BOT_BASE = 8800000000000000n;
const TEST_BOT_NAMES = [
  "TEST // Drop Goblin",
  "TEST // Wallet Gremlin",
  "TEST // Claim Rat",
  "TEST // Ledger Lurker",
  "TEST // Peach Intern",
  "TEST // Crek Clone",
  "TEST // Bot Basement",
  "TEST // QR Menace",
  "TEST // Degen Intern",
  "TEST // Vault Thing",
  "TEST // Tip Tunnel",
  "TEST // API Closet",
  "TEST // Transaction Gremlin",
  "TEST // Notification Goblin",
  "TEST // Cold Storage Thing",
  "TEST // Rooftop Menace"
];

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function arenaTestModeEnabled(env) {
  return truthy(env?.ARENA_TEST_MODE);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function gameIdFromStartParam(value) {
  const raw = String(value || "");
  return raw.startsWith("arena_") ? raw.slice(6) : null;
}

function isTestBot(player) {
  return Boolean(player?.testBot || player?.simulated === "qa_bot");
}

function testBotId(index) {
  return (TEST_BOT_BASE + BigInt(index + 1)).toString();
}

function markTestGame(game) {
  game.testMode = {
    ...(game.testMode || {}),
    enabled: true,
    qa: true,
    simulatedCrowd: true
  };
  return game;
}

function appendDisplay(game, text) {
  if (!Array.isArray(game.displayLog)) game.displayLog = [];
  game.displayLog.push({
    round: Number(game.round) || 0,
    text: String(text),
    at: new Date().toISOString()
  });
}

async function registrationIds(db, game) {
  const ids = new Set(Object.keys(game.players || {}));
  try {
    const rows = await db.prepare("SELECT user_id FROM arena_registrations WHERE game_id = ?").bind(game.id).all();
    for (const row of rows?.results || []) ids.add(String(row.user_id));
  } catch {}
  return ids;
}

function addQaBots(game, count) {
  if (game.status !== "registration") throw new Error("QA bots can only be added during registration.");
  const requested = Math.max(0, Math.min(24, Math.floor(Number(count) || 0)));
  let added = 0;
  for (let i = 0; i < 50 && added < requested; i++) {
    const id = testBotId(i);
    if (game.players?.[id]) continue;
    const displayName = TEST_BOT_NAMES[i % TEST_BOT_NAMES.length] + (i >= TEST_BOT_NAMES.length ? ` ${Math.floor(i / TEST_BOT_NAMES.length) + 1}` : "");
    addPlayer(game, { id, username: `arena_test_bot_${i + 1}`, displayName });
    game.players[id].testBot = true;
    game.players[id].simulated = "qa_bot";
    added++;
  }
  markTestGame(game);
  return added;
}

function removeQaBots(game) {
  if (game.status !== "registration") throw new Error("QA bots can only be removed during registration.");
  const botIds = Object.values(game.players || {}).filter(isTestBot).map(p => p.id);
  for (const id of botIds) {
    delete game.players[id];
    game.aliveIds = (game.aliveIds || []).filter(x => x !== id);
    game.eliminatedIds = (game.eliminatedIds || []).filter(x => x !== id);
  }
  return botIds.length;
}

function nextRound(current, predicate) {
  let round = Math.max(0, Number(current) || 0) + 1;
  while (!predicate(round)) round++;
  return round;
}

function nextNormalFeatureEligibleRound(current) {
  return nextRound(current, r => r % 5 !== 0 && r % 7 !== 0);
}

function nextCommunityRound(current) {
  return nextRound(current, r => r % 5 === 0 && r % 7 !== 0);
}

function nextRevivalRound(current) {
  return nextRound(current, r => r % 7 === 0);
}

function requireRunning(game) {
  if (game.status !== "running") throw new Error("Start the QA Arena first.");
}

function requireFeaturePlayers(game) {
  if ((game.aliveIds || []).length <= 5) throw new Error("Feature rounds are disabled at Final Five. Start a fresh test or add more bots before START.");
}

function aliveTestBots(game) {
  return (game.aliveIds || []).filter(id => isTestBot(game.players?.[id]));
}

function triggerSharedPreview(game, type, text) {
  game.testPreview = {
    type,
    nonce: crypto.randomUUID(),
    at: Date.now()
  };
  if (text) appendDisplay(game, text);
}

async function wakeCoordinator(env, game) {
  if (!env.ARENA_COORDINATOR || !game?.channelId) return;
  const id = env.ARENA_COORDINATOR.idFromName(game.channelId);
  const stub = env.ARENA_COORDINATOR.get(id);
  await stub.fetch("https://arena.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "wake", channelId: game.channelId, platform: "telegram" })
  });
}

async function authenticate(request, env) {
  if (!arenaTestModeEnabled(env)) throw new Error("Arena Test Mode is disabled on this Worker.");
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram Test Mode is not configured.");
  const initData = request.headers.get("x-telegram-init-data") || "";
  const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth.chatType || !["group", "supergroup"].includes(auth.chatType)) throw new Error("Open the QA Arena from the test Telegram group.");
  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const gameId = String(body.gameId || url.searchParams.get("game") || gameIdFromStartParam(auth.startParam) || "");
  if (!gameId) throw new Error("Missing QA Arena ID.");
  const launched = gameIdFromStartParam(auth.startParam);
  if (launched && launched !== gameId) throw new Error("That QA control does not match this Arena launch.");
  await ensureSchema(env.DB);
  const game = await loadGame(env.DB, gameId);
  if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That QA Arena no longer exists.");
  if (game.telegramChatInstance && auth.chatInstance !== game.telegramChatInstance) throw new Error("Open this Arena from its original test-group message.");
  if (!await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN)) throw new Error("Only members of the test Telegram can use QA controls.");
  return { auth, game, body };
}

function stateSummary(game, isHost, registrationPlayerCount = null) {
  const bots = Object.values(game.players || {}).filter(isTestBot);
  return {
    enabled: true,
    isHost,
    status: game.status,
    round: Number(game.round) || 0,
    aliveCount: (game.aliveIds || []).length,
    playerCount: registrationPlayerCount ?? Object.keys(game.players || {}).length,
    botCount: bots.length,
    simulatedCrowd: Boolean(game.testMode?.simulatedCrowd),
    preview: game.testPreview || null
  };
}

export async function handleTelegramTestMode(request, env) {
  try {
    const { auth, game, body } = await authenticate(request, env);
    const isHost = String(auth.user.id) === String(game.hostId);
    let playerCount = null;
    if (game.status === "registration") playerCount = (await registrationIds(env.DB, game)).size;

    if (request.method === "GET") {
      return json({ ok: true, test: stateSummary(game, isHost, playerCount) });
    }

    if (!isHost) throw new Error("Only the Arena host gets the QA controls.");
    const action = String(body.action || "");
    if (!action) throw new Error("Missing QA action.");
    markTestGame(game);
    let message = "QA action complete.";
    let shouldWake = false;

    if (action === "add_bots") {
      const added = addQaBots(game, body.count ?? 4);
      message = `Added ${added} QA bot${added === 1 ? "" : "s"}.`;
    } else if (action === "fill_12") {
      const ids = await registrationIds(env.DB, game);
      const need = Math.max(0, 12 - ids.size);
      const added = addQaBots(game, need);
      message = added ? `Filled the test roster to ${ids.size + added} players.` : "Roster is already at 12+ players.";
    } else if (action === "remove_bots") {
      const removed = removeQaBots(game);
      message = `Removed ${removed} QA bot${removed === 1 ? "" : "s"}.`;
    } else if (action === "next_round") {
      requireRunning(game);
      shouldWake = true;
      message = "Next round forced now.";
    } else if (action === "mass_brawl") {
      requireRunning(game);
      requireFeaturePlayers(game);
      if ((game.aliveIds || []).length < 6) throw new Error("Mass Brawl needs at least 6 alive players.");
      const round = nextNormalFeatureEligibleRound(game.round);
      game.round = round - 1;
      forceNextMassBrawl(game);
      shouldWake = true;
      message = `Mass Brawl forced for round ${round}.`;
    } else if (action === "community_showdown") {
      requireRunning(game);
      requireFeaturePlayers(game);
      const round = nextCommunityRound(game.round);
      game.round = round - 1;
      game.testMode.simulatedCrowd = true;
      shouldWake = true;
      message = `Community Showdown forced for round ${round}. Synthetic spectators will fill the vote.`;
    } else if (action === "revival") {
      requireRunning(game);
      requireFeaturePlayers(game);
      while ((game.eliminatedIds || []).length < 2 && (game.aliveIds || []).length > 6) {
        const botId = aliveTestBots(game)[0];
        if (!botId) break;
        eliminate(game, botId, "qa_revival_seed", null);
      }
      if ((game.eliminatedIds || []).length < 2) throw new Error("Second Chance needs 2 eliminated players. Run a few rounds first or start with more QA bots.");
      const round = nextRevivalRound(game.round);
      game.round = round - 1;
      shouldWake = true;
      message = `Second Chance forced for round ${round}.`;
    } else if (action === "final_five") {
      requireRunning(game);
      while ((game.aliveIds || []).length > 5) {
        const botId = aliveTestBots(game)[0];
        if (!botId) break;
        eliminate(game, botId, "qa_final_five", null);
      }
      if ((game.aliveIds || []).length > 5) throw new Error("Not enough QA bots remain to reach Final Five without eliminating a real tester.");
      triggerSharedPreview(game, "final_five", "QA TEST // FINAL FIVE LOCKDOWN TRIGGERED");
      message = "Final Five triggered without eliminating a real tester.";
    } else if (action === "preview_crek") {
      triggerSharedPreview(game, "crek", "QA TEST // LOCATION // CREK'S LAIR // MONITOR TAKEOVER");
      message = "Crek's Lair takeover sent to every open QA client.";
    } else if (action === "preview_peach") {
      triggerSharedPreview(game, "peach", "QA TEST // LOCATION // PEACH'S LAIR // RED BUTTON ARMED");
      message = "Peach's red-button takeover sent to every open QA client.";
    } else if (action === "preview_glitch") {
      triggerSharedPreview(game, "glitch", "💜 DWALLET GLITCH: QA SIGNAL CORRUPTED // message from later");
      message = "Rare glitch preview sent to every open QA client.";
    } else if (action === "abort") {
      game.status = "cancelled";
      game.crowdVote = null;
      triggerSharedPreview(game, "abort", "QA TEST // ARENA ABORTED // NO COOLDOWN");
      try { await env.DB.prepare("DELETE FROM arena_registrations WHERE game_id = ?").bind(game.id).run(); } catch {}
      message = "QA Arena aborted. Run /arena immediately to start a fresh one.";
    } else {
      throw new Error("Unknown QA action.");
    }

    await saveGame(env.DB, game);
    if (shouldWake) await wakeCoordinator(env, game);
    playerCount = game.status === "registration" ? (await registrationIds(env.DB, game)).size : Object.keys(game.players || {}).length;
    return json({ ok: true, message, test: stateSummary(game, isHost, playerCount) });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

export function markNewTestGame(game) {
  return markTestGame(game);
}
