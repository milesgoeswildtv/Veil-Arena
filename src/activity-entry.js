import app, { ArenaCoordinator } from "./entry.js";
import { handleActivityPreview } from "./activity-preview.js";
import { ACTIVITY_PREVIEW_CLIENT } from "./activity-preview-client.js";
import { SPONSOR_PANEL_CLIENT } from "./sponsor-panel-client.js";
import { InteractionType, verifyDiscordRequest, interactionMessage, userFromInteraction, registerGuildCommands } from "./discord.js";
import { ensureSchema, loadActiveGameForChannel, loadGame, saveGame, setGuildTheme } from "./storage.js";
import { validateTelegramInitData } from "./miniapp.js";
import { telegramUserInChat } from "./telegram.js";
import { upsertSponsorship, sponsorshipSummary } from "./sponsorships.js";

export { ArenaCoordinator };

const DISCORD_ACTIVITY_BUILD = "activity-v3";
const DISCORD_THEMES = new Set(["dwallet", "full_tilt", "vibe_queen_slots"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function cspSafeActivityHtml(source) {
  return String(source)
    .replace("SYSTEM NOMINAL", "CONTROLS LOADING")
    .replace(/ onclick="fx\('([^']+)'\)"/g, ' data-fx="$1"')
    .replace(/ onclick="runAll\(\)"/g, ' data-fx="all"')
    .replace(/<script>[\s\S]*?<\/script>/, '<script src="/activity-preview/app.js"></script>');
}

function discordSetupPage(origin) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Discord Arena Setup</title><style>
body{font-family:system-ui;margin:0;background:#0c0911;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,580px);background:linear-gradient(180deg,#1c1428,#120d19);border:1px solid #3a2a4d;padding:24px;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin-top:0}label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#cfb8e6;margin:12px 0}input,select,button{width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:15px}input,select{background:#0b0810;color:#fff;border:1px solid #463356}button{border:0;background:#8f59f7;color:#fff;font-weight:900;margin-top:8px}.muted{color:#a99bb8;font-size:12px;line-height:1.45}.ok{color:#86efbd}.bad{color:#ff93af}code{background:#0a0710;padding:2px 5px;border-radius:5px}#out{white-space:pre-wrap;margin-top:14px;font-size:13px}</style></head><body><div class="card"><h1>⚔️ Veil Discord Arena Setup</h1><p class="muted">Registers the current Discord command schema for one server. This includes <code>/arena sponsor</code> and all optional dollar award fields.</p>
<label>Discord Server / Guild ID<input id="guild" inputmode="numeric" placeholder="123456789012345678"></label>
<label>Arena Theme<select id="theme"><option value="dwallet">DWallet</option><option value="full_tilt">Full Tilt</option><option value="vibe_queen_slots">Vibe Queen Slots</option></select></label>
<label>Cloudflare ADMIN_SECRET<input id="secret" type="password" placeholder="ADMIN_SECRET" autocomplete="current-password"></label>
<button id="go">REGISTER / REFRESH DISCORD COMMANDS</button><div id="out" class="muted"></div><p class="muted">Worker: ${esc(origin)}<br>Activity diagnostic: <code>/activity-preview/health</code></p></div><script>(()=>{const go=document.getElementById('go'),out=document.getElementById('out');go.addEventListener('click',async()=>{const guildId=document.getElementById('guild').value.trim(),themeId=document.getElementById('theme').value,secret=document.getElementById('secret').value.trim();if(!/^\d{15,22}$/.test(guildId)){out.className='bad';out.textContent='Enter a valid numeric Discord Guild ID.';return}if(!secret){out.className='bad';out.textContent='Enter ADMIN_SECRET.';return}go.disabled=true;out.className='muted';out.textContent='Registering Discord commands…';try{const r=await fetch('/admin/discord/register',{method:'POST',headers:{'content-type':'application/json','x-admin-secret':secret},body:JSON.stringify({guildId,themeId})});const j=await r.json().catch(()=>({ok:false,error:'Bad server response'}));if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));out.className='ok';out.textContent='✅ Discord commands refreshed. Theme: '+j.themeId+'\n/arena sponsor is now registered for this server.'}catch(e){out.className='bad';out.textContent='❌ '+e.message}finally{go.disabled=false}})})();</script></body></html>`;
}

async function handleDiscordSetupRegister(request, env) {
  const provided = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) return json({ ok: false, error: "ADMIN_SECRET is missing or does not match." }, 401);
  if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_BOT_TOKEN || !env.DISCORD_PUBLIC_KEY) {
    return json({ ok: false, error: "Discord credentials are incomplete. Check DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, and DISCORD_PUBLIC_KEY." }, 500);
  }
  if (!env.DB) return json({ ok: false, error: "Arena database is missing." }, 500);
  const body = await request.json().catch(() => ({}));
  const guildId = String(body.guildId || "").trim();
  const themeId = String(body.themeId || "dwallet").trim();
  if (!/^\d{15,22}$/.test(guildId)) return json({ ok: false, error: "A valid numeric Discord Guild ID is required." }, 400);
  if (!DISCORD_THEMES.has(themeId)) return json({ ok: false, error: "Unknown Arena theme." }, 400);
  await ensureSchema(env.DB);
  const commands = await registerGuildCommands(env.DISCORD_APPLICATION_ID, guildId, env.DISCORD_BOT_TOKEN);
  await setGuildTheme(env.DB, guildId, themeId);
  return json({ ok: true, guildId, themeId, commandsRegistered: Array.isArray(commands) ? commands.length : null });
}

function sponsorPanelHtml() {
  return `<section id="arenaSponsorPanel" class="arenaSponsorPanel">
<style>
.arenaSponsorPanel{max-width:760px;margin:10px auto 24px;padding:15px;border:1px solid #3a2a4d;border-radius:18px;background:linear-gradient(180deg,#1b1327,#120e1a);color:#f7f3ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.arenaSponsorPanel h3{margin:0 0 5px}.arenaSponsorPanel .spMeta{font-size:10px;letter-spacing:.1em;color:#cdb3ff;font-weight:900;margin-bottom:12px}.arenaSponsorGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.arenaSponsorField{display:grid;gap:5px;font-size:11px;font-weight:850;color:#c8bed2}.arenaSponsorField input{width:100%;box-sizing:border-box;border:1px solid #403050;border-radius:11px;background:#0c0911;color:#fff;padding:11px;font-size:15px}.arenaSponsorActions{display:flex;gap:8px;margin-top:10px}.arenaSponsorActions button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:900;background:#8f59f7;color:white}.arenaSponsorActions button.secondary{background:#2a2037}.sponsorEntry{padding:10px 0;border-top:1px solid #30233f;font-size:12px;line-height:1.45}.sponsorEntry:first-child{border-top:0}.sponsorEmpty{color:#93889e;font-size:12px;padding:7px 0}@media(max-width:560px){.arenaSponsorGrid{grid-template-columns:1fr}}
</style>
<h3>💸 Sponsor this Arena</h3><div class="spMeta" data-sponsor-status>LOADING SPONSORSHIPS…</div>
<form data-sponsor-form>
<div class="arenaSponsorGrid">
<label class="arenaSponsorField">🏆 Winner ($)<input name="winner" inputmode="decimal" type="number" min="0" step="0.01" placeholder="5.00"></label>
<label class="arenaSponsorField">💀 Most Eliminations ($)<input name="most_kills" inputmode="decimal" type="number" min="0" step="0.01" placeholder="2.00"></label>
</div>
<div data-sponsor-extras hidden><div class="arenaSponsorGrid" style="margin-top:8px">
<label class="arenaSponsorField">🥈 Runner-Up ($)<input name="runner_up" inputmode="decimal" type="number" min="0" step="0.01"></label>
<label class="arenaSponsorField">⚡ Most Revivals ($)<input name="most_revivals" inputmode="decimal" type="number" min="0" step="0.01"></label>
<label class="arenaSponsorField">👁 Most Showdowns Survived ($)<input name="most_showdowns" inputmode="decimal" type="number" min="0" step="0.01"></label>
<label class="arenaSponsorField">💥 Most Mass Brawls Survived ($)<input name="most_mass_brawls" inputmode="decimal" type="number" min="0" step="0.01"></label>
</div></div>
<div class="arenaSponsorActions"><button type="button" class="secondary" data-sponsor-more>＋ MORE PRIZE OPTIONS</button><button type="submit" data-sponsor-submit>LOCK MY SPONSORSHIP</button></div>
</form>
<div data-sponsor-list style="margin-top:12px"></div>
<script src="/telegram/sponsor/app.js"></script>
</section>`;
}

function injectSponsorPanel(source) {
  const html = String(source);
  if (html.includes('id="arenaSponsorPanel"')) return html;
  return html.replace("</body>", `${sponsorPanelHtml()}</body>`);
}

async function maybeHandleDiscordSponsor(request, env) {
  if (!env.DB || !env.DISCORD_PUBLIC_KEY) return null;
  const raw = await request.clone().text();
  if (!await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, raw)) return null;
  const interaction = JSON.parse(raw);
  if (interaction.type !== InteractionType.APPLICATION_COMMAND || interaction.data?.name !== "arena") return null;
  const sub = interaction.data?.options?.[0];
  if (sub?.name !== "sponsor") return null;
  if (!interaction.guild_id || !interaction.channel_id) return interactionMessage("Arena sponsorships only work inside a server channel.", [], true);
  await ensureSchema(env.DB);
  const game = await loadActiveGameForChannel(env.DB, interaction.channel_id);
  if (!game) return interactionMessage("There is no active Arena in this channel to sponsor.", [], true);
  if (game.status !== "registration") return interactionMessage("That Arena already started. Sponsorships are locked.", [], true);
  const user = userFromInteraction(interaction);
  const awards = Object.fromEntries((sub.options || []).map(x => [x.name, x.value]));
  try {
    const record = upsertSponsorship(game, user, awards);
    await saveGame(env.DB, game);
    return interactionMessage(`# 💸 SPONSORED ARENA\n\n${sponsorshipSummary({ sponsorships: [record] })}\n\n*This sponsorship locks when START is pressed. Run the command again before START to edit your own amounts.*`);
  } catch (error) {
    return interactionMessage(String(error?.message || error), [], true);
  }
}

