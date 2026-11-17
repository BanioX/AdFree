// Skorpion – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#b0452f';

/** Varianten. open: alle Karten offen (sonst je 3 verdeckt in den ersten vier Spalten). */
export const MODES = [
  { id: 'leicht', label: 'Offen', sub: 'Alle Karten sichtbar', open: true },
  { id: 'klassisch', label: 'Klassisch', sub: 'Mit verdeckten Karten', open: false },
];

export const DAILY_MODE = 'leicht';

/** Suchbudget (Knoten) beim Prüfen einer neuen Austeilung – lösbare Spiele findet der Löser fast immer in < 300. */
export const GEN_NODES = 1500;
export const GEN_TRIES = 600;

export const CONFETTI = ['#b0452f', '#f0a98f', '#ffd23f', '#ffffff', '#3a6fb0', '#2f9e6e'];
