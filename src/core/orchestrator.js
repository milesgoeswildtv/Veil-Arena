import {
  beginNextRound,
  resolveNormalRound,
  resolveRevivalPit,
  openCrowdVote,
  resolveCrowdVote,
  checkWinner,
  specialEventsEnabled
} from "./engine.js";
import { castSimulatedCrowdVotes } from "./simulation.js";
import { getTheme, chooseNarration } from "../themes/index.js";
import { buildMassBrawl } from "../themes/brawls.js";
import { payoutReportText } from "../sponsorships.js";

export const CROWD_VOTE_MS = 30_000;
export const RARE_EVENT_CHANCE = 0.035;

const playerName = (game, id) => game.players[id]?.displayName || "Unknown";
const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const themeIcon = theme => theme.id === "full_tilt" ? "🎰" : theme.id === "dwallet" ? "💜" : "👻";

function delayFor(isBrawl, rng) {
  const base = isBrawl ? 14_000 : 12_000;
  return base + Math.floor(rng() * 2_001);
}

function rarePrefix(theme) {
  if (theme.id === "full_tilt") return "🎰 RARE FULL TILT BULLSHIT: ";
  if (theme.id === "dwallet") return "💜 DWALLET GLITCH: ";
  return "📼 SOMETHING IS VERY FUCKING WRONG: ";
}

function styledNames(text, game, deadIds = []) {
  let out = String(text || "");
  const dead = new Set(deadIds);
  const players = Object.values(game.players).sort((a, b) => b.displayName.length - a.displayName.length);
  for (const player of players) {
    const re = new RegExp(`(?<![\\w*~])${esc(player.displayName)}(?![\\w*~])`, "gi");
    out = out.replace(re, match => dead.has(player.id) ? `~~***${match}***~~` : `***${match}***`);
  }
  return out;
}

function styleEventNarration(text, game, deadIds = []) {
  if (!deadIds.length) return styledNames(text, game);
  let out = String(text || "");
  const dead = new Set(deadIds);
  const players = Object.values(game.players).sort((a, b) => b.displayName.length - a.displayName.length);
  for (const player of players) {
    const re = new RegExp(`(?<![\\w*~])${esc(player.displayName)}(?![\\w*~])`, "gi");
    let seen = 0;
    out = out.replace(re, match => {
      if (!dead.has(player.id)) return `***${match}***`;
      seen += 1;
      return seen === 1 ? `***${match}***` : `~~***${match}***~~`;
    });
  }
  return out;
}

function recent(game) {
  return game.history.filter(item => item?.narrationTemplate).slice(-150).map(item => item.narrationTemplate);
}

function remember(game, template) {
  if (template) game.history.push({ type: "narration_used", narrationTemplate: template, round: game.round });
}

function rememberDisplayed(game, text) {
  if (!text) return;
  if (!Array.isArray(game.displayLog)) game.displayLog = [];
  game.displayLog.push({ round: game.round, text, at: new Date().toISOString() });
}

function normalText(game, theme, result, rng) {
  const ids = result.actorIds || [];
  const killer = ids[0] ? playerName(game, ids[0]) : "Someone";
  const victim = ids[1] ? playerName(game, ids[1]) : killer;
  const useRare = Boolean(theme.rareEvents?.length) && rng() < RARE_EVENT_CHANCE;
  const pool = useRare ? "rareEvents" : "normalEvents";
  const pick = chooseNarration(
    theme,
    pool,
    { killer, victim, third: ids[2] ? playerName(game, ids[2]) : "someone else" },
    rng,
    recent(game)
  );
  remember(game, pick.template);
  return `${useRare ? rarePrefix(theme) : ""}${styledNames(pick.text, game)}`;
}

function beatText(game, theme, result, number, rng) {
  if (!result.eliminatedIds?.length) return `${number}\\. ${normalText(game, theme, result, rng)}`;
  const victimId = result.eliminatedIds[0];
  const victim = playerName(game, victimId);
  if (result.type === "self_elimination") {
    const pick = chooseNarration(theme, "selfKills", { victim }, rng, recent(game));
    remember(game, pick.template);
    return `${number}\\. \n${styleEventNarration(pick.text, game, [victimId])}`;
  }
  const actorId = result.actorIds.find(id => id !== victimId) || result.actorIds[0];
  const killer = playerName(game, actorId);
  const pick = chooseNarration(theme, "playerKills", { killer, victim }, rng, recent(game));
  remember(game, pick.template);
  return `${number}\\. \n${styleEventNarration(pick.text, game, [victimId])}`;
}

function roundText(game, theme, batch, rng) {
  const icon = themeIcon(theme);
  if (batch.type === "mass_brawl") {
    const participants = batch.participantIds.map(id => playerName(game, id));
    const survivors = batch.survivorIds.map(id => playerName(game, id));
    const eliminated = batch.eliminatedIds.map(id => playerName(game, id));
    const raw = buildMassBrawl(theme.id, participants, survivors, rng);
    const story = styleEventNarration(raw, game, batch.eliminatedIds);
    const deadLine = eliminated.length ? `\n\n💀 ${eliminated.map(name => `~~***${name}***~~`).join(", ")}` : "";
    return `${icon} *ROUND ${game.round} — MASS BRAWL*\n\n${story}${deadLine}\n\n## ⚔️ ${game.aliveIds.length} PLAYER${game.aliveIds.length === 1 ? "" : "S"} REMAIN`;
  }
  const body = batch.outcomes.map((result, index) => beatText(game, theme, result, index + 1, rng)).join("\n\n");
  return `${icon} *ROUND ${game.round}*\n\n${body}\n\n## ⚔️ ${game.aliveIds.length} PLAYER${game.aliveIds.length === 1 ? "" : "S"} REMAIN`;
}

