// Koi – two koi circling each other over a pebble mosaic, with floating ginkgo leaves and bubbles.
import { intersect, circlePoly } from './geom.mjs';
import { Pic, DEG, TAU, poly, smooth, tf, circle, ellipse, petalPts, polarPt, lerp, rng, sampleSmooth } from './lib.mjs';

export const meta = { id: 'a-koi', title: 'Koi im Teich', category: 'Tiere' };

const pathOf = (loops) => loops.map((l) => poly(l)).join('');

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    grout: '#5c97a1',
    peb1: '#cfe6e0',
    peb2: '#a9d2cf',
    peb3: '#88bdbf',
    peb4: '#e8f1ea',
    koiW: '#fff8ee',
    koiR: '#e5532f',
    koiO: '#f39a3c',
    koiG: '#f9c95e',
    ink: '#2e2a36',
    fin: '#fbd8c2',
    gk1: '#f5d567',
    gk2: '#e3ad3a',
  });

  // --- pebble mosaic
  pic.add('M0 0H1000V1000H0Z', 'grout');
  const R = rng(11);
  const cols = ['peb1', 'peb2', 'peb3', 'peb4', 'peb2', 'peb1'];
  const S = 112;
  for (let j = -1; j < 10; j++) {
    for (let i = -1; i < 10; i++) {
      const x = i * S + (j % 2 ? S / 2 : 0) + (R() - 0.5) * 18;
      const y = j * S * 0.9 + 40 + (R() - 0.5) * 16;
      if (x < -50 || x > 1050 || y < -50 || y > 1050) continue;
      pic.add(ellipse(x, y, 47 + R() * 6, 38 + R() * 6, (R() - 0.5) * 1.2), cols[Math.floor(R() * cols.length)]);
    }
  }

  // --- ginkgo leaves and bubbles
  const ginkgo = (x, y, a, r) => {
    const half = (s) => {
      const pts = [[0, 0, 'c']];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const ang = s * lerp(4, 52, t) * DEG;
        const rr = r * (t === 0 ? 0.74 : 1 - 0.05 * Math.sin(t * Math.PI * 3));
        pts.push([Math.sin(ang) * rr, -Math.cos(ang) * rr]);
      }
      return tf(s > 0 ? pts : pts.reverse(), { x, y, r: a });
    };
    pic.add(smooth(half(1)), 'gk1');
    pic.add(smooth(half(-1)), 'gk2');
    pic.add(poly(tf([[-7, -6], [7, -6], [9, 70], [-5, 70]], { x, y, r: a })), 'gk2');
  };
  ginkgo(140, 150, -30 * DEG, 120);
  ginkgo(870, 860, 150 * DEG, 120);
  ginkgo(880, 130, 40 * DEG, 96);
  ginkgo(130, 880, -140 * DEG, 96);
  for (const [x, y, r] of [[300, 90, 18], [340, 135, 13], [700, 920, 18], [650, 955, 13], [940, 470, 16], [55, 520, 16]]) pic.add(circle(x, y, r), 'peb4');

  // --- koi
  const C = [500, 500];
  const koi = (aHead, dir, body, patches) => {
    const Rr = 225, span = 135 * DEG, W = 90;
    const spine = (t) => {
      const th = aHead - dir * t * span;
      return { p: polarPt(C[0], C[1], Rr, th), n: [Math.cos(th), Math.sin(th)], tan: [Math.sin(th) * dir, -Math.cos(th) * dir] };
    };
    const prof = [[0.0, 0.5], [0.05, 0.78], [0.12, 0.94], [0.22, 1], [0.38, 0.86], [0.55, 0.6], [0.7, 0.36], [0.84, 0.2], [0.92, 0.16]];
    const off = (t, k) => {
      const s = spine(t);
      return [s.p[0] + s.n[0] * k, s.p[1] + s.n[1] * k];
    };
    // tail and pectoral fins (under the body)
    const tail = spine(0.9);
    const back = Math.atan2(-tail.tan[1], -tail.tan[0]);
    for (const s of [-1, 1]) pic.add(smooth(tf(petalPts(175, 96, { tip: 'notch', wAt: 0.7 }), { x: tail.p[0], y: tail.p[1], r: back + s * 26 * DEG })), 'fin');
    for (const s of [-1, 1]) {
      const b = off(0.2, s * W * 0.7);
      const sp = spine(0.2);
      const out = Math.atan2(sp.n[1] * s, sp.n[0] * s);
      const ang = out + (Math.atan2(-sp.tan[1], -sp.tan[0]) - out) * 0.45;
      pic.add(smooth(tf(petalPts(125, 82, { tip: 'round', wAt: 0.6 }), { x: b[0], y: b[1], r: ang })), 'fin');
    }
    const head = spine(-0.045).p;
    const outline = [head, ...prof.map(([t, k]) => off(t, k * W)), off(0.95, 0), ...prof.slice().reverse().map(([t, k]) => off(t, -k * W))];
    const bodyPoly = sampleSmooth(outline, { closed: true, steps: 8 });
    pic.add(poly(bodyPoly), body);
    for (const [t, side, r, col] of patches) {
      const c = off(t, side * W);
      const loops = intersect(bodyPoly, circlePoly(c[0], c[1], r, 40));
      if (loops.length) pic.add(pathOf(loops), col);
    }
    for (const s of [-1, 1]) {
      const e = off(0.07, s * W * 0.5);
      pic.add(circle(e[0], e[1], 12), 'ink');
    }
  };
  koi(-100 * DEG, 1, 'koiW', [[0.08, 0.2, 52, 'koiR'], [0.36, -0.55, 70, 'koiR'], [0.55, 0.8, 58, 'koiO'], [0.76, -0.2, 34, 'koiR']]);
  koi(80 * DEG, 1, 'koiG', [[0.12, -0.7, 50, 'koiO'], [0.34, 0.65, 60, 'ink'], [0.5, -0.6, 44, 'koiO'], [0.72, 0.4, 36, 'ink']]);

  return pic;
}
