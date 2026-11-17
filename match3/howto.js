// Juwelen – «So geht's»: vier kurze Schritte mit animierten Mini-Szenen.

import { h } from '../shared/ui.js';
import { spriteURL, iceURL } from './sprites.js';

const gemImg = (kind) => h('img', { src: spriteURL(kind === 's' ? 'stone' : String(kind), 72), alt: '', draggable: 'false' });

/** Kleines Raster aus Juwelen-Bildern; liefert { el, cells[r][c] }. */
function miniGrid(rows) {
  const el = h('div.m3t-grid', { style: { gridTemplateColumns: `repeat(${rows[0].length}, 1fr)` } });
  const cells = rows.map((row) => row.map((k) => {
    const c = h('div.m3t-cell', null, gemImg(k));
    el.append(c);
    return c;
  }));
  return { el, cells };
}

const pct = (stage, node) => {
  const s = stage.getBoundingClientRect(), r = node.getBoundingClientRect();
  return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height / 2 - s.top) / s.height) * 100 };
};

export const tutorialSteps = [
  {
    title: 'Juwelen tauschen',
    text: 'Wische ein Juwel auf ein Nachbarfeld – drei gleiche in einer Reihe verschwinden.',
    demo(stage, api) {
      const { el, cells } = miniGrid([[4, 3, 5, 3], [0, 0, 2, 0], [1, 5, 0, 4]]);
      stage.append(el);
      return api.loop(async () => {
        const mover = cells[2][2], dest = cells[1][2];
        await api.finger.drag([pct(stage, mover), pct(stage, dest)], 520);
        mover.classList.add('m3t-up'); dest.classList.add('m3t-down');
        await api.sleep(260);
        const hit = [cells[1][0], cells[1][1], mover];
        hit.forEach((c) => c.classList.add('m3t-pop'));
        api.finger.hide();
        await api.sleep(650);
        [...hit, dest].forEach((c) => c.classList.remove('m3t-pop', 'm3t-up', 'm3t-down'));
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Ziele erfüllen',
    text: 'Oben siehst du die Ziele und die übrigen Züge. Schaffst du sie, gibt es Sterne.',
    demo(stage, api) {
      const count = h('b', null, '9');
      const moves = h('b', null, '12');
      const goal = h('div.m3t-goal', null, gemImg(0), count);
      const iceGoal = h('div.m3t-goal', null, h('img', { src: iceURL(72), alt: '' }), h('b', null, '✓'));
      const mv = h('div.m3t-moves', null, moves, h('small', null, 'Züge'));
      const stars = h('div.m3t-stars', null, ...[0, 1, 2].map(() => h('span', null, '★')));
      stage.append(h('div.m3t-hud', null, mv, goal, iceGoal), stars);
      return api.loop(async () => {
        let n = 9, m = 12;
        count.textContent = n; moves.textContent = m;
        stars.querySelectorAll('span').forEach((s) => s.classList.remove('on'));
        await api.sleep(400);
        while (n > 0) {
          n -= 3; m -= 1;
          count.textContent = n > 0 ? n : '✓'; moves.textContent = m;
          goal.classList.remove('m3t-bump'); void goal.offsetWidth; goal.classList.add('m3t-bump');
          await api.sleep(650);
        }
        for (const s of stars.querySelectorAll('span')) { s.classList.add('on'); await api.sleep(260); }
        await api.sleep(900);
      });
    },
  },
  {
    title: 'Sonderjuwelen',
    text: '4 in einer Reihe ergeben einen Blitz, eine L- oder T-Form eine Bombe, 5 einen Regenbogen.',
    demo(stage, api) {
      const items = [['h3', '4 in Reihe'], ['b4', 'L oder T'], ['rainbow', '5 in Reihe']].map(([k, label]) =>
        h('div.m3t-special', null, h('img', { src: spriteURL(k, 96), alt: '' }), h('small', null, label)));
      stage.append(h('div.m3t-specials', null, ...items));
      return api.loop(async () => {
        for (const it of items) {
          it.classList.add('m3t-glow');
          await api.finger.tap(it.querySelector('img'), 420);
          await api.sleep(500);
          it.classList.remove('m3t-glow');
        }
        api.finger.hide();
        await api.sleep(400);
      });
    },
  },
  {
    title: 'Hilfen sind gratis',
    text: 'Hammer, Mischen und einmal pro Level «+5 Züge» – ohne Leben, ohne Warten.',
    demo(stage, api) {
      const { el, cells } = miniGrid([[2, 5, 3], [1, 's', 4]]);
      const hammer = h('div.m3t-tool', null, h('span', null, '🔨'), h('small', null, 'Hammer'));
      const shuffle = h('div.m3t-tool', null, h('span', null, '🔀'), h('small', null, 'Mischen'));
      const plus = h('div.m3t-tool', null, h('span', null, '+5'), h('small', null, 'Züge'));
      stage.append(el, h('div.m3t-tools', null, hammer, shuffle, plus));
      return api.loop(async () => {
        await api.finger.tap(hammer, 500);
        hammer.classList.add('on');
        await api.sleep(250);
        await api.finger.tap(cells[1][1], 500);
        cells[1][1].classList.add('m3t-pop');
        hammer.classList.remove('on');
        await api.sleep(700);
        cells[1][1].classList.remove('m3t-pop');
        api.finger.hide();
        await api.sleep(500);
      });
    },
  },
];
