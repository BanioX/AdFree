// Perlenbild – Muster-Bibliothek (eigene Pixelbilder, nach Schwierigkeit sortiert).
//
// Format (siehe DEV.md): { id, title, category, palette: { zeichen: '#rrggbb' }, rows: [...] }
// '.' = keine Perle. Die Daten in small/medium/large/showpieces.js werden von
// tools/build.mjs aus den Quellen in tools/src/ erzeugt; Prüfung mit tools/validate.mjs,
// Kontaktbogen mit tools/contact-sheet.cjs.

import small from './small.js';
import medium from './medium.js';
import large from './large.js';
import showpieces from './showpieces.js';

/** Alle Muster, Reihenfolge = Level-Reihenfolge (Schwierigkeit aufsteigend). */
export const patterns = [...small, ...medium, ...large, ...showpieces];

export const categories = ['Liebe', 'Essen', 'Tiere', 'Natur', 'Dinge', 'Jahreszeiten'];

export default patterns;
