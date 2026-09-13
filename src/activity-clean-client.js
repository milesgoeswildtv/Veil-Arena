function cleanActivityClient() {
  const $ = id => document.getElementById(id);
  const clientId = document.body?.dataset?.discordClientId || "";
  const build = document.body?.dataset?.activityBuild || "clean";
  const DiscordSDK = globalThis.__VEIL_OFFICIAL_DISCORD_SDK__;

  const ui = {
    status: $("status"), step: $("step"), detail: $("detail"), channel: $("channel"),
    viewer: $("viewer"), players: $("players"), alive: $("alive"), roster: $("roster"),
    actions: $("actions"), round: $("round"), headline: $("headline"), event: $("event"),
    notice: $("notice"), brand: $("brand"), vote: $("vote"), voteWrap: $("voteWrap"),
    overlay: $("overlay"), fxTitle: $("fxTitle"), fxText: $("fxText")
  };

  let sdk;
  let session = "";
  let current = null;
  let busy = false;
  let poll = null;
  let lastFx = "";

  const text = (el, value) => { if (el) el.textContent = String(value ?? ""); };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  function stage(status, step, detail) {
    text(ui.status, status);
    text(ui.step, step);
    text(ui.detail, detail);
  }

  async function timeout(promise, ms, label) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`)), ms); })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
    ui.roster.innerHTML = (state.players || []).map(player => {
      const classes = ["fighter", player.alive ? "" : "out", player.id === state.viewer?.id ? "me" : "", player.simulated ? "bot" : ""].filter(Boolean).join(" ");
      return `<div class="${classes}"><span>${esc(player.displayName)}</span><b>${player.alive ? `${player.eliminations || 0} KO` : "OUT"}</b></div>`;
    }).join("") || '<div class="fighter"><span>Waiting for players…</span><b>—</b></div>';
  }

  function renderVote(state) {
    const open = Boolean(state.crowdVote?.open && state.viewer?.canVote);
    ui.voteWrap?.classList.toggle("hidden", !open);
    ui.vote?.replaceChildren();
    if (!open) return;
    for (const player of (state.players || []).filter(p => p.alive)) {
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
    if (state.status === "finished" && state.winnerName) { title = `${state.winnerName} WINS`; body = state.payoutReport || latest || "Arena complete."; }
    else if (upper.includes("MASS BRAWL")) title = "MASS BRAWL";
    else if (upper.includes("REVIVAL") || upper.includes("SECOND CHANCE")) title = "SECOND CHANCE";
    else if (upper.includes("COMMUNITY SHOWDOWN") || upper.includes("FINAL BET") || upper.includes("CROWD PIN")) title = "COMMUNITY SHOWDOWN";
    else if (state.status === "running" && state.aliveCount === 5) { title = "FINAL FIVE"; body = "Special protocols are disabled."; }
    if (!title || !ui.overlay) return;
    text(ui.fxTitle, title); text(ui.fxText, body); ui.overlay.classList.add("show");
    if (state.status !== "finished") setTimeout(() => ui.overlay?.classList.remove("show"), 3800);
  }

  function render(state) {
    current = state;
    const theme = state.themeId === "full_tilt" ? "FULL TILT // VEIL" : state.themeId === "vibe_queen_slots" ? "VIBE QUEEN SLOTS // VEIL" : "DWALLET // VEIL";
    text(ui.brand, theme);
    text(ui.players, state.playerCount || 0);
    text(ui.alive, state.aliveCount || 0);
    if (!state.gameId) {
      text(ui.round, "ARENA READY"); text(ui.headline, "OPEN THE ARENA"); text(ui.event, "Launch a real Arena for this voice channel.");
    } else if (state.status === "registration") {
      text(ui.round, "REGISTRATION"); text(ui.headline, "THE DOORS ARE OPEN"); text(ui.event, `${state.playerCount} player${state.playerCount === 1 ? "" : "s"} entered.`);
    } else if (state.status === "running") {
      text(ui.round, `ROUND ${state.round || 0}`); text(ui.headline, state.crowdVote?.open ? "THE CROWD HAS CONTROL" : state.aliveCount === 5 ? "FINAL FIVE" : "THE ARENA IS LIVE"); text(ui.event, state.latestDisplay?.text || "Resolving the next outcome…");
    } else {
      text(ui.round, state.status === "cancelled" ? "ARENA RESET" : "MATCH COMPLETE"); text(ui.headline, state.winnerName ? `${state.winnerName} WINS` : "ARENA COMPLETE"); text(ui.event, state.payoutReport || state.latestDisplay?.text || "Ready for another lobby.");
    }
    renderRoster(state); renderVote(state); setActions(state); maybeFx(state);
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
      const data = await jsonFetch("/activity/action", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (data.state) render(data.state); else await refresh();
      if (data.message) text(ui.notice, data.message);
    } catch (error) {
      text(ui.notice, error.message);
    } finally {
      busy = false;
      if (current) setActions(current);
    }
  }

  async function boot() {
    if (!clientId) throw new Error("Veil is missing its Discord Application ID.");
    if (!DiscordSDK) throw new Error("Discord's official Embedded App SDK bundle did not load.");

    stage("CONNECTING", "1 / 4 — DISCORD READY", `Clean Activity build ${build}. Waiting for Discord.`);
    sdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });
    await timeout(sdk.ready(), 15000, "Discord READY");

    if (!sdk.guildId || !sdk.channelId) throw new Error("Discord connected but did not provide a server voice-channel context.");
    text(ui.channel, "VOICE CHANNEL // CONNECTED");

    stage("AUTHORIZING", "2 / 4 — AUTHORIZE", "Requesting Discord authorization.");
    const { code } = await timeout(sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["applications.commands", "identify", "guilds", "guilds.members.read", "rpc.voice.read"]
    }), 15000, "Discord AUTHORIZE");
    if (!code) throw new Error("Discord authorization returned no code.");

    stage("TOKEN EXCHANGE", "3 / 4 — TOKEN", "Exchanging the authorization code with Veil.");
    const token = await timeout(jsonFetch("/api/token", {
      method: "POST",
      body: JSON.stringify({ code, guildId: sdk.guildId, channelId: sdk.channelId })
    }), 15000, "Veil token exchange");
    if (!token.access_token || !token.session) throw new Error("Veil token exchange returned an incomplete response.");

    stage("AUTHENTICATING", "4 / 4 — AUTHENTICATE", "Authenticating the Discord user.");
    const auth = await timeout(sdk.commands.authenticate({ access_token: token.access_token }), 15000, "Discord AUTHENTICATE");
    if (!auth?.user) throw new Error("Discord authentication returned no user.");

    session = token.session;
    text(ui.viewer, auth.user.global_name || auth.user.username || "Discord User");
    text(ui.status, "ONLINE");
    text(ui.step, "CONNECTED");
    try {
      const channel = await timeout(sdk.commands.getChannel({ channel_id: sdk.channelId }), 6000, "Discord GET CHANNEL");
      text(ui.channel, `VOICE CHANNEL // ${(channel?.name || "CONNECTED").toUpperCase()}`);
    } catch {
      text(ui.channel, "VOICE CHANNEL // CONNECTED");
    }
    await refresh();
    poll = setInterval(refresh, 1000);
  }

  window.addEventListener("unhandledrejection", event => {
    if (!session) {
      const message = event.reason?.message || String(event.reason || "Unknown Activity error");
      stage("CONNECTION FAILED", "VEIL COULD NOT CONNECT", message);
    }
  });

  boot().catch(error => {
    if (poll) clearInterval(poll);
    stage("CONNECTION FAILED", "VEIL COULD NOT CONNECT", error?.message || String(error));
    text(ui.notice, "Close Veil and relaunch the Activity after correcting the configuration shown above.");
  });
}

export function activityCleanClientSource() {
  return `(${cleanActivityClient.toString()})();`;
}
