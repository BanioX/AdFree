// Gipfel – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#2e8bc9';

/** Modi: mit oder ohne Umlauf (König ↔ Ass). */
export const MODES = [
  { id: 'leicht', label: 'Leicht', sub: 'König ↔ Ass', wrap: true },
  { id: 'normal', label: 'Normal', sub: 'ohne Umlauf', wrap: false },
];

/** Tagesrätsel: immer in diesem Modus, garantiert lösbar. */
export const DAILY_MODE = 'leicht';

export const PRAISE = ['Alle Gipfel bezwungen!', 'Gipfelglück!', 'Wunderbar!', 'Grossartig!', 'Was für eine Serie!'];

export const CONFETTI = ['#2e8bc9', '#9fd3f5', '#ffd23f', '#ff7a8a', '#ffffff', '#5fd0a0'];

/** Texte für Serien-Meilensteine */
export const STREAK_WORDS = { 5: 'Schön!', 8: 'Super!', 12: 'Fantastisch!', 16: 'Unglaublich!' };
