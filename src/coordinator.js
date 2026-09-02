import {
  beginNextRound,
  resolveNormalRound,
  resolveRevivalPit,
  openCrowdVote,
  resolveCrowdVote
} from "./core/engine.js";
import { loadActiveGameForChannel, saveGame, recordFinishedGame } from "./storage.js";
import { createChannelMessage } from "./discord.js";
import { getTheme, chooseNarration } from "./themes/index.js";

const NORMAL_DELAY_MS = 8000;
const CROWD_VOTE_MS = 30000;

function name(game, id) {
  return game.players[id]?.displayName || "Unknown";
}

function recentTemplates(game) {
  return game.history
    .filter(item => item?.narrationTemplate)
    .slice(-20)
    .map(item => item.narrationTemplate);
}

function rememberNarration(game, template) {
  if (!template) return;
  game.history.push({ type: "narration_used", narrationTemplate: template, round: game.round });
}

function genericNormalNarration(game, result) {
  const actors = result.actorIds.map(id => name(game, id));
  const [a, b, c] = actors;
  const map = {
    attack: `${a} goes after ${b}. Neither of them looks especially interested in making good decisions.`,
    counter: `${a} makes a move on ${b}. ${b} sees it coming and turns the whole exchange around.`,
    double_team: `${a} and ${b} drag ${c || "someone"} into a deeply unfair situation.`,
    weapon: `${a} finds something in the Arena that was almost certainly not meant to be used like that. ${b} is the unfortunate test subject.`,
    near_elimination: `${b} ends up hanging on by a thread while ${a} tries very hard to make gravity finish the job.`,
    elimination: `${a} catches ${b} at the worst possible moment.`
  };
  return map[result.type] || "The Arena erupts into chaos.";
}

function renderNormal(game, theme, result) {
  if (!result.eliminatedIds?.length) return genericNormalNarration(game, result);

  const victimId = result.eliminatedIds[0];
  const victim = name(game, victimId);
  const attackerId = result.actorIds.find(id => id !== victimId) || result.actorIds[0];
  const killer = name(game, attackerId);
  const thirdId = result.actorIds.find(id => id !== victimId && id !== attackerId);
  const picked = chooseNarration(theme, "playerKills", {
    killer,
    victim,
    third: thirdId ? name(game, thirdId) : "someone else"
  }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  return `${picked.text}\n\n**${victim.toUpperCase()} HAS BEEN ELIMINATED.**`;
}

function renderRevival(game, theme, result) {
  if (result.type === "revival_skipped") {
    return `**${theme.labels.revival}**\nThe Veil stirs... but there aren't two eliminated players to pull back yet.`;
  }
  const winner = name(game, result.winnerId);
  const loser = name(game, result.loserId);
  const picked = chooseNarration(theme, "revivalDuels", { winner, loser }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  return `**${theme.labels.revival}**\n${winner} vs ${loser}\n\n${picked.text}\n\n**${winner.toUpperCase()} HAS RETURNED.**`;
}

function renderCrowdResolution(game, theme, result) {
  const winner = name(game, result.survivorId);
  const losers = result.eliminatedIds.map(id => name(game, id));
  const pool = result.qualifiers.length > 2 ? "multiPins" : "pinDuels";
  const picked = chooseNarration(theme, pool, {
    winner,
    loser: losers[0] || "someone"
  }, Math.random, recentTemplates(game));
  rememberNarration(game, picked.template);
  const eliminatedLine = losers.length === 1
    ? `**${losers[0].toUpperCase()} HAS BEEN ELIMINATED.**`
    : `**ELIMINATED:** ${losers.join(", ")}`;
  return `**${theme.labels.crowdPin}**\n${picked.text}\n\n${eliminatedLine}\n\n**${winner.toUpperCase()} SURVIVES.**`;
}

function winnerMessage(game, theme) {
  if (!game.winnerId) return `**${theme.labels.arena}** ends with nobody left standing.`;
  return `# ${name(game, game.winnerId)} WINS THE ARENA.\nThe lights settle. The chaos stops. One player is left.`;
}

export class ArenaCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const body = await request.json().catch(() => ({}));
    if (body.channelId) await this.ctx.storage.put("channelId", body.channelId);
    const channelId = body.channelId || await this.ctx.storage.get("channelId");
    if (!channelId) return new Response("Missing channelId", { status: 400 });

    if (body.action === "kick") {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return Response.json({ ok: true });
    }
    if (body.action === "wake") {
      await this.ctx.storage.setAlarm(Date.now() + 250);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true, channelId });
  }

  async alarm() {
    const channelId = await this.ctx.storage.get("channelId");
    if (!channelId || !this.env.DB || !this.env.DISCORD_BOT_TOKEN) return;

    const game = await loadActiveGameForChannel(this.env.DB, channelId);
    if (!game || game.status !== "running") return;
    const theme = getTheme(game.themeId);

    if (game.crowdVote?.status === "open") {
      const result = resolveCrowdVote(game);
      await saveGame(this.env.DB, game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, {
        content: renderCrowdResolution(game, theme, result)
      });
      if (game.status === "finished") {
        await recordFinishedGame(this.env.DB, game);
        await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: winnerMessage(game, theme) });
        return;
      }
      await this.ctx.storage.setAlarm(Date.now() + NORMAL_DELAY_MS);
      return;
    }

    const { round, phases } = beginNextRound(game);
    if (!phases.length) return;

    const normal = resolveNormalRound(game);
    await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, {
      content: `**ROUND ${round}**\n${renderNormal(game, theme, normal)}`
    });

    if (game.status === "finished") {
      await saveGame(this.env.DB, game);
      await recordFinishedGame(this.env.DB, game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, { content: winnerMessage(game, theme) });
      return;
    }

    if (phases.includes("revival")) {
      const revival = resolveRevivalPit(game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, {
        content: renderRevival(game, theme, revival)
      });
    }

    if (phases.includes("crowd_vote") && game.aliveIds.length >= 2) {
      openCrowdVote(game);
      await saveGame(this.env.DB, game);
      await createChannelMessage(channelId, this.env.DISCORD_BOT_TOKEN, {
        content: `# ${theme.labels.crowdVote}\nSpectators have **30 seconds**. Choose who gets thrown into the Final Scare.\n\nThe top two voting positions enter. Ties at the cutoff pull everyone tied into the fight. **One survives.**`,
        components: [{
          type: 1,
          components: [{ type: 2, style: 4, custom_id: `arena:vote_open:${game.id}:0`, label: "CAST YOUR VOTE", emoji: { name: "👁️" } }]
        }]
      });
      await this.ctx.storage.setAlarm(Date.now() + CROWD_VOTE_MS);
      return;
    }

    await saveGame(this.env.DB, game);
    await this.ctx.storage.setAlarm(Date.now() + NORMAL_DELAY_MS);
  }
}
