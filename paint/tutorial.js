// «So geht's» für Farbenzauber: kurzes Tutorial mit animierten Mini-Szenen (shared/tutorial.js).
// Texte: ./data/howto.js. Die Szenen sind kleine SVG-Malbilder im Stil der Mal-Ansicht.

import { h, icon } from '../shared/ui.js';
import { showTutorial, maybeShowTutorial } from '../shared/tutorial.js';
import { HOWTO } from './data/howto.js';

const ACCENT = '#ff6f7d';
const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#bfe3f5', '#ff8fa3', '#ffd23f', '#8ccf6e'];

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Ein Malbild aus Regionen { d | circle | rect, c, label:[x,y] } + Farbleiste. */
function scene(stage, regions, { colors = COLORS, viewBox = '0 0 200 150', width = 236 } = {}) {
  const svg = svgEl('svg', { viewBox, class: 'tz-pic', 'aria-hidden': 'true' });
  svg.style.width = width + 'px';
  const defs = svgEl('defs');
  const pat = svgEl('pattern', { id: 'tz-hatch', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pat.append(svgEl('rect', { width: '6', height: '6', fill: '#f3ece3' }), svgEl('rect', { width: '2.2', height: '6', fill: '#d8cbbd' }));
  defs.append(pat);
  svg.append(defs);
  const regs = regions.map((r) => {
    const g = svgEl('g', { class: 'tz-reg' });
    let shape;
    if (r.circle) shape = svgEl('circle', { cx: r.circle[0], cy: r.circle[1], r: r.circle[2] });
    else if (r.rect) shape = svgEl('rect', { x: r.rect[0], y: r.rect[1], width: r.rect[2], height: r.rect[3], rx: r.rect[4] || 0 });
    else shape = svgEl('path', { d: r.d });
    shape.setAttribute('class', 'tz-shape');
    g.append(shape);
    let num = null;
    if (r.label) {
      num = svgEl('text', { x: r.label[0], y: r.label[1], class: 'tz-num' });
      num.textContent = String(r.c + 1);
      g.append(num);
    }
    svg.append(g);
    return { ...r, g, shape, num, filled: false };
  });
  const bar = h('div.tz-bar');
  const sws = colors.map((col, c) => {
    const s = h('span.tz-sw', { style: { background: col } }, String(c + 1));
    bar.append(s);
    return s;
  });
  stage.append(h('div.tz-wrap', null, svg), bar);
  let sel = -1;
  const api = {
    svg, regs, sws,
    select(c) {
      sel = c;
      sws.forEach((s, k) => s.classList.toggle('on', k === c));
      for (const r of regs) r.shape.setAttribute('fill', r.filled ? colors[r.c] : (r.c === c ? 'url(#tz-hatch)' : '#fff'));
    },
    fill(r) {
      r.filled = true;
      r.g.classList.add('done');
      r.shape.setAttribute('fill', colors[r.c]);
      r.shape.classList.remove('pop');
      void r.shape.getBoundingClientRect();
      r.shape.classList.add('pop');
    },
    reset(filledPred = () => false) {
      for (const r of regs) {
        r.filled = !!filledPred(r);
        r.g.classList.toggle('done', r.filled);
        r.shape.classList.remove('pop');
      }
      svg.classList.remove('tz-done', 'tz-zoom');
      api.select(sel);
    },
  };
  api.select(-1);
  return api;
}

function flower() {
  const petals = [];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    const x = 100 + Math.cos(a) * 22, y = 56 + Math.sin(a) * 22;
    petals.push({ circle: [x.toFixed(1), y.toFixed(1), 16], c: 1, label: [x + Math.cos(a) * 4, y + Math.sin(a) * 4] });
  }
  return [
    { rect: [0, 0, 200, 150, 14], c: 0, label: [26, 24] },
    { d: 'M0 112Q100 94 200 112V136Q200 150 186 150H14Q0 150 0 136Z', c: 3, label: [168, 134] },
    { rect: [96, 74, 8, 42], c: 3 },
    { d: 'M104 100Q126 80 142 94Q126 112 104 106Z', c: 3, label: [126, 97] },
    ...petals,
    { circle: [100, 56, 12], c: 2, label: [100, 56] },
  ];
}

const DEMOS = {
  tap(stage, api) {
    const s = scene(stage, flower());
    const petals = s.regs.filter((r) => r.c === 1);
    return api.loop(async () => {
      s.select(-1);
      s.reset();
      await api.sleep(300);
      await api.finger.tap(s.sws[1]);
      s.select(1);
      for (const p of petals.slice(0, 4)) {
        await api.finger.tap(p.shape, 420);
        s.fill(p);
      }
      await api.sleep(900);
    }, 400);
  },

  goal(stage, api) {
    const s = scene(stage, flower());
    return api.loop(async () => {
      api.finger.hide();
      s.select(-1);
      s.reset();
      await api.sleep(500);
      for (let c = 0; c < 4; c++) {
        s.select(c);
        await api.sleep(260);
        for (const r of s.regs.filter((x) => x.c === c)) { s.fill(r); await api.sleep(170); }
      }
      s.select(-1);
      s.svg.classList.add('tz-done');
      await api.sleep(1700);
    }, 300);
  },

  brush(stage, api) {
    const rows = ['2112112', '1111111', '2212212'];
    const regs = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      regs.push({ rect: [8 + x * 27, 22 + y * 36, 24, 32, 6], c: +ch - 1, label: [20 + x * 27, 38 + y * 36], row: y });
    }));
    const s = scene(stage, regs, { colors: ['#7cc4ff', '#ffb25b'], viewBox: '0 0 200 150' });
    const line = s.regs.filter((r) => r.row === 1);
    return api.loop(async () => {
      s.reset();
      s.select(0);
      await api.sleep(250);
      await api.finger.drag(line.map((r) => r.shape), 1300, (i) => s.fill(line[i]));
      await api.sleep(250);
      s.svg.classList.add('tz-zoom');
      await api.sleep(1300);
      s.svg.classList.remove('tz-zoom');
      await api.sleep(600);
    }, 300);
  },

  hint(stage, api) {
    const s = scene(stage, flower());
    const leaf = s.regs[3];
    const bulb = h('span.tz-bulb', { html: icon('hint', { size: 22 }) });
    const ring = h('span.tz-ring');
    stage.append(bulb, ring);
    return api.loop(async () => {
      s.reset((r) => r !== leaf);
      s.select(3);
      ring.classList.remove('on');
      await api.sleep(300);
      await api.finger.tap(bulb);
      s.svg.classList.add('tz-zoom');
      await api.sleep(450);
      const sr = stage.getBoundingClientRect(), lr = leaf.shape.getBoundingClientRect();
      ring.style.left = ((lr.left + lr.width / 2 - sr.left) / sr.width) * 100 + '%';
      ring.style.top = ((lr.top + lr.height / 2 - sr.top) / sr.height) * 100 + '%';
      ring.classList.add('on');
      await api.sleep(900);
      await api.finger.tap(leaf.shape, 450);
      ring.classList.remove('on');
      s.fill(leaf);
      await api.sleep(900);
    }, 400);
  },
};

function steps() {
  return HOWTO.map((st) => ({
    title: st.title,
    text: st.text,
    demo: DEMOS[st.demo] || undefined,
  }));
}

export function showHowto() {
  return showTutorial({ id: 'paint', steps: steps(), accent: ACCENT });
}

export function maybeShowHowto() {
  return maybeShowTutorial({ id: 'paint', steps: steps(), accent: ACCENT });
}
