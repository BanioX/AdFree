// Golf-Patience – Inhalte und Einstellungen (siehe CONTENT.md).

export const ACCENT = '#4c9a52';

/** Modi: mit oder ohne Umlauf (König ↔ Ass). */
export const MODES = [
  { id: 'leicht', label: 'Leicht', sub: 'König ↔ Ass', wrap: true },
  { id: 'normal', label: 'Klassisch', sub: 'ohne Umlauf', wrap: false },
];

/** Löcher pro Runde */
export const HOLES = 9;

/** Loch des Tages: immer in diesem Modus, garantiert abräumbar. */
export const DAILY_MODE = 'leicht';

export const CONFETTI = ['#4c9a52', '#a6dca0', '#ffd23f', '#ffffff', '#ff9f6e', '#7cc0ff'];

/** Überschrift nach einer Runde, je nach Ergebnis relativ zum Par */
export function roundTitle(diff) {
  if (diff <= -5) return 'Traumrunde!';
  if (diff < 0) return 'Unter Par!';
  if (diff === 0) return 'Genau Par!';
  return 'Runde beendet';
}
