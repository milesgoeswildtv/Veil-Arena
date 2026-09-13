import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { selectArenaCue, createArenaAudio } from '../src/audio/arena-audio.js';
import { synthesizeArenaCue } from '../src/audio/arena-synthesis.js';
import { telegramFxMiniAppHtml } from '../src/telegram-fx-app.js';
import { applyTelegramMiniAppAssetBatch2 } from '../src/telegram-miniapp-assets-batch2.js';

const eventAt = new Date().toISOString();
const game = (overrides = {}) => ({ id: 'arena-1', status: 'running', round: 2, aliveCount: 12,
  playerCount: 12, lastEvent: { type: 'normal', round: 2, at: eventAt }, ...overrides });
assert.equal(selectArenaCue(null, game()), null);
assert.equal(selectArenaCue(game(), game({ id: 'arena-2' })), null);
assert.equal(selectArenaCue(game(), game()), null);
assert.equal(selectArenaCue(game({ status: 'registration' }), game()), 'start');
for (const [type, cue] of Object.entries({ revival: 'revival', mass_brawl: 'brawl', crowd_vote_open: 'vote', crowd_result: 'duel' })) {
  assert.equal(selectArenaCue(game(), game({ lastEvent: { type, round: 3 } })), cue);
}
assert.equal(selectArenaCue(game(), game({ status: 'finished', winnerId: 'winner', aliveCount: 1 })), 'victory');
assert.equal(selectArenaCue(game(), game({ aliveCount: 4, lastEvent: { type: 'mass_brawl', round: 3 } })), 'final');
assert.equal(selectArenaCue(game(), game({ aliveCount: 8, lastEvent: { type: 'normal', round: 3 } })), 'elimination3');

// Exercise the actual playback controller, including browser denial and storage failures.
class Element {
  listeners = new Map(); children = [];
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  setAttribute() {} append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); } prepend(item) { this.children.unshift(item); }
  contains(item) { return this.children.includes(item); } remove() {}
}
let started = 0, stopped = 0, interval;
class AudioContext {
  state = 'running'; currentTime = 0;
  createGain() { return { gain: { setTargetAtTime() {} }, connect() {} }; }
  createBuffer() { return { copyToChannel() {} }; }
  createBufferSource() { return { connect() {}, disconnect() {}, start() { started++; }, stop() { stopped++; } }; }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
}
const document = new Element(); document.head = new Element(); document.body = new Element();
document.createElement = () => new Element(); document.hidden = false;
const host = { document, AudioContext, localStorage: { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } },
  setInterval(fn) { interval = fn; return 1; }, clearInterval() {} };
const audio = createArenaAudio(selectArenaCue, synthesizeArenaCue, host);
document.listeners.get('pointerdown')();
audio.observe(game()); assert.equal(started, 0, 'first snapshot must be silent');
const vote = game({ lastEvent: { type: 'crowd_vote_open', round: 3 }, crowdVote: { closesAt: Date.now() + 2200 } });
audio.observe(vote); assert.equal(started, 1);
audio.observe(vote); assert.equal(started, 1, 'poll must not replay');
interval(); assert.equal(started, 1, 'countdown must not interrupt feature sting');
audio.connectionLost(); audio.observe(game({ status: 'finished', winnerId: 'x' }));
assert.equal(started, 1, 'reconnect must not replay winner');
document.hidden = true; document.listeners.get('visibilitychange')();
audio.observe(game()); assert.equal(started, 1);
document.hidden = false; document.listeners.get('visibilitychange')(); audio.observe(vote);
assert.equal(started, 1, 'returning from background must be silent');
const panel = document.body.children[0]; panel.children[0].listeners.get('click')();
assert.equal(audio.play('victory', 4), false, 'mute must prevent playback');
assert.ok(stopped >= 1); audio.dispose();
host.AudioContext = class { constructor() { throw Error('unsupported'); } };
const unsupported = createArenaAudio(selectArenaCue, synthesizeArenaCue, host);
document.listeners.get('pointerdown')(); unsupported.observe(game()); unsupported.observe(vote); unsupported.dispose();

for (const name of ['click','join','countdown','start','round','elimination','elimination2','elimination3','vote','confirm','duel','brawl','revival','final','victory','glitch']) {
  const samples = synthesizeArenaCue(name);
  assert.ok(samples.length > 1000 && samples.length <= 22050 * 3);
  assert.ok(samples.every(x => Number.isFinite(x) && Math.abs(x) <= .701));
  assert.ok(samples.some(x => Math.abs(x) > .05), name + ' must be audible');
  assert.equal(Math.abs(samples[0]), 0); assert.equal(Math.abs(samples.at(-1)), 0);
}
const html = applyTelegramMiniAppAssetBatch2(telegramFxMiniAppHtml());
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(match[1]);
assert.ok(html.includes('arenaAudio.observe(next)'));
assert.ok(html.includes('arenaAudio.confirmAction(action)'));
console.log('Arena audio: state cues, replay suppression, visibility, mute, unsupported audio, samples and final Telegram script passed.');

// Optional: execute the delivered HTML from Wrangler's real production bundle.
if (process.argv[2]) {
  const { default: worker } = await import(pathToFileURL(process.argv[2]));
  const response = await worker.fetch(new Request('https://veil.test/telegram/app'), {});
  const bundledHtml = await response.text();
  const source = bundledHtml.split('const arenaAudio=')[1].split(';\nconst tg=')[0];
  host.AudioContext = AudioContext;
  const client = runInNewContext(source, { window: host });
  document.listeners.get('pointerdown')();
  client.observe(game()); client.observe(vote);
  assert.equal(client.play('victory', 4), true, 'bundled sound renderer must execute');
  client.dispose();
  console.log('Production Telegram bundle: embedded audio initializes and renders a sound without missing helpers.');
}
