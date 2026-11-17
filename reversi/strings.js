import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Reversi',
    tagline: 'Steine einschliessen und umdrehen',
    sub: 'Du schwarz',
    more: 'Mehr Steine!',
    score: 'Du {a} · Computer {b}',
    hint: 'Dieses Feld sieht gut aus.',
    youPass: 'Du musst passen.',
    cpuPass: 'Computer muss passen.',
    tut1: 'Stein setzen',
    tut1t: 'Setze so, dass du gegnerische Steine einschliesst. Sie drehen sich um.',
    tut2: 'Mehr Steine',
    tut2t: 'Am Ende gewinnt, wer mehr Steine der eigenen Farbe hat.',
    tut3: 'Ecken sind stark',
    tut3t: 'Ecken kann man nicht mehr drehen. Der Tipp zeigt einen guten Zug.',
  },
  en: {
    title: 'Reversi',
    tagline: 'Trap discs and flip them',
    sub: 'You play black',
    more: 'More discs!',
    score: 'You {a} · Computer {b}',
    hint: 'This square looks good.',
    youPass: 'You have to pass.',
    cpuPass: 'Computer has to pass.',
    tut1: 'Place a disc',
    tut1t: 'Place a disc so you trap the opponent. Those discs flip.',
    tut2: 'More discs',
    tut2t: 'Whoever has more discs of their own colour at the end wins.',
    tut3: 'Corners are strong',
    tut3t: 'Corners cannot be flipped again. Hint marks a good move.',
  },
});

