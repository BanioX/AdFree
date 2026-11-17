// Puzzle – Anleitung («So geht's») mit animierten Mini-Szenen aus echten Puzzleteil-Formen.

import { h, icon } from '../shared/ui.js';
import { makeGeometry, targetOf } from './logic.js';

const GEO = makeGeometry({ cols: 3, rows: 2, seed: 11, aspect: 1.5 });

// Kleines gemaltes Bild (Abendhimmel über Hügeln) in Welt-Koordinaten 1000 × 667
const PIC = `
  <rect x="0" y="0" width="1000" height="667" fill="url(#pzt-sky)"/>
  <circle cx="690" cy="300" r="95" fill="#fff1c9"/>
  <circle cx="690" cy="300" r="150" fill="#fff1c9" opacity=".25"/>
  <path d="M0 430 C180 330 320 360 470 410 S760 330 1000 380 V667 H0Z" fill="#c7779a"/>
  <path d="M0 520 C220 440 420 470 600 520 S860 470 1000 500 V667 H0Z" fill="#7d5c9e"/>
  <path d="M0 600 C260 560 520 590 1000 570 V667 H0Z" fill="#4c4a86"/>
  <circle cx="160" cy="140" r="5" fill="#fff" opacity=".8"/><circle cx="300" cy="90" r="4" fill="#fff" opacity=".7"/>
  <circle cx="860" cy="120" r="5" fill="#fff" opacity=".8"/>`;

const DEFS = `<defs><linearGradient id="pzt-sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#7f74cf"/><stop offset=".55" stop-color="#f2889a"/><stop offset="1" stop-color="#ffc58a"/>
</linearGradient></defs>`;

function pieceSvg(i) {
  const pad = GEO.margin;
  const c = i % GEO.cols, r = Math.floor(i / GEO.cols);
  const ox = c * GEO.pw, oy = r * GEO.ph;
  const vb = `${ox - pad} ${oy - pad} ${GEO.pw + 2 * pad} ${GEO.ph + 2 * pad}`;
  const d = GEO.piecePath(i);
  return `<svg viewBox="${vb}" aria-hidden="true">${DEFS}
    <clipPath id="pzt-c${i}"><path transform="translate(${ox} ${oy})" d="${d}"/></clipPath>
    <path transform="translate(${ox} ${oy + 10})" d="${d}" fill="rgba(60,35,15,.28)"/>
    <g clip-path="url(#pzt-c${i})">${PIC}</g>
    <path transform="translate(${ox} ${oy})" d="${d}" fill="none" stroke="rgba(60,35,15,.45)" stroke-width="7"/>
  </svg>`;
}

