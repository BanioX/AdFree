// Schwierigkeitsstufen der Wortsuche.
//
//   sizes      mögliche Rastergrössen (eine wird pro Rätsel zufällig gewählt)
//   words      Anzahl Wörter passend zu sizes (gleiche Position)
//   dirs       erlaubte Richtungen: E → · S ↓ · SE ↘ · NE ↗ · W ← · N ↑ · NW ↖ · SW ↙
//   decoys     Anzahl «Lockvögel»: Wortanfänge, die irgendwo im Raster auftauchen
//   overlap    0..1 – wie gerne Wörter sich kreuzen (gemeinsame Buchstaben)
//   secPerWord Richtzeit pro Wort in Sekunden (für die Sterne)
//
// Neue Stufe? Einfach ein weiteres Objekt anhängen – Menü und Statistik passen sich an.

export const modes = [
  {
    id: 'leicht',
    title: 'Leicht',
    sizes: [8],
    words: [8],
    dirs: ['E', 'S'],
    decoys: 1,
    overlap: 0.2,
    secPerWord: 12,
    info: '8×8 · 8 Wörter',
    dirInfo: 'nur → und ↓',
  },
  {
    id: 'mittel',
    title: 'Mittel',
    sizes: [10],
    words: [12],
    dirs: ['E', 'S', 'SE', 'NE'],
    decoys: 3,
    overlap: 0.35,
    secPerWord: 15,
    info: '10×10 · 12 Wörter',
    dirInfo: '→ ↓ und diagonal',
  },
  {
    id: 'schwer',
    title: 'Schwer',
    sizes: [12, 13, 14],
    words: [16, 17, 18],
    dirs: ['E', 'S', 'SE', 'NE', 'W', 'N', 'NW', 'SW'],
    decoys: 6,
    overlap: 0.5,
    secPerWord: 20,
    info: '12×12 bis 14×14 · 16–18 Wörter',
    dirInfo: 'alle Richtungen, auch rückwärts',
  },
];

/** Das Tagesrätsel verwendet diese Stufe. */
export const DAILY_MODE = 'mittel';
