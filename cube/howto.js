// Pfeilwürfel – «So geht's» (shared/tutorial.js) mit echten Mini-Würfeln als animierte Demos.
// Die Demos benutzen denselben Renderer wie das Spiel, damit alles genau so aussieht.

import { h, icon } from '../shared/ui.js';
import { showTutorial, maybeShowTutorial } from '../shared/tutorial.js';
import { generateLevel, solve, themeFor } from './generator.js';
import { makeCube } from './geometry.js';
import { Game } from './game.js';
import { CubeRenderer } from './render.js';
import { qMul, qAxisAngle, qNorm, clamp, smoothstep } from './math.js';
import { Q_DEFAULT } from './view.js';

const ACCENT = '#f29a1f';

/** Kleiner Hand-Level (3×3) für die ersten zwei Schritte: alles auf den sichtbaren Seiten. */
function demoLevel() {
  const N = 3;
  const geo = makeCube(N);
  const mk = (f, uv) => {
    const cells = uv.map(([u, v]) => geo.cell(f, u, v));
    const n = cells.length;
    const d = geo.dirBetween(cells[n - 2], cells[n - 1]);
    return { cells, dir: geo.step(cells[n - 2], d).d };
  };
  // Seite +Z (4) zeigt nach links vorne, +X (0) nach rechts, +Y (2) nach oben.
  const arrows = [
    mk(4, [[0, 0], [1, 0]]),               // 0: frei (Weg bis zum Rand leer)
    mk(4, [[2, 0], [2, 1]]),               // 1: blockiert durch 2
    mk(4, [[0, 2], [1, 2], [2, 2]]),       // 2: frei
    mk(0, [[0, 0], [1, 0], [2, 0]]),       // Deko
    mk(0, [[0, 2], [0, 1]]),               // Deko
    mk(2, [[2, 0], [2, 1], [2, 2]]),       // Deko
    mk(2, [[0, 2], [0, 1]]),               // Deko
  ];
  return { level: 0, N, hearts: 3, special: null, arrows };
}

