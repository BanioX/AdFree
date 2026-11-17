// Sudoku-Grundlagen: Zellen, Einheiten (Reihen, Spalten, Blöcke), Kandidaten als Bitmasken.
// Reine Logik – kein DOM, läuft auch in node und im Worker.
//
// Zellen sind 0..80 (Reihe * 9 + Spalte). Ziffern 1..9, 0 = leer.
// Kandidaten: Bit (d - 1) gesetzt => Ziffer d ist möglich. ALL = 0x1ff.

export const ALL = 0x1ff;
export const bit = (d) => 1 << (d - 1);
export const rowOf = (i) => (i / 9) | 0;
export const colOf = (i) => i % 9;
export const boxOf = (i) => (((i / 27) | 0) * 3) + (((i % 9) / 3) | 0);

/** 27 Einheiten: 0–8 Reihen, 9–17 Spalten, 18–26 Blöcke. Jede mit 9 Zellen. */
export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;
  const u = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((r0 + r) * 9 + c0 + c);
  UNITS.push(u);
}

export const unitType = (u) => (u < 9 ? 'row' : u < 18 ? 'col' : 'box');
export const unitIndex = (u) => u % 9;

/** Die drei Einheiten jeder Zelle: [Reihe, Spalte, Block]. */
export const CELL_UNITS = Array.from({ length: 81 }, (_, i) => [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);

/** 20 Nachbarn jeder Zelle (gleiche Reihe, Spalte oder Block). */
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (const u of CELL_UNITS[i]) for (const j of UNITS[u]) if (j !== i) s.add(j);
  return [...s].sort((a, b) => a - b);
});

const PEER_SET = PEERS.map((p) => {
  const a = new Uint8Array(81);
  for (const j of p) a[j] = 1;
  return a;
});
export const sees = (a, b) => a !== b && PEER_SET[a][b] === 1;

/** Anzahl gesetzter Bits (0..9). */
const POP = new Uint8Array(512);
for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
export const popcount = (m) => POP[m & ALL];

/** Ziffern einer Maske, aufsteigend. */
const DIGITS = Array.from({ length: 512 }, (_, m) => {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d);
  return out;
});
export const digitsOf = (m) => DIGITS[m & ALL];

/** Kleinste Ziffer einer Maske mit genau einem Bit. */
export const singleDigit = (m) => 32 - Math.clz32(m);

/** '53..7....' (Punkt oder 0 = leer) -> Array mit 81 Zahlen. */
export function parse(str) {
  const s = String(str).replace(/\s+/g, '');
  if (s.length !== 81) throw new Error('Sudoku braucht 81 Zeichen, nicht ' + s.length);
  const out = new Array(81);
  for (let i = 0; i < 81; i++) {
    const ch = s[i];
    if (ch === '.' || ch === '0') out[i] = 0;
    else if (ch >= '1' && ch <= '9') out[i] = ch.charCodeAt(0) - 48;
    else throw new Error('Ungültiges Zeichen: ' + ch);
  }
  return out;
}

/** Array mit 81 Zahlen -> String ('0' = leer). */
export function stringify(values) {
  let s = '';
  for (let i = 0; i < 81; i++) s += values[i] ? String(values[i]) : '0';
  return s;
}

/** Kandidaten jeder leeren Zelle aus den gesetzten Ziffern (0 für gefüllte Zellen). */
export function candidatesFromValues(values) {
  const used = new Uint16Array(27);
  for (let i = 0; i < 81; i++) {
    const v = values[i];
    if (v) for (const u of CELL_UNITS[i]) used[u] |= bit(v);
  }
  const out = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    const [r, c, b] = CELL_UNITS[i];
    out[i] = ALL & ~(used[r] | used[c] | used[b]);
  }
  return out;
}

/** Zellen, deren Ziffer in Reihe, Spalte oder Block doppelt vorkommt. */
export function findConflicts(values) {
  const bad = new Set();
  for (const unit of UNITS) {
    const seen = new Map();
    for (const i of unit) {
      const v = values[i];
      if (!v) continue;
      if (seen.has(v)) { bad.add(i); bad.add(seen.get(v)); } else seen.set(v, i);
    }
  }
  return bad;
}

/** Konfliktpartner einer Zelle (Nachbarn mit gleicher Ziffer). */
export function conflictsOf(values, i) {
  const v = values[i];
  if (!v) return [];
  return PEERS[i].filter((j) => values[j] === v);
}

/** Vollständig und regelkonform gefüllt? */
export function isComplete(values) {
  for (let i = 0; i < 81; i++) if (!values[i]) return false;
  return findConflicts(values).size === 0;
}

export function countGivens(values) {
  let n = 0;
  for (let i = 0; i < 81; i++) if (values[i]) n++;
  return n;
}
