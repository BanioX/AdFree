// Animierte Anleitung für Vier in einer Reihe.

import { h } from '../shared/ui.js';

function mini(cols, rows = 4) {
  const board = h('div.c4-demo');
  const holes = [];
  for (let c = 0; c < cols; c++) {
    const col = h('div.c4-demo-col');
    holes[c] = [];
    for (let r = rows - 1; r >= 0; r--) {
      const hole = h('div.c4-demo-hole');
      holes[c][r] = hole;
      col.append(hole);
    }
    board.append(col);
  }
  return { board, holes };
}

function put(hole, kind) {
  hole.replaceChildren(h('i', { class: 'c4-demo-disc ' + kind }));
}

export function tutorialSteps() {
  return [
    {
      title: 'Stein fallen lassen',
      text: 'Tippe eine Reihe an. Dein Stein fällt nach unten.',
      demo(stage, api) {
        const { board, holes } = mini(5, 4);
        stage.append(board);
        return api.loop(async () => {
          for (const col of holes) for (const hole of col) if (hole) hole.replaceChildren();
          await api.finger.tap(holes[2][3], 500);
          put(holes[2][0], 'me fall');
          await api.sleep(700);
        });
      },
    },
    {
      title: 'Vier in einer Linie',
      text: 'Vier eigene Steine in einer Reihe, Spalte oder Diagonale gewinnen.',
      demo(stage, api) {
        const { board, holes } = mini(5, 4);
        stage.append(board);
        put(holes[0][0], 'ai');
        put(holes[1][0], 'me');
        put(holes[2][0], 'me');
        put(holes[3][0], 'me');
        return api.loop(async () => {
          holes[4][0].replaceChildren();
          await api.finger.tap(holes[4][3], 480);
          put(holes[4][0], 'me');
          for (let c = 1; c <= 4; c++) holes[c][0].firstChild?.classList.add('glow');
          await api.sleep(900);
          for (let c = 1; c <= 4; c++) holes[c][0].firstChild?.classList.remove('glow');
        });
      },
    },
    {
      title: 'Tipp und Zurück',
      text: 'Der Tipp zeigt eine gute Reihe. Zurück nimmt den letzten Zug zurück.',
      demo(stage, api) {
        const bar = h('div.c4-demo-bar');
        const hint = h('div.c4-demo-btn', null, 'Tipp');
        const undo = h('div.c4-demo-btn', null, 'Zurück');
        bar.append(undo, hint);
        const { board, holes } = mini(5, 3);
        stage.append(board, bar);
        put(holes[1][0], 'me');
        put(holes[2][0], 'ai');
        return api.loop(async () => {
          hint.classList.remove('on');
          holes[3][0].replaceChildren();
          await api.finger.tap(hint, 500);
          hint.classList.add('on');
          put(holes[3][0], 'me ghost');
          await api.sleep(800);
        });
      },
    },
  ];
}
