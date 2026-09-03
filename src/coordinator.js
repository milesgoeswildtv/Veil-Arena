import { beginNextRound, resolveNormalRound, resolveRevivalPit, openCrowdVote, resolveCrowdVote, checkWinner, specialEventsEnabled } from "./core/engine.js";
import { castSimulatedCrowdVotes } from "./core/simulation.js";
import { loadActiveGameForChannel, saveGame, recordFinishedGame } from "./storage.js";
import { createChannelMessage } from "./discord.js";
import { getTheme, chooseNarration } from "./themes/index.js";

const NORMAL_DELAY_MS = 8000;
const CROWD_VOTE_MS = 30000;
const RARE_EVENT_CHANCE = 0.035;
const name = (game, id) => game.players[id]?.displayName || "Unknown";
const tag = (game, id) => `**${name(game, id).toUpperCase()}**`;
function recentTemplates(game) { return game.history.filter(item => item?.narrationTemplate).slice(-150).map(item => item.narrationTemplate); }
function rememberNarration(game, template) { if (template) game.history.push({ type: "narration_used", narrationTemplate: template, round: game.round }); }

function genericNormalNarration(game, result) {
  const ids = result.actorIds || [];
  const a = ids[0] ? tag(game, ids[0]) : "**SOMEONE**";
  const b = ids[1] ? tag(game, ids[1]) : "**SOMEONE**";
  const c = ids[2] ? tag(game, ids[2]) : "**SOMEONE**";
  const map = {
    no_op: "👁️ The Arena goes unnaturally still.",
    attack: `⚔️ ${a} attacks ${b}. Both survive the exchange.`,
    counter: `↩️ ${a} attacks ${b}, but ${b} counters. Both remain in the Arena.`,
    double_team: `👥 ${a} and ${b} collapse on ${c}. Somehow, everyone survives.`,
    weapon: `🪓 ${a} finds something deeply questionable and uses it on ${b}. ${b} survives.`,
    near_elimination: `🫳 ${a} nearly eliminates ${b}, but ${b} hangs on.`,
    elimination: `💥 ${a} catches ${b} at exactly the wrong moment.`,
    self_elimination: `💀 ${a} has made an extraordinarily bad decision.`
  };
  return map[result.type] || "👁️ The Arena erupts into chaos.";
}

