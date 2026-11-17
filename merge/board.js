// Verdoppeln – Brett-Ansicht: Kacheln als DOM-Elemente, Bewegung nur über transform
// (Web Animations API), damit es auch auf dem iPhone butterweich läuft.
//
// Positionen sind in Prozent der Kachelgrösse angegeben – das Brett kann seine Grösse
// beliebig ändern, ohne dass etwas neu berechnet werden muss. Schriftgrössen in cqw.

import { h } from '../shared/ui.js';
import { STONE, HOLE, valueOf } from './logic.js';
import { tileOf } from './data/skins.js';

const GAP = 0.13;            // Abstand zwischen Feldern relativ zur Feldgrösse
export const SLIDE_MS = 115;
const POP_MS = 230;
const SPAWN_MS = 210;

const fmtValue = (e) => {
  const v = valueOf(e);
  return v >= 100000 ? Math.round(v / 1000) + 'k' : String(v);
};

/** Baut das Gesicht einer Kachel (auch für Menü, Album, Ziel-Anzeige verwendbar). */
export function tileFace(skin, e, opts = {}) {
  const t = tileOf(skin, e);
  const face = h('div.face');
  face.style.backgroundColor = t.color;
  face.style.color = t.ink || skin.ink;
  if (skin.numbers) {
    const label = fmtValue(e);
    face.classList.add('numbers', 'd' + Math.min(5, label.length));
    face.append(h('span.num', null, label));
  } else {
    face.append(h('span.emo', null, t.emoji));
    if (opts.value !== false) face.append(h('span.val', null, fmtValue(e)));
  }
  if (t.extra) {
    face.classList.add('extra');
    face.append(h('span.spark', null, '✨'));
  }
  if (e >= 9) face.classList.add('glow');
  return face;
}

export class BoardView {
  /**
   * @param {HTMLElement} host  Element, in das das Brett gesetzt wird
   * @param {object} o { size, walls, skin }
   */
  constructor(host, o) {
    this.size = o.size;
    this.walls = o.walls;
    this.skin = o.skin;
    this.tiles = new Map(); // id → { el, face, e, at }
    this.dying = new Set();
    this.anims = [];
    this.timers = [];
    const n = this.size;
    const cell = 1 / (n + GAP * (n + 1));
    this.cellPct = cell * 100;
    this.gapPct = cell * GAP * 100;
    this.step = (1 + GAP) * 100; // Verschiebung pro Feld in % der Kachelgrösse

    this.el = h('div.board');
    this.el.style.setProperty('--cell', this.cellPct + '%');
    this.el.style.setProperty('--gap', this.gapPct + '%');
    this.el.style.setProperty('--cq', String(cell * 100)); // Feldgrösse in cqw
    this.bg = h('div.board-bg');
    this.layer = h('div.tiles');
    this.fx = h('div.fx');
    this.el.append(this.bg, this.layer, this.fx);
    host.append(this.el);
    this.applySkin();
    this.drawBase();
  }

  applySkin() {
    const s = this.skin;
    this.el.style.setProperty('--board', s.board);
    this.el.style.setProperty('--slot', s.slot);
    this.el.classList.toggle('dark', !!s.dark);
  }

  setSkin(skin, state) {
    this.skin = skin;
    this.applySkin();
    if (state) this.renderAll(state);
  }

  pos(at) {
    const r = Math.floor(at / this.size), c = at % this.size;
    return `translate(${c * this.step}%, ${r * this.step}%)`;
  }

  /** Hintergrund: Brett-Fläche (ohne Löcher), leere Felder, Steine. */
  drawBase() {
    const n = this.size, w = this.walls;
    const isBoard = (r, c) => r >= 0 && c >= 0 && r < n && c < n && w[r * n + c] !== HOLE;
    this.bg.textContent = '';
    for (let i = 0; i < n * n; i++) {
      if (w[i] === HOLE) continue;
      const r = Math.floor(i / n), c = i % n;
      // Brett-Stück: Feld plus halber Abstand rundherum
      const base = h('div.base');
      base.style.transform = this.pos(i);
      const rad = (up, side) => (!isBoard(r + up, c) && !isBoard(r, c + side) ? 'var(--rad-out)' : '0');
      base.style.borderRadius = `${rad(-1, -1)} ${rad(-1, 1)} ${rad(1, 1)} ${rad(1, -1)}`;
      this.bg.append(base);
    }
    for (let i = 0; i < n * n; i++) {
      if (w[i] === HOLE) continue;
      const el = h(w[i] === STONE ? 'div.stone' : 'div.slot');
      el.style.transform = this.pos(i);
      if (w[i] === STONE) el.append(h('span.stone-in'));
      this.bg.append(el);
    }
  }

