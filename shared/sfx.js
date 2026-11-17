// Sanfte, synthetisierte Soundeffekte via WebAudio – keine Audiodateien nötig.
//
// Gestaltung: weiche Glocken-/Marimba-Töne (Sinus + leiser Oberton), Tiefpass gegen Schärfe,
// ein Hauch Hall, Töne aus einer Pentatonik (klingt nie schief), starke Drosselung bei
// schnellen Wiederholungen. UI-Klicks sind bewusst stumm.
//
// iPhone: navigator.audioSession.type = 'ambient' → respektiert den Stumm-Schalter und
// unterbricht keine Musik/Podcasts, die gerade laufen.
//
//   import { sfx } from '../shared/sfx.js';
//   sfx.play('pop');   // tap | pop | fill | place | whoosh | error | complete | sparkle | click | thud
//   sfx.level          // 'leise' | 'normal' | 'aus'  (für alle Spiele gemeinsam gespeichert)
//   sfx.cycle()        // leise → normal → aus → leise …
//   sfx.muted, sfx.setMuted(bool), sfx.toggle()   // weiterhin unterstützt
//   const out = sfx.output(); if (out) myOsc.connect(out.node)   // eigene Klänge, gleiche Lautstärke

import { store } from './storage.js';

const LEVELS = { leise: 0.16, normal: 0.32, aus: 0 };
// Alte Einstellung «muted» übernehmen; Standard ist «leise».
let level = store.get('soundLevel', null) || (store.get('muted', false) ? 'aus' : 'leise');
if (!(level in LEVELS)) level = 'leise';

let ctx = null;
let master = null;
let bus = null;
const lastPlay = new Map();
let recent = [];            // Zeitstempel der letzten Töne (globale Drosselung)
let combo = { t: 0, step: 0 };

// Pentatonik (C-Dur): Folgetöne steigen bei schnellen Ketten sanft an
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

try {
  if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'ambient';
} catch { /* ignore */ }

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = LEVELS[level];
    // Weich machen: Tiefpass + sanfter Kompressor gegen Lautstärkespitzen
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    // Ein Hauch Hall (Feedback-Delay) für Wärme
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.13;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.14;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 1800;
    bus = ctx.createGain();
    bus.connect(lp);
    lp.connect(comp);
    comp.connect(master);
    lp.connect(delay);
    delay.connect(dl);
    dl.connect(fb);
    fb.connect(delay);
    dl.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  if (level === 'aus') return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(master);
    s.start(0);
  } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
}

/** Weicher Glockenton: Sinus-Grundton + leiser Oberton, sanfter Einschwinger, exponentielles Ausklingen. */
function bell(freq, { vol = 0.25, dur = 0.35, delay = 0, partial = 2, partialVol = 0.18, type = 'sine', glide = null } = {}) {
  const c = ctx;
  const t0 = c.currentTime + delay + 0.005;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(bus);
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur * 0.6);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  if (partial) {
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(vol * partialVol, t0 + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.45);
    g2.connect(bus);
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * partial, t0);
    o2.connect(g2);
    o2.start(t0);
    o2.stop(t0 + dur);
  }
}

/** Gefiltertes Rauschen (für «Wusch»). */
function air({ dur = 0.3, vol = 0.08, from = 500, to = 1600, delay = 0 } = {}) {
  const c = ctx;
  const t0 = c.currentTime + delay + 0.005;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Nächster Ton der Pentatonik – bei schnellen Folgen aufsteigend, sonst wieder von unten. */
function nextNote(base = 0) {
  const now = performance.now();
  combo.step = now - combo.t < 650 ? Math.min(combo.step + 1, PENTA.length - 1 - base) : 0;
  combo.t = now;
  return PENTA[base + combo.step];
}

const SOUNDS = {
  click: null, // UI-Knöpfe bleiben stumm
  tap: () => bell(659.25, { vol: 0.12, dur: 0.12, partialVol: 0.08 }),
  pop: () => bell(nextNote(1), { vol: 0.2, dur: 0.22, partial: 3, partialVol: 0.08 }),
  place: () => bell(nextNote(0), { vol: 0.13, dur: 0.18, partialVol: 0.1 }),
  fill: () => bell(nextNote(2), { vol: 0.18, dur: 0.38, partialVol: 0.15 }),
  whoosh: () => air({ dur: 0.32, vol: 0.06, from: 400, to: 1400 }),
  thud: () => bell(196, { vol: 0.22, dur: 0.2, partial: 0, glide: 150 }),
  error: () => {
    bell(311.13, { vol: 0.12, dur: 0.16, partial: 0 });
    bell(261.63, { vol: 0.1, dur: 0.22, partial: 0, delay: 0.09 });
  },
  sparkle: () => {
    [1318.51, 1567.98, 2093.0].forEach((f, i) => bell(f, { vol: 0.06, dur: 0.3, partial: 0, delay: i * 0.06 }));
  },
  complete: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, { vol: 0.16, dur: 0.6, partialVol: 0.12, delay: i * 0.12 }));
    bell(1318.51, { vol: 0.07, dur: 0.9, partial: 0, delay: 0.5 });
  },
};

// Mindestabstand gleicher Töne (ms)
const GAP = { tap: 70, pop: 60, place: 55, fill: 80, whoosh: 160, thud: 120, error: 300, sparkle: 250, complete: 1200 };

function applyLevel() {
  if (master && ctx) {
    try { master.gain.setTargetAtTime(LEVELS[level], ctx.currentTime, 0.03); } catch { master.gain.value = LEVELS[level]; }
  }
}

export const sfx = {
  get level() { return level; },
  setLevel(l) {
    if (!(l in LEVELS)) return;
    level = l;
    store.set('soundLevel', level);
    store.set('muted', level === 'aus');
    applyLevel();
  },
  /** leise → normal → aus → leise */
  cycle() {
    const order = ['leise', 'normal', 'aus'];
    this.setLevel(order[(order.indexOf(level) + 1) % order.length]);
    return level;
  },
  get muted() { return level === 'aus'; },
  setMuted(v) { this.setLevel(v ? 'aus' : 'leise'); },
  toggle() { this.setMuted(level !== 'aus'); return level === 'aus'; },
  unlock,
  /**
   * Für spieleigene Klänge: { ctx, node } – eigene Töne an «node» anschliessen statt an
   * ctx.destination. So gelten gemeinsame Lautstärke (leise/normal/aus), Tiefpass und Hall.
   * Gibt null zurück, wenn der Ton aus ist oder WebAudio fehlt.
   */
  output() {
    if (level === 'aus') return null;
    const c = ensureCtx();
    if (!c) return null;
    if (c.state === 'suspended') c.resume().catch(() => {});
    return { ctx: c, node: bus };
  },
  play(name) {
    if (level === 'aus') return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const now = performance.now();
    if (now - (lastPlay.get(name) || 0) < (GAP[name] || 60)) return;
    // Global höchstens 8 Töne pro Sekunde
    recent = recent.filter((t) => now - t < 1000);
    if (recent.length >= 8 && name !== 'complete') return;
    if (document.hidden) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    lastPlay.set(name, now);
    recent.push(now);
    try { fn(); } catch { /* ignore */ }
  },
};
