(() => {
  const SFX_VOLUME = 0.78;
  const MUSIC = {
    lobby: { src: "/sfx/music/veil-lobby-music.mp3", volume: 0.22 },
    battle: { src: "/sfx/music/veil-arena-battle-music.mp3", volume: 0.26 }
  };

  const CUES = {
    click: "/sfx/cues/click.mp3",
    confirm: "/sfx/cues/confirm.mp3",
    countdown: "/sfx/cues/countdown.mp3",
    join: "/sfx/cues/join.mp3",
    revival: "/sfx/cues/revival.mp3",
    elimination: "/sfx/cues/elimination.mp3",
    elimination2: "/sfx/cues/elimination2.mp3",
    start: "/sfx/cues/start.mp3",
    brawl: "/sfx/cues/brawl.mp3",
    duel: "/sfx/cues/duel.mp3",
    final: "/sfx/cues/final.mp3",
    victory: "/sfx/cues/victory.mp3",
    vote: "/sfx/cues/vote.mp3",
    round: "/sfx/cues/round.mp3",
    glitch: "/sfx/cues/glitch.mp3"
  };

  const cueTemplates = Object.fromEntries(Object.entries(CUES).map(([name, src]) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = SFX_VOLUME;
    return [name, audio];
  }));

  const liveSfx = new Set();

  function playSfx(name, delay = 0) {
    if (delay > 0) {
      setTimeout(() => playSfx(name), delay);
      return;
    }

    const template = cueTemplates[name];
    if (!template) return;

    try {
      const audio = new Audio(template.src);
      audio.preload = "auto";
      audio.volume = SFX_VOLUME;
      liveSfx.add(audio);

      const cleanup = () => {
        liveSfx.delete(audio);
        audio.removeEventListener("ended", cleanup);
        audio.removeEventListener("error", cleanup);
      };

      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      const promise = audio.play();
      if (promise?.catch) promise.catch(cleanup);
    } catch {}
  }

  let desiredMusic = "lobby";
  let activeMusic = "";
  let musicTransition = 0;
  let previous = null;
  let deadline = null;
  let deadlineCueKey = "";

  const musicPlayers = Object.fromEntries(Object.entries(MUSIC).map(([name, config]) => {
    const audio = new Audio(config.src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    return [name, audio];
  }));

  function fade(audio, from, to, duration, transitionId, onDone) {
    const startedAt = performance.now();
    audio.volume = Math.max(0, Math.min(1, from));

    function step(now) {
      if (transitionId !== musicTransition) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      audio.volume = Math.max(0, Math.min(1, from + ((to - from) * progress)));
      if (progress < 1) requestAnimationFrame(step);
      else onDone?.();
    }

    requestAnimationFrame(step);
  }

  async function applyMusic() {
    const target = desiredMusic;
    const config = MUSIC[target];
    const incoming = musicPlayers[target];

    if (target && config && incoming && activeMusic === target && !incoming.paused && Math.abs(incoming.volume - config.volume) < 0.01) {
      return;
    }

    const transitionId = ++musicTransition;

    for (const [name, audio] of Object.entries(musicPlayers)) {
      if (name === target) continue;
      if (audio.paused) {
        audio.volume = 0;
        audio.currentTime = 0;
        continue;
      }
      fade(audio, audio.volume, 0, 500, transitionId, () => {
        if (desiredMusic !== name) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    }

    if (!target || !config || !incoming) {
      activeMusic = "";
      return;
    }

    activeMusic = target;
    const started = incoming.paused
      ? await incoming.play().then(() => true).catch(() => false)
      : true;

    if (!started || transitionId !== musicTransition) return;
    fade(incoming, incoming.volume, config.volume, incoming.volume > 0 ? 350 : 900, transitionId);
  }

  function updateMusicForStatus(status, hasGame = true) {
    let next = "";
    if (!hasGame || status === "registration") next = "lobby";
    else if (status === "running" || status === "starting") next = "battle";

    if (next === desiredMusic) {
      if (next) applyMusic();
      return;
    }

    desiredMusic = next;
    applyMusic();
  }

  function normalize(payload) {
    if (!payload || typeof payload !== "object") return null;
    const game = payload.game;
    if (!game || typeof game !== "object" || !game.status) return null;

    const count = Number(game.aliveCount);
    return {
      id: String(game.id || game.gameId || "discord"),
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
    const names = ["elimination", "elimination2"];
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
    if (payload && Object.prototype.hasOwnProperty.call(payload, "game") && !payload.game) {
      updateMusicForStatus("", false);
      previous = null;
      deadline = null;
      deadlineCueKey = "";
      return;
    }

    const current = normalize(payload);
    if (!current) return;

    updateMusicForStatus(current.status, true);
    updateDeadline(current);

    const prior = previous;
    previous = current;
    if (!prior || prior.id !== current.id) return;

    if (current.status === "finished" && (prior.status !== "finished" || prior.winnerId !== current.winnerId)) {
      playSfx("victory");
      return;
    }

    if (prior.status === "registration" && (current.status === "starting" || current.status === "running")) {
      playSfx("start");
      return;
    }

    if (prior.aliveCount > 5 && current.aliveCount <= 5 && current.status === "running") {
      playSfx("final");
      return;
    }

    const changedEvent = eventKey(current.lastEvent) && eventKey(current.lastEvent) !== eventKey(prior.lastEvent);
    const roundAdvanced = current.round > prior.round;
    if (roundAdvanced) playSfx("round");
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

    if (cue) playSfx(cue, roundAdvanced ? 180 : 0);
  }

  function actionFromRequest(path, init) {
    if (path !== "/api/activity/action") return "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      return String(body?.action || "");
    } catch {
      return "";
    }
  }

  function handleActionSuccess(action) {
    if (!action) return;
    if (action === "join") playSfx("join");
    else if (action !== "start") playSfx("confirm");
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function veilDiscordAudioFetch(input, init) {
    const response = await originalFetch(input, init);

    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const path = new URL(rawUrl, window.location.href).pathname;
      const isState = path === "/api/activity/state";
      const isAction = path === "/api/activity/action";

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
    if (target) playSfx("click");
    if (desiredMusic) applyMusic();
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      Object.values(musicPlayers).forEach(audio => audio.pause());
      return;
    }
    if (desiredMusic) applyMusic();
  });

  setInterval(() => {
    if (!deadline) return;
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    if (remaining < 1 || remaining > 3) return;

    const key = `${deadline}:${remaining}`;
    if (key === deadlineCueKey) return;
    deadlineCueKey = key;
    playSfx("countdown");
  }, 150);

  applyMusic();
})();
