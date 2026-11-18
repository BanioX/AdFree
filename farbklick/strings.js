import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Farbklicker',
    tagline: 'Die Ecke frisst die Farbe',
    level: 'Stufe',
    go: 'Tippe eine Farbe',
    moves: '{n} Züge',
    win: 'Eine Farbe',
    tut1: 'Farbe tippen',
    tut1t: 'Die Fläche oben links nimmt die Farbe an, die du tippst.',
    tut2: 'Weiterfliessen',
    tut2t: 'Angrenzende Felder derselben Farbe kommen dazu.',
    tut3: 'Ohne Limit',
    tut3t: 'Es gibt kein Zuglimit. Fertig, wenn alles eine Farbe ist.',
  },
  en: {
    title: 'Color Flood',
    tagline: 'The corner swallows the colour',
    level: 'Level',
    go: 'Tap a colour',
    moves: '{n} moves',
    win: 'One colour',
    tut1: 'Tap a colour',
    tut1t: 'The patch at the top left becomes the colour you tap.',
    tut2: 'It spreads',
    tut2t: 'Touching squares of that colour join in.',
    tut3: 'No limit',
    tut3t: 'There is no move limit. Done when everything is one colour.',
  },
});
