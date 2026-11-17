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
    h('ol.help-list',
      h('li', null, h('b', null, 'Zahlen lesen: '), 'Sie sagen, wie viele Felder am Stück gefüllt sind – in dieser Reihenfolge, mit mindestens einem leeren Feld dazwischen.'),
      h('li', null, h('b', null, 'Füllen: '), 'Tippe ein Feld an. Ziehen füllt eine ganze Reihe auf einmal.'),
      h('li', null, h('b', null, 'Kreuzchen ✕: '), 'Markiere Felder, die sicher leer bleiben – mit dem ✕-Knopf oder lange drücken.'),
      h('li', null, h('b', null, 'Erledigt: '), 'Fertige Zahlen werden grau. Ist alles richtig, erscheint das Bild in Farbe!'),
      h('li', null, h('b', null, 'Grosse Rätsel: '), 'Mit zwei Fingern zoomen und verschieben, oder die Lupe benutzen. Die Zahlen bleiben immer sichtbar.'),
    ),
    h('p.help-foot', null, 'Kein Raten nötig: Jedes Bild lässt sich allein mit Logik lösen. Bei Bedarf hilft die Glühbirne.'));
  return showModal({ title: 'So geht’s', content, buttons: [{ label: 'Los geht’s', value: true, primary: true }] });
}
