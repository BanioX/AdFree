// Perlenbild – eigene, tonal gestimmte Klänge (ergänzt shared/sfx.js).
// Jeder gelegte Stein «pling»t eine Stufe höher (Pentatonik), solange man im Fluss bleibt.
// Respektiert den gemeinsamen Ton-aus-Schalter (sfx.muted).

import { sfx } from '../shared/sfx.js';

let ctx = null;
let master = null;
let lastAt = 0;
let combo = 0;

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
}

function ready() {
  if (sfx.muted) return null;
  const c = ensure();
  if (!c) return null;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

function bell(freq, { vol = 0.16, dur = 0.22, delay = 0 } = {}) {
  const c = ctx;
  const t0 = c.currentTime + delay;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(master);
  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(freq, t0);
  o1.connect(g);
  const g2 = c.createGain();
  g2.gain.value = 0.22;
  g2.connect(g);
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(freq * 2.01, t0);
  o2.connect(g2);
  o1.start(t0); o2.start(t0);
  o1.stop(t0 + dur + 0.03); o2.stop(t0 + dur + 0.03);
}

/** Stein landet im Bild: Tonhöhe steigt mit der Serie. */
export function plink() {
  const c = ready();
  if (!c) return;
  const now = performance.now();
  if (now - lastAt > 650) combo = 0;
  if (now - lastAt < 18) return; // nicht überlagern
  lastAt = now;
  const step = SCALE[Math.min(combo, SCALE.length - 1)];
  combo++;
  const f = 587.33 * Math.pow(2, step / 12); // ab D5
  try { bell(f, { vol: 0.13, dur: 0.2 }); } catch { /* ignore */ }
}

/** Stein landet in der Ablage: weiches, tiefes «Tock». */
export function tock() {
  const c = ready();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(330, t0);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.1);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.14);
  } catch { /* ignore */ }
}

/** Reihe fertig: kleines Glitzer-Arpeggio. */
export function chime() {
  const c = ready();
  if (!c) return;
  try {
    [1174.66, 1479.98, 1760, 2349.32].forEach((f, i) => bell(f, { vol: 0.06, dur: 0.18, delay: i * 0.045 }));
  } catch { /* ignore */ }
}

export function resetCombo() { combo = 0; }
