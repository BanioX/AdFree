import { makeRng } from '../shared/rng.js';
import { hasWord, wordsOf } from '../lib/words/lexicon.js';

const NEAR = [-1, 0, 1];

function prefixesOf(dict) {
  const set = new Set();
  for (const w of dict) for (let i = 1; i <= [...w].length; i++) set.add([...w].slice(0, i).join(''));
  return set;
}

export function search(grid, dict) {
  const prefixes = prefixesOf(dict);
  const found = new Map();
  function walk(i, word, path) {
    const next = word + grid[i];
    if (!prefixes.has(next)) return;
    const steps = path.concat(i);
    if ([...next].length >= 3 && dict.has(next) && !found.has(next)) found.set(next, steps);
    if ([...next].length >= 6) return;
    const r = Math.floor(i / 4);
    const c = i % 4;
    for (const dr of NEAR) for (const dc of NEAR) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr > 3 || cc > 3) continue;
      const j = rr * 4 + cc;
      if (steps.includes(j)) continue;
      walk(j, next, steps);
    }
  }
  for (let i = 0; i < 16; i++) walk(i, '', []);
  return [...found.entries()].map(([word, path]) => ({ word, path })).sort((a, b) => a.word.length - b.word.length || (a.word < b.word ? -1 : 1));
}

function place(grid, word, rng) {
  const chars = [...word];
  const dirs = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1], [-1, 1], [-1, -1]];
  for (let t = 0; t < 24; t++) {
    const [dr, dc] = dirs[rng.int(0, dirs.length - 1)];
    const r0 = rng.int(0, 3);
    const c0 = rng.int(0, 3);
    const cells = [];
    let ok = true;
    for (let i = 0; i < chars.length; i++) {
      const r = r0 + dr * i;
      const c = c0 + dc * i;
      if (r < 0 || c < 0 || r > 3 || c > 3) { ok = false; break; }
      const prev = grid[r * 4 + c];
      if (prev && prev !== chars[i]) { ok = false; break; }
      cells.push([r * 4 + c, chars[i]]);
    }
    if (!ok) continue;
    for (const [i, ch] of cells) grid[i] = ch;
    return true;
  }
  return false;
}

export function newBoard(diff, seed = 1, which = 'de') {
  const rng = makeRng(seed);
  const min = diff === 'schwer' ? 4 : 3;
  const common = new Set(wordsOf(which, min, 6, true));
  const seeds = [...common].filter((w) => [...w].length >= 4 && [...w].length <= 5);
  const fill = which === 'en' ? 'AEIOURSTL' : 'AEIOURSTN';
  for (let attempt = 0; attempt < 20; attempt++) {
    const grid = Array(16).fill('');
    for (let n = 0; n < 6; n++) place(grid, seeds[rng.int(0, seeds.length - 1)], rng);
    for (let i = 0; i < 16; i++) if (!grid[i]) grid[i] = fill[rng.int(0, fill.length - 1)];
    let words = search(grid, common);
    if (words.length < 6) continue;
    if (words.length > 12) words = words.slice(0, 12);
    return { grid, words: words.map((w) => w.word), paths: Object.fromEntries(words.map((w) => [w.word, w.path])), found: [], min };
  }
  const grid = Array.from({ length: 16 }, () => fill[rng.int(0, fill.length - 1)]);
  const words = search(grid, common).slice(0, 12);
  return { grid, words: words.map((w) => w.word), paths: Object.fromEntries(words.map((w) => [w.word, w.path])), found: [], min };
}

export function adjacent(a, b) {
  const dr = Math.abs(Math.floor(a / 4) - Math.floor(b / 4));
  const dc = Math.abs((a % 4) - (b % 4));
  return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
}

export function extend(path, i) {
  if (!path.length) return [i];
  if (path[path.length - 1] === i) return path.slice(0, -1);
  if (path.includes(i) || !adjacent(path[path.length - 1], i)) return path;
  return path.concat(i);
}

export function wordFrom(grid, path) {
  return path.map((i) => grid[i]).join('');
}

export function score(state, path, which) {
  const word = wordFrom(state.grid, path);
  if ([...word].length < state.min) return { word, kind: 'short' };
  if (state.found.includes(word)) return { word, kind: 'repeat' };
  if (!hasWord(word, which)) return { word, kind: 'no' };
  return { word, kind: state.words.includes(word) ? 'found' : 'bonus' };
}

export function done(state) {
  return state.words.length > 0 && state.words.every((w) => state.found.includes(w));
}
