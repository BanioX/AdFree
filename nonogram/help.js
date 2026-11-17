// Bilderrätsel – «So geht's»: kurzes, animiertes Tutorial (shared/tutorial.js).
// Vier Schritte mit einer kleinen 5×5-Szene im Spielstil und einem animierten Finger.

import { h, icon } from '../shared/ui.js';
import { showTutorial, maybeShowTutorial, tutorialSeen, markTutorialSeen } from '../shared/tutorial.js';
import * as save from './save.js';

const ID = 'nonogram';
const ACCENT = '#e0699a';

// Beispiel: 5×5-Herz. '#' = gefüllt, sonst leer. Farben für die Enthüllung.
const EX = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const PAL = ['.r.r.', 'rprrr', 'rrrrr', '.rrr.', '..r..'];
const COLOR = { r: '#f2385a', p: '#ff9db5' };

function runs(line) {
  const out = [];
  let n = 0;
  for (const ch of line) { if (ch === '#') n++; else if (n) { out.push(n); n = 0; } }
  if (n) out.push(n);
  return out.length ? out : [0];
}
const ROW_CLUES = EX.map(runs);
const COL_CLUES = [0, 1, 2, 3, 4].map((c) => runs(EX.map((r) => r[c]).join('')));

/**
 * Mini-Spielfeld als DOM. state: 5 Zeilen aus '#' (gefüllt), 'x' (Kreuz), '.' (leer).
 * Gibt { el, cell(r, c), set(r, c, v), rowClue(r), colClue(c), refresh() } zurück.
 */
function miniBoard(state, cs = 30) {
  const el = h('div.nt-board', { style: { '--cs': cs + 'px' } });
  const cells = [];
  const rows = [], cols = [];
  el.append(h('div.nt-corner'));
  for (let c = 0; c < 5; c++) {
    const col = h('div.nt-col', null, ...COL_CLUES[c].map((n) => h('span', null, String(n))));
    cols.push(col);
    el.append(col);
  }
  for (let r = 0; r < 5; r++) {
    const row = h('div.nt-row', null, ...ROW_CLUES[r].map((n) => h('span', null, String(n))));
    rows.push(row);
    el.append(row);
    for (let c = 0; c < 5; c++) {
      const cell = h('div.nt-cell');
      cell.style.setProperty('--pc', COLOR[PAL[r][c]] || 'transparent');
      cells.push(cell);
      el.append(cell);
    }
  }
  const api = {
    el,
    cell: (r, c) => cells[r * 5 + c],
    get: (r, c) => (cells[r * 5 + c].classList.contains('fill') ? '#' : cells[r * 5 + c].classList.contains('cross') ? 'x' : '.'),
    set(r, c, v) {
      const cell = cells[r * 5 + c];
      cell.classList.toggle('fill', v === '#');
      cell.classList.toggle('cross', v === 'x');
      cell.classList.remove('bad', 'hint');
      api.refresh();
    },
    load(st) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const cell = cells[r * 5 + c];
        cell.classList.remove('bad', 'hint');
        cell.classList.toggle('fill', st[r][c] === '#');
        cell.classList.toggle('cross', st[r][c] === 'x');
      }
      el.classList.remove('reveal');
      api.refresh();
    },
    rowClue: (r) => rows[r],
    colClue: (c) => cols[c],
    /** Erledigte Zeilen/Spalten grau, wie im Spiel. */
    refresh() {
      for (let r = 0; r < 5; r++) {
        let line = '';
        for (let c = 0; c < 5; c++) line += api.get(r, c) === '#' ? '#' : '.';
        rows[r].classList.toggle('done', line === EX[r]);
      }
      for (let c = 0; c < 5; c++) {
        let line = '';
        for (let r = 0; r < 5; r++) line += api.get(r, c) === '#' ? '#' : '.';
        cols[c].classList.toggle('done', line === EX.map((x) => x[c]).join(''));
      }
    },
  };
  api.load(state);
  return api;
}

function scene(stage, ...children) {
  const wrap = h('div.nt-scene', null, ...children);
  stage.append(wrap);
  return wrap;
}

const EMPTY = ['.....', '.....', '.....', '.....', '.....'];
const TWO_ROWS = ['.....', '#####', '#####', '.....', '.....'];
const ALMOST = ['x#x#x', '#####', '#####', 'x###x', 'xx.xx'];

