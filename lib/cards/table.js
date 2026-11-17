// CardTable – Spielkarten als DOM-Elemente auf einer Spielfläche, mit eigener Tween-Schleife
// (rAF, schläft wenn ruhig), Antippen, Ziehen & Ablegen, Auswahl, Tipp-Leuchten, Coach-Ring
// und einem Gewinn-Fächer. Das Spiel berechnet die Zielpositionen selbst und übergibt sie.
//
//   const t = new CardTable(el, {
//     onTap(id), onSlot(name), onBg(),           // Antippen (Karte / Platzhalter / leere Fläche)
//     canDrag(id) -> bool,                        // darf die Karte gezogen werden?
//     canDrop(id, target) -> bool,                // Leuchten über einem möglichen Ziel
//     onDrop(id, target) -> bool,                 // target: { card } | { slot } | null; false = zurück
//     onResize(),                                 // Grösse der Fläche hat sich geändert
//   });
//   t.setSize(cw, ch); t.build(codes);
//   t.slot('stock', { html, cls }); t.placeSlot('stock', x, y);
//   t.set(T);                       // sofort (T[id] = { x, y, z, up, rot?, s?, op?, b?, hide? })
//   await t.move(T, { dur, stagger, order, arc, lift, delay });   // animiert
//   t.select(id), t.hint([ids], ms), t.shake(id), t.coach({ card } | { slot } | null)
//   await t.fan(ids)                // Gewinn-Fächer

