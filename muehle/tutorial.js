// Animierte Anleitung für Mühle.

import { h } from '../shared/ui.js';
import { tr } from './strings.js';

function row() {
  const board = h('div.mu-demo');
  const cells = [0, 1, 2].map(() => h('i'));
  board.append(...cells);
  return { board, cells };
}

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
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
      title: tr('tut2'),
      text: tr('tut2t'),
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
      title: tr('tut3'),
      text: tr('tut3t'),
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
