// «So geht's» für Sudoku: 4 kurze Schritte mit animierten Mini-Szenen (gemeinsames Tutorial aus shared/).
import { h } from '../../shared/ui.js';
import { showTutorial, maybeShowTutorial } from '../../shared/tutorial.js';
import { icon } from './icons.js';

const ID = 'sudoku';

// Gültiges, gelöstes Sudoku (Muster), daraus stammen die Ziffern der Szenen.
const SOLVED = (r, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;

const cellEl = (v, cls = '') => h('span', { class: ('sdt-c ' + cls).trim() }, v ? String(v) : '');

function padEl(n = 9) {
  const keys = [];
  const pad = h('div.sdt-pad');
  for (let d = 1; d <= n; d++) {
    const k = h('span.sdt-k', null, String(d));
    keys.push(k);
    pad.append(k);
  }
  return { pad, keys };
}

function toolEl(ic, label) {
  const t = h('span.sdt-tool');
  t.innerHTML = `<span class="ic">${icon(ic, { size: 20 })}</span><span class="lb">${label}</span>`;
  return t;
}

/** Zeigt eine Ziffer mit kleinem Hüpfer. */
function popIn(el, v) {
  el.textContent = String(v);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop', 'user');
}

async function press(api, key) {
  await api.finger.tap(key, 450);
  key.classList.add('down');
  setTimeout(() => key.classList.remove('down'), 180);
}

/** Lässt eine Gruppe von Feldern nacheinander aufleuchten. */
function wave(cells, cls = 'wave') {
  cells.forEach((c, k) => {
    c.classList.remove(cls);
    c.style.setProperty('--d', `${k * 45}ms`);
    void c.offsetWidth;
    c.classList.add(cls);
  });
}

export const steps = [
  {
    title: 'Feld, dann Zahl',
    text: 'Tippe ein leeres Feld an, dann unten die passende Zahl.',
    demo(stage, api) {
      const vals = [5, 3, 0, 6, 0, 2, 9, 8, 4];
      const answer = { 2: 7, 4: 1 };
      const block = h('div.sdt-block');
      const cells = vals.map((v) => cellEl(v, v ? 'given' : ''));
      block.append(...cells);
      const { pad, keys } = padEl();
      stage.append(h('div.sdt-scene', null, block, pad));
      return api.loop(async () => {
        for (const i of [2, 4]) cells[i].textContent = '';
        cells.forEach((c) => c.classList.remove('sel', 'pop', 'user', 'wave'));
        await api.sleep(350);
        for (const i of [2, 4]) {
          await api.finger.tap(cells[i]);
          cells.forEach((c) => c.classList.remove('sel'));
          cells[i].classList.add('sel');
          await api.sleep(250);
          await press(api, keys[answer[i] - 1]);
          popIn(cells[i], answer[i]);
          await api.sleep(450);
        }
        cells.forEach((c) => c.classList.remove('sel'));
        api.finger.hide();
        wave(cells);
        await api.sleep(1300);
      }, 300);
    },
  },
  {
    title: 'Das Ziel',
    text: 'In jeder Reihe, Spalte und jedem Block steht 1–9 genau einmal.',
    demo(stage, api) {
      const grid = h('div.sdt-grid');
      const cells = [];
      for (let b = 0; b < 9; b++) {
        const box = h('div.sdt-box');
        for (let k = 0; k < 9; k++) {
          const r = Math.floor(b / 3) * 3 + Math.floor(k / 3), c = (b % 3) * 3 + (k % 3);
          const el = cellEl(SOLVED(r, c));
          cells[r * 9 + c] = el;
          box.append(el);
        }
        grid.append(box);
      }
      // Nur Reihe 4, Spalte 4 und der mittlere Block sind ausgefüllt; das Mittelfeld fehlt.
      const row = [], col = [], blk = [];
      for (let k = 0; k < 9; k++) { row.push(4 * 9 + k); col.push(k * 9 + 4); }
      for (let r = 3; r < 6; r++) for (let c = 3; c < 6; c++) blk.push(r * 9 + c);
      const shown = new Set([...row, ...col, ...blk]);
      cells.forEach((el, i) => { if (!shown.has(i)) el.classList.add('faint'); });
      const mid = cells[40];
      const label = h('div.sdt-label');
      stage.append(h('div.sdt-scene', null, grid, label));
      const show = async (idx, text) => {
        label.textContent = text;
        label.classList.add('on');
        cells.forEach((c) => c.classList.remove('hl'));
        idx.forEach((i) => cells[i].classList.add('hl'));
        wave(idx.map((i) => cells[i]));
        await api.sleep(1150);
      };
      return api.loop(async () => {
        mid.textContent = '';
        mid.classList.remove('pop', 'user', 'sel');
        cells.forEach((c) => c.classList.remove('hl', 'wave'));
        label.classList.remove('on');
        await api.sleep(300);
        await api.finger.tap(mid);
        mid.classList.add('sel');
        await api.sleep(300);
        popIn(mid, SOLVED(4, 4));
        mid.classList.remove('sel');
        api.finger.hide();
        await api.sleep(350);
        await show(row, 'Reihe: 1–9');
        await show(col, 'Spalte: 1–9');
        await show(blk, 'Block: 1–9');
        label.classList.remove('on');
        cells.forEach((c) => c.classList.remove('hl'));
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Notizen',
    text: 'Mit dem Stift notierst du mögliche Zahlen klein ins Feld.',
    demo(stage, api) {
      const big = h('div.sdt-big');
      const notes = [];
      const grid = h('div.sdt-notes');
      for (let d = 1; d <= 9; d++) { const n = h('i'); notes.push(n); grid.append(n); }
      const val = h('b.sdt-val');
      big.append(grid, val);
      const pen = toolEl('pencil', 'Notizen');
      const wand = toolEl('wand', 'Alle Notizen');
      const tools = h('div.sdt-tools', null, pen, wand);
      const { pad, keys } = padEl();
      stage.append(h('div.sdt-scene.sdt-scene-notes', null, big, tools, pad));
      const note = (d) => { notes[d - 1].textContent = String(d); notes[d - 1].classList.add('on'); };
      return api.loop(async () => {
        notes.forEach((n) => { n.textContent = ''; n.classList.remove('on'); });
        val.textContent = '';
        val.classList.remove('pop');
        pen.classList.remove('on');
        pad.classList.remove('notes');
        await api.sleep(350);
        await api.finger.tap(pen);
        pen.classList.add('on');
        pad.classList.add('notes');
        await api.sleep(250);
        for (const d of [2, 6, 8]) { await press(api, keys[d - 1]); note(d); await api.sleep(200); }
        await api.sleep(400);
        await api.finger.tap(pen);
        pen.classList.remove('on');
        pad.classList.remove('notes');
        await api.sleep(250);
        await press(api, keys[5]);
        notes.forEach((n) => { n.textContent = ''; n.classList.remove('on'); });
        popIn(val, 6);
        api.finger.hide();
        await api.sleep(1300);
      }, 300);
    },
  },
  {
    title: 'Tipps sind gratis',
    text: 'Steckst du fest, zeigt dir der Tipp den nächsten Schritt.',
    demo(stage, api) {
      const vals = [8, 0, 3, 5, 9, 7, 6, 1, 2];
      const block = h('div.sdt-block');
      const cells = vals.map((v) => cellEl(v, v ? 'given' : ''));
      block.append(...cells);
      const act = h('em', null, 'Eintragen');
      const bubble = h('div.sdt-bubble', null,
        h('div.tx', null, h('b', null, 'Hier fehlt nur die 4'), h('small', null, 'Alle anderen Zahlen sind im Block schon da.')),
        act);
      const undo = toolEl('undo', 'Zurück');
      const hint = toolEl('hint', 'Tipp');
      const tools = h('div.sdt-tools', null, undo, hint);
      stage.append(h('div.sdt-scene', null, block, tools), bubble);
      return api.loop(async () => {
        cells[1].textContent = '';
        cells.forEach((c) => c.classList.remove('focus', 'pop', 'user', 'wave'));
        hint.classList.remove('on');
        tools.classList.remove('hide');
        bubble.classList.remove('on');
        await api.sleep(350);
        await api.finger.tap(hint);
        hint.classList.add('on');
        await api.sleep(150);
        tools.classList.add('hide');
        cells[1].classList.add('focus');
        bubble.classList.add('on');
        await api.sleep(1600);
        await api.finger.tap(act);
        bubble.classList.remove('on');
        cells[1].classList.remove('focus');
        popIn(cells[1], 4);
        api.finger.hide();
        await api.sleep(250);
        wave(cells);
        await api.sleep(1300);
      }, 300);
    },
  },
];

/** Tutorial jederzeit zeigen («?»). */
export function openTutorial() {
  return showTutorial({ id: ID, steps });
}

/** Tutorial nur beim allerersten Start. @returns {Promise<boolean>} */
export function firstTutorial() {
  return maybeShowTutorial({ id: ID, steps });
}
