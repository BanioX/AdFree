// Das Blasenfeld: Zeilen mit Zellen, hexagonal gepackt (siehe hex.js).
//
// Zellwert (Ganzzahl):
//   0        leer
//   1..8     Farbe (siehe data/colors.js)
//   9        Stein (passt zu keiner Farbe, fällt nur herunter)
//   + pet<<4 optional ein eingeschlossenes Tierchen (Index 1..15 in die Tierliste des Levels)

import { COLS, ROW_H } from './hex.js';

export const EMPTY = 0;
export const STONE = 9;
export const BOMB = 10;      // nur kurzzeitig beim Auflösen
export const RAINBOW = 11;   // nur kurzzeitig beim Auflösen
export const MAX_COLOR = 8;

export const kindOf = (v) => v & 15;
export const petOf = (v) => v >> 4;
export const isColor = (v) => { const k = v & 15; return k >= 1 && k <= MAX_COLOR; };
export const withPet = (kind, pet) => (kind & 15) | (pet << 4);

const key = (r, c) => r * 16 + c;

export class Board {
  /**
   * @param {number[][]} rows  Zeilen (Länge 11 bzw. 10 je nach Versatz)
   * @param {number} shift     0: Zeile 0 ist nicht verschoben; 1: Zeile 0 ist verschoben
   */
  constructor(rows = [], shift = 0) {
    this.shift = shift & 1;
    this.rows = [];
    rows.forEach((row, r) => {
      const len = this.rowLen(r);
      const out = new Array(len).fill(0);
      for (let c = 0; c < len && c < row.length; c++) out[c] = row[c] | 0;
      this.rows.push(out);
    });
  }

  isShifted(r) { return ((r + this.shift) & 1) === 1; }
  rowLen(r) { return this.isShifted(r) ? COLS - 1 : COLS; }
  inRange(r, c) { return r >= 0 && c >= 0 && c < this.rowLen(r); }

  get(r, c) {
    const row = this.rows[r];
    return row && c >= 0 && c < row.length ? row[c] : 0;
  }

  set(r, c, v) {
    if (!this.inRange(r, c)) throw new Error(`Zelle ausserhalb: ${r}/${c}`);
    this.ensureRows(r + 1);
    this.rows[r][c] = v;
  }

  ensureRows(n) {
    while (this.rows.length < n) this.rows.push(new Array(this.rowLen(this.rows.length)).fill(0));
  }

  /** Entfernt leere Zeilen am unteren Ende. */
  trim() {
    while (this.rows.length && this.rows[this.rows.length - 1].every((v) => v === 0)) this.rows.pop();
  }

  x(r, c) { return 1 + 2 * c + (this.isShifted(r) ? 1 : 0); }
  y(r) { return 1 + r * ROW_H; }

  /** Nachbarzellen (nur gültige Positionen, auch leere). */
  neighbors(r, c) {
    const out = [];
    const push = (rr, cc) => { if (this.inRange(rr, cc)) out.push([rr, cc]); };
    push(r, c - 1);
    push(r, c + 1);
    const a = this.isShifted(r) ? c : c - 1;
    for (const rr of [r - 1, r + 1]) {
      push(rr, a);
      push(rr, a + 1);
    }
    return out;
  }

  /** Ruft fn(r, c) für jede gültige Nachbarzelle auf (ohne Arrays anzulegen). */
  eachNeighbor(r, c, fn) {
    if (c > 0) fn(r, c - 1);
    if (c + 1 < this.rowLen(r)) fn(r, c + 1);
    const a = this.isShifted(r) ? c : c - 1;
    if (r > 0) {
      const len = this.rowLen(r - 1);
      if (a >= 0 && a < len) fn(r - 1, a);
      if (a + 1 >= 0 && a + 1 < len) fn(r - 1, a + 1);
    }
    const len2 = this.rowLen(r + 1);
    if (a >= 0 && a < len2) fn(r + 1, a);
    if (a + 1 >= 0 && a + 1 < len2) fn(r + 1, a + 1);
  }

