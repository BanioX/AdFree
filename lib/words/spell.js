// Buchstabenräder: welche Wörter lassen sich aus einem Satz Buchstaben legen?

import { currentLang, wordsOf } from './lexicon.js';

export function letters(word) {
  return [...word];
}

function bag(word) {
  const m = new Map();
  for (const ch of letters(word)) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}

export function spellable(word, source, { min = 3, center = '', reuse = false } = {}) {
  if (letters(word).length < min) return false;
  if (center && !word.includes(center)) return false;
  const have = bag(source);
  const need = bag(word);
  for (const [ch, n] of need) {
    const got = have.get(ch) || 0;
    if (!got) return false;
    if (!reuse && got < n) return false;
  }
  return true;
}

export function solutions(source, dict, opts) {
  return dict.filter((w) => spellable(w, source, opts)).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ein Rad mit genug Lösungen. center: ein Buchstabe muss vorkommen. reuse: Buchstaben dürfen mehrfach. */
export function makeWheel(rng, { size = 6, min = 3, reuse = false, center = false, need = 6, cap = 12, which = currentLang() } = {}) {
  const dict = wordsOf(which, min, 8, true);
  const seeds = dict.filter((w) => {
    const u = new Set(letters(w));
    if (reuse) return u.size >= Math.min(5, size) && letters(w).length >= 4;
    return u.size === letters(w).length && letters(w).length >= Math.min(size, 5);
  });
  let best = null;
  for (let t = 0; t < 500; t++) {
    const seed = seeds[Math.floor(rng() * seeds.length)];
    if (!seed) break;
    let chars = [...new Set(letters(seed))];
    if (chars.length > size) chars = shuffle(chars, rng).slice(0, size);
    const alphabet = which === 'en' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
    let guard = 0;
    while (chars.length < size && guard++ < 40) {
      const ch = alphabet[Math.floor(rng() * alphabet.length)];
      if (!chars.includes(ch)) chars.push(ch);
    }
    chars = shuffle(chars, rng);
    const mid = center ? chars[0] : '';
    let words = solutions(chars.join(''), dict, { min, center: mid, reuse });
    if (words.length > cap) words = words.slice(0, cap);
    if (!best || words.length > best.words.length) best = { letters: chars, center: mid, words };
    if (words.length >= need) return { letters: chars, center: mid, words };
  }
  return best || { letters: ['A', 'E', 'R', 'S', 'T', 'N'].slice(0, size), center: '', words: [] };
}
