import app, { ArenaCoordinator } from "./activity-entrypoint-entry.js";

export { ArenaCoordinator };

const DISCORD_API = "https://discord.com/api/v10";
const EMBEDDED_FLAG = 1 << 17;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

async function discordApi(path, token, init = {}) {
  if (!token) throw new Error("DISCORD_BOT_TOKEN is missing on the Worker.");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data || {});
    throw new Error(`Discord API ${response.status}: ${detail}`);
  }
  return data;
}

async function diagnostics(env) {
  if (!env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID is missing on the Worker.");
  if (!env.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is missing on the Worker.");

  const [application, commands] = await Promise.all([
    discordApi("/applications/@me", env.DISCORD_BOT_TOKEN, { method: "GET" }),
    discordApi(`/applications/${env.DISCORD_APPLICATION_ID}/commands`, env.DISCORD_BOT_TOKEN, { method: "GET" })
  ]);

  const flags = Number(application?.flags || 0);
  const embedded = Boolean(flags & EMBEDDED_FLAG);
  const entry = Array.isArray(commands) ? commands.find(command => Number(command.type) === 4) : null;
  return {
    applicationName: application?.name || "Veil",
    applicationIdMatches: String(application?.id || "") === String(env.DISCORD_APPLICATION_ID),
    embedded,
    entryPoint: Boolean(entry),
    entryPointName: entry?.name || null,
    entryPointHandler: entry ? Number(entry.handler || 0) : null,
    entryPointDiscordLaunches: Number(entry?.handler || 0) === 2,
    globalCommandCount: Array.isArray(commands) ? commands.length : 0
  };
}

async function repair(env) {
  const before = await diagnostics(env);
  if (!before.applicationIdMatches) {
    throw new Error("The Worker DISCORD_APPLICATION_ID does not match the bot token's Discord application. Fix the Worker credentials first.");
  }
  if (!before.embedded) {
    throw new Error("Discord says Veil is NOT flagged as an Embedded Activity. In Developer Portal → Activities → Settings, enable Activities and save. On iPhone also enable iOS under Supported Platforms. Then run this repair again.");
  }

  const base = `/applications/${env.DISCORD_APPLICATION_ID}/commands`;
  const commands = await discordApi(base, env.DISCORD_BOT_TOKEN, { method: "GET" });
  const existing = Array.isArray(commands) ? commands.find(command => Number(command.type) === 4) : null;
  const payload = {
    name: "launch",
    description: "Launch Veil Arena",
    type: 4,
    handler: 2,
    integration_types: [0],
    contexts: [0]
  };

  if (existing?.id) {
    await discordApi(`${base}/${existing.id}`, env.DISCORD_BOT_TOKEN, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  } else {
    await discordApi(base, env.DISCORD_BOT_TOKEN, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  const after = await diagnostics(env);
  if (!after.entryPoint || !after.entryPointDiscordLaunches) {
    throw new Error("Discord accepted the request but the verified Activity Entry Point is still missing or has the wrong handler.");
  }
  return after;
}

function badge(label, ok, detail = "") {
  return `<div class="row ${ok ? "good" : "bad"}"><span>${ok ? "✓" : "✕"}</span><b>${esc(label)}</b><em>${esc(detail || (ok ? "READY" : "MISSING"))}</em></div>`;
}

function page(origin, env, d = null, error = "") {
  const rows = d ? [
    badge("Worker ↔ Discord app ID", d.applicationIdMatches, d.applicationIdMatches ? "MATCH" : "MISMATCH"),
    badge("Discord Embedded / Activity flag", d.embedded, d.embedded ? "ENABLED" : "DISABLED"),
    badge("Global Activity Entry Point", d.entryPoint, d.entryPoint ? String(d.entryPointName || "launch") : "MISSING"),
    badge("Entry Point launches Activity", d.entryPointDiscordLaunches, d.entryPointHandler == null ? "NO HANDLER" : `HANDLER ${d.entryPointHandler}`)
  ].join("") : badge("Discord live diagnostics", false, "UNAVAILABLE");

  const ready = Boolean(d?.applicationIdMatches && d?.embedded && d?.entryPoint && d?.entryPointDiscordLaunches);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Activity Doctor</title><style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#09070d;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(94vw,650px);background:linear-gradient(180deg,#1d1429,#100b17);border:1px solid #49345f;padding:22px;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.4)}h1{margin:0 0 6px}.muted{color:#bbaac8;font-size:13px;line-height:1.5}.rows{display:grid;gap:7px;margin:16px 0}.row{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:10px 11px;border-radius:11px;background:#0b0810;font-size:12px}.row em{font-style:normal;font-size:10px;font-weight:950;letter-spacing:.06em}.good{color:#98efbd}.bad{color:#ff9bb4}.status{padding:12px;border-radius:11px;background:#0b0810;border:1px solid #392849;margin:14px 0;color:${ready ? "#98efbd" : "#ffb1c4"};font-weight:850}label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#cfb8e6;margin:14px 0}input,button{width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:16px}input{background:#09070d;color:#fff;border:1px solid #463356}button{border:0;background:#8f59f7;color:#fff;font-weight:950}.err{white-space:pre-wrap;word-break:break-word;color:#ff9bb4;background:#150a10;padding:10px;border-radius:10px}.hint{font-size:11px;color:#9789a1;margin-top:14px;line-height:1.5}code{background:#08060b;padding:2px 5px;border-radius:5px}</style></head><body><div class="card">
<h1>🎮 Veil Activity Doctor</h1>
<p class="muted">This page asks Discord directly whether Veil is actually an Activity and whether its Launch Entry Point exists. It does not rely on the Discord mobile cache.</p>
<div class="rows">${rows}</div>
<div class="status">${ready ? "✓ DISCORD SAYS VEIL IS LAUNCHABLE" : "⚠ VEIL IS NOT FULLY LAUNCHABLE YET"}</div>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<form method="post" action="/admin/activity/doctor-repair">
<label>Cloudflare ADMIN_SECRET<input type="password" name="adminSecret" required autocomplete="current-password"></label>
<button type="submit">VERIFY + FORCE REPAIR ACTIVITY</button>
</form>
<p class="hint">Worker: ${esc(origin)}<br>If <b>Embedded / Activity flag</b> is red, code cannot turn that flag on; Discord requires it in Developer Portal → Activities → Settings. If you are testing on this iPhone, <b>iOS must be enabled under Supported Platforms</b>.</p>
</div></body></html>`;
}

async function authorizedSecret(request, env) {
  const contentType = request.headers.get("content-type") || "";
  let provided = request.headers.get("x-admin-secret") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    provided = provided || String(form.get("adminSecret") || "");
  } else {
    const body = await request.json().catch(() => ({}));
    provided = provided || String(body.adminSecret || "");
  }
  if (!env.ADMIN_SECRET) throw new Error("ADMIN_SECRET is missing on this Worker.");
  if (provided !== env.ADMIN_SECRET) throw new Error("ADMIN_SECRET does not match this Worker.");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/setup/activity") {
      try {
        const d = await diagnostics(env);
        return new Response(page(url.origin, env, d), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (error) {
        return new Response(page(url.origin, env, null, String(error?.message || error)), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }

    if (request.method === "GET" && url.pathname === "/setup/activity/health") {
      try { return json({ ok: true, ...(await diagnostics(env)) }); }
      catch (error) { return json({ ok: false, error: String(error?.message || error) }, 500); }
    }

    if (request.method === "POST" && url.pathname === "/admin/activity/doctor-repair") {
      try {
        await authorizedSecret(request, env);
        const d = await repair(env);
        return new Response(page(url.origin, env, d), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (error) {
        let d = null;
        try { d = await diagnostics(env); } catch {}
        return new Response(page(url.origin, env, d, String(error?.message || error)), { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }

    return app.fetch(request, env, ctx);
  }
};
