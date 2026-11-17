// Kleine eigene Klänge für die Sortier-Spiele – immer über sfx.output().node,
// damit die gemeinsame Lautstärke (leise / normal / aus) gilt.

import { sfx } from '../../shared/sfx.js';

const last = new Map();

function out(name, gap) {
  if (typeof document !== 'undefined' && document.hidden) return null;
  const now = performance.now();
  if (name && now - (last.get(name) || 0) < gap) return null;
  const o = sfx.output();
  if (!o) return null;
  if (name) last.set(name, now);
  return o;
}

/** Weicher Ton mit Hüllkurve. */
export function tone({ name, gap = 40, freq = 600, to, dur = 0.12, type = 'sine', gain = 0.16, attack = 0.004, delay = 0 } = {}) {
  const o = out(name, gap);
  if (!o) return;
  const { ctx, node } = o;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(node);
  osc.start(t); osc.stop(t + dur + 0.03);
}

let noiseBuf = null;
/** Kurzes gefiltertes Rauschen (Klicken, Rascheln). */
export function noise({ name, gap = 40, dur = 0.05, gain = 0.12, freq = 2400, q = 1.2, delay = 0, type = 'bandpass' } = {}) {
  const o = out(name, gap);
  if (!o) return;
  const { ctx, node } = o;
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(node);
  src.start(t); src.stop(t + dur + 0.02);
}
