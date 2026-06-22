/* eslint-disable */
/**
 * One-time generator that produces the short WAV sound effects shipped under
 * `apps/mobile/assets/sfx/`. The files are simple synthetic tones so we can
 * keep them small and dependency-free (no third-party audio assets).
 *
 * Run with:
 *   node apps/mobile/scripts/generate-sfx.js
 * from the repo root.
 */
const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const BITS = 16;
const BYTES = BITS / 8;
const MAX_INT = 32767;
const OUT_DIR = path.resolve(__dirname, "../assets/sfx");

function writeWav(filePath, samples) {
  const dataLen = samples.length * BYTES;
  const buf = Buffer.alloc(44 + dataLen);
  let o = 0;
  const writeStr = (s) => { for (const ch of s) buf.writeUInt8(ch.charCodeAt(0), o++); };
  const writeU32 = (v) => { buf.writeUInt32LE(v, o); o += 4; };
  const writeU16 = (v) => { buf.writeUInt16LE(v, o); o += 2; };

  writeStr("RIFF");
  writeU32(36 + dataLen);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16); // fmt chunk size
  writeU16(1); // PCM
  writeU16(1); // mono
  writeU32(SAMPLE_RATE);
  writeU32(SAMPLE_RATE * BYTES);
  writeU16(BYTES);
  writeU16(BITS);
  writeStr("data");
  writeU32(dataLen);

  for (const s of samples) {
    const int = Math.max(-MAX_INT, Math.min(MAX_INT, Math.round(s * MAX_INT)));
    buf.writeInt16LE(int, o);
    o += 2;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  console.log(`wrote ${path.relative(process.cwd(), filePath)} (${samples.length} samples)`);
}

const count = (seconds) => Math.floor(SAMPLE_RATE * seconds);

const wave = {
  sine: (t, freq) => Math.sin(2 * Math.PI * freq * t),
  triangle: (t, freq) => {
    const p = (t * freq) % 1;
    return 4 * Math.abs(p - 0.5) - 1;
  },
  sawtooth: (t, freq) => 2 * ((t * freq) % 1) - 1,
  square: (t, freq) => ((t * freq) % 1 < 0.5 ? 1 : -1),
};

function tone(freq, seconds, shape = "sine", vol = 0.5) {
  const n = count(seconds);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = 1 - i / n; // simple fade-out
    samples[i] = wave[shape](t, freq) * vol * env;
  }
  return samples;
}

function chord(freqs, seconds, vol = 0.4) {
  const n = count(seconds);
  const samples = new Float32Array(n);
  const amp = vol / Math.sqrt(freqs.length);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = 1 - i / n;
    let sum = 0;
    for (const f of freqs) sum += wave.sine(t, f);
    samples[i] = sum * amp * env;
  }
  return samples;
}

function sweep(startFreq, endFreq, seconds, shape = "sine", vol = 0.4) {
  const n = count(seconds);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / n;
    const freq = startFreq + (endFreq - startFreq) * progress;
    const env = 1 - progress;
    samples[i] = wave[shape](t, freq) * vol * env;
  }
  return samples;
}

function arpeggio(freqs, noteSeconds, vol = 0.35) {
  const total = freqs.length * noteSeconds;
  const n = count(total);
  const samples = new Float32Array(n);
  const per = count(noteSeconds);
  const amp = vol / Math.sqrt(2);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(i / per);
    const freq = freqs[idx] ?? freqs[freqs.length - 1];
    const t = i / SAMPLE_RATE;
    const within = i % per;
    const env = 1 - within / per;
    samples[i] = wave.sine(t, freq) * amp * env;
  }
  return samples;
}

function noise(seconds, vol = 0.25) {
  const n = count(seconds);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = 1 - i / n;
    samples[i] = (Math.random() * 2 - 1) * vol * env;
  }
  return samples;
}

const SOUNDS = {
  "join": () => sweep(880, 440, 0.12, "sine", 0.4),
  "turn-start": () => sweep(300, 900, 0.25, "sine", 0.4),
  "guess-close": () => tone(500, 0.1, "sine", 0.35),
  "guess-correct": () => chord([523.25, 659.25], 0.25, 0.4),
  "you-guessed": () => chord([523.25, 659.25, 783.99, 1046.5], 0.35, 0.35),
  "tick": () => tone(1000, 0.06, "sine", 0.5),
  "reveal": () => chord([523.25, 659.25, 783.99], 0.3, 0.4),
  "win": () => arpeggio([523.25, 659.25, 783.99, 1046.5], 0.18, 0.35),
  "react": () => sweep(500, 700, 0.08, "sine", 0.35),
  "time-up": () => sweep(250, 120, 0.5, "sawtooth", 0.3),
};

for (const [name, factory] of Object.entries(SOUNDS)) {
  const samples = factory();
  writeWav(path.join(OUT_DIR, `${name}.wav`), samples);
}

console.log("done");
