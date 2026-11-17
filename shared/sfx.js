// Synthetisierte Soundeffekte via WebAudio – keine Audiodateien nötig.
// iOS verlangt eine Nutzer-Geste, bevor Audio spielt: sfx.unlock() wird
// automatisch beim ersten pointerdown aufgerufen.
//
//   import { sfx } from '../shared/sfx.js';
//   sfx.play('pop');      // tap | pop | fill | place | whoosh | error | complete | sparkle | click | thud
//   sfx.setMuted(true);   sfx.muted  // Zustand wird gespeichert (für alle Spiele gemeinsam)

import { store } from './storage.js';

let ctx = null;
let master = null;
let muted = store.get('muted', false);
let lastPlay = new Map();

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  // Ein stiller Buffer "entsperrt" Audio auf älteren iOS-Versionen.
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(master);
    s.start(0);
  } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
  const once = () => { unlock(); };
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('touchend', once, { passive: true });
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.12, vol = 0.3, attack = 0.005, delay = 0 }) {
  const c = ctx;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, from = 2000, to = 400, delay = 0, q = 1 }) {
  const c = ctx;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  click: () => tone({ freq: 900, type: 'triangle', dur: 0.05, vol: 0.12 }),
  tap: () => tone({ freq: 620, to: 520, type: 'triangle', dur: 0.07, vol: 0.18 }),
  pop: () => {
    tone({ freq: 380, to: 900, type: 'sine', dur: 0.09, vol: 0.28 });
    tone({ freq: 1200, type: 'triangle', dur: 0.05, vol: 0.06, delay: 0.03 });
  },
  fill: () => {
    const base = 520 + Math.random() * 120;
    tone({ freq: base, to: base * 1.5, type: 'sine', dur: 0.16, vol: 0.22 });
    tone({ freq: base * 2, type: 'triangle', dur: 0.08, vol: 0.05, delay: 0.02 });
  },
  place: () => {
    const base = 700 + Math.random() * 200;
    tone({ freq: base, type: 'sine', dur: 0.06, vol: 0.14 });
  },
  whoosh: () => noise({ dur: 0.28, vol: 0.22, from: 600, to: 3200, q: 0.8 }),
  thud: () => {
    tone({ freq: 140, to: 70, type: 'sine', dur: 0.16, vol: 0.4 });
    noise({ dur: 0.08, vol: 0.12, from: 500, to: 200, q: 1.2 });
  },
  error: () => {
    tone({ freq: 220, to: 170, type: 'square', dur: 0.14, vol: 0.09 });
    tone({ freq: 180, to: 140, type: 'square', dur: 0.18, vol: 0.08, delay: 0.1 });
  },
  sparkle: () => {
    [1320, 1760, 2349].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.12, vol: 0.08, delay: i * 0.05 }));
  },
  complete: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.32, vol: 0.18, delay: i * 0.11 }));
    tone({ freq: 1567.98, type: 'sine', dur: 0.6, vol: 0.1, delay: 0.46 });
  },
};

export const sfx = {
  get muted() { return muted; },
  setMuted(v) {
    muted = !!v;
    store.set('muted', muted);
  },
  toggle() { this.setMuted(!muted); return muted; },
  unlock,
  /** Spielt einen Effekt. Mehrfachaufrufe innerhalb von 25 ms werden gedrosselt. */
  play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const now = performance.now();
    if (now - (lastPlay.get(name) || 0) < 25) return;
    lastPlay.set(name, now);
    try { fn(); } catch { /* ignore */ }
  },
};
