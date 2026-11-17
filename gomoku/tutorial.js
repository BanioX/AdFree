import { h } from '../shared/ui.js';

function row(kinds) {
  const line = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '48px' } });
  const cells = kinds.map((k) => {
    const c = h('i', { style: {
      width: '28px', height: '28px', borderRadius: '50%',
      background: k === 'me' ? '#1c1614' : k === 'ai' ? '#f4efe6' : '#e4c07a',
      boxShadow: 'inset 0 0 0 2px #c9964e',
    } });
    line.append(c);
    return c;
  });
  return { line, cells };
}

export function tutorialSteps() {
  return [
    {
      title: 'Stein setzen',
      text: 'Tippe ein freies Feld. Du spielst schwarz und beginnst.',
      demo(stage, api) {
        const { line, cells } = row(['', '', '', '', '']);
        const board = h('div', { style: { background: '#e4c07a', borderRadius: '16px', padding: '8px' } });
        board.append(line);
        stage.append(board);
        return api.loop(async () => {
          cells[2].style.background = '#e4c07a';
          await api.finger.tap(cells[2], 450);
          cells[2].style.background = '#1c1614';
          await api.sleep(700);
        });
      },
    },
    {
      title: 'Fünf in einer Linie',
      text: 'Fünf eigene Steine in einer Reihe, Spalte oder Diagonale gewinnen.',
      demo(stage, api) {
        const { line, cells } = row(['me', 'me', 'me', 'me', '']);
        const board = h('div', { style: { background: '#e4c07a', borderRadius: '16px', padding: '8px' } });
        board.append(line);
        stage.append(board);
        return api.loop(async () => {
          cells[4].style.background = '#e4c07a';
          cells.forEach((c) => { c.style.boxShadow = 'inset 0 0 0 2px #c9964e'; });
          await api.finger.tap(cells[4], 420);
          cells[4].style.background = '#1c1614';
          cells.forEach((c) => { c.style.boxShadow = '0 0 0 3px #ffe27a'; });
          await api.sleep(800);
        });
      },
    },
    {
      title: 'Blocken',
      text: 'Halt den Computer auf, bevor er fünf Steine schliesst. Tipp und Zurück helfen.',
      demo(stage, api) {
        const { line, cells } = row(['ai', 'ai', 'ai', 'ai', '']);
        const board = h('div', { style: { background: '#e4c07a', borderRadius: '16px', padding: '8px' } });
        board.append(line);
        stage.append(board);
        return api.loop(async () => {
          cells[4].style.background = '#e4c07a';
          await api.finger.tap(cells[4], 420);
          cells[4].style.background = '#1c1614';
          await api.sleep(800);
        });
      },
    },
  ];
}