/** Zieht den Finger über eine ganze Zeile und füllt die Felder mit. */
async function dragRow(api, b, r) {
  const targets = [0, 1, 2, 3, 4].map((c) => b.cell(r, c));
  const p = api.finger.drag(targets, 900, (i) => b.set(r, i, '#'));
  await api.sleep(560);
  b.set(r, 0, '#');
  await p;
}

/** Langes Drücken setzt ein Kreuz. */
async function longPress(api, b, r, c) {
  await api.finger.moveTo(b.cell(r, c), 450);
  const p = api.finger.press(560);
  await api.sleep(380);
  b.set(r, c, 'x');
  await p;
}

export function tutorialSteps() {
  return [
    {
      title: 'Felder füllen',
      text: 'Die Zahlen sagen, wie viele Felder am Stück voll sind. Tippen oder ziehen!',
      demo(stage, api) {
        const b = miniBoard(EMPTY);
        scene(stage, b.el);
        return api.loop(async () => {
          b.load(EMPTY);
          b.rowClue(1).classList.add('focus');
          await api.sleep(500);
          await dragRow(api, b, 1);
          b.rowClue(1).classList.remove('focus');
          await api.sleep(350);
          b.rowClue(2).classList.add('focus');
          await dragRow(api, b, 2);
          b.rowClue(2).classList.remove('focus');
          api.finger.hide();
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Leere Felder ✕',
      text: 'Lange drücken setzt ein ✕ – für Felder, die sicher leer bleiben.',
      demo(stage, api) {
        const b = miniBoard(TWO_ROWS);
        scene(stage, b.el);
        return api.loop(async () => {
          b.load(TWO_ROWS);
          b.rowClue(0).classList.add('focus');
          await api.sleep(400);
          await longPress(api, b, 0, 0);
          await longPress(api, b, 0, 2);
          await longPress(api, b, 0, 4);
          await api.finger.tap(b.cell(0, 1), 420);
          b.set(0, 1, '#');
          await api.finger.tap(b.cell(0, 3), 420);
          b.set(0, 3, '#');
          b.rowClue(0).classList.remove('focus');
          api.finger.hide();
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Bild entdecken',
      text: 'Stimmen alle Zahlen, erscheint das versteckte Bild in Farbe.',
      demo(stage, api) {
        const b = miniBoard(ALMOST);
        scene(stage, b.el);
        return api.loop(async () => {
          b.load(ALMOST);
          await api.sleep(500);
          await api.finger.tap(b.cell(4, 2));
          b.set(4, 2, '#');
          api.finger.hide();
          await api.sleep(250);
          b.el.classList.add('reveal');
          await api.sleep(2200);
        }, 400);
      },
    },
    {
      title: 'Hilfe ist gratis',
      text: 'Tipp zeigt ein sicheres Feld, Prüfen findet Fehler, die Lupe zoomt grosse Bilder.',
      demo(stage, api) {
        const START = ['.....', '#####', '##.##', '.....', '.....'];
        const b = miniBoard(START, 24);
        const tool = (name, label, html) => h('span.nt-tool', { 'data-t': name }, h('i', { html }), h('small', null, label));
        const zoom = tool('zoom', 'Lupe', icon('zoomIn', { size: 20 }));
        const chk = tool('check', 'Prüfen', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l4.5 4.5L20 6.5"/></svg>');
        const tip = tool('hint', 'Tipp', icon('hint', { size: 20 }));
        scene(stage, b.el, h('div.nt-tools', null, zoom, chk, tip));
        return api.loop(async () => {
          b.load(START);
          b.set(3, 0, '#');   // ein falsches Feld
          await api.sleep(500);
          await api.finger.tap(chk);
          chk.classList.add('on');
          b.cell(3, 0).classList.add('bad');
          await api.sleep(1100);
          chk.classList.remove('on');
          b.set(3, 0, '.');
          await api.finger.tap(tip, 500);
          tip.classList.add('on');
          b.set(2, 2, '#');
          b.cell(2, 2).classList.add('hint');
          await api.sleep(1300);
          tip.classList.remove('on');
          api.finger.hide();
          await api.sleep(500);
        }, 300);
      },
    },
  ];
}

/** «So geht's» jederzeit (Menü «?», im Spiel). */
export function showHelp() {
  return showTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT });
}

/** Beim allerersten Start automatisch. Frühere Versionen merkten sich das in den Einstellungen. */
let pending = null;
export function maybeHelp() {
  if (!tutorialSeen(ID) && save.settings.get().helpSeen) markTutorialSeen(ID);
  if (!pending) pending = maybeShowTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT }).finally(() => { pending = null; });
  return pending;
}
