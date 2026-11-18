// Leise eigene Töne, an die gemeinsame Lautstärke und den Stumm-Schalter gehängt.

import { sfx } from '../../shared/sfx.js';

let last = 0;

export function tone(freq, dur = 0.07, vol = 0.05) {
  const now = performance.now();
  if (now - last < 50) return;
  last = now;
  const out = sfx.output();
  if (!out) return;
  const { ctx, node } = out;
  const t0 = ctx.currentTime + 0.004;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(node);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function react(events) {
  for (const ev of events) {
    if (ev === 'hurt' || ev === 'dead') sfx.play('error');
    else if (ev === 'weak') sfx.play('pop');
    else if (ev === 'down' || ev === 'clear') sfx.play('complete');
    else if (ev === 'graze') sfx.play('sparkle');
    else if (ev === 'laser') sfx.play('whoosh');
    else if (ev === 'cannon') sfx.play('thud');
    else if (ev === 'jump') tone(520, 0.05, 0.04);
    else if (ev === 'shot') tone(880, 0.035, 0.03);
  }
}