import { faceHTML, installSprite } from './face.js';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CardTable {
  constructor(el, handlers = {}) {
    installSprite();
    this.el = el;
    el.classList.add('ctable');
    this.h = handlers;
    this.cards = [];
    this.T = [];
    this.slots = new Map();
    this.anims = new Map();
    this.waiters = [];
    this.raf = 0;
    this.locked = false;
    this.cw = 50;
    this.ch = 70;
    this.press = null;
    this.drag = null;
    this.sel = null;
    this.hintTimer = 0;
    this.glowEl = document.createElement('div');
    this.glowEl.className = 'pc-glow';
    this.ringEl = document.createElement('div');
    this.ringEl.className = 'pc-ring';
    el.append(this.glowEl, this.ringEl);
    this.tick = this.tick.bind(this);
    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e);
    this._cancel = () => this.onCancel();
    el.addEventListener('pointerdown', this._down);
    el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up);
    el.addEventListener('pointercancel', this._cancel);
    el.addEventListener('lostpointercapture', () => { if (this.drag || this.press) this.onCancel(); });
    if (typeof ResizeObserver !== 'undefined') {
      let last = '';
      this.ro = new ResizeObserver(() => {
        const k = el.clientWidth + 'x' + el.clientHeight;
        if (k === last) return;
        last = k;
        if (this.h.onResize) this.h.onResize();
      });
      this.ro.observe(el);
    }
  }

  destroy() {
    if (this.ro) this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.hintTimer);
    this.anims.clear();
    const w = this.waiters; this.waiters = []; w.forEach((r) => r());
  }

  get width() { return this.el.clientWidth || 375; }
  get height() { return this.el.clientHeight || 560; }

  setSize(cw, ch) {
    this.cw = Math.round(cw);
    this.ch = Math.round(ch);
    this.el.style.setProperty('--cw', this.cw + 'px');
    this.el.style.setProperty('--ch', this.ch + 'px');
    this.el.classList.toggle('compact', this.cw < 46);
    this.el.classList.toggle('tiny', this.cw < 34);
  }

  // ------------------------------------------------------------ Aufbau

  build(codes) {
    for (const c of this.cards) c.el.remove();
    this.anims.clear();
    this.cards = [];
    this.T = [];
    this.sel = null;
    const frag = document.createDocumentFragment();
    codes.forEach((code, id) => {
      const el = document.createElement('div');
      el.className = 'pcard';
      el.dataset.id = id;
      el.innerHTML = `<div class="pin">${faceHTML(code)}<div class="pb"></div></div>`;
      frag.append(el);
      this.cards.push({ el, pin: el.firstChild, code, x: 0, y: -400, z: 0, rot: 0, s: 1, sx: 1, op: 1, up: false, b: false, hide: false });
    });
    this.el.append(frag);
  }

  /** Platzhalter (Talon, Ablage …) anlegen oder holen. */
  slot(name, { html = '', cls = '' } = {}) {
    let s = this.slots.get(name);
    if (!s) {
      s = document.createElement('div');
      s.className = 'pslot' + (cls ? ' ' + cls : '');
      s.dataset.slot = name;
      this.el.prepend(s);
      this.slots.set(name, s);
    }
    if (html != null) s.innerHTML = html;
    return s;
  }

  placeSlot(name, x, y, show = true) {
    const s = this.slots.get(name);
    if (!s) return;
    s.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    s.style.display = show ? '' : 'none';
    s._x = x; s._y = y;
  }

  /** Eigenes Element (z.B. Zähler-Plakette) auf die Fläche legen. */
  add(el) { this.el.append(el); return el; }

  // ------------------------------------------------------------ Positionen

  set(T) {
    this.anims.clear();
    this.T = T;
    this.cards.forEach((c, id) => {
      const t = T[id];
      if (!t) return;
      c.x = t.x; c.y = t.y; c.rot = t.rot || 0; c.s = t.s || 1; c.sx = 1;
      c.op = t.op == null ? 1 : t.op;
      this.setUp(c, !!t.up);
      c.z = t.z || 0;
      c.el.style.zIndex = c.z;
      this.setFlag(c, 'b', !!t.b, 'buried');
      this.setFlag(c, 'hide', !!t.hide, 'hidden-card');
      this.apply(c);
    });
    this.flush();
  }

  setUp(c, up) { if (c.up !== up) { c.up = up; c.el.classList.toggle('up', up); } }
  setFlag(c, k, v, cls) { if (c[k] !== v) { c[k] = v; c.el.classList.toggle(cls, v); } }

  apply(c) {
    let tr = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)`;
    if (c.rot) tr += ` rotate(${c.rot.toFixed(2)}deg)`;
    const sx = c.s * c.sx, sy = c.s;
    if (sx !== 1 || sy !== 1) tr += ` scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    c.el.style.transform = tr;
    c.el.style.opacity = c.op === 1 ? '' : c.op.toFixed(3);
  }

  /**
   * Bewegt alle Karten, deren Ziel sich geändert hat.
   * opts: { dur, stagger, delay, order:[ids], arc (px Bogen nach oben), lift (Skalierung in der Mitte) }
   */
  move(T, opts = {}) {
    this.T = T;
    const now = performance.now();
    const order = opts.order || [];
    const seen = new Set();
    let k = 0;
    const list = [...order, ...this.cards.map((_, id) => id)];
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      const c = this.cards[id];
      const t = T[id];
      if (!c || !t) continue;
      if (this.drag && this.drag.id === id) continue;
      const rot1 = t.rot || 0, s1 = t.s || 1, op1 = t.op == null ? 1 : t.op;
      const dist = Math.hypot(t.x - c.x, t.y - c.y);
      const flip = c.up !== !!t.up;
      const changed = dist >= 0.5 || flip || Math.abs(rot1 - c.rot) > 0.1 || Math.abs(s1 - c.s) > 0.002 || Math.abs(op1 - c.op) > 0.01;
      if (!changed) {
        const an = this.anims.get(id);
        if (an) { an.z1 = t.z; an.b1 = !!t.b; an.hide1 = !!t.hide; }
        else {
          if (c.z !== t.z) { c.z = t.z; c.el.style.zIndex = t.z; }
          this.setFlag(c, 'b', !!t.b, 'buried');
          this.setFlag(c, 'hide', !!t.hide, 'hidden-card');
        }
        continue;
      }
      const dur = opts.dur || Math.max(200, Math.min(420, 170 + dist * 0.5));
      const delay = (opts.delay || 0) + (dist >= 0.5 ? k++ * (opts.stagger || 0) : 0);
      this.anims.set(id, {
        x0: c.x, y0: c.y, x1: t.x, y1: t.y, r0: c.rot, r1: rot1, s0: c.s, s1, o0: c.op, o1: op1,
        t0: now + delay, dur: dist < 0.5 && flip ? 240 : dur, flip, up1: !!t.up, flipped: false,
        z1: t.z, b1: !!t.b, hide1: !!t.hide, zFly: 5000 + k, started: false,
        lift: dist < 0.5 ? 0 : (opts.lift ?? 0.07), arc: dist < 0.5 ? 0 : (opts.arc || 0),
        ease: dist > 260 ? easeInOut : easeOut,
      });
    }
    this.kick();
    return this.idle();
  }

  idle() {
    if (!this.anims.size) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  get busy() { return this.anims.size > 0; }

  kick() { if (!this.raf && this.anims.size) this.raf = requestAnimationFrame(this.tick); }

  /** Laufende Animationen sofort beenden. */
  flush() {
    if (!this.anims.size && !this.waiters.length) return;
    for (const [id, a] of this.anims) this.finish(this.cards[id], a);
    this.anims.clear();
    const w = this.waiters; this.waiters = []; w.forEach((r) => r());
  }

  finish(c, a) {
    c.x = a.x1; c.y = a.y1; c.rot = a.r1; c.s = a.s1; c.sx = 1; c.op = a.o1;
    this.setUp(c, a.up1);
    c.z = a.z1; c.el.style.zIndex = a.z1;
    this.setFlag(c, 'b', a.b1, 'buried');
    this.setFlag(c, 'hide', a.hide1, 'hidden-card');
    this.apply(c);
  }

  tick(now) {
    this.raf = 0;
    for (const [id, a] of this.anims) {
      const c = this.cards[id];
      const p = (now - a.t0) / a.dur;
      if (p < 0) continue;
      if (!a.started) {
        a.started = true;
        c.el.style.zIndex = a.zFly;
        this.setFlag(c, 'b', false, 'buried');
        this.setFlag(c, 'hide', false, 'hidden-card');
      }
      const q = Math.min(1, p);
      const e = a.ease(q);
      const bump = Math.sin(Math.PI * q);
      c.x = a.x0 + (a.x1 - a.x0) * e;
      c.y = a.y0 + (a.y1 - a.y0) * e - a.arc * bump;
      c.rot = a.r0 + (a.r1 - a.r0) * e;
      c.s = (a.s0 + (a.s1 - a.s0) * e) * (1 + a.lift * bump);
      c.op = a.o0 + (a.o1 - a.o0) * e;
      c.sx = 1;
      if (a.flip) {
        c.sx = Math.max(0.02, Math.abs(Math.cos(Math.PI * q)));
        if (q >= 0.5 && !a.flipped) { a.flipped = true; this.setUp(c, a.up1); }
      }
      this.apply(c);
      if (q >= 1) {
        this.finish(c, a);
        this.anims.delete(id);
      }
    }
    if (this.anims.size) this.raf = requestAnimationFrame(this.tick);
    else { const w = this.waiters; this.waiters = []; w.forEach((r) => r()); }
  }

  // ------------------------------------------------------------ Markierungen

  select(id) {
    if (this.sel != null && this.cards[this.sel]) this.cards[this.sel].el.classList.remove('sel');
    this.sel = id == null ? null : id;
    if (this.sel != null && this.cards[this.sel]) this.cards[this.sel].el.classList.add('sel');
  }

  hint(ids, ms = 1700) {
    clearTimeout(this.hintTimer);
    this.cards.forEach((c) => c.el.classList.remove('hint'));
    for (const s of this.slots.values()) s.classList.remove('hint');
    for (const t of ids || []) {
      if (typeof t === 'number') this.cards[t] && this.cards[t].el.classList.add('hint');
      else if (t && t.slot) { const s = this.slots.get(t.slot); if (s) s.classList.add('hint'); }
    }
    if (ids && ids.length) this.hintTimer = setTimeout(() => this.hint(null), ms);
  }

  shake(id) {
    const c = this.cards[id];
    if (!c) return;
    c.pin.classList.remove('shake');
    void c.pin.offsetWidth;
    c.pin.classList.add('shake');
    setTimeout(() => c.pin.classList.remove('shake'), 450);
  }

  /** Pulsierender Ring über einer Karte oder einem Platzhalter (Coach-Mark). null = weg. */
  coach(target) {
    const r = this.ringEl;
    if (!target) { r.classList.remove('show'); this.coachTarget = null; return; }
    this.coachTarget = target;
    let x, y;
    if (target.card != null) {
      const t = this.T[target.card];
      if (!t) return;
      x = t.x; y = t.y;
    } else if (target.slot) {
      const s = this.slots.get(target.slot);
      if (!s) return;
      x = s._x; y = s._y;
    } else { x = target.x; y = target.y; }
    r.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    r.classList.add('show');
  }

  /** Karten ordnen sich als Fächer in der Mitte an und wiegen sich sanft. */
  fan(ids, { cy = null, spread = 130 } = {}) {
    const n = ids.length;
    if (!n) return Promise.resolve();
    const W = this.width, H = this.height;
    const R = Math.min(W * 0.62, H * 0.42);
    const cx = W / 2;
    const pivotY = (cy == null ? H * 0.5 : cy) + R * 0.55;
    const T = this.T.slice();
    ids.forEach((id, i) => {
      const a = n === 1 ? 0 : (-spread / 2 + (spread * i) / (n - 1));
      const rad = (a * Math.PI) / 180;
      T[id] = {
        x: cx + R * Math.sin(rad) - this.cw / 2,
        y: pivotY - R * Math.cos(rad) - this.ch / 2,
        z: 6000 + i, up: true, rot: a, s: 1,
      };
    });
    this.coach(null);
    this.select(null);
    return this.move(T, { stagger: Math.max(8, 420 / n), order: ids, dur: 560, lift: 0.12, arc: 30 }).then(() => {
      ids.forEach((id, i) => {
        const c = this.cards[id];
        if (!c) return;
        c.pin.style.animationDelay = `${(i * 0.045).toFixed(3)}s`;
        c.pin.classList.add('wave');
      });
    });
  }

  // ------------------------------------------------------------ Eingabe

  pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
  }

  onDown(e) {
    if (this.locked || this.press || (e.button != null && e.button > 0)) return;
    const cardEl = e.target.closest('.pcard');
    const slotEl = e.target.closest('[data-slot]');
    const p = this.pos(e);
    this.press = {
      pid: e.pointerId, x: p.x, y: p.y, moved: false,
      id: cardEl && this.el.contains(cardEl) ? +cardEl.dataset.id : null,
      slot: !cardEl && slotEl ? slotEl.dataset.slot : null,
    };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  onMove(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pid) return;
    const p = this.pos(e);
    const dx = p.x - pr.x, dy = p.y - pr.y;
    if (!this.drag) {
      if (Math.hypot(dx, dy) < 8) return;
      pr.moved = true;
      if (pr.id == null || !this.h.canDrag || !this.h.canDrag(pr.id)) return;
      const c = this.cards[pr.id];
      const an = this.anims.get(pr.id);
      if (an) { this.finish(c, an); this.anims.delete(pr.id); }
      this.drag = { id: pr.id, ox: c.x - pr.x, oy: c.y - pr.y };
      c.el.classList.add('dragging');
      c.el.style.zIndex = 9000;
      this.coach(null);
    }
    const c = this.cards[this.drag.id];
    c.x = p.x + this.drag.ox;
    c.y = p.y + this.drag.oy;
    c.s = 1.06;
    this.apply(c);
    const tgt = this.hitTest(e.clientX, e.clientY, this.drag.id);
    const ok = tgt && this.h.canDrop && this.h.canDrop(this.drag.id, tgt);
    this.glow(ok ? tgt : null);
  }

  onUp(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pid) return;
    this.press = null;
    if (this.drag) {
      const id = this.drag.id;
      const c = this.cards[id];
      c.el.classList.remove('dragging');
      this.drag = null;
      this.glow(null);
      const tgt = this.hitTest(e.clientX, e.clientY, id);
      const ok = this.h.onDrop ? this.h.onDrop(id, tgt) : false;
      if (!ok) this.snapBack(id);
      return;
    }
    if (pr.moved) return;
    if (pr.id != null) { if (this.h.onTap) this.h.onTap(pr.id); }
    else if (pr.slot) { if (this.h.onSlot) this.h.onSlot(pr.slot); }
    else if (this.h.onBg) this.h.onBg();
  }

  onCancel() {
    if (this.drag) {
      const id = this.drag.id;
      this.cards[id].el.classList.remove('dragging');
      this.drag = null;
      this.glow(null);
      this.snapBack(id);
    }
    this.press = null;
  }

  snapBack(id) {
    const c = this.cards[id];
    const t = this.T[id];
    if (!c || !t) return;
    c.s = 1;
    this.move(this.T, { dur: 220 });
  }

  /** Oberste Karte (ausser exclude) oder Platzhalter unter einem Bildschirmpunkt. */
  hitTest(clientX, clientY, exclude = null) {
    const list = document.elementsFromPoint ? document.elementsFromPoint(clientX, clientY) : [];
    for (const n of list) {
      if (!this.el.contains(n)) continue;
      const ce = n.closest('.pcard');
      if (ce && +ce.dataset.id !== exclude && !ce.classList.contains('hidden-card')) return { card: +ce.dataset.id };
      const se = n.closest('[data-slot]');
      if (se && !ce) return { slot: se.dataset.slot };
    }
    return null;
  }

  glow(tgt) {
    const g = this.glowEl;
    if (!tgt) { g.classList.remove('show'); return; }
    let x, y;
    if (tgt.card != null) { const c = this.cards[tgt.card]; x = c.x; y = c.y; }
    else { const s = this.slots.get(tgt.slot); if (!s) return; x = s._x; y = s._y; }
    g.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    g.classList.add('show');
  }
}
