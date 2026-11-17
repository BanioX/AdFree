// Bäckerdutzend – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#a8792a';

/** Varianten. free: leere Stapel dürfen mit jeder Karte belegt werden. */
export const MODES = [
  { id: 'klassisch', label: 'Klassisch', sub: 'Leere Stapel bleiben leer', free: false },
  { id: 'leicht', label: 'Leicht', sub: 'Leere Stapel frei belegbar', free: true },
];

export const DAILY_MODE = 'klassisch';

/** Suchbudget (Knoten) beim Prüfen einer neuen Austeilung. */
export const GEN_NODES = 5000;
export const GEN_TRIES = 300;

export const CONFETTI = ['#a8792a', '#f2d49b', '#ffd23f', '#ffffff', '#e2475b', '#7fbf6a'];
