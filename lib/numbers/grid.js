// Zahlen-Familie – gemeinsames Zahlengitter (DOM) mit Treffer-Test, Tippen & Ziehen.
//
//   import { CellGrid, bindPointer } from '../lib/numbers/grid.js';
//   const grid = new CellGrid({ cols: 9, count: 27, className: 'nm-grid' });
//   grid.fit(width, height, { min: 30, max: 56 });     // Zellgrösse an Platz anpassen
//   grid.cell(4).textContent = '7';
//   bindPointer(grid.el, grid, { tap(i) {}, down(i) {}, move(i) {}, up(i) {} });
//
// Zellen sind <div class="ng-cell" data-i="…">, die Grösse steckt in --cs (px).

import { h } from '../../shared/ui.js';

export class CellGrid {
  constructor({ cols, rows = 0, count, className = '', gap = 0 } = {}) {
    this.cols = cols;
    this.gap = gap;
    this.cs = 40;
    this.el = h('div.ng' + (className ? '.' + className.split(' ').join('.') : ''));
    this.el.style.setProperty('--cols', cols);
    this.el.style.setProperty('--gap', gap + 'px');
    this.cells = [];
    this.build(count != null ? count : rows * cols);
  }

  /** Baut die Zellen neu (Anzahl in Lesereihenfolge). */
  build(count) {
    const frag = document.createDocumentFragment();
    if (count < this.cells.length) {
      for (const c of this.cells.splice(count)) c.remove();
    }
    for (let i = this.cells.length; i < count; i++) {
      const c = h('div.ng-cell', { 'data-i': i });
      this.cells.push(c);
      frag.append(c);
    }
    this.el.append(frag);
    this.count = count;
    this.rows = Math.ceil(count / this.cols);
    return this;
  }

  cell(i) { return this.cells[i] || null; }

  /** Passt die Zellgrösse an die verfügbare Fläche an (Höhe optional: 0 = egal). */
  fit(width, height, { min = 24, max = 64, rows = this.rows } = {}) {
    const g = this.gap;
    let cs = Math.floor((width - g * (this.cols - 1)) / this.cols);
    if (height > 0 && rows > 0) cs = Math.min(cs, Math.floor((height - g * (rows - 1)) / rows));
    cs = Math.max(min, Math.min(max, cs));
    this.cs = cs;
    this.el.style.setProperty('--cs', cs + 'px');
    return cs;
  }

  rectOf(i) { const c = this.cell(i); return c ? c.getBoundingClientRect() : null; }

  center(i) {
    const r = this.rectOf(i);
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  /**
   * Zelle unter einem Bildschirmpunkt. inner < 1 verlangt, dass der Punkt im inneren Teil
   * der Zelle liegt (so wird beim diagonalen Ziehen nicht die Nachbarzelle erwischt).
   */
  indexAt(x, y, inner = 1) {
    const r = this.el.getBoundingClientRect();
    const step = this.cs + this.gap;
    const fx = (x - r.left) / step, fy = (y - r.top) / step;
    if (fx < 0 || fy < 0) return -1;
    const c = Math.floor(fx), row = Math.floor(fy);
    if (c >= this.cols || row >= this.rows) return -1;
    const i = row * this.cols + c;
    if (i >= this.count) return -1;
    if (inner < 1) {
      const ox = (fx - c) * step / this.cs - 0.5, oy = (fy - row) * step / this.cs - 0.5;
      if (Math.abs(ox) > inner / 2 || Math.abs(oy) > inner / 2) return -1;
    }
    return i;
  }

  /** Kurze CSS-Animation auf einer Zelle (Klasse wird danach entfernt). */
  flash(i, cls, ms = 450) {
    const c = this.cell(i);
    if (!c) return;
    c.classList.remove(cls);
    void c.offsetWidth;
    c.classList.add(cls);
    setTimeout(() => c.classList.remove(cls), ms);
  }

  /** Coach-Mark: pulsierender Ring um eine Zelle (oder -1 zum Entfernen). */
  coach(i) {
    for (const c of this.el.querySelectorAll('.ng-coach')) c.classList.remove('ng-coach');
    if (i >= 0 && this.cell(i)) this.cell(i).classList.add('ng-coach');
  }
}

/** Kleine Notizen (Merkzahlen) in einer Zelle darstellen. */
export function renderNotes(cellEl, notes, { max = 9 } = {}) {
  let box = cellEl.querySelector('.ng-notes');
  if (!notes || !notes.length) { if (box) box.remove(); return; }
  if (!box) { box = h('div.ng-notes'); cellEl.append(box); }
  const list = [...notes].sort((a, b) => a - b).slice(0, max);
  box.dataset.n = list.length;
  box.replaceChildren(...list.map((n) => h('span', null, String(n))));
}

/**
 * Tippen und Ziehen über ein Gitter (Pointer Events).
 * handlers: { down(i, e), move(i, e) – beim Betreten einer neuen Zelle, up(i, e, moved), tap(i, e) }
 * opts: { inner: 0.72 Trefferzone beim Ziehen, threshold: 8 px bis «Ziehen» }
 */
export function bindPointer(target, grid, handlers, opts = {}) {
  const inner = opts.inner ?? 0.72;
  const threshold = opts.threshold ?? 8;
  let active = null;
  const at = (e, inn = 1) => grid.indexAt(e.clientX, e.clientY, inn);

  function onDown(e) {
    if (active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const i = at(e);
    active = { id: e.pointerId, x: e.clientX, y: e.clientY, start: i, last: i, moved: false };
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (handlers.down) handlers.down(i, e);
  }
  function onMove(e) {
    if (!active || e.pointerId !== active.id) return;
    if (!active.moved && Math.hypot(e.clientX - active.x, e.clientY - active.y) < threshold) return;
    active.moved = true;
    const i = at(e, inner);
    if (i >= 0 && i !== active.last) {
      active.last = i;
      if (handlers.move) handlers.move(i, e);
    }
    e.preventDefault();
  }
  function onUp(e) {
    if (!active || e.pointerId !== active.id) return;
    const a = active;
    active = null;
    const i = at(e);
    if (handlers.up) handlers.up(i, e, a.moved);
    if (!a.moved && i >= 0 && i === a.start && handlers.tap) handlers.tap(i, e);
  }
  function onCancel(e) {
    if (!active || e.pointerId !== active.id) return;
    active = null;
    if (handlers.cancel) handlers.cancel();
  }
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove, { passive: false });
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
  };
}
