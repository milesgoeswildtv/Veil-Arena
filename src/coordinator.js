import { advanceArenaGame } from "./core/orchestrator.js";
import { loadActiveGameForChannel, saveGame, recordFinishedGame } from "./storage.js";
import { createChannelMessage } from "./discord.js";
import { payArenaWinner, payoutStatusText } from "./dwallet-payout.js";

function chunks(text, limit = 1900) {
  const source = String(text || "");
  if (source.length <= limit) return source ? [source] : [];
  const out = [];
  let rest = source;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = limit;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\s+/, "");
  }
  if (rest) out.push(rest);
  return out;
}

async function send(env, channelId, text, components = []) {
  let first = true;
  for (const part of chunks(text)) {
    await createChannelMessage(channelId, env.DISCORD_BOT_TOKEN, { content: part, components: first ? components : [] });
    first = false;
  }
}

export class ArenaCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const body = await request.json().catch(() => ({}));
    const channelId = String(body.channelId || await this.ctx.storage.get("channelId") || "");
    if (!channelId) return new Response("Missing channelId", { status: 400 });
    await this.ctx.storage.put("channelId", channelId);

    if (body.action === "stop") {
      await this.ctx.storage.deleteAlarm().catch(() => null);
      return Response.json({ ok: true, stopped: true });
    }
    await this.ctx.storage.setAlarm(Date.now() + (body.action === "wake" ? 250 : 750));
    return Response.json({ ok: true });
  }

  async alarm() {
    const channelId = await this.ctx.storage.get("channelId");
    if (!channelId || !this.env.DB || !this.env.DISCORD_BOT_TOKEN) return;
    const game = await loadActiveGameForChannel(this.env.DB, channelId);
    if (!game || game.platform !== "discord" || game.status !== "running") return;

    let step;
    try {
      step = advanceArenaGame(game);
    } catch (error) {
      console.error("Arena coordinator advance failed", error);
      await this.ctx.storage.setAlarm(Date.now() + 5000);
      return;
    }

    await saveGame(this.env.DB, game);
    if (step?.text) {
      const components = step.type === "crowd_vote_open" ? [{
        type: 1,
        components: [{ type: 2, style: 4, custom_id: `arena:vote_open:${game.id}:0`, label: "CAST YOUR VOTE", emoji: { name: "👁️" } }]
      }] : [];
      await send(this.env, channelId, step.text, components);
    }

    if (step?.finished || game.status === "finished") {
      if (step?.payoutReport) await send(this.env, channelId, step.payoutReport);
      if (game.dwalletWinnerPayout) {
        await payArenaWinner(this.env, game, saveGame);
        const automatic = payoutStatusText(game);
        if (automatic) await send(this.env, channelId, automatic);
      }
      await saveGame(this.env.DB, game);
      await recordFinishedGame(this.env.DB, game);
      return;
    }

    await this.ctx.storage.setAlarm(Date.now() + Math.max(250, Number(step?.waitMs) || 1000));
  }
}
