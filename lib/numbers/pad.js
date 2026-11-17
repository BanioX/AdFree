// Zahlen-Familie – Zahlenfeld (Tastatur) und kleines Aufklapp-Fenster neben einer Zelle.
//
//   const pad = numPad({ values: [1, 2, 3], onPick: (n) => …, notes: { on: false, onToggle } });
//   const pop = popover(cellEl, pad.el, { onClose });  pop.close();

import { h } from '../../shared/ui.js';
import { NI } from './icons.js';

/**
 * values: Zahlen auf den Tasten. marked: Set von Zahlen, die hervorgehoben werden (z.B. Notizen).
 * extra: [{ id, label, icon }] zusätzliche Tasten (z.B. Löschen). notes: { on, onToggle(on) }.
 */
export function numPad({ values, onPick, marked = null, extra = [], onExtra, notes = null, cols = 0 } = {}) {
  const el = h('div.np-pad');
  const keys = h('div.np-keys');
  if (cols) keys.style.setProperty('--np-cols', cols);
  let noteOn = !!(notes && notes.on);
  const draw = () => {
    keys.replaceChildren();
    for (const v of values) {
      const b = h('button.np-key', { type: 'button', 'data-v': v }, String(v));
      if (marked && marked.has(v)) b.classList.add('marked');
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick && onPick(v, noteOn); });
      keys.append(b);
    }
    for (const x of extra) {
      const b = h('button.np-key.np-extra', { type: 'button', 'data-id': x.id, 'aria-label': x.label, html: x.icon ? NI[x.icon] || '' : '' });
      if (!x.icon) b.textContent = x.label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onExtra && onExtra(x.id); });
      keys.append(b);
    }
  };
  draw();
  el.append(keys);
  let noteBtn = null;
  if (notes) {
    noteBtn = h('button.np-note', { type: 'button', html: NI.pencil + '<span>Notiz</span>' });
    const paint = () => { noteBtn.classList.toggle('on', noteOn); el.classList.toggle('notes', noteOn); };
    noteBtn.addEventListener('click', (e) => { e.stopPropagation(); noteOn = !noteOn; paint(); notes.onToggle && notes.onToggle(noteOn); });
    paint();
    el.append(noteBtn);
  }
  return {
    el,
    get noteMode() { return noteOn; },
    setMarked(set) { marked = set; draw(); },
  };
}

let openPop = null;

/** Zeigt content in einer Sprechblase über/unter dem Anker. Tippen ausserhalb schliesst. */
export function popover(anchor, content, { onClose, className = '' } = {}) {
  if (openPop) openPop.close();
  const arrow = h('div.np-pop-arrow');
  const box = h('div.np-pop' + (className ? '.' + className : ''), null, content, arrow);
  const shield = h('div.np-shield');
  document.body.append(shield, box);
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const vw = window.innerWidth;
    let left = Math.round(r.left + r.width / 2 - bw / 2);
    left = Math.max(8, Math.min(vw - bw - 8, left));
    const above = r.top - bh - 12 > 8;
    const top = above ? r.top - bh - 12 : r.bottom + 12;
    box.style.left = left + 'px';
    box.style.top = Math.round(top) + 'px';
    box.classList.toggle('below', !above);
    arrow.style.left = Math.round(r.left + r.width / 2 - left) + 'px';
  };
  place();
  requestAnimationFrame(() => box.classList.add('show'));
  let closed = false;
  const api = {
    el: box,
    close() {
      if (closed) return;
      closed = true;
      if (openPop === api) openPop = null;
      box.classList.remove('show');
      shield.remove();
      setTimeout(() => box.remove(), 180);
      onClose && onClose();
    },
    place,
  };
  shield.addEventListener('pointerdown', (e) => { e.preventDefault(); api.close(); });
  openPop = api;
  return api;
}

export function closePopover() { if (openPop) openPop.close(); }
