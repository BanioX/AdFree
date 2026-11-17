import { makeRng } from '../shared/rng.js';
import { hasWord, normalize } from '../lib/words/lexicon.js';
import { makeWheel, spellable } from '../lib/words/spell.js';

export function specFor(diff) {
  if (diff === 'leicht') return { size: 5, min: 3, need: 6, reuse: false, center: false };
  if (diff === 'schwer') return { size: 6, min: 4, need: 7, reuse: false, center: false };
  return { size: 6, min: 3, need: 8, reuse: false, center: false };
}

export function newPuzzle(diff, seed = Date.now(), which) {
  const rng = makeRng(seed).next;
  const wheel = makeWheel(rng, { ...specFor(diff), which });
  return {
    letters: wheel.letters,
    words: wheel.words,
    found: [],
    bonus: [],
    entry: '',
    min: specFor(diff).min,
    seed,
  };
}

export function canAdd(state, ch) {
  const used = [...state.entry].filter((c) => c === ch).length;
  const have = state.letters.filter((c) => c === ch).length;
  return used < have;
}

export function typeLetter(state, ch) {
  if (!canAdd(state, ch)) return state;
  return { ...state, entry: state.entry + ch };
}

export function backspace(state) {
  return { ...state, entry: [...state.entry].slice(0, -1).join('') };
}

/** 'found' | 'bonus' | 'repeat' | 'short' | 'no' */
export function submit(state, which) {
  const word = normalize(state.entry);
  if ([...word].length < state.min) return { state, kind: 'short' };
  if (state.found.includes(word) || state.bonus.includes(word)) return { state: { ...state, entry: '' }, kind: 'repeat' };
  const ok = spellable(word, state.letters.join(''), { min: state.min, reuse: false });
  if (!ok || !hasWord(word, which)) return { state, kind: 'no' };
  const next = { ...state, entry: '' };
  if (state.words.includes(word)) next.found = state.found.concat(word);
  else next.bonus = state.bonus.concat(word);
  return { state: next, kind: state.words.includes(word) ? 'found' : 'bonus' };
}

export function done(state) {
  return state.words.every((w) => state.found.includes(w));
}

export function hint(state) {
  const missing = state.words.find((w) => !state.found.includes(w));
  if (!missing) return state;
  return { ...state, found: state.found.concat(missing), entry: '' };
}
