// Farbfluss – Level-Inhalte.
//
// Alle Level ausser den handgemachten werden aus der Levelnummer erzeugt (immer gleich,
// für alle gleich) und vom Löser geprüft. Hier wird nur festgelegt, WIE schwer sie sind.
// Anleitung zum Erweitern: siehe ../CONTENT.md

/**
 * Schwierigkeitskurve. Ein Eintrag gilt ab Level `from` bis zum nächsten Eintrag.
 *   colors   Anzahl Farben (je 4 Schichten) – plus 2 leere Gläser
 *   minMoves Lösung muss mindestens so viele Züge brauchen (sonst wird neu gewürfelt)
 */
export const ramp = [
  { from: 2, colors: 3, minMoves: 9 },
  { from: 4, colors: 4, minMoves: 12 },
  { from: 7, colors: 5, minMoves: 15 },
  { from: 11, colors: 6, minMoves: 18 },
  { from: 16, colors: 7, minMoves: 21 },
  { from: 22, colors: 8, minMoves: 24 },
  { from: 29, colors: 9, minMoves: 27 },
  { from: 38, colors: 10, minMoves: 30 },
  { from: 49, colors: 11, minMoves: 33 },
  { from: 63, colors: 12, minMoves: 35 },
  { from: 81, colors: 13, minMoves: 38 },
  { from: 101, colors: 14, minMoves: 41 },
];

/**
 * Ab diesem Level wiederholt sich ein abwechslungsreiches Muster (Verschnaufpausen inklusive),
 * damit es nie langweilig und nie zu streng wird. Unendlich viele Level.
 */
export const endless = {
  from: 121,
  colors: [10, 11, 12, 13, 11, 12, 14, 10, 12, 13, 9, 12],
};

/** Mindestzüge je Farbanzahl (für endless und Tagesrätsel). */
export const minMovesFor = {
  2: 3, 3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 24, 9: 27, 10: 30, 11: 33, 12: 35, 13: 38, 14: 41,
};

/**
 * Besondere Level.
 *   geheimnis: verdeckte Schichten («?»), die erst sichtbar werden, wenn sie oben liegen.
 *   gross:     einige Gläser fassen 5 oder 6 Schichten.
 * Ein Level hat die Eigenschaft, wenn n >= from und (n - from) % every === 0.
 */
export const features = {
  geheimnis: { from: 20, every: 5, colorDelta: -1 },
  gross: { from: 12, every: 6 },
};

/**
 * Handgemachte Level (haben Vorrang vor dem Generator).
 * Gläser als Texte von UNTEN nach OBEN, ein Buchstabe pro Schicht ('' = leeres Glas).
 * Optional mit Fassungsvermögen davor: '6:abcabc'. Buchstabe a = erste Farbe in `colors` usw.
 * colors: ids aus data/colors.js. hidden: true für ein Geheimnis-Level.
 */
export const handmade = {
  1: {
    colors: ['rot', 'blau'],
    tubes: ['aabb', 'bbaa', ''],
    tutorial: true,
  },
};
