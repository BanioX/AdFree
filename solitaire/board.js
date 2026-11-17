// Spielfläche: Karten als DOM-Elemente, eigene Tween-Schleife (rAF, schläft wenn ruhig),
// Layout fürs Hochformat, Ziehen & Ablegen, Antippen, Tipp-Leuchten, Gewinn-Kaskade.

import { LAYOUTS, kindOf, canPick, canDrop, locate } from './logic/rules.js';
import { faceHTML } from './cardface.js';

const RATIO = 1.42;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Board {
  constructor(el, handlers = {}) {
    this.el = el;
    this.h = handlers;
    this.st = null;
    this.cards = [];
    this.slots = [];
    this.anims = new Map();
    this.raf = 0;
    this.waiters = [];
    this.opts = { leftHanded: false, labels: 'BDK' };
    this.locked = false;
    this.drag = null;
    this.press = null;
    this.geo = null;
    this.glow = document.createElement('div');
    this.glow.className = 'drop-glow';
    el.append(this.glow);
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onCancel(e));
    el.addEventListener('lostpointercapture', (e) => { if (this.drag || this.press) this.onCancel(e); });
    this.tick = this.tick.bind(this);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(el);
    }
  }

  destroy() {
    if (this.ro) this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    this.anims.clear();
  }

  setOptions(o) {
    const relabel = o.labels && o.labels !== this.opts.labels;
    Object.assign(this.opts, o);
    if (relabel && this.st) this.cards.forEach((c, id) => { c.faceEl.outerHTML = faceHTML(this.st.codes[id], this.opts); c.faceEl = c.el.firstChild; });
    if (this.st) this.resize();
  }

  // ------------------------------------------------------------ Aufbau

  /** Neuer Zustand (neue Partie oder geladen). Baut alle Karten neu. */
  setState(st) {
    this.st = st;
    for (const c of this.cards) c.el.remove();
    for (const s of this.slots) s.remove();
    this.anims.clear();
    this.cards = [];
    this.slots = [];
    const L = LAYOUTS[st.game];
    this.el.dataset.game = st.game;
    L.kinds.forEach((kind, p) => {
      const s = document.createElement('div');
      s.className = 'slot slot-' + kind;
      s.dataset.pile = p;
      if (kind === 'found' && st.game !== 'spider') s.innerHTML = '<span class="slot-a">A</span>';
      if (kind === 'stock') s.innerHTML = st.game === 'klondike'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'
        : '';
      if (kind === 'tab' && st.game === 'klondike') s.innerHTML = '<span class="slot-a">K</span>';
      this.el.append(s);
      this.slots.push(s);
    });
    const frag = document.createDocumentFragment();
    st.codes.forEach((code, id) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = id;
      el.innerHTML = faceHTML(code, this.opts) + '<div class="back"></div>';
      frag.append(el);
      this.cards.push({ el, faceEl: el.firstChild, x: 0, y: 0, up: !!st.up[id], z: 0, sx: 1, sy: 1, rot: 0 });
    });
    this.el.append(frag);
    this.cards.forEach((c) => c.el.classList.toggle('up', c.up));
    this.computeGeometry();
    this.placeAll();
  }

  /** Zustand derselben Partie aktualisiert (nach Zug/Undo) – animiert. */
  update(opts) { return this.sync(opts); }

  resize() {
    if (!this.st) return;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    if (this.geo && this.geo.W === w && this.geo.H === h && !this._force) { this.placeAll(); return; }
    this.computeGeometry();
    this.anims.clear();
    this.placeAll();
  }

  // ------------------------------------------------------------ Geometrie

  computeGeometry() {
    const st = this.st;
    const L = LAYOUTS[st.game];
    const W = this.el.clientWidth || 375, H = this.el.clientHeight || 600;
    const cols = L.tab.length;
    const narrow = W < 440;
    const gap = cols >= 10 ? (narrow ? 3 : 5) : (narrow ? 4 : 7);
    const pad = narrow ? 5 : 10;
    let cw = Math.floor((W - 2 * pad - (cols - 1) * gap) / cols);
    const hFactor = st.game === 'spider' ? 5.6 : 4.9;
    cw = Math.max(20, Math.min(cw, Math.floor(H / hFactor / RATIO), 118));
    const ch = Math.round(cw * RATIO);
    const total = cols * cw + (cols - 1) * gap;
    const x0 = Math.round((W - total) / 2);
    const colX = (i) => x0 + i * (cw + gap);
    const topY = Math.round(Math.max(6, ch * 0.08));
    const tabY = topY + ch + Math.round(Math.max(10, ch * 0.2));
    const left = !!this.opts.leftHanded;
    const anchors = new Array(L.count);
    const g = { W, H, cw, ch, gap, colX, topY, tabY, anchors, cols, left };
    if (st.game === 'klondike') {
      L.found.forEach((p, k) => { anchors[p] = { x: colX(left ? 3 + k : k), y: topY }; });
      anchors[L.stock] = { x: colX(left ? 0 : 6), y: topY };
      anchors[L.waste] = { x: colX(left ? 1 : 4), y: topY };
      g.fanX = Math.round(Math.min(cw * 0.42, (cw + 2 * gap) / 2));
    } else if (st.game === 'freecell') {
      L.cells.forEach((p, k) => { anchors[p] = { x: colX(left ? 4 + k : k), y: topY }; });
      L.found.forEach((p, k) => { anchors[p] = { x: colX(left ? k : 4 + k), y: topY }; });
    } else {
      // Spider: Talon rechts (links bei Linkshänder), fertige Folgen auf der anderen Seite
      const off = Math.max(6, Math.round(cw * 0.36));
      g.stockOff = Math.max(4, Math.round(cw * 0.2));
      anchors[L.stock] = { x: colX(left ? 0 : 9), y: topY };
      L.found.forEach((p, k) => {
        anchors[p] = left ? { x: colX(9) - k * off, y: topY } : { x: colX(0) + k * off, y: topY };
      });
    }
    L.tab.forEach((p, k) => { anchors[p] = { x: colX(k), y: tabY }; });
    const base = st.game === 'spider' ? { d: 0.11, u: 0.27 } : st.game === 'freecell' ? { d: 0.12, u: 0.3 } : { d: 0.12, u: 0.3 };
    g.dOff = Math.round(ch * base.d);
    g.uOff = Math.round(ch * base.u);
    g.minU = Math.round(ch * (st.game === 'spider' ? 0.2 : 0.21));
    g.minD = Math.max(3, Math.round(ch * 0.05));
    g.bottom = H - Math.max(6, Math.round(ch * 0.08));
    this.geo = g;
    this.el.style.setProperty('--cw', cw + 'px');
    this.el.style.setProperty('--ch', ch + 'px');
    this.el.classList.toggle('compact', cw < 40);
    this.el.classList.toggle('tiny', cw < 30);
    // Leere Plätze
    L.kinds.forEach((kind, p) => {
      const s = this.slots[p];
      const a = anchors[p];
      let show = true;
      if (st.game === 'spider' && kind === 'found') show = p === L.found[0];
      s.style.display = show ? '' : 'none';
      s.style.transform = `translate(${a.x}px, ${a.y}px)`;
    });
  }

  /** Fächer-Abstände einer Spalte (komprimiert, wenn sie zu lang wird). */
  tabOffsets(p) {
    const st = this.st, g = this.geo;
    const a = st.piles[p];
    const n = a.length;
    if (!n) return [];
    let nd = 0, nu = 0;
    for (let k = 0; k < n - 1; k++) { if (st.up[a[k]]) nu++; else nd++; }
    const avail = g.bottom - g.tabY - g.ch;
    let d = g.dOff, u = g.uOff;
    if (nd * d + nu * u > avail) {
      u = nu ? Math.max(g.minU, (avail - nd * d) / nu) : u;
      if (nd * d + nu * u > avail) {
        d = nd ? Math.max(g.minD, (avail - nu * u) / nd) : d;
        if (nd * d + nu * u > avail && nu) u = Math.max(4, (avail - nd * d) / nu);
      }
    }
    const ys = [];
    let y = g.anchors[p].y;
    for (let k = 0; k < n; k++) { ys.push(y); y += st.up[a[k]] ? u : d; }
    return ys;
  }

  /** Zielposition jeder Karte. */
  targets() {
    const st = this.st, g = this.geo;
    const L = LAYOUTS[st.game];
    const T = new Array(st.codes.length);
    st.piles.forEach((a, p) => {
      const kind = L.kinds[p];
      const an = g.anchors[p];
      const zb = 10 + p * 110;
      if (kind === 'tab') {
        const ys = this.tabOffsets(p);
        a.forEach((id, k) => { T[id] = { x: an.x, y: ys[k], z: zb + k, up: !!st.up[id] }; });
      } else if (kind === 'waste') {
        const vis = st.draw === 3 ? Math.min(3, a.length) : 1;
        a.forEach((id, k) => {
          const f = k - (a.length - vis);
          T[id] = { x: an.x + (f > 0 ? f * g.fanX : 0), y: an.y, z: zb + k, up: true };
        });
      } else if (kind === 'stock' && st.game === 'spider') {
        const groups = Math.ceil(a.length / 10);
        a.forEach((id, k) => {
          const grp = Math.floor(k / 10);
          const dx = (groups - 1 - grp) * g.stockOff * (g.left ? 1 : -1);
          T[id] = { x: an.x + dx, y: an.y, z: zb + k, up: false };
        });
      } else {
        a.forEach((id, k) => { T[id] = { x: an.x, y: an.y, z: zb + k, up: !!st.up[id] }; });
      }
    });
    return T;
  }

  placeAll() {
    if (!this.st || !this.geo) return;
    const T = this.targets();
    this.cards.forEach((c, id) => {
      const t = T[id];
      c.x = t.x; c.y = t.y; c.z = t.z; c.sx = 1; c.sy = 1; c.rot = 0;
      if (c.up !== t.up) { c.up = t.up; c.el.classList.toggle('up', c.up); }
      c.el.style.zIndex = t.z;
      c.el.style.opacity = '';
      c.el.classList.remove('lifted', 'gone');
      this.apply(c);
    });
  }

  apply(c) {
    c.el.style.transform = `translate3d(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px,0)`
      + (c.rot ? ` rotate(${c.rot.toFixed(2)}deg)` : '')
      + (c.sx !== 1 || c.sy !== 1 ? ` scale(${c.sx.toFixed(3)},${c.sy.toFixed(3)})` : '');
  }

  // ------------------------------------------------------------ Animation

  /**
   * Bewegt alle Karten, deren Ziel sich geändert hat.
   * opts: { dur, stagger, delay, lift, ids (Reihenfolge), flipDelay }
   */
  sync(opts = {}) {
    if (!this.st || !this.geo) return Promise.resolve();
    const T = this.targets();
    const now = performance.now();
    let k = 0;
    const order = opts.ids || this.cards.map((_, id) => id);
    const seen = new Set();
    const list = [...order, ...this.cards.map((_, id) => id)];
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      const c = this.cards[id];
      const t = T[id];
      const dist = Math.hypot(t.x - c.x, t.y - c.y);
      const flip = c.up !== t.up;
      if (dist < 0.5 && !flip) {
        if (!this.anims.has(id)) { c.z = t.z; c.el.style.zIndex = t.z; if (c.sx !== 1 || c.sy !== 1 || c.rot) { c.sx = c.sy = 1; c.rot = 0; this.apply(c); } }
        else this.anims.get(id).z1 = t.z;
        continue;
      }
      const dur = opts.dur || Math.max(170, Math.min(380, 150 + dist * 0.45));
      const delay = (opts.delay || 0) + (dist >= 0.5 ? k++ * (opts.stagger || 0) : (opts.flipDelay || 0));
      this.anims.set(id, {
        x0: c.x, y0: c.y, x1: t.x, y1: t.y, t0: now + delay, dur: dist < 0.5 ? 200 : dur,
        flip, up1: t.up, flipped: false, z1: t.z, zFly: 5000 + (dist >= 0.5 ? k : 0), started: false,
        lift: dist < 0.5 ? 0 : (opts.lift ?? 0.06), ease: dist > 250 ? easeInOut : easeOut, sx0: c.sx, rot0: c.rot,
      });
    }
    this.kick();
    return this.idle();
  }

  idle() {
    if (!this.anims.size) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  kick() { if (!this.raf && this.anims.size) this.raf = requestAnimationFrame(this.tick); }

  tick(now) {
    this.raf = 0;
    for (const [id, a] of this.anims) {
      const c = this.cards[id];
      if (a.fn) { if (a.fn(now, c) === false) this.anims.delete(id); continue; }
      const p = (now - a.t0) / a.dur;
      if (p < 0) continue;
      if (!a.started) { a.started = true; c.el.style.zIndex = a.zFly; }
      const q = Math.min(1, p);
      const e = a.ease(q);
      c.x = a.x0 + (a.x1 - a.x0) * e;
      c.y = a.y0 + (a.y1 - a.y0) * e;
      const lift = 1 + a.lift * Math.sin(Math.PI * q);
      let sx = lift, sy = lift;
      if (a.flip) {
        sx *= Math.max(0.02, Math.abs(Math.cos(Math.PI * q)));
        if (q >= 0.5 && !a.flipped) { a.flipped = true; c.up = a.up1; c.el.classList.toggle('up', c.up); }
      }
      c.sx = sx; c.sy = sy;
      c.rot = a.rot0 ? a.rot0 * (1 - e) : 0;
      this.apply(c);
      if (q >= 1) {
        c.sx = 1; c.sy = 1; c.rot = 0;
        if (a.flip && !a.flipped) { c.up = a.up1; c.el.classList.toggle('up', c.up); }
        c.z = a.z1; c.el.style.zIndex = a.z1;
        this.apply(c);
        this.anims.delete(id);
      }
    }
    if (this.anims.size) this.raf = requestAnimationFrame(this.tick);
    else { const w = this.waiters; this.waiters = []; w.forEach((r) => r()); }
  }

  /** Neue Partie: Karten fliegen vom Talon/Stapel auf ihre Plätze. */
  dealIn() {
    const st = this.st, g = this.geo;
    const L = LAYOUTS[st.game];
    const src = L.stock >= 0 ? g.anchors[L.stock] : { x: g.W / 2 - g.cw / 2, y: g.H + 20 };
    const order = [];
    const maxLen = Math.max(...L.tab.map((p) => st.piles[p].length));
    for (let k = 0; k < maxLen; k++) for (const p of L.tab) if (st.piles[p][k] != null) order.push(st.piles[p][k]);
    const rest = this.cards.map((_, id) => id).filter((id) => !order.includes(id));
    for (const id of [...rest, ...order]) {
      const c = this.cards[id];
      c.x = src.x; c.y = src.y; c.up = false; c.el.classList.remove('up');
      c.el.style.zIndex = 4000 + order.indexOf(id);
      this.apply(c);
    }
    const stagger = st.game === 'spider' ? 14 : st.game === 'freecell' ? 16 : 30;
    return this.sync({ ids: order, stagger, dur: 300, lift: 0.04 });
  }

  /** Kurzes Schütteln (ungültiger Zug). */
  shake(ids) {
    const now = performance.now();
    for (const id of ids) {
      const c = this.cards[id];
      const bx = c.x;
      this.anims.set(id, {
        fn: (t, card) => {
          const p = (t - now) / 320;
          if (p >= 1) { card.x = bx; this.apply(card); return false; }
          card.x = bx + Math.sin(p * Math.PI * 6) * 6 * (1 - p);
          this.apply(card);
          return true;
        },
      });
    }
    this.kick();
  }

  /** Tipp: Karten leuchten, Ziel wird markiert. */
  flash(ids, toPile) {
    clearTimeout(this._flashT);
    this.el.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
    for (const id of ids) this.cards[id].el.classList.add('hint');
    if (toPile != null) {
      const r = this.pileRect(toPile, true);
      this.showGlow(r, 'hint-target');
    } else if (!ids.length) this.hideGlow();
    this._flashT = setTimeout(() => {
      this.el.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
      this.hideGlow();
    }, 2000);
  }

  clearFlash() {
    clearTimeout(this._flashT);
    this.el.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
    this.hideGlow();
  }

  showGlow(r, cls = '') {
    const gl = this.glow;
    gl.className = 'drop-glow show ' + cls;
    gl.style.width = r.w + 'px';
    gl.style.height = r.h + 'px';
    gl.style.transform = `translate(${r.x}px, ${r.y}px)`;
  }

  hideGlow() { this.glow.className = 'drop-glow'; }

  /** Rechteck des sichtbaren Ablageziels eines Stapels (Board-Koordinaten). */
  pileRect(p, topOnly = false) {
    const st = this.st, g = this.geo;
    const a = st.piles[p];
    const kind = kindOf(st, p);
    if (a.length) {
      const c = this.cards[a[a.length - 1]];
      const T = this.targets()[a[a.length - 1]];
      const x = this.anims.has(a[a.length - 1]) ? T.x : c.x;
      const y = this.anims.has(a[a.length - 1]) ? T.y : c.y;
      if (kind === 'tab' && !topOnly) {
        const y0 = g.anchors[p].y;
        return { x, y: y0, w: g.cw, h: Math.max(y + g.ch, g.H) - y0 };
      }
      return { x, y, w: g.cw, h: g.ch };
    }
    const an = g.anchors[p];
    if (kind === 'tab' && !topOnly) return { x: an.x, y: an.y, w: g.cw, h: g.H - an.y };
    return { x: an.x, y: an.y, w: g.cw, h: g.ch };
  }

  /** Bildschirm-Koordinaten (für Tests): Mitte des sichtbaren Teils einer Karte. */
  cardPoint(id) {
    const r = this.el.getBoundingClientRect();
    const c = this.cards[id];
    const loc = locate(this.st)[id];
    const a = this.st.piles[loc[0]];
    const g = this.geo;
    let visH = g.ch;
    if (loc[1] < a.length - 1) {
      const nxt = this.cards[a[loc[1] + 1]];
      visH = Math.max(4, nxt.y - c.y);
      if (nxt.x !== c.x) visH = g.ch;
    }
    let x = c.x + g.cw / 2;
    if (loc[1] < a.length - 1 && this.cards[a[loc[1] + 1]].x > c.x + 1) x = c.x + Math.max(4, (this.cards[a[loc[1] + 1]].x - c.x) / 2);
    return { x: r.left + x, y: r.top + c.y + Math.min(visH, g.ch) / 2 };
  }

  pilePoint(p) {
    const r = this.el.getBoundingClientRect();
    const pr = this.pileRect(p, true);
    return { x: r.left + pr.x + pr.w / 2, y: r.top + pr.y + pr.h / 2 };
  }

  // ------------------------------------------------------------ Eingabe

  findCard(e) {
    const el = e.target.closest && e.target.closest('.card');
    if (el && this.el.contains(el)) return +el.dataset.id;
    return -1;
  }

  localPoint(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onDown(e) {
    if (this.locked || !this.st || this.press || this.drag) return;
    if (e.button != null && e.button > 0) return;
    if (this.h.onAnyTap) this.h.onAnyTap();
    const id = this.findCard(e);
    const pt = this.localPoint(e);
    let pile = -1, index = -1;
    if (id >= 0) {
      const loc = locate(this.st)[id];
      pile = loc[0]; index = loc[1];
    } else {
      const s = e.target.closest && e.target.closest('.slot');
      if (s) pile = +s.dataset.pile;
    }
    if (pile < 0) return;
    this.press = { id, pile, index, x0: pt.x, y0: pt.y, t0: performance.now(), pointerId: e.pointerId,
      pickable: id >= 0 && canPick(this.st, pile, index) };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  }

  onMove(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pointerId) return;
    const pt = this.localPoint(e);
    if (!this.drag) {
      if (!pr.pickable) return;
      if (Math.hypot(pt.x - pr.x0, pt.y - pr.y0) < 7) return;
      this.startDrag(pt);
    }
    const d = this.drag;
    d.px = pt.x; d.py = pt.y;
    d.ids.forEach((id, k) => {
      const c = this.cards[id];
      c.x = pt.x + d.off[k].x;
      c.y = pt.y + d.off[k].y;
      c.sx = c.sy = 1.05;
      c.rot = 0;
      this.apply(c);
    });
    const t = this.dropTarget();
    if (t != null) this.showGlow(this.pileRect(t, true), 'drop-ok');
    else this.hideGlow();
  }

  startDrag(pt) {
    const pr = this.press;
    const a = this.st.piles[pr.pile];
    const ids = a.slice(pr.index);
    const off = ids.map((id) => {
      const c = this.cards[id];
      this.anims.delete(id);
      return { x: c.x - pt.x, y: c.y - pt.y };
    });
    ids.forEach((id, k) => {
      const c = this.cards[id];
      c.el.style.zIndex = 9000 + k;
      c.el.classList.add('lifted');
    });
    this.drag = { ids, off, from: pr.pile, index: pr.index, px: pt.x, py: pt.y };
    this.clearFlash();
    if (this.h.onPick) this.h.onPick();
  }

  dropTarget() {
    const d = this.drag;
    if (!d) return null;
    const st = this.st, g = this.geo;
    const lead = this.cards[d.ids[0]];
    const cr = { x: lead.x, y: lead.y, w: g.cw, h: g.ch };
    let best = null, bestA = 0;
    for (let t = 0; t < st.piles.length; t++) {
      if (t === d.from || !canDrop(st, d.from, d.index, t)) continue;
      const r = this.pileRect(t);
      const ix = Math.max(0, Math.min(cr.x + cr.w, r.x + r.w) - Math.max(cr.x, r.x));
      const iy = Math.max(0, Math.min(cr.y + cr.h, r.y + r.h) - Math.max(cr.y, r.y));
      const area = ix * iy;
      if (area > bestA) { bestA = area; best = t; }
    }
    if (best == null) {
      // Finger über einem Ziel?
      for (let t = 0; t < st.piles.length; t++) {
        if (t === d.from || !canDrop(st, d.from, d.index, t)) continue;
        const r = this.pileRect(t);
        if (d.px >= r.x - g.gap && d.px <= r.x + r.w + g.gap && d.py >= r.y - 10 && d.py <= r.y + r.h) return t;
      }
    }
    return bestA > g.cw * g.ch * 0.08 ? best : null;
  }

  onUp(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pointerId) return;
    this.press = null;
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.drag) {
      const d = this.drag;
      const t = this.dropTarget();
      this.drag = null;
      this.hideGlow();
      d.ids.forEach((id) => this.cards[id].el.classList.remove('lifted'));
      if (t != null && this.h.onMove) this.h.onMove(d.from, d.index, t, 'drag');
      else { if (this.h.onDropBack) this.h.onDropBack(); this.sync({ dur: 220 }); }
      return;
    }
    const pt = this.localPoint(e);
    const moved = Math.hypot(pt.x - pr.x0, pt.y - pr.y0);
    if (moved > 12 || performance.now() - pr.t0 > 900) return;
    if (this.h.onTap) this.h.onTap(pr.pile, pr.index, pr.id);
  }

  onCancel() {
    if (this.drag) {
      this.drag.ids.forEach((id) => this.cards[id].el.classList.remove('lifted'));
      this.drag = null;
      this.hideGlow();
      this.sync({ dur: 200 });
    }
    this.press = null;
  }

  // ------------------------------------------------------------ Gewinn-Kaskade

  /** Karten springen von der Ablage und hüpfen aus dem Bild. Tippen beendet. */
  cascade() {
    const st = this.st, g = this.geo;
    const L = LAYOUTS[st.game];
    const seq = [];
    const piles = L.found.map((p) => st.piles[p].slice());
    for (let k = 12; k >= 0; k--) for (const a of piles) if (a[k] != null) seq.push(a[k]);
    const floor = g.H - g.ch;
    let doneCount = 0;
    const start = performance.now();
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.el.removeEventListener('pointerdown', skip, true);
        for (const id of seq) { this.anims.delete(id); this.cards[id].el.classList.add('gone'); }
        resolve();
      };
      const skip = (e) => { e.stopPropagation(); finish(); };
      this.el.addEventListener('pointerdown', skip, true);
      seq.forEach((id, i) => {
        const c = this.cards[id];
        const dir = Math.random() < 0.5 ? -1 : 1;
        const s = {
          t0: start + i * 85, last: 0, vx: dir * (90 + Math.random() * 190), vy: -(260 + Math.random() * 420),
          vr: dir * (40 + Math.random() * 120), bounces: 0, started: false,
        };
        this.anims.set(id, {
          fn: (t, card) => {
            if (finished) return false;
            if (t < s.t0) return true;
            if (!s.started) { s.started = true; s.last = t; card.el.style.zIndex = 7000 + i; card.up = true; card.el.classList.add('up'); }
            const dt = Math.min(0.05, (t - s.last) / 1000);
            s.last = t;
            s.vy += 1700 * dt;
            card.x += s.vx * dt;
            card.y += s.vy * dt;
            card.rot += s.vr * dt;
            if (card.y > floor) { card.y = floor; s.vy = -Math.abs(s.vy) * 0.62; s.bounces++; s.vr *= 0.7; }
            card.sx = card.sy = 1;
            this.apply(card);
            if (card.x < -g.cw * 1.5 || card.x > g.W + g.cw * 0.5 || s.bounces > 7) {
              card.el.classList.add('gone');
              if (++doneCount >= seq.length) setTimeout(finish, 50);
              return false;
            }
            return true;
          },
        });
      });
      this.kick();
      setTimeout(finish, 6500);
    });
  }
}
