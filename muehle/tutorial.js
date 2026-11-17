// Animierte Anleitung für Mühle.

import { h } from '../shared/ui.js';

function row() {
  const board = h('div.mu-demo');
  const cells = [0, 1, 2].map(() => h('i'));
  board.append(...cells);
  return { board, cells };
}

export function tutorialSteps() {
  return [
    {
      title: 'Neun Steine setzen',
      text: 'Abwechselnd auf freie Punkte. Danach wird nur noch gezogen.',
      demo(stage, api) {
        const { board, cells } = row();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => { c.className = ''; });
          await api.finger.tap(cells[0], 380);
          cells[0].classList.add('me');
          await api.sleep(280);
          cells[2].classList.add('ai');
          await api.sleep(640);
        });
      },
    },
    {
      title: 'Mühle schliesst',
      text: 'Drei eigene Steine in einer Linie: du nimmst einen gegnerischen Stein weg.',
      demo(stage, api) {
        const { board, cells } = row();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => { c.className = ''; });
          cells[0].classList.add('me');
          cells[1].classList.add('me');
          await api.finger.tap(cells[2], 380);
          cells[2].classList.add('me');
          await api.sleep(700);
        });
      },
    },
    {
      title: 'Ziehen und fliegen',
      text: 'Entlang der Linien auf ein freies Feld. Mit drei Steinen darfst du überallhin.',
      demo(stage, api) {
        const { board, cells } = row();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => { c.className = ''; });
          cells[0].classList.add('me');
          await api.finger.tap(cells[0], 360);
          cells[0].className = '';
          cells[1].classList.add('me');
          await api.sleep(700);
        });
      },
    },
  ];
}
