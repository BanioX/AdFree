// Lädt die Wortlisten einer Wortlänge (lazy) und bereitet sie auf.
// Die Daten liegen in ./data/ (siehe CONTENT.md).

import { parseWordList } from './logic.js';

const FILES = {
  4: { answers: () => import('./data/answers4.js'), allowed: () => import('./data/allowed4.js') },
  5: { answers: () => import('./data/answers.js'), allowed: () => import('./data/allowed.js') },
  6: { answers: () => import('./data/answers6.js'), allowed: () => import('./data/allowed6.js') },
};

const cache = new Map();

/** → Promise<{ len, answers: string[], allowed: Set<string> }> */
export function loadWords(len) {
  if (!FILES[len]) return Promise.reject(new Error('Unbekannte Wortlänge ' + len));
  if (!cache.has(len)) {
    const p = Promise.all([FILES[len].answers(), FILES[len].allowed()]).then(([a, b]) => {
      const answers = parseWordList(a.default, len);
      const allowed = new Set(parseWordList(b.default, len));
      for (const w of answers) allowed.add(w);
      return { len, answers, allowed };
    });
    p.catch(() => cache.delete(len));
    cache.set(len, p);
  }
  return cache.get(len);
}
