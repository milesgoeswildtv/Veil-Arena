import {
  beginNextRound,
  resolveNormalRound,
  resolveRevivalPit,
  openCrowdVote,
  resolveCrowdVote,
  checkWinner,
  specialEventsEnabled
} from "./core/engine.js";
import { castSimulatedCrowdVotes } from "./core/simulation.js";
import { loadActiveGameForChannel, saveGame, recordFinishedGame } from "./storage.js";
import { createChannelMessage, deleteChannelMessage } from "./discord.js";
import { sendTelegramMessage, deleteTelegramMessage } from "./telegram.js";
import { startArenaCooldown, TELEGRAM_ARENA_COOLDOWN_MS } from "./cooldown.js";
import { getTheme, chooseNarration } from "./themes/index.js";
import { buildMassBrawl } from "./themes/brawls.js";

const CROWD_VOTE_MS = 30000;
const RARE_EVENT_CHANCE = 0.035;

const name = (g, id) => g.players[id]?.displayName || "Unknown";
const delayFor = brawl => brawl ? 14000 + Math.floor(Math.random() * 2001) : 12000 + Math.floor(Math.random() * 2001);
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const platformOf = g => g?.platform === "telegram" ? "telegram" : "discord";
const themeIcon = t => t.id === "full_tilt" ? "🎰" : t.id === "dwallet" ? "💜" : "👻";

function rarePrefix(t) {
  if (t.id === "full_tilt") return "🎰 RARE FULL TILT BULLSHIT: ";
  if (t.id === "dwallet") return "💜 DWALLET GLITCH: ";
  return "📼 SOMETHING IS VERY FUCKING WRONG: ";
}

function styledNames(text, g, deadIds = []) {
  let out = String(text || "");
  const dead = new Set(deadIds);
  const players = Object.values(g.players).sort((a, b) => b.displayName.length - a.displayName.length);
  for (const p of players) {
    const re = new RegExp(`(?<![\\w*~])${esc(p.displayName)}(?![\\w*~])`, "gi");
    out = out.replace(re, m => dead.has(p.id) ? `~~***${m}***~~` : `***${m}***`);
  }
  return out;
}

function styleEventNarration(text, g, deadIds = []) {
  if (!deadIds.length) return styledNames(text, g);
  let out = String(text || "");
  const dead = new Set(deadIds);
  const players = Object.values(g.players).sort((a, b) => b.displayName.length - a.displayName.length);
  for (const p of players) {
    const re = new RegExp(`(?<![\\w*~])${esc(p.displayName)}(?![\\w*~])`, "gi");
    let seen = 0;
    out = out.replace(re, m => {
      if (!dead.has(p.id)) return `***${m}***`;
      seen++;
      return seen === 1 ? `***${m}***` : `~~***${m}***~~`;
    });
  }
  return out;
}

function recent(g) {
  return g.history.filter(x => x?.narrationTemplate).slice(-150).map(x => x.narrationTemplate);
}

function remember(g, template) {
  if (template) g.history.push({ type: "narration_used", narrationTemplate: template, round: g.round });
}

function rememberDisplayed(g, text) {
  if (!text) return;
  if (!Array.isArray(g.displayLog)) g.displayLog = [];
  g.displayLog.push({ round: g.round, text, at: new Date().toISOString() });
}

function normalText(g, t, r) {
  const ids = r.actorIds || [];
  const killer = ids[0] ? name(g, ids[0]) : "Someone";
  const victim = ids[1] ? name(g, ids[1]) : killer;
  const useRare = t.rareEvents?.length && Math.random() < RARE_EVENT_CHANCE;
  const pool = useRare ? "rareEvents" : "normalEvents";
  const pick = chooseNarration(
    t,
    pool,
    { killer, victim, third: ids[2] ? name(g, ids[2]) : "someone else" },
    Math.random,
    recent(g)
  );
  remember(g, pick.template);
  return `${useRare ? rarePrefix(t) : ""}${styledNames(pick.text, g)}`;
}

