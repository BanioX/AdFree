import { makeRng } from '../shared/rng.js';
import { wordsOf } from '../lib/words/lexicon.js';

function mix(word, rng) {
  const chars = [...word];
  for (let i = 0; i < 8; i++) {
    for (let n = chars.length - 1; n > 0; n--) {
      const j = rng.int(0, n);
      [chars[n], chars[j]] = [chars[j], chars[n]];
    }
    if (chars.join('') !== word) return chars;
  }
  return chars;
}

export function newRound(diff, seed = 1, which = 'de') {
  const len = diff === 'leicht' ? 4 : diff === 'schwer' ? 6 : 5;
  const pool = wordsOf(which, len, len, true).filter((w) => new Set(w).size === [...w].length);
  const rng = makeRng(seed);
  const word = pool[rng.int(0, Math.max(0, pool.length - 1))] || (which === 'en' ? 'STONE' : 'GARTEN');
  return { word, tiles: mix(word, rng), picked: [], shown: 0 };
}

export function take(state, index) {
  if (state.picked.includes(index) || index < 0 || index >= state.tiles.length) return state;
  return { ...state, picked: state.picked.concat(index) };
}

export function undo(state) {
  return { ...state, picked: state.picked.slice(0, -1) };
}

export function current(state) {
  return state.picked.map((i) => state.tiles[i]).join('');
}

export function solved(state) {
  return current(state) === state.word;
}

export function hint(state) {
  const built = current(state);
  if (built === state.word.slice(0, built.length) && state.shown < state.word.length) {
    const ch = state.word[state.shown];
    const index = state.tiles.findIndex((c, i) => c === ch && !state.picked.includes(i));
    if (index >= 0) return { ...take(state, index), shown: state.shown + 1 };
  }
  return { ...state, picked: [], shown: Math.min(state.word.length, state.shown + 1) };
}
