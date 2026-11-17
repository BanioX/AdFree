// Zahlenschlange – «So geht's»: 4 kurze Schritte mit animierten Mini-Brettern.
import { h } from '../shared/ui.js';
import { NI } from '../lib/numbers/icons.js';
import { buildBoard } from './board.js';

// 3×3-Beispiel: 1 2 3 / 8 9 4 / 7 6 5
const SOL = [1, 2, 3, 8, 9, 4, 7, 6, 5];
const POS = []; SOL.forEach((v, i) => { POS[v] = i; });
const touch = (a, b) => Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) <= 1 && Math.abs((a % 3) - (b % 3)) <= 1;

function demo(stage, givenVals) {
  const wrap = h('div.nx-demo.hd-demo');
  const board = buildBoard({ w: 3, h: 3 }, { gap: 5 });
  board.layout(170, 170);
  wrap.append(board.el);
  stage.append(wrap);
  const given = SOL.map((v) => givenVals.includes(v));
  const vals = SOL.map((v) => (givenVals.includes(v) ? v : 0));
  const paint = (active = -1) => {
    const p = []; vals.forEach((v, i) => { if (v > 0) p[v] = i; });
    const lnk = [];
    for (let k = 1; k < 9; k++) if (p[k] != null && p[k + 1] != null && touch(p[k], p[k + 1])) lnk.push([p[k], p[k + 1], k]);
    board.render(vals, given, lnk, { active, ends: [POS[1], POS[9]] });
  };
  return { wrap, board, vals, given, paint, reset() { SOL.forEach((v, i) => { vals[i] = givenVals.includes(v) ? v : 0; }); paint(); } };
}

export function tutorialSteps() {
  return [
    {
      title: 'Zahlen verbinden',
      text: 'Jede Zahl berührt die nächste – waagrecht, senkrecht oder schräg.',
      demo(stage, api) {
        const d = demo(stage, [1, 9]);
        return api.loop(async () => {
          d.reset();
          await api.sleep(500);
          api.finger.hide();
          for (let k = 2; k <= 8; k++) { d.vals[POS[k]] = k; d.paint(); await api.sleep(260); }
          await api.sleep(1400);
        });
      },
    },
    {
      title: 'Ziehen zum Zeichnen',
      text: 'Zieh von einer Zahl aus über leere Felder – die Zahlen zählen von selbst mit.',
      demo(stage, api) {
        const d = demo(stage, [1, 5, 9]);
        return api.loop(async () => {
          d.reset();
          await api.sleep(400);
          const cells = [1, 2, 3, 4].map((k) => d.board.cell(POS[k]));
          await api.finger.drag(cells, 1100, (i) => { d.vals[POS[i + 1]] = i + 1; d.paint(POS[i + 1]); });
          await api.sleep(1300);
        });
      },
    },
    {
      title: 'Oder antippen',
      text: 'Tippe ein leeres Feld an und wähle eine Zahl, die dorthin passt.',
      demo(stage, api) {
        const d = demo(stage, [1, 2, 3, 4, 5, 9]);
        const pad = h('div.hd-demo-pad', null, h('span', null, '6'), h('span', null, '8'));
        d.wrap.append(pad);
        return api.loop(async () => {
          d.reset();
          pad.classList.remove('show');
          await api.sleep(400);
          await api.finger.tap(d.board.cell(POS[6]));
          d.paint(POS[6]);
          pad.classList.add('show');
          await api.sleep(450);
          await api.finger.tap(pad.children[0]);
          pad.classList.remove('show');
          d.vals[POS[6]] = 6; d.paint(POS[6]);
          await api.sleep(1300);
        });
      },
    },
    {
      title: 'Hilfen sind gratis',
      text: 'Rückgängig, Löschen und Tipps – so oft du willst. Ziel: der ganze Weg bis zur letzten Zahl.',
      demo(stage, api) {
        const d = demo(stage, [1, 2, 3, 4, 5, 6, 9]);
        const tools = h('div.hd-demo-tools', null,
          h('span', { html: NI.undo }), h('span.bulb', { html: NI.bulb }), h('span', { html: NI.eraser }));
        d.wrap.append(tools);
        return api.loop(async () => {
          d.reset();
          await api.sleep(500);
          await api.finger.tap(tools.children[1]);
          d.vals[POS[7]] = 7; d.paint();
          d.board.cell(POS[7]).classList.add('ng-pop');
          await api.sleep(500);
          d.vals[POS[8]] = 8; d.paint();
          d.board.cell(POS[8]).classList.add('ng-pop');
          api.finger.hide();
          await api.sleep(1500);
        });
      },
    },
  ];
}
