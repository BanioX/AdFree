// Zusätzliche Icons für Sudoku (gleicher Stil wie shared/ui.js: 24er-Raster, runde Linien).
import { icon as sharedIcon } from '../../shared/ui.js';

const P = {
  pencil: '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 0l.2.2a2.1 2.1 0 0 1 0 3L8.7 18.5z"/><path d="M13.8 7l3.2 3.2"/>',
  eraser: '<path d="M9 19.5h10.5"/><path d="M5.2 14.6l8.9-8.9a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8L12 18.2a4 4 0 0 1-2.8 1.3H8.4a2 2 0 0 1-1.4-.6l-1.8-1.8a1.8 1.8 0 0 1 0-2.5z"/><path d="M9.5 10.3l4.9 4.9"/>',
  wand: '<path d="M5 19L15.5 8.5"/><path d="M14 7l3 3"/><path d="M18 3.5v3M16.5 5h3M20 11v2M19 12h2M10 3.5v2M9 4.5h2"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.8V12l2.8 1.8"/>',
  chart: '<path d="M5 19.5V11M10 19.5V5.5M15 19.5v-6M20 19.5V9"/>',
  help: '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><path d="M12 16.9v.1"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  palette: '<path d="M12 3.8a8.2 8.2 0 1 0 0 16.4c1.2 0 1.6-.9 1.1-1.8-.6-1-.1-2.3 1.2-2.3H17a3.2 3.2 0 0 0 3.2-3.3c0-5-3.7-9-8.2-9z"/><circle cx="8" cy="11" r="1.1"/><circle cx="11" cy="7.8" r="1.1"/><circle cx="15.2" cy="8.6" r="1.1"/>',
  flame: '<path d="M12 21c-3.6 0-6.2-2.5-6.2-5.9 0-3.3 2.6-5.1 3.4-8.6 2 1.1 3 2.9 3.1 4.6.9-.8 1.5-2 1.6-3.3 2.4 1.8 4.3 4.4 4.3 7.3 0 3.4-2.6 5.9-6.2 5.9z"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H5.2a2.8 2.8 0 0 0 3 3.6M16 6.5h2.8a2.8 2.8 0 0 1-3 3.6"/><path d="M12 13.5v3.5M8.5 20h7M10 17h4v3h-4z"/>',
  target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" />',
  heartbreak: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z"/><path d="M12 7.5l-1.5 4 3 1.5-1.5 4"/>',
};

export function icon(name, opts = {}) {
  if (!P[name]) return sharedIcon(name, opts);
  const size = opts.size || 24;
  const sw = opts.stroke || 2.1;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}