function beat(g, t, r, n) {
  if (!r.eliminatedIds?.length) return `${n}\\. ${normalText(g, t, r)}`;
  const victimId = r.eliminatedIds[0];
  const victim = name(g, victimId);
  if (r.type === "self_elimination") {
    const pick = chooseNarration(t, "selfKills", { victim }, Math.random, recent(g));
    remember(g, pick.template);
    return `${n}\\. \n${styleEventNarration(pick.text, g, [victimId])}`;
  }
  const actorId = r.actorIds.find(id => id !== victimId) || r.actorIds[0];
  const killer = name(g, actorId);
  const pick = chooseNarration(t, "playerKills", { killer, victim }, Math.random, recent(g));
  remember(g, pick.template);
  return `${n}\\. \n${styleEventNarration(pick.text, g, [victimId])}`;
}

function roundBody(g, t, batch) {
  return batch.outcomes.map((x, i) => beat(g, t, x, i + 1)).join("\n\n");
}

function roundText(g, t, batch) {
  const icon = themeIcon(t);
  if (batch.type === "mass_brawl") {
    const participants = batch.participantIds.map(id => name(g, id));
    const survivors = batch.survivorIds.map(id => name(g, id));
    const eliminated = batch.eliminatedIds.map(id => name(g, id));
    const raw = buildMassBrawl(t.id, participants, survivors);
    const story = styleEventNarration(raw, g, batch.eliminatedIds);
    const deadLine = eliminated.length ? `\n\n💀 ${eliminated.map(x => `~~***${x}***~~`).join(", ")}` : "";
    return `${icon} *ROUND ${g.round} — MASS BRAWL*\n\n${story}${deadLine}\n\n## ⚔️ ${g.aliveIds.length} PLAYER${g.aliveIds.length === 1 ? "" : "S"} REMAIN`;
  }
  return `${icon} *ROUND ${g.round}*\n\n${roundBody(g, t, batch)}\n\n## ⚔️ ${g.aliveIds.length} PLAYER${g.aliveIds.length === 1 ? "" : "S"} REMAIN`;
}

function revivalSegment(g, t, result) {
  if (result.type === "revival_skipped") return `🕯️ *${t.labels.revival}*\nNot enough eliminated players are available.`;
  const winner = name(g, result.winnerId);
  const loser = name(g, result.loserId);
  const pick = chooseNarration(t, "revivalDuels", { winner, loser }, Math.random, recent(g));
  remember(g, pick.template);
  return `🕯️ *${t.labels.revival}*\n${styledNames(pick.text, g)}\n⚡ **REVIVED: ${winner.toUpperCase()}**\n💀 **REMAINS ELIMINATED: ${loser.toUpperCase()}**`;
}

function revivalRoundText(g, t, result) {
  return `${themeIcon(t)} *ROUND ${g.round} — REVIVAL*\n\n${revivalSegment(g, t, result)}\n\n## ⚔️ ${g.aliveIds.length} PLAYER${g.aliveIds.length === 1 ? "" : "S"} REMAIN`;
}

function crowdOpenText(g, t) {
  let line = "THE FINAL SCARE IS OPEN";
  let instruction = "Spectators have **30 seconds**. The top two voting positions enter a strict **1v1**. **ONE SURVIVES.**";
  if (t.id === "full_tilt") line = "THE FINAL BET IS OPEN";
  if (t.id === "dwallet") {
    line = "THE CHAT VOTE IS OPEN";
    instruction = "Spectators have **30 seconds**. Vote inside the live Arena window. The top two voting positions enter a strict **1v1**. **ONE SURVIVES.**";
  }
  return `👁️ *ROUND ${g.round} — ${t.labels.crowdVote}*\n\n${line}\n${instruction}`;
}

