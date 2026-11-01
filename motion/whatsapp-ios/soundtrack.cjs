#!/usr/bin/env node
/*
 * Synthetisiert Musik + Sounddesign (120 BPM, 30 s) passend zur Timeline.
 *   node soundtrack.cjs out.wav
 * Alles prozedural, keine fremden Samples.
 */
const fs = require('fs');
const SR = 48000, DUR = 30, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const TAU = Math.PI * 2;
let seed = 1234567;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const BEAT = .5;

function put(i, v, pan = 0) { if (i < 0 || i >= N) return; L[i] += v * Math.cos((pan + 1) * Math.PI / 4) * 1.414; R[i] += v * Math.sin((pan + 1) * Math.PI / 4) * 1.414; }
const duck = t => { if (t < 3 || t >= 28.5) return 1; const since = (t - 3) % BEAT; return 1 - .55 * Math.exp(-since * 10); };

/* ---------- Instrumente ---------- */
function kick(t0, gain = .9) {
  let ph = 0; const n = SR * .45;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (45 + 110 * Math.exp(-t * 28)) / SR;
    put(Math.floor(t0 * SR) + i, Math.sin(ph) * Math.exp(-t * 8) * gain + (i < 90 ? noise() * .25 * gain : 0)); }
}
function clap(t0, gain = .32) {
  let lp = 0; const n = SR * .25;
  for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp += (x - lp) * .25; const hp = x - lp;
    const env = Math.exp(-t * 16) * (t < .03 ? (1 + Math.sin(t * 700)) * .5 + .5 : 1);
    put(Math.floor(t0 * SR) + i, hp * env * gain, .1); }
}
function hat(t0, gain = .1, pan = .25) {
  let lp = 0; const n = SR * .07;
  for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp += (x - lp) * .5; put(Math.floor(t0 * SR) + i, (x - lp) * Math.exp(-t * 55) * gain, pan); }
}
function bass(t0, dur, m, gain = .32) {
  const f = mtof(m), n = Math.floor(dur * SR); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f / SR;
    const env = Math.min(1, t / .006) * (.55 + .45 * Math.exp(-t * 6)) * Math.min(1, (dur - t) / .04);
    put(Math.floor(t0 * SR) + i, (Math.sin(ph) + .35 * Math.sin(2 * ph) + .12 * Math.sin(3 * ph)) * env * gain * duck(t0 + t)); }
}
function pad(t0, dur, notes, gain = .05) {
  const n = Math.floor((dur + .8) * SR);
  notes.forEach((m, k) => [-.08, 0, .08].forEach((det, d) => {
    const f = mtof(m + det); let ph = rnd0(k * 7 + d) * TAU; const pan = (d - 1) * .6;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f / SR;
      const env = Math.min(1, t / .45) * (t > dur ? Math.exp(-(t - dur) * 5) : 1);
      let s = 0; for (let h = 1; h <= 7; h++) s += Math.sin(ph * h) / (h * h * .6 + .4);
      put(Math.floor(t0 * SR) + i, s * env * gain * duck(t0 + t) * (1 + .15 * Math.sin(TAU * .3 * t)), pan); }
  }));
}
function rnd0(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function pluck(t0, m, gain = .09, pan = 0, decay = 7) {
  const f = mtof(m), n = SR * .6; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f / SR;
    put(Math.floor(t0 * SR) + i, (Math.sin(ph) + .3 * Math.sin(2 * ph) + .1 * Math.sin(4 * ph)) * Math.exp(-t * decay) * Math.min(1, t / .003) * gain, pan); }
}
function bell(t0, m, gain = .12, pan = 0) {
  const f = mtof(m), n = SR * 2.5;
  for (let i = 0; i < n; i++) { const t = i / SR;
    const s = Math.sin(TAU * f * t) * Math.exp(-t * 2) + .5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 4) + .25 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 7);
    put(Math.floor(t0 * SR) + i, s * Math.min(1, t / .002) * gain, pan); }
}
function pop(t0, gain = .22, f0 = 520, pan = 0) {
  const n = SR * .14; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f0 + f0 * .9 * (1 - Math.exp(-t * 40))) / SR;
    put(Math.floor(t0 * SR) + i, Math.sin(ph) * Math.exp(-t * 32) * Math.min(1, t / .002) * gain, pan); }
}
function whoosh(tc, width = .32, gain = .5, dir = 1) {
  let lp = 0, lp2 = 0; const a = tc - width * 1.6, n = Math.floor(width * 3.2 * SR);
  for (let i = 0; i < n; i++) { const t = a + i / SR, u = (t - tc) / width;
    const env = Math.exp(-u * u * 2.2), cut = .02 + .35 * env; const x = noise();
    lp += (x - lp) * cut; lp2 += (lp - lp2) * cut;
    put(Math.floor(a * SR) + i, lp2 * env * gain * 2.2, clamp(u * .7 * dir, -1, 1)); }
}
function riser(t0, t1, gain = .25) {
  let lp = 0, ph = 0; const n = Math.floor((t1 - t0) * SR);
  for (let i = 0; i < n; i++) { const u = i / n, x = noise(); lp += (x - lp) * (.03 + .4 * u * u);
    ph += TAU * (180 + 900 * u * u) / SR;
    put(Math.floor(t0 * SR) + i, (lp * 1.6 + Math.sin(ph) * .25) * u * u * gain); }
}
function impact(t0, gain = 1) {
  kick(t0, gain); let lp = 0; const n = SR * 1.6;
  for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp += (x - lp) * .06;
    put(Math.floor(t0 * SR) + i, (lp * 1.2 * Math.exp(-t * 3) + Math.sin(TAU * 38 * t) * Math.exp(-t * 2.2) * .6) * gain * .6); }
}
function click(t0, gain = .3) { for (let i = 0; i < 300; i++) put(Math.floor(t0 * SR) + i, noise() * Math.exp(-i / 40) * gain); }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ---------- Musik ---------- */
const CH = [[48, 52, 55, 60], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]; // C G Am F
for (let bar = 0; bar < 15; bar++) {
  const t = bar * 2; if (t >= 28.5) break;
  const c = CH[bar % 4];
  pad(t, Math.min(2, 28.5 - t), c.slice(1).map(m => m + 12), bar < 1 ? .03 : .045);
  if (t >= 3 || t + 2 > 3) {
    for (let k = 0; k < 8; k++) { const bt = t + k * .25 * 2; if (bt < 3 || bt >= 28.5) continue;
      bass(bt, .22, c[0] - 12 + (k % 4 === 3 ? 7 : 0)); bass(bt + .25, .2, c[0] - 12); }
    const arp = [c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 24, c[3] + 12, c[2] + 12];
    for (let k = 0; k < 16; k++) { const bt = t + k * .125; if (bt < 3.5 || bt >= 28.4) continue;
      pluck(bt, arp[k % arp.length], .05, (k % 2 ? .45 : -.45), 9); }
  }
}
for (let b = 0; b < 60; b++) {
  const t = b * BEAT; if (t < 3 || t >= 28.5) continue;
  if (!(t >= 26.5 && t < 27)) kick(t);
  if (b % 2 === 1) clap(t);
  hat(t + .25, .11); hat(t + .125, .045, -.3); hat(t + .375, .045, -.3);
}
// Intro: Shimmer & Riser
[72, 76, 79, 84].forEach((m, i) => bell(.5 + i * .12, m, .07, (i - 1.5) * .3));
impact(.5, .45);
riser(1.9, 3.0, .32);
impact(3.0, 1);
whoosh(2.75, .25, .35);

