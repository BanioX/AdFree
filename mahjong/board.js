// Brett-Darstellung: Canvas mit vorgezeichneten Stein-Sprites, Zoom/Verschieben,
// Treffertest (oberster Stein gewinnt) und Animationen (Einflug, Paar-Flug, Funken, Mischen).

import { TILE, layoutExtent, isFree } from './engine.js';
import { drawFace, rr } from './faces.js';
import { tilesetById } from './data/tilesets.js';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SPARK_COLORS = ['#ffd54f', '#ffffff', '#ffb74d', '#ff8a80', '#fff3c4'];

export class BoardView {
  /**
   * @param {HTMLElement} host  Container (position: relative), wird vollständig ausgefüllt
   * @param {object} cb { onTap(i), onZoomChange(zoomed) }
   */
  constructor(host, cb = {}) {
    this.host = host;
    this.cb = cb;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'board-canvas';
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.viewW = 1; this.viewH = 1;
    this.sprites = new Map();
    this.spriteW = 0;
    this.board = null;
    this.faces = [];
    this.present = null;
    this.free = null;
    this.selected = -1;
    this.hint = null;
    this.opts = { tileset: 'klassisch', highlightFree: false, dimBlocked: true };
    this.anims = [];
    this.flyers = [];
    this.particles = [];
    this.fx = new Map();
    this.faceOverride = new Map();
    this.cam = { w: 30, ox: 0, oy: 0 };
    this.fitW = 30;
    this.zoomed = false;
    this.raf = 0;
    this.pointers = new Map();
    this.gesture = null;
    this.destroyed = false;
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.remove();
  }

  // ------------------------------------------------------------ Zustand

  setBoard(board, faces, present) {
    this.board = board;
    this.faces = faces;
    this.present = present;
    this.ext = layoutExtent(board.tiles);
    this.maxZ = board.layout.depth - 1;
    this.selected = -1;
    this.hint = null;
    this.flyers = [];
    this.fx.clear();
    this.faceOverride.clear();
    this.refreshFree();
    this.fit(false);
    this.invalidate();
  }

  setOptions(o) {
    const prevSet = this.opts.tileset;
    Object.assign(this.opts, o);
    if (o.tileset && o.tileset !== prevSet) this.sprites.clear();
    this.invalidate();
  }

  refreshFree() {
    if (!this.board) return;
    const n = this.board.n;
    if (!this.free || this.free.length !== n) this.free = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.free[i] = isFree(this.board, this.present, i) ? 1 : 0;
  }

  update() { this.refreshFree(); this.invalidate(); }

  setSelected(i) { this.selected = i; this.invalidate(); }

  showHint(pair) {
    this.hint = { pair, t0: performance.now() };
    this.invalidate();
  }
  clearHint() { if (this.hint) { this.hint = null; this.invalidate(); } }

