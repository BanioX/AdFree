import { makeRng } from '../shared/rng.js';

const LINES = {
  de: [
    'DIE SONNE SCHEINT',
    'EIN APFEL AM MORGEN',
    'WIR LESEN EIN BUCH',
    'DER GARTEN BLÜHT',
    'TEE UND KUCHEN',
    'HEUTE IST FREITAG',
    'DER HUND SCHLÄFT',
    'OFFEN UND EHRLICH',
  ],
  en: [
    'THE SUN IS OUT',
    'READ A GOOD BOOK',
    'TEA AND CAKE',
    'A SMALL RED BIRD',
    'OPEN THE WINDOW',
    'WALK IN THE PARK',
    'BAKE SOME BREAD',
    'THE GARDEN IS GREEN',
  ],
};

function alphabet(which) {
  return which === 'en' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
}

function derange(letters, rng) {
  const bag = alphabet(letters.which).split('');
  const symbols = [];
  for (let i = 0; i < letters.list.length; i++) {
    const choices = bag.filter((ch) => ch !== letters.list[i] && !symbols.includes(ch));
    const ch = choices.length ? choices[rng.int(0, choices.length - 1)] : bag[rng.int(0, bag.length - 1)];
    symbols.push(ch);
  }
  return symbols;
}

export function newPuzzle(diff, seed = 1, which = 'de') {
  const lines = LINES[which] || LINES.de;
  const rng = makeRng(seed);
  const text = lines[rng.int(0, (diff === 'schwer' ? lines.length : Math.min(5, lines.length)) - 1)];
  const list = [...new Set([...text].filter((ch) => /[A-ZÄÖÜ]/.test(ch)))];
  const symbols = derange({ list, which }, rng);
  const code = {};
  list.forEach((ch, i) => { code[ch] = symbols[i]; });
  const given = {};
  const reveal = diff === 'leicht' ? 2 : diff === 'mittel' ? 1 : 0;
  for (let i = 0; i < reveal && i < list.length; i++) given[symbols[i]] = list[i];
  return { text, code, guess: { ...given }, which, sel: '' };
}

export function encoded(state) {
  return [...state.text].map((ch) => state.code[ch] || ch).join('');
}

export function decoded(state) {
  const back = {};
  for (const [plain, symbol] of Object.entries(state.code)) back[symbol] = state.guess[symbol] || '·';
  return [...encoded(state)].map((ch) => (state.code && Object.values(state.code).includes(ch) ? (state.guess[ch] || '·') : ch)).join('');
}

export function assign(state, symbol, plain) {
  const guess = { ...state.guess };
  for (const key of Object.keys(guess)) if (guess[key] === plain) delete guess[key];
  guess[symbol] = plain;
  return { ...state, guess, sel: '' };
}

export function solved(state) {
  return [...state.text].every((ch) => !state.code[ch] || state.guess[state.code[ch]] === ch);
}

export function hint(state) {
  const missing = Object.entries(state.code).find(([plain, symbol]) => state.guess[symbol] !== plain);
  if (!missing) return state;
  return assign(state, missing[1], missing[0]);
}
