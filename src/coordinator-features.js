import { ArenaCoordinator as BaseArenaCoordinator } from "./coordinator.js";
import { loadActiveGameForChannel } from "./storage.js";
import { settleTelegramPrizePool } from "./dwallet-telegram-prizes.js";

export class ArenaCoordinator extends BaseArenaCoordinator {
  async fetch(request) {
    const body = await request.clone().json().catch(() => ({}));
    if (body.action === "wake" && Number(body.delayMs) > 250) {
      if (body.channelId) await this.ctx.storage.put("channelId", body.channelId);
      if (body.platform) await this.ctx.storage.put("platform", body.platform);
      const channelId = body.channelId || await this.ctx.storage.get("channelId");
      if (!channelId) return new Response("Missing channelId", { status: 400 });
      await this.ctx.storage.setAlarm(Date.now() + Math.max(250, Number(body.delayMs) || 250));
      return Response.json({ ok: true });
    }
    return super.fetch(request);
  }

  async alarm() {
    const deletion = await this.ctx.storage.get("deleteMessage");
    if (deletion) return super.alarm();

    const channelId = await this.ctx.storage.get("channelId");
    if (channelId && this.env.DB) {
      const game = await loadActiveGameForChannel(this.env.DB, channelId);
      if (game?.status === "running" && game.paused) return;
    }

    const result = await super.alarm();

    if (channelId && this.env.DB) {
      const row = await this.env.DB.prepare(`
        SELECT state_json FROM games
        WHERE channel_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `).bind(channelId).first();
      const latest = row?.state_json ? JSON.parse(row.state_json) : null;
      if (latest?.platform === "telegram" && ["finished", "cancelled", "aborted"].includes(latest.status)) {
        await settleTelegramPrizePool(this.env, latest);
      }
    }

    return result;
  }
}
