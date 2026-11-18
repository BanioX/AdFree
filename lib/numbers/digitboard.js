// Zahlen-Familie – Brett für Ziffern-Rätsel (DOM + SVG-Linien).
//
//   const b = new DigitBoard(puzzle, {
//     style: 'lined' | 'tiles',      // Linien wie Sudoku oder einzelne Kacheln (Kakuro)
//     regions: [..] | null,          // Region-Id je Zelle → dicke Linien an den Grenzen (Kästen, Käfige)
//     cages: [{ cells, label }] | null, cageStyle: 'dashed' | 'none',  // gestrichelte Käfige (Killer)
//     labels: [{ cell, text }],      // kleine Beschriftung oben links (Käfigsumme, Rechenziel)
//     decorate(cellEl, i),           // z.B. Kakuro-Hinweisfelder
//   });
//   b.layout(w, h); b.paint(state, sel); b.indexAt(x, y)

import { h } from '../../shared/ui.js';
import { peersOf, isWrong, isGiven } from './digitgame.js';

const NS = 'http://www.w3.org/2000/svg';

export class DigitBoard {
  constructor(p, opts = {}) {
    this.p = p;
    this.rows = p.rows;
    this.cols = p.cols;
    this.opts = { style: 'lined', cageStyle: 'dashed', min: 22, max: 72, ...opts };
    this.cs = 40;
    this.gap = this.opts.style === 'tiles' ? (this.opts.gap ?? 3) : 0;
    const max = p.max || 9;
    this.noteCols = max <= 4 ? 2 : 3;
    this.grid = h('div.db-grid');
    this.grid.style.setProperty('--cols', this.cols);
    this.grid.style.setProperty('--gap', this.gap + 'px');
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'db-svg');
    this.svg.setAttribute('aria-hidden', 'true');
    this.el = h('div.db.db-' + this.opts.style + (opts.className ? '.' + opts.className : ''), null, this.grid, this.svg);
    this.el.style.setProperty('--note-cols', this.noteCols);
    this.cells = [];
    this.vEls = [];
    this.noteEls = [];
    const labelAt = new Map((this.opts.labels || []).map((l) => [l.cell, l.text]));
    for (let i = 0; i < p.sol.length; i++) {
      const c = h('div.db-cell', { 'data-i': i });
      if (!p.sol[i]) {
        c.classList.add('blk');
        if (this.opts.decorate) this.opts.decorate(c, i);
      } else {
        const v = h('span.db-v');
        c.append(v);
        this.vEls[i] = v;
        if (labelAt.has(i)) { c.append(h('span.db-lab', null, labelAt.get(i))); c.classList.add('has-lab'); }
      }
      this.cells.push(c);
      this.grid.append(c);
    }
    this._shown = new Array(p.sol.length).fill(-1);
    this._notes = new Array(p.sol.length).fill(-1);
  }

  cell(i) { return this.cells[i] || null; }

  /** Zellgrösse an die Fläche anpassen und Linien neu zeichnen. */
  layout(w, hgt) {
    const g = this.gap;
    let cs = Math.floor((w - g * (this.cols - 1)) / this.cols);
    if (hgt > 0) cs = Math.min(cs, Math.floor((hgt - g * (this.rows - 1)) / this.rows));
    cs = Math.max(this.opts.min, Math.min(this.opts.max, cs));
    this.cs = cs;
    this.el.style.setProperty('--cs', cs + 'px');
    this.drawLines();
    return cs;
  }

  get width() { return this.cols * this.cs + (this.cols - 1) * this.gap; }
  get height() { return this.rows * this.cs + (this.rows - 1) * this.gap; }

  indexAt(x, y) {
    const r = this.grid.getBoundingClientRect();
    const step = this.cs + this.gap;
    const c = Math.floor((x - r.left) / step), row = Math.floor((y - r.top) / step);
    if (c < 0 || row < 0 || c >= this.cols || row >= this.rows) return -1;
    return row * this.cols + c;
  }

  center(i) {
    const r = this.cells[i].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  drawLines() {
    const { rows: R, cols: C, cs, p } = this;
    const W = C * cs + (C - 1) * this.gap, H = R * cs + (R - 1) * this.gap;
    const svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.replaceChildren();
    if (this.opts.style !== 'lined') return;
    const path = (d, cls) => { const e = document.createElementNS(NS, 'path'); e.setAttribute('d', d); e.setAttribute('class', cls); svg.append(e); };
    // dünne Linien
    let thin = '';
    for (let r = 1; r < R; r++) thin += `M0 ${r * cs}H${W}`;
    for (let c = 1; c < C; c++) thin += `M${c * cs} 0V${H}`;
    path(thin, 'db-thin');
    // dicke Linien an Regionsgrenzen
    const reg = this.opts.regions;
    if (reg) {
      let thick = '';
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (c < C - 1 && reg[i] !== reg[i + 1]) thick += `M${(c + 1) * cs} ${r * cs}V${(r + 1) * cs}`;
        if (r < R - 1 && reg[i] !== reg[i + C]) thick += `M${c * cs} ${(r + 1) * cs}H${(c + 1) * cs}`;
      }
      path(thick, 'db-thick');
    }
    // gestrichelte Käfige (nach innen versetzt)
    if (this.opts.cages && this.opts.cageStyle === 'dashed') {
      const d = Math.max(3, Math.round(cs * 0.09));
      let all = '';
      for (const cage of this.opts.cages) all += cagePath(cage.cells, C, cs, d);
      path(all, 'db-cage');
    }
    // Rahmen
    const e = document.createElementNS(NS, 'rect');
    e.setAttribute('x', 1); e.setAttribute('y', 1); e.setAttribute('width', W - 2); e.setAttribute('height', H - 2);
    e.setAttribute('rx', Math.round(cs * 0.22)); e.setAttribute('class', 'db-frame');
    svg.append(e);
    void p;
  }

  /**
   * Zeichnet Werte, Notizen und Hervorhebungen.
   * opts: { conflicts: Set, noteDigit (Ziffer der gewählten Zelle, um gleiche Notizen zu zeigen) }
   */
  paint(st, sel = -1, opts = {}) {
    const p = this.p;
    const selVal = sel >= 0 ? st.vals[sel] : 0;
    const peers = sel >= 0 && p.sol[sel] ? new Set(peersOf(p, sel)) : new Set();
    const conf = opts.conflicts || null;
    for (let i = 0; i < p.sol.length; i++) {
      if (!p.sol[i]) continue;
      const c = this.cells[i];
      const v = st.vals[i];
      if (this._shown[i] !== v) { this.vEls[i].textContent = v ? String(v) : ''; this._shown[i] = v; }
      const n = v ? 0 : st.notes[i];
      if (this._notes[i] !== n) { this.renderNotes(i, n); this._notes[i] = n; }
      c.classList.toggle('given', isGiven(p, i));
      c.classList.toggle('wrong', isWrong(st, i));
      c.classList.toggle('conf', !!(conf && conf.has(i)) && !isWrong(st, i));
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('peer', peers.has(i));
      c.classList.toggle('same', !!selVal && v === selVal && i !== sel);
      const nb = this.noteEls[i];
      if (nb) {
        for (const s of nb.children) s.classList.toggle('hit', !!selVal && +s.dataset.d === selVal);
      }
    }
  }

  renderNotes(i, mask) {
    let box = this.noteEls[i];
    if (!mask) { if (box) box.style.display = 'none'; return; }
    if (!box) {
      box = h('div.db-notes');
      const max = this.p.max || 9;
      for (let d = 1; d <= max; d++) box.append(h('span', { 'data-d': d }, String(d)));
      this.cells[i].append(box);
      this.noteEls[i] = box;
    }
    box.style.display = '';
    for (const s of box.children) s.classList.toggle('on', !!(mask & (1 << +s.dataset.d)));
  }

  /** Kurze CSS-Animation auf einer Zelle. */
  flash(i, cls, ms = 450, delay = 0) {
    const c = this.cells[i];
    if (!c) return;
    const run = () => {
      c.classList.remove(cls);
      void c.offsetWidth;
      c.classList.add(cls);
      setTimeout(() => c.classList.remove(cls), ms);
    };
    if (delay) setTimeout(run, delay); else run();
  }

  /** Welle über eine Gruppe (fertige Reihe, Käfig …). */
  wave(cells, startDelay = 0) {
    cells.forEach((i, k) => this.flash(i, 'db-wave', 700, startDelay + k * 45));
  }

  coach(i) {
    for (const c of this.el.querySelectorAll('.db-coach')) c.classList.remove('db-coach');
    if (i >= 0 && this.cells[i]) this.cells[i].classList.add('db-coach');
  }
}

