import { synthesizeArenaCue } from './arena-synthesis.js';

// Read-only state adapter shared by Discord's state.game and Telegram's root state.
export function selectArenaCue(before, after) {
  if (!before || !after || before.id !== after.id) return null;
  if (after.status === 'finished' && after.winnerId && !before.winnerId) return 'victory';
  if (after.status === 'registration') return after.playerCount > before.playerCount ? 'join' : null;
  if (after.status !== 'running') return null;
  if (before.status === 'registration') return 'start';
  const ev = after.lastEvent || {}, old = before.lastEvent || {};
  const changed = [ev.type, ev.at, ev.round].join('|') !== [old.type, old.at, old.round].join('|');
  if (!changed) return null;
  if (before.aliveCount > 5 && after.aliveCount <= 5) return 'final';
  if (String(ev.text || '').includes('DWALLET GLITCH')) return 'glitch';
  const special = { revival: 'revival', mass_brawl: 'brawl', crowd_vote_open: 'vote', crowd_result: 'duel' };
  if (special[ev.type]) return special[ev.type];
  if (after.aliveCount < before.aliveCount) return ['elimination', 'elimination2', 'elimination3'][Math.abs(Number(after.round) || 0) % 3];
  if (after.round > before.round) return 'round';
  return null;
}

// Self-contained so the server-rendered Telegram app can embed this exact client.
export function createArenaAudio(selectCue, synthesize, host = window) {
  const doc = host.document;
  let ctx, master, previous = null, lastSeen = 0, resetBaseline = true;
  let muted = false, volume = .4, lastStart = -Infinity, lastPriority = 0;
  let deadline = 0, lastTick = '', disposed = false;
  const buffers = new Map(), active = new Set(), seen = new Set();
  try {
    const saved = JSON.parse(host.localStorage.getItem('veil.arena.audio.v1') || 'null');
    if (saved) {
      muted = saved.muted === true;
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume));
    }
  } catch {}
  function stop() {
    for (const source of active) { try { source.stop(); } catch {} }
    active.clear();
  }
  function save() {
    try { host.localStorage.setItem('veil.arena.audio.v1', JSON.stringify({ muted, volume })); } catch {}
  }
  function applyVolume() {
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, .015);
  }
  function unlock() {
    if (disposed || muted) return;
    try {
      if (!ctx) {
        const AudioContext = host.AudioContext || host.webkitAudioContext;
        if (!AudioContext) return;
        ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination);
        master.gain.value = volume;
      }
      if (ctx.state !== 'running') Promise.resolve(ctx.resume()).catch(() => {});
    } catch {} // Audio support must never affect gameplay.
  }
  function play(name, priority = 1) {
    if (disposed || muted || !volume || doc.hidden || !ctx || ctx.state !== 'running') return false;
    const now = Date.now();
    if (active.size && priority < lastPriority) return false;
    if (now - lastStart < 120 && priority <= lastPriority) return false;
    try {
      let buffer = buffers.get(name);
      if (!buffer) {
        const samples = synthesize(name, 22050);
        buffer = ctx.createBuffer(1, samples.length, 22050);
        buffer.copyToChannel(samples, 0); buffers.set(name, buffer);
      }
      stop(); // One coordinated event; never a pile of elimination sounds.
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(master);
      source.onended = () => { active.delete(source); source.disconnect(); };
      active.add(source); source.start(); lastStart = now; lastPriority = priority;
      return true;
    } catch { return false; }
  }
  function observe(state) {
    const next = state && ('game' in state ? state.game : state);
    const now = Date.now();
    // Ignore late responses from a poll that began before a newer action response.
    if (previous && next && previous.id === next.id) {
      if (Number(next.round) < Number(previous.round)) return;
      const beforeAt = Date.parse(previous.lastEvent?.at), afterAt = Date.parse(next.lastEvent?.at);
      if (Number.isFinite(beforeAt) && Number.isFinite(afterAt) && afterAt < beforeAt) return;
    }
    deadline = next?.status === 'running' ? Number(next.crowdVote?.closesAt || 0) : 0;
    const baseline = resetBaseline || doc.hidden || !previous || !next || previous.id !== next.id || now - lastSeen > 8000;
    if (!baseline) {
      const cue = selectCue(previous, next);
      const ev = next.lastEvent || {};
      const key = [next.id, next.status, next.round, ev.type, ev.at, cue, next.playerCount].join('|');
      if (cue && !seen.has(key)) {
        seen.add(key);
        if (seen.size > 128) seen.delete(seen.values().next().value);
        const at = Date.parse(ev.at);
        if (!Number.isFinite(at) || now - at < 8000 || cue === 'join' || cue === 'start') {
          play(cue, cue === 'victory' ? 4 : cue === 'join' ? 1 : 3);
        }
      }
    }
    previous = next; lastSeen = now; resetBaseline = false;
  }
  function connectionLost() { resetBaseline = true; deadline = 0; stop(); }
  function visibility() { connectionLost(); }
  function confirmAction(action) { if (action === 'vote') play('confirm', 1); }

  const style = doc.createElement('style');
  style.textContent = '.veil-audio-controls{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;max-width:1180px;margin:0 auto;padding:8px 14px;color:#cbbfd6;font:12px system-ui;position:relative;z-index:2}.veil-audio-controls button{min-height:36px;padding:6px 12px;border:1px solid #7655a3;border-radius:10px;background:#171020;color:#fff;font:inherit;cursor:pointer}.veil-audio-controls label{display:flex;align-items:center;gap:6px}.veil-audio-controls input{width:90px;accent-color:#c45cff}.veil-audio-controls button:focus-visible,.veil-audio-controls input:focus-visible{outline:2px solid #f2c968;outline-offset:3px}';
  const panel = doc.createElement('div'); panel.className = 'veil-audio-controls';
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Arena sound settings');
  const toggle = doc.createElement('button'); toggle.type = 'button';
  const label = doc.createElement('label'); label.textContent = 'Volume';
  const slider = doc.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '5'; slider.value = String(volume * 100);
  slider.setAttribute('aria-label', 'Arena effects volume'); label.appendChild(slider);
  const preview = doc.createElement('button'); preview.type = 'button'; preview.textContent = 'Test sound';
  function updateToggle() { toggle.textContent = muted ? 'Sound off' : 'Sound on'; toggle.setAttribute('aria-pressed', String(!muted)); }
  updateToggle(); panel.append(toggle, label, preview); doc.head.appendChild(style); doc.body.prepend(panel);
  toggle.addEventListener('click', () => { muted = !muted; if (muted) stop(); else unlock(); applyVolume(); save(); updateToggle(); });
  slider.addEventListener('input', () => { volume = Number(slider.value) / 100; unlock(); applyVolume(); save(); });
  preview.addEventListener('click', () => {
    unlock();
    if (ctx && !muted) Promise.resolve(ctx.resume()).then(() => play('join')).catch(() => {});
  });
  function click(event) {
    if (panel.contains(event.target)) return;
    if (event.target.closest?.('button:not(:disabled)')) play('click', 0);
  }
  doc.addEventListener('pointerdown', unlock, true);
  doc.addEventListener('keydown', unlock, true);
  doc.addEventListener('click', click);
  doc.addEventListener('visibilitychange', visibility);
  const timer = host.setInterval(() => {
    if (Date.now() - lastSeen > 8000 || resetBaseline || !deadline) return;
    const seconds = Math.ceil((deadline - Date.now()) / 1000);
    const key = deadline + ':' + seconds;
    if (seconds > 0 && seconds <= 3 && key !== lastTick) { lastTick = key; play('countdown', 1); }
  }, 200);
  return { observe, confirmAction, connectionLost, play,
    dispose() {
      disposed = true; stop(); host.clearInterval(timer);
      doc.removeEventListener('pointerdown', unlock, true); doc.removeEventListener('keydown', unlock, true);
      doc.removeEventListener('click', click); doc.removeEventListener('visibilitychange', visibility);
      panel.remove(); style.remove(); if (ctx) Promise.resolve(ctx.close()).catch(() => {});
    }
  };
}

export function installArenaAudio() { return createArenaAudio(selectArenaCue, synthesizeArenaCue); }
export function arenaAudioClientSource() {
  // Wrangler keep_names inserts __name calls into nested functions. Supply that
  // harmless helper inside the browser closure as well as in the worker bundle.
  return '(() => { const __name = (fn) => fn; return (' + createArenaAudio.toString() + ')(' + selectArenaCue.toString() + ',' + synthesizeArenaCue.toString() + '); })()';
}
