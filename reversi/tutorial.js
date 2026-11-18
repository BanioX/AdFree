import { h } from '../shared/ui.js';
import { tr } from './strings.js';

function grid(spec) {
  const board = h('div.rv-demo');
  const cells = spec.map((k) => h('i', { class: k || '' }));
  board.append(...cells);
  return { board, cells };
}

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const { board, cells } = grid(['', 'dot', '', '', 'ai', 'me', '', '', 'me', 'ai', '', '', '', '', '']);
        stage.append(board);
        return api.loop(async () => {
          cells[1].className = 'dot';
          cells[4].className = 'ai';
          await api.finger.tap(cells[1], 450);
          cells[1].className = 'me';
          cells[4].className = 'me';
          await api.sleep(800);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const { board } = grid(['me', 'me', 'me', 'ai', 'me', 'me', 'ai', 'ai', 'me', 'ai', 'ai', 'ai', '', '', '', '']);
        stage.append(board);
        return api.loop(async () => { await api.sleep(1200); });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const { board, cells } = grid(['dot', '', '', '', '', 'me', 'ai', '', '', 'ai', 'me', '', '', '', '', '']);
        stage.append(board);
        return api.loop(async () => {
          cells[0].classList.remove('on');
          await api.finger.tap(cells[0], 480);
          cells[0].classList.add('on');
          await api.sleep(700);
        });
      },
    },
  ];
}
