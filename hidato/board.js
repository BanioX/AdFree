// Zahlenschlange – Brett-Darstellung: Zahlengitter + Verbindungslinien (SVG) dahinter.
import { h } from '../shared/ui.js';
import { CellGrid, renderNotes } from '../lib/numbers/grid.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export function buildBoard(puzzle, { gap = 4 } = {}) {
  const { w, h: rows } = puzzle;
  const grid = new CellGrid({ cols: w, count: w * rows, className: 'hd-grid', gap });
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.classList.add('hd-links');
  const el = h('div.hd-board', null, svg, grid.el);
  for (let i = 0; i < w * rows; i++) {
    const c = grid.cell(i);
    c.classList.add('hd-cell');
    c.append(h('span.hd-n'));
  }

  const center = (i) => {
    const s = grid.cs + gap;
    return [(i % w) * s + grid.cs / 2, Math.floor(i / w) * s + grid.cs / 2];
  };

  /** vals, given, links [[a,b,k]], opts { active, bad:Set, notes, ends:[i1,iN], hintCell } */
  function render(vals, given, lnk, opts = {}) {
    const bad = opts.bad || new Set();
    const notes = opts.notes || {};
    for (let i = 0; i < vals.length; i++) {
      const c = grid.cell(i);
      const v = vals[i];
      c.firstChild.textContent = v > 0 ? String(v) : '';
      c.className = 'ng-cell hd-cell'
        + (v < 0 ? ' hole' : v === 0 ? ' empty' : given[i] ? ' given' : ' user')
        + (i === opts.active ? ' active' : '')
        + (bad.has(i) ? ' bad' : '')
        + (opts.ends && opts.ends.includes(i) ? ' end' : '')
        + (c.classList.contains('ng-coach') ? ' ng-coach' : '');
      renderNotes(c, v === 0 ? notes[i] : null);
    }
    // Linien
    const W = w * grid.cs + (w - 1) * gap, H = rows * grid.cs + (rows - 1) * gap;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const sw = Math.max(5, grid.cs * 0.2);
    const parts = [];
    for (const [a, b] of lnk) {
      const [x1, y1] = center(a), [x2, y2] = center(b);
      parts.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    svg.innerHTML = parts.length ? `<path d="${parts.join('')}" stroke-width="${sw.toFixed(1)}"/>` : '';
  }

  function layout(availW, availH) {
    const s = Math.min((availW - gap * (w - 1)) / w, (availH - gap * (rows - 1)) / rows);
    const cs = Math.max(30, Math.min(66, Math.floor(s)));
    grid.cs = cs;
    grid.el.style.setProperty('--cs', cs + 'px');
    return cs;
  }

  return { el, grid, svg, render, layout, cell: (i) => grid.cell(i) };
}
