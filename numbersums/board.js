// Zahlensummen – Brett-Darstellung (DOM): Zielsummen oben/links, Zellen im Zahlengitter.
import { h } from '../shared/ui.js';
import { CellGrid } from '../lib/numbers/grid.js';
import { REGION_COLORS } from './data/difficulties.js';
import { colorRegions } from './logic/game.js';

export function buildBoard(p, { className = '' } = {}) {
  const { n } = p;
  const grid = new CellGrid({ cols: n, count: n * n, className: 'ns-grid', gap: 3 });
  const colSums = h('div.ns-colsums');
  const rowSums = h('div.ns-rowsums');
  const colEls = [], rowEls = [];
  for (let c = 0; c < n; c++) { const e = h('div.ns-sum', null, h('span', null, String(p.cols[c]))); colEls.push(e); colSums.append(e); }
  for (let r = 0; r < n; r++) { const e = h('div.ns-sum', null, h('span', null, String(p.rows[r]))); rowEls.push(e); rowSums.append(e); }
  const el = h('div.ns-board' + (className ? '.' + className : '') + (p.region ? '.has-regions' : ''), null,
    h('div.ns-corner'), colSums, rowSums, grid.el);

  const colors = colorRegions(p, REGION_COLORS.length);
  const labels = [];
  for (let i = 0; i < n * n; i++) {
    const c = grid.cell(i);
    c.classList.add('ns-cell');
    c.append(h('span.ns-d', null, String(p.digits[i])));
    if (p.region) {
      const g = p.region[i];
      const [bg, ink] = REGION_COLORS[colors[g]];
      c.style.setProperty('--rg', bg);
      c.style.setProperty('--ri', ink);
      // Ränder zum Nachbarbereich etwas betonen
      const r = Math.floor(i / n), cc = i % n;
      if (r === 0 || p.region[i - n] !== g) c.classList.add('bt');
      if (r === n - 1 || p.region[i + n] !== g) c.classList.add('bb');
      if (cc === 0 || p.region[i - 1] !== g) c.classList.add('bl');
      if (cc === n - 1 || p.region[i + 1] !== g) c.classList.add('br');
      if (!labels[g]) {
        const lab = h('span.ns-rlabel', null, String(p.regionSums[g]));
        labels[g] = lab;
        c.append(lab);
        c.classList.add('lab');
      }
    }
  }

  function layout(w, hgt) {
    // Spalten: Summenstreifen (0.78 Zelle) + n Zellen
    const gap = 3;
    const unit = Math.min((w - gap * n) / (n + 0.78), (hgt - gap * n) / (n + 0.78));
    const cs = Math.max(26, Math.min(60, Math.floor(unit)));
    grid.cs = cs;
    grid.el.style.setProperty('--cs', cs + 'px');
    el.style.setProperty('--cs', cs + 'px');
    el.style.setProperty('--ss', Math.round(cs * 0.78) + 'px');
    return cs;
  }

  return {
    el, grid,
    cell: (i) => grid.cell(i),
    rowSum: (r) => rowEls[r],
    colSum: (c) => colEls[c],
    regionLabel: (g) => labels[g],
    lineEl(key) {
      const [kind, idx] = key.split('-');
      return kind === 'row' ? rowEls[+idx] : kind === 'col' ? colEls[+idx] : labels[+idx];
    },
    layout,
  };
}

/** Zeichnet Markierungen (0 offen, 1 bleibt, 2 weg) und fertige Linien. */
export function paintMarks(board, p, marks, done) {
  for (let i = 0; i < marks.length; i++) {
    const c = board.cell(i);
    c.classList.toggle('kept', marks[i] === 1);
    c.classList.toggle('gone', marks[i] === 2);
  }
  for (let r = 0; r < p.n; r++) board.rowSum(r).classList.toggle('done', done.has('row-' + r));
  for (let c = 0; c < p.n; c++) board.colSum(c).classList.toggle('done', done.has('col-' + c));
  if (p.region) p.regionSums.forEach((_, g) => board.regionLabel(g) && board.regionLabel(g).classList.toggle('done', done.has('region-' + g)));
}