/** Mini-Würfel in der Tutorial-Bühne. */
function cubeScene(stage, api, level) {
  const geo = makeCube(level.N);
  const canvas = h('canvas.tut-cube', { 'aria-hidden': 'true' });
  stage.prepend(canvas);
  const r = new CubeRenderer(canvas, { mini: true });
  r.setLevel(geo, level.arrows);
  r.setTheme(themeFor(1));
  let game = new Game(level, geo);
  const view = { q: Q_DEFAULT.slice(), zoom: 0.92, panX: 0, panY: 0 };
  const hidden = new Set();
  let anims = [];
  let flashes = [];
  let spin = null;
  let raf = 0;
  let alive = true;

  const size = () => {
    const b = stage.getBoundingClientRect();
    r.resize(Math.max(1, b.width), Math.max(1, b.height), Math.min(2.5, window.devicePixelRatio || 1));
  };
  size();

  function frame(t) {
    raf = 0;
    if (!alive) return;
    if (spin) {
      const p = clamp((t - spin.t0) / spin.dur, 0, 1);
      const e = p < 0 ? 0 : p * p * (3 - 2 * p);
      view.q = qNorm(qMul(qAxisAngle(spin.axis, spin.angle * e), spin.q0));
      if (p >= 1) spin = null;
    }
    const drawAnims = [];
    const keep = [];
    for (const an of anims) {
      const age = t - an.t0;
      if (an.kind === 'exit') {
        const p = clamp(age / an.dur, 0, 1);
        const e = (x) => 0.3 * x + 0.7 * x * x;
        const a = an.travel * e(clamp((p - 0.1) / 0.9, 0, 1));
        const b = an.path.len + an.travel * e(p);
        const alpha = 1 - smoothstep(an.path.edgeArc - 0.6, an.path.edgeArc + 1.25, a);
        drawAnims.push({ id: an.id, a, b, alpha, color: 'blue', glow: Math.max(0, 1 - p * 1.6), pass: r.vis[an.path.headFace] ? 'front' : 'back' });
        if (p < 1) keep.push(an); else hidden.delete(an.id);
      } else {
        let s;
        if (age < an.tf) { const x = Math.max(0, age) / an.tf; s = an.reach * x * x; } else {
          if (!an.hit) { an.hit = true; an.onHit && an.onHit(); flashes.push({ id: an.blocker, t0: t }); }
          const q = clamp((age - an.tf) / an.tb, 0, 1);
          s = an.reach * Math.exp(-4.6 * q) * Math.cos(q * Math.PI * 1.7);
        }
        const done = age >= an.tf + an.tb;
        drawAnims.push({ id: an.id, a: s, b: an.path.len + s, alpha: 1, color: done ? 'ink' : 'blue', glow: age < an.tf + 120 ? 0.8 : 0, pass: 'front' });
        if (!done) keep.push(an); else hidden.delete(an.id);
      }
    }
    anims = keep;
    const hl = new Map();
    flashes = flashes.filter((f) => t - f.t0 < 950);
    for (const f of flashes) {
      const p = (t - f.t0) / 950;
      hl.set(f.id, { color: 'red', k: 1 - p, mix: 1 - smoothstep(0.45, 1, p) });
    }
    r.draw(view, { removed: game.removed, hidden, anims: drawAnims, highlights: hl, particles: [] });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  api.signal.addEventListener('abort', () => { alive = false; if (raf) cancelAnimationFrame(raf); });

  const skip = (i) => game.removed[i] || hidden.has(i);
  return {
    game: () => game,
    /** Tipp-Punkt eines Pfeils in % der Bühne (für den Finger). */
    point(id) {
      r.draw(view, { removed: game.removed, hidden });
      const p = r.tapPointFor(id, skip);
      if (!p) return { x: 50, y: 50 };
      return { x: (p.x / r.w) * 100, y: (p.y / r.h) * 100 };
    },
    exit(id) {
      if (game.removed[id]) return;
      game.remove(id);
      const path = r.exitPath(id);
      const travel = path.edgeArc + 1.3;
      hidden.add(id);
      anims.push({ kind: 'exit', id, path, travel, dur: clamp(300 + travel * 26, 360, 640), t0: performance.now() });
    },
    bump(id, onHit) {
      const res = game.check(id);
      if (res.free) return;
      const path = r.exitPath(id);
      const reach = Math.max(0.18, res.dist + 1 - 0.68);
      hidden.add(id);
      anims.push({ kind: 'bump', id, blocker: res.blocker, path, reach, tf: Math.min(330, 110 + reach * 30), tb: 430, t0: performance.now(), onHit });
    },
    spin(axis, angle, dur) { spin = { axis, angle, dur, q0: view.q.slice(), t0: performance.now() }; },
    resetView() { view.q = Q_DEFAULT.slice(); },
    reset() { game = new Game(level, geo); anims = []; hidden.clear(); flashes = []; },
  };
}

function heartRow(stage, n) {
  const row = h('div.tut-hearts');
  for (let i = 0; i < n; i++) row.append(h('span.full', { html: icon('heart', { size: 20, fill: true }) }));
  stage.append(row);
  return {
    lose() {
      const full = row.querySelectorAll('span.full');
      const el = full[full.length - 1];
      if (el) { el.classList.remove('full'); el.classList.add('lost'); el.innerHTML = icon('heart', { size: 20 }); }
    },
    reset() { row.querySelectorAll('span').forEach((el) => { el.className = 'full'; el.innerHTML = icon('heart', { size: 20, fill: true }); }); },
  };
}

function steps() {
  return [
    {
      title: 'Pfeil antippen',
      text: 'Ist der Weg bis zum Rand frei, gleitet der Pfeil hinaus.',
      demo(stage, api) {
        const sc = cubeScene(stage, api, demoLevel());
        return api.loop(async () => {
          sc.reset();
          await api.sleep(500);
          await api.finger.tap(sc.point(0));
          sc.exit(0);
          await api.sleep(800);
          await api.finger.tap(sc.point(2));
          sc.exit(2);
          await api.sleep(900);
          api.finger.hide();
          await api.sleep(500);
        }, 300);
      },
    },
    {
      title: 'Nicht anstossen',
      text: 'Steht ein Pfeil im Weg, prallt deiner ab – das kostet ein Herz.',
      demo(stage, api) {
        const sc = cubeScene(stage, api, demoLevel());
        const hearts = heartRow(stage, 3);
        return api.loop(async () => {
          sc.reset();
          hearts.reset();
          await api.sleep(400);
          await api.finger.tap(sc.point(1));
          sc.bump(1, () => hearts.lose());
          await api.sleep(1100);
          await api.finger.tap(sc.point(2));
          sc.exit(2);
          await api.sleep(700);
          await api.finger.tap(sc.point(1));
          sc.exit(1);
          await api.sleep(1000);
          api.finger.hide();
          await api.sleep(400);
        }, 300);
      },
    },
    {
      title: 'Würfel drehen',
      text: 'Wische zum Drehen, mit zwei Fingern zoomen. Pfeile laufen auch über Kanten.',
      demo(stage, api) {
        const sc = cubeScene(stage, api, generateLevel(1));
        return api.loop(async () => {
          sc.resetView();
          await api.sleep(300);
          const drag = api.finger.drag([{ x: 74, y: 64 }, { x: 50, y: 62 }, { x: 26, y: 60 }], 1100);
          setTimeout(() => sc.spin([0, 1, 0], -Math.PI / 2, 1150), 650);
          await drag;
          api.finger.hide();
          await api.sleep(900);
          const back = api.finger.drag([{ x: 26, y: 64 }, { x: 50, y: 62 }, { x: 74, y: 60 }], 1100);
          setTimeout(() => sc.spin([0, 1, 0], Math.PI / 2, 1150), 650);
          await back;
          api.finger.hide();
          await api.sleep(1000);
        }, 300);
      },
    },
    {
      title: 'Alle Pfeile raus',
      text: 'Räum den ganzen Würfel ab. Ohne Fehler gibt es drei Sterne, Tipps sind gratis.',
      demo(stage, api) {
        const lv = generateLevel(1);
        const sc = cubeScene(stage, api, lv);
        const order = solve(makeCube(lv.N), lv.arrows) || [];
        const stars = h('div.tut-stars', null, [0, 1, 2].map((i) => h('span', { html: icon('star', { size: 40 }), style: { '--i': i } })));
        stage.append(stars);
        return api.loop(async () => {
          sc.reset();
          sc.resetView();
          stars.classList.remove('on');
          api.finger.hide();
          await api.sleep(400);
          sc.spin([0, 1, 0], Math.PI * 1.5, order.length * 330 + 300);
          for (const id of order) {
            sc.exit(id);
            await api.sleep(330);
          }
          await api.sleep(500);
          stars.classList.add('on');
          await api.sleep(1800);
        }, 300);
      },
    },
  ];
}

export function showHowto() {
  return showTutorial({ id: 'cube', steps: steps(), accent: ACCENT });
}

export function maybeShowHowto() {
  return maybeShowTutorial({ id: 'cube', steps: steps(), accent: ACCENT });
}
