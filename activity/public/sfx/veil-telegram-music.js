(() => {
  const MUSIC = {
    lobby: { src: "/sfx/music/veil-lobby-music.mp3", volume: 0.22 },
    battle: { src: "/sfx/music/veil-arena-battle-music.mp3", volume: 0.26 }
  };

  let desiredMusic = "lobby";
  let activeMusic = "";
  let musicTransition = 0;
  let unlocked = false;

  const players = Object.fromEntries(Object.entries(MUSIC).map(([name, config]) => {
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
    if (!unlocked || document.hidden) return;
    const target = desiredMusic;
    const config = MUSIC[target];
    const incoming = players[target];
    const transitionId = ++musicTransition;

    for (const [name, audio] of Object.entries(players)) {
      if (name === target) continue;
      if (audio.paused) {
        audio.volume = 0;
        audio.currentTime = 0;
        continue;
      }
      fade(audio, audio.volume, 0, 450, transitionId, () => {
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

    if (activeMusic === target && !incoming.paused && Math.abs(incoming.volume - config.volume) < 0.01) return;

    activeMusic = target;
    const started = incoming.paused
      ? await incoming.play().then(() => true).catch(() => false)
      : true;
    if (!started || transitionId !== musicTransition) return;
    fade(incoming, incoming.volume, config.volume, incoming.volume > 0 ? 300 : 800, transitionId);
  }

  function updateMusicForStatus(status) {
    const next = status === "running" || status === "starting" ? "battle" : "lobby";
    if (next === desiredMusic) {
      applyMusic();
      return;
    }
    desiredMusic = next;
    applyMusic();
  }

  function stateFromPayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    const game = Object.prototype.hasOwnProperty.call(payload, "game") ? payload.game : payload;
    if (!game || typeof game !== "object" || !game.status) return null;
    return game;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function veilTelegramMusicFetch(input, init) {
    const response = await originalFetch(input, init);
    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const path = new URL(rawUrl, window.location.href).pathname;
      if (response.ok && (path === "/telegram/api/state" || path === "/telegram/api/action")) {
        response.clone().json().then(payload => {
          const game = stateFromPayload(payload);
          if (game) updateMusicForStatus(String(game.status || ""));
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  function unlockMusic() {
    unlocked = true;
    applyMusic();
  }

  document.addEventListener("pointerdown", unlockMusic, { capture: true });
  document.addEventListener("touchstart", unlockMusic, { capture: true, passive: true });
  document.addEventListener("click", unlockMusic, { capture: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      Object.values(players).forEach(audio => audio.pause());
      return;
    }
    applyMusic();
  });
})();
