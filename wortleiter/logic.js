import { makeRng } from '../shared/rng.js';
import { wordsOf } from '../lib/words/lexicon.js';

const ABC = {
  de: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};

export function neighbors(word, dict, which) {
  const chars = [...word];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    for (const ch of ABC[which] || ABC.de) {
      if (ch === chars[i]) continue;
      const next = chars.slice();
      next[i] = ch;
      const w = next.join('');
      if (dict.has(w)) out.push(w);
    }
  }
  return out;
}

function pathBetween(start, dict, which, min, max) {
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const q = [start];
  while (q.length) {
    const w = q.shift();
    const d = dist.get(w);
    if (d >= min && w !== start) {
      const path = [w];
      while (path[0] !== start) path.unshift(prev.get(path[0]));
      return path;
    }
    if (d >= max) continue;
    for (const n of neighbors(w, dict, which)) {
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      prev.set(n, w);
      q.push(n);
    }
  }
  return null;
}

export function newLadder(diff, seed = 1, which = 'de') {
  const len = diff === 'schwer' ? 5 : 4;
  const min = diff === 'leicht' ? 3 : 4;
  const dict = new Set(wordsOf(which, len, len, true));
  const list = [...dict];
  const rng = makeRng(seed);
  for (let t = 0; t < 40; t++) {
    const start = list[rng.int(0, list.length - 1)];
    const path = pathBetween(start, dict, which, min, min + 1);
    if (path) return { start, goal: path[path.length - 1], chain: [start], len, which };
  }
  const start = list[0];
  return { start, goal: start, chain: [start], len, which };
}

export function choices(state, index, which = state.which) {
  const dict = new Set(wordsOf(which, state.len, state.len, true));
  const chars = [...state.chain[state.chain.length - 1]];
  const used = new Set(state.chain);
  const out = [];
  for (const ch of ABC[which] || ABC.de) {
    if (ch === chars[index]) continue;
    const next = chars.slice();
    next[index] = ch;
    const w = next.join('');
    if (dict.has(w) && !used.has(w)) out.push(ch);
  }
  return out;
}

export function play(state, index, ch, which = state.which) {
  if (!choices(state, index, which).includes(ch)) return state;
  const chars = [...state.chain[state.chain.length - 1]];
  chars[index] = ch;
  return { ...state, chain: state.chain.concat(chars.join('')) };
}

export function back(state) {
  if (state.chain.length <= 1) return state;
  return { ...state, chain: state.chain.slice(0, -1) };
}

export function solved(state) {
  return state.chain[state.chain.length - 1] === state.goal;
}

export function hintStep(state, which = state.which) {
  const dict = new Set(wordsOf(which, state.len, state.len, true));
  const start = state.chain[state.chain.length - 1];
  if (start === state.goal) return state;
  const prev = new Map();
  const q = [start];
  const seen = new Set([start]);
  while (q.length) {
    const w = q.shift();
    for (const n of neighbors(w, dict, which)) {
      if (seen.has(n) || state.chain.includes(n)) continue;
      prev.set(n, w);
      if (n === state.goal) {
        let cur = n;
        while (prev.get(cur) !== start) cur = prev.get(cur);
        return { ...state, chain: state.chain.concat(cur) };
      }
      seen.add(n);
      q.push(n);
    }
  }
  return state;
}
