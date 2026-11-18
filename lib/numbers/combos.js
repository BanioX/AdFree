// Zahlen-Familie – Summen-Kombinationen (reine Logik, ohne DOM).
//
// Ziffern werden als Bitmasken geführt: Bit d steht für die Ziffer d (Bit 0 bleibt leer).
//   combos(16, 2)            → [maske(7,9)]
//   comboUnion(10, 3)        → alle Ziffern, die in einer 3er-Summe 10 vorkommen können
//   digitsOf(mask) / maskOf([1, 3]) / popcount(mask)

export const ALL9 = 0b1111111110;

export function popcount(m) {
  let c = 0;
  while (m) { m &= m - 1; c++; }
  return c;
}

export function maskOf(digits) {
  let m = 0;
  for (const d of digits) if (d > 0) m |= 1 << d;
  return m;
}

export function digitsOf(m, max = 9) {
  const out = [];
  for (let d = 1; d <= max; d++) if (m & (1 << d)) out.push(d);
  return out;
}

/** Niedrigste gesetzte Ziffer einer Maske (0 = keine). */
export function lowestDigit(m) {
  for (let d = 1; d <= 16; d++) if (m & (1 << d)) return d;
  return 0;
}

export const sumOf = (m) => digitsOf(m).reduce((a, b) => a + b, 0);

// TABLE[len][sum] = Masken aller Mengen verschiedener Ziffern 1–9
const TABLE = (() => {
  const t = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
  for (let m = 0; m < 512; m++) {
    let s = 0, c = 0;
    for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) { s += d; c++; }
    t[c][s].push(m << 1);
  }
  return t;
})();

/**
 * Alle Ziffernmengen (verschiedene Ziffern 1..max) mit len Elementen und Summe sum.
 * must: Ziffern, die enthalten sein müssen; exclude: Ziffern, die fehlen müssen.
 */
export function combos(sum, len, { max = 9, must = 0, exclude = 0 } = {}) {
  if (len < 0 || len > 9 || sum < 0 || sum > 45) return [];
  const lim = (1 << (max + 1)) - 2;
  return TABLE[len][sum].filter((m) => (m & ~lim) === 0 && (m & must) === must && (m & exclude) === 0);
}

/** Vereinigung aller möglichen Ziffern für eine Summe. */
export function comboUnion(sum, len, opts) {
  let u = 0;
  for (const m of combos(sum, len, opts)) u |= m;
  return u;
}

/**
 * Für eine Gruppe verschiedener Ziffern mit Zielsumme: welche Kombinationen sind mit den
 * aktuellen Kandidaten der Zellen noch verträglich, und welche Ziffern bleiben je Zelle?
 * doms: Kandidatenmasken je Zelle (ein gesetzter Wert = Maske mit einem Bit).
 * Gibt { combos: [mask], cell: [mask] } zurück (cell[k] ⊆ doms[k]).
 */
export function runSupport(sum, doms, max = 9) {
  const n = doms.length;
  const cell = new Array(n).fill(0);
  const ok = [];
  for (const c of combos(sum, n, { max })) {
    // passt jede Zelle in die Kombination und gibt es eine Zuordnung (Matching)?
    let fits = true;
    for (let k = 0; k < n; k++) if (!(doms[k] & c)) { fits = false; break; }
    if (!fits) continue;
    const support = matchSupport(doms.map((d) => d & c), c);
    if (!support) continue;
    ok.push(c);
    for (let k = 0; k < n; k++) cell[k] |= support[k];
  }
  return { combos: ok, cell };
}

// Welche Ziffer kann in welcher Zelle stehen, wenn alle Ziffern aus c genau einmal verteilt werden?
// (bipartites Matching Zellen ↔ Ziffern; eine Kante ist erlaubt, wenn es ein perfektes
// Matching gibt, das sie enthält)
export function matchSupport(doms, c) {
  const n = doms.length;
  const cellOf = new Array(17).fill(-1);   // Ziffer → Zelle
  const digOf = new Array(n).fill(0);      // Zelle → Ziffer
  let seen = 0;
  let banned = -1;
  function dfs(k) {
    for (let d = 1; d <= 16; d++) {
      const b = 1 << d;
      if (!(doms[k] & b) || !(c & b) || (seen & b)) continue;
      seen |= b;
      const o = cellOf[d];
      if (o >= 0 && o === banned) continue;
      if (o < 0 || dfs(o)) { cellOf[d] = k; digOf[k] = d; return true; }
    }
    return false;
  }
  const augment = (k, seen0, ban) => { seen = seen0; banned = ban; return { ok: dfs(k) }; };
  for (let k = 0; k < n; k++) if (!augment(k, 0, -1).ok) return null;
  const support = digOf.map((d) => 1 << d);
  for (let k = 0; k < n; k++) {
    for (let d = 1; d <= 16; d++) {
      const b = 1 << d;
      if (!(doms[k] & b) || !(c & b) || (support[k] & b)) continue;
      // k fest auf d setzen; bisheriger Besitzer von d sucht einen anderen Weg
      const saveCell = cellOf.slice(), saveDig = digOf.slice();
      const owner = cellOf[d];
      const old = digOf[k];
      cellOf[old] = -1;
      cellOf[d] = k; digOf[k] = d;
      const ok = augment(owner, 1 << d, k).ok;
      if (ok) for (let q = 0; q < n; q++) support[q] |= 1 << digOf[q];
      for (let x = 0; x < cellOf.length; x++) cellOf[x] = saveCell[x];
      for (let x = 0; x < n; x++) digOf[x] = saveDig[x];
    }
  }
  return support;
}

/** Kurzschreibweise einer Kombination, z.B. «1 3 9». */
export const comboText = (m, sep = ' ') => digitsOf(m).join(sep);