  makeTile(id, e, at) {
    const el = h('div.tile');
    el.style.transform = this.pos(at);
    const face = tileFace(this.skin, e);
    el.append(face);
    this.layer.append(el);
    const t = { el, face, e, at };
    this.tiles.set(id, t);
    return t;
  }

  /** Alles ohne Animation neu zeichnen. */
  renderAll(state) {
    this.settle();
    this.layer.textContent = '';
    this.tiles.clear();
    state.cells.forEach((c, i) => { if (c) this.makeTile(c.id, c.e, i); });
  }

  /** Laufende Animationen sofort beenden (für schnelle Wischer hintereinander). */
  settle() {
    for (const tm of this.timers) clearTimeout(tm);
    this.timers = [];
    for (const a of this.anims) { try { a.finish(); } catch { /* schon fertig */ } }
    this.anims = [];
    for (const el of this.dying) el.remove();
    this.dying.clear();
  }

  track(a) { this.anims.push(a); return a; }

  /** Einen Zug animieren (Ergebnis von logic.move). onMerge(merge) für Effekte. */
  animate(res, onMerge) {
    this.settle();
    const ease = 'cubic-bezier(.2,.75,.35,1)';
    const consumed = new Set();
    for (const m of res.merges) { consumed.add(m.from[0]); consumed.add(m.from[1]); }
    for (const mv of res.moves) {
      const t = this.tiles.get(mv.id);
      if (!t) continue;
      if (mv.from !== mv.to) {
        const from = this.pos(mv.from), to = this.pos(mv.to);
        t.el.style.transform = to;
        this.track(t.el.animate([{ transform: from }, { transform: to }], { duration: SLIDE_MS, easing: ease }));
      }
      t.at = mv.to;
      if (consumed.has(mv.id)) {
        this.tiles.delete(mv.id);
        this.dying.add(t.el);
        t.el.classList.add('dying');
        const el = t.el;
        this.timers.push(setTimeout(() => { el.remove(); this.dying.delete(el); }, SLIDE_MS + 10));
      }
    }
    for (const m of res.merges) {
      const t = this.makeTile(m.id, m.e, m.at);
      t.el.classList.add('merged');
      this.track(t.face.animate([
        { transform: 'scale(0.4)', opacity: 0 },
        { transform: 'scale(1.16)', opacity: 1, offset: 0.55 },
        { transform: 'scale(0.97)', offset: 0.8 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: POP_MS, delay: SLIDE_MS - 20, easing: 'ease-out', fill: 'backwards' }));
      if (onMerge) this.timers.push(setTimeout(() => onMerge(m), SLIDE_MS - 10));
    }
    if (res.spawn) {
      const s = res.spawn;
      const t = this.makeTile(s.id, s.e, s.at);
      this.track(t.face.animate([
        { transform: 'scale(0)', opacity: 0 },
        { transform: 'scale(1.06)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: SPAWN_MS, delay: SLIDE_MS + 25, easing: 'ease-out', fill: 'backwards' }));
    }
  }

  /** Kleiner Ruck in Wischrichtung, wenn sich nichts bewegt. */
  nudge(dir) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 0];
    const a = this.layer.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${d[0] * 1.2}%, ${d[1] * 1.2}%)`, offset: 0.35 },
      { transform: 'translate(0,0)' },
    ], { duration: 220, easing: 'ease-out' });
    this.track(a);
  }

  /** Ring-Effekt an einer Stelle (bei grossen Verschmelzungen). */
  burst(at, color) {
    const el = h('div.burst');
    el.style.transform = this.pos(at);
    el.style.setProperty('--c', color);
    this.fx.append(el);
    const a = el.animate([
      { transform: this.pos(at) + ' scale(0.6)', opacity: 0.9 },
      { transform: this.pos(at) + ' scale(1.6)', opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' });
    a.onfinish = () => el.remove();
    a.oncancel = () => el.remove();
  }

  /** Tipp-Pfeil über dem Brett. */
  hint(dir) {
    this.clearHint();
    const rot = { up: -90, right: 0, down: 90, left: 180 }[dir];
    const el = h('div.hint-arrow', { 'aria-hidden': 'true' });
    el.innerHTML = '<svg viewBox="0 0 100 100"><path d="M18 42h40V24l30 26-30 26V58H18z"/></svg>';
    el.style.setProperty('--rot', rot + 'deg');
    this.fx.append(el);
    this.hintEl = el;
    this.hintTimer = setTimeout(() => this.clearHint(), 2600);
  }

  /**
   * Coach-Mark für den allerersten Zug: ein Finger wischt in Richtung dir über das Brett,
   * dazu ein kurzer Text. Verschwindet mit clearCoach() (nach dem ersten Zug).
   */
  coach(dir, text) {
    this.clearCoach();
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [-1, 0];
    const el = h('div.coach', { 'aria-hidden': 'true' });
    el.style.setProperty('--dx', v[0]);
    el.style.setProperty('--dy', v[1]);
    el.style.setProperty('--rot', { up: -90, right: 0, down: 90, left: 180 }[dir] + 'deg');
    el.innerHTML = '<div class="coach-trail"></div>'
      + '<div class="coach-hand"><svg viewBox="0 0 48 48"><path d="M19 6.5c2 0 3.5 1.5 3.5 3.5v13.2l1.3-.3c.3-1.6 1.7-2.7 3.4-2.7 1.4 0 2.6.8 3.1 2 .6-.6 1.5-1 2.5-1 1.6 0 2.9 1 3.3 2.5.5-.3 1.1-.4 1.7-.4 1.9 0 3.4 1.5 3.4 3.4V34c0 6-4.6 10.5-10.6 10.5h-3.6c-3.6 0-6.3-1.3-8.4-4.1l-7.3-9.6c-1.1-1.5-.8-3.6.7-4.7 1.4-1 3.3-.8 4.4.4l2.2 2.4V10c0-2 1.5-3.5 3.4-3.5z"/></svg></div>';
    if (text) el.append(h('div.coach-text' + (v[1] > 0 ? '.top' : ''), null, text));
    this.fx.append(el);
    this.coachEl = el;
  }

  clearCoach() {
    if (!this.coachEl) return;
    const el = this.coachEl;
    this.coachEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    if (this.hintEl) {
      const el = this.hintEl;
      this.hintEl = null;
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }
  }

  destroy() {
    this.settle();
    this.clearHint();
    this.clearCoach();
    this.el.remove();
  }
}

/**
 * Wischgesten (Pointer Events) und Pfeiltasten. Ruft onDir('up'|'right'|'down'|'left') auf.
 * Die Richtung wird schon während der Bewegung erkannt (fühlt sich direkter an).
 */
export function bindInput(area, onDir, extraKeys = {}) {
  let start = null;
  const TH = 16; // px bis eine Wischbewegung zählt
  const down = (e) => {
    if (e.target.closest('button, a, .sp-modal-backdrop')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), fired: false };
  };
  const move = (e) => {
    if (!start || start.fired || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < TH) return;
    if (Math.max(ax, ay) < Math.min(ax, ay) * 1.15) return; // zu diagonal – noch abwarten
    start.fired = true;
    onDir(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  const up = (e) => {
    if (!start || e.pointerId !== start.id) return;
    // Sehr kurze, schnelle Wischer ebenfalls zulassen
    if (!start.fired) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) >= 10 && performance.now() - start.t < 250) {
        onDir(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }
    }
    start = null;
  };
  const cancel = () => { start = null; };
  const keys = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };
  const key = (e) => {
    if (e.metaKey || e.altKey || document.querySelector('.sp-modal-backdrop, .tut-backdrop')) return;
    if (extraKeys[e.key] && !e.ctrlKey) { e.preventDefault(); extraKeys[e.key](); return; }
    if ((e.ctrlKey && e.key === 'z') && extraKeys.undo) { e.preventDefault(); extraKeys.undo(); return; }
    const dir = keys[e.key];
    if (dir && !e.ctrlKey) { e.preventDefault(); onDir(dir); }
  };
  // iOS: kein Gummiband-Scrollen während des Wischens
  const touchmove = (e) => { if (e.cancelable) e.preventDefault(); };
  area.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
  area.addEventListener('touchmove', touchmove, { passive: false });
  return () => {
    area.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
    area.removeEventListener('touchmove', touchmove);
  };
}
