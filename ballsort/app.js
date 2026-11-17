// Kugelsortierung – bunte Kugeln in Glasröhren sortieren.
// Regeln, Generator, Löser und App-Hülle kommen aus /lib/sorting/; hier nur Aussehen, Inhalte, Klänge.

import { h } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { runSortGame } from '../lib/sorting/shell.js';
import { sortTutorial } from '../lib/sorting/tutorial.js';
import { tone } from '../lib/sorting/audio.js';
import { BALLS } from './data/colors.js';
import { CHAPTERS, CHAPTER_SIZE, levelParams, zenParams, hardParams, dailyParams } from './data/levels.js';

const RULES = { move: 'single', complete: 'lock' };
const NAMES = { stack: 'Röhre', stacks: 'Röhren', piece: 'Kugel', pieces: 'Kugeln', extra: '+1 Röhre', extraLong: 'Eine leere Röhre dazu' };

const view = {
  aspect: 1, step: 1, padTop: 0.42, padBottom: 0.16, side: 0.13, liftGap: 0.28, maxPiece: 54, gapX: 0.3, gapY: 0.5,
  makeStack() {
    return h('div.bs-tube', null, h('i.bs-cork'));
  },
  makeFront() {
    return h('div.bs-glass', null, h('i.bs-glint'));
  },
  makePiece(color) {
    const b = BALLS[color % BALLS.length];
    const el = h('div.bs-ball');
    el.style.setProperty('--c', b.c);
    el.style.setProperty('--d', b.d);
    el.style.setProperty('--l', b.l);
    return el;
  },
  complete(stackEl, color, board, i) {
    const b = BALLS[color % BALLS.length];
    board.burst(i, [b.l, '#ffffff', '#ffd84d', b.c], 14);
  },
};

// Klänge: weiches «Klick» beim Landen (Glas), kleines Glockenspiel beim Füllen einer Röhre
let landN = 0;
const sounds = {
  land() {
    if (!sfx.output()) return;
    const f = [660, 740, 830, 700][landN++ % 4];
    tone({ name: 'land', gap: 50, freq: f * 1.6, to: f * 1.2, dur: 0.07, type: 'triangle', gain: 0.07 });
    tone({ freq: 180, to: 120, dur: 0.06, type: 'sine', gain: 0.08 });
  },
  complete() {
    if (!sfx.output()) { return; }
    [784, 988, 1319].forEach((f, k) => tone({ freq: f, dur: 0.32, type: 'sine', gain: 0.07, delay: k * 0.07 }));
  },
};

function tutorial() {
  return sortTutorial({
    view, rules: RULES, names: NAMES,
    core: {
      title: 'Kugel umsetzen',
      text: 'Tippe zwei Röhren an – die oberste Kugel hüpft auf die gleiche Farbe oder in eine leere Röhre.',
      state: { cap: 4, stacks: [[1, 1, 0], [2, 1], [2, 0], []] },
      moves: [[0, 2], [1, 0], [2, 3]],
    },
    goal: {
      title: 'Röhren füllen',
      text: 'Sortiere, bis jede Röhre nur eine Farbe hat – volle Röhren bekommen einen Korken.',
      state: { cap: 4, stacks: [[0, 0, 0], [1, 1, 1, 0], [1]] },
      moves: [[1, 0], [2, 1]],
    },
    help: {
      title: 'Hilfe ist gratis',
      text: 'Rückgängig, Tipp und Extra-Röhre helfen jederzeit und kosten höchstens einen Stern.',
      state: { cap: 4, stacks: [[0, 1, 0, 1], [1, 0, 1, 0], []] },
      hint: [0, 2],
      after: [1, -1],
    },
    modes: {
      text: 'Wähle im Menü, wie du heute spielen magst.',
      items: [
        { emoji: '🗺️', label: 'Kapitel', sub: 'Level mit Sternen' },
        { emoji: '🌿', label: 'Entspannt', sub: 'endlos, ohne Sterne' },
        { emoji: '🧠', label: 'Knifflig', sub: 'nur eine freie Röhre' },
        { emoji: '📅', label: 'Tagesrätsel', sub: 'jeden Tag neu' },
      ],
    },
  });
}

runSortGame({
  id: 'ballsort',
  title: 'Kugelsortierung',
  tagline: 'Bunte Kugeln in Röhren ordnen',
  accent: '#e0643c',
  rules: RULES,
  names: NAMES,
  view,
  chapters: CHAPTERS,
  chapterSize: CHAPTER_SIZE,
  level: levelParams,
  zen: zenParams,
  hard: hardParams,
  daily: dailyParams,
  dailyLabel: 'Kugeln des Tages',
  tutorial,
  sounds,
  showcase: { cap: 4, stacks: [[0, 0, 0, 0], [1, 2, 1], [2, 1, 2, 2], [3, 3, 3, 3], [1, 4], [4, 4, 4]] },
  confetti: (run) => BALLS.slice(0, Math.min(run.colors || 6, BALLS.length)).map((b) => b.c),
});
