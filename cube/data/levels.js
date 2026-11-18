// Pfeilwürfel – Inhalte: Level-Rampe, Spezial-Level und Kapitel-Themen.
// Die Level selbst werden prozedural erzeugt (generator.js); hier steht nur, WIE sie aussehen.
// Format und Regeln: siehe ../CONTENT.md. Nach Änderungen: node --test cube/tests/

/** Würfelgrösse N (Zellen pro Seitenkante) nach Levelnummer: bis und mit `to` gilt `N`. */
export const SIZES = [
  { to: 2, N: 3 },
  { to: 5, N: 4 },
  { to: 10, N: 5 },
  { to: 18, N: 6 },
  { to: 28, N: 7 },
  { to: 40, N: 8 },
  { to: 55, N: 9 },
];

/** Danach: Grösse pro Level zufällig (deterministisch) aus dieser Liste. */
export const LATE_SIZES = [10, 10, 10, 9, 10, 8, 10, 9];

/** Herzen nach Würfelgrösse (erste Zeile mit N <= maxN gilt). Immer 3–5. */
export const HEARTS = [
  { maxN: 5, hearts: 3 },
  { maxN: 8, hearts: 4 },
  { maxN: 99, hearts: 5 },
];

/** Jedes wievielte Level ein Spezial-Level ist. */
export const SPECIAL_EVERY = 10;

/**
 * Spezial-Level, der Reihe nach (Level 10 = erstes, 20 = zweites, …, dann von vorn).
 * Texte (Deutsch + Englisch mit `_en`): `title`/`title_en` Name, `text`/`text_en` erscheint zu Beginn des Levels; `textMax` (optional) statt dessen, wenn der Würfel
 * schon die Höchstgrösse 10 hat und `grow` darum nichts mehr bewirkt.
 * Mögliche Regler (alle optional):
 *   grow        Würfel um so viele Zellen grösser (max. 10)
 *   maxN        Würfel höchstens so gross
 *   density     Dichte (Anteil belegter Zellen) zusätzlich: +/- Wert
 *   maxDensity  Dichte höchstens
 *   hearts      Herzen zusätzlich: +/- Wert (Ergebnis bleibt 3–5)
 *   minLen      kürzeste Pfeillänge (Zellen)
 *   maxLen      längste Pfeillänge zusätzlich: +/- Wert (Ergebnis max. 12)
 *   turn        Abbiege-Freude 0..1 (fester Wert)
 *   maxTurns    höchstens so viele Kurven pro Pfeil (0 = nur gerade; über Kanten gerade weiter zählt nicht)
 *   mustCross   true = jeder Pfeil muss über eine Würfelkante laufen
 */
export const SPECIALS = [
  {
    id: 'edges', title: 'Kantenlauf', emoji: '📐',
    text: 'Jeder Pfeil läuft über eine Kante.',
    title_en: 'Edge Runner', text_en: 'Every arrow runs over an edge.',
    maxN: 7, maxDensity: 0.8, mustCross: true,
  },
  {
    id: 'big', title: 'Riesenwürfel', emoji: '🧊',
    text: 'Ein Stück grösser und dicht gepackt.',
    textMax: 'Volle Grösse, extra dicht – mit einem Herz weniger.',
    title_en: 'Giant Cube', text_en: 'A size bigger and tightly packed.',
    textMax_en: 'Full size, extra dense – and one heart fewer.',
    grow: 1, density: 0.04, hearts: -1,
  },
  {
    id: 'long', title: 'Lange Schlangen', emoji: '🐍',
    text: 'Wenige, aber sehr lange Pfeile.',
    title_en: 'Long Snakes', text_en: 'Only a few arrows, but very long ones.',
    minLen: 5, maxLen: 4, turn: 0.45, maxN: 8,
  },
  {
    id: 'twisty', title: 'Kringel', emoji: '🌀',
    text: 'Die Pfeile winden sich in vielen Kurven.',
    title_en: 'Twists', text_en: 'The arrows wind through lots of turns.',
    turn: 0.85, minLen: 3, maxLen: 1,
  },
  {
    id: 'straight', title: 'Gerade Wege', emoji: '📏',
    text: 'Fast nur gerade Pfeile – aber dicht an dicht.',
    title_en: 'Straight Paths', text_en: 'Almost only straight arrows – packed side by side.',
    turn: 0.04, maxTurns: 0, density: 0.05, minLen: 3,
  },
];

/** Kapitel: alle 10 Level ein neues Papier (dann wieder von vorn). Farben als #rrggbb. */
export const CHAPTER_SIZE = 10;
export const THEMES = [
  { id: 'pergament', name: 'Pergament', name_en: 'Parchment', light: '#fffbf3', dark: '#e9d6b6', edge: '#e2cfae', ink: '#4a3418', hint: '#2f7de1' },
  { id: 'salbei', name: 'Salbei', name_en: 'Sage', light: '#f8fbf2', dark: '#cfdfc0', edge: '#c8d9b8', ink: '#2f3f24', hint: '#e0702a' },
  { id: 'rosenholz', name: 'Rosenholz', name_en: 'Rosewood', light: '#fff8f5', dark: '#efcfc6', edge: '#e8c3b8', ink: '#55282b', hint: '#2f7de1' },
  { id: 'himmel', name: 'Himmel', name_en: 'Sky', light: '#f7fbff', dark: '#c9dcef', edge: '#bed4ea', ink: '#22344d', hint: '#e0702a' },
  { id: 'honig', name: 'Honig', name_en: 'Honey', light: '#fffaea', dark: '#f1d391', edge: '#ecc97e', ink: '#4b300c', hint: '#2f7de1' },
  { id: 'lavendel', name: 'Lavendel', name_en: 'Lavender', light: '#fbf8ff', dark: '#d9cfee', edge: '#cfc3e8', ink: '#352651', hint: '#e0702a' },
  { id: 'minze', name: 'Minze', name_en: 'Mint', light: '#f4fcf9', dark: '#bfe3d6', edge: '#b2dccd', ink: '#1f3d35', hint: '#e0702a' },
  { id: 'sand', name: 'Sand', name_en: 'Sand', light: '#fdf9f1', dark: '#e3d3b8', edge: '#dac8aa', ink: '#3e3426', hint: '#2f7de1' },
];

/** Freundliche Sätze für das Gewinn-Blatt (zufällig gewählt, nach Sternen). PRAISE_EN = Englisch. */
export const PRAISE = {
  3: ['Ohne einen einzigen Fehler!', 'Makellos!', 'Perfekt gelöst!', 'Wie ein Profi!'],
  2: ['Nur ein Fehler – stark!', 'Fast perfekt!', 'Sehr schön gemacht!'],
  1: ['Geschafft – weiter so!', 'Gelöst! Das nächste wird noch besser.', 'Alle Pfeile sind draussen!'],
};
export const PRAISE_EN = {
  3: ['Not a single mistake!', 'Flawless!', 'Perfectly solved!', 'Like a pro!'],
  2: ['Just one slip – well done!', 'Almost perfect!', 'Very nicely done!'],
  1: ['Done it – keep going!', 'Solved! The next one will go even better.', 'Every arrow is out!'],
};
