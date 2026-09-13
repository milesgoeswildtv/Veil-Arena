import { DiscordSDK } from "@discord/embedded-app-sdk";

const $ = (id) => document.getElementById(id);
const clientId = document.body?.dataset?.discordClientId || "";
const build = document.body?.dataset?.activityBuild || "official";

const ui = {
  status: $("status"),
  step: $("step"),
  detail: $("detail"),
  channel: $("channel"),
  viewer: $("viewer"),
  players: $("players"),
  alive: $("alive"),
  roster: $("roster"),
  actions: $("actions"),
  round: $("round"),
  headline: $("headline"),
  event: $("event"),
  notice: $("notice"),
  brand: $("brand"),
  vote: $("vote"),
  voteWrap: $("voteWrap"),
  overlay: $("overlay"),
  fxTitle: $("fxTitle"),
  fxText: $("fxText")
};

let discordSdk;
let auth;
let session = "";
let current = null;
let busy = false;
let poll = null;
let lastFx = "";

function text(el, value) {
  if (el) el.textContent = String(value ?? "");
}

function stage(status, step, detail) {
  text(ui.status, status);
  text(ui.step, step);
  text(ui.detail, detail);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

async function jsonFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (session) headers.set("x-arena-session", session);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function makeButton(label, action, cls = "", extra = {}) {
  const button = document.createElement("button");
  button.className = `btn ${cls}`.trim();
  button.textContent = label;
  button.disabled = busy;
  button.onclick = () => act(action, extra);
  return button;
}

function setActions(state) {
  ui.actions?.replaceChildren();
  const add = (label, action, cls = "", extra = {}) => ui.actions?.appendChild(makeButton(label, action, cls, extra));

  if (!state?.gameId) {
    add("OPEN ARENA", "create", "primary");
    text(ui.notice, "No Arena is active in this voice channel.");
    return;
  }

  if (state.status === "registration") {
    if (!state.viewer?.joined) add("ENTER ARENA", "join", "primary");
    if (state.viewer?.joined && !state.viewer?.isHost) add("LEAVE ARENA", "leave");
    if (state.viewer?.isHost) {
      add("FILL TO 12", "fill_bots", "good");
      add("ADD 4 TEST BOTS", "add_bots");
      add("REMOVE TEST BOTS", "remove_bots");
      add("START ARENA", "start", "primary");
      add("ABORT / RESET ARENA", "abort", "danger");
    }
    text(ui.notice, state.viewer?.isHost ? "You are the host. Start when the lobby is ready." : "Registration is open.");
    return;
  }

  if (state.status === "running") {
    if (state.viewer?.isHost) add("ABORT / RESET ARENA", "abort", "danger");
    text(ui.notice, state.viewer?.alive ? "You are alive. Arena resolves automatically." : "You are spectating. Stay here for Community Showdown votes.");
    return;
  }

  if (state.status === "finished" || state.status === "cancelled") {
    add("OPEN NEW ARENA", "create", "primary");
    text(ui.notice, state.status === "finished" ? "Match complete." : "Arena reset. You can open a fresh lobby.");
  }
}

function renderRoster(state) {
  if (!ui.roster) return;
  ui.roster.innerHTML = (state.players || []).map((player) => {
    const classes = [
      "fighter",
      player.alive ? "" : "out",
      player.id === state.viewer?.id ? "me" : "",
      player.simulated ? "bot" : ""
    ].filter(Boolean).join(" ");
    return `<div class="${classes}"><span>${esc(player.displayName)}</span><b>${player.alive ? `${player.eliminations || 0} KO` : "OUT"}</b></div>`;
  }).join("") || '<div class="fighter"><span>Waiting for players…</span><b>—</b></div>';
}

function renderVote(state) {
  const open = Boolean(state.crowdVote?.open && state.viewer?.canVote);
  ui.voteWrap?.classList.toggle("hidden", !open);
  ui.vote?.replaceChildren();
  if (!open) return;

  for (const player of (state.players || []).filter((p) => p.alive)) {
    const button = makeButton(player.displayName, "vote", state.viewer?.vote === player.id ? "good" : "", { playerId: player.id });
    const count = document.createElement("span");
    count.textContent = String(state.crowdVote?.totals?.[player.id] || 0);
    button.appendChild(count);
    ui.vote.appendChild(button);
  }
}

function maybeFx(state) {
  const latest = state.latestDisplay?.text || "";
  const key = `${state.gameId || "none"}:${state.status}:${state.round}:${latest}:${state.winnerName || ""}`;
  if (key === lastFx) return;
  lastFx = key;

  let title = "";
  let body = latest;
  const upper = latest.toUpperCase();

  if (state.status === "finished" && state.winnerName) {
    title = `${state.winnerName} WINS`;
    body = state.payoutReport || latest || "Arena complete.";
  } else if (upper.includes("MASS BRAWL")) title = "MASS BRAWL";
  else if (upper.includes("REVIVAL") || upper.includes("SECOND CHANCE")) title = "SECOND CHANCE";
  else if (upper.includes("COMMUNITY SHOWDOWN") || upper.includes("FINAL BET") || upper.includes("CROWD PIN")) title = "COMMUNITY SHOWDOWN";
  else if (state.status === "running" && state.aliveCount === 5) {
    title = "FINAL FIVE";
    body = "Special protocols are disabled.";
  }

  if (!title || !ui.overlay) return;
  text(ui.fxTitle, title);
  text(ui.fxText, body);
  ui.overlay.classList.add("show");
  if (state.status !== "finished") setTimeout(() => ui.overlay?.classList.remove("show"), 3800);
}

function render(state) {
  current = state;
  const theme = state.themeId === "full_tilt"
    ? "FULL TILT // VEIL"
    : state.themeId === "vibe_queen_slots"
      ? "VIBE QUEEN SLOTS // VEIL"
      : "DWALLET // VEIL";

  text(ui.brand, theme);
  text(ui.players, state.playerCount || 0);
  text(ui.alive, state.aliveCount || 0);

  if (!state.gameId) {
    text(ui.round, "ARENA READY");
    text(ui.headline, "OPEN THE ARENA");
    text(ui.event, "Launch a real Arena for this voice channel.");
  } else if (state.status === "registration") {
    text(ui.round, "REGISTRATION");
    text(ui.headline, "THE DOORS ARE OPEN");
    text(ui.event, `${state.playerCount} player${state.playerCount === 1 ? "" : "s"} entered.`);
  } else if (state.status === "running") {
    text(ui.round, `ROUND ${state.round || 0}`);
    text(ui.headline, state.crowdVote?.open ? "THE CROWD HAS CONTROL" : state.aliveCount === 5 ? "FINAL FIVE" : "THE ARENA IS LIVE");
    text(ui.event, state.latestDisplay?.text || "Resolving the next outcome…");
  } else {
    text(ui.round, state.status === "cancelled" ? "ARENA RESET" : "MATCH COMPLETE");
    text(ui.headline, state.winnerName ? `${state.winnerName} WINS` : "ARENA COMPLETE");
    text(ui.event, state.payoutReport || state.latestDisplay?.text || "Ready for another lobby.");
  }

  renderRoster(state);
  renderVote(state);
  setActions(state);
  maybeFx(state);
}

async function refresh() {
  if (!session || busy) return;
  try {
    const data = await jsonFetch("/activity/state");
    render(data.state);
  } catch (error) {
    text(ui.notice, error.message);
  }
}

async function act(action, extra = {}) {
  if (busy) return;
  busy = true;
  if (current) setActions(current);

  try {
    const data = await jsonFetch("/activity/action", {
      method: "POST",
      body: JSON.stringify({ action, ...extra })
    });
    if (data.state) render(data.state);
    else await refresh();
    if (data.message) text(ui.notice, data.message);
  } catch (error) {
    text(ui.notice, error.message);
  } finally {
    busy = false;
    if (current) setActions(current);
  }
}

async function setupDiscordSdk() {
  if (!clientId) throw new Error("DISCORD_APPLICATION_ID is missing from the Activity page.");

  stage("CONNECTING", "1 / 4 — DISCORD READY", `Official Discord Activity build ${build}.`);

  discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();

  stage("AUTHORIZING", "2 / 4 — AUTHORIZE", "Requesting Discord authorization.");

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "applications.commands"]
  });

  const tokenResponse = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error || "Discord OAuth token exchange failed.");
  }

  stage("AUTHENTICATING", "3 / 4 — AUTHENTICATE", "Authenticating the Discord user.");

  auth = await discordSdk.commands.authenticate({
    access_token: tokenData.access_token
  });

  if (auth == null || !auth.user) throw new Error("Authenticate command failed.");
  if (!discordSdk.guildId || !discordSdk.channelId) {
    throw new Error("Discord did not provide a server voice-channel context.");
  }

  stage("CONNECTING", "4 / 4 — ARENA SESSION", "Creating the Arena session.");

  const sessionData = await jsonFetch("/api/session", {
    method: "POST",
    body: JSON.stringify({
      access_token: tokenData.access_token,
      guildId: discordSdk.guildId,
      channelId: discordSdk.channelId
    })
  });

  session = sessionData.session;
  if (!session) throw new Error("Arena session was not created.");

  text(ui.viewer, auth.user.global_name || auth.user.username || "Discord User");
  text(ui.status, "ONLINE");
  text(ui.step, "CONNECTED");
  text(ui.detail, "Discord authorization complete. Arena is online.");

  try {
    const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
    text(ui.channel, `VOICE CHANNEL // ${(channel?.name || "CONNECTED").toUpperCase()}`);
  } catch {
    text(ui.channel, "VOICE CHANNEL // CONNECTED");
  }

  await refresh();
  poll = setInterval(refresh, 1000);
}

setupDiscordSdk().catch((error) => {
  if (poll) clearInterval(poll);
  stage("CONNECTION FAILED", "VEIL COULD NOT CONNECT", error?.message || String(error));
  text(ui.notice, "Discord Activity initialization failed. The message above is the exact failing step.");
});
