// Perlenbild – «So geht's» mit animierten Mini-Demos (shared/tutorial.js).
// Texte: data/texts.js. Szenen: kleine DOM-Elemente, Positionen in % der Bühne.

import { h, icon } from '../shared/ui.js';
import { showTutorial, maybeShowTutorial } from '../shared/tutorial.js';
import { sfx } from '../shared/sfx.js';
import { tutorial as TEXTS } from './data/texts.js';

const C = { R: '#f2385a', B: '#3f8ef0', Y: '#ffc93c', G: '#45b85a', P: '#ff9db5' };
const ACCENT = '#3f8ef0';

function scene(stage) {
  const s = h('div.bt-scene');
  stage.prepend(s);
  return s;
}

function place(el, x, y, animate = true) {
  if (!animate) el.style.transition = 'none';
  el.style.left = x + '%';
  el.style.top = y + '%';
  if (!animate) { void el.offsetWidth; el.style.transition = ''; }
}

function gem(parent, color, x, y) {
  const el = h('i.bt-gem', { style: { '--c': color } });
  place(el, x, y, false);
  parent.append(el);
  return el;
}

function ghost(parent, color, x, y) {
  const el = h('i.bt-ghost', { style: { '--c': color } });
  place(el, x, y, false);
  parent.append(el);
  return el;
}

function panel(parent, x, y, w, hgt) {
  const el = h('div.bt-panel', { style: { left: x + '%', top: y + '%', width: w + '%', height: hgt + '%' } });
  parent.append(el);
  return el;
}

function column(parent, x, y, hgt) {
  const el = h('div.bt-col', { style: { left: x + '%', top: y + '%', height: hgt + '%' } });
  parent.append(el);
  return el;
}

/** Bildzellen: rows = ['RRB', ...] (oben -> unten); Rückgabe [{x, y, k, row}] */
function cells(rows, x0, y0, dx, dy) {
  const out = [];
  rows.forEach((r, ry) => [...r].forEach((k, rx) => {
    if (k !== '.') out.push({ x: x0 + rx * dx, y: y0 + ry * dy, k, row: ry });
  }));
  return out;
}

function fly(el, x, y, delay = 0) {
  el.style.transitionDelay = delay + 'ms';
  el.classList.add('placed');
  place(el, x, y);
}

function resetGem(el, x, y) {
  el.style.transitionDelay = '0ms';
  el.classList.remove('placed', 'gone');
  place(el, x, y, false);
}

// ---------------------------------------------------------------- Schritt 1: Spalte antippen

function demoTap(stage, api) {
  const sc = scene(stage);
  panel(sc, 16, 7, 68, 36);
  const pic = cells(['YYBYY', 'RRRBB'], 30, 18, 10, 14);
  for (const c of pic) ghost(sc, C[c.k], c.x, c.y);
  const cols = [
    { x: 32, k: 'RRRY' },
    { x: 50, k: 'BBY' },
    { x: 68, k: 'YRB' },
  ];
  const TOP = 57, STEP = 10;
  for (const col of cols) {
    col.el = column(sc, col.x, TOP - 6, 42);
    col.gems = [...col.k].map((k, i) => gem(sc, C[k], col.x, TOP + i * STEP));
  }
  const bottom = pic.filter((c) => c.row === 1);
  const reset = () => cols.forEach((col) => col.gems.forEach((g, i) => resetGem(g, col.x, TOP + i * STEP)));
  return api.loop(async () => {
    reset();
    await api.sleep(500);
    await api.finger.tap(cols[0].el);
    sfx.play('tap');
    cols[0].gems.slice(0, 3).forEach((g, i) => fly(g, bottom[i].x, bottom[i].y, i * 90));
    place(cols[0].gems[3], cols[0].x, TOP);
    await api.sleep(1000);
    await api.finger.tap(cols[1].el);
    sfx.play('tap');
    cols[1].gems.slice(0, 2).forEach((g, i) => fly(g, bottom[3 + i].x, bottom[3 + i].y, i * 90));
    place(cols[1].gems[2], cols[1].x, TOP);
    await api.sleep(1600);
  });
}

// ---------------------------------------------------------------- Schritt 2: von unten nach oben

