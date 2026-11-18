// Wabenstapel – «So geht's»: vier kurze Schritte mit animierten Mini-Szenen (echtes Zeichnen aus render.js).

import { h, icon } from '../shared/ui.js';
import { SQ3, KY, drawPad, drawStack, drawTile, tileThickness, layerGap, COLORS } from './render.js';

const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Mini-Szene: Felder + Stapel + fliegende Plättchen, gezeichnet in einer rAF-Schleife bis zum Abbruch. */
function scene(stage, api, { s = 26, cells }) {
  const W = stage.clientWidth || 340, H = stage.clientHeight || 230;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cv = h('canvas', { width: Math.round(W * dpr), height: Math.round(H * dpr), style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  stage.prepend(cv);
  const ctx = cv.getContext('2d');
  const sc = { W, H, s, cells, loose: [], flights: [], sparks: [], glow: null };
  function frame(now) {
    if (api.signal.aborted) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const c of sc.cells) drawPad(ctx, c.x, c.y, s, sc.glow === c ? 'hint' : 'pad', now);
    for (const c of sc.cells) if (c.st.length) drawStack(ctx, c.x, c.y, s, c.st);
    for (const l of sc.loose) drawStack(ctx, l.x, l.y, s, l.st, { alpha: l.a ?? 1 });
    for (const f of sc.flights) {
      const x = f.x0 + (f.x1 - f.x0) * f.t;
      const y = f.y0 + (f.y1 - f.y0) * f.t - Math.sin(Math.PI * f.t) * s;
      drawTile(ctx, x, y, s, tileThickness(s), f.col, { flip: Math.cos(Math.PI * 2 * f.t), alpha: f.a ?? 1 });
    }
    for (let i = sc.sparks.length - 1; i >= 0; i--) {
      const p = sc.sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) { sc.sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  sc.anim = (ms, fn) => new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => {
      if (api.signal.aborted) return res();
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  sc.pct = (x, y) => ({ x: (x / W) * 100, y: (y / H) * 100 });
  /** n Plättchen von a nach b fliegen lassen */
  sc.move = async (a, b, n) => {
    const all = [];
    for (let k = 0; k < n; k++) {
      all.push((async () => {
        await api.sleep(k * 90);
        const col = a.st.pop();
        const f = { col, t: 0, x0: a.x, y0: a.y - a.st.length * layerGap(s, a.st.length + 1), x1: b.x, y1: b.y - b.st.length * layerGap(s, b.st.length + 1) - k * layerGap(s, 8) };
        sc.flights.push(f);
        await sc.anim(320, (t) => { f.t = easeIO(t); });
        sc.flights.splice(sc.flights.indexOf(f), 1);
        b.st.push(col);
      })());
    }
    await Promise.all(all);
  };
  sc.burst = (x, y, color) => {
    const c = COLORS[color];
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.2 + Math.random() * 3;
      sc.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 2, life: 28 + Math.random() * 16, c: i % 3 ? c.top : '#fff3c4' });
    }
  };
  return sc;
}

/** Kleine Wabe aus 7 Feldern um (cx, cy). */
function flower(cx, cy, s) {
  const dx = SQ3 * s, dy = 1.5 * KY * s;
  return [[0, 0], [-1, 0], [1, 0], [-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]
    .map(([x, y]) => ({ x: cx + x * dx, y: cy + y * dy, st: [] }));
}

function label(stage, text, x, y) {
  const el = h('div.hx-tut-float', { style: { left: x + 'px', top: y + 'px' } }, text);
  stage.append(el);
  setTimeout(() => el.remove(), 1200);
}

export function tutorialSteps() {
  return [
    {
      title: 'Stapel ziehen',
      text: 'Zieh einen Stapel aus der Ablage auf ein freies Feld.',
      demo(stage, api) {
        const W = stage.clientWidth || 340, H = stage.clientHeight || 230;
        const s = Math.min(26, H / 9);
        const cells = flower(W / 2, H * 0.36, s);
        const sc = scene(stage, api, { s, cells });
        return api.loop(async () => {
          cells.forEach((c) => { c.st = []; });
          cells[1].st = [1, 1, 4];
          cells[4].st = [0, 3, 3];
          const tray = { x: W / 2, y: H * 0.86, st: [2, 2, 0, 0], a: 1 };
          sc.loose = [tray];
          await api.sleep(300);
          await api.finger.moveTo(sc.pct(tray.x, tray.y - s * 0.4), 500);
          await api.finger.press(150);
          const tgt = cells[6];
          const x0 = tray.x, y0 = tray.y;
          const mv = api.finger.moveTo(sc.pct(tgt.x, tgt.y + s * 0.2), 750);
          await sc.anim(750, (t) => { const k = easeIO(t); tray.x = x0 + (tgt.x - x0) * k; tray.y = y0 + (tgt.y - y0) * k; });
          await mv;
          sc.loose = [];
          tgt.st = tray.st.slice();
          api.finger.hide();
          await api.sleep(1100);
        }, 300);
      },
    },
    {
      title: 'Farben wandern',
      text: 'Liegt oben die gleiche Farbe daneben, springen die Plättchen hinüber.',
      demo(stage, api) {
        const W = stage.clientWidth || 340, H = stage.clientHeight || 230;
        const s = Math.min(28, H / 8);
        const cells = flower(W / 2, H * 0.58, s);
        const sc = scene(stage, api, { s, cells });
        api.finger.hide();
        return api.loop(async () => {
          cells.forEach((c) => { c.st = []; });
          cells[2].st = [1, 1, 3, 3, 3];
          cells[3].st = [4, 4, 0];
          cells[5].st = [2, 2, 3];
          const drop = { x: W / 2, y: H * 0.12, st: [0, 0, 3, 3], a: 1 };
          sc.loose = [drop];
          await sc.anim(450, (t) => { drop.y = H * 0.12 + (cells[0].y - H * 0.12) * easeIO(t); });
          sc.loose = [];
          cells[0].st = drop.st.slice();
          await api.sleep(350);
          await sc.move(cells[2], cells[0], 3);
          await sc.move(cells[5], cells[0], 1);
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Zehn räumen ab',
      text: 'Zehn gleiche Plättchen auf einem Stapel verschwinden – so erreichst du das Ziel.',
      demo(stage, api) {
        const W = stage.clientWidth || 340, H = stage.clientHeight || 230;
        const s = Math.min(28, H / 8);
        const cells = flower(W / 2, H * 0.66, s);
        const sc = scene(stage, api, { s, cells });
        api.finger.hide();
        return api.loop(async () => {
          cells.forEach((c) => { c.st = []; });
          cells[0].st = [3, 2, 2, 2, 2, 2, 2, 2];
          cells[2].st = [1, 4, 2, 2, 2];
          cells[5].st = [0, 0];
          await api.sleep(500);
          await sc.move(cells[2], cells[0], 3);
          await api.sleep(250);
          const c = cells[0];
          const gap = layerGap(s, c.st.length);
          sc.burst(c.x, c.y - 6 * gap, 2);
          label(stage, '+10', c.x, c.y - 9 * gap);
          const removed = c.st.splice(1, 10);
          const fl = removed.map((col, i) => ({ col, t: 0, a: 1, x0: c.x, x1: c.x, y0: c.y - (1 + i) * gap, y1: c.y - (1 + i) * gap - s }));
          sc.flights.push(...fl);
          await sc.anim(380, (t) => fl.forEach((f) => { f.t = t * 0.5; f.a = 1 - t; }));
          sc.flights.length = 0;
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Hilfen & Endlos',
      text: 'Zurück, Tipp und neue Stapel sind gratis. Im Endlos-Modus jagst du deinen Rekord.',
      demo(stage, api) {
        const W = stage.clientWidth || 340, H = stage.clientHeight || 230;
        const s = Math.min(24, H / 9);
        const cells = flower(W / 2, H * 0.33, s);
        const sc = scene(stage, api, { s, cells });
        cells[1].st = [3, 3, 0, 0]; cells[3].st = [2, 4]; cells[6].st = [1, 1, 0];
        const row = h('div.hx-tut-tools', null,
          ...[['undo', 'Zurück'], ['hint', 'Tipp'], ['shuffle', 'Neue Stapel']].map(([ic, lb]) =>
            h('div.hx-tut-tool', null, h('span', { html: icon(ic, { size: 20 }) }), h('small', null, lb))));
        stage.append(row);
        const hintBtn = row.children[1];
        return api.loop(async () => {
          sc.glow = null;
          await api.finger.tap(hintBtn);
          hintBtn.classList.add('on');
          sc.glow = cells[0];
          await api.sleep(1600);
          hintBtn.classList.remove('on');
          sc.glow = null;
          await api.sleep(400);
        }, 500);
      },
    },
  ];
}
