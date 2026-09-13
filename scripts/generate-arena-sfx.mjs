import { mkdir, writeFile } from 'node:fs/promises';
import { synthesizeArenaCue } from '../src/audio/arena-synthesis.js';

const names = ['click', 'join', 'countdown', 'start', 'round', 'elimination', 'elimination2',
  'elimination3', 'vote', 'confirm', 'duel', 'brawl', 'revival', 'final', 'victory', 'glitch'];
const directory = new URL('../assets/audio/arena/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const name of names) {
  const samples = synthesizeArenaCue(name);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(Math.round(sample * 32767), 44 + index * 2));
  await writeFile(new URL(name + '.wav', directory), wav);
}
console.log('Exported 16 original Arena cues as mono 22.05 kHz PCM WAVs.');
