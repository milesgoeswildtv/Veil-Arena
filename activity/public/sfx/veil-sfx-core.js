(() => {
  const CHUNKS = Array.from({ length: 15 }, (_, i) => `/sfx/chunks/veil-sfx-${String(i).padStart(2, "0")}.b64`);
  const VOLUME = 0.78;
  const CUES = {
    click: [0.000000, 0.110023],
    confirm: [0.190023, 0.250023],
    countdown: [0.520045, 0.160000],
    join: [0.760045, 0.420000],
    revival: [1.260045, 1.600000],
    elimination: [2.940045, 1.050000],
    elimination2: [4.070045, 1.350000],
    elimination3: [5.500045, 1.650000],
    start: [7.230045, 1.850000],
    brawl: [9.160045, 2.050000],
    duel: [11.290045, 1.600000],
    final: [12.970045, 2.500000],
    victory: [15.550045, 2.900000],
    vote: [18.530045, 1.150000],
    round: [19.760045, 0.720000],
    glitch: [20.560045, 1.100000]
  };

  let ctx = null;
  let buffer = null;
  let loading = null;
  let previous = null;
  let deadline = null;
  let deadlineCueKey = "";

  function audioContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    return ctx;
  }

  async function loadSprite() {
    if (buffer) return buffer;
    if (loading) return loading;
    const c = audioContext();
    if (!c) return null;
    loading = Promise.all(CHUNKS.map(url => fetch(url).then(r => {
      if (!r.ok) throw new Error(`SFX chunk failed: ${url}`);
      return r.text();
    })))
      .then(parts => parts.join(""))
      .then(text => {
        const raw = atob(text.trim());
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return c.decodeAudioData(bytes.buffer);
      })
      .then(decoded => (buffer = decoded))
      .catch(() => null);
    return loading;
  }

  async function play(name, delay = 0) {
    if (delay > 0) {
      setTimeout(() => play(name), delay);
      return;
    }
    const cue = CUES[name];
    if (!cue) return;
    try {
      const c = audioContext();
      if (!c) return;
      if (c.state === "suspended") await c.resume().catch(() => {});
      const decoded = await loadSprite();
      if (!decoded || c.state !== "running") return;
      const source = c.createBufferSource();
      const gain = c.createGain();
      source.buffer = decoded;
      gain.gain.value = VOLUME;
      source.connect(gain);
      gain.connect(c.destination);
      source.start(0, cue[0], cue[1]);
    } catch {}
  }

  function normalize(payload) {
    if (!payload || typeof payload !== "object") return null;
    const game = Object.prototype.hasOwnProperty.call(payload, "game") ? payload.game : payload;
    if (!game || typeof game !== "object" || !game.status) return null;
    const count = Number(game.aliveCount);
    return {
      id: String(game.id || game.gameId || (Object.prototype.hasOwnProperty.call(payload, "game") ? "discord" : "telegram")),
      status: String(game.status || ""),
      round: Number(game.round || 0),
      aliveCount: Number.isFinite(count) ? count : Array.isArray(game.aliveIds) ? game.aliveIds.length : 0,
      winnerId: game.winnerId == null ? "" : String(game.winnerId),
      lastEvent: game.lastEvent || null,
      crowdVote: game.crowdVote || null,
      nextAdvanceAt: Number(game.nextAdvanceAt || 0) || null
    };
  }

  function eventKey(event) {
    if (!event) return "";
    return [event.type || "", event.round || "", event.at || "", event.text || ""].join("|");
  }

  function eliminationCue(round) {
    const names = ["elimination", "elimination2", "elimination3"];
    return names[Math.abs((Number(round) || 1) - 1) % names.length];
  }

  function updateDeadline(state) {
    const next = Number(state?.crowdVote?.closesAt || state?.nextAdvanceAt || 0) || null;
    if (next !== deadline) {
      deadline = next;
      deadlineCueKey = "";
    }
  }

  function handleState(payload) {
    const current = normalize(payload);
    if (!current) return;
    updateDeadline(current);

    const prior = previous;
    previous = current;
    if (!prior || prior.id !== current.id) return;

    if (current.status === "finished" && (prior.status !== "finished" || prior.winnerId !== current.winnerId)) {
      play("victory");
      return;
    }

    if (prior.status === "registration" && current.status === "running") {
      play("start");
      return;
    }

    if (prior.aliveCount > 5 && current.aliveCount <= 5 && current.status === "running") {
      play("final");
      return;
    }

    const changedEvent = eventKey(current.lastEvent) && eventKey(current.lastEvent) !== eventKey(prior.lastEvent);
    const roundAdvanced = current.round > prior.round;
    if (roundAdvanced) play("round");
    if (!changedEvent) return;

    const type = String(current.lastEvent?.type || "");
    const text = String(current.lastEvent?.text || "");
    let cue = "";

    if (text.includes("DWALLET GLITCH")) cue = "glitch";
    else if (type === "mass_brawl") cue = "brawl";
    else if (type === "revival") cue = "revival";
    else if (type === "crowd_vote_open") cue = "vote";
    else if (type === "crowd_result") cue = "duel";
    else if (prior.aliveCount > current.aliveCount) cue = eliminationCue(current.round);

    if (cue) play(cue, roundAdvanced ? 180 : 0);
  }

  function actionFromRequest(path, init) {
    if (!(path === "/api/activity/action" || path === "/telegram/api/action")) return "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      return String(body?.action || "");
    } catch {
      return "";
    }
  }

  function handleActionSuccess(action) {
    if (!action) return;
    if (action === "join") play("join");
    else if (action !== "start") play("confirm");
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function veilSfxFetch(input, init) {
    const response = await originalFetch(input, init);
    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const path = new URL(rawUrl, window.location.href).pathname;
      const isState = path === "/api/activity/state" || path === "/telegram/api/state";
      const isAction = path === "/api/activity/action" || path === "/telegram/api/action";
      if (response.ok && (isState || isAction)) {
        const action = isAction ? actionFromRequest(path, init) : "";
        response.clone().json().then(payload => {
          if (isAction) handleActionSuccess(action);
          handleState(payload);
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  document.addEventListener("pointerdown", event => {
    const target = event.target?.closest?.("button,[data-action],[data-vote]");
    if (!target) return;
    play("click");
  }, true);

  setInterval(() => {
    if (!deadline) return;
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    if (remaining < 1 || remaining > 3) return;
    const key = `${deadline}:${remaining}`;
    if (key === deadlineCueKey) return;
    deadlineCueKey = key;
    play("countdown");
  }, 150);
})();
