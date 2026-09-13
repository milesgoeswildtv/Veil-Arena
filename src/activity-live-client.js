async function activityClient() {
  const sdkPath = "/activity/sdk.js";
  const { DiscordSDK } = await import(sdkPath);
  const $ = id => document.getElementById(id);
  const clientId = document.body.dataset.discordClientId || "";
  const ui = {
    connection: $("connection"), location: $("location"), system: $("system"), title: $("title"), brand: $("brand"),
    round: $("round"), headline: $("headline"), event: $("event"), roster: $("roster"), stage: $("stage"),
    overlay: $("overlay"), fxKicker: $("fxKicker"), fxTitle: $("fxTitle"), fxSub: $("fxSub"),
    viewerName: $("viewerName"), viewerStatus: $("viewerStatus"), playerCount: $("playerCount"), aliveCount: $("aliveCount"),
    notice: $("notice"), actions: $("actions"), votePanel: $("votePanel"), vote: $("vote")
  };

  let discordSdk = null;
  let sessionToken = "";
  let viewer = null;
  let current = null;
  let pollTimer = null;
  let busy = false;
  let lastFxKey = "";
  let fxTimer = null;

  function text(el, value) { if (el) el.textContent = String(value ?? ""); }
  function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
  function setNotice(message, error = false) { text(ui.notice, message); ui.notice?.classList.toggle("error", error); }
  function button(label, action, cls = "", payload = {}) {
    const b = document.createElement("button");
    b.className = `btn ${cls}`.trim();
    b.textContent = label;
    b.disabled = busy;
    b.addEventListener("click", () => act(action, payload));
    return b;
  }
  function clearActions() { if (ui.actions) ui.actions.replaceChildren(); }
  function addAction(label, action, cls = "", payload = {}) { ui.actions?.appendChild(button(label, action, cls, payload)); }
  function closeFx() { if (fxTimer) clearTimeout(fxTimer); fxTimer = null; ui.overlay?.classList.remove("show"); }
  function showFx(kicker, title, sub, duration = 4200) {
    if (!ui.overlay) return;
    text(ui.fxKicker, kicker); text(ui.fxTitle, title); text(ui.fxSub, sub); ui.overlay.classList.add("show");
    if (fxTimer) clearTimeout(fxTimer);
    if (duration) fxTimer = setTimeout(closeFx, duration);
  }
  function themeClass(state) {
    const id = state?.themeId || "";
    if (id === "full_tilt") return { brand: "FULL TILT // VEIL", title: "FULL TILT ARENA" };
    if (id === "vibe_queen_slots") return { brand: "VIBE QUEEN SLOTS // VEIL", title: "ARENA AFTER DARK" };
    return { brand: "DWALLET // VEIL", title: "DWALLET ARENA" };
  }

  async function api(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (sessionToken) headers.set("x-arena-session", sessionToken);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function setupDiscord() {
    if (!clientId) throw new Error("DISCORD_APPLICATION_ID is missing from the Activity Worker.");
    text(ui.connection, "CONNECTING TO DISCORD");
    discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
    const guildId = discordSdk.guildId;
    const channelId = discordSdk.channelId;
    if (!guildId || !channelId) throw new Error("Launch Veil Arena from a server voice channel.");
    const { code } = await discordSdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"]
    });
    const token = await fetch("/activity/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, guildId, channelId })
    });
    const payload = await token.json().catch(() => ({}));
    if (!token.ok || !payload.access_token || !payload.session) throw new Error(payload.error || "Discord OAuth failed.");
    const auth = await discordSdk.commands.authenticate({ access_token: payload.access_token });
    if (!auth?.user) throw new Error("Discord authenticate failed.");
    sessionToken = payload.session;
    viewer = auth.user;
    text(ui.viewerName, viewer.global_name || viewer.username || "Discord User");
    text(ui.viewerStatus, "Connected to this Activity instance");
    text(ui.connection, "LIVE ACTIVITY");
    try {
      const channel = await discordSdk.commands.getChannel({ channel_id: channelId });
      text(ui.location, `VOICE CHANNEL // ${(channel?.name || "ARENA").toUpperCase()}`);
    } catch {
      text(ui.location, "VOICE CHANNEL // ARENA");
    }
    await refresh();
    pollTimer = setInterval(refresh, 1000);
  }

  function renderRoster(state) {
    if (!ui.roster) return;
    ui.roster.innerHTML = (state.players || []).map(p => {
      const cls = ["fighter", !p.alive ? "out" : "", p.id === state.viewer?.id ? "me" : "", p.simulated ? "bot" : ""].filter(Boolean).join(" ");
      const right = p.alive ? `${p.eliminations || 0} KO` : "OUT";
      return `<div class="${cls}"><span>${escapeHtml(p.displayName)}</span><span>${right}</span></div>`;
    }).join("") || '<div class="fighter"><span>Waiting for players…</span><span>—</span></div>';
  }

  function maybeFx(state) {
    ui.stage?.classList.toggle("finalfive", state.status === "running" && state.aliveCount === 5);
    const latest = state.latestDisplay;
    if (state.status === "finished" && state.winnerName) {
      const key = `winner:${state.gameId}:${state.winnerName}`;
      if (lastFxKey !== key) {
        lastFxKey = key;
        showFx("🏆 ARENA COMPLETE", `${state.winnerName} WINS`, state.payoutReport || "One player is left.", 0);
      }
      return;
    }
    if (!latest?.at) return;
    const key = `${latest.at}:${latest.text}`;
    if (key === lastFxKey) return;
    lastFxKey = key;
    const msg = String(latest.text || "");
    const upper = msg.toUpperCase();
    if (upper.includes("MASS BRAWL")) {
      ui.stage?.classList.add("lockdown");
      showFx("⚠ ARENA OVERRIDE", "MASS BRAWL", msg, 5000);
      setTimeout(() => ui.stage?.classList.remove("lockdown"), 5200);
    } else if (upper.includes("REVIVAL") || upper.includes("SECOND CHANCE")) {
      showFx("⚡ RECOVERY PROTOCOL", "SECOND CHANCE", msg, 4300);
    } else if (upper.includes("FINAL BET") || upper.includes("FINAL SCARE") || upper.includes("CROWD PIN") || upper.includes("COMMUNITY SHOWDOWN")) {
      showFx("👁 CROWD DECISION", "SHOWDOWN", msg, 4200);
    } else if (state.aliveCount === 5) {
      showFx("☠ ENDGAME", "FINAL FIVE", "Special protocols are disabled. Nobody is coming to save you.", 3500);
    }
  }

  function renderVote(state) {
    if (!ui.votePanel || !ui.vote) return;
    const vote = state.crowdVote;
    const can = Boolean(vote?.open && state.viewer?.canVote);
    ui.votePanel.classList.toggle("hidden", !can);
    if (!can) { ui.vote.replaceChildren(); return; }
    ui.vote.replaceChildren();
    for (const p of state.players.filter(x => x.alive)) {
      const b = button(p.displayName, "vote", state.viewer.vote === p.id ? "good" : "", { playerId: p.id });
      const score = document.createElement("span");
      score.textContent = String(vote.totals?.[p.id] || 0);
      b.appendChild(score);
      ui.vote.appendChild(b);
    }
  }

  function renderActions(state) {
    clearActions();
    if (!state.gameId) {
      addAction("OPEN ARENA", "create", "primary");
      setNotice("No Arena is active in this voice channel. Open one here — the Activity becomes the match lobby.");
      return;
    }
    if (state.status === "registration") {
      if (!state.viewer.joined) addAction("ENTER ARENA", "join", "primary");
      else if (!state.viewer.isHost) addAction("LEAVE ARENA", "leave", "");
      if (state.viewer.isHost) {
        addAction("FILL TO 12", "fill_bots", "good");
        addAction("ADD 4 TEST BOTS", "add_bots", "");
        addAction("REMOVE TEST BOTS", "remove_bots", "");
        addAction("START ARENA", "start", "primary");
        addAction("CANCEL LOBBY", "cancel", "danger");
        setNotice("You are the host. Real VC users join here; test bots use the same Arena engine and never count toward real stats.");
      } else {
        setNotice(state.viewer.joined ? "You are entered. Waiting for the host to start." : "Registration is open. Enter from this Activity window.");
      }
      return;
    }
    if (state.status === "running") {
      if (state.viewer.alive) setNotice("You are still alive. The Arena is resolving automatically inside this Activity.");
      else if (state.crowdVote?.open) setNotice(state.viewer.canVote ? "You are eliminated — the Community Showdown vote is yours now." : "Community Showdown is open.");
      else setNotice("You are eliminated. Stay in the Activity — spectator votes and the rest of the match happen here.");
      return;
    }
    if (state.status === "finished") {
      addAction("OPEN NEW ARENA", "create", "primary");
      setNotice("Match complete. Stats and sponsored payout accounting are saved; a new VC Arena can be opened here.");
    }
  }

  function render(state) {
    current = state;
    const theme = themeClass(state);
    text(ui.brand, theme.brand);
    text(ui.title, theme.title);
    text(ui.playerCount, state.playerCount || 0);
    text(ui.aliveCount, state.aliveCount || 0);
    text(ui.system, state.status ? String(state.status).toUpperCase() : "READY");
    if (!state.gameId) {
      text(ui.round, "ARENA READY");
      text(ui.headline, "OPEN THE ARENA");
      text(ui.event, "Launch a real Arena for this voice channel. Everyone in the Activity can enter from here.");
    } else if (state.status === "registration") {
      text(ui.round, "REGISTRATION");
      text(ui.headline, "THE DOORS ARE OPEN");
      text(ui.event, `${state.playerCount} player${state.playerCount === 1 ? "" : "s"} entered. Host starts when ready.`);
    } else if (state.status === "running") {
      text(ui.round, `ROUND ${state.round || 0}`);
      text(ui.headline, state.crowdVote?.open ? "THE CROWD HAS CONTROL" : state.aliveCount === 5 ? "FINAL FIVE" : "THE ARENA IS LIVE");
      text(ui.event, state.latestDisplay?.text || "The next outcome is loading…");
    } else {
      text(ui.round, `MATCH COMPLETE // ${state.round || 0} ROUNDS`);
      text(ui.headline, state.winnerName ? `${state.winnerName} WINS` : "ARENA COMPLETE");
      text(ui.event, state.payoutReport || state.latestDisplay?.text || "The Arena is over.");
    }
    renderRoster(state);
    renderActions(state);
    renderVote(state);
    maybeFx(state);
  }

  async function refresh() {
    if (!sessionToken || busy) return;
    try {
      const data = await api("/activity/state");
      render(data.state);
    } catch (error) {
      setNotice(error.message, true);
      text(ui.connection, "CONNECTION ERROR");
    }
  }

  async function act(action, extra = {}) {
    if (busy) return;
    busy = true;
    if (current) renderActions(current);
    try {
      const data = await api("/activity/action", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (data.message) setNotice(data.message);
      if (data.state) render(data.state); else await refresh();
    } catch (error) {
      setNotice(error.message, true);
    } finally {
      busy = false;
      if (current) renderActions(current);
    }
  }

  window.addEventListener("error", event => {
    text(ui.connection, "ACTIVITY ERROR");
    setNotice(event.message || "Activity error", true);
  });
  window.addEventListener("unhandledrejection", event => {
    text(ui.connection, "ACTIVITY ERROR");
    setNotice(event.reason?.message || String(event.reason || "Activity error"), true);
  });

  setupDiscord().catch(error => {
    text(ui.connection, "SETUP REQUIRED");
    text(ui.system, "AUTH FAILED");
    text(ui.headline, "ACTIVITY NEEDS ONE SETUP FIX");
    text(ui.event, error.message);
    setNotice(error.message, true);
    clearActions();
  });
}

export const ACTIVITY_LIVE_CLIENT = `(${activityClient.toString()})();`;
