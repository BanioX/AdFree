// Etappen von «Verdoppeln»: Kapitel, Brett-Formen und Ablauf.
//
// Die Etappen werden aus diesen Daten endlos erzeugt (siehe /merge/levelgen.js):
// Kapitel 1 = Etappen 1–12, Kapitel 2 = 13–24 … Nach dem letzten Kapitel geht es
// wieder von vorne los – mit «Runde 2», «Runde 3» … und etwas höheren Zielen.
// Wie man Inhalte ergänzt, steht in /merge/CONTENT.md.

export const LEVELS_PER_CHAPTER = 12;

// Jedes Kapitel hat einen Namen und spielt mit einem Kachel-Stil (id aus data/skins.js).
export const chapters = [
  { id: 'obstgarten', title: 'Obstgarten', skin: 'fruechte', icon: '🍎' },
  { id: 'tierpark', title: 'Tierpark', skin: 'tiere', icon: '🦁' },
  { id: 'konditorei', title: 'Konditorei', skin: 'suesses', icon: '🧁' },
  { id: 'blumenwiese', title: 'Blumenwiese', skin: 'blumen', icon: '🌷' },
  { id: 'sternenhimmel', title: 'Sternenhimmel', skin: 'weltall', icon: '🪐' },
  { id: 'meeresgrund', title: 'Meeresgrund', skin: 'meer', icon: '🐬' },
  { id: 'bauernhof', title: 'Bauernhof', skin: 'bauernhof', icon: '🐄' },
];

// Brett-Formen. Jede Zeile gleich lang, Brett quadratisch (3×3 bis 6×6).
//   '.' freies Feld   'o' Stein (bleibt liegen, blockiert)   'x' Loch (gehört nicht zum Brett)
// maxE: höchste Ziel-Stufe, die auf dieser Form gut machbar ist (8 = 256, 9 = 512, 10 = 1024).
//       Wird von tests/levels.test.mjs mit einem Computer-Spieler überprüft.
export const shapes = [
  { id: 'quadrat3', rows: ['...', '...', '...'], maxE: 7 },

  { id: 'quadrat4', rows: ['....', '....', '....', '....'], maxE: 10 },
  { id: 'eckstein4', rows: ['o...', '....', '....', '....'], maxE: 9 },
  { id: 'mittelstein4', rows: ['....', '.o..', '....', '....'], maxE: 8 },
  { id: 'zweisteine4', rows: ['o...', '....', '....', '...o'], maxE: 8 },
  { id: 'kissen4', rows: ['x..x', '....', '....', 'x..x'], maxE: 8 },

  { id: 'quadrat5', rows: ['.....', '.....', '.....', '.....', '.....'], maxE: 10 },
  { id: 'kissen5', rows: ['x...x', '.....', '.....', '.....', 'x...x'], maxE: 10 },
  { id: 'mittelstein5', rows: ['.....', '.....', '..o..', '.....', '.....'], maxE: 10 },
  { id: 'saeulen5', rows: ['.....', '.o.o.', '.....', '.o.o.', '.....'], maxE: 9 },
  { id: 'eckensteine5', rows: ['o...o', '.....', '.....', '.....', 'o...o'], maxE: 10 },
  { id: 'herz5', rows: ['x.x.x', '.....', '.....', 'x...x', 'xx.xx'], maxE: 9 },

  { id: 'quadrat6', rows: ['......', '......', '......', '......', '......', '......'], maxE: 10 },
  { id: 'achteck6', rows: ['xx..xx', 'x....x', '......', '......', 'x....x', 'xx..xx'], maxE: 10 },
  { id: 'insel6', rows: ['......', '......', '..oo..', '..oo..', '......', '......'], maxE: 10 },
  { id: 'ring6', rows: ['x....x', '......', '..xx..', '..xx..', '......', 'x....x'], maxE: 10 },
  { id: 'saeulen6', rows: ['......', '.o..o.', '......', '......', '.o..o.', '......'], maxE: 10 },
];

// Ablauf eines Kapitels (12 Etappen). Pro Etappe:
//   size     Brettgrösse; die Form wird zufällig (aber fest pro Etappe) aus passenden Formen gewählt
//   shapes   optional: nur diese Formen verwenden
//   slack    wie weit unter maxE das Ziel liegt (2 = leicht, 1 = mittel, 0 = schwer)
//   goal     'tile' (Kachel bilden) oder 'count' (mehrmals eine Kachel bilden)
//   boss     true: Abschluss-Etappe des Kapitels (grösseres Ziel)
export const chapterPlan = [
  { size: 4, slack: 3, goal: 'tile' },
  { size: 3, slack: 1, goal: 'tile' },
  { size: 4, slack: 2, goal: 'count' },
  { size: 5, slack: 3, goal: 'tile' },
  { size: 4, slack: 2, goal: 'tile', shapes: ['eckstein4', 'mittelstein4', 'zweisteine4', 'kissen4'] },
  { size: 5, slack: 2, goal: 'count' },
  { size: 3, slack: 1, goal: 'count' },
  { size: 6, slack: 2, goal: 'tile' },
  { size: 4, slack: 1, goal: 'tile' },
  { size: 5, slack: 2, goal: 'tile', shapes: ['kissen5', 'saeulen5', 'herz5', 'eckensteine5', 'mittelstein5'] },
  { size: 6, slack: 2, goal: 'count' },
  { size: 5, slack: 1, goal: 'tile', boss: true },
];

// Höchste Ziel-Stufe für normale Etappen und Abschluss-Etappen (hält die Dauer angenehm).
export const MAX_TARGET = 9;
export const MAX_BOSS_TARGET = 10;
export const MIN_TARGET = 5;

// Handgemachte Etappen: überschreiben den Generator für genau diese Nummer.
//   shape: id aus shapes, goal: { type: 'tile', value } oder { type: 'count', value, n }
//   tip: kurzer Hinweis zum Start (optional)
export const handmade = {
  1: { shape: 'quadrat4', goal: { type: 'tile', value: 64 }, tip: 'Wische, damit gleiche Kacheln verschmelzen.' },
  2: { shape: 'quadrat4', goal: { type: 'tile', value: 128 }, tip: 'Tipp: Sammle grosse Kacheln in einer Ecke.' },
  3: { shape: 'quadrat3', goal: { type: 'tile', value: 64 }, tip: 'Ein kleines Brett – plane voraus!' },
  4: { shape: 'eckstein4', goal: { type: 'tile', value: 128 }, tip: 'Steine bewegen sich nie. Kacheln rutschen nur bis davor.' },
  5: { shape: 'quadrat5', goal: { type: 'count', value: 32, n: 3 }, tip: 'Bilde die gezeigte Kachel so oft wie verlangt.' },
  6: { shape: 'kissen4', goal: { type: 'tile', value: 128 }, tip: 'Die Ecken fehlen – das Brett ist kleiner.' },
};

// Sterne: 3 Sterne bei höchstens par Zügen, 2 Sterne bei höchstens par2 Zügen.
// par = Ziel-Summe × parFactor / 2.2 (2.2 = mittlerer Wert einer neuen Kachel).
export const stars = { parFactor: 1.32, par2Factor: 1.7, extraMoves: 4 };
