// Lateinisches Quadrat nur für Hochhäuser. Zählt Lösungen und würfelt ein volles Quadrat.

class SearchCap extends Error {
  constructor() { super('cap'); this.name = 'SearchCap'; }
}
function guard(nodes, cap) { if (nodes > cap) throw new SearchCap(); }

export function provenUnique(fn) {
  try { return fn() === 1; } catch (e) {
    if (e instanceof SearchCap) return false;
    throw e;
  }
}

export function thinOut(items, rng, maxRemove, drop, restore, unique) {
  const order = items.slice();
  rng.shuffle(order);
  let removed = 0;
  for (const item of order) {
    if (removed >= maxRemove) break;
    drop(item);
    if (unique()) removed += 1;
    else restore(item);
  }
  return removed;
}

export function countLatin(n, given, hooks = {}, limit = 2, cap = 80000) {
  let nodes = 0;
  let sols = 0;
  const grid = given.map((row) => row.slice());
  const rowMask = Array(n).fill(0);
  const colMask = Array(n).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r][c];
      if (!v) continue;
      const bit = 1 << v;
      if ((rowMask[r] & bit) || (colMask[c] & bit)) return 0;
      rowMask[r] |= bit;
      colMask[c] |= bit;
    }
  }
  function bt(pos) {
    if (sols >= limit) return;
    guard(++nodes, cap);
    if (pos === n * n) {
      if (!hooks.done || hooks.done(grid)) sols += 1;
      return;
    }
    const r = (pos / n) | 0;
    const c = pos % n;
    if (grid[r][c]) {
      if (hooks.cell && !hooks.cell(grid, r, c)) return;
      if (c === n - 1 && hooks.row && !hooks.row(grid, r)) return;
      bt(pos + 1);
      return;
    }
    const used = rowMask[r] | colMask[c];
    for (let v = 1; v <= n; v++) {
      const bit = 1 << v;
      if (used & bit) continue;
      grid[r][c] = v;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      let good = !hooks.cell || hooks.cell(grid, r, c);
      if (good && c === n - 1 && hooks.row) good = hooks.row(grid, r);
      if (good) bt(pos + 1);
      if (sols >= limit) return;
      rowMask[r] ^= bit;
      colMask[c] ^= bit;
      grid[r][c] = 0;
    }
  }
  bt(0);
  return sols;
}

export function randomLatin(n, rng) {
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  const rowMask = Array(n).fill(0);
  const colMask = Array(n).fill(0);
  const order = [];
  for (let v = 1; v <= n; v++) order.push(v);
  function bt(pos) {
    if (pos === n * n) return true;
    const r = (pos / n) | 0;
    const c = pos % n;
    rng.shuffle(order);
    const used = rowMask[r] | colMask[c];
    for (const v of order) {
      const bit = 1 << v;
      if (used & bit) continue;
      grid[r][c] = v;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      if (bt(pos + 1)) return true;
      rowMask[r] ^= bit;
      colMask[c] ^= bit;
      grid[r][c] = 0;
    }
    return false;
  }
  if (!bt(0)) return null;
  return grid;
}

export function sees(line) {
  let max = 0;
  let k = 0;
  for (const v of line) if (v > max) { max = v; k += 1; }
  return k;
}