/* ---------- Sounddesign passend zur Timeline ---------- */
// Chat
[3.55, 4.2, 5.75].forEach((t, i) => pop(t, .24, i % 2 ? 640 : 520, i % 2 ? .3 : -.3));
pop(4.6, .08, 1400); pop(5.05, .12, 1700, .2); pop(5.45, .2, 900, .3);
pop(6.0, .15, 380); pop(6.85, .25, 700, .3);
for (let i = 0; i < 6; i++) pluck(7.15 + i * .13, 79 + (i % 3) * 2, .03, .2, 14);
// Medien
whoosh(8.0, .35, .55, 1);
for (let i = 0; i < 6; i++) pop(8.62 + i * .11, .17, 420 + i * 60, (i % 3 - 1) * .5);
for (let i = 0; i < 6; i++) pop(9.62 + i * .07, .08, 1500 + i * 80, .3);
pop(10.17, .22, 900, .4);
// Anrufe
whoosh(11.0, .35, .55, -1);
for (let r = 0; r < 2; r++) [76, 79, 84, 79].forEach((m, k) => pluck(11.3 + r * .5 + k * .09, m, .07, .2, 6));
pop(12.22, .25, 600, .3); whoosh(12.6, .2, .25, 1);
// Gruppen
whoosh(14.5, .38, .6, -1);
for (let k = 0; k < 7; k++) { pop(15.45 + k * .3 - .05, .1, 760 + k * 40, -.4); pop(16.09 + k * .3, .14, 980 + k * 40, .4); }
// Status
whoosh(18.0, .35, .55, 1);
for (let i = 0; i < 4; i++) pop(18.1 + i * .08, .1, 700 + i * 90, (i - 1.5) * .4);
whoosh(19.15, .22, .3, 1);
for (let k = 0; k < 9; k++) pop(19.95 + k * .1, .06, 1100 + k * 70, .4);
// Standort
whoosh(21.0, .35, .55, -1);
pop(22.6, .3, 220); pop(22.83, .12, 260); pop(22.95, .2, 700, -.3);
// Verschlüsselung
whoosh(24.0, .38, .6, 1);
for (let k = 0; k < 22; k++) pluck(24.5 + k * .065, 84 + Math.floor(rnd0(k) * 12), .025, Math.sin(k) * .7, 25);
click(25.08, .5); click(25.13, .35); bell(25.12, 91, .06, 0); kick(25.1, .35);
pop(26.0, .2, 640, .5);
// Outro
whoosh(27.0, .38, .6, -1);
for (let i = 0; i < 8; i++) pop(27.05 + i * .05, .08, 800 + i * 70, (i / 3.5 - 1));
riser(27.8, 28.5, .3);
impact(28.5, 1.1);
pad(28.5, 1.5, [60, 64, 67, 72], .05);
[72, 76, 79, 84, 88].forEach((m, i) => bell(28.55 + i * .07, m, .08, (i - 2) * .3));

/* ---------- Mastering & WAV ---------- */
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = .89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const sat = x => Math.tanh(x * 1.25) / Math.tanh(1.25);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, i / (SR * .05), (N - i) / (SR * .4));
  buf.writeInt16LE(Math.round(sat(L[i] * norm) * fade * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(sat(R[i] * norm) * fade * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || 'soundtrack.wav', buf);
console.log('Soundtrack geschrieben:', process.argv[2] || 'soundtrack.wav');
