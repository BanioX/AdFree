import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Inseln',
    tagline: 'Die Zahl ist eine Insel dieser Grösse',
    level: 'Stufe',
    go: 'Tippe: leer, Wasser, Land',
    win: 'Die Inseln stimmen',
    hint: 'Ein Feld ist korrigiert',
    none: 'Da ist nichts mehr zu zeigen',
    tut1: 'Wasser oder Land',
    tut1t: 'Tippen wechselt leer, Wasser und Land. Die Zahl bleibt auf ihrer Insel.',
    tut2: 'Genau so gross',
    tut2t: 'Eine 4 ist eine Insel aus vier Feldern. Inseln berühren sich nicht, auch nicht über eine Kante.',
    tut3: 'Das Wasser',
    tut3t: 'Das Wasser ist ein einziges Gebiet. Ein Teich aus 2×2 Feldern ist verboten.',
  },
  en: {
    title: 'Islands',
    tagline: 'The number is an island of that size',
    level: 'Level',
    go: 'Tap: empty, water, land',
    win: 'The islands are right',
    hint: 'One square is corrected',
    none: 'Nothing left to show',
    tut1: 'Water or land',
    tut1t: 'Tapping cycles empty, water and land. The number stays on its island.',
    tut2: 'Just that big',
    tut2t: 'A 4 is an island of four squares. Islands never touch, not even along an edge.',
    tut3: 'The water',
    tut3t: 'The water is one single stretch. A pool of 2×2 squares is not allowed.',
  },
});
