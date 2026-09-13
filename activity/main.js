import { DiscordSDK } from "@discord/embedded-app-sdk";
import "./style.css";
import "./discord-assets.css";

// Vite packages only Discord artwork, with same-origin URLs for the Activity proxy.
const discordAssets = import.meta.glob("../assets/discord/*.svg", { eager: true, query: "?url", import: "default" });
function artwork(name, className = "ui-icon") {
  const url = discordAssets[`../assets/discord/${name}.svg`];
  return url ? `<img class="${className}" src="${esc(url)}" alt="" aria-hidden="true">` : "";
}

const statusEl = document.querySelector("#status");
const contentEl = document.querySelector("#app-content");
const errorEl = document.querySelector("#error");

let discordSdk;
let auth;
let sessionToken = "";
let currentState = null;
let polling = false;
let lastFxSignature = "";
let fxTimer = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

function markdownToHtml(value) {
  let html = esc(value ?? "");
  html = html.replace(/~~\*\*\*([^\n]+?)\*\*\*~~/g, "<s><strong><em>$1</em></strong></s>");
  html = html.replace(/~~\*\*([^\n]+?)\*\*~~/g, "<s><strong>$1</strong></s>");
  html = html.replace(/\*\*\*([^\n]+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+?)__/g, "<u>$1</u>");
  html = html.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");
  html = html.replace(/`([^`\n]+?)`/g, "<code>$1</code>");
  html = html.replace(/\|\|([^|\n]+?)\|\|/g, '<span class="spoiler" tabindex="0">$1</span>');
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/^##\s+(.+)$/gm, '<span class="md-heading md-heading-2">$1</span>');
  html = html.replace(/^#\s+(.+)$/gm, '<span class="md-heading">$1</span>');
  html = html.replace(/\\\./g, ".");
  return html.replace(/\n/g, "<br>");
}

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

function ensureFxLayer() {
  let layer = document.querySelector("#fx-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

function fxParticles(layer, variant, count = 22) {
  const glyphs = variant === "revival" ? ["✦", "✧", "+"] : variant === "winner" ? ["◆", "✦", "★"] : variant === "brawl" ? ["✕", "◆", "⚡"] : ["✦", "●", "◆"];
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("i");
    particle.className = "fx-particle";
    particle.textContent = glyphs[i % glyphs.length];
    particle.style.setProperty("--x", `${8 + Math.random() * 84}vw`);
    particle.style.setProperty("--y", `${12 + Math.random() * 72}vh`);
    particle.style.setProperty("--dx", `${-70 + Math.random() * 140}px`);
    particle.style.setProperty("--dy", `${-90 - Math.random() * 150}px`);
    particle.style.setProperty("--r", `${-180 + Math.random() * 360}deg`);
    particle.style.setProperty("--delay", `${Math.random() * 0.22}s`);
    layer.appendChild(particle);
  }
}

function showFx(title, subtitle, variant = "impact") {
  const layer = ensureFxLayer();
  clearTimeout(fxTimer);
  document.body.classList.remove("fx-impact", "fx-brawl", "fx-revival", "fx-showdown", "fx-final", "fx-winner");
  void document.body.offsetWidth;
  document.body.classList.add(`fx-${variant}`);
  layer.innerHTML = `
    <div class="fx-vignette"></div>
    <div class="fx-flash"></div>
    <div class="fx-title-wrap">
      <div class="fx-kicker">VEIL // ARENA EVENT</div>
      <div class="fx-title">${esc(title)}</div>
      ${subtitle ? `<div class="fx-subtitle">${esc(subtitle)}</div>` : ""}
    </div>`;
  fxParticles(layer, variant, variant === "winner" ? 34 : 22);
  layer.classList.remove("active");
  void layer.offsetWidth;
  layer.classList.add("active");
  fxTimer = setTimeout(() => {
    layer.classList.remove("active");
    document.body.classList.remove(`fx-${variant}`);
  }, variant === "winner" ? 3000 : 2100);
}

function eventSignature(state) {
  const game = state?.game;
  if (!game) return "none";
  const event = game.lastEvent || {};
  return [game.id, game.status, game.round, game.aliveCount, game.winnerId || "", event.type || "", event.at || "", event.text || ""].join("|");
}

function triggerFx(previous, next) {
  const game = next?.game;
  if (!game) return;
  const signature = eventSignature(next);
  if (signature === lastFxSignature) return;

  const previousGame = previous?.game;
  const previousAlive = Number(previousGame?.aliveCount ?? game.aliveCount);
  const alive = Number(game.aliveCount || 0);
  const event = game.lastEvent || {};
  const eventChanged = !previousGame || String(previousGame?.lastEvent?.at || "") !== String(event.at || "") || previousGame?.lastEvent?.type !== event.type;

  if (game.winnerId && String(previousGame?.winnerId || "") !== String(game.winnerId)) {
    const winner = game.players.find(player => String(player.id) === String(game.winnerId));
    showFx("ARENA CHAMPION", winner ? `${winner.displayName} takes it.` : "One player remains.", "winner");
  } else if (previousAlive > 5 && alive <= 5 && game.status === "running") {
    showFx("FINAL FIVE", "Special events are over. Every hit matters now.", "final");
  } else if (eventChanged && event.type === "mass_brawl") {
    showFx("MASS BRAWL", "The whole Arena just went feral.", "brawl");
  } else if (eventChanged && event.type === "revival") {
    showFx("SECOND CHANCE", "Somebody is coming back.", "revival");
  } else if (eventChanged && event.type === "crowd_vote_open") {
    showFx("COMMUNITY SHOWDOWN", "Spectators decide who goes in.", "showdown");
  } else if (eventChanged && event.type === "crowd_result") {
    showFx("SHOWDOWN RESOLVED", "One survives the vote.", "showdown");
  } else if (previousGame?.status === "registration" && game.status === "running") {
    showFx("ARENA LIVE", `${alive} players entered.`, "impact");
  } else if (eventChanged && previousAlive > alive) {
    const lost = previousAlive - alive;
    showFx(lost > 1 ? `${lost} ELIMINATED` : "ELIMINATION", `${alive} player${alive === 1 ? "" : "s"} remain.`, "impact");
  }

  lastFxSignature = signature;
}

function controls(state) {
  const out = [];
  if (!state.game) {
    out.push(`<button class="primary" data-action="open">START NEW GAME</button>`);
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
      out.push(`<button class="danger" data-action="abort">FORCE CLOSE ACTIVITY</button>`);
    }
  } else if (state.viewer.isHost && ["running", "starting"].includes(state.game.status)) {
    out.push(`<button class="danger" data-action="abort">FORCE CLOSE ACTIVITY</button>`);
  } else if (state.viewer.isHost && state.game.status === "finished") {
    out.push(`<button class="primary" data-action="open">START NEW GAME</button>`);
  }
  return out.join("");
}

function sponsorshipCard() {
  return `
    <div class="sponsorship-card" aria-label="Arena sponsor">
      ${artwork("veil_ui_icon_sponsor", "sponsor-icon")}
      <div class="sponsorship-copy">
        <small>Discord Arena</small>
        <strong>DWALLET × VEIL</strong>
      </div>
    </div>`;
}

function render(state) {
  const previousState = currentState;
  currentState = state;
  contentEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  const game = state.game;
  if (!game) {
    contentEl.innerHTML = `
      <div class="panel lobby-panel">
        ${artwork("lobby_crest", "lobby-crest")}
        <div class="small">${esc(state.channelName || "Discord channel")}</div>
        <h2>No Arena is open.</h2>
        <p>Open registration for this Activity instance.</p>
        <div class="controls">${controls(state)}</div>
      </div>
      ${sponsorshipCard()}`;
    bindControls();
    lastFxSignature = "none";
    return;
  }

  const selectedVoteId = game.crowdVote?.selectedId != null ? String(game.crowdVote.selectedId) : "";
  const roster = game.players.map(player => {
    const isWinner = String(game.winnerId || "") === String(player.id);
    const isSelected = Boolean(selectedVoteId) && selectedVoteId === String(player.id);
    return `
    <div class="player ${player.alive ? "" : "dead"} ${isSelected ? "selected" : ""}" data-player-id="${esc(player.id)}">
      ${artwork(isWinner ? "veil_ui_player_state_winner" : player.alive ? "veil_ui_player_state_alive" : "veil_ui_player_state_dead", "player-state")}
      ${isSelected ? artwork("veil_ui_player_state_selected", "player-state player-state-selected") : ""}
      <span class="player-portrait">${artwork(isWinner ? "veil_ui_icon_crown" : player.alive ? "veil_ui_icon_arena" : "veil_ui_icon_skull")}</span>
      <span class="player-name">${esc(player.displayName)} ${player.simulated ? '<span class="tag">BOT</span>' : ""}</span>
      <span class="small">${player.alive ? `${player.eliminations} KO` : "ELIMINATED"}</span>
    </div>`;
  }).join("");

  const latest = [...(game.displayLog || [])].reverse()[0]?.text || game.lastEvent?.text || "Registration is open.";
  const previousLatest = previousState?.game ? ([...(previousState.game.displayLog || [])].reverse()[0]?.text || previousState.game.lastEvent?.text || "") : "";
  const feedClass = latest !== previousLatest ? "event event-new" : "event";
  const winner = game.winnerId ? game.players.find(p => String(p.id) === String(game.winnerId)) : null;
  const vote = game.crowdVote && state.viewer.canVote ? `
    <div class="panel showdown-panel">
      <div class="small section-label">${artwork("veil_ui_icon_vote")} COMMUNITY SHOWDOWN // VOTE</div>
      <div class="vote-grid">${game.crowdVote.eligibleIds.map(id => {
        const player = game.players.find(p => String(p.id) === String(id));
        if (!player) return "";
        const selected = String(game.crowdVote.selectedId || "") === String(id);
        return `<button data-vote="${esc(id)}" class="${selected ? "selected" : ""}">${selected ? "✓ " : ""}${esc(player.displayName)}</button>`;
      }).join("")}</div>
    </div>` : "";

  contentEl.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="small section-label">${artwork("veil_ui_icon_arena")} STATUS</span><b>${esc(game.status.toUpperCase())}</b></div>
      <div class="stat"><span class="small section-label">${artwork("veil_ui_icon_timer")} ROUND</span><b>${game.round}</b></div>
      <div class="stat"><span class="small section-label">${artwork("veil_ui_icon_stats")} ALIVE</span><b>${game.aliveCount}/${game.playerCount}</b></div>
    </div>
    <div class="panel arena-header ${winner ? "results-panel" : game.status === "registration" ? "lobby-panel" : "match-panel"}">
      <div class="small">${esc(state.channelName || "Discord Activity")}</div>
      ${winner ? `<div class="winner">${artwork("veil_ui_icon_crown")} ${esc(winner.displayName)} WINS</div>` : ""}
      <div class="controls">${controls(state)}</div>
    </div>
    <div class="panel feed-panel">
      <div class="small section-label">${artwork("veil_ui_icon_arena")} LIVE FEED</div>
      <div class="${feedClass}">${markdownToHtml(latest)}</div>
    </div>
    ${vote}
    <div class="panel roster-panel">
      <div class="small section-label">${artwork("veil_ui_icon_stats")} ROSTER</div>
      <div class="roster">${roster || "Nobody has entered yet."}</div>
    </div>
    ${sponsorshipCard()}`;
  bindControls();
  bindSpoilers();
  triggerFx(previousState, state);
}

function bindSpoilers() {
  document.querySelectorAll(".spoiler").forEach(spoiler => {
    const reveal = () => spoiler.classList.toggle("revealed");
    spoiler.addEventListener("click", reveal);
    spoiler.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") reveal();
    });
  });
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