import { makeRng } from '../shared/rng.js';

const BANK = {
  de: [
    {
      mask: ['#SEE###', '#O#####', '#NACHT#', '#N#####', '#E#####', '#######', '#######'],
      clues: [
        { dir: 'a', r: 0, c: 1, n: 1, text: 'Grosses Wasser' },
        { dir: 'a', r: 2, c: 1, n: 2, text: 'Wenn es dunkel ist' },
        { dir: 'd', r: 0, c: 1, n: 3, text: 'Sie scheint am Tag' },
      ],
    },
    {
      mask: ['#HAUS##', '#U#####', '#TISCH#', '#######', '#######', '#######', '#######'],
      clues: [
        { dir: 'a', r: 0, c: 1, n: 1, text: 'Da wohnt man' },
        { dir: 'a', r: 2, c: 1, n: 2, text: 'Da wird gegessen' },
        { dir: 'd', r: 0, c: 1, n: 3, text: 'Den setzt man auf' },
      ],
    },
  ],
  en: [
    {
      mask: ['#SUN###', '#U#####', '#NIGHT#', '#N#####', '#Y#####', '#######', '#######'],
      clues: [
        { dir: 'a', r: 0, c: 1, n: 1, text: 'It shines by day' },
        { dir: 'a', r: 2, c: 1, n: 2, text: 'When it is dark' },
        { dir: 'd', r: 0, c: 1, n: 3, text: 'Full of sunshine' },
      ],
    },
    {
      mask: ['#HOME##', '#O#####', '#TABLE#', '#######', '#######', '#######', '#######'],
      clues: [
        { dir: 'a', r: 0, c: 1, n: 1, text: 'Where you live' },
        { dir: 'a', r: 2, c: 1, n: 2, text: 'Where you eat' },
        { dir: 'd', r: 0, c: 1, n: 3, text: 'Very warm' },
      ],
    },
  ],
};

export function cellsOf(mask) {
  const cells = [];
  mask.forEach((row, r) => {
    [...row].forEach((ch, c) => { if (ch !== '#') cells.push({ r, c, ch }); });
  });
  return cells;
}

export function wordCells(mask, clue) {
  const out = [];
  let r = clue.r;
  let c = clue.c;
  while (r < 7 && c < 7 && mask[r][c] !== '#') {
    out.push({ r, c, ch: mask[r][c] });
    if (clue.dir === 'a') c += 1;
    else r += 1;
  }
  return out;
}

export function newPuzzle(diff, seed = 1, which = 'de') {
  const list = BANK[which] || BANK.de;
  const rng = makeRng(seed);
  const index = diff === 'schwer' ? 0 : rng.int(0, list.length - 1);
  const puzzle = list[index];
  return { mask: puzzle.mask, clues: puzzle.clues, fill: {}, which };
}

export function filled(state) {
  return cellsOf(state.mask).every((cell) => state.fill[cell.r + ',' + cell.c] === cell.ch);
}

export function hint(state) {
  const cell = cellsOf(state.mask).find((c) => state.fill[c.r + ',' + c.c] !== c.ch);
  if (!cell) return state;
  return { ...state, fill: { ...state.fill, [cell.r + ',' + cell.c]: cell.ch } };
}
