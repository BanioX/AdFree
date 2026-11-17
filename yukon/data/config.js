// Yukon – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#3a6fb0';

/** Varianten (Segment-Schalter im Startbildschirm). suit: Bauen nur in gleicher Farbe. */
export const MODES = [
  { id: 'klassisch', label: 'Klassisch', sub: 'Rot auf Schwarz', suit: false },
  { id: 'russisch', label: 'Russisch', sub: 'Gleiche Farbe · knifflig', suit: true },
];

/** Tagesspiel: immer in dieser Variante, garantiert lösbar. */
export const DAILY_MODE = 'klassisch';

/** Suchbudget des Lösers (Knoten) beim Prüfen einer neuen Austeilung. */
export const GEN_NODES = 6000;

/** Höchstens so viele Seeds pro Spielnummer durchprobieren. */
export const GEN_TRIES = 400;

export const CONFETTI = ['#3a6fb0', '#8fb8ea', '#ffd23f', '#ffffff', '#e2475b', '#7fd0c4'];
