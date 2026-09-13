import app, { ArenaCoordinator } from "./activity-reset-entry.js";

export { ArenaCoordinator };

const DISCORD_API = "https://discord.com/api/v10";

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

async function ensureActivityEntryPoint(env) {
  if (!env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID is missing on the Worker.");
  if (!env.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is missing on the Worker.");

  const base = `/applications/${env.DISCORD_APPLICATION_ID}/commands`;
  const commands = await discordApi(base, env.DISCORD_BOT_TOKEN, { method: "GET" });
  const existing = Array.isArray(commands) ? commands.find(command => Number(command.type) === 4) : null;
  const payload = {
    name: "launch",
    description: "Launch Veil Arena",
    type: 4,
    handler: 2,
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  };

  if (existing?.id) {
    const updated = await discordApi(`${base}/${existing.id}`, env.DISCORD_BOT_TOKEN, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return { created: false, command: updated };
  }

  const created = await discordApi(base, env.DISCORD_BOT_TOKEN, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return { created: true, command: created };
}

function setupPage(origin, env) {
  const ready = Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_BOT_TOKEN && env.ADMIN_SECRET);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Activity Repair</title><style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0b0810;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,620px);background:linear-gradient(180deg,#1c1428,#120d19);border:1px solid #49345f;padding:24px;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.38)}h1{margin:0 0 8px}.muted{color:#b9a9c7;line-height:1.5;font-size:13px}.status{padding:11px;border-radius:11px;background:#0c0911;border:1px solid #392849;margin:15px 0;color:${ready ? "#9af0c1" : "#ff9bb4"};font-weight:800}label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#cfb8e6;margin:14px 0}input,button{width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:16px}input{background:#0b0810;color:#fff;border:1px solid #463356}button{border:0;background:#8f59f7;color:white;font-weight:950}.hint{color:#9588a0;font-size:11px;margin-top:14px}</style></head><body><div class="card">
<h1>🎮 Veil Activity Launch Repair</h1>
<p class="muted">Your screenshot shows Veil's commands but no <b>Launch</b> button. This repairs the missing global Discord Activity Entry Point without touching your Arena data.</p>
<div class="status">${ready ? "✓ Worker credentials ready" : "✕ Worker is missing Discord/Application/Admin credentials"}</div>
<form method="post" action="/admin/activity/register">
<label>Cloudflare ADMIN_SECRET<input type="password" name="adminSecret" required autocomplete="current-password"></label>
<button type="submit">CREATE / REPAIR VEIL LAUNCH BUTTON</button>
</form>
<p class="hint">Worker: ${esc(origin)}<br>Discord Activities must also remain enabled in Developer Portal and the <code>/</code> URL mapping must point at this Worker.</p>
</div></body></html>`;
}

function resultPage(ok, message, command) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veil Activity Repair</title><style>body{font-family:system-ui;margin:0;background:#0b0810;color:#fff;display:grid;place-items:center;min-height:100vh;padding:18px}.card{width:min(92vw,620px);background:#17101f;border:1px solid #49345f;padding:24px;border-radius:18px}.good{color:#9af0c1}.bad{color:#ff9bb4}.detail{white-space:pre-wrap;word-break:break-word;background:#0b0810;padding:12px;border-radius:10px}a{color:#c8a7ff}</style></head><body><div class="card"><h1 class="${ok ? "good" : "bad"}">${ok ? "✅ Veil Activity registered" : "❌ Activity registration failed"}</h1>${ok ? `<p><b>Entry Point:</b> ${esc(command?.name || "launch")}<br><b>Type:</b> PRIMARY_ENTRY_POINT<br><b>Handler:</b> DISCORD_LAUNCH_ACTIVITY</p><p class="good">Fully close Discord's Veil panel, reopen the App Launcher, and Veil should now show a <b>Launch</b> button.</p>` : ""}<div class="detail">${esc(message)}</div><p><a href="/setup/activity">Back</a></p></div></body></html>`;
}

async function registerActivity(request, env) {
  try {
    if (!env.ADMIN_SECRET) throw new Error("ADMIN_SECRET is missing on this Worker.");
    const contentType = request.headers.get("content-type") || "";
    let provided = request.headers.get("x-admin-secret") || "";
    let wantsHtml = false;
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      provided = provided || String(form.get("adminSecret") || "");
      wantsHtml = true;
    } else {
      const body = await request.json().catch(() => ({}));
      provided = provided || String(body.adminSecret || "");
    }
    if (provided !== env.ADMIN_SECRET) throw new Error("ADMIN_SECRET does not match this Worker.");
    const result = await ensureActivityEntryPoint(env);
    const message = result.created ? "Discord created the Veil Activity Entry Point." : "Discord repaired the existing Veil Activity Entry Point.";
    if (wantsHtml) return new Response(resultPage(true, message, result.command), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return json({ ok: true, ...result, message });
  } catch (error) {
    const message = String(error?.message || error);
    const contentType = request.headers.get("content-type") || "";
    const wantsHtml = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
    if (wantsHtml) return new Response(resultPage(false, message, null), { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return json({ ok: false, error: message }, 400);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/setup/activity") {
      return new Response(setupPage(url.origin, env), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (request.method === "POST" && url.pathname === "/admin/activity/register") {
      return registerActivity(request, env);
    }
    if (request.method === "GET" && url.pathname === "/setup/activity/health") {
      return json({ ok: true, applicationId: Boolean(env.DISCORD_APPLICATION_ID), botToken: Boolean(env.DISCORD_BOT_TOKEN), adminSecret: Boolean(env.ADMIN_SECRET) });
    }
    return app.fetch(request, env, ctx);
  }
};