function themedNormalNarration(game, theme, result) {
  if (!theme?.normalEvents?.length) return genericNormalNarration(game, result);
  const ids = result.actorIds || [];
  const killer = ids[0] ? name(game, ids[0]) : "Someone";
  const victim = ids[1] ? name(game, ids[1]) : ids[0] ? name(game, ids[0]) : "someone";
  const useRare = theme.rareEvents?.length && Math.random() < RARE_EVENT_CHANCE;
  const pool = useRare ? "rareEvents" : "normalEvents";
  const picked = chooseNarration(theme, pool, { killer, victim, third: ids[2] ? name(game, ids[2]) : "someone else" }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  const prefix = useRare ? "🎰 **RARE FULL TILT BULLSHIT:** " : "";
  return `${prefix}${picked.text}`;
}

function renderBeat(game, theme, result, number) {
  if (!result.eliminatedIds?.length) return `**${number}.** ${themedNormalNarration(game, theme, result)}`;
  const victimId = result.eliminatedIds[0];
  const victim = name(game, victimId);
  if (result.type === "self_elimination") {
    const picked = chooseNarration(theme, "selfKills", { victim }, Math.random, recentTemplates(game));
    rememberNarration(game, picked.template);
    return `**${number}. 💀 SELF-ELIMINATION — ${tag(game, victimId)}**\n${picked.text}\n➡️ **ELIMINATED: ${victim.toUpperCase()}**`;
  }
  const attackerId = result.actorIds.find(id => id !== victimId) || result.actorIds[0];
  const killer = name(game, attackerId);
  const thirdId = result.actorIds.find(id => id !== victimId && id !== attackerId);
  const picked = chooseNarration(theme, "playerKills", { killer, victim, third: thirdId ? name(game, thirdId) : "someone else" }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  return `**${number}. ⚔️ ${tag(game, attackerId)} → 💀 ${tag(game, victimId)}**\n${picked.text}\n➡️ **ELIMINATED: ${victim.toUpperCase()} — BY ${killer.toUpperCase()}**`;
}

function renderRound(game, theme, batch) {
  const beats = (batch.outcomes || []).map((beat, i) => renderBeat(game, theme, beat, i + 1)).join("\n\n");
  const eliminated = batch.eliminatedIds?.length ? `\n\n💀 **ROUND ELIMINATIONS: ${batch.eliminatedIds.map(id => name(game, id).toUpperCase()).join(", ")}**` : "";
  const icon = theme.id === "full_tilt" ? "🎰" : "👻";
  return `# ${icon} ROUND ${game.round}\n${beats}${eliminated}`;
}

function renderRevival(game, theme, result) {
  if (result.type === "revival_skipped") return `# 🕯️ ═══ ${theme.labels.revival} ═══ 🕯️\n**REVIVAL EVENT**\n\nThere aren't two eliminated contestants available.`;
  const winner = name(game, result.winnerId);
  const loser = name(game, result.loserId);
  const picked = chooseNarration(theme, "revivalDuels", { winner, loser }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  return `# 🕯️ ═══ ${theme.labels.revival} ═══ 🕯️\n## ☠️ REVIVAL EVENT ☠️\n\n${tag(game, result.winnerId)}\n### VS\n${tag(game, result.loserId)}\n\n${picked.text}\n\n⚡ **REVIVED: ${winner.toUpperCase()}**\n💀 **REMAINS ELIMINATED: ${loser.toUpperCase()}**\n\n# ${winner.toUpperCase()} HAS RETURNED TO THE ARENA.`;
}

function renderCrowdResolution(game, theme, result, simulatedVotes = 0) {
  const winner = name(game, result.survivorId);
  const losers = result.eliminatedIds.map(id => name(game, id));
  const pool = result.qualifiers.length > 2 ? "multiPins" : "pinDuels";
  const picked = chooseNarration(theme, pool, { winner, loser: losers[0] || "someone" }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  const simLine = simulatedVotes ? `\n🧪 **${simulatedVotes} simulated spectator votes were cast.**` : "";
  return `# 👁️ ═══ ${theme.labels.crowdPin} ═══ 👁️${simLine}\n\n${picked.text}\n\n💀 **ELIMINATED: ${losers.map(x => x.toUpperCase()).join(", ")}**\n⚡ **SURVIVOR: ${winner.toUpperCase()}**`;
}

function remaining(game) { return `\n\n# ⚔️ ROUND ${game.round} COMPLETE — ${game.aliveIds.length} PLAYER${game.aliveIds.length === 1 ? "" : "S"} REMAIN`; }
function winnerMessage(game, theme) { if (!game.winnerId) return `**${theme.labels.arena}** ends with nobody left standing.`; return `# 🏆 ${name(game, game.winnerId).toUpperCase()} WINS THE ARENA.\nThe lights settle. The chaos stops. One player is left.`; }
async function finishIfNeeded(env, game, theme) { checkWinner(game); if (game.status !== "finished") return false; await saveGame(env.DB, game); await recordFinishedGame(env.DB, game); await createChannelMessage(game.channelId, env.DISCORD_BOT_TOKEN, { content: winnerMessage(game, theme) }); return true; }

export class ArenaCoordinator {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const body = await request.json().catch(() => ({}));
    if (body.channelId) await this.ctx.storage.put("channelId", body.channelId);
    const channelId = body.channelId || await this.ctx.storage.get("channelId");
    if (!channelId) return new Response("Missing channelId", { status: 400 });
    if (body.action === "kick") { await this.ctx.storage.setAlarm(Date.now() + 1000); return Response.json({ ok: true }); }
    if (body.action === "wake") { await this.ctx.storage.setAlarm(Date.now() + 250); return Response.json({ ok: true }); }
    return Response.json({ ok: true, channelId });
  }

  async alarm() {
    const channelId = await this.ctx.storage.get("channelId");
    if (!channelId || !this.env.DB || !this.env.DISCORD_BOT_TOKEN) return;
    const game = await loadActiveGameForChannel(this.env.DB, channelId);
    if (!game || game.status !== "running") return;
    const theme = getTheme(game.themeId);

    if (game.crowdVote?.status === "open") {
      const simulatedVotes = castSimulatedCrowdVotes(game);
      const result = resolveCrowdVote(game);
      await saveGame(this.env.DB, game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: renderCrowdResolution(game, theme, result, simulatedVotes) + remaining(game) });
      if (await finishIfNeeded(this.env, game, theme)) return;
      await this.ctx.storage.setAlarm(Date.now() + NORMAL_DELAY_MS);
      return;
    }

    const { phases } = beginNextRound(game);
    if (!phases.length) {
      if (game.status === "finished") {
        await saveGame(this.env.DB, game);
        await recordFinishedGame(this.env.DB, game);
        await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: winnerMessage(game, theme) });
      }
      return;
    }

    const normal = resolveNormalRound(game);
    await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: renderRound(game, theme, normal) });

    if (phases.includes("revival") && specialEventsEnabled(game)) {
      const revival = resolveRevivalPit(game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: renderRevival(game, theme, revival) + remaining(game) });
    } else if (phases.includes("crowd_vote") && specialEventsEnabled(game)) {
      const vote = openCrowdVote(game);
      if (vote) {
        await saveGame(this.env.DB, game);
        const simLine = game.testMode?.simulatedCrowd ? "\n\n🧪 **TEST MODE:** simulated spectators will also vote when time expires." : "";
        const voteTitle = theme.id === "full_tilt" ? "THE FINAL BET IS OPEN" : "THE FINAL SCARE IS OPEN";
        const voteBody = theme.id === "full_tilt" ? "Choose who gets shoved all-in against the crowd's favorite bad decision." : "Choose who gets thrown into the Final Scare.";
        await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, {
          content: `# 👁️ ═══ ${theme.labels.crowdVote} ═══ 👁️\n## ${voteTitle}\n\nSpectators have **30 seconds**. ${voteBody}\n\nTop two voting positions enter. A cutoff tie drags everyone tied into the fight. **ONE SURVIVES.**${simLine}`,
          components: [{ type: 1, components: [{ type: 2, style: 4, custom_id: `arena:vote_open:${game.id}:0`, label: "CAST YOUR VOTE", emoji: { name: "👁️" } }] }]
        });
        await this.ctx.storage.setAlarm(Date.now() + CROWD_VOTE_MS);
        return;
      }
    } else {
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: remaining(game).trim() });
    }

    if (await finishIfNeeded(this.env, game, theme)) return;
    await saveGame(this.env.DB, game);
    await this.ctx.storage.setAlarm(Date.now() + NORMAL_DELAY_MS);
  }
}