  // ------------------------------------------------------------ Geometrie

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.viewW && h === this.viewH && this.canvas.width) return;
    const rel = this.zoomed ? this.cam.w / this.fitW : 1;
    this.viewW = w; this.viewH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.board) {
      this.computeFit();
      if (rel > 1.01) {
        this.cam.w = this.fitW * rel;
        this.clampPan();
      } else this.fit(false);
    }
    this.invalidate();
  }

  computeFit() {
    const e = this.ext;
    const padX = 6, padTop = 6, padBottom = 10;
    const maxTile = Math.min(64, this.viewW / 5.5);
    this.fitW = Math.max(8, Math.min(maxTile, (this.viewW - padX * 2) / e.w, (this.viewH - padTop - padBottom) / e.h));
    this.padTop = padTop; this.padBottom = padBottom;
  }

  fit(animate = true) {
    if (!this.board) return;
    this.computeFit();
    const e = this.ext;
    const target = {
      w: this.fitW,
      ox: (this.viewW - e.w * this.fitW) / 2,
      oy: this.padTop + (this.viewH - this.padTop - this.padBottom - e.h * this.fitW) / 2,
    };
    if (animate) {
      const from = { ...this.cam };
      this.addAnim(260, (p) => {
        const k = easeInOut(p);
        this.cam.w = from.w + (target.w - from.w) * k;
        this.cam.ox = from.ox + (target.ox - from.ox) * k;
        this.cam.oy = from.oy + (target.oy - from.oy) * k;
      }, () => this.ensureSprites(true));
    } else {
      Object.assign(this.cam, target);
      this.ensureSprites(true);
    }
    this.setZoomed(false);
  }

  setZoomed(z) {
    if (z !== this.zoomed) {
      this.zoomed = z;
      if (this.cb.onZoomChange) this.cb.onZoomChange(z);
    }
  }

  /** Bildschirmposition (CSS px) der oberen linken Ecke der Steinfläche. */
  tilePos(i, W = this.cam.w) {
    const t = this.board.tiles[i];
    return {
      x: this.cam.ox + (t.x / 2 - t.z * TILE.shift - this.ext.minX) * W,
      y: this.cam.oy + ((t.y / 2) * TILE.ratio - t.z * TILE.shift - this.ext.minY) * W,
    };
  }

  tileCenter(i) {
    const p = this.tilePos(i);
    return { x: p.x + this.cam.w / 2, y: p.y + (this.cam.w * TILE.ratio) / 2 };
  }

  clampPan() {
    const e = this.ext, W = this.cam.w;
    const bw = e.w * W, bh = e.h * W;
    const m = 24;
    if (bw <= this.viewW) this.cam.ox = (this.viewW - bw) / 2;
    else this.cam.ox = clamp(this.cam.ox, this.viewW - bw - m, m);
    if (bh <= this.viewH) this.cam.oy = (this.viewH - bh) / 2;
    else this.cam.oy = clamp(this.cam.oy, this.viewH - bh - m, m);
  }

  zoomAt(fx, fy, newW) {
    const maxW = Math.max(this.fitW, Math.min(this.fitW * 3, 78));
    newW = clamp(newW, this.fitW, maxW);
    const s = newW / this.cam.w;
    this.cam.ox = fx - (fx - this.cam.ox) * s;
    this.cam.oy = fy - (fy - this.cam.oy) * s;
    this.cam.w = newW;
    this.clampPan();
    this.setZoomed(newW > this.fitW * 1.02);
    this.invalidate();
  }

  /** Oberster Stein unter dem Punkt (CSS px). Grosszügig: Lücken treffen den nächsten freien Stein. */
  hitTest(x, y) {
    if (!this.board) return -1;
    const W = this.cam.w, H = W * TILE.ratio, D = W * TILE.depth;
    const n = this.board.n;
    for (let i = n - 1; i >= 0; i--) {
      if (!this.present[i]) continue;
      const p = this.tilePos(i);
      if (x >= p.x && x <= p.x + W + D * 0.6 && y >= p.y && y <= p.y + H + D * 0.6) return i;
    }
    // Daneben getippt: nächsten freien Stein in der Nähe nehmen
    let best = -1, bd = Infinity;
    const tol = Math.max(10, W * 0.42);
    for (let i = n - 1; i >= 0; i--) {
      if (!this.present[i] || !this.free[i]) continue;
      const p = this.tilePos(i);
      const dx = Math.max(p.x - x, 0, x - (p.x + W + D));
      const dy = Math.max(p.y - y, 0, y - (p.y + H + D));
      const d = Math.hypot(dx, dy);
      if (d < tol && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ------------------------------------------------------------ Eingabe

  bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId)) this.onUp(e, true); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.cam.w * k);
      this.scheduleSprites();
    }, { passive: false });
  }

  localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onDown(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.gesture = { type: 'tap', sx: p.x, sy: p.y, t0: performance.now(), cam: { ...this.cam } };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        type: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        w0: this.cam.w,
        mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
        cam: { ...this.cam },
      };
    }
  }

  onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (!g) return;
    if (g.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // Erst verschieben (Mittelpunkt folgt den Fingern), dann um den Mittelpunkt zoomen
      this.cam.ox = g.cam.ox + (mx - g.mx);
      this.cam.oy = g.cam.oy + (my - g.my);
      this.cam.w = g.cam.w;
      this.zoomAt(mx, my, g.w0 * (d / g.d0));
    } else if (g.type === 'tap' || g.type === 'pan') {
      const dx = p.x - g.sx, dy = p.y - g.sy;
      if (g.type === 'tap' && Math.hypot(dx, dy) > 9 && this.zoomed) g.type = 'pan';
      if (g.type === 'pan') {
        this.cam.ox = g.cam.ox + dx;
        this.cam.oy = g.cam.oy + dy;
        this.clampPan();
        this.invalidate();
      }
    }
  }

  onUp(e, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.localPoint(e);
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g && g.type === 'tap' && !cancelled && this.pointers.size === 0) {
      const moved = Math.hypot(p.x - g.sx, p.y - g.sy);
      if (moved < 14) {
        const i = this.hitTest(g.sx, g.sy);
        if (this.cb.onTap) this.cb.onTap(i, g.sx, g.sy);
      }
    }
    if (g && g.type === 'pinch') {
      this.scheduleSprites();
      // Nach dem Pinch nicht versehentlich tippen
      if (this.pointers.size === 1) {
        const [q] = [...this.pointers.values()];
        this.gesture = { type: 'pan', sx: q.x, sy: q.y, t0: performance.now(), cam: { ...this.cam } };
        return;
      }
    }
    if (this.pointers.size === 0) this.gesture = null;
  }

  scheduleSprites() {
    clearTimeout(this.spriteTimer);
    this.spriteTimer = setTimeout(() => { this.ensureSprites(true); this.invalidate(); }, 140);
  }

  // ------------------------------------------------------------ Sprites

  spriteGeom(pw) {
    const D = pw * TILE.depth;
    const H = pw * TILE.ratio;
    const M = Math.ceil(D * 1.6 + 3);
    return { pw, D, H, M, cw: Math.ceil(pw + D + 2 * M), ch: Math.ceil(H + D + 2 * M) };
  }

  ensureSprites(force = false) {
    const pw = Math.max(8, Math.round(this.cam.w * this.dpr));
    if (!force && this.spriteW) return;
    if (pw === this.spriteW) return;
    this.spriteW = pw;
    this.sprites.clear();
  }

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  sprite(key) {
    let s = this.sprites.get(key);
    if (s) return s;
    const g = this.spriteGeom(this.spriteW);
    const c = this.makeCanvas(g.cw, g.ch);
    const ctx = c.getContext('2d');
    ctx.translate(g.M, g.M);
    const set = tilesetById(this.opts.tileset);
    const R = g.pw * 0.13;
    if (key.startsWith('f')) {
      const face = Number(key.slice(1));
      this.drawTileBody(ctx, g, set, R);
      // Bild
      const inset = g.pw * 0.075;
      const aw = g.pw - inset * 2, ah = g.H - inset * 2;
      ctx.save();
      ctx.translate(inset, inset);
      drawFace(ctx, set.id, face, aw, ah);
      ctx.restore();
    } else if (key === 'dim') {
      ctx.fillStyle = 'rgb(84,58,34)';
      rr(ctx, 0, 0, g.pw, g.H, R); ctx.fill();
      rr(ctx, g.D, g.D, g.pw, g.H, R); ctx.fill();
      ctx.fillRect(R, R, g.pw, g.H);
    } else if (key === 'sel') {
      ctx.fillStyle = 'rgba(255, 196, 120, .28)';
      rr(ctx, 0, 0, g.pw, g.H, R); ctx.fill();
      ctx.lineWidth = Math.max(2, g.pw * 0.07);
      ctx.strokeStyle = '#e0682f';
      rr(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, g.pw - ctx.lineWidth, g.H - ctx.lineWidth, R * 0.85); ctx.stroke();
    } else if (key === 'hint') {
      ctx.shadowColor = 'rgba(255, 190, 40, .95)';
      ctx.shadowBlur = g.pw * 0.25;
      ctx.lineWidth = Math.max(2, g.pw * 0.075);
      ctx.strokeStyle = '#ffbf1f';
      rr(ctx, 0, 0, g.pw, g.H, R); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 220, 110, .22)';
      rr(ctx, 0, 0, g.pw, g.H, R); ctx.fill();
    } else if (key === 'free') {
      ctx.lineWidth = Math.max(1.5, g.pw * 0.05);
      ctx.strokeStyle = 'rgba(122, 200, 92, .95)';
      rr(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, g.pw - ctx.lineWidth, g.H - ctx.lineWidth, R * 0.85); ctx.stroke();
    } else if (key === 'warn') {
      ctx.fillStyle = 'rgba(229, 72, 77, .30)';
      rr(ctx, 0, 0, g.pw, g.H, R); ctx.fill();
      ctx.lineWidth = Math.max(2, g.pw * 0.06);
      ctx.strokeStyle = 'rgba(229, 72, 77, .9)';
      rr(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, g.pw - ctx.lineWidth, g.H - ctx.lineWidth, R * 0.85); ctx.stroke();
    }
    s = { c, g };
    this.sprites.set(key, s);
    return s;
  }

  drawTileBody(ctx, g, set, R) {
    const { pw, H, D } = g;
    // Weicher Schatten
    ctx.save();
    ctx.shadowColor = 'rgba(70, 42, 16, .38)';
    ctx.shadowBlur = D * 1.5;
    ctx.shadowOffsetX = D * 0.35;
    ctx.shadowOffsetY = D * 0.6;
    rr(ctx, D * 0.5, D * 0.5, pw, H, R);
    ctx.fillStyle = set.edgeDark;
    ctx.fill();
    ctx.restore();
    // Rückseite (farbig)
    rr(ctx, D, D, pw, H, R);
    ctx.fillStyle = set.edgeDark;
    ctx.fill();
    rr(ctx, D * 0.78, D * 0.78, pw, H, R);
    ctx.fillStyle = set.edge;
    ctx.fill();
    // Elfenbein-Seite
    rr(ctx, D * 0.42, D * 0.42, pw, H, R);
    const side = ctx.createLinearGradient(0, 0, pw + D, H + D);
    side.addColorStop(0, '#efe3c9');
    side.addColorStop(1, '#d9c7a4');
    ctx.fillStyle = side;
    ctx.fill();
    // Vorderseite
    rr(ctx, 0, 0, pw, H, R);
    const face = ctx.createLinearGradient(0, 0, pw * 0.6, H);
    face.addColorStop(0, '#fffdf8');
    face.addColorStop(1, '#f5ecdb');
    ctx.fillStyle = face;
    ctx.fill();
    ctx.lineWidth = Math.max(1, pw * 0.018);
    ctx.strokeStyle = 'rgba(140, 105, 60, .45)';
    ctx.stroke();
    // Glanzkante oben links
    ctx.save();
    rr(ctx, pw * 0.03, pw * 0.03, pw * 0.94, H - pw * 0.06, R * 0.8);
    ctx.lineWidth = Math.max(1, pw * 0.025);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ Animationen

  invalidate() {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame((t) => { this.raf = 0; this.frame(t); });
  }

  addAnim(dur, step, done, delay = 0) {
    const a = { t0: performance.now() + delay, dur, step, done };
    this.anims.push(a);
    this.invalidate();
    return a;
  }

  /** Steine fallen Ebene für Ebene aufs Brett. */
  animateEntry() {
    if (!this.board) return Promise.resolve();
    const n = this.board.n;
    let maxEnd = 0;
    return new Promise((resolve) => {
      for (let i = 0; i < n; i++) {
        if (!this.present[i]) continue;
        const t = this.board.tiles[i];
        const delay = t.z * 110 + (t.y / 2) * 26 + (t.x / 2) * 9;
        maxEnd = Math.max(maxEnd, delay + 360);
        this.fx.set(i, { dy: -this.cam.w, a: 0, s: 1 });
        this.addAnim(360, (p) => {
          const k = easeBack(p);
          this.fx.set(i, { dy: -(1 - k) * this.cam.w * 0.9, a: Math.min(1, p * 2.2), s: 1 });
        }, () => this.fx.delete(i), delay);
      }
      setTimeout(resolve, maxEnd + 30);
    });
  }

  /** Zwei Steine fliegen zusammen und verschwinden mit Funken. */
  animateMatch(a, b, faceA, faceB) {
    return new Promise((resolve) => {
      const W = this.cam.w;
      const pa = this.tilePos(a), pb = this.tilePos(b);
      const midX = (pa.x + pb.x) / 2, midY = (pa.y + pb.y) / 2 - W * 0.25;
      const left = pa.x <= pb.x ? 0 : 1;
      const fa = { face: faceA, x0: pa.x, y0: pa.y, x: pa.x, y: pa.y, s: 1, a: 1, r: 0 };
      const fb = { face: faceB, x0: pb.x, y0: pb.y, x: pb.x, y: pb.y, s: 1, a: 1, r: 0 };
      const ta = { x: midX + (left === 0 ? -W * 0.52 : W * 0.52), y: midY };
      const tb = { x: midX + (left === 0 ? W * 0.52 : -W * 0.52), y: midY };
      this.flyers.push(fa, fb);
      let burst = false;
      this.addAnim(560, (p) => {
        if (p < 0.62) {
          const k = easeInOut(p / 0.62);
          fa.x = fa.x0 + (ta.x - fa.x0) * k; fa.y = fa.y0 + (ta.y - fa.y0) * k - Math.sin(k * Math.PI) * W * 0.35;
          fb.x = fb.x0 + (tb.x - fb.x0) * k; fb.y = fb.y0 + (tb.y - fb.y0) * k - Math.sin(k * Math.PI) * W * 0.35;
          fa.s = fb.s = 1 + 0.14 * Math.sin(k * Math.PI * 0.5);
          fa.r = (left === 0 ? -1 : 1) * 0.12 * Math.sin(k * Math.PI);
          fb.r = -fa.r;
        } else {
          if (!burst) {
            burst = true;
            this.burst(midX + W / 2, midY + (W * TILE.ratio) / 2, 22, W);
            if (this.cb.onBurst) this.cb.onBurst();
          }
          const k = (p - 0.62) / 0.38;
          // kurz zusammenklappen, dann weg
          const close = W * 0.5 * easeIn(Math.min(1, k * 1.6));
          fa.x = ta.x + (left === 0 ? close : -close);
          fb.x = tb.x + (left === 0 ? -close : close);
          fa.s = fb.s = 1.14 * (1 - easeIn(k) * 0.75);
          fa.a = fb.a = 1 - easeIn(k);
          fa.r = fb.r = 0;
        }
      }, () => {
        this.flyers = this.flyers.filter((f) => f !== fa && f !== fb);
        resolve();
      });
    });
  }

  /** Erscheinen (z.B. nach Rückgängig). */
  animateAppear(list) {
    for (const i of list) {
      this.fx.set(i, { dy: 0, a: 0, s: 1.25 });
      this.addAnim(300, (p) => {
        const k = easeBack(p);
        this.fx.set(i, { dy: -(1 - k) * this.cam.w * 0.3, a: Math.min(1, p * 2), s: 1 + (1 - k) * 0.25 });
      }, () => this.fx.delete(i));
    }
  }

  /** Stein wackelt (blockiert). */
  shake(i) {
    this.addAnim(380, (p) => {
      const amp = this.cam.w * 0.09 * (1 - p);
      this.fx.set(i, { dx: Math.sin(p * Math.PI * 7) * amp, dy: 0, a: 1, s: 1 });
    }, () => this.fx.delete(i));
  }

  /** Blockierende Steine kurz rot aufleuchten lassen. */
  flashWarn(list) {
    this.warn = { list, t0: performance.now() };
    this.addAnim(700, () => {}, () => { this.warn = null; });
  }

  /** Neue Verteilung: Steine drehen sich um und zeigen neue Bilder. */
  animateShuffle(oldFaces, newFaces) {
    return new Promise((resolve) => {
      const n = this.board.n;
      let maxEnd = 0;
      for (let i = 0; i < n; i++) {
        if (!this.present[i]) continue;
        const t = this.board.tiles[i];
        const delay = (t.x / 2) * 22 + (t.y / 2) * 14 + t.z * 30;
        maxEnd = Math.max(maxEnd, delay + 420);
        this.faceOverride.set(i, oldFaces[i]);
        this.addAnim(420, (p) => {
          const sx = Math.abs(Math.cos(p * Math.PI));
          if (p >= 0.5) this.faceOverride.delete(i);
          this.fx.set(i, { dx: 0, dy: -Math.sin(p * Math.PI) * this.cam.w * 0.25, a: 1, s: 1, sx: Math.max(0.04, sx) });
        }, () => { this.fx.delete(i); this.faceOverride.delete(i); }, delay);
      }
      setTimeout(resolve, maxEnd + 20);
    });
  }

  /** Funkenregen beim Gewinnen. */
  winBurst() {
    if (!this.board) return;
    const W = this.cam.w;
    for (let k = 0; k < 6; k++) {
      setTimeout(() => {
        this.burst(this.viewW * (0.2 + Math.random() * 0.6), this.viewH * (0.25 + Math.random() * 0.4), 30, W * 1.4);
      }, k * 140);
    }
  }

  burst(x, y, count, W) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.6) * W * 0.09;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - W * 0.05,
        life: 0, max: 520 + Math.random() * 420,
        size: W * (0.08 + Math.random() * 0.12),
        color: SPARK_COLORS[k % SPARK_COLORS.length],
        star: Math.random() < 0.6,
        rot: Math.random() * Math.PI,
      });
    }
    this.invalidate();
  }

  // ------------------------------------------------------------ Zeichnen

  frame(now) {
    if (this.destroyed) return;
    let active = false;
    // Animationen
    if (this.anims.length) {
      const keep = [];
      for (const a of this.anims) {
        if (now < a.t0) { keep.push(a); active = true; continue; }
        const p = Math.min(1, (now - a.t0) / a.dur);
        a.step(p, now);
        if (p >= 1) { if (a.done) a.done(); } else keep.push(a);
      }
      this.anims = keep;
      if (this.anims.length) active = true;
    }
    if (!this.spriteW) this.ensureSprites(true);
    this.draw(now);
    if (this.particles.length) active = true;
    if (this.hint && now - this.hint.t0 < 60000) active = true;
    if (active) this.invalidate();
  }

  draw(now) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.board) return;
    const W = this.cam.w;
    const f = (W * dpr) / this.spriteW; // Skalierung der Sprites (beim Zoomen)
    const g = this.spriteGeom(this.spriteW);
    const n = this.board.n;
    const sel = this.selected;
    const hintSet = this.hint ? this.hint.pair : null;
    const hintPulse = this.hint ? 0.55 + 0.45 * Math.sin((now - this.hint.t0) / 180) : 0;
    const warnSet = this.warn ? this.warn.list : null;
    const warnA = this.warn ? Math.max(0, 1 - (now - this.warn.t0) / 700) : 0;
    const dim = this.opts.dimBlocked;
    const hiFree = this.opts.highlightFree;

    const drawSprite = (key, x, y, alpha = 1, fx = null) => {
      const s = this.sprite(key);
      const dx = (x * dpr) - g.M * f;
      const dy = (y * dpr) - g.M * f;
      const dw = s.c.width * f, dh = s.c.height * f;
      if (fx && (fx.s !== 1 || fx.sx !== undefined || fx.r)) {
        const cx = (x + W / 2) * dpr, cy = (y + (W * TILE.ratio) / 2) * dpr;
        ctx.save();
        ctx.translate(cx, cy);
        if (fx.r) ctx.rotate(fx.r);
        ctx.scale((fx.s || 1) * (fx.sx ?? 1), fx.s || 1);
        ctx.globalAlpha = alpha;
        ctx.drawImage(s.c, dx - cx, dy - cy, dw, dh);
        ctx.restore();
      } else {
        ctx.globalAlpha = alpha;
        ctx.drawImage(s.c, dx, dy, dw, dh);
      }
    };

    for (let i = 0; i < n; i++) {
      if (!this.present[i] || i === sel) continue;
      this.drawTile(i, drawSprite, { dim, hiFree, hintSet, hintPulse, warnSet, warnA });
    }
    if (sel >= 0 && this.present[sel]) {
      this.drawTile(sel, drawSprite, { dim, hiFree, hintSet, hintPulse, warnSet, warnA, lifted: true });
    }
    ctx.globalAlpha = 1;
    // Fliegende Paare
    for (const fl of this.flyers) {
      drawSprite('f' + fl.face, fl.x, fl.y, fl.a, { s: fl.s, r: fl.r });
    }
    ctx.globalAlpha = 1;
    // Funken
    if (this.particles.length) {
      const dt = 16;
      const keep = [];
      for (const p of this.particles) {
        p.life += dt;
        if (p.life >= p.max) continue;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.95; p.vy = p.vy * 0.95 + W * 0.004;
        p.rot += 0.08;
        const a = 1 - p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const r = p.size * (0.6 + 0.4 * a) * dpr;
        ctx.save();
        ctx.translate(p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        if (p.star) {
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr2 = k % 2 ? r * 0.38 : r;
            const ang = (k * Math.PI) / 4;
            ctx.lineTo(Math.cos(ang) * rr2, Math.sin(ang) * rr2);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        keep.push(p);
      }
      this.particles = keep;
      ctx.globalAlpha = 1;
    }
  }

  drawTile(i, drawSprite, o) {
    const fx = this.fx.get(i);
    const p = this.tilePos(i);
    let x = p.x, y = p.y, alpha = 1;
    if (fx) { x += fx.dx || 0; y += fx.dy || 0; alpha = fx.a ?? 1; }
    if (alpha <= 0.01) return;
    if (o.lifted) { x -= this.cam.w * 0.05; y -= this.cam.w * 0.09; }
    const face = this.faceOverride.has(i) ? this.faceOverride.get(i) : this.faces[i];
    drawSprite('f' + face, x, y, alpha, fx);
    const t = this.board.tiles[i];
    const free = this.free[i];
    let shade = (this.maxZ - t.z) * 0.03;
    if (o.dim && !free) shade += 0.15;
    if (o.lifted) shade = 0;
    if (shade > 0.005) drawSprite('dim', x, y, Math.min(0.5, shade) * alpha, fx);
    if (o.hiFree && free && !o.lifted) drawSprite('free', x, y, 0.9 * alpha, fx);
    if (o.lifted) drawSprite('sel', x, y, alpha, fx);
    if (o.hintSet && (o.hintSet[0] === i || o.hintSet[1] === i)) drawSprite('hint', x, y, o.hintPulse * alpha, fx);
    if (o.warnSet && o.warnSet.includes(i)) drawSprite('warn', x, y, o.warnA * alpha, fx);
  }

  /** Kleine Vorschau eines Steins (für Menü/Einstellungen) als Canvas. */
  static tileImage(setId, face, cssW, dpr = Math.min(window.devicePixelRatio || 1, 3)) {
    const v = Object.create(BoardView.prototype);
    v.opts = { tileset: setId };
    v.sprites = new Map();
    v.spriteW = Math.round(cssW * dpr);
    v.makeCanvas = BoardView.prototype.makeCanvas;
    const s = v.sprite('f' + face);
    s.c.style.width = s.c.width / dpr + 'px';
    s.c.style.height = s.c.height / dpr + 'px';
    s.c.dataset.margin = String(s.g.M / dpr);
    return s.c;
  }
}

