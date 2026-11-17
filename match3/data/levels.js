// Die ersten 20 Level von Juwelen – von Hand gebaut. Ab Level 21 erzeugt levels.js
// die Level automatisch aus der Levelnummer (endlos).
//
// Karte (map): eine Zeichenkette pro Zeile, alle gleich lang, höchstens 9×9.
//   '.' normale Zelle      '-' Loch (keine Zelle; Juwelen fallen hindurch)
//   'i' Eis (1 Schicht)    'I' dickes Eis (2 Schichten)
//   's' Stein (1 Treffer)  'S' harter Stein (2 Treffer)
//   'a' Eichel (Startposition)
//
// colors: Anzahl Juwelenarten (3–6). Weniger Farben = leichter.
// moves:  Anzahl Züge.
// goals:  Liste der Ziele:
//   { type: 'score', n: 3000 }          Punkte erreichen
//   { type: 'color', color: 0, n: 20 }  Juwelen einer Farbe sammeln (0 Herz, 1 Bernstein,
//                                        2 Stern, 3 Smaragd, 4 Saphir, 5 Amethyst)
//   { type: 'ice' }                     alles Eis schmelzen
//   { type: 'stone' }                   alle Steine zerbrechen
//   { type: 'item', n: 3 }              n Eicheln nach unten bringen
// itemsMax: wie viele Eicheln gleichzeitig auf dem Brett sein dürfen (Standard 2).
// stars: optional [0, Punkte für 2 Sterne, Punkte für 3 Sterne] – sonst misst der Test-Spieler sie
//        automatisch. Die Werte hier sind gemessen und für die ersten Level bewusst grosszügig;
//        der Test «Sterne» prüft, dass der Test-Spieler meistens mindestens 2 Sterne holt.
// tip:   optional, kurzer Hinweis beim Levelstart.

