import { discordRequest, registerGuildCommands } from "./discord.js";
import { VEIL_ACTIVITY_TEST_GUILD_ID } from "./server-config.js";

const EMBEDDED_FLAG = 1n << 17n;

function yes(value) { return value ? "YES" : "NO"; }
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function flagValue(app) {
  try { return BigInt(app?.flags_new ?? app?.flags ?? 0); } catch { return 0n; }
}

export async function getDiscordSetupStatus(request, env) {
  const origin = new URL(request.url).origin;
  const status = {
    applicationIdConfigured: Boolean(String(env.DISCORD_APPLICATION_ID || "").trim()),
    publicKeyConfigured: Boolean(String(env.DISCORD_PUBLIC_KEY || "").trim()),
    botTokenConfigured: Boolean(String(env.DISCORD_BOT_TOKEN || "").trim()),
    clientSecretConfigured: Boolean(String(env.DISCORD_CLIENT_SECRET || "").trim()),
    adminSecretConfigured: Boolean(String(env.ADMIN_SECRET || "").trim()),
    databaseBound: Boolean(env.DB),
    coordinatorBound: Boolean(env.ARENA_COORDINATOR),
    interactionEndpoint: `${origin}/discord/interactions`,
    testGuildId: VEIL_ACTIVITY_TEST_GUILD_ID,
    botTokenValid: false,
    appIdMatchesBotToken: false,
    publicKeyMatchesDiscord: false,
    activityEnabled: false,
    discordApplicationId: null,
    applicationName: null,
    botUsername: null,
    error: null
  };

  if (!status.botTokenConfigured) return status;
  try {
    const [app, bot] = await Promise.all([
      discordRequest("/applications/@me", env.DISCORD_BOT_TOKEN),
      discordRequest("/users/@me", env.DISCORD_BOT_TOKEN)
    ]);
    status.botTokenValid = Boolean(app?.id && bot?.id);
    status.discordApplicationId = app?.id ? String(app.id) : null;
    status.applicationName = app?.name || null;
    status.botUsername = bot?.username || null;
    status.appIdMatchesBotToken = Boolean(status.applicationIdConfigured && String(env.DISCORD_APPLICATION_ID) === String(app?.id));
    status.publicKeyMatchesDiscord = Boolean(status.publicKeyConfigured && app?.verify_key && String(env.DISCORD_PUBLIC_KEY).toLowerCase() === String(app.verify_key).toLowerCase());
    status.activityEnabled = Boolean(flagValue(app) & EMBEDDED_FLAG);
  } catch (error) {
    status.error = String(error?.message || error);
  }
  return status;
}

function row(label, ok, detail = "") {
  return `<div class="row ${ok ? "ok" : "bad"}"><b>${ok ? "✓" : "✕"} ${esc(label)}</b>${detail ? `<span>${esc(detail)}</span>` : ""}</div>`;
}

