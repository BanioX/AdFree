// Farbfluss – eigene, sanfte Flüssigkeits-Geräusche (WebAudio, keine Dateien).
// Respektiert den gemeinsamen Ton-Schalter (sfx.muted).

import { sfx } from '../../shared/sfx.js';

let ctx = null;
let out = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    out.connect(lp);
    lp.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
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

/** Ein «Blubb»: kurzer, weicher Ton mit aufsteigender Tonhöhe. */
function bloop(c, t0, f0, vol) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f0 * 2.1, t0 + 0.07);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t0 + 0.12);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  o.connect(g);
  g.connect(out);
  o.start(t0);
  o.stop(t0 + 0.15);
}

/** Leises Rauschen für den Strahl. */
function stream(c, t0, dur, vol) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t0);
  bp.frequency.linearRampToValueAtTime(1100, t0 + dur);
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
  g.gain.setValueAtTime(vol, t0 + Math.max(0.06, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const audio = {
  /**
   * Giess-Geräusch: delay (s) bis der Strahl beginnt, dur (s) Dauer, units = Schichten.
   * Die Tonhöhe steigt mit dem Füllstand des Zielglases (fill 0..1).
   */
  pour(delay, dur, units, fill = 0) {
    const c = ready();
    if (!c) return;
    try {
      const t0 = c.currentTime + delay;
      stream(c, t0, dur, 0.05);
      const n = Math.max(2, Math.round(units * 2.2));
      for (let i = 0; i < n; i++) {
        const t = t0 + 0.03 + (i / n) * dur * 0.95 + Math.random() * 0.02;
        const f = 170 + fill * 120 + (i / n) * 70 + Math.random() * 30;
        bloop(c, t, f, 0.16 + Math.random() * 0.06);
      }
    } catch { /* ignore */ }
  },
  /** Aufdecken einer «?»-Schicht. */
  reveal() {
    const c = ready();
    if (!c) return;
    try {
      const t0 = c.currentTime;
      [880, 1175, 1568].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + 0.25);
        o.connect(g); g.connect(out);
        o.start(t0 + i * 0.06); o.stop(t0 + i * 0.06 + 0.3);
      });
    } catch { /* ignore */ }
  },
  /** Korken: «Plopp» + Glöckchen, Tonhöhe je nach Anzahl fertiger Gläser. */
  cork(step = 0) {
    const c = ready();
    if (!c) return;
    try {
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(320, t0);
      o.frequency.exponentialRampToValueAtTime(820, t0 + 0.06);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + 0.12);
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
      const f = scale[step % scale.length] * (step >= scale.length ? 2 : 1);
      const o2 = c.createOscillator();
      const g2 = c.createGain();
      o2.type = 'triangle';
      o2.frequency.value = f;
      g2.gain.setValueAtTime(0.0001, t0 + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.12, t0 + 0.06);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o2.connect(g2); g2.connect(out);
      o2.start(t0 + 0.05); o2.stop(t0 + 0.55);
    } catch { /* ignore */ }
  },
};
