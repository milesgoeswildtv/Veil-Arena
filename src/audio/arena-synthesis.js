// Original procedural Arena cues. This same renderer supplies browser buffers and WAV exports.
export function synthesizeArenaCue(name, sampleRate = 22050) {
  const lengths = { click: .11, join: .42, countdown: .16, start: 1.2, round: .55,
    elimination: .65, elimination2: .72, elimination3: .6, vote: 1, confirm: .25,
    duel: 1.15, brawl: 1.3, revival: 1.6, final: 1.7, victory: 2.5, glitch: .65 };
  if (!(name in lengths)) throw new Error('Unknown Arena cue: ' + name);
  const out = new Float32Array(Math.ceil(lengths[name] * sampleRate));
  let seed = 6143;
  function tone(at, duration, from, to, gain, metal = 0) {
    let phase = 0;
    const start = Math.floor(at * sampleRate);
    for (let j = 0; j < duration * sampleRate && start + j < out.length; j++) {
      const t = j / sampleRate, u = t / duration;
      phase += 2 * Math.PI * (from * Math.pow(to / from, u)) / sampleRate;
      const env = Math.min(1, t / .006) * Math.pow(1 - u, 2);
      out[start + j] += gain * env * (Math.sin(phase) + metal * Math.sin(phase * 2.76));
    }
  }
  function noise(at, duration, gain, rise = false) {
    let low = 0;
    const start = Math.floor(at * sampleRate);
    for (let j = 0; j < duration * sampleRate && start + j < out.length; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      low = low * .65 + (seed / 2147483648 - 1) * .35;
      const u = j / (duration * sampleRate);
      out[start + j] += low * gain * Math.sin(Math.PI * u) * (rise ? u : (1 - u));
    }
  }
  function impact(at = 0, power = .5) {
    tone(at, .5, 155, 46, power); tone(at, .35, 620, 150, power * .25, .4);
    noise(at, .25, power * .7);
  }
  if (name === 'click') tone(0, .1, 1100, 750, .18, .15);
  if (name === 'countdown') { tone(0, .15, 650, 630, .24); tone(0, .05, 1300, 1200, .08); }
  if (name === 'join' || name === 'confirm') {
    tone(0, .18, 660, 660, .25, .25); tone(.09, lengths[name] - .09, 990, 990, .2, .3);
  }
  if (name === 'start') { noise(0, .3, .6, true); impact(.27); tone(.3, .85, 220, 110, .18, .3); }
  if (name === 'round') { noise(0, .14, .35, true); impact(.12, .32); }
  if (name.startsWith('elimination')) {
    const offset = name === 'elimination2' ? 1.25 : name === 'elimination3' ? .8 : 1;
    tone(0, .58, 490 * offset, 65, .35, .22); noise(.02, .3, .5);
    tone(.1, .4, 100, 43, .22);
  }
  if (name === 'vote') {
    [0, .18, .36].forEach((t, i) => tone(t, .3, 330 + i * 110, 330 + i * 110, .22, .2));
    tone(.55, .44, 880, 440, .18);
  }
  if (name === 'duel' || name === 'brawl') {
    impact(0, .4); impact(.23, .5);
    if (name === 'brawl') { impact(.48, .4); noise(.5, .75, .5); }
    else tone(.5, .6, 440, 110, .2, .4);
  }
  if (name === 'revival') {
    noise(0, .65, .55, true);
    [330, 440, 660, 880].forEach((f, i) => tone(.3 + i * .16, .8, f, f * 1.005, .2, .1));
    tone(.8, .7, 1320, 1320, .1, .3);
  }
  if (name === 'final') {
    [0, .45, .9].forEach((t, i) => { tone(t, .65, 82, 65, .32); tone(t, .65, 220 + i * 5, 220, .12, .25); });
  }
  if (name === 'victory') {
    impact(0, .4);
    [220, 330, 440, 660].forEach((f, i) => tone(.15 + i * .18, 1.3, f, f, .22, .18));
    [440, 550, 660, 880].forEach(f => tone(1, 1.45, f, f, .13, .1));
    noise(.8, 1.2, .2);
  }
  if (name === 'glitch') {
    for (let i = 0; i < 8; i++) tone(i * .07, .08, i % 2 ? 180 : 920, 100, .22, .6);
    noise(0, .6, .4);
  }
  // Consistent ceiling, remove DC and fade both ends to avoid clicks.
  const mean = out.reduce((a, b) => a + b, 0) / out.length;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = (out[i] - mean) * Math.min(1, i / 110, (out.length - 1 - i) / 220);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const scale = peak > .7 ? .7 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= scale;
  return out;
}