/**
 * Umriss eines Käfigs, um d Pixel nach innen versetzt (Liniensegmente).
 * Ecken: aussen verkürzt, innen (konkav) verlängert, gerade weiter bis zur Zellgrenze.
 */
export function cagePath(cells, C, cs, d) {
  const set = new Set(cells);
  const has = (r, c) => c >= 0 && c < C && r >= 0 && set.has(r * C + c);
  let out = '';
  for (const i of cells) {
    const r = Math.floor(i / C), c = i % C;
    const x0 = c * cs, y0 = r * cs, x1 = x0 + cs, y1 = y0 + cs;
    // Ende einer Kante: Nachbar entlang der Kante (nr,nc), Diagonale auf der Aussenseite (dr,dc)
    const endOff = (nr, nc, dr, dc) => (!has(nr, nc) ? d : !has(dr, dc) ? 0 : -d);
    if (!has(r - 1, c)) { // oben
      const a = x0 + endOff(r, c - 1, r - 1, c - 1), b = x1 - endOff(r, c + 1, r - 1, c + 1);
      out += `M${a} ${y0 + d}H${b}`;
    }
    if (!has(r + 1, c)) { // unten
      const a = x0 + endOff(r, c - 1, r + 1, c - 1), b = x1 - endOff(r, c + 1, r + 1, c + 1);
      out += `M${a} ${y1 - d}H${b}`;
    }
    if (!has(r, c - 1)) { // links
      const a = y0 + endOff(r - 1, c, r - 1, c - 1), b = y1 - endOff(r + 1, c, r + 1, c - 1);
      out += `M${x0 + d} ${a}V${b}`;
    }
    if (!has(r, c + 1)) { // rechts
      const a = y0 + endOff(r - 1, c, r - 1, c + 1), b = y1 - endOff(r + 1, c, r + 1, c + 1);
      out += `M${x1 - d} ${a}V${b}`;
    }
  }
  return out;
}