function gameIdFromStartParam(value) {
  const raw = String(value || "");
  return raw.startsWith("arena_") ? raw.slice(6) : null;
}

async function handleTelegramSponsor(request, env) {
  try {
    if (!env.DB || !env.TELEGRAM_BOT_TOKEN) throw new Error("DWallet Arena sponsorships are not configured.");
    const initData = request.headers.get("x-telegram-init-data") || "";
    const auth = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
    if (!auth.chatType || !["group", "supergroup"].includes(auth.chatType)) throw new Error("Open Arena from its DWallet Telegram group.");
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const gameId = String(body.gameId || url.searchParams.get("game") || gameIdFromStartParam(auth.startParam) || "");
    if (!gameId) throw new Error("Missing Arena ID.");
    const launched = gameIdFromStartParam(auth.startParam);
    if (launched && launched !== gameId) throw new Error("That sponsorship does not match this Arena launch.");
    await ensureSchema(env.DB);
    const game = await loadGame(env.DB, gameId);
    if (!game || game.platform !== "telegram" || game.themeId !== "dwallet") throw new Error("That DWallet Arena no longer exists.");
    if (game.telegramChatInstance && auth.chatInstance !== game.telegramChatInstance) throw new Error("Open this Arena from its original DWallet group message.");
    if (!await telegramUserInChat(game.channelId, auth.user.id, env.TELEGRAM_BOT_TOKEN)) throw new Error("Only members of this DWallet group can sponsor its Arena.");
    if (request.method === "POST") {
      upsertSponsorship(game, auth.user, body.awards || {});
      await saveGame(env.DB, game);
    }
    return json({ ok: true, status: game.status, sponsorships: game.sponsorships || [] });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/activity-preview/health") {
      return json({ ok: true, activity: "DWallet Arena FX Lab", build: DISCORD_ACTIVITY_BUILD, controller: "/activity-preview/app.js", controls: true });
    }
    if (request.method === "GET" && (url.pathname === "/activity-preview/app.js" || url.pathname === "/app.js")) {
      return new Response(ACTIVITY_PREVIEW_CLIENT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-arena-activity-build": DISCORD_ACTIVITY_BUILD } });
    }
    if (request.method === "GET" && (url.pathname === "/activity-preview" || url.pathname.startsWith("/activity-preview/"))) {
      const original = await handleActivityPreview();
      const html = cspSafeActivityHtml(await original.text());
      const headers = new Headers(original.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "no-store");
      headers.set("x-content-type-options", "nosniff");
      headers.set("x-arena-activity-build", DISCORD_ACTIVITY_BUILD);
      return new Response(html, { status: original.status, headers });
    }

    if (request.method === "GET" && url.pathname === "/setup/discord") {
      return new Response(discordSetupPage(url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (request.method === "POST" && url.pathname === "/admin/discord/register") {
      return handleDiscordSetupRegister(request, env);
    }

    if (request.method === "GET" && url.pathname === "/telegram/sponsor/app.js") {
      return new Response(SPONSOR_PANEL_CLIENT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
    }
    if (url.pathname === "/telegram/miniapp/sponsor" && ["GET", "POST"].includes(request.method)) {
      return handleTelegramSponsor(request, env);
    }

    if (url.pathname === "/interactions" && request.method === "POST") {
      const sponsored = await maybeHandleDiscordSponsor(request, env);
      if (sponsored) return sponsored;
    }

    if (request.method === "GET" && (url.pathname === "/tg" || url.pathname === "/telegram/arena")) {
      const original = await app.fetch(request, env, ctx);
      const type = original.headers.get("content-type") || "";
      if (!type.includes("text/html")) return original;
      const headers = new Headers(original.headers);
      headers.set("cache-control", "no-store");
      return new Response(injectSponsorPanel(await original.text()), { status: original.status, headers });
    }

    return app.fetch(request, env, ctx);
  }
};
