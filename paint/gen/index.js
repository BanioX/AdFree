// Farbenzauber – Generatoren und Foto-Umwandlung.
//
//   import { generators, photoToPuzzle } from './gen/index.js';
//   const puzzle = generators[0].make(7);                // deterministisch pro Seed
//   const mine = await photoToPuzzle(file, { colors: 16, detail: 'mittel', onProgress, signal });
//
// Die Algorithmen liegen als reine Module (ohne DOM) in ./core/ und sind in Node testbar.

import { makeMandala } from './core/mandala.js';
import { makeLowPoly } from './core/lowpoly.js';
import { makeGlass } from './core/glass.js';

export const generators = [
  { id: 'mandala', title: 'Mandala', category: 'Mandalas', make: (seed) => makeMandala(seed) },
  { id: 'glas', title: 'Buntglas', category: 'Buntglas', make: (seed) => makeGlass(seed) },
  { id: 'polygon', title: 'Low Poly', category: 'Low Poly', make: (seed) => makeLowPoly(seed) },
];

export { photoToPuzzle } from './photo.js';
