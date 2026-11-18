// Zweisprachigkeit (Deutsch / English) für alle Spiele.
//
// Sprache: gespeicherte Wahl («lang»), sonst die Sprache des Geräts (Deutsch → de, alles andere → en).
// Umschalten: setLang('en') speichert und lädt die Seite neu.
//
//   import { L, lang, isEn, setLang, fmt, dict, plural } from '../shared/i18n.js';
//
//   L('Spielen', 'Play')                       // kurzer Text inline: Deutsch, Englisch
//   L({ de: 'Spielen', en: 'Play' })           // gleiche Wirkung als Objekt
//   fmt(L('Level {n}', 'Level {n}'), { n: 7 }) // Platzhalter {name}
//   plural(n, ['Bild', 'Bilder'], ['picture', 'pictures'])  // «1 Bild», «3 Bilder» / «1 picture» …
//
//   // Für viele Texte: Wörterbuch pro Spiel (z.B. /<id>/i18n.js)
//   export const t = dict({
//     de: { play: 'Spielen', level: 'Level {n}' },
//     en: { play: 'Play',    level: 'Level {n}' },
//   });
//   t('level', { n: 3 })
//
// Inhalte, die von der Sprache abhängen (Wortlisten, Themen, Titel), pro Sprache in data/ ablegen
// und mit `lang` die richtige Datei wählen.

import { store } from './storage.js';

export const LANGS = [
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'en', label: 'English', short: 'EN' },
];

function detect() {
  const saved = store.get('lang', null);
  if (saved === 'de' || saved === 'en') return saved;
  try {
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'de'];
    return String(list[0] || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'de';
  }
}

/** Aktuelle Sprache: 'de' oder 'en' */
export const lang = typeof window === 'undefined' ? 'de' : detect();
export const isEn = () => lang === 'en';

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang === 'en' ? 'en' : 'de-CH';
}

/** Text in der aktuellen Sprache. L(de, en) oder L({ de, en }). Fehlt Englisch, gilt Deutsch. */
export function L(de, en) {
  if (de && typeof de === 'object' && !Array.isArray(de)) return lang === 'en' && de.en != null ? de.en : de.de;
  return lang === 'en' && en != null ? en : de;
}

/** Ersetzt {name}-Platzhalter. */
export function fmt(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Einzahl/Mehrzahl: plural(3, ['Bild', 'Bilder'], ['picture', 'pictures']) → «3 Bilder» */
export function plural(n, de, en, { withNumber = true } = {}) {
  const forms = lang === 'en' && en ? en : de;
  const word = n === 1 ? forms[0] : forms[1];
  return withNumber ? `${n} ${word}` : word;
}

/** Wörterbuch: dict({ de: {...}, en: {...} }) → t(key, vars) */
export function dict(table) {
  return (key, vars) => {
    const s = (table[lang] && table[lang][key] != null) ? table[lang][key]
      : (table.de && table.de[key] != null) ? table.de[key] : key;
    return vars ? fmt(s, vars) : s;
  };
}

/** Sprache wechseln (speichert und lädt neu). */
export function setLang(l) {
  if (l !== 'de' && l !== 'en') return;
  store.set('lang', l);
  if (typeof location !== 'undefined') location.reload();
}

/** Zahl hübsch formatieren (Tausendertrennzeichen passend zur Sprache). */
export function num(n) {
  try { return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'de-CH').format(n); } catch { return String(n); }
}

/** Schalter DE/EN für Spielmenüs. Speichert die Wahl und lädt neu. */
export function languageButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn lang-btn';
  b.textContent = lang === 'en' ? 'EN' : 'DE';
  b.setAttribute('aria-label', L(
    'Sprache: Deutsch – tippen für Englisch',
    'Language: English – tap for German',
  ));
  b.addEventListener('click', () => setLang(lang === 'en' ? 'de' : 'en'));
  return b;
}
