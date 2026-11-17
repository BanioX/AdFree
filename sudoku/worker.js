// Hintergrund-Generator: erzeugt neue Rätsel, ohne die Oberfläche zu blockieren.
// Nachricht: { id, diff, seed } -> Antwort: { id, result: { puzzle, solution, tier, score, givens } }
import { generate } from './logic/generator.js';
import { difficultyById } from './data/difficulties.js';

self.onmessage = (e) => {
  const { id, diff, seed } = e.data || {};
  let result = null;
  try {
    result = generate(difficultyById(diff), String(seed));
  } catch {
    result = null;
  }
  self.postMessage({ id, result });
};