function demoRows(stage, api) {
  const sc = scene(stage);
  panel(sc, 18, 6, 64, 86);
  const rows = ['.RR.RR.', 'RPRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  const pic = cells(rows, 29, 17, 7, 13);
  const ghosts = pic.map((c) => ghost(sc, C[c.k], c.x, c.y));
  const zone = h('div.bt-zone');
  sc.append(zone);
  const gems = pic.map((c) => gem(sc, C[c.k], c.x, c.y));
  const setZone = (lowRow, animate) => {
    const top = 17 + (lowRow - 1) * 13 - 7.5;
    zone.style.transition = animate ? '' : 'none';
    zone.style.top = top + '%';
    zone.style.height = (lowRow >= 1 ? 26 : 13) + '%';
    if (lowRow < 1) zone.style.top = 17 - 7.5 + '%';
  };
  api.finger.hide();
  return api.loop(async () => {
    gems.forEach((g) => g.classList.remove('on'));
    ghosts.forEach((g) => g.classList.remove('hidden'));
    setZone(rows.length - 1, false);
    await api.sleep(600);
    for (let r = rows.length - 1; r >= 0; r--) {
      const rowCells = pic.map((c, i) => [c, i]).filter(([c]) => c.row === r);
      for (const [, i] of rowCells) {
        gems[i].classList.add('on');
        ghosts[i].classList.add('hidden');
        await api.sleep(85);
      }
      sfx.play('place');
      if (r > 0) setZone(r - 1, true);
      await api.sleep(260);
    }
    zone.style.height = '0%';
    await api.sleep(1500);
  });
}

// ---------------------------------------------------------------- Schritt 3: Ablage

function demoPark(stage, api) {
  const sc = scene(stage);
  panel(sc, 22, 5, 56, 38);
  const rows = ['YYYY', 'BBBB', 'RRRR'];
  const pic = cells(rows, 35, 14, 10, 11);
  for (const c of pic) ghost(sc, C[c.k], c.x, c.y);
  const zone = h('div.bt-zone');
  sc.append(zone);
  const setZone = (low, animate) => {
    zone.style.transition = animate ? '' : 'none';
    zone.style.top = (14 + (low - 1) * 11 - 6) + '%';
    zone.style.height = '23%';
  };
  const slotY = 52;
  const slots = [32, 44, 56, 68].map((x) => {
    const s = h('i.bt-slot');
    place(s, x, slotY, false);
    sc.append(s);
    return s;
  });
  const badge = h('b.bt-badge', null, '2');
  place(badge, 36, slotY - 6, false);
  sc.append(badge);
  const TOP = 70, STEP = 9;
  const cols = [{ x: 32, k: 'YYB' }, { x: 50, k: 'RRRR' }, { x: 68, k: 'BBB' }];
  for (const col of cols) {
    col.el = column(sc, col.x, TOP - 6, 34);
    col.gems = [...col.k].map((k, i) => gem(sc, C[k], col.x, TOP + i * STEP));
  }
  const at = (k, row) => pic.filter((c) => c.k === k && c.row === row);
  return api.loop(async () => {
    cols.forEach((col) => col.gems.forEach((g, i) => resetGem(g, col.x, TOP + i * STEP)));
    badge.classList.remove('show');
    slots[0].classList.remove('busy');
    setZone(2, false);
    await api.sleep(500);
    // Gelb wird noch nicht gebraucht -> Ablage
    await api.finger.tap(cols[0].el);
    sfx.play('tap');
    cols[0].gems.slice(0, 2).forEach((g, i) => { g.style.transitionDelay = i * 80 + 'ms'; place(g, 32, slotY); });
    place(cols[0].gems[2], cols[0].x, TOP);
    await api.sleep(450);
    badge.classList.add('show');
    slots[0].classList.add('busy');
    await api.sleep(700);
    // Rot füllt die unterste Zeile
    await api.finger.tap(cols[1].el);
    sfx.play('tap');
    const red = at('R', 2);
    cols[1].gems.forEach((g, i) => fly(g, red[i].x, red[i].y, i * 80));
    await api.sleep(750);
    setZone(1, true);
    await api.sleep(450);
    // Gelb springt von selbst aus der Ablage ins Bild
    badge.classList.remove('show');
    slots[0].classList.remove('busy');
    const yel = at('Y', 0);
    cols[0].gems.slice(0, 2).forEach((g, i) => fly(g, yel[i].x, yel[i].y, i * 90));
    sfx.play('sparkle');
    await api.sleep(900);
    await api.finger.tap(cols[2].el);
    sfx.play('tap');
    const blue = at('B', 1);
    cols[2].gems.forEach((g, i) => fly(g, blue[i].x, blue[i].y, i * 80));
    fly(cols[0].gems[2], blue[3].x, blue[3].y, 250);
    await api.sleep(1700);
  });
}

// ---------------------------------------------------------------- Schritt 4: Helfer

function demoHelpers(stage, api) {
  const sc = scene(stage);
  const stars = h('div.bt-stars');
  for (let i = 0; i < 3; i++) stars.append(h('span.on', { html: icon('star', { size: 34 }) }));
  sc.append(stars);
  const pills = [
    { ic: icon('bolt', { size: 18 }), label: 'Magnet', x: 20 },
    { ic: icon('shuffle', { size: 18 }), label: 'Mischen', x: 50 },
    { ic: '<b>+1</b>', label: 'Ablage', x: 80 },
  ].map((p) => {
    const el = h('div.bt-pill', null, h('span.ic', { html: p.ic }), h('span', null, p.label));
    place(el, p.x, 68, false);
    sc.append(el);
    return el;
  });
  const starEls = [...stars.children];
  return api.loop(async () => {
    starEls.forEach((s) => s.classList.add('on'));
    await api.sleep(700);
    for (let i = 0; i < pills.length; i++) {
      await api.finger.tap(pills[i]);
      sfx.play(i === 2 ? 'pop' : 'whoosh');
      pills[i].classList.remove('pop');
      void pills[i].offsetWidth;
      pills[i].classList.add('pop');
      if (i < 2) starEls[2 - i].classList.remove('on');
      await api.sleep(650);
    }
    await api.sleep(1200);
  });
}

const DEMOS = [demoTap, demoRows, demoPark, demoHelpers];

export function howtoSteps() {
  return TEXTS.map((t, i) => ({ title: t.title, text: t.text, demo: DEMOS[i] }));
}

export function showHowto() {
  return showTutorial({ id: 'beads', steps: howtoSteps(), accent: ACCENT });
}

export function maybeShowHowto() {
  return maybeShowTutorial({ id: 'beads', steps: howtoSteps(), accent: ACCENT });
}
