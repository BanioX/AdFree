// Bühne der Mal-Ansicht: Leinwand, Kamera, Gesten, Ebenen-Cache und Animationen.
//
// Darstellung: Die Vektorgrafik wird in eine "Ebene" (Viewport + Rand) gerendert. Während Gesten
// wird diese Ebene transformiert gezeichnet (darunter eine niedrig aufgelöste Gesamtansicht für
// freigelegte Ränder) und kurz nach Ende der Geste wieder scharf neu gerendert. Ist das Rendern
// billig (< 7 ms), wird auch während Gesten jeder Frame scharf gezeichnet.
// Füllungen werden lokal (nur im Rahmen der Form) aktualisiert und mit einem runden
// Aufdeck-Effekt vom Tippunkt aus animiert.

import {
  fitCamera, clampCam, clampScale, softScale, unsoftScale, softTranslate, unsoftTranslate,
  isOutOfBounds, zoomAround, lerpCam, toUnits as camToUnits,
} from './camera.js';
import { drawPicture, drawLabels, fontStr, LABEL_MIN, LABEL_MAX, outlineWidthFor, makeHatch } from './render.js';

const STAGE_BG = '#f1e9de';
const ACCENT = '#ff6f7d';
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function makeCanvas(w = 1, h = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Stage {
  /**
   * @param {HTMLElement} host
   * @param {object} M Modell (buildModel)
   * @param {object} cb { onTap(sx,sy), onBrushStart(sx,sy), onBrushMove(x0,y0,x1,y1), onBrushEnd(), onGesture() }
   */
  constructor(host, M, cb = {}) {
    this.host = host;
    this.M = M;
    this.cb = cb;
    this.canvas = makeCanvas();
    this.canvas.className = 'pv-canvas';
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.layer = makeCanvas();
    this.lctx = this.layer.getContext('2d');
    this.over = makeCanvas();
    this.octx = this.over.getContext('2d');
    this.hitCtx = makeCanvas(1, 1).getContext('2d');

    this.filled = new Uint8Array(M.n);
    this.selected = 0;
    this.outlineAlpha = 1;
    this.labelsOn = true;
    this.highlightOn = true;
    this.hatchOn = true;
    this.tapEnabled = true;
    this.gesturesEnabled = true;

    this.dpr = 1;
    this.VW = 0;
    this.VH = 0;
    this.pad = 14;
    this.cam = null;
    this.lcam = null;
    this.loff = 0;
    this.ocam = null;
    this.layerValid = false;
    this.overValid = false;
    this.lastRenderMs = 0;
    this.lastRenderAt = 0;
    this.lastCamChange = 0;
    this.renderCount = 0;

    this.reveals = [];
    this.pulses = [];
    this.rings = [];
    this.fade = null;
    this.preview = null;
    this.anim = null;
    this.inertia = null;
    this.brush = null;

    this.pointers = new Map();
    this.mode = 'idle';
    this.raw = null;
    this.pinch = null;
    this.samples = [];
    this.lpTimer = 0;
    this.wheelUntil = 0;
    this.raf = 0;
    this.destroyed = false;

    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e, false);
    this._cancel = (e) => this.onUp(e, true);
    this._wheel = (e) => this.onWheel(e);
    const c = this.canvas;
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._cancel);
    c.addEventListener('lostpointercapture', this._cancel);
    c.addEventListener('wheel', this._wheel, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  // ------------------------------------------------------------------ Grösse & Kamera

  get vp() {
    return this._vp;
  }

  resize() {
    if (this.destroyed) return;
    const r = this.host.getBoundingClientRect();
    const VW = Math.round(r.width), VH = Math.round(r.height);
    if (VW < 20 || VH < 20) return;
    if (VW === this.VW && VH === this.VH && this.cam) return;
    const prev = this.cam && this._vp ? {
      atFit: this.isAtFit(),
      rel: this.cam.s / this._vp.minS,
      center: camToUnits(this.cam, this.VW / 2, this.VH / 2),
    } : null;
    this.VW = VW;
    this.VH = VH;
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const dpr = this.dpr;
    this.canvas.width = Math.round(VW * dpr);
    this.canvas.height = Math.round(VH * dpr);
    this.canvas.style.width = VW + 'px';
    this.canvas.style.height = VH + 'px';
    const mcss = Math.round(Math.min(VW, VH) * 0.12);
    this.loff = Math.round(mcss * dpr);
    this.layer.width = this.canvas.width + 2 * this.loff;
    this.layer.height = this.canvas.height + 2 * this.loff;

    const M = this.M;
    const base = { W: M.W, H: M.H, VW, VH, pad: this.pad, minS: 1, maxS: 1 };
    const fit = fitCamera(base);
    const maxZoom = Math.min(16, Math.max(4, 16 / (M.minFont * fit.s)));
    this._vp = { ...base, minS: fit.s, maxS: fit.s * maxZoom };
    this.maxZoom = maxZoom;

    const ovs = Math.min(1700, Math.ceil(Math.max(M.W, M.H) * fit.s * dpr * 1.2)) / Math.max(M.W, M.H);
    this.over.width = Math.max(1, Math.ceil(M.W * ovs));
    this.over.height = Math.max(1, Math.ceil(M.H * ovs));
    this.ocam = { s: ovs / dpr, x: 0, y: 0 };

    if (prev && !prev.atFit) {
      const s = clampScale(prev.rel * fit.s, this._vp);
      this.cam = clampCam({ s, x: VW / 2 - prev.center[0] * s, y: VH / 2 - prev.center[1] * s }, this._vp);
    } else {
      this.cam = fit;
    }
    this.anim = null;
    this.inertia = null;
    this.layerValid = false;
    this.overValid = false;
    this.kick();
  }

  fitCam() {
    return fitCamera(this._vp);
  }

  isAtFit() {
    const f = fitCamera(this._vp);
    return Math.abs(this.cam.s / f.s - 1) < 0.01;
  }

  setCam(cam) {
    this.cam = cam;
    this.lastCamChange = performance.now();
    this.kick();
  }

  /** Kamera relativ speichern: [Zoom relativ zu "einpassen", Mittelpunkt x, y in Einheiten]. */
  getCamState() {
    const c = camToUnits(this.cam, this.VW / 2, this.VH / 2);
    return [+(this.cam.s / this._vp.minS).toFixed(3), +c[0].toFixed(1), +c[1].toFixed(1)];
  }

  restoreCamState(st) {
    if (!Array.isArray(st) || st.length !== 3 || !this._vp) return;
    const s = clampScale(st[0] * this._vp.minS, this._vp);
    this.cam = clampCam({ s, x: this.VW / 2 - st[1] * s, y: this.VH / 2 - st[2] * s }, this._vp);
    this.layerValid = false;
    this.kick();
  }

  toUnits(sx, sy) {
    return camToUnits(this.cam, sx, sy);
  }

  toScreen(ux, uy) {
    return [ux * this.cam.s + this.cam.x, uy * this.cam.s + this.cam.y];
  }

  /** Kamera animieren. */
  animateTo(target, dur = 520, easing = easeInOut) {
    return new Promise((resolve) => {
      if (this.anim && this.anim.done) this.anim.done(false);
      this.inertia = null;
      this.anim = { from: { ...this.cam }, to: target, t0: performance.now(), dur, ease: easing, done: resolve };
      this.kick();
    });
  }

  fit(animated = true) {
    const f = this.fitCam();
    if (!animated) { this.setCam(f); return Promise.resolve(); }
    return this.animateTo(f, 480);
  }

  zoomToPoint(ux, uy, s, dur = 650) {
    const vp = this._vp;
    s = clampScale(s, vp);
    const target = clampCam({ s, x: vp.VW / 2 - ux * s, y: vp.VH / 2 - uy * s }, vp);
    return this.animateTo(target, dur);
  }

  // ------------------------------------------------------------------ Zustand

  setSelected(c) {
    if (c === this.selected) return;
    this.selected = c;
    this.layerValid = false; // Gesamtansicht zeigt keine Hervorhebung -> bleibt gültig
    this.kick();
  }

  invalidate() {
    this.layerValid = false;
    this.overValid = false;
    this.kick();
  }

  /** Form i füllen. (ux, uy) = Tippunkt in Einheiten für den Aufdeck-Effekt (null = sofort). */
  fillShape(i, ux, uy, animate = true) {
    this.filled[i] = 1;
    const animOk = animate && ux != null && this.lcam && this.layerValid;
    if (!this.layerValid) {
      // Ebene ist veraltet -> wird ohnehin komplett neu gezeichnet
      this.overValid = false;
      this.kick();
      return;
    }
    const rect = this.shapeRect(i, this.lcam, this.loff, this.layer);
    let patch = null;
    if (animOk && rect) {
      const w = rect[2] - rect[0], h = rect[3] - rect[1];
      const pc = makeCanvas(w, h);
      pc.getContext('2d').drawImage(this.layer, rect[0], rect[1], w, h, 0, 0, w, h);
      patch = { canvas: pc, rx: rect[0], ry: rect[1], cam: { ...this.lcam }, off: this.loff };
    }
    if (rect) this.renderInto(this.lctx, this.lcam, this.loff, rect, this.layerOpts());
    if (this.overValid) {
      const orect = this.shapeRect(i, this.ocam, 0, this.over);
      if (orect) this.renderInto(this.octx, this.ocam, 0, orect, { ...this.layerOpts(), highlight: -1, labels: false });
    }
    if (patch) {
      const b = i * 4, bb = this.M.bbox;
      const maxR = Math.max(
        Math.hypot(ux - bb[b], uy - bb[b + 1]), Math.hypot(ux - bb[b + 2], uy - bb[b + 1]),
        Math.hypot(ux - bb[b], uy - bb[b + 3]), Math.hypot(ux - bb[b + 2], uy - bb[b + 3]));
      const pxSize = maxR * this.cam.s;
      const dur = Math.min(420, 230 + pxSize * 0.12);
      this.reveals.push({ i, ux, uy, maxR, t0: performance.now(), dur, patch });
    }
    this.kick();
  }

  /** Alle Füllungen neu setzen (Neu beginnen, Zeitraffer-Start). */
  setFilledAll(arr) {
    this.filled.set(arr);
    this.reveals = [];
    this.invalidate();
  }

  // ------------------------------------------------------------------ Rendern

  layerOpts() {
    return {
      highlight: this.highlightOn ? this.selected : -1,
      outlineAlpha: this.outlineAlpha,
      labels: this.labelsOn,
    };
  }

  shapeRect(i, cam, off, canvas) {
    const dpr = this.dpr, bb = this.M.bbox, b = i * 4;
    const s = cam.s * dpr, tx = cam.x * dpr + off, ty = cam.y * dpr + off;
    const m = 4 + Math.ceil(dpr * 1.5);
    let x0 = Math.floor(bb[b] * s + tx) - m, y0 = Math.floor(bb[b + 1] * s + ty) - m;
    let x1 = Math.ceil(bb[b + 2] * s + tx) + m, y1 = Math.ceil(bb[b + 3] * s + ty) + m;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(canvas.width, x1); y1 = Math.min(canvas.height, y1);
    if (x1 <= x0 || y1 <= y0) return null;
    return [x0, y0, x1, y1];
  }

  /** Szene (oder Ausschnitt rect in Gerätepixeln) in ctx zeichnen. */
  renderInto(ctx, cam, off, rect, o) {
    const M = this.M, dpr = this.dpr;
    const s = cam.s * dpr, tx = cam.x * dpr + off, ty = cam.y * dpr + off;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const R = rect || [0, 0, cw, ch];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (rect) {
      ctx.beginPath();
      ctx.rect(R[0], R[1], R[2] - R[0], R[3] - R[1]);
      ctx.clip();
    }
    ctx.clearRect(R[0], R[1], R[2] - R[0], R[3] - R[1]);
    ctx.setTransform(s, 0, 0, s, tx, ty);
    ctx.beginPath();
    ctx.rect(0, 0, M.W, M.H);
    ctx.clip();
    ctx.fillStyle = M.bg;
    ctx.fillRect(0, 0, M.W, M.H);
    const view = [(R[0] - tx) / s, (R[1] - ty) / s, (R[2] - tx) / s, (R[3] - ty) / s];
    let hlFill = null;
    if (o.highlight != null && o.highlight >= 0 && this.hatchOn) {
      if (!this._hatch || this._hatch.ctx !== ctx || this._hatch.dpr !== dpr) this._hatch = { ctx, dpr, p: makeHatch(ctx, dpr) };
      hlFill = this._hatch.p;
      try { hlFill.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, -tx / s, -ty / s])); } catch { hlFill = null; }
    }
    drawPicture(ctx, M, o.filled || this.filled, {
      view, unit: 1 / cam.s, highlight: o.highlight, outlineAlpha: o.outlineAlpha, seam: true,
      outlineWidth: outlineWidthFor(M, cam.s), hlFill,
    });
    if (o.labels) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawLabels(ctx, M, o.filled || this.filled, { s, tx, ty, dpr, rect: R, selected: this.selected });
    }
    ctx.restore();
  }

  renderLayer() {
    const t0 = performance.now();
    this.lcam = { ...this.cam };
    this.renderInto(this.lctx, this.lcam, this.loff, null, this.layerOpts());
    this.layerValid = true;
    const t1 = performance.now();
    this.lastRenderMs = t1 - t0;
    this.lastRenderAt = t1;
    this.renderCount++;
  }

  renderOverview() {
    this.renderInto(this.octx, this.ocam, 0, null, { ...this.layerOpts(), highlight: -1, labels: false });
    this.overValid = true;
  }

  /** Transformation von einer Quell-Kamera (+ Versatz) auf die aktuelle Kamera. */
  xf(src, off) {
    const C = this.cam, dpr = this.dpr;
    const r = C.s / src.s;
    return [r, dpr * C.x - r * (src.x * dpr + off), dpr * C.y - r * (src.y * dpr + off)];
  }

  layerCoverage() {
    if (!this.lcam) return { full: false, ratio: 1 };
    const [r, ox, oy] = this.xf(this.lcam, this.loff);
    const C = this.cam, dpr = this.dpr, M = this.M;
    const vx0 = Math.max(0, C.x * dpr), vy0 = Math.max(0, C.y * dpr);
    const vx1 = Math.min(this.canvas.width, (C.x + M.W * C.s) * dpr);
    const vy1 = Math.min(this.canvas.height, (C.y + M.H * C.s) * dpr);
    const full = ox <= vx0 + 1 && oy <= vy0 + 1 && ox + this.layer.width * r >= vx1 - 1 && oy + this.layer.height * r >= vy1 - 1;
    return { full, ratio: r };
  }

  kick() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame() {
    this.raf = 0;
    if (this.destroyed || !this.cam) return;
    const now = performance.now();
    let more = false;

    if (this.anim) {
      const a = this.anim;
      const t = Math.min(1, (now - a.t0) / a.dur);
      this.cam = t >= 1 ? a.to : lerpCam(a.from, a.to, a.ease(t), this.VW, this.VH);
      this.lastCamChange = now;
      if (t >= 1) { this.anim = null; a.done && a.done(true); } else more = true;
    }
    if (this.inertia) more = this.stepInertia(now) || more;

    const camMoving = this.anim || this.inertia || this.mode === 'pan' || this.mode === 'pinch' || now < this.wheelUntil;
    let live = false;
    if (!this.layerValid) this.renderLayer();
    else if (!sameCam(this.cam, this.lcam)) {
      if (!camMoving) {
        if (now - this.lastCamChange > 90) this.renderLayer(); else more = true;
      } else if (this.liveOk()) {
        // wenige Formen sichtbar: auch während der Geste scharf zeichnen
        this.renderLayer();
        live = true;
      } else {
        const cov = this.layerCoverage();
        if ((!cov.full && !this.overValid) || ((cov.ratio > 2.2 || cov.ratio < 0.45) && now - this.lastRenderAt > 300)) this.renderLayer();
        more = true;
      }
    }
    if (!this.overValid && !this._ovTimer) {
      // Gesamtansicht in einer Ruhepause nachziehen
      this._ovTimer = setTimeout(() => {
        this._ovTimer = 0;
        if (this.overValid || this.destroyed) return;
        if (this.mode !== 'idle' || this.anim || this.inertia) { this.kick(); return; }
        this.renderOverview();
      }, 400);
    }

    more = this.composite(now) || more;
    if (live && performance.now() - now > 14) this.slowLive = (this.slowLive || 0) + 1;
    if (more) this.kick();
  }

  /** Lohnt sich scharfes Zeichnen in jedem Frame? (wenige sichtbare Formen, bisher flüssig) */
  liveOk() {
    if ((this.slowLive || 0) >= 3) return false;
    const M = this.M, bb = M.bbox, C = this.cam;
    const x0 = -C.x / C.s, y0 = -C.y / C.s, x1 = (this.VW - C.x) / C.s, y1 = (this.VH - C.y) / C.s;
    let k = 0;
    for (let i = 0, n = M.n; i < n; i++) {
      const b = i * 4;
      if (bb[b] > x1 || bb[b + 2] < x0 || bb[b + 1] > y1 || bb[b + 3] < y0) continue;
      if (++k > 110) return false;
    }
    return true;
  }

  composite(now) {
    const ctx = this.ctx, dpr = this.dpr, C = this.cam, M = this.M;
    const cw = this.canvas.width, ch = this.canvas.height;
    let active = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = STAGE_BG;
    ctx.fillRect(0, 0, cw, ch);
    const px = C.x * dpr, py = C.y * dpr, pw = M.W * C.s * dpr, ph = M.H * C.s * dpr;
    this.drawShadow(ctx, px, py, pw, ph);
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 8 * dpr);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py, pw, ph);
    if (this.overValid && !this.layerCoverage().full) this.blit(ctx, this.over, this.ocam, 0);
    if (this.lcam) this.blit(ctx, this.layer, this.lcam, this.loff);

    // Aufdeck-Animationen
    if (this.reveals.length) {
      const keep = [];
      for (const rv of this.reveals) {
        const t = (now - rv.t0) / rv.dur;
        if (t >= 1) { rv.patch.canvas.width = 0; continue; }
        keep.push(rv);
        this.drawReveal(ctx, rv, t);
      }
      this.reveals = keep;
      if (keep.length) active = true;
    }

    // Überblendung (z.B. Umrisse ausblenden)
    if (this.fade) {
      const f = this.fade;
      const t = Math.min(1, (now - f.t0) / f.dur);
      ctx.globalAlpha = easeInOut(t);
      this.blit(ctx, f.canvas, f.cam, f.off);
      ctx.globalAlpha = 1;
      if (t >= 1) {
        this.fade = null;
        this.layerValid = false;
        f.done && f.done();
      }
      active = true;
    }

    // Vorlage anzeigen
    if (this.preview) {
      const p = this.preview;
      const el = now - p.t0;
      let a;
      if (p.closing != null) a = Math.max(0, p.closingFrom * (1 - (now - p.closing) / 260));
      else a = Math.min(1, el / 220);
      if (p.closing == null && el > p.hold) { p.closing = now; p.closingFrom = a; }
      if (a <= 0 && p.closing != null) {
        p.canvas.width = 0;
        this.preview = null;
        p.done && p.done();
      } else {
        ctx.globalAlpha = a;
        this.blit(ctx, p.canvas, p.cam, p.off);
        ctx.globalAlpha = 1;
      }
      active = true;
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (this.rings.length) active = this.drawRings(ctx, now) || active;
    if (this.pulses.length) active = this.drawPulses(ctx, now) || active;
    if (this.brush) {
      const b = this.brush;
      const k = Math.min(1, (now - b.t0) / 160);
      const r = (16 + 6 * easeOut(k)) * dpr;
      ctx.beginPath();
      ctx.arc(b.x * dpr, b.y * dpr, r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(M.palette[this.selected], 0.32);
      ctx.fill();
      ctx.lineWidth = 2.5 * dpr;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.stroke();
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = 'rgba(60,45,35,.35)';
      ctx.beginPath();
      ctx.arc(b.x * dpr, b.y * dpr, r + 1.8 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      if (k < 1) active = true;
    }
    return active;
  }

  blit(ctx, img, src, off) {
    const [r, ox, oy] = this.xf(src, off);
    ctx.setTransform(r, 0, 0, r, ox, oy);
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawReveal(ctx, rv, t) {
    const C = this.cam, dpr = this.dpr, M = this.M;
    const e = easeOut(t);
    const R = Math.max(0.0001, rv.maxR * e);
    const b = rv.i * 4, bb = M.bbox;
    ctx.save();
    ctx.setTransform(C.s * dpr, 0, 0, C.s * dpr, C.x * dpr, C.y * dpr);
    ctx.clip(M.paths[rv.i], M.rules[rv.i]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bb[b] - 10, bb[b + 1] - 10, bb[b + 2] - bb[b] + 20, bb[b + 3] - bb[b + 1] + 20);
    ctx.arc(rv.ux, rv.uy, R, 0, Math.PI * 2);
    ctx.clip('evenodd');
    const p = rv.patch;
    const [r, ox, oy] = this.xf(p.cam, p.off);
    ctx.setTransform(r, 0, 0, r, ox, oy);
    ctx.drawImage(p.canvas, p.rx, p.ry);
    ctx.restore();
    // feuchter Rand der Farbe
    ctx.beginPath();
    ctx.arc(rv.ux, rv.uy, R, 0, Math.PI * 2);
    ctx.lineWidth = (2 + 7 * (1 - e)) / C.s;
    ctx.strokeStyle = `rgba(255,255,255,${(0.5 * (1 - t)).toFixed(3)})`;
    ctx.stroke();
    ctx.restore();
  }

  drawRings(ctx, now) {
    const dpr = this.dpr;
    const keep = [];
    for (const g of this.rings) {
      const el = now - g.t0;
      if (el > g.dur) continue;
      keep.push(g);
      const [sx, sy] = this.toScreen(g.ux, g.uy);
      const base = Math.max(18, Math.min(120, g.r * this.cam.s * 1.25));
      for (let k = 0; k < 3; k++) {
        const t = (el - k * 300) / 1000;
        if (t <= 0 || t >= 1) continue;
        const rr = base * (0.55 + 0.9 * easeOut(t));
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, rr * dpr, 0, Math.PI * 2);
        ctx.lineWidth = (4 - 2 * t) * dpr;
        ctx.strokeStyle = hexA(ACCENT, 0.9 * (1 - t));
        ctx.stroke();
      }
      const ft = Math.min(1, el / 250) * Math.max(0, 1 - (el - g.dur + 450) / 450);
      if (ft > 0) {
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, base * 0.55 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = hexA(ACCENT, 0.16 * ft);
        ctx.fill();
      }
    }
    this.rings = keep;
    return keep.length > 0;
  }

  drawPulses(ctx, now) {
    const dpr = this.dpr, M = this.M;
    const keep = [];
    for (const p of this.pulses) {
      const t = (now - p.t0) / 520;
      if (t >= 1) continue;
      keep.push(p);
      const lb = M.labelOf(p.i);
      const fcss = lb.f * this.cam.s;
      const k = 1 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      if (fcss >= LABEL_MIN && this.labelsOn) {
        const [sx, sy] = this.toScreen(lb.x, lb.y);
        const fd = Math.min(LABEL_MAX, fcss) * dpr * k;
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, fd * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(0.95 * Math.sin(Math.PI * t)).toFixed(3)})`;
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = fontStr(800, fd);
        ctx.fillStyle = hexA('#e0475a', Math.sin(Math.PI * t));
        ctx.fillText(M.num[M.col[p.i]], sx * dpr, sy * dpr + fd * 0.04);
      } else {
        const [sx, sy] = this.toScreen(p.ux, p.uy);
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, (10 + 14 * easeOut(t)) * dpr, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 * dpr;
        ctx.strokeStyle = hexA('#7a6e64', 0.6 * (1 - t));
        ctx.stroke();
      }
    }
    this.pulses = keep;
    return keep.length > 0;
  }

  drawShadow(ctx, x, y, w, h) {
    const dpr = this.dpr;
    if (!this._shadow || this._shadow.dpr !== dpr) this._shadow = makeShadow(dpr);
    const S = this._shadow;
    const E = S.E, Q = S.Q, cv = S.canvas, size = cv.width;
    const mid = size - 2 * (E + Q);
    const xs = [x - E, x + Q, x + w - Q, x + w + E];
    const ys = [y - E, y + Q, y + h - Q, y + h + E];
    const sx = [0, E + Q, E + Q + mid, size];
    if (w < 2 * Q || h < 2 * Q) return;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const dw = xs[a + 1] - xs[a], dh = ys[b + 1] - ys[b];
        if (dw <= 0 || dh <= 0) continue;
        if (a === 1 && b === 1) continue; // Mitte liegt unter dem Papier
        ctx.drawImage(cv, sx[a], sx[b], sx[a + 1] - sx[a], sx[b + 1] - sx[b], xs[a], ys[b], dw, dh);
      }
    }
  }

  // ------------------------------------------------------------------ Effekte

  hintRing(ux, uy, rUnits) {
    this.rings.push({ ux, uy, r: rUnits, t0: performance.now(), dur: 1650 });
    this.kick();
  }

  pulseWrong(i, ux, uy) {
    this.pulses = this.pulses.filter((p) => p.i !== i);
    this.pulses.push({ i, ux, uy, t0: performance.now() });
    this.kick();
  }

  /** Überblendung zu einem neu gerenderten Zustand (z.B. ohne Umrisse). */
  fadeTo(opts, dur = 900) {
    return new Promise((resolve) => {
      const cv = makeCanvas(this.layer.width, this.layer.height);
      const cam = { ...this.cam };
      this.renderInto(cv.getContext('2d'), cam, this.loff, null, { ...this.layerOpts(), ...opts });
      if (this.fade) { this.fade.canvas.width = 0; this.fade.done && this.fade.done(); }
      this.fade = { canvas: cv, cam, off: this.loff, t0: performance.now(), dur, done: resolve };
      this.kick();
    });
  }

  /** Fertiges Bild kurz einblenden («Vorlage anzeigen»). */
  showPreview(hold = 1900) {
    return new Promise((resolve) => {
      if (this.preview) { resolve(); return; }
      const cv = makeCanvas(this.layer.width, this.layer.height);
      const cam = { ...this.cam };
      const all = new Uint8Array(this.M.n).fill(1);
      this.renderInto(cv.getContext('2d'), cam, this.loff, null, { filled: all, outlineAlpha: 0, labels: false, highlight: -1 });
      this.preview = { canvas: cv, cam, off: this.loff, t0: performance.now(), hold, done: resolve };
      this.kick();
    });
  }

  hidePreview() {
    const p = this.preview;
    if (p && p.closing == null) {
      p.closing = performance.now();
      p.closingFrom = Math.min(1, (p.closing - p.t0) / 220);
      this.kick();
    }
  }

  // ------------------------------------------------------------------ Treffer

  /** Oberste Form an einem Punkt (Einheiten) oder -1. */
  hit(ux, uy) {
    const M = this.M;
    if (ux < 0 || uy < 0 || ux > M.W || uy > M.H) return -1;
    const bb = M.bbox, hc = this.hitCtx;
    for (let i = M.n - 1; i >= 0; i--) {
      const b = i * 4;
      if (ux < bb[b] || ux > bb[b + 2] || uy < bb[b + 1] || uy > bb[b + 3]) continue;
      if (hc.isPointInPath(M.paths[i], ux, uy, M.rules[i])) return i;
    }
    return -1;
  }

  /**
   * Grosszügiges Antippen: sucht innerhalb von radiusCss eine sichtbare Form, für die
   * accept(i) gilt. Rückgabe { i, ux, uy } (nächster Punkt) oder null.
   */
  findNear(sx, sy, radiusCss, accept, candidates) {
    const M = this.M, bb = M.bbox;
    const [ux, uy] = this.toUnits(sx, sy);
    const ru = radiusCss / this.cam.s;
    let any = false;
    for (const i of candidates) {
      const b = i * 4;
      if (ux + ru < bb[b] || ux - ru > bb[b + 2] || uy + ru < bb[b + 1] || uy - ru > bb[b + 3]) continue;
      any = true;
      break;
    }
    if (!any) return null;
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radiusCss * ring) / 4;
      const steps = 6 + ring * 4;
      let best = null;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + ring * 0.37;
        const px = ux + (Math.cos(a) * r) / this.cam.s, py = uy + (Math.sin(a) * r) / this.cam.s;
        const h = this.hit(px, py);
        if (h >= 0 && accept(h)) { best = { i: h, ux: px, uy: py }; break; }
      }
      if (best) return best;
    }
    return null;
  }

  // ------------------------------------------------------------------ Gesten

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  stopMotion() {
    if (this.anim) { const a = this.anim; this.anim = null; a.done && a.done(false); }
    this.inertia = null;
  }

  onDown(e) {
    if (!this.gesturesEnabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.local(e);
    const now = performance.now();
    this.pointers.set(e.pointerId, { x: p.x, y: p.y, type: e.pointerType });
    this.stopMotion();
    if (this.preview) this.hidePreview();
    if (this.pointers.size === 1) {
      this.mode = 'pending';
      this.downP = p;
      this.downT = now;
      this.samples = [[now, p.x, p.y]];
      clearTimeout(this.lpTimer);
      if (this.tapEnabled) this.lpTimer = setTimeout(() => this.startBrush(), 350);
      this.cb.onGesture && this.cb.onGesture();
    } else if (this.pointers.size === 2) {
      clearTimeout(this.lpTimer);
      if (this.mode === 'brush') this.endBrush();
      this.startPinch();
    }
  }

  startBrush() {
    if (this.mode !== 'pending' || this.pointers.size !== 1 || !this.tapEnabled) return;
    this.mode = 'brush';
    const p = [...this.pointers.values()][0];
    this.brush = { x: p.x, y: p.y, t0: performance.now() };
    this.cb.onBrushStart && this.cb.onBrushStart(p.x, p.y);
    this.kick();
  }

  endBrush() {
    if (this.mode !== 'brush') return;
    this.brush = null;
    this.mode = 'idle';
    this.cb.onBrushEnd && this.cb.onBrushEnd();
    this.kick();
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    const d0 = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
    const c0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.mode = 'pinch';
    this.pinch = { d0, s0: unsoftScale(this.cam.s, this._vp), u: this.toUnits(c0.x, c0.y), c: c0 };
  }

  updatePinch() {
    const [a, b] = [...this.pointers.values()];
    const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const P = this.pinch;
    const sRaw = (P.s0 * d) / P.d0;
    const s = softScale(sRaw, this._vp);
    const x = c.x - P.u[0] * s, y = c.y - P.u[1] * s;
    const t = softTranslate(x, y, s, this._vp);
    this.raw = { x, y };
    P.c = c;
    this.setCam({ s, x: t.x, y: t.y });
  }

  beginPan() {
    this.mode = 'pan';
    // rohe Translation aus der aktuellen (evtl. weichen) Kamera
    this.raw = unsoftTranslate(this.cam.x, this.cam.y, this.cam.s, this._vp);
  }

  onMove(e) {
    const P = this.pointers.get(e.pointerId);
    if (!P) return;
    e.preventDefault();
    const p = this.local(e);
    const dx = p.x - P.x, dy = p.y - P.y;
    const prev = { x: P.x, y: P.y };
    P.x = p.x;
    P.y = p.y;
    const now = performance.now();
    if (this.mode === 'pending') {
      const slop = P.type === 'mouse' ? 4 : 9;
      if (Math.hypot(p.x - this.downP.x, p.y - this.downP.y) > slop) {
        clearTimeout(this.lpTimer);
        this.beginPan();
        this.raw.x += p.x - this.downP.x;
        this.raw.y += p.y - this.downP.y;
        this.applyPan();
        this.samples.push([now, p.x, p.y]);
      }
    } else if (this.mode === 'pan') {
      this.raw.x += dx;
      this.raw.y += dy;
      this.applyPan();
      this.samples.push([now, p.x, p.y]);
      if (this.samples.length > 12) this.samples.shift();
    } else if (this.mode === 'pinch') {
      if (this.pointers.size >= 2) this.updatePinch();
    } else if (this.mode === 'brush') {
      this.brush.x = p.x;
      this.brush.y = p.y;
      this.cb.onBrushMove && this.cb.onBrushMove(prev.x, prev.y, p.x, p.y);
      this.kick();
    }
  }

  applyPan() {
    const t = softTranslate(this.raw.x, this.raw.y, this.cam.s, this._vp);
    this.setCam({ s: this.cam.s, x: t.x, y: t.y });
  }

  onUp(e, cancelled) {
    const P = this.pointers.get(e.pointerId);
    if (!P) return;
    this.pointers.delete(e.pointerId);
    const now = performance.now();
    if (this.mode === 'pending') {
      clearTimeout(this.lpTimer);
      this.mode = 'idle';
      if (!cancelled && this.pointers.size === 0 && this.tapEnabled) {
        const p = this.local(e);
        this.cb.onTap && this.cb.onTap(p.x, p.y);
      }
    } else if (this.mode === 'brush') {
      this.endBrush();
    } else if (this.mode === 'pinch') {
      if (this.pointers.size === 1) {
        // weiter mit einem Finger verschieben
        this.mode = 'pan';
        this.raw = { x: this.raw.x, y: this.raw.y };
        this.samples = [];
      } else if (this.pointers.size === 0) {
        this.mode = 'idle';
        this.settle(this.pinch ? this.pinch.c : null);
      }
    } else if (this.mode === 'pan') {
      if (this.pointers.size === 0) {
        this.mode = 'idle';
        this.release(now);
      }
    }
    if (this.pointers.size === 0 && this.mode !== 'idle') this.mode = 'idle';
  }

  release(now) {
    const vp = this._vp;
    if (isOutOfBounds(this.cam, vp)) { this.settle(null); return; }
    const S = this.samples.filter((s) => now - s[0] < 100);
    if (S.length >= 2) {
      const a = S[0], b = S[S.length - 1];
      const dt = Math.max(16, b[0] - a[0]);
      const vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
      if (Math.hypot(vx, vy) > 0.25) {
        this.inertia = { vx, vy, t: now };
        this.kick();
        return;
      }
    }
    this.lastCamChange = now;
    this.kick();
  }

  stepInertia(now) {
    const I = this.inertia;
    const dt = Math.min(40, now - I.t);
    I.t = now;
    const decay = Math.exp(-dt / 330);
    let x = this.cam.x + I.vx * dt, y = this.cam.y + I.vy * dt;
    const c = clampCam({ s: this.cam.s, x, y }, this._vp);
    if (c.x !== x) { x = c.x; I.vx = 0; }
    if (c.y !== y) { y = c.y; I.vy = 0; }
    I.vx *= decay;
    I.vy *= decay;
    this.cam = { s: this.cam.s, x, y };
    this.lastCamChange = now;
    if (Math.hypot(I.vx, I.vy) < 0.015) { this.inertia = null; return false; }
    return true;
  }

  settle(center) {
    const vp = this._vp;
    let cam = this.cam;
    const s = clampScale(cam.s, vp);
    if (s !== cam.s && center) cam = zoomAround(cam, center.x, center.y, s);
    const target = clampCam(cam, vp);
    if (Math.abs(target.s - this.cam.s) / this.cam.s > 1e-4 || Math.abs(target.x - this.cam.x) > 0.3 || Math.abs(target.y - this.cam.y) > 0.3) {
      this.animateTo(target, 360, easeOut);
    } else {
      this.lastCamChange = performance.now();
      this.kick();
    }
  }

  onWheel(e) {
    if (!this.gesturesEnabled) return;
    e.preventDefault();
    this.stopMotion();
    const p = this.local(e);
    const vp = this._vp;
    const zoom = e.ctrlKey || e.metaKey || e.deltaMode === 1 ||
      (Math.abs(e.deltaX) < 0.01 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
    let cam;
    if (zoom) {
      const dy = e.deltaY * (e.deltaMode === 1 ? 18 : 1);
      const k = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0025));
      const s = clampScale(this.cam.s * k, vp);
      cam = clampCam(zoomAround(this.cam, p.x, p.y, s), vp);
    } else {
      cam = clampCam({ s: this.cam.s, x: this.cam.x - e.deltaX, y: this.cam.y - e.deltaY }, vp);
    }
    this.wheelUntil = performance.now() + 120;
    this.setCam(cam);
  }

  // ------------------------------------------------------------------ Aufräumen

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.lpTimer);
    clearTimeout(this._ovTimer);
    this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._cancel);
    c.removeEventListener('lostpointercapture', this._cancel);
    c.removeEventListener('wheel', this._wheel);
    for (const rv of this.reveals) rv.patch.canvas.width = 0;
    if (this.fade) this.fade.canvas.width = 0;
    if (this.preview) this.preview.canvas.width = 0;
    this.layer.width = this.layer.height = 0;
    this.over.width = this.over.height = 0;
    c.width = c.height = 0;
    c.remove();
  }
}

function sameCam(a, b) {
  return a && b && a.s === b.s && a.x === b.x && a.y === b.y;
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return `rgba(120,110,100,${a})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Vorgerenderter, weicher Schatten für 9-Slice-Zeichnen. */
function makeShadow(dpr) {
  const blur = 16 * dpr, off = 5 * dpr;
  const E = Math.ceil(blur * 1.6 + off), Q = Math.ceil(10 * dpr);
  const size = 2 * (E + Q) + 4;
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.shadowColor = 'rgba(80,52,25,.22)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = size * 2;
  ctx.shadowOffsetY = off;
  ctx.fillStyle = '#000';
  roundRect(ctx, E - size * 2, E, size - 2 * E, size - 2 * E, 8 * dpr);
  ctx.fill();
  // zweiter, enger Kontaktschatten
  ctx.shadowColor = 'rgba(80,52,25,.12)';
  ctx.shadowBlur = 3 * dpr;
  ctx.shadowOffsetY = 1 * dpr;
  roundRect(ctx, E - size * 2, E, size - 2 * E, size - 2 * E, 8 * dpr);
  ctx.fill();
  return { canvas: cv, E, Q, dpr };
}

export { easeOut, easeInOut };