function crowdText(g, t, result, sim = 0) {
  const winner = name(g, result.survivorId);
  const losers = result.eliminatedIds.map(id => name(g, id));
  const pick = chooseNarration(
    t,
    result.qualifiers.length > 2 ? "multiPins" : "pinDuels",
    { winner, loser: losers[0] || "someone" },
    Math.random,
    recent(g)
  );
  remember(g, pick.template);
  return `👁️ *${t.labels.crowdPin}*${sim ? `\n🧪 ${sim} simulated votes.` : ""}\n${styleEventNarration(pick.text, g, result.eliminatedIds)}\n💀 **ELIMINATED: ${losers.map(x => x.toUpperCase()).join(", ")}**\n⚡ **SURVIVOR: ${winner.toUpperCase()}**\n\n## ⚔️ ${g.aliveIds.length} PLAYERS REMAIN`;
}

async function sendTransport(env, platform, channelId, message, controls = {}) {
  if (platform === "telegram") {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram bot token is not configured.");
    return sendTelegramMessage(channelId, env.TELEGRAM_BOT_TOKEN, {
      text: message,
      reply_markup: controls.telegram
    });
  }
  if (!env.DISCORD_BOT_TOKEN) throw new Error("Discord bot token is not configured.");
  return createChannelMessage(channelId, env.DISCORD_BOT_TOKEN, {
    content: message,
    components: controls.discord || []
  });
}

async function deleteTransport(env, platform, channelId, messageId) {
  if (platform === "telegram") {
    if (!env.TELEGRAM_BOT_TOKEN) return false;
    return deleteTelegramMessage(channelId, messageId, env.TELEGRAM_BOT_TOKEN);
  }
  if (!env.DISCORD_BOT_TOKEN) return false;
  await deleteChannelMessage(channelId, messageId, env.DISCORD_BOT_TOKEN);
  return true;
}

async function trimToCurrentRound(ctx, env, platform, channelId, groups, currentRound) {
  const keep = [];
  for (const group of groups) {
    if (group.round === currentRound) keep.push(group);
    else for (const id of group.messageIds) await deleteTransport(env, platform, channelId, id);
  }
  return keep;
}

async function postRound(ctx, env, platform, channelId, round, message, controls = {}) {
  if (platform === "telegram") return null;
  let groups = await ctx.storage.get("roundMessageGroups") || [];
  groups = await trimToCurrentRound(ctx, env, platform, channelId, groups, round);
  const created = await sendTransport(env, platform, channelId, message, controls);
  groups.push({ round, messageIds: [created?.id].filter(Boolean) });
  await ctx.storage.put("roundMessageGroups", groups);
  return created;
}

async function appendRoundMessage(ctx, env, platform, channelId, round, message, controls = {}) {
  if (platform === "telegram") return null;
  const created = await sendTransport(env, platform, channelId, message, controls);
  const groups = await ctx.storage.get("roundMessageGroups") || [];
  let group = groups.find(x => x.round === round);
  if (!group) {
    group = { round, messageIds: [] };
    groups.push(group);
  }
  if (created?.id) group.messageIds.push(created.id);
  await ctx.storage.put("roundMessageGroups", groups);
  return created;
}

function winner(g) {
  return `🏆 **${name(g, g.winnerId).toUpperCase()} WINS THE ARENA.**\nThe chaos stops. One player is left.`;
}

async function finish(env, g) {
  checkWinner(g);
  if (g.status !== "finished") return false;
  const platform = platformOf(g);
  const base = winner(g);
  const msg = platform === "telegram" ? `${base}\n\n⏳ **Next DWallet Arena: 30 minutes.**` : base;
  rememberDisplayed(g, base);
  await saveGame(env.DB, g);
  await recordFinishedGame(env.DB, g);
  await sendTransport(env, platform, g.channelId, msg);
  if (platform === "telegram") {
    await startArenaCooldown(env.DB, g.channelId, TELEGRAM_ARENA_COOLDOWN_MS);
  }
  return true;
}

