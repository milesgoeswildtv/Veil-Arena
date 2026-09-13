import { DiscordSDK } from "@discord/embedded-app-sdk";
import "./style.css";

const statusEl = document.querySelector("#status");
const contentEl = document.querySelector("#app-content");
const errorEl = document.querySelector("#error");

let discordSdk;
let auth;
let sessionToken = "";
let currentState = null;
let polling = false;

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

function status(text) {
  statusEl.textContent = text;
}

function showError(error) {
  const message = String(error?.message || error || "Unknown error");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
  status(`ERROR // ${message}`);
}

async function jsonFetch(url, init = {}) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

async function activityApi(path, init = {}) {
  return jsonFetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-veil-session": sessionToken,
      ...(init.headers || {})
    }
  });
}

function controls(state) {
  const out = [];
  if (!state.game) {
    out.push(`<button class="primary" data-action="open">OPEN ARENA</button>`);
    return out.join("");
  }
  if (state.game.status === "registration") {
    if (!state.viewer.joined) out.push(`<button class="primary" data-action="join">ENTER ARENA</button>`);
    else if (!state.viewer.isHost) out.push(`<button data-action="leave">LEAVE</button>`);
    if (state.viewer.isHost) {
      if (state.testMode) {
        out.push(`<button data-action="add4">ADD 4 TEST BOTS</button>`);
        out.push(`<button data-action="fill">FILL TO 12</button>`);
      }
      out.push(`<button class="primary" data-action="start">START ARENA</button>`);
      out.push(`<button class="danger" data-action="abort">ABORT / RESET</button>`);
    }
  } else if (state.viewer.isHost && state.game.status === "running") {
    out.push(`<button class="danger" data-action="abort">ABORT / RESET</button>`);
  }
  return out.join("");
}

function render(state) {
  currentState = state;
  contentEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  const game = state.game;
  if (!game) {
    contentEl.innerHTML = `
      <div class="panel">
        <div class="small">${esc(state.channelName || "Discord channel")}</div>
        <h2>No Arena is open.</h2>
        <p>Open registration for this Activity instance.</p>
        <div class="controls">${controls(state)}</div>
      </div>`;
    bindControls();
    return;
  }

  const roster = game.players.map(player => `
    <div class="player ${player.alive ? "" : "dead"}">
      <span>${esc(player.displayName)} ${player.simulated ? '<span class="tag">BOT</span>' : ""}</span>
      <span class="small">${player.alive ? `${player.eliminations} KO` : "ELIMINATED"}</span>
    </div>`).join("");

  const latest = [...(game.displayLog || [])].reverse()[0]?.text || game.lastEvent?.text || "Registration is open.";
  const winner = game.winnerId ? game.players.find(p => String(p.id) === String(game.winnerId)) : null;
  const vote = game.crowdVote && state.viewer.canVote ? `
    <div class="panel">
      <div class="small">COMMUNITY SHOWDOWN // VOTE</div>
      <div class="vote-grid">${game.crowdVote.eligibleIds.map(id => {
        const player = game.players.find(p => String(p.id) === String(id));
        if (!player) return "";
        const selected = String(game.crowdVote.selectedId || "") === String(id);
        return `<button data-vote="${esc(id)}">${selected ? "✓ " : ""}${esc(player.displayName)}</button>`;
      }).join("")}</div>
    </div>` : "";

  contentEl.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="small">STATUS</span><b>${esc(game.status.toUpperCase())}</b></div>
      <div class="stat"><span class="small">ROUND</span><b>${game.round}</b></div>
      <div class="stat"><span class="small">ALIVE</span><b>${game.aliveCount}/${game.playerCount}</b></div>
    </div>
    <div class="panel">
      <div class="small">${esc(state.channelName || "Discord Activity")}</div>
      ${winner ? `<div class="winner">🏆 ${esc(winner.displayName)} WINS</div>` : ""}
      <div class="controls">${controls(state)}</div>
    </div>
    <div class="panel">
      <div class="small">LIVE FEED</div>
      <div class="event">${esc(latest)}</div>
    </div>
    ${vote}
    <div class="panel">
      <div class="small">ROSTER</div>
      <div class="roster">${roster || "Nobody has entered yet."}</div>
    </div>`;
  bindControls();
}

function bindControls() {
  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const state = await activityApi("/api/activity/action", {
          method: "POST",
          body: JSON.stringify({ action: button.dataset.action })
        });
        render(state);
      } catch (error) {
        showError(error);
      } finally {
        button.disabled = false;
      }
    });
  });
  document.querySelectorAll("[data-vote]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const state = await activityApi("/api/activity/action", {
          method: "POST",
          body: JSON.stringify({ action: "vote", targetId: button.dataset.vote })
        });
        render(state);
      } catch (error) {
        showError(error);
      }
    });
  });
}

async function refresh() {
  if (!sessionToken || polling) return;
  polling = true;
  try {
    render(await activityApi("/api/activity/state"));
  } catch (error) {
    showError(error);
  } finally {
    polling = false;
  }
}

async function setupDiscordSdk() {
  status("1 / 5 — LOADING CONFIG");
  const config = await jsonFetch("/api/activity/config");

  status("2 / 5 — DISCORD READY");
  discordSdk = new DiscordSDK(config.clientId);
  await discordSdk.ready();

  status("3 / 5 — AUTHORIZE");
  const { code } = await discordSdk.commands.authorize({
    client_id: config.clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "applications.commands"]
  });

  status("4 / 5 — AUTHENTICATE");
  const token = await jsonFetch("/api/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code })
  });
  auth = await discordSdk.commands.authenticate({ access_token: token.access_token });
  if (!auth) throw new Error("Discord authenticate command failed.");

  let channelName = "Discord Activity";
  if (discordSdk.channelId && discordSdk.guildId) {
    const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId }).catch(() => null);
    if (channel?.name) channelName = channel.name;
  }

  status("5 / 5 — ARENA SESSION");
  const session = await jsonFetch("/api/activity/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token.access_token}`
    },
    body: JSON.stringify({
      guildId: discordSdk.guildId,
      channelId: discordSdk.channelId,
      instanceId: discordSdk.instanceId || null,
      channelName
    })
  });
  sessionToken = session.session;
  status(`ONLINE // ${channelName}`);
  await refresh();
  setInterval(refresh, 1000);
}

setupDiscordSdk().catch(showError);
