// Wortsuche – «So geht's»: Schritte für das gemeinsame Tutorial (/shared/tutorial.js).
// Jede Demo ist ein kleines, echtes Buchstabenraster mit wachsenden Kapseln.

import { h } from '../shared/ui.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// Wetter-Raster: SONNE →, MOND ↓, BLITZ →, REGEN →, HAGEL →
const ROWS = ['SONNEK', 'MWLUFT', 'OBLITZ', 'NREGEN', 'DHAGEL'];
const COLORS = ['#ff8fa3', '#6db7ff', '#9bd36a', '#ffb35c', '#a991ff'];

/** Baut ein Mini-Raster in die Bühne. Liefert Helfer zum Wischen. */
function demoGrid(stage, { cell = 34, chips = [] } = {}) {
  const m = ROWS.length, n = ROWS[0].length;
  const grid = h('div.wsd-grid', { style: { width: n * cell + 'px', height: m * cell + 'px', fontSize: Math.round(cell * 0.5) + 'px' } });
  const svg = svgEl('svg', { class: 'wsd-caps', viewBox: `0 0 ${n} ${m}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const spans = [];
  grid.append(svg);
  ROWS.forEach((row) => [...row].forEach((ch) => { const s = h('span', null, ch); grid.append(s); spans.push(s); }));
  const chipEls = chips.map((c) => h('span.wsd-chip', null, c));
  const box = h('div.wsd', null, grid, chips.length ? h('div.wsd-chips', null, chipEls) : null);
  stage.append(box);
  const at = (r, c) => spans[r * n + c];

  function line(r1, c1, r2, c2, cls, color) {
    const l = svgEl('line', { x1: c1 + 0.5, y1: r1 + 0.5, x2: c2 + 0.5, y2: r2 + 0.5, class: cls });
    if (color) l.style.stroke = color;
    svg.append(l);
    return l;
  }

  /** Finger wischt von (r1,c1) nach (r2,c2); die Kapsel rastet Buchstabe für Buchstabe ein. */
  async function swipe(api, r1, c1, r2, c2, color, ms = 850) {
    const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    const cells = [];
    for (let i = 0; i <= steps; i++) cells.push(at(r1 + dr * i, c1 + dc * i));
    let sel = null;
    await api.finger.drag(cells, ms, (i) => {
      if (!sel) sel = line(r1, c1, r1, c1, 'wsd-sel');
      sel.setAttribute('x2', c1 + dc * i + 0.5);
      sel.setAttribute('y2', r1 + dr * i + 0.5);
    });
    if (sel) sel.remove();
    const cap = line(r1, c1, r2, c2, 'wsd-cap', color);
    cells.forEach((s, i) => {
      s.style.animationDelay = i * 45 + 'ms';
      s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
    });
    return cap;
  }

  function reset() {
    svg.replaceChildren();
    spans.forEach((s) => s.classList.remove('pop', 'hint'));
    chipEls.forEach((c) => { c.classList.remove('found'); c.style.removeProperty('--c'); });
  }

  return { box, grid, at, swipe, reset, chips: chipEls, line };
}

function arrowsSvg(dirs) {
  const all = { E: [1, 0], S: [0, 1], SE: [1, 1], NE: [1, -1], W: [-1, 0], N: [0, -1], NW: [-1, -1], SW: [-1, 1] };
  const parts = Object.entries(all).map(([id, [x, y]]) => {
    const on = dirs.includes(id);
    const len = x && y ? 15 : 19;
    const ex = 30 + (x / Math.hypot(x, y)) * len, ey = 30 + (y / Math.hypot(x, y)) * len;
    return `<line x1="30" y1="30" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="${on ? 'on' : 'off'}"/>` +
      (on ? `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.6" class="tip"/>` : '');
  }).join('');
  return `<svg viewBox="0 0 60 60" width="64" height="64" aria-hidden="true">${parts}<circle cx="30" cy="30" r="5" class="hub"/></svg>`;
}

export function tutorialSteps(modes) {
  return [
    {
      title: 'Wort wischen',
      text: 'Fahre in einer geraden Linie vom ersten bis zum letzten Buchstaben.',
      demo(stage, api) {
        const g = demoGrid(stage, { cell: 38 });
        return api.loop(async () => {
          g.reset();
          await api.sleep(300);
          await g.swipe(api, 0, 0, 0, 4, COLORS[0]);
          await api.sleep(500);
          await g.swipe(api, 1, 0, 4, 0, COLORS[1], 700);
          await api.sleep(900);
        }, 500);
      },
    },
    {
      title: 'Alle Wörter finden',
      text: 'Jedes gefundene Wort bekommt eine Farbe – auch in der Liste unten.',
      demo(stage, api) {
        const g = demoGrid(stage, { cell: 30, chips: ['Blitz', 'Hagel', 'Regen'] });
        const words = [[2, 1, 2, 5, 0], [4, 1, 4, 5, 1], [3, 1, 3, 5, 2]];
        return api.loop(async () => {
          g.reset();
          await api.sleep(300);
          for (const [r1, c1, r2, c2, ci] of words) {
            await g.swipe(api, r1, c1, r2, c2, COLORS[ci + 2], 650);
            g.chips[ci].style.setProperty('--c', COLORS[ci + 2]);
            g.chips[ci].classList.add('found');
            await api.sleep(250);
          }
          api.finger.hide();
          g.grid.classList.remove('wave'); void g.grid.offsetWidth; g.grid.classList.add('wave');
          await api.sleep(1300);
        }, 400);
      },
    },
    {
      title: 'Tipp & Zeit',
      text: 'Ein Tipp zeigt den Wortanfang. Schnell und ohne Tipp gibt es drei Sterne.',
      demo(stage, api) {
        const g = demoGrid(stage, { cell: 30 });
        const btn = h('div.wsd-hint', { html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Tipp</span>' });
        const stars = h('div.wsd-stars', null, '★', '★', '★');
        g.box.append(h('div.wsd-row', null, btn, stars));
        return api.loop(async () => {
          g.reset();
          stars.classList.remove('lit');
          await api.sleep(300);
          await api.finger.tap(btn);
          const ring = g.line(1, 2, 1, 2, 'wsd-ring');
          g.at(1, 2).classList.add('hint');
          await api.sleep(700);
          ring.remove();
          await g.swipe(api, 1, 2, 1, 5, COLORS[3], 600);
          api.finger.hide();
          await api.sleep(250);
          stars.classList.add('lit');
          await api.sleep(1400);
        }, 400);
      },
    },
    {
      title: 'Drei Stufen',
      text: 'Leicht nur → und ↓, Mittel auch schräg, Schwer in alle acht Richtungen.',
      demo(stage, api) {
        const cards = (modes || []).map((m) => h('div.wsd-mode', null,
          h('div', { html: arrowsSvg(m.dirs) }),
          h('b', null, m.title),
          h('small', null, m.sizes.length > 1 ? `${m.sizes[0]}–${m.sizes[m.sizes.length - 1]}` : `${m.sizes[0]}×${m.sizes[0]}`)));
        stage.append(h('div.wsd-modes', null, cards));
        return api.loop(async () => {
          for (const c of cards) {
            await api.finger.tap(c, 450);
            cards.forEach((x) => x.classList.toggle('on', x === c));
            await api.sleep(900);
          }
        }, 300);
      },
    },
  ];
}
