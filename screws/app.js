// Schrauben & Muttern – farbige Muttern auf die richtige Schraube drehen.
// Regeln, Generator, Löser und App-Hülle kommen aus /lib/sorting/; hier nur Aussehen, Inhalte, Klänge.

import { h } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { runSortGame } from '../lib/sorting/shell.js';
import { sortTutorial } from '../lib/sorting/tutorial.js';
import { tone, noise } from '../lib/sorting/audio.js';
import { NUTS } from './data/colors.js';
import { CHAPTERS, CHAPTER_SIZE, levelParams, zenParams, hardParams, dailyParams } from './data/levels.js';

const RULES = { move: 'group', complete: 'lock' };
const NAMES = { stack: 'Schraube', stacks: 'Schrauben', piece: 'Mutter', pieces: 'Muttern', extra: '+1 Schraube', extraLong: 'Eine leere Schraube dazu' };

const view = {
  aspect: 1.6, step: 1, padTop: 0.95, padBottom: 0.5, side: 0.04, liftTop: -0.5, maxPiece: 40, gapX: 0.32, gapY: 0.45,
  makeStack() {
    return h('div.sn-bolt', null, h('i.sn-base'), h('i.sn-rod'), h('i.sn-cap', null, h('i.sn-faces')));
  },
  makePiece(color, { hidden } = {}) {
    const n = NUTS[color % NUTS.length];
    const el = h('div.sn-nut', null, h('i.sn-body', null, h('i.sn-faces')), h('i.sn-q', null, '?'));
    el.style.setProperty('--c', n.c);
    el.style.setProperty('--d', n.d);
    el.style.setProperty('--l', n.l);
    return el;
  },
  travel(el, on) { el.classList.toggle('spin', on); },
  complete(stackEl, color, board, i, fx) {
    const n = NUTS[color % NUTS.length];
    stackEl.style.setProperty('--cc', n.c);
    stackEl.style.setProperty('--cd', n.d);
    stackEl.style.setProperty('--cl', n.l);
    if (fx) setTimeout(() => board.burst(i, [n.l, '#ffffff', '#ffd84d', n.c], 14), 420);
  },
};

// Klänge: Ratsche beim Abdrehen, metallisches «Tink» beim Aufsetzen, Ratsche + Glocke beim Verschliessen
const sounds = {
  lift() {
    if (!sfx.output()) return;
    for (let k = 0; k < 3; k++) noise({ dur: 0.025, gain: 0.08, freq: 3200 - k * 300, q: 5, delay: k * 0.045 });
  },
  land() {
    if (!sfx.output()) return;
    tone({ name: 'tink', gap: 60, freq: 2350, dur: 0.14, type: 'sine', gain: 0.05 });
    tone({ freq: 3480, dur: 0.09, type: 'sine', gain: 0.03 });
    noise({ dur: 0.03, gain: 0.05, freq: 1800, q: 2 });
  },
  complete() {
    if (!sfx.output()) return;
    for (let k = 0; k < 5; k++) noise({ dur: 0.022, gain: 0.07, freq: 2600 + k * 120, q: 6, delay: k * 0.05 });
    [1046, 1568].forEach((f, k) => tone({ freq: f, dur: 0.4, type: 'sine', gain: 0.06, delay: 0.3 + k * 0.08 }));
  },
};

function tutorial() {
  return sortTutorial({
    view, rules: RULES, names: NAMES,
    core: {
      title: 'Muttern umsetzen',
      text: 'Tippe zwei Schrauben an – alle obersten Muttern gleicher Farbe drehen sich hinüber.',
      state: { cap: 3, stacks: [[1, 0, 0], [2, 2], [2, 1], []] },
      moves: [[0, 3], [2, 0], [2, 1]],
    },
    goal: {
      title: 'Schrauben füllen',
      text: 'Ist eine Schraube voll mit einer Farbe, bekommt sie eine Kappe.',
      state: { cap: 3, stacks: [[0, 0], [1, 1, 0], [1]] },
      moves: [[1, 0], [2, 1]],
    },
    help: {
      title: 'Hilfe ist gratis',
      text: 'Rückgängig, Tipp und Extra-Schraube helfen jederzeit und kosten höchstens einen Stern.',
      state: { cap: 3, stacks: [[0, 1, 0], [1, 0, 1], []] },
      hint: [0, 2],
      after: [1, -1],
    },
    modes: {
      text: 'Wähle im Menü, wie du spielen magst – später warten auch verdeckte Muttern «?».',
      items: [
        { emoji: '🗺️', label: 'Kapitel', sub: 'Level mit Sternen' },
        { emoji: '🌿', label: 'Entspannt', sub: 'endlos, ohne Sterne' },
        { emoji: '🧠', label: 'Knifflig', sub: 'nur eine freie Schraube' },
        { emoji: '❔', label: 'Verdeckt', sub: 'zeigt sich, wenn oben' },
      ],
    },
  });
}

runSortGame({
  id: 'screws',
  title: 'Schrauben & Muttern',
  tagline: 'Muttern auf die richtige Schraube',
  accent: '#6f7f8f',
  rules: RULES,
  names: NAMES,
  view,
  chapters: CHAPTERS,
  chapterSize: CHAPTER_SIZE,
  level: levelParams,
  zen: zenParams,
  hard: hardParams,
  daily: dailyParams,
  dailyLabel: 'Muttern des Tages',
  tutorial,
  sounds,
  showcase: { cap: 4, stacks: [[0, 0, 0, 0], [1, 2, 1], [2, 1, 2, 2], [3, 3, 3, 3], [1, 4], [4, 4, 4]] },
  confetti: (run) => NUTS.slice(0, Math.min(run.colors || 6, NUTS.length)).map((n) => n.c),
});
