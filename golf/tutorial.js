// Golf-Patience – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { h } from '../shared/ui.js';
import { cardCode } from '../lib/cards/deck.js';
import { miniCard, moveMini, tutStage } from '../lib/cards/shell.js';

const C = (s, r) => cardCode(s, r);
const STEP = 30;

function label(scene, text) {
  const l = h('div.pc-label.off', null, text);
  scene.parentNode.append(l);
  return l;
}
const remember = (els) => els.forEach((e) => { e._ox = e._x; e._oy = e._y; e._oz = e.style.zIndex; });
const reset = (els) => els.forEach((e) => { e.classList.remove('gone', 'up-flip'); moveMini(e, e._ox, e._oy, 0); e.style.zIndex = e._oz; });

/** drei kleine Reihen à 3 Karten, letzte Karte jeweils unten frei */
function columns(scene, codes, x0 = 40) {
  const cols = [];
  for (let c = 0; c < 3; c++) {
    const col = [];
    for (let k = 0; k < 3; k++) {
      const el = miniCard(codes[c * 3 + k], { x: x0 + c * 60, y: 4 + k * STEP });
      el.style.zIndex = 10 + k;
      if (k < 2) el.classList.add('dim');
      scene.append(el);
      col.push(el);
    }
    cols.push(col);
  }
  return cols;
}

function scorecard(scene, n, x = 12, y = 20) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const c = h('div.golf-tcell', { style: { left: (x + i * 31) + 'px', top: y + 'px' } }, h('small', null, String(i + 1)), h('b', null, ''));
    scene.append(c);
    cells.push(c);
  }
  return cells;
}

export const tutorialSteps = [
  {
    title: 'Eins höher oder tiefer',
    text: 'Tippe die unterste Karte einer Reihe, wenn sie direkt an die Ablage passt.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 180 });
      const cols = columns(scene, [C(0, 2), C(1, 10), C(2, 8), C(3, 12), C(0, 4), C(1, 9), C(2, 1), C(3, 5), C(0, 3)], 26);
      const waste = miniCard(C(1, 7), { x: 222, y: 64 });
      waste.style.zIndex = 5; scene.append(waste);
      const moved = [cols[0][2], cols[1][2]];
      remember(moved);
      const l = label(scene, '7 → 8 → 9');
      return api.loop(async () => {
        await api.finger.tap(cols[0][2]);
        cols[0][2].style.zIndex = 40; moveMini(cols[0][2], 222, 64);
        cols[0][1].classList.remove('dim');
        await api.sleep(450);
        await api.finger.tap(cols[1][2]);
        cols[1][2].style.zIndex = 41; moveMini(cols[1][2], 222, 64);
        cols[1][1].classList.remove('dim');
        l.classList.remove('off');
        api.finger.hide();
        await api.sleep(1500);
        l.classList.add('off');
        cols[0][1].classList.add('dim'); cols[1][1].classList.add('dim');
        reset(moved);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Talon',
    text: 'Passt nichts, holst du dir mit einem Tipp eine neue Ablagekarte.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 150 });
      const stock = [C(0, 6), C(2, 13), C(3, 11)].map((c, i) => miniCard(c, { x: 40 + i * 9, y: 40, up: false }));
      stock.forEach((e, i) => { e.style.zIndex = 10 + i; scene.append(e); });
      const waste = miniCard(C(1, 3), { x: 170, y: 40 });
      waste.style.zIndex = 5; scene.append(waste);
      remember(stock);
      return api.loop(async () => {
        for (const k of [2, 1]) {
          await api.finger.tap(stock[k]);
          stock[k].style.zIndex = 40 + k; moveMini(stock[k], 170, 40);
          setTimeout(() => stock[k].classList.add('up'), 170);
          await api.sleep(500);
        }
        api.finger.hide();
        await api.sleep(1200);
        stock.forEach((e) => e.classList.remove('up'));
        reset(stock);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Schläge & Par',
    text: 'Jede Karte, die liegen bleibt, ist ein Schlag. Weniger als Par ist super!',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 150 });
      const box = h('div.golf-tpar', null, h('div', null, h('small', null, 'Par'), h('b', null, '3')), h('div', null, h('small', null, 'Übrig'), h('b.cnt', null, '5')));
      scene.append(box);
      const l = label(scene, 'Birdie!');
      const cnt = box.querySelector('.cnt');
      return api.loop(async () => {
        api.finger.hide();
        for (const n of [5, 4, 3, 2]) { cnt.textContent = n; cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick'); await api.sleep(520); }
        l.classList.remove('off');
        await api.sleep(1500);
        l.classList.add('off');
        await api.sleep(400);
      }, 200);
    },
  },
  {
    title: 'Neun Löcher',
    text: 'Eine Runde hat 9 Löcher. Tipp und Zurück helfen jederzeit – gratis.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 120 });
      const cells = scorecard(scene, 9, 11, 30);
      const vals = [['2', 'u'], ['3', 'p'], ['0', 'u'], ['4', 'o'], ['1', 'u'], ['2', 'p'], ['−2', 'u'], ['3', 'p'], ['1', 'u']];
      const l = label(scene, '4 unter Par');
      return api.loop(async () => {
        api.finger.hide();
        for (let i = 0; i < 9; i++) {
          cells[i].lastChild.textContent = vals[i][0];
          cells[i].className = 'golf-tcell ' + vals[i][1];
          await api.sleep(230);
        }
        l.classList.remove('off');
        await api.sleep(1500);
        l.classList.add('off');
        cells.forEach((c) => { c.lastChild.textContent = ''; c.className = 'golf-tcell'; });
        await api.sleep(400);
      }, 200);
    },
  },
];
