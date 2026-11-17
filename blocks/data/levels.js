// Abenteuer-Level.
//
// Die ersten Level sind von Hand gemacht (Liste `handcrafted`), danach erzeugt der Generator
// (core/levels.js) unendlich viele weitere aus einem Seed – immer gleich für alle.
//
// Format eines handgemachten Levels:
//   title   kurzer Name
//   size    8 oder 10 (Brettgrösse)
//   board   Zeilen von oben nach unten:
//             '.' leer, '1'–'8' Stein (Farbe 1–8), 'r' 'b' 'g' 'y' 'p' Stein mit Edelstein
//             (Rubin, Saphir, Smaragd, Topas, Amethyst)
//   cover   optional: 'all' oder Zeilen mit 'x' = verdecktes Feld (für Bild-Ziele)
//   goals   { gems: true }        alle Edelsteine sammeln
//           { picture: 'id' }     alle verdeckten Felder aufdecken (Bild aus pictures.js)
//           { lines: 6 }          so viele Linien abräumen
//           { score: 500 }        so viele Punkte erreichen
//           (mehrere Ziele kombinierbar)
//   start   optional: die ersten drei Teile als Zeichnung, Zeilen mit '|' getrennt, z.B. '##|#.'
//   d       Schwierigkeit der Teile 0 (klein) … 1 (gross), Standard 0.2
//
// Die Tests prüfen jedes Level: keine vollen Linien am Anfang, Edelsteine nur auf Steinen,
// und der Computer-Spieler kann es lösen. Die Sterne-Grenzen werden automatisch berechnet.

export const handcrafted = [
  {
    title: 'Funkelnde Steine',
    size: 8,
    board: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '6r6666..',
      '666r66..',
    ],
    goals: { gems: true },
    start: ['##|##', '###', '#|#'],
    d: 0,
  },
  {
    title: 'Lücken füllen',
    size: 8,
    board: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '44.444.4',
      '........',
      '22222.22',
    ],
    goals: { lines: 4 },
    start: ['#', '#', '#'],
    d: 0,
  },
  {
    title: 'Auch Spalten zählen',
    size: 8,
    board: [
      'r......b',
      '1......6',
      '1......6',
      '1......6',
      'r......b',
      '1......6',
      '........',
      '........',
    ],
    goals: { gems: true },
    start: ['#|#', '#|#', '##'],
    d: 0.05,
  },
  {
    title: 'Punktejagd',
    size: 8,
    board: [
      '........',
      '........',
      '........',
      '...77...',
      '..7777..',
      '...77...',
      '........',
      '........',
    ],
    goals: { score: 250 },
    d: 0.1,
  },
  {
    title: 'Was ist darunter?',
    size: 8,
    board: [
      '........',
      '........',
      '........',
      '........',
      '33.33333',
      '........',
      '.5555555',
      '........',
    ],
    cover: [
      '........',
      '........',
      '........',
      '........',
      'xxxxxxxx',
      'xxxxxxxx',
      'xxxxxxxx',
      'xxxxxxxx',
    ],
    goals: { picture: 'erdbeere' },
    start: ['#', '#', '###'],
    d: 0.1,
  },
  {
    title: 'Zwei Farben',
    size: 8,
    board: [
      '........',
      '.r....b.',
      '........',
      '...22...',
      '...22...',
      '........',
      '.b....r.',
      '........',
    ],
    goals: { gems: true },
    d: 0.15,
  },
  {
    title: 'Säulenhalle',
    size: 8,
    board: [
      '........',
      '........',
      '.5....5.',
      '.5....5.',
      '.5....5.',
      '.5.88.5.',
      '.5.88.5.',
      '.5.88.5.',
    ],
    goals: { lines: 6 },
    d: 0.2,
  },
  {
    title: 'Kätzchen',
    size: 8,
    board: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    cover: 'all',
    goals: { picture: 'kaetzchen' },
    d: 0.2,
  },
  {
    title: 'Vier Ecken',
    size: 8,
    board: [
      '33....33',
      '3......3',
      '........',
      '........',
      '........',
      '........',
      '3......3',
      '33....33',
    ],
    goals: { score: 500 },
    d: 0.25,
  },
  {
    title: 'Schatzkammer',
    size: 8,
    board: [
      '..g..g..',
      '........',
      'r.3333.r',
      '..3bb3..',
      '..3bb3..',
      'r.3333.r',
      '........',
      '..g..g..',
    ],
    goals: { gems: true },
    d: 0.25,
  },
];

// Ablauf der Ziele innerhalb jeder Welt (20 Level) für die erzeugten Level.
// 'gems' Edelsteine, 'picture' Bild aufdecken, 'lines' Linien, 'score' Punkte.
export const cycle = [
  'gems', 'picture', 'lines', 'gems', 'score',
  'picture', 'gems', 'lines', 'picture', 'gems',
  'score', 'picture', 'gems', 'lines', 'picture',
  'gems', 'score', 'picture', 'gems', 'gems',
];

// Schwierigkeitskurve der erzeugten Level.
export const curve = {
  start: 0.12,        // Schwierigkeit bei Level 11
  end: 0.9,           // Schwierigkeit bei Level 240 (danach bleibt sie dort)
  endLevel: 240,
  wave: 0.1,          // innerhalb einer Welt: am Anfang leichter, gegen Ende schwerer
  bigBoardFrom: 25,   // ab diesem Level ist jedes 5. Level ein 10×10-Brett
};
