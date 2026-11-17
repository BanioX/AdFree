// Blasenfarben. Die Nummer (id) wird im Spielstand gespeichert – nicht umnummerieren!
// key:    Buchstabe für handgezeichnete Level (data/levels.js); Grossbuchstabe = mit Tierchen
// base:   Grundfarbe der Glasblase
// symbol: dezentes Zeichen in der Blase (hilft bei Farbschwäche)
//         heart | star | sun | leaf | drop | moon | flower | diamond

export const COLORS = [
  null,
  { id: 1, key: 'r', name: 'Rot', base: '#f0475e', symbol: 'heart' },
  { id: 2, key: 'o', name: 'Orange', base: '#ff9a2e', symbol: 'star' },
  { id: 3, key: 'y', name: 'Gelb', base: '#ffd23a', symbol: 'sun' },
  { id: 4, key: 'g', name: 'Grün', base: '#49c463', symbol: 'leaf' },
  { id: 5, key: 'b', name: 'Blau', base: '#3d8ef0', symbol: 'drop' },
  { id: 6, key: 'v', name: 'Violett', base: '#9a62ee', symbol: 'moon' },
  { id: 7, key: 'p', name: 'Rosa', base: '#ff7cc6', symbol: 'flower' },
  { id: 8, key: 't', name: 'Türkis', base: '#1fc2bd', symbol: 'diamond' },
];

/** Buchstabe → Farb-id */
export const COLOR_BY_KEY = Object.fromEntries(COLORS.filter(Boolean).map((c) => [c.key, c.id]));
