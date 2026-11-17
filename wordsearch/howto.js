// Wortsuche – «So geht's»: Schritte für das gemeinsame Tutorial (/shared/tutorial.js).
// Die Demos verwenden das echte Spielfeld (Board) verkleinert: gleiche Kapseln, Farben, Tipp-Ringe.

import { h } from '../shared/ui.js';
import { Board } from './board.js';
import { wordCells } from './logic.js';

// Wetter-Raster 6×6
const DEMO = {
  size: 6,
  grid: ['SONNEK', 'MWLUFT', 'OBLITZ', 'NREGEN', 'DHAGEL', 'FWINDA'],
  words: [
    { w: 'SONNE', label: 'Sonne', r: 0, c: 0, d: 'E' }, // 0
    { w: 'MOND', label: 'Mond', r: 1, c: 0, d: 'S' }, // 1
    { w: 'BLITZ', label: 'Blitz', r: 2, c: 1, d: 'E' }, // 2
    { w: 'REGEN', label: 'Regen', r: 3, c: 1, d: 'E' }, // 3
    { w: 'HAGEL', label: 'Hagel', r: 4, c: 1, d: 'E' }, // 4
    { w: 'LUFT', label: 'Luft', r: 1, c: 2, d: 'E' }, // 5
  ],
  bonus: { w: 'WIND', label: 'Wind', r: 5, c: 1, d: 'E' },
};

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>';
const STAR = '<svg class="st on" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" stroke-linejoin="round" stroke-width="1.6"/></svg>';

/** Echtes Spielfeld in die Bühne setzen (passend zur Bühnenhöhe). */
function demoBoard(stage, { size, below = [] }) {
  const board = new Board(DEMO, {});
  board.setLocked(true);
  const room = (stage.clientHeight || 260) - 24 - below.length * 42;
  board.resize(Math.max(130, Math.min(size, room)));
  const pill = h('div.sel-pill');
  const wrap = h('div.board-wrap', null, board.el, pill);
  const box = h('div.wst', null, wrap, ...below);
  stage.append(box);
  return { board, pill, box };
}

/** Finger wischt über ein Wort; Auswahl-Kapsel und Buchstaben-Vorschau wie im Spiel. */
async function swipe(api, demo, p, ms = 800) {
  const { board, pill } = demo;
  const cells = wordCells(p);
  const targets = cells.map(({ r, c }) => board.spans[r * board.n + c]);
  await api.finger.drag(targets, ms, (i) => {
    board.showSel(cells[0], cells[i], false);
    board.highlight(cells.slice(0, i + 1));
    pill.textContent = cells.slice(0, i + 1).map(({ r, c }) => DEMO.grid[r][c]).join('');
    pill.classList.add('show');
  });
  board.hideSel();
  pill.classList.remove('show');
}

function chip(label) { return h('span.wchip', null, label); }
function markChip(el, color) {
  el.style.setProperty('--c', color);
  el.classList.add('found');
}

const CAPS = ['#ff8fa3', '#6db7ff', '#9bd36a', '#ffb35c', '#a991ff', '#5ccfc0'];

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
      text: 'Fahre mit dem Finger in gerader Linie über ein Wort.',
      demo(stage, api) {
        const d = demoBoard(stage, { size: 206 });
        return api.loop(async () => {
          d.board.reset();
          await api.sleep(250);
          await swipe(api, d, DEMO.words[0], 900);
          d.board.addFound(0, 0, true);
          await api.sleep(650);
          await swipe(api, d, DEMO.words[1], 700);
          d.board.addFound(1, 5, true);
          api.finger.hide();
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Alle Wörter finden',
      text: 'Finde alle Wörter der Liste – schnell und ohne Tipp gibt es drei Sterne.',
      demo(stage, api) {
        const list = [2, 3, 4];
        const chips = list.map((i) => chip(DEMO.words[i].label));
        const d = demoBoard(stage, { size: 176, below: [h('div.wst-chips', null, chips)] });
        const stars = h('div.wst-stars', { html: STAR + STAR + STAR });
        d.board.el.append(stars);
        return api.loop(async () => {
          d.board.reset();
          stars.classList.remove('show');
          chips.forEach((c) => c.classList.remove('found'));
          await api.sleep(250);
          for (let k = 0; k < list.length; k++) {
            await swipe(api, d, DEMO.words[list[k]], 600);
            d.board.addFound(list[k], k + 2, true);
            markChip(chips[k], CAPS[k + 2]);
            await api.sleep(200);
          }
          api.finger.hide();
          await api.sleep(250);
          d.board.winWave();
          await api.sleep(450);
          stars.classList.add('show');
          await api.sleep(1700);
        }, 300);
      },
    },
    {
      title: 'Tipps & Bonus',
      text: 'Tipps sind gratis – und ein geheimes Bonuswort bringt einen Extrastern.',
      demo(stage, api) {
        const hint = h('div.btn.hint-btn', { html: BULB + '<span>Tipp</span>' });
        const luft = chip('Luft');
        const bonus = h('span.wchip.bonus', null, '✨ Bonuswort ?');
        const d = demoBoard(stage, { size: 168, below: [h('div.wst-row', null, hint, luft, bonus)] });
        return api.loop(async () => {
          d.board.reset();
          luft.classList.remove('found', 'hinted');
          bonus.classList.remove('found');
          bonus.textContent = '✨ Bonuswort ?';
          await api.sleep(250);
          await api.finger.tap(hint);
          d.board.showHint(5, 1, true);
          luft.classList.add('hinted');
          await api.sleep(650);
          await api.finger.tap(hint, 250);
          d.board.showHint(5, 2, true);
          await api.sleep(700);
          await swipe(api, d, DEMO.words[5], 650);
          d.board.clearHint();
          d.board.addFound(5, 3, true);
          luft.classList.remove('hinted');
          markChip(luft, CAPS[3]);
          await api.sleep(500);
          await swipe(api, d, DEMO.bonus, 650);
          d.board.addBonus(DEMO.bonus, true);
          bonus.textContent = '✨ Wind';
          bonus.classList.add('found');
          api.finger.hide();
          await api.sleep(1600);
        }, 300);
      },
    },
    {
      title: 'Drei Stufen',
      text: 'Leicht nur → und ↓, Mittel auch schräg, Schwer in alle Richtungen.',
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