/** Bühne mit Brett oben und Leiste unten. Gibt Hilfsfunktionen zur Positionierung zurück. */
function scene(stage, { tray = true, ghost = false } = {}) {
  const rect = stage.getBoundingClientRect();
  const SW = rect.width || 300, SH = rect.height || 240;
  const bw = Math.min(SW * 0.6, (SH * 0.56) * 1.5);
  const bh = bw / 1.5;
  const bx = (SW - bw) / 2, by = SH * 0.08;
  const k = bw / 1000;
  const boardEl = h('div.pzt-board', { style: { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' } });
  if (ghost) boardEl.innerHTML = `<svg viewBox="0 0 1000 667" class="pzt-ghost">${DEFS}${PIC}</svg>`;
  stage.append(boardEl);
  let trayEl = null;
  if (tray) {
    trayEl = h('div.pzt-tray', { style: { top: (SH - 64) + 'px' } });
    stage.append(trayEl);
  }
  const size = (GEO.pw + 2 * GEO.margin) * k;
  function piece(i, x, y, cls = '') {
    const el = h('div.pzt-piece' + cls, { html: pieceSvg(i) });
    Object.assign(el.style, { width: size + 'px', height: size + 'px' });
    stage.append(el);
    move(el, x, y, 0);
    return el;
  }
  function move(el, x, y, ms) {
    el.style.transition = ms ? `left ${ms}ms cubic-bezier(.45,.05,.3,1), top ${ms}ms cubic-bezier(.45,.05,.3,1), transform .2s` : 'none';
    el.style.left = (x - size / 2) + 'px';
    el.style.top = (y - size / 2) + 'px';
  }
  const target = (i) => { const [x, y] = targetOf(GEO, i); return { x: bx + x * k, y: by + y * k }; };
  const pct = (p) => ({ x: (p.x / SW) * 100, y: (p.y / SH) * 100 });
  return { SW, SH, bx, by, bw, bh, k, size, piece, move, target, pct, trayY: SH - 32, boardEl };
}

export const howtoSteps = [
  {
    title: 'Teil hochziehen',
    text: 'Zieh ein Teil aus der Leiste unten nach oben auf den Tisch.',
    demo(stage, api) {
      const s = scene(stage);
      const placed = [0, 1, 3].map((i) => { const t = s.target(i); return s.piece(i, t.x, t.y); });
      const trayPos = [{ x: s.SW * 0.3, y: s.trayY }, { x: s.SW * 0.5, y: s.trayY }, { x: s.SW * 0.7, y: s.trayY }];
      const loose = [5, 2, 4].map((i, n) => s.piece(i, trayPos[n].x, trayPos[n].y, '.small'));
      void placed;
      return api.loop(async () => {
        const el = loose[1];
        el.classList.add('small');
        s.move(el, trayPos[1].x, trayPos[1].y, 0);
        el.classList.remove('lift', 'flash');
        const t = s.target(2);
        const p = api.finger.drag([s.pct(trayPos[1]), s.pct({ x: t.x + 3, y: t.y + 4 })], 950);
        p.catch(() => {});
        await api.sleep(650);
        el.classList.remove('small'); el.classList.add('lift');
        s.move(el, t.x + 3, t.y + 4, 950);
        await p;
        el.classList.remove('lift');
        s.move(el, t.x, t.y, 120);
        el.classList.add('flash');
        await api.sleep(1100);
      }, 300);
    },
  },
  {
    title: 'Einrasten lassen',
    text: 'Nahe am richtigen Platz rastet ein Teil mit einem Klick ein. Passende Nachbarn halten zusammen.',
    demo(stage, api) {
      const s = scene(stage, { tray: false });
      for (const i of [0, 3]) { const t = s.target(i); s.piece(i, t.x, t.y); }
      const a = s.piece(1, 0, 0), b = s.piece(4, 0, 0), c = s.piece(2, 0, 0), d = s.piece(5, 0, 0);
      return api.loop(async () => {
        const off = { x: s.SW * 0.06, y: s.SH * 0.5 };
        const t1 = s.target(1), t4 = s.target(4), t2 = s.target(2), t5 = s.target(5);
        for (const el of [a, b, c, d]) el.classList.remove('flash');
        s.move(a, t1.x - off.x * 2.2, t1.y + off.y, 0);
        s.move(b, t4.x + off.x * 2.4, t4.y + off.y * 0.62, 0);
        s.move(c, t2.x + off.x * 1.2, t2.y + off.y * 1.05, 0);
        s.move(d, t5.x + off.x * 0.4, t5.y + off.y * 0.7, 0);
        await api.sleep(300);
        // Teil a an seinen Nachbarn b andocken
        const pa = api.finger.drag([s.pct({ x: t1.x - off.x * 2.2, y: t1.y + off.y }), s.pct({ x: t1.x + off.x * 2.4 - 2, y: t1.y + off.y * 0.62 + 2 })], 800);
        pa.catch(() => {});
        await api.sleep(650);
        s.move(a, t1.x + off.x * 2.4 - 2, t1.y + off.y * 0.62 + 2, 800);
        await pa;
        s.move(a, t1.x + off.x * 2.4, t1.y + off.y * 0.62, 100);
        a.classList.add('flash'); b.classList.add('flash');
        await api.sleep(500);
        a.classList.remove('flash'); b.classList.remove('flash');
        // Gruppe aufs Brett
        const pb = api.finger.drag([s.pct({ x: t4.x + off.x * 2.4, y: t4.y + off.y * 0.62 }), s.pct({ x: t4.x + 3, y: t4.y + 3 })], 800);
        pb.catch(() => {});
        await api.sleep(650);
        s.move(a, t1.x + 3, t1.y + 3, 800); s.move(b, t4.x + 3, t4.y + 3, 800);
        await pb;
        s.move(a, t1.x, t1.y, 100); s.move(b, t4.x, t4.y, 100);
        a.classList.add('flash'); b.classList.add('flash');
        await api.sleep(500);
        s.move(c, t2.x, t2.y, 500); s.move(d, t5.x, t5.y, 500);
        await api.sleep(520);
        c.classList.add('flash'); d.classList.add('flash');
        s.boardEl.classList.add('done');
        await api.sleep(1300);
        s.boardEl.classList.remove('done');
      }, 300);
    },
  },
  {
    title: 'Kleine Helfer',
    text: 'Leiste nach Rand- oder Innenteilen filtern, Vorlage einblenden und mit zwei Fingern zoomen.',
    demo(stage, api) {
      const s = scene(stage, { tray: false, ghost: true });
      s.boardEl.classList.add('ghost-off');
      for (const i of [0, 1]) { const t = s.target(i); s.piece(i, t.x, t.y); }
      const bar = h('div.pzt-bar', null,
        h('span.pzt-chip.on', null, 'Rand'), h('span.pzt-chip', null, 'Innen'), h('span.pzt-chip', null, 'Alle'),
        h('span.pzt-btn', { html: icon('image', { size: 18 }) }), h('span.pzt-btn', { html: icon('expand', { size: 18 }) }));
      stage.append(bar);
      const [rand, innen, , ghostB] = bar.children;
      return api.loop(async () => {
        s.boardEl.classList.add('ghost-off');
        ghostB.classList.remove('on');
        rand.classList.add('on'); innen.classList.remove('on');
        await api.sleep(300);
        await api.finger.tap(innen);
        innen.classList.add('on'); rand.classList.remove('on');
        await api.sleep(600);
        await api.finger.tap(ghostB);
        ghostB.classList.add('on');
        s.boardEl.classList.remove('ghost-off');
        await api.sleep(1500);
      }, 400);
    },
  },
  {
    title: 'Viele Bilder',
    text: 'Wähle ein Bild und 12 bis 108 Teile – oder puzzle ein eigenes Foto.',
    art: `<div class="pzt-art">
      <div class="pzt-tiles"><span>🏔️</span><span>🌼</span><span>🌅</span><span>🌙</span><span>🎈</span><span>📷</span></div>
      <div class="pzt-counts"><b>12</b><b>24</b><b>48</b><b>70</b><b>108</b></div></div>`,
  },
];
