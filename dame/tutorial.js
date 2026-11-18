// Animierte Anleitung für Dame.

import { h } from '../shared/ui.js';
import { tr } from './strings.js';

function mini() {
  const board = h('div.dm-demo');
  const cells = [];
  for (let i = 0; i < 36; i++) {
    const dark = (Math.floor(i / 6) + (i % 6)) % 2 === 1;
    const el = h('i', { class: dark ? 'dark' : '' });
    cells.push(el);
    board.append(el);
  }
  return { board, cells };
}

function put(cell, kind) {
  cell.replaceChildren(kind ? h('b', { class: kind }) : '');
}

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const { board, cells } = mini();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => c.replaceChildren());
          put(cells[25], 'me');
          await api.finger.tap(cells[25], 420);
          put(cells[25], '');
          put(cells[20], 'me');
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const { board, cells } = mini();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => c.replaceChildren());
          put(cells[25], 'me');
          put(cells[20], 'ai');
          await api.finger.tap(cells[25], 420);
          put(cells[25], '');
          put(cells[20], '');
          put(cells[15], 'me');
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const { board, cells } = mini();
        stage.append(board);
        return api.loop(async () => {
          cells.forEach((c) => c.replaceChildren());
          put(cells[8], 'me king');
          await api.finger.tap(cells[8], 380);
          put(cells[8], '');
          put(cells[29], 'me king');
          await api.sleep(760);
        });
      },
    },
  ];
}
