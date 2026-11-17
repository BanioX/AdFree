import { makeRng } from '../shared/rng.js';

const puzzles = {
  de: [
    ['🌙', 'MOND'], ['🏠', 'HAUS'], ['🚂', 'BAHN'], ['🐶', 'HUND'], ['📚', 'BUCH'],
    ['🍞', 'BROT'], ['🧀', 'KÄSE'], ['🚲', 'VELO'], ['🎈', 'BALL'], ['🌳', 'BAUM'],
    ['🌽', 'MAIS'], ['🛏️', 'BETT'], ['🎵', 'LIED'], ['⛰️', 'BERG'], ['👶', 'BABY'],
    ['📷', 'FOTO'], ['🎬', 'FILM'], ['🎯', 'ZIEL'], ['🥕', 'RÜBE'], ['🏀', 'KORB'],
    ['⭐', 'STERN'], ['🌧️', 'REGEN'], ['🎂', 'TORTE'], ['🐱', 'KATZE'], ['🌸', 'BLUME'],
    ['🍎', 'APFEL'], ['🥛', 'MILCH'], ['☀️', 'SONNE'], ['🔥', 'FEUER'], ['🌊', 'WELLE'],
    ['🐝', 'BIENE'], ['🐦', 'VOGEL'], ['🍓', 'BEERE'], ['🪑', 'STUHL'], ['🕯️', 'KERZE'],
    ['☁️', 'WOLKE'], ['🌃', 'NACHT'], ['👑', 'KRONE'], ['💎', 'STEIN'], ['✉️', 'BRIEF'],
    ['✏️', 'STIFT'], ['🃏', 'KARTE'], ['🍯', 'HONIG'], ['🪙', 'MÜNZE'],
    ['❄️', 'SCHNEE'], ['🐸', 'FROSCH'], ['🍇', 'TRAUBE'], ['🍊', 'ORANGE'], ['🍉', 'MELONE'],
    ['🥨', 'BREZEL'], ['☕', 'KAFFEE'], ['🏖️', 'STRAND'], ['🧩', 'PUZZLE'], ['🎲', 'WÜRFEL'],
    ['🌻', 'GARTEN'], ['🍒', 'KIRSCH'], ['🌉', 'BRÜCKE'],
  ],
  en: [
    ['🌧️', 'RAIN'], ['🎂', 'CAKE'], ['📚', 'BOOK'], ['🌙', 'MOON'], ['🐦', 'BIRD'],
    ['🐟', 'FISH'], ['🏠', 'HOME'], ['⛵', 'BOAT'], ['🥛', 'MILK'], ['🌳', 'TREE'],
    ['⭐', 'STAR'], ['💡', 'LAMP'], ['🖥️', 'DESK'], ['🧥', 'COAT'], ['👟', 'SHOE'],
    ['💍', 'RING'], ['🔔', 'BELL'], ['🥁', 'DRUM'], ['🐸', 'FROG'], ['🎈', 'BALL'],
    ['🍎', 'APPLE'], ['🍇', 'GRAPE'], ['🚂', 'TRAIN'], ['☁️', 'CLOUD'], ['🚣', 'RIVER'],
    ['😊', 'SMILE'], ['🐴', 'HORSE'], ['🐑', 'SHEEP'], ['🪑', 'CHAIR'], ['🍽️', 'TABLE'],
    ['🌱', 'PLANT'], ['🪨', 'STONE'], ['🍞', 'BREAD'], ['🍯', 'HONEY'], ['✉️', 'MAIL'],
    ['🌸', 'FLOWER'], ['🌻', 'GARDEN'], ['🪟', 'WINDOW'], ['🕯️', 'CANDLE'], ['🍊', 'ORANGE'],
    ['🍌', 'BANANA'], ['🧈', 'BUTTER'], ['🍪', 'COOKIE'], ['🏰', 'CASTLE'], ['🌉', 'BRIDGE'],
  ],
};

const ALPHA = {
  de: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};

export function lengthFor(diff) {
  return diff === 'leicht' ? 4 : diff === 'schwer' ? 6 : 5;
}

export function newRound(diff, seed = 1, which = 'de') {
  const len = lengthFor(diff);
  const list = (puzzles[which] || puzzles.de).filter((pair) => [...pair[1]].length === len);
  const rng = makeRng(seed);
  const [emoji, word] = list[rng.int(0, list.length - 1)];
  const have = new Set([...word]);
  const extra = rng.shuffle([...ALPHA[which]].filter((ch) => !have.has(ch))).slice(0, 2);
  const bank = rng.shuffle([...word, ...extra]);
  return { emoji, word, bank, picks: [], which, len };
}

export function current(state) {
  return state.picks.map((i) => state.bank[i]).join('');
}

export function take(state, index) {
  if (state.picks.includes(index) || index < 0 || index >= state.bank.length) return state;
  return { ...state, picks: state.picks.concat(index) };
}

export function undo(state) {
  return { ...state, picks: state.picks.slice(0, -1) };
}

export function solved(state) {
  return current(state) === state.word;
}

export function hint(state) {
  const built = current(state);
  if (!state.word.startsWith(built)) return { ...state, picks: [] };
  const need = state.word[built.length];
  const index = state.bank.findIndex((ch, i) => ch === need && !state.picks.includes(i));
  if (index < 0) return state;
  return take(state, index);
}
