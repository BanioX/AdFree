// Zahlensummen – «So geht's»: 4 kurze Schritte mit animierten Mini-Brettern.
import { h } from '../shared/ui.js';
import { NI } from '../lib/numbers/icons.js';
import { buildBoard, paintMarks } from './board.js';

// Kleines Beispiel 3×3: bleiben = 4 · 7 / 3 · 1 / 6
const DEMO = {
  n: 3,
  digits: [4, 2, 7, 5, 3, 1, 6, 8, 2],
  keep: [true, false, true, false, true, true, true, false, false],
  rows: [11, 4, 6],
  cols: [10, 3, 8],
  region: null,
  regionSums: null,
};
const DEMO_REG = {
  ...DEMO,
  region: [0, 0, 1, 2, 0, 1, 2, 2, 1],
  regionSums: [7, 8, 6],
};

function stageBoard(stage, p, { tools = true } = {}) {
  const wrap = h('div.nx-demo.ns-demo');
  const board = buildBoard(p, { className: 'ns-demo-board' });
  board.layout(190, 190);
  wrap.append(board.el);
  let er = null, ke = null;
  if (tools) {
    er = h('span.ns-demo-tool.on', { html: NI.eraser });
    ke = h('span.ns-demo-tool', { html: NI.circle });
    wrap.append(h('div.ns-demo-tools', null, er, ke));
  }
  stage.append(wrap);
  const marks = new Array(p.n * p.n).fill(0);
  const done = new Set();
  const paint = () => paintMarks(board, p, marks, done);
  return { board, marks, done, paint, er, ke };
}

export function tutorialSteps() {
  return [
    {
      title: 'Ausradieren',
      text: 'Tippe Zahlen an, die nicht zur Summe passen – sie verschwinden.',
      demo(stage, api) {
        const b = stageBoard(stage, DEMO);
        return api.loop(async () => {
          b.marks.fill(0); b.done.clear(); b.paint();
          await api.sleep(500);
          await api.finger.tap(b.board.cell(1)); b.marks[1] = 2; b.paint();
          await api.sleep(500);
          await api.finger.tap(b.board.cell(3)); b.marks[3] = 2; b.paint();
          await api.sleep(1200);
        });
      },
    },
    {
      title: 'Einkreisen',
      text: 'Mit dem Kreis markierst du Zahlen, die sicher zählen.',
      demo(stage, api) {
        const b = stageBoard(stage, DEMO);
        return api.loop(async () => {
          b.marks.fill(0); b.marks[1] = 2; b.paint();
          b.er.classList.add('on'); b.ke.classList.remove('on');
          await api.sleep(500);
          await api.finger.tap(b.ke); b.ke.classList.add('on'); b.er.classList.remove('on');
          await api.sleep(300);
          await api.finger.tap(b.board.cell(4)); b.marks[4] = 1; b.paint();
          await api.sleep(450);
          await api.finger.tap(b.board.cell(6)); b.marks[6] = 1; b.paint();
          await api.sleep(1200);
        });
      },
    },
    {
      title: 'Summen abhaken',
      text: 'Stimmt eine Reihe oder Spalte, wird sie abgehakt. Ziel: alle Summen stimmen.',
      demo(stage, api) {
        const b = stageBoard(stage, DEMO, { tools: false });
        return api.loop(async () => {
          b.marks.fill(0); b.marks[3] = 2; b.marks[5] = 1; b.done.clear(); b.paint();
          await api.sleep(500);
          await api.finger.tap(b.board.cell(1)); b.marks[1] = 2; b.marks[0] = 1; b.marks[2] = 1; b.marks[4] = 1; b.marks[8] = 2;
          b.done.add('row-0'); b.done.add('row-1'); b.done.add('col-2'); b.paint();
          await api.sleep(700);
          await api.finger.tap(b.board.cell(7)); b.marks[7] = 2; b.marks[6] = 1;
          ['row-2', 'col-0', 'col-1'].forEach((k) => b.done.add(k)); b.paint();
          await api.sleep(1500);
        });
      },
    },
    {
      title: 'Farben & Herzen',
      text: 'Ab «Schwer» zählen auch Farbbereiche. Du hast drei Herzen – Fehler sind nicht schlimm.',
      demo(stage, api) {
        const b = stageBoard(stage, DEMO_REG, { tools: false });
        const hearts = h('div.nx-hearts.ns-demo-hearts', null, ...[0, 1, 2].map(() => h('span', { html: NI.heart })));
        stage.querySelector('.ns-demo').append(hearts);
        return api.loop(async () => {
          b.marks.fill(0); b.paint();
          hearts.children[2].classList.remove('off', 'lose');
          await api.sleep(600);
          await api.finger.tap(b.board.cell(0));
          b.board.cell(0).classList.add('ng-shake', 'wrong');
          hearts.children[2].classList.add('off', 'lose');
          await api.sleep(500);
          b.board.cell(0).classList.remove('ng-shake', 'wrong');
          api.finger.hide();
          await api.sleep(1400);
        });
      },
    },
  ];
}