  /** Alle belegten Zellen: [{r, c, v, x, y}] */
  occupied() {
    const out = [];
    for (let r = 0; r < this.rows.length; r++) {
      const row = this.rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c]) out.push({ r, c, v: row[c], x: this.x(r, c), y: this.y(r) });
      }
    }
    return out;
  }

  count() {
    let n = 0;
    for (const row of this.rows) for (const v of row) if (v) n++;
    return n;
  }

  /** Anzahl Blasen pro Farbe (Index 1..8). */
  colorCounts() {
    const counts = new Array(MAX_COLOR + 1).fill(0);
    for (const row of this.rows) for (const v of row) if (isColor(v)) counts[v & 15]++;
    return counts;
  }

  /** Farben (1..8), die noch im Feld sind. */
  colorsPresent() {
    const counts = this.colorCounts();
    const out = [];
    for (let k = 1; k <= MAX_COLOR; k++) if (counts[k]) out.push(k);
    return out;
  }

  petCount() {
    let n = 0;
    for (const row of this.rows) for (const v of row) if (petOf(v)) n++;
    return n;
  }

  /** Unterste belegte Zeile (−1 wenn leer). */
  maxRow() {
    for (let r = this.rows.length - 1; r >= 0; r--) if (this.rows[r].some((v) => v)) return r;
    return -1;
  }

  /** Zusammenhängende Gruppe gleicher Farbe ab (r, c). Steine bilden keine Gruppen. */
  group(r, c) {
    const v0 = this.get(r, c);
    if (!isColor(v0)) return v0 ? [[r, c]] : [];
    const k = v0 & 15;
    const seen = new Set([key(r, c)]);
    const out = [[r, c]];
    for (let i = 0; i < out.length; i++) {
      const [cr, cc] = out[i];
      for (const [nr, nc] of this.neighbors(cr, cc)) {
        const kk = key(nr, nc);
        if (seen.has(kk)) continue;
        const v = this.get(nr, nc);
        if (isColor(v) && (v & 15) === k) {
          seen.add(kk);
          out.push([nr, nc]);
        }
      }
    }
    return out;
  }

  /** Markierung (Uint8Array, Index r*16+c) aller Blasen, die über Nachbarn mit der Decke verbunden sind. */
  attachedMask() {
    const n = this.rows.length;
    const seen = new Uint8Array((n + 1) * 16);
    const queue = new Int32Array((n + 1) * 16);
    let qn = 0;
    if (n) this.rows[0].forEach((v, c) => { if (v) { seen[c] = 1; queue[qn++] = c; } });
    const visit = (r, c) => {
      const k = r * 16 + c;
      if (!seen[k] && r < n && this.rows[r][c]) { seen[k] = 1; queue[qn++] = k; }
    };
    for (let i = 0; i < qn; i++) {
      const k = queue[i];
      this.eachNeighbor(k >> 4, k & 15, visit);
    }
    return seen;
  }

  /** Menge (Schlüssel r*16+c) aller Blasen, die mit der Decke verbunden sind. */
  attached() {
    const m = this.attachedMask();
    const out = new Set();
    for (let k = 0; k < m.length; k++) if (m[k]) out.add(k);
    return out;
  }

  /** Blasen ohne Verbindung zur Decke: [[r, c], …] */
  floating() {
    const att = this.attachedMask();
    const out = [];
    for (let r = 0; r < this.rows.length; r++) {
      const row = this.rows[r];
      for (let c = 0; c < row.length; c++) if (row[c] && !att[r * 16 + c]) out.push([r, c]);
    }
    return out;
  }

  /** Schiebt eine neue Zeile oben ein (alles rutscht eine Zeile nach unten). */
  insertTop(row) {
    this.shift ^= 1;
    const len = this.rowLen(0);
    const out = new Array(len).fill(0);
    for (let c = 0; c < len; c++) out[c] = row && row[c] ? row[c] | 0 : 0;
    this.rows.unshift(out);
  }

  clone() {
    const b = new Board([], this.shift);
    b.rows = this.rows.map((row) => row.slice());
    return b;
  }

  toJSON() { return { rows: this.rows.map((row) => row.slice()), shift: this.shift }; }
  static fromJSON(o) { return new Board(o && o.rows ? o.rows : [], o ? o.shift : 0); }

  /** Stabiler Fingerabdruck des Feldes (für Tests/Eindeutigkeit). */
  signature() {
    return this.shift + ':' + this.rows.map((row) => row.map((v) => v.toString(36)).join('')).join('/');
  }
}
