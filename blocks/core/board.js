// Spielbrett (n×n) mit Bitmasken pro Zeile. Rein logisch, ohne DOM.
//
//   cells[i]  0 = leer, 1..8 = Stein (Farbindex + 1)
//   gems[i]   0 = keiner, 1..5 = Edelstein (Index in GEM_KEYS + 1) – liegt immer auf einem Stein
//   cover[i]  1 = verdeckt (Bild-Level): wird aufgedeckt, wenn eine Linie durch das Feld abgeräumt wird

import { GEM_KEYS } from '../data/skins.js';

// Steinfarbe, auf der ein Edelstein liegt (passend zum Edelstein)
export const GEM_BLOCK_COLOR = { r: 0, b: 5, g: 3, y: 2, p: 6 };

export class Board {
  constructor(n = 8) {
    this.n = n;
    this.full = (1 << n) - 1;
    this.cells = new Uint8Array(n * n);
    this.gems = new Uint8Array(n * n);
    this.cover = new Uint8Array(n * n);
    this.rows = new Uint16Array(n);
  }

  clone() {
    const b = new Board(this.n);
    b.cells.set(this.cells);
    b.gems.set(this.gems);
    b.cover.set(this.cover);
    b.rows.set(this.rows);
    return b;
  }

  idx(r, c) { return r * this.n + c; }

  syncMasks() {
    const n = this.n;
    this.rows.fill(0);
    for (let r = 0; r < n; r++) {
      let m = 0;
      for (let c = 0; c < n; c++) if (this.cells[r * n + c]) m |= 1 << c;
      this.rows[r] = m;
    }
  }

  get filledCount() {
    let k = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) k++;
    return k;
  }

  get isEmpty() {
    for (let r = 0; r < this.n; r++) if (this.rows[r]) return false;
    return true;
  }

  countGems() {
    const out = {};
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      if (g) { const k = GEM_KEYS[g - 1]; out[k] = (out[k] || 0) + 1; }
    }
    return out;
  }

  countCover() {
    let k = 0;
    for (let i = 0; i < this.cover.length; i++) if (this.cover[i]) k++;
    return k;
  }

  canPlace(v, r, c) {
    if (r < 0 || c < 0 || r + v.h > this.n || c + v.w > this.n) return false;
    for (let i = 0; i < v.h; i++) if (this.rows[r + i] & (v.masks[i] << c)) return false;
    return true;
  }

  fits(v) {
    const n = this.n;
    for (let r = 0; r + v.h <= n; r++) {
      for (let c = 0; c + v.w <= n; c++) if (this.canPlace(v, r, c)) return true;
    }
    return false;
  }

  placements(v) {
    const out = [];
    const n = this.n;
    for (let r = 0; r + v.h <= n; r++) {
      for (let c = 0; c + v.w <= n; c++) if (this.canPlace(v, r, c)) out.push([r, c]);
    }
    return out;
  }

  /** Welche Zeilen/Spalten würden durch das Setzen voll? (ohne zu setzen) */
  previewLines(v, r, c) {
    const rowsAfter = this.rows.slice();
    for (let i = 0; i < v.h; i++) rowsAfter[r + i] |= v.masks[i] << c;
    return fullLines(rowsAfter, this.n);
  }

  /**
   * Setzt Variante v an (r, c) mit Farbe color (0..7) und räumt volle Linien ab.
   * Rückgabe: { placed: [i], rows: [r], cols: [c], lines, cleared: [{ i, color, gem, cover }] }
   */
  place(v, r, c, color = v.color) {
    const n = this.n;
    const placed = [];
    for (const [dr, dc] of v.cells) {
      const i = (r + dr) * n + (c + dc);
      this.cells[i] = color + 1;
      placed.push(i);
    }
    for (let i = 0; i < v.h; i++) this.rows[r + i] |= v.masks[i] << c;
    const { rows, cols, colMask } = fullLines(this.rows, n);
    const cleared = [];
    if (rows.length || cols.length) {
      const mark = new Uint8Array(n * n);
      for (const rr of rows) for (let cc = 0; cc < n; cc++) mark[rr * n + cc] = 1;
      for (const cc of cols) for (let rr = 0; rr < n; rr++) mark[rr * n + cc] = 1;
      for (let i = 0; i < n * n; i++) {
        if (!mark[i]) continue;
        cleared.push({ i, color: this.cells[i] - 1, gem: this.gems[i], cover: this.cover[i] });
        this.cells[i] = 0;
        this.gems[i] = 0;
        this.cover[i] = 0;
      }
      for (let rr = 0; rr < n; rr++) this.rows[rr] &= ~colMask;
      for (const rr of rows) this.rows[rr] = 0;
    }
    return { placed, rows, cols, lines: rows.length + cols.length, cleared };
  }

  serialize() {
    let cells = '', gems = '', cover = '';
    for (let i = 0; i < this.cells.length; i++) {
      cells += String(this.cells[i]);
      gems += this.gems[i] ? GEM_KEYS[this.gems[i] - 1] : '.';
      cover += this.cover[i] ? 'x' : '.';
    }
    return { n: this.n, cells, gems, cover };
  }

  static deserialize(d) {
    const b = new Board(d.n);
    for (let i = 0; i < b.cells.length; i++) {
      b.cells[i] = Math.max(0, Math.min(8, (d.cells.charCodeAt(i) - 48) | 0));
      const g = d.gems ? GEM_KEYS.indexOf(d.gems[i]) : -1;
      b.gems[i] = g >= 0 && b.cells[i] ? g + 1 : 0;
      b.cover[i] = d.cover && d.cover[i] === 'x' ? 1 : 0;
    }
    b.syncMasks();
    return b;
  }

  /**
   * Brett aus Text-Zeilen (Level-Daten):
   *   '.' leer, '1'–'8' Stein mit Farbe 0–7, 'r','b','g','y','p' Stein mit Edelstein.
   * cover: optional Zeilen mit 'x' = verdeckt, oder 'all'.
   */
  static fromLayout(n, rows, cover = null) {
    const b = new Board(n);
    for (let r = 0; r < n; r++) {
      const line = (rows && rows[r]) || '';
      for (let c = 0; c < n; c++) {
        const ch = line[c] || '.';
        const i = r * n + c;
        if (ch >= '1' && ch <= '8') b.cells[i] = ch.charCodeAt(0) - 48;
        else if (GEM_KEYS.includes(ch)) {
          b.cells[i] = GEM_BLOCK_COLOR[ch] + 1;
          b.gems[i] = GEM_KEYS.indexOf(ch) + 1;
        }
        if (cover === 'all') b.cover[i] = 1;
        else if (Array.isArray(cover) && cover[r] && cover[r][c] === 'x') b.cover[i] = 1;
      }
    }
    b.syncMasks();
    return b;
  }
}

/** Volle Zeilen/Spalten zu einem Satz Zeilenmasken. */
export function fullLines(rowsArr, n) {
  const full = (1 << n) - 1;
  const rows = [];
  let colMask = full;
  for (let r = 0; r < n; r++) {
    if (rowsArr[r] === full) rows.push(r);
    colMask &= rowsArr[r];
  }
  const cols = [];
  for (let c = 0; c < n; c++) if (colMask & (1 << c)) cols.push(c);
  return { rows, cols, colMask };
}
