import { makeRng } from '../shared/rng.js';
import { hasWord, normalize } from '../lib/words/lexicon.js';
import { makeWheel, spellable } from '../lib/words/spell.js';

export function specFor(diff) {
  if (diff === 'leicht') return { size: 7, min: 4, need: 6, cap: 10, reuse: true, center: true };
  if (diff === 'schwer') return { size: 7, min: 4, need: 10, cap: 16, reuse: true, center: true };
  return { size: 7, min: 4, need: 8, cap: 12, reuse: true, center: true };
}

export function newPuzzle(diff, seed = Date.now(), which) {
  const wheel = makeWheel(makeRng(seed).next, { ...specFor(diff), which });
  return {
    letters: wheel.letters,
    center: wheel.center || wheel.letters[0],
    words: wheel.words,
    found: [],
    bonus: [],
    entry: '',
    min: specFor(diff).min,
    seed,
  };
}

export function typeLetter(state, ch) {
  if (!state.letters.includes(ch) || [...state.entry].length >= 12) return state;
  return { ...state, entry: state.entry + ch };
}

export function submit(state, which) {
  const word = normalize(state.entry);
  if ([...word].length < state.min) return { state, kind: 'short' };
  if (!word.includes(state.center)) return { state, kind: 'center' };
  if (state.found.includes(word) || state.bonus.includes(word)) return { state: { ...state, entry: '' }, kind: 'repeat' };
  const ok = spellable(word, state.letters.join(''), { min: state.min, center: state.center, reuse: true });
  if (!ok || !hasWord(word, which)) return { state, kind: 'no' };
  const next = { ...state, entry: '' };
  if (state.words.includes(word)) next.found = state.found.concat(word);
  else next.bonus = state.bonus.concat(word);
  return { state: next, kind: state.words.includes(word) ? 'found' : 'bonus' };
}

export function done(state) {
  return state.words.length > 0 && state.words.every((w) => state.found.includes(w));
}

export function hint(state) {
  const missing = state.words.find((w) => !state.found.includes(w));
  if (!missing) return state;
  return { ...state, found: state.found.concat(missing), entry: '' };
}
