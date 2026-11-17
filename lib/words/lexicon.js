// Wortlisten für die Wortspiele. Deutsch bleibt die grosse Liste, Englisch eine eigene.
// `lang` gilt beim Laden der Seite; ein Sprachwechsel lädt neu.

import { lang } from '../../shared/i18n.js';
import { de } from './de.js';
import { en } from './en.js';

const packs = { de, en };
const sets = new Map();

export function normalize(s) {
  return String(s ?? '')
    .trim()
    .normalize('NFC')
    .replace(/ß/g, 'SS')
    .replace(/ẞ/g, 'SS')
    .toUpperCase();
}

function read(which, n, commonOnly) {
  const key = which + ':' + n + ':' + (commonOnly ? 'c' : 'a');
  if (sets.has(key)) return sets.get(key);
  const pack = packs[which] && packs[which][n];
  const raw = !pack ? '' : typeof pack === 'string' ? pack : (commonOnly ? pack.common : pack.common + ' ' + pack.rest);
  const set = new Set();
  for (const part of String(raw).split(/\s+/)) {
    const w = normalize(part);
    if ([...w].length === n && /^[A-ZÄÖÜ]+$/.test(w)) set.add(w);
  }
  sets.set(key, set);
  return set;
}

export function hasWord(word, which = lang) {
  const w = normalize(word);
  return read(which, [...w].length, false).has(w);
}

export function wordsOf(which = lang, min = 3, max = 8, commonOnly = false) {
  const out = [];
  for (let n = min; n <= max; n++) out.push(...read(which, n, commonOnly));
  return out;
}

export function currentLang() {
  return lang === 'en' ? 'en' : 'de';
}
