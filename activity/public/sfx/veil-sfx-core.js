(() => {
  const sources = window.__VEIL_SFX_SOURCES || {};
  const cueNames = Object.keys(sources);
  const prototypes = new Map();
  let previousState = null;
  let deadline = null;
  let deadlineCueKey = "";

  function audioFor(name) {
    if (!sources[name]) return null;
    if (!prototypes.has(name)) {
      const audio = new Audio(sources[name]);
      audio.preload = "auto";
      prototypes.set(name, audio);
    }
    return prototypes.get(name);
  }

  function play(name) {
    try {
      const source = audioFor(name);
      if (!source) return;
      const audio = source.cloneNode(true);
      audio.preload = "auto";
      const promise = audio.play();
      if (promise?.catch) promise.catch(() => {});
    } catch {}
  }

  cueNames.forEach(audioFor);

  function eventKey(event) {
    if (!event) return "";
    return [event.type || "", event.round || "", event.at || ""].join("|");
  }

  function normalize(payload) {
    if (!payload || typeof payload !== "object") return null;
    const game = Object.prototype.hasOwnProperty.call(payload, "game") ? payload.game : payload;
    if (!game || typeof game !== "object" || !game.status) return null;

    const crowdVote = game.crowdVote || null;
    const count = Number(game.aliveCount);
    return {
      id: String(game.id || game.gameId || (Object.prototype.hasOwnProperty.call(payload, "game") ? "discord" : "telegram")),
      status: String(game.status || ""),
      round: Number(game.round || 0),
      aliveCount: Number.isFinite(count) ? count : Array.isArray(game.aliveIds) ? game.aliveIds.length : 0,
      winnerId: game.winnerId == null ? "" : String(game.winnerId),
      lastEvent: game.lastEvent || null,
      crowdVote,
      nextAdvanceAt: Number(game.nextAdvanceAt || 0) || null
    };
  }

  function updateDeadline(state) {
    const next = Number(state?.crowdVote?.closesAt || state?.nextAdvanceAt || 0) || null;
    if (next !== deadline) {
      deadline = next;
      deadlineCueKey = "";
    }
  }

  function eliminationCue(round) {
    const cues = ["elimination", "elimination2", "elimination3"];
    const index = Math.abs((Number(round) || 1) - 1) % cues.length;
    return cues[index];
  }

  function handleState(payload) {
    const current = normalize(payload);
    if (!current) return;
    updateDeadline(current);

    const previous = previousState;
    previousState = current;
    if (!previous || previous.id !== current.id) return;

    if (current.status === "finished" && (previous.status !== "finished" || previous.winnerId !== current.winnerId)) {
      play("victory");
      return;
    }

    if (previous.status === "registration" && current.status === "running") {
      play("start");
      return;
    }

    if (previous.aliveCount > 5 && current.aliveCount <= 5 && current.status === "running") {
      play("final");
      return;
    }

    const currentEventKey = eventKey(current.lastEvent);
    const previousEventKey = eventKey(previous.lastEvent);
    const changedEvent = currentEventKey && currentEventKey !== previousEventKey;
    if (!changedEvent) return;

    const type = String(current.lastEvent?.type || "");
    const text = String(current.lastEvent?.text || "");

    if (text.includes("DWALLET GLITCH")) {
      play("glitch");
      return;
    }
    if (type === "mass_brawl") {
      play("brawl");
      return;
    }
    if (type === "revival") {
      play("revival");
      return;
    }
    if (type === "crowd_vote_open") {
      play("vote");
      return;
    }
    if (type === "crowd_result") {
      play("duel");
      return;
    }
    if (type === "normal") {
      play(previous.aliveCount > current.aliveCount ? eliminationCue(current.round) : "round");
      return;
    }
    if (current.round !== previous.round) play("round");
  }

  function actionFromRequest(path, init) {
    if (!path.endsWith("/api/action")) return "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      return String(body?.action || "");
    } catch {
      return "";
    }
  }

  function handleActionSuccess(action) {
    if (!action) return;
    if (action === "join") {
      play("join");
      return;
    }
    if (action === "start") return;
    play("confirm");
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

  document.addEventListener("click", event => {
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
