// Spielbrett als DOM: 9 Blöcke × 9 Felder. Gestochen scharfe Ziffern, Animationen per CSS.
import { h } from '../../shared/ui.js';
import { rowOf, colOf, boxOf } from '../logic/board.js';

const CELL_FLAGS = ['given', 'user', 'wrong', 'conflict', 'sel', 'peer', 'same', 'h-unit', 'h-focus', 'h-block', 'h-pattern', 'h-bad', 'has-notes'];

export class Board {
  /** @param {{ onCell: (i:number) => void }} opts */
  constructor({ onCell }) {
    this.onCell = onCell;
    this.el = h('div.board', { role: 'grid', 'aria-label': 'Sudoku-Brett' });
    this.cells = new Array(81);
    const boxes = [];
    for (let b = 0; b < 9; b++) {
      const box = h('div.box');
      boxes.push(box);
      this.el.append(box);
    }
    for (let i = 0; i < 81; i++) {
      const v = h('span.v');
      const noteEls = [];
      const n = h('div.n');
      for (let d = 1; d <= 9; d++) {
        const e = h('i', null, '');
        noteEls.push(e);
        n.append(e);
      }
      const el = h('div.cell', { role: 'gridcell', 'data-i': i, 'data-r': rowOf(i), 'data-c': colOf(i) }, v, n);
      boxes[boxOf(i)].append(el);
      this.cells[i] = { el, v, n, noteEls, cls: new Set(), val: -1, notes: -1, noteCls: '' };
    }
    this._bindInput();
  }

  _bindInput() {
    let down = false;
    let last = -1;
    const cellAt = (x, y) => {
      const t = document.elementFromPoint(x, y);
      const c = t && t.closest ? t.closest('.cell') : null;
      return c && this.el.contains(c) ? +c.dataset.i : -1;
    };
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      down = true;
      const i = cellAt(e.clientX, e.clientY);
      last = i;
      if (i >= 0) this.onCell(i, 'down');
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const i = cellAt(e.clientX, e.clientY);
      if (i >= 0 && i !== last) { last = i; this.onCell(i, 'move'); }
    });
    const up = () => { down = false; last = -1; };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('pointerleave', up);
  }

  /**
   * Zeichnet alle Felder.
   * view: { values, notes, given:boolean[], flags: Set<string>[] (pro Feld), noteHl: number (Ziffer),
   *         virtualNotes?: Map<i, mask>, elimMask?: Map<i, mask>, hlNotes?: Map<i, mask> }
   */
  paint(view) {
    for (let i = 0; i < 81; i++) {
      const c = this.cells[i];
      const val = view.values[i];
      const real = view.notes[i];
      const virt = view.virtualNotes && view.virtualNotes.get(i);
      const notes = val ? 0 : (real || virt || 0);
      if (c.val !== val) {
        c.v.textContent = val ? String(val) : '';
        c.val = val;
      }
      const flags = view.flags[i];
      if (notes) flags.add('has-notes');
      for (const f of CELL_FLAGS) {
        const on = flags.has(f);
        if (on !== c.cls.has(f)) {
          c.el.classList.toggle(f, on);
          if (on) c.cls.add(f); else c.cls.delete(f);
        }
      }
      // Notizen
      const elim = (view.elimMask && view.elimMask.get(i)) || 0;
      const hlMask = (view.hlNotes && view.hlNotes.get(i)) || 0;
      const sig = `${notes}|${view.noteHl}|${elim}|${hlMask}|${virt && !real ? 1 : 0}`;
      if (c.noteSig !== sig) {
        c.noteSig = sig;
        c.n.classList.toggle('virtual', !!(virt && !real));
        for (let d = 1; d <= 9; d++) {
          const e = c.noteEls[d - 1];
          const b = 1 << (d - 1);
          const on = !!(notes & b);
          const txt = on ? String(d) : '';
          if (e.textContent !== txt) e.textContent = txt;
          e.className = on ? ((elim & b) ? 'el' : (hlMask & b) ? 'hp' : (view.noteHl === d ? 'hl' : '')) : '';
        }
      }
    }
  }

  cellEl(i) { return this.cells[i].el; }

  _anim(el, cls, delay = 0, dur = 700) {
    el.classList.remove(cls);
    // Reflow, damit die Animation neu startet
    void el.offsetWidth;
    el.style.setProperty('--d', `${delay}ms`);
    el.classList.add(cls);
    clearTimeout(el['_t_' + cls]);
    el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), delay + dur);
  }

  pop(i) { this._anim(this.cells[i].el, 'pop', 0, 400); }
  shake(i) { this._anim(this.cells[i].el, 'shake', 0, 450); }
  noteIn(i) { this._anim(this.cells[i].el, 'note-in', 0, 300); }
  flashBad(cells) { for (const i of cells) this._anim(this.cells[i].el, 'flash-bad', 0, 700); }

  /** Welle über eine Einheit, ausgehend von Feld `from`. */
  wave(cells, from) {
    const fr = rowOf(from), fc = colOf(from);
    for (const i of cells) {
      const dist = Math.abs(rowOf(i) - fr) + Math.abs(colOf(i) - fc);
      this._anim(this.cells[i].el, 'wave', dist * 55, 800);
    }
  }

  bounce(cells) {
    cells.forEach((i, k) => this._anim(this.cells[i].el, 'bounce', k * 40, 700));
  }

  /** Grosse Schlusswelle diagonal über das ganze Brett. */
  winWave() {
    for (let i = 0; i < 81; i++) {
      const d = (rowOf(i) + colOf(i)) * 45;
      this._anim(this.cells[i].el, 'win', d, 1100);
    }
  }
}