export async function discordSetupPage(request, env) {
  const s = await getDiscordSetupStatus(request, env);
  const readyForBot = s.botTokenValid && s.appIdMatchesBotToken && s.publicKeyMatchesDiscord && s.databaseBound && s.coordinatorBound;
  const installUrl = s.discordApplicationId
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(s.discordApplicationId)}&scope=bot%20applications.commands&permissions=35840`
    : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Discord Setup</title><style>
  body{font-family:system-ui;background:#0a0810;color:#f4efff;margin:0;padding:18px}.card{max-width:760px;margin:24px auto;background:#15101e;border:1px solid #46355e;border-radius:22px;padding:22px}.row{display:flex;justify-content:space-between;gap:12px;padding:12px;margin:8px 0;border-radius:12px;background:#0d0a12;border:1px solid #31253e}.row span{text-align:right;color:#bdb1c8;word-break:break-all}.ok{border-color:#305e45}.bad{border-color:#713544}.url{background:#09070c;border:1px solid #3b2b4b;padding:13px;border-radius:12px;word-break:break-all;color:#d5baff}input,button{width:100%;box-sizing:border-box;padding:14px;border-radius:12px;font-size:16px;margin-top:9px}input{background:#0a0810;color:#fff;border:1px solid #49385e}button{border:0;background:#7545d9;color:#fff;font-weight:900}.good{color:#9ce6b4}.warn{color:#ffc7d0}.small{font-size:13px;color:#aaa;line-height:1.5}a{color:#cfb4ff}</style></head><body><div class="card">
  <h1>Veil Discord — Clean Setup</h1>
  <p class="${readyForBot ? "good" : "warn"}">${readyForBot ? "BOT LAYER READY" : "BOT LAYER NEEDS ATTENTION"}</p>
  ${row("Bot token authenticates", s.botTokenValid, s.botUsername || s.error || "")}
  ${row("Application ID matches bot token", s.appIdMatchesBotToken, s.discordApplicationId || "")}
  ${row("Public Key matches Discord application", s.publicKeyMatchesDiscord)}
  ${row("Client Secret present (Activity OAuth)", s.clientSecretConfigured, s.clientSecretConfigured ? "stored" : "missing")}
  ${row("D1 database bound", s.databaseBound)}
  ${row("Arena coordinator bound", s.coordinatorBound)}
  ${row("Activities enabled in Discord", s.activityEnabled, s.activityEnabled ? "embedded flag present" : "not required until Activity phase")}
  <h2>Interactions Endpoint URL</h2><div class="url">${esc(s.interactionEndpoint)}</div>
  <p class="small">Paste that exact URL into Discord Developer Portal → General Information → Interactions Endpoint URL. Discord will send a signed PING and Veil will answer it.</p>
  ${installUrl ? `<p><a href="${esc(installUrl)}">Install Veil in a server</a></p>` : ""}
  <h2>Register test-server commands</h2>
  <form method="post" action="/admin/discord/register"><input name="guildId" value="${esc(VEIL_ACTIVITY_TEST_GUILD_ID)}" required><input name="adminSecret" type="password" placeholder="ADMIN_SECRET" required><button type="submit">VERIFY + REGISTER COMMANDS</button></form>
  <p class="small">Expected first test after registration: <b>/ping</b>. After that: <b>/arena start</b>. Activity comes only after this bot layer is verified.</p>
  </div></body></html>`;
}

export async function registerDiscordGuildFromRequest(request, env) {
  const form = await request.formData();
  if (!env.ADMIN_SECRET || String(form.get("adminSecret") || "") !== String(env.ADMIN_SECRET)) {
    return new Response("Bad admin secret", { status: 401 });
  }
  const guildId = String(form.get("guildId") || "").trim();
  if (!/^\d{15,22}$/.test(guildId)) return new Response("Invalid Discord Guild ID", { status: 400 });

  const status = await getDiscordSetupStatus(request, env);
  if (!status.botTokenValid) return new Response(`Bot token failed Discord authentication. ${status.error || ""}`, { status: 400 });
  if (!status.appIdMatchesBotToken) return new Response(`DISCORD_APPLICATION_ID does not match the application owning DISCORD_BOT_TOKEN. Discord says the token belongs to ${status.discordApplicationId || "unknown"}.`, { status: 400 });
  if (!status.publicKeyMatchesDiscord) return new Response("DISCORD_PUBLIC_KEY does not match Discord's verify_key for this application.", { status: 400 });

  const result = await registerGuildCommands(env.DISCORD_APPLICATION_ID, guildId, env.DISCORD_BOT_TOKEN);
  const names = Array.isArray(result) ? result.map(command => `/${command.name}`).join(", ") : "registered";
  return new Response(`✅ Discord bot layer verified.\nApplication: ${status.applicationName || status.discordApplicationId}\nBot: ${status.botUsername || "verified"}\nGuild: ${guildId}\nCommands: ${names}\nInteractions Endpoint: ${status.interactionEndpoint}\n\nNow run /ping in the server.`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}
