// Pyramide – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#7a5cc4';

/** Schwierigkeiten: wie oft der Ablagestapel neu ausgelegt werden darf. */
export const MODES = [
  { id: 'leicht', label: 'Leicht', sub: '3× neu auslegen', redeals: 3 },
  { id: 'normal', label: 'Normal', sub: '1× neu auslegen', redeals: 1 },
];

/** Das Tagesrätsel wird immer in diesem Modus gespielt (und ist garantiert lösbar). */
export const DAILY_MODE = 'normal';

/** Überschriften im Gewinnblatt (zufällig). */
export const PRAISE = [
  'Pyramide abgeräumt!',
  'Wunderbar!',
  'Meisterhaft!',
  'Schön gespielt!',
  'Alles weg!',
  'Grossartig!',
];

/** Konfettifarben */
export const CONFETTI = ['#7a5cc4', '#b9a5ee', '#ffd23f', '#ff7a8a', '#ffffff', '#f2c14e'];

/** Paare mit Summe 13 – für Tutorial und Regelblatt */
export const PAIRS = [[1, 12], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
