// Farbenzauber – Inhalte und Einstellungen, die man ohne Engine-Kenntnisse erweitern kann.
// Anleitung: ../CONTENT.md

/**
 * Reihenfolge der Kategorien in Galerie und Chips. Unbekannte Kategorien (z.B. neue Bilder mit
 * category: 'Ozean') erscheinen automatisch hinten – hier eintragen, um sie weiter vorne zu zeigen.
 */
export const CATEGORY_ORDER = [
  'Blumen', 'Tiere', 'Landschaften', 'Essen', 'Fantasie', 'Winter',
  'Mandalas', 'Muster', 'Buntglas', 'Low Poly',
];

/**
 * Generator-Bilder, die immer in der Galerie stehen: Seeds pro Generator-id (siehe gen/index.js).
 * Gleicher Seed = gleiches Bild auf jedem Gerät. Mit «Neues erzeugen» kommen zufällige Seeds dazu.
 */
export const GENERATOR_SEEDS = {
  mandala: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  glas: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12],
  polygon: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};
/** Seeds für Generatoren, die oben nicht aufgeführt sind. */
export const DEFAULT_SEEDS = [1, 2, 3, 4, 5, 6];

/** Vorgaben für «Eigenes Foto». */
export const PHOTO_DEFAULTS = { colors: 16, minColors: 8, maxColors: 24, detail: 'mittel' };
