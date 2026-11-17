// Bilderrätsel – «So geht's» mit kleiner Beispiel-Grafik.

import { h, showModal } from '../shared/ui.js';

// Beispiel: 5×5-Herz, teilweise gelöst
const EX = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const STATE = ['.x.x.', '##x##'.replace('x', '#'), '#####', 'x###x', '..#..'];

function runs(line) {
  const out = [];
  let n = 0;
  for (const ch of line) { if (ch === '#') n++; else if (n) { out.push(n); n = 0; } }
  if (n) out.push(n);
  return out.length ? out : [0];
}

function example() {
  const cols = [];
  for (let c = 0; c < 5; c++) cols.push(runs(EX.map((r) => r[c]).join('')));
  const grid = h('div.ex-grid');
  grid.append(h('div.ex-corner'));
  for (let c = 0; c < 5; c++) grid.append(h('div.ex-col', null, ...cols[c].map((n) => h('span', null, String(n)))));
  for (let r = 0; r < 5; r++) {
    grid.append(h('div.ex-row', null, ...runs(EX[r]).map((n) => h('span', null, String(n)))));
    for (let c = 0; c < 5; c++) {
      const s = STATE[r][c];
      const cls = s === '#' ? 'ex-cell fill' : s === 'x' ? 'ex-cell cross' : 'ex-cell';
      grid.append(h('div', { class: cls }));
    }
  }
  return grid;
}

export function showHelp() {
  const content = h('div.help',
    example(),
    h('ul.help-list',
      h('li', null, h('b', null, 'Zahlen: '), 'So viele Felder sind am Stück gefüllt – der Reihe nach, mit Lücken dazwischen.'),
      h('li', null, h('b', null, 'Füllen: '), 'Feld antippen. Ziehen füllt mehrere auf einmal.'),
      h('li', null, h('b', null, 'Kreuzchen ✕: '), 'Für sicher leere Felder – mit dem ✕-Schalter oder lange drücken.'),
      h('li', null, h('b', null, 'Grosse Bilder: '), 'Mit zwei Fingern oder der Lupe zoomen. Die Zahlen bleiben sichtbar.'),
    ),
    h('p.help-foot', null, 'Kein Raten nötig. Ist alles richtig, erscheint das Bild in Farbe!'));
  return showModal({ title: 'So geht’s', content, buttons: [{ label: 'Los geht’s', value: true, primary: true }] });
}
