import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Rundweg',
    tagline: 'Eine Schlaufe, die Zahlen zählen die Kanten',
    level: 'Stufe',
    go: 'Tippe eine Kante an oder aus',
    win: 'Die Schlaufe ist geschlossen',
    hint: 'Eine Kante ist korrigiert',
    none: 'Da ist nichts mehr zu zeigen',
    tut1: 'Kante tippen',
    tut1t: 'Jede Kante zwischen zwei Punkten ist an oder aus. Zusammen bilden sie eine einzige Schlaufe.',
    tut2: 'Die Zahl',
    tut2t: 'Die Zahl im Feld sagt, wie viele der vier Kanten rundherum zur Schlaufe gehören.',
    tut3: 'Ein Weg',
    tut3t: 'Die Linie kreuzt sich nicht und hat keine Abzweigung. Leere Felder lassen die Zahl offen.',
  },
  en: {
    title: 'Loop',
    tagline: 'One loop, the numbers count the edges',
    level: 'Level',
    go: 'Tap an edge on or off',
    win: 'The loop is closed',
    hint: 'One edge is corrected',
    none: 'Nothing left to show',
    tut1: 'Tap an edge',
    tut1t: 'Each edge between two dots is on or off. Together they form a single loop.',
    tut2: 'The number',
    tut2t: 'The number in a square tells how many of the four edges around it belong to the loop.',
    tut3: 'One path',
    tut3t: 'The line does not cross itself and has no branch. An empty square leaves the number open.',
  },
});