/** Zeichnet eine kleine Silhouette eines Layouts (Reise-Karten). */
export function drawMiniLayout(canvas, tiles, { color = '#2f8a73', done = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || 120, chh = canvas.clientHeight || 90;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(chh * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const e = layoutExtent(tiles);
  const W = Math.min((cw - 8) / e.w, (chh - 8) / e.h);
  const ox = (cw - e.w * W) / 2, oy = (chh - e.h * W) / 2;
  const maxZ = tiles.reduce((m, t) => Math.max(m, t.z), 0);
  for (const t of tiles) {
    const x = ox + (t.x / 2 - t.z * TILE.shift - e.minX) * W;
    const y = oy + ((t.y / 2) * TILE.ratio - t.z * TILE.shift - e.minY) * W;
    const H = W * TILE.ratio, D = W * TILE.depth;
    rr(ctx, x + D, y + D, W, H, W * 0.15);
    ctx.fillStyle = color;
    ctx.fill();
    rr(ctx, x, y, W, H, W * 0.15);
    const light = 0.86 + (t.z / Math.max(1, maxZ)) * 0.14;
    ctx.fillStyle = done ? `rgb(${Math.round(255 * light)},${Math.round(250 * light)},${Math.round(236 * light)})` : `rgb(${Math.round(250 * light)},${Math.round(244 * light)},${Math.round(230 * light)})`;
    ctx.fill();
    ctx.lineWidth = Math.max(0.5, W * 0.06);
    ctx.strokeStyle = 'rgba(120, 90, 50, .35)';
    ctx.stroke();
  }
}
