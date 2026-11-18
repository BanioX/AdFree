import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Dame',
    tagline: 'Schlagen, bis die Dame fliegt',
    sub: 'Du hell',
    must: 'Du musst schlagen',
    stuck: 'Niemand kommt weiter.',
    score: 'Du {a} · Computer {b}',
    hint: 'Dieser Zug sieht gut aus.',
    tut1: 'Diagonal vorwärts',
    tut1t: 'Deine hellen Steine ziehen ein Feld diagonal nach vorne.',
    tut2: 'Schlagen ist Pflicht',
    tut2t: 'Über einen gegnerischen Stein springen, auch rückwärts. Die längste Kette gilt.',
    tut3: 'Die Dame fliegt',
    tut3t: 'Auf der letzten Reihe wird der Stein zur Dame und darf beliebig weit ziehen.',
  },
  en: {
    title: 'Draughts',
    tagline: 'Jump until the king flies',
    sub: 'You play light',
    must: 'You must capture',
    stuck: 'Nobody can move.',
    score: 'You {a} · Computer {b}',
    hint: 'This move looks good.',
    tut1: 'Diagonally forward',
    tut1t: 'Your light pieces move one square diagonally forward.',
    tut2: 'Capture is mandatory',
    tut2t: 'Jump an opponent, even backwards. The longest chain counts.',
    tut3: 'The king flies',
    tut3t: 'On the last row a piece becomes a king and can move any distance.',
  },
});