export const levels = [
  { // 1
    map: [
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ],
    colors: 4, moves: 15, stars: [0, 8000, 13000],
    goals: [{ type: 'color', color: 0, n: 35 }],
    tip: 'Wische ein Juwel auf ein Nachbarfeld. Drei gleiche in einer Reihe verschwinden!',
  },
  { // 2
    map: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    colors: 4, moves: 12, stars: [0, 16000, 24000],
    goals: [{ type: 'score', n: 14000 }],
    tip: 'Fallen neue Juwelen in eine Reihe, gibt es eine Kettenreaktion – und mehr Punkte.',
  },
  { // 3
    map: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    colors: 5, moves: 16, stars: [0, 7500, 11500],
    goals: [{ type: 'color', color: 4, n: 24 }, { type: 'color', color: 3, n: 24 }],
    tip: 'Vier in einer Reihe ergeben ein Blitz-Juwel. Es räumt die ganze Reihe ab.',
  },
  { // 4
    map: [
      '-.......-',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '-.......-',
    ],
    colors: 5, moves: 15, stars: [0, 13000, 17000],
    goals: [{ type: 'score', n: 8000 }],
    tip: 'Eine L- oder T-Form ergibt eine Bombe. Sie sprengt alles rundherum.',
  },
  { // 5
    map: [
      '........',
      '........',
      '..iiii..',
      '..iiii..',
      '..iiii..',
      '..iiii..',
      '........',
      '........',
    ],
    colors: 5, moves: 16, stars: [0, 6500, 9500],
    goals: [{ type: 'ice' }],
  },
  { // 6
    map: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    colors: 5, moves: 24, stars: [0, 14000, 19500],
    goals: [{ type: 'color', color: 2, n: 35 }, { type: 'color', color: 0, n: 35 }],
    tip: 'Fünf in einer Reihe ergeben ein Regenbogen-Juwel. Tausche es mit einem Juwel – alle dieser Farbe verschwinden!',
  },
  { // 7
    map: [
      '--iiiii--',
      '-i.....i-',
      'i.......i',
      'i.......i',
      'i.......i',
      'i.......i',
      'i.......i',
      '-i.....i-',
      '--iiiii--',
    ],
    colors: 5, moves: 26, stars: [0, 13000, 22000],
    goals: [{ type: 'ice' }],
  },
  { // 8
    map: [
      '........',
      '.iiiiii.',
      '.iIIIIi.',
      '.iI..Ii.',
      '.iI..Ii.',
      '.iIIIIi.',
      '.iiiiii.',
      '........',
    ],
    colors: 5, moves: 24, stars: [0, 14500, 18500],
    goals: [{ type: 'ice' }],
    tip: 'Dickes Eis braucht zwei Treffer. Sonderjuwelen helfen sehr!',
  },
  { // 9
    map: [
      '.........',
      '.........',
      '-.......-',
      '--.....--',
      '---...---',
      '--.....--',
      '-.......-',
      '.........',
      '.........',
    ],
    colors: 5, moves: 22, stars: [0, 8500, 14000],
    goals: [{ type: 'color', color: 2, n: 22 }, { type: 'color', color: 1, n: 22 }],
  },
  { // 10
    map: [
      '--..i..--',
      '--..i..--',
      '....i....',
      '...III...',
      'iiiIIIiii',
      '...III...',
      '....i....',
      '--..i..--',
      '--..i..--',
    ],
    colors: 5, moves: 26, stars: [0, 11000, 16500],
    goals: [{ type: 'ice' }],
  },
  { // 11
    map: [
      '...a....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    colors: 4, moves: 16, stars: [0, 18000, 35000],
    goals: [{ type: 'item', n: 3 }],
  },
  { // 12
    map: [
      '..a..a..',
      '........',
      '........',
      '...--...',
      '...--...',
      '........',
      '........',
      '........',
    ],
    colors: 5, moves: 34, stars: [0, 9000, 14000],
    goals: [{ type: 'item', n: 3 }],
    tip: 'Eicheln fallen auch durch Lücken im Brett.',
  },
  { // 13
    map: [
      '........',
      '........',
      'ii....ii',
      'ii....ii',
      'ii....ii',
      'ii....ii',
      '........',
      '........',
    ],
    colors: 5, moves: 24, stars: [0, 8000, 13000],
    goals: [{ type: 'ice' }, { type: 'color', color: 3, n: 20 }],
  },
  { // 14
    map: [
      '---...---',
      '--.....--',
      '-...i...-',
      '...iIi...',
      '..iIIIi..',
      '...iIi...',
      '-...i...-',
      '--.....--',
      '---...---',
    ],
    colors: 5, moves: 18, stars: [0, 8000, 12000],
    goals: [{ type: 'ice' }],
  },
  { // 15
    map: [
      '...a.a...',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'iiiiiiiii',
      '.........',
    ],
    colors: 5, moves: 36, stars: [0, 17000, 22000],
    goals: [{ type: 'item', n: 3 }, { type: 'ice' }],
    itemsMax: 3,
  },
  { // 16
    map: [
      '........',
      '........',
      's.ss.ss.',
      '........',
      '........',
      '.ss.ss.s',
      '........',
      '........',
    ],
    colors: 5, moves: 12, stars: [0, 5000, 7500],
    goals: [{ type: 'stone' }],
  },
  { // 17
    map: [
      '.........',
      '.S.....S.',
      '..S...S..',
      '.........',
      '.S..S..S.',
      '.........',
      '..S...S..',
      '.S.....S.',
      '.........',
    ],
    colors: 5, moves: 20, stars: [0, 12500, 18500],
    goals: [{ type: 'stone' }],
    tip: 'Dunkle Steine sind hart und brauchen zwei Treffer.',
  },
  { // 18
    map: [
      '.........',
      '.iiiiiii.',
      '.i.....i.',
      '.i.s.s.i.',
      '.i..s..i.',
      '.i.s.s.i.',
      '.i.....i.',
      '.iiiiiii.',
      '.........',
    ],
    colors: 5, moves: 24, stars: [0, 14500, 20500],
    goals: [{ type: 'stone' }, { type: 'ice' }],
  },
  { // 19
    map: [
      '..a...a..',
      '.........',
      '.........',
      '.........',
      's.ss.ss.s',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    colors: 5, moves: 26, stars: [0, 14000, 24500],
    goals: [{ type: 'item', n: 3 }, { type: 'stone' }],
  },
  { // 20
    map: [
      '-...-...-',
      '.IIi.iII.',
      '.IIiiiII.',
      '.iiiiiii.',
      '..iiiii..',
      '-..iii..-',
      '--..i..--',
      '---...---',
      '----.----',
    ],
    colors: 5, moves: 26, stars: [0, 11500, 15000],
    goals: [{ type: 'ice' }, { type: 'color', color: 0, n: 30 }],
    tip: 'Ein Herz für dich! Schmilz das ganze Eis.',
  },
];
