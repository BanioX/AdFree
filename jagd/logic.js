import { makeRng } from '../shared/rng.js';
import { wordsOf } from '../lib/words/lexicon.js';

export function newRound(diff, seed = 1, which = 'de') {
  const len = diff === 'schwer' ? 6 : diff === 'leicht' ? 4 : 5;
  const pool = wordsOf(which, len, len, true);
  const rng = makeRng(seed);
  const word = pool[rng.int(0, pool.length - 1)] || 'HAUS';
  return { word, guesses: [], wrong: 0, max: 7, len };
}

export function guess(state, ch) {
  const letter = String(ch || '').toUpperCase();
  if (!letter || state.guesses.includes(letter) || won(state) || lost(state)) return state;
  const hit = state.word.includes(letter);
  return { ...state, guesses: state.guesses.concat(letter), wrong: state.wrong + (hit ? 0 : 1) };
}

export function won(state) {
  return [...new Set(state.word)].every((ch) => state.guesses.includes(ch));
}

export function lost(state) {
  return state.wrong >= state.max && !won(state);
}

export function hint(state) {
  const missing = [...state.word].find((ch) => !state.guesses.includes(ch));
  return missing ? guess(state, missing) : state;
}
