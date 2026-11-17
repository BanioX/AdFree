import { h } from '../shared/ui.js';

function grid(spec) {
  const board = h('div.rv-demo');
  const cells = spec.map((k) => h('i', { class: k || '' }));
  board.append(...cells);
  return { board, cells };
}

export function tutorialSteps() {
  return [
    {
      title: 'Stein setzen',
      text: 'Setze so, dass du gegnerische Steine einschliesst. Sie drehen sich um.',
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
      title: 'Mehr Steine',
      text: 'Am Ende gewinnt, wer mehr Steine der eigenen Farbe hat.',
      demo(stage, api) {
        const { board } = grid(['me', 'me', 'me', 'ai', 'me', 'me', 'ai', 'ai', 'me', 'ai', 'ai', 'ai', '', '', '', '']);
        stage.append(board);
        return api.loop(async () => { await api.sleep(1200); });
      },
    },
    {
      title: 'Ecken sind stark',
      text: 'Ecken kann man nicht mehr drehen. Der Tipp zeigt einen guten Zug.',
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