function revivalText(game, theme, result, rng) {
  if (result.type === "revival_skipped") {
    return `🕯️ *${theme.labels.revival}*\nNot enough eliminated players are available.`;
  }
  const winner = playerName(game, result.winnerId);
  const loser = playerName(game, result.loserId);
  const pick = chooseNarration(theme, "revivalDuels", { winner, loser }, rng, recent(game));
  remember(game, pick.template);
  return `${themeIcon(theme)} *ROUND ${game.round} — REVIVAL*\n\n🕯️ *${theme.labels.revival}*\n${styledNames(pick.text, game)}\n⚡ **REVIVED: ${winner.toUpperCase()}**\n💀 **REMAINS ELIMINATED: ${loser.toUpperCase()}**\n\n## ⚔️ ${game.aliveIds.length} PLAYER${game.aliveIds.length === 1 ? "" : "S"} REMAIN`;
}

function crowdOpenText(game, theme) {
  let line = "THE FINAL SCARE IS OPEN";
  let instruction = "Spectators have **30 seconds**. The top two vote-getters enter a strict **1v1**. **ONE SURVIVES.**";
  if (theme.id === "full_tilt") line = "THE FINAL BET IS OPEN";
  if (theme.id === "dwallet") {
    line = "THE CHAT VOTE IS OPEN";
    instruction = "Spectators have **30 seconds**. The top two vote-getters enter a strict **1v1**. **ONE SURVIVES.**";
  }
  return `👁️ *ROUND ${game.round} — ${theme.labels.crowdVote}*\n\n${line}\n${instruction}`;
}

function crowdResultText(game, theme, result, simulatedVotes, rng) {
  const winner = playerName(game, result.survivorId);
  const losers = result.eliminatedIds.map(id => playerName(game, id));
  const pick = chooseNarration(
    theme,
    result.qualifiers.length > 2 ? "multiPins" : "pinDuels",
    { winner, loser: losers[0] || "someone" },
    rng,
    recent(game)
  );
  remember(game, pick.template);
  return `👁️ *${theme.labels.crowdPin}*${simulatedVotes ? `\n🧪 ${simulatedVotes} simulated votes.` : ""}\n${styleEventNarration(pick.text, game, result.eliminatedIds)}\n💀 **ELIMINATED: ${losers.map(name => name.toUpperCase()).join(", ")}**\n⚡ **SURVIVOR: ${winner.toUpperCase()}**\n\n## ⚔️ ${game.aliveIds.length} PLAYERS REMAIN`;
}

function finishState(game) {
  checkWinner(game);
  if (game.status !== "finished") return { finished: false, winnerId: null, payoutReport: null };
  const winnerId = game.winnerId || null;
  const winner = winnerId ? playerName(game, winnerId) : null;
  const payoutReport = payoutReportText(game) || null;
  game.payoutReport = payoutReport;
  const text = winner ? `🏆 **${winner.toUpperCase()} WINS THE ARENA.**\nThe chaos stops. One player is left.` : "The Arena ended without a winner.";
  rememberDisplayed(game, text);
  if (payoutReport) rememberDisplayed(game, payoutReport);
  return { finished: true, winnerId, winnerName: winner, text, payoutReport };
}

export function advanceArenaGame(game, { rng = Math.random } = {}) {
  if (!game || game.status !== "running") throw new Error("Arena must be running before it can advance.");
  const theme = getTheme(game.themeId);
  if (!theme) throw new Error(`Unknown Arena theme: ${game.themeId}`);

  if (game.crowdVote?.status === "open") {
    const simulatedVotes = castSimulatedCrowdVotes(game, rng);
    const result = resolveCrowdVote(game, rng);
    const text = crowdResultText(game, theme, result, simulatedVotes, rng);
    rememberDisplayed(game, text);
    const finished = finishState(game);
    return {
      type: "crowd_result",
      round: game.round,
      text,
      result,
      simulatedVotes,
      waitMs: finished.finished ? 0 : delayFor(false, rng),
      ...finished
    };
  }

  const { phases } = beginNextRound(game);
  if (!phases.length) {
    return { type: "finished", round: game.round, waitMs: 0, ...finishState(game) };
  }

  if (phases.includes("revival") && specialEventsEnabled(game)) {
    const result = resolveRevivalPit(game, rng);
    const text = revivalText(game, theme, result, rng);
    rememberDisplayed(game, text);
    const finished = finishState(game);
    return {
      type: "revival",
      round: game.round,
      text,
      result,
      waitMs: finished.finished ? 0 : delayFor(false, rng),
      ...finished
    };
  }

  if (phases.includes("crowd_vote") && specialEventsEnabled(game)) {
    const vote = openCrowdVote(game);
    if (vote) {
      const text = crowdOpenText(game, theme);
      rememberDisplayed(game, text);
      return { type: "crowd_vote_open", round: game.round, text, vote, waitMs: CROWD_VOTE_MS, finished: false };
    }
  }

  const batch = resolveNormalRound(game, rng);
  const text = roundText(game, theme, batch, rng);
  rememberDisplayed(game, text);
  const finished = finishState(game);
  return {
    type: batch.type === "mass_brawl" ? "mass_brawl" : "normal",
    round: game.round,
    text,
    result: batch,
    waitMs: finished.finished ? 0 : delayFor(batch.type === "mass_brawl", rng),
    ...finished
  };
}