export class ArenaCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const body = await request.json().catch(() => ({}));
    if (body.action === "delete_message") {
      await this.ctx.storage.put("deleteMessage", {
        platform: body.platform || "discord",
        channelId: body.channelId,
        messageId: body.messageId
      });
      await this.ctx.storage.setAlarm(Date.now() + Math.max(1000, Number(body.delayMs) || 30000));
      return Response.json({ ok: true });
    }

    if (body.channelId) await this.ctx.storage.put("channelId", body.channelId);
    if (body.platform) await this.ctx.storage.put("platform", body.platform);
    const channelId = body.channelId || await this.ctx.storage.get("channelId");
    if (!channelId) return new Response("Missing channelId", { status: 400 });

    if (body.action === "kick") {
      await this.ctx.storage.put("roundMessageGroups", []);
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    } else if (body.action === "wake") {
      await this.ctx.storage.setAlarm(Date.now() + 250);
    }

    return Response.json({ ok: true });
  }

  async alarm() {
    const deletion = await this.ctx.storage.get("deleteMessage");
    if (deletion) {
      await deleteTransport(this.env, deletion.platform || "discord", deletion.channelId, deletion.messageId);
      await this.ctx.storage.delete("deleteMessage");
      return;
    }

    const channelId = await this.ctx.storage.get("channelId");
    if (!channelId || !this.env.DB) return;

    const g = await loadActiveGameForChannel(this.env.DB, channelId);
    if (!g || g.status !== "running") return;

    const platform = platformOf(g);
    if (platform === "telegram" && !this.env.TELEGRAM_BOT_TOKEN) return;
    if (platform === "discord" && !this.env.DISCORD_BOT_TOKEN) return;

    const t = getTheme(g.themeId);

    if (g.crowdVote?.status === "open") {
      const sim = castSimulatedCrowdVotes(g);
      const result = resolveCrowdVote(g);
      const msg = crowdText(g, t, result, sim);
      rememberDisplayed(g, msg);
      await saveGame(this.env.DB, g);
      await appendRoundMessage(this.ctx, this.env, platform, channelId, g.round, msg);
      if (await finish(this.env, g)) return;
      await this.ctx.storage.setAlarm(Date.now() + delayFor(false));
      return;
    }

    const { phases } = beginNextRound(g);
    if (!phases.length) return;

    const revivalRound = phases.includes("revival") && specialEventsEnabled(g);
    if (revivalRound) {
      const result = resolveRevivalPit(g);
      const msg = revivalRoundText(g, t, result);
      rememberDisplayed(g, msg);
      await postRound(this.ctx, this.env, platform, channelId, g.round, msg);
      if (await finish(this.env, g)) return;
      await saveGame(this.env.DB, g);
      await this.ctx.storage.setAlarm(Date.now() + delayFor(false));
      return;
    }

    const crowdRound = phases.includes("crowd_vote") && specialEventsEnabled(g);
    if (crowdRound) {
      const vote = openCrowdVote(g);
      if (vote) {
        const msg = crowdOpenText(g, t);
        rememberDisplayed(g, msg);
        await saveGame(this.env.DB, g);
        const controls = platform === "telegram" ? {} : {
          discord: [{
            type: 1,
            components: [{
              type: 2,
              style: 4,
              custom_id: `arena:vote_open:${g.id}:0`,
              label: "CAST YOUR VOTE",
              emoji: { name: "👁️" }
            }]
          }]
        };
        await postRound(this.ctx, this.env, platform, channelId, g.round, msg, controls);
        await this.ctx.storage.setAlarm(Date.now() + CROWD_VOTE_MS);
        return;
      }
    }

    const normal = resolveNormalRound(g);
    const isBrawl = normal.type === "mass_brawl";
    const msg = roundText(g, t, normal);
    rememberDisplayed(g, msg);
    await postRound(this.ctx, this.env, platform, channelId, g.round, msg);
    if (await finish(this.env, g)) return;
    await saveGame(this.env.DB, g);
    await this.ctx.storage.setAlarm(Date.now() + delayFor(isBrawl));
  }
}
