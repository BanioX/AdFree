// Bilderrätsel – Spielfeld auf Canvas: Hinweis-Leisten (bleiben beim Zoomen sichtbar),
// Raster mit Zoom/Verschieben, Mini-Übersicht in der Ecke, Animationen und die farbige Enthüllung.

import { FILL, CROSS } from './core/game.js';
import { ease } from '../shared/ui.js';

export const COLORS = {
  card: '#ffffff',
  band: '#f9f2e8',
  bandLine: '#eadfce',
  hlBand: '#fde3ee',
  hlCell: 'rgba(224, 105, 154, 0.10)',
  grid: '#ebe1d4',
  grid5: '#c2b19d',
  border: '#9a8878',
  ink: '#3d3551',
  inkHi: '#6a5e8c',
  cross: '#b7a999',
  clue: '#3a302a',
  clueDone: '#cdc2b6',
  clueOver: '#e5484d',
  err: '#e5484d',
  hint: '#ffcf33',
  accent: '#e0699a',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PAD = 8;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
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

export class BoardView {
  constructor(canvas, game) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.g = game;
    this.p = game.p;
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cs = 20; this.fitCs = 20; this.maxCs = 40;
    this.sx = 0; this.sy = 0;
    this.hover = null;          // { r, c } – hervorgehobene Zeile/Spalte
    this.anims = new Map();     // index -> { t0, kind }
    this.flashes = [];          // { axis, k, t0 }
    this.errors = new Map();    // index -> t0 (kurzes Aufblinken)
    this.marks = new Set();     // von «Prüfen» gefundene Fehler – bleiben bis zur Änderung des Felds
    this.coach = null;          // { axis, k } – Coach-Mark beim allerersten Bild
    this.hintMark = null;       // { index, axis, k, t0 }
    this.bubble = null;         // { x, y, n }
    this.reveal = null;         // { t0, dur, from, to }
    this.revealDone = false;
    this.revealArea = null;     // { x, y, w, h } – Bereich für das fertige Bild
    this.dirty = true;
    this.status = null;         // Zwischenspeicher für Linien-Status
    this.maxRowClues = Math.max(1, ...this.p.rowClues.map((c) => c.length || 1));
    this.maxColClues = Math.max(1, ...this.p.colClues.map((c) => c.length || 1));
  }

  invalidate() { this.status = null; this.dirty = true; }

  lineStatuses() {
    if (!this.status) {
      const rows = [], cols = [];
      for (let r = 0; r < this.g.h; r++) rows.push(this.g.lineStatus(0, r));
      for (let c = 0; c < this.g.w; c++) cols.push(this.g.lineStatus(1, c));
      this.status = { rows, cols };
    }
    return this.status;
  }

  // ---------- Geometrie ----------

  bands(cs) {
    const font = clamp(cs * 0.5, 9.5, 14.5);
    const slot = clamp(cs * 0.6, 11, 16.5);
    const digitW = font * 0.6;
    let rb = 0;
    for (const clue of this.p.rowClues) {
      let s = 0;
      for (const n of (clue.length ? clue : [0])) s += Math.max(slot, String(n).length * digitW + 5);
      rb = Math.max(rb, s);
    }
    rb = Math.ceil(rb + 10);
    const slotV = clamp(cs * 0.58, 12, 17);
    const cb = Math.ceil(this.maxColClues * slotV + 10);
    return { font, slot, slotV, digitW, rb, cb };
  }

  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px';
    this.cv.style.height = H + 'px';
    const { w, h } = this.g;
    let cs = 24;
    for (let i = 0; i < 6; i++) {
      const b = this.bands(cs);
      cs = Math.min((W - 2 * PAD - b.rb) / w, (H - 2 * PAD - b.cb) / h);
    }
    this.fitCs = clamp(Math.floor(cs * 4) / 4, 6, 58);
    this.maxCs = Math.max(this.fitCs, 40);
    if (!this.userZoomed) this.cs = this.fitCs;
    this.cs = clamp(this.cs, this.fitCs, this.maxCs);
    this.layout();
  }

  get zoomable() { return this.maxCs > this.fitCs * 1.15 && this.fitCs < 30; }
  get zoomed() { return this.cs > this.fitCs + 0.5; }
  comfortCs() { return clamp(Math.max(32, this.fitCs * 1.5), this.fitCs, this.maxCs); }

  layout() {
    const { w, h } = this.g;
    const cs = this.cs;
    const m = this.bands(cs);
    this.m = m;
    const gw = w * cs, gh = h * cs;
    const aw = this.W - 2 * PAD, ah = this.H - 2 * PAD;
    if (m.rb + gw <= aw + 0.5) {
      this.bandX = PAD + (aw - (m.rb + gw)) / 2;
      this.vx = this.bandX + m.rb; this.vw = gw; this.sx = 0;
    } else {
      this.bandX = PAD; this.vx = PAD + m.rb; this.vw = aw - m.rb;
      this.sx = clamp(this.sx, 0, gw - this.vw);
    }
    if (m.cb + gh <= ah + 0.5) {
      this.bandY = PAD + (ah - (m.cb + gh)) / 2;
      this.vy = this.bandY + m.cb; this.vh = gh; this.sy = 0;
    } else {
      this.bandY = PAD; this.vy = PAD + m.cb; this.vh = ah - m.cb;
      this.sy = clamp(this.sy, 0, gh - this.vh);
    }
    this.dirty = true;
  }

  /** Zoomt auf Zellgrösse cs, Fixpunkt (px, py) in Canvas-Koordinaten bleibt stehen. */
  zoomTo(cs, px, py) {
    cs = clamp(cs, this.fitCs, this.maxCs);
    const fx = (px - this.vx + this.sx) / this.cs;
    const fy = (py - this.vy + this.sy) / this.cs;
    this.cs = cs;
    this.userZoomed = this.zoomed;
    const m = this.bands(cs);
    // vorläufige Viewport-Position, damit der Fixpunkt stimmt
    this.sx = fx * cs - (px - (PAD + m.rb));
    this.sy = fy * cs - (py - (PAD + m.cb));
    this.layout();
  }

  /** Zentriert die Ansicht auf Zelle (r, c). */
  centerOn(r, c) {
    this.sx = (c + 0.5) * this.cs - this.vw / 2;
    this.sy = (r + 0.5) * this.cs - this.vh / 2;
    this.layout();
  }

  panBy(dx, dy) {
    this.sx -= dx; this.sy -= dy;
    this.layout();
  }

  canPan(dx, dy) {
    const gw = this.g.w * this.cs, gh = this.g.h * this.cs;
    return { x: dx < 0 ? this.sx > 0.5 : this.sx < gw - this.vw - 0.5, y: dy < 0 ? this.sy > 0.5 : this.sy < gh - this.vh - 0.5 };
  }

  hit(x, y) {
    const { vx, vy, vw, vh, bandX, bandY } = this;
    if (x >= vx && x < vx + vw && y >= vy && y < vy + vh) {
      return { zone: 'grid', r: Math.floor((y - vy + this.sy) / this.cs), c: Math.floor((x - vx + this.sx) / this.cs) };
    }
    if (x >= bandX - 4 && x < vx && y >= vy && y < vy + vh) return { zone: 'rows', r: Math.floor((y - vy + this.sy) / this.cs) };
    if (y >= bandY - 4 && y < vy && x >= vx && x < vx + vw) return { zone: 'cols', c: Math.floor((x - vx + this.sx) / this.cs) };
    if (x >= bandX - 4 && x < vx && y >= bandY - 4 && y < vy) return { zone: 'corner' };
    return { zone: 'none' };
  }

  /** Zelle unter (x, y), auf das Raster begrenzt. */
  cellAt(x, y) {
    return {
      r: clamp(Math.floor((y - this.vy + this.sy) / this.cs), 0, this.g.h - 1),
      c: clamp(Math.floor((x - this.vx + this.sx) / this.cs), 0, this.g.w - 1),
    };
  }

  /** Mittelpunkt einer Zelle in Canvas-Koordinaten. */
  cellCenter(r, c) {
    return { x: this.vx - this.sx + (c + 0.5) * this.cs, y: this.vy - this.sy + (r + 0.5) * this.cs };
  }

  // ---------- Animationen ----------

  animate(index, kind, now = performance.now()) { this.anims.set(index, { t0: now, kind }); this.dirty = true; }
  flashLine(axis, k, now = performance.now()) { this.flashes.push({ axis, k, t0: now }); this.dirty = true; }
  markError(index, now = performance.now()) { this.errors.set(index, now); this.dirty = true; }
  setMarks(list) { this.marks = new Set(list); this.dirty = true; }
  clearMarks(indices) { for (const i of indices) this.marks.delete(i); this.dirty = true; }
  markHint(index, axis, k, now = performance.now()) { this.hintMark = { index, axis, k, t0: now }; this.dirty = true; }

  isAnimating(now) {
    if (this.reveal && !this.revealDone) return true;
    if (this.anims.size || this.flashes.length || this.errors.size) return true;
    if (this.hintMark && now - this.hintMark.t0 < 2200) return true;
    if (this.coach) return true;
    return false;
  }

  startReveal(area, now = performance.now()) {
    this.revealArea = area;
    const { w, h } = this.g;
    const to = this.pictureGeometry(area);
    this.reveal = {
      t0: now,
      dur: 1900 + (w + h) * 18,
      from: { x: this.vx - this.sx, y: this.vy - this.sy, cs: this.cs },
      to,
    };
    this.revealDone = false;
    this.hover = null;
    this.bubble = null;
    this.dirty = true;
  }

  /** Sofort fertiges Bild zeigen (z.B. beim Öffnen eines gelösten Rätsels). */
  showPicture(area) {
    this.revealArea = area;
    this.reveal = { t0: 0, dur: 1, from: null, to: this.pictureGeometry(area) };
    this.revealDone = true;
    this.dirty = true;
  }

  pictureGeometry(area) {
    const { w, h } = this.g;
    const cs = Math.min((area.w - 24) / w, (area.h - 24) / h, 44);
    return { cs, x: area.x + (area.w - cs * w) / 2, y: area.y + (area.h - cs * h) / 2 };
  }

  // ---------- Zeichnen ----------

  draw(now = performance.now()) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.reveal) this.drawReveal(ctx, now);
    else this.drawBoard(ctx, now, 1);
    // abgelaufene Animationen entfernen
    for (const [i, a] of this.anims) if (now - a.t0 > 260) this.anims.delete(i);
    this.flashes = this.flashes.filter((f) => now - f.t0 < 650);
    for (const [i, t0] of this.errors) if (now - t0 > 1400) this.errors.delete(i);
    this.dirty = false;
  }

  drawBoard(ctx, now, alpha) {
    const { w, h } = this.g;
    const { m, cs } = this;
    const st = this.lineStatuses();
    const gx = this.vx - this.sx, gy = this.vy - this.sy;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Karte
    const cx0 = this.bandX - 6, cy0 = this.bandY - 6;
    const cw = this.vx + this.vw - this.bandX + 12, ch = this.vy + this.vh - this.bandY + 12;
    ctx.save();
    ctx.shadowColor = 'rgba(70, 45, 20, 0.13)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = COLORS.card;
    roundRect(ctx, cx0, cy0, cw, ch, 16);
    ctx.fill();
    ctx.restore();

    // Hinweis-Leisten (Hintergrund)
    ctx.fillStyle = COLORS.band;
    roundRect(ctx, this.bandX, this.vy, m.rb - 3, this.vh, 8); ctx.fill();
    roundRect(ctx, this.vx, this.bandY, this.vw, m.cb - 3, 8); ctx.fill();

    const hv = this.hover;
    const hint = this.hintMark && now - this.hintMark.t0 < 2200 ? this.hintMark : null;

    // Hervorhebung in den Leisten
    ctx.save();
    ctx.beginPath(); ctx.rect(this.bandX, this.vy, m.rb - 3, this.vh); ctx.rect(this.vx, this.bandY, this.vw, m.cb - 3); ctx.clip();
    const hlRow = (r, color) => { ctx.fillStyle = color; ctx.fillRect(this.bandX, gy + r * cs, m.rb - 3, cs); };
    const hlCol = (c, color) => { ctx.fillStyle = color; ctx.fillRect(gx + c * cs, this.bandY, cs, m.cb - 3); };
    if (hv) { hlRow(hv.r, COLORS.hlBand); hlCol(hv.c, COLORS.hlBand); }
    if (hint) {
      const a = 0.35 + 0.25 * Math.sin((now - hint.t0) / 120);
      if (hint.axis === 0) hlRow(hint.k, `rgba(255, 207, 51, ${a})`); else hlCol(hint.k, `rgba(255, 207, 51, ${a})`);
    }
    for (const f of this.flashes) {
      const t = (now - f.t0) / 650;
      const color = `rgba(126, 211, 140, ${0.45 * (1 - t)})`;
      if (f.axis === 0) hlRow(f.k, color); else hlCol(f.k, color);
    }
    ctx.restore();

    // Mini-Übersicht in der Ecke
    this.drawCorner(ctx);

    // Raster
    ctx.save();
    ctx.beginPath(); ctx.rect(this.vx, this.vy, this.vw, this.vh); ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.vx, this.vy, this.vw, this.vh);
    const c0 = Math.max(0, Math.floor(this.sx / cs)), c1 = Math.min(w - 1, Math.floor((this.sx + this.vw) / cs));
    const r0 = Math.max(0, Math.floor(this.sy / cs)), r1 = Math.min(h - 1, Math.floor((this.sy + this.vh) / cs));
    if (hv) {
      ctx.fillStyle = COLORS.hlCell;
      ctx.fillRect(gx, gy + hv.r * cs, w * cs, cs);
      ctx.fillRect(gx + hv.c * cs, gy, cs, h * cs);
    }
    if (hint) {
      const a = 0.18 + 0.1 * Math.sin((now - hint.t0) / 120);
      ctx.fillStyle = `rgba(255, 207, 51, ${a})`;
      if (hint.axis === 0) ctx.fillRect(gx, gy + hint.k * cs, w * cs, cs);
      else ctx.fillRect(gx + hint.k * cs, gy, cs, h * cs);
    }
    for (const f of this.flashes) {
      const t = (now - f.t0) / 650;
      ctx.fillStyle = `rgba(126, 211, 140, ${0.28 * (1 - t)})`;
      if (f.axis === 0) ctx.fillRect(gx, gy + f.k * cs, w * cs, cs);
      else ctx.fillRect(gx + f.k * cs, gy, cs, h * cs);
    }
    const inset = Math.max(1, cs * 0.07);
    const rad = cs * 0.2;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * w + c;
        const v = this.g.cells[i];
        const x = gx + c * cs, y = gy + r * cs;
        const an = this.anims.get(i);
        const et = this.errors.get(i);
        if (et != null) {
          const t = (now - et) / 1400;
          ctx.fillStyle = `rgba(229, 72, 77, ${0.28 * (1 - t)})`;
          ctx.fillRect(x, y, cs, cs);
        }
        const marked = this.marks.has(i);
        if (v === FILL) {
          let s = 1;
          if (an && an.kind === 'fill') s = 0.55 + 0.45 * ease.outBack(Math.min(1, (now - an.t0) / 200));
          else if (marked && et != null) s = 1 + 0.12 * Math.sin(Math.min(1, (now - et) / 600) * Math.PI);
          const sz = (cs - inset * 2) * s;
          const ox = x + (cs - sz) / 2, oy = y + (cs - sz) / 2;
          ctx.fillStyle = marked ? COLORS.err : COLORS.ink;
          roundRect(ctx, ox, oy, sz, sz, rad * s);
          ctx.fill();
          if (marked) {
            // falsch gefüllt: rotes Feld mit weissem ✕ (auch ohne Farbsehen erkennbar)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(1.4, cs * 0.09);
            ctx.lineCap = 'round';
            const a = x + cs * 0.33, b = x + cs * 0.67, ya = y + cs * 0.33, yb = y + cs * 0.67;
            ctx.beginPath();
            ctx.moveTo(a, ya); ctx.lineTo(b, yb);
            ctx.moveTo(b, ya); ctx.lineTo(a, yb);
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
            roundRect(ctx, ox + sz * 0.12, oy + sz * 0.1, sz * 0.76, sz * 0.32, rad * 0.6 * s);
            ctx.fill();
          }
        } else if (v === CROSS) {
          let t = 1;
          if (an && an.kind === 'cross') t = ease.outCubic(Math.min(1, (now - an.t0) / 160));
          const red = et != null || marked;
          if (marked) {
            ctx.fillStyle = 'rgba(229, 72, 77, 0.16)';
            roundRect(ctx, x + inset, y + inset, cs - inset * 2, cs - inset * 2, rad);
            ctx.fill();
          }
          ctx.strokeStyle = red ? COLORS.err : COLORS.cross;
          ctx.lineWidth = Math.max(1.4, cs * (red ? 0.1 : 0.075));
          ctx.lineCap = 'round';
          const a = cs * 0.3, b = cs * 0.7;
          ctx.beginPath();
          ctx.moveTo(x + a, y + a); ctx.lineTo(x + a + (b - a) * t, y + a + (b - a) * t);
          ctx.moveTo(x + b, y + a); ctx.lineTo(x + b - (b - a) * t, y + a + (b - a) * t);
          ctx.stroke();
        } else if (an && an.kind === 'erase') {
          const t = Math.min(1, (now - an.t0) / 160);
          ctx.fillStyle = `rgba(61, 53, 81, ${0.35 * (1 - t)})`;
          const sz = (cs - inset * 2) * (1 - t * 0.6);
          roundRect(ctx, x + (cs - sz) / 2, y + (cs - sz) / 2, sz, sz, rad);
          ctx.fill();
        }
      }
    }
    if (hint) {
      const r = Math.floor(hint.index / w), c = hint.index % w;
      const t = (now - hint.t0) / 2200;
      ctx.strokeStyle = `rgba(255, 176, 0, ${1 - t * 0.7})`;
      ctx.lineWidth = Math.max(2, cs * 0.12);
      const grow = Math.sin(t * Math.PI * 4) * cs * 0.06;
      roundRect(ctx, gx + c * cs + 1 - grow, gy + r * cs + 1 - grow, cs - 2 + grow * 2, cs - 2 + grow * 2, rad);
      ctx.stroke();
    }
    // Linien
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    for (let c = c0; c <= c1 + 1; c++) if (c % 5) { const x = Math.round(gx + c * cs) + 0.5; ctx.moveTo(x, this.vy); ctx.lineTo(x, this.vy + this.vh); }
    for (let r = r0; r <= r1 + 1; r++) if (r % 5) { const y = Math.round(gy + r * cs) + 0.5; ctx.moveTo(this.vx, y); ctx.lineTo(this.vx + this.vw, y); }
    ctx.stroke();
    ctx.strokeStyle = COLORS.grid5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let c = 0; c <= w; c += 5) { const x = Math.round(gx + c * cs) + 0.25; ctx.moveTo(x, this.vy); ctx.lineTo(x, this.vy + this.vh); }
    for (let r = 0; r <= h; r += 5) { const y = Math.round(gy + r * cs) + 0.25; ctx.moveTo(this.vx, y); ctx.lineTo(this.vx + this.vw, y); }
    ctx.stroke();
    ctx.restore();
    // Rahmen
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(Math.round(gx) + 0.25 + Math.max(0, this.vx - gx), Math.round(this.vy) + 0.25, Math.min(this.vw, w * cs), Math.min(this.vh, h * cs));

    // Zahlen
    this.drawClues(ctx, st, gx, gy);

    // Coach-Mark: pulsierender Rahmen um die erste sinnvolle Zeile/Spalte (inkl. Zahlen)
    if (this.coach) {
      const { axis, k } = this.coach;
      const p = 0.5 + 0.5 * Math.sin(now / 260);
      const grow = 2 + p * 3;
      ctx.save();
      ctx.strokeStyle = `rgba(224, 105, 154, ${0.65 + 0.35 * p})`;
      ctx.lineWidth = 3;
      if (axis === 0) roundRect(ctx, this.bandX - grow, gy + k * cs - grow, this.vx + this.vw - this.bandX + grow * 2, cs + grow * 2, 10);
      else roundRect(ctx, gx + k * cs - grow, this.bandY - grow, cs + grow * 2, this.vy + this.vh - this.bandY + grow * 2, 10);
      ctx.stroke();
      ctx.restore();
    }

    // Zähler-Blase beim Ziehen
    if (this.bubble) {
      const { x, y, n } = this.bubble;
      const txt = String(n);
      ctx.font = `800 17px ${FONT}`;
      const tw = Math.max(34, ctx.measureText(txt).width + 22);
      const bx = clamp(x - tw / 2, 4, this.W - tw - 4), by = Math.max(4, y - 66);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.fillStyle = COLORS.ink;
      roundRect(ctx, bx, by, tw, 32, 16); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + tw / 2, by + 16.5);
    }
    ctx.restore();
  }

  drawClues(ctx, st, gx, gy) {
    const { m, cs } = this;
    const { w, h } = this.g;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `750 ${m.font}px ${FONT}`;
    // Zeilen
    ctx.save();
    ctx.beginPath(); ctx.rect(this.bandX, this.vy, m.rb - 3, this.vh); ctx.clip();
    for (let r = 0; r < h; r++) {
      const y = gy + (r + 0.5) * cs;
      if (y < this.vy - cs || y > this.vy + this.vh + cs) continue;
      const clue = this.p.rowClues[r];
      const s = st.rows[r];
      const nums = clue.length ? clue : [0];
      let x = this.vx - 7;
      for (let j = nums.length - 1; j >= 0; j--) {
        const n = nums[j];
        const sw = Math.max(m.slot, String(n).length * m.digitW + 5);
        ctx.fillStyle = s.over ? COLORS.clueOver : (clue.length === 0 || s.marks[j]) ? COLORS.clueDone : COLORS.clue;
        ctx.fillText(String(n), x - sw / 2, y + 0.5);
        x -= sw;
      }
      if (r % 5 === 0 && r) {
        ctx.fillStyle = COLORS.bandLine;
        ctx.fillRect(this.bandX + 4, gy + r * cs - 0.5, m.rb - 11, 1);
      }
    }
    ctx.restore();
    // Spalten
    const maxTw = cs - 6;
    ctx.save();
    ctx.beginPath(); ctx.rect(this.vx, this.bandY, this.vw, m.cb - 3); ctx.clip();
    for (let c = 0; c < w; c++) {
      const x = gx + (c + 0.5) * cs;
      if (x < this.vx - cs || x > this.vx + this.vw + cs) continue;
      const clue = this.p.colClues[c];
      const s = st.cols[c];
      const nums = clue.length ? clue : [0];
      let y = this.vy - 5 - m.slotV / 2;
      for (let j = nums.length - 1; j >= 0; j--) {
        ctx.fillStyle = s.over ? COLORS.clueOver : (clue.length === 0 || s.marks[j]) ? COLORS.clueDone : COLORS.clue;
        const txt = String(nums[j]);
        const tw = txt.length > 1 ? ctx.measureText(txt).width : 0;
        if (tw > maxTw) {
          // zweistellige Zahlen in schmalen Spalten etwas schmaler setzen, damit Luft bleibt
          ctx.save();
          ctx.translate(x, y + 0.5);
          ctx.scale(Math.max(0.68, maxTw / tw), 1);
          ctx.fillText(txt, 0, 0);
          ctx.restore();
        } else ctx.fillText(txt, x, y + 0.5);
        y -= m.slotV;
      }
      if (c % 5 === 0 && c) {
        ctx.fillStyle = COLORS.bandLine;
        ctx.fillRect(gx + c * cs - 0.5, this.bandY + 4, 1, m.cb - 11);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  drawCorner(ctx) {
    // Mini-Übersicht nur bei Brettern, die man zoomen kann (sonst wirkt sie wie ein Fleck)
    if (!this.zoomable) return;
    const { m } = this;
    const { w, h } = this.g;
    const x0 = this.bandX, y0 = this.bandY, cw = m.rb - 3, ch = m.cb - 3;
    const s = Math.min((cw - 10) / w, (ch - 10) / h);
    if (s <= 0) return;
    const px = x0 + (cw - s * w) / 2, py = y0 + (ch - s * h) / 2;
    ctx.fillStyle = '#fbf7f1';
    roundRect(ctx, px - 3, py - 3, s * w + 6, s * h + 6, 5); ctx.fill();
    ctx.fillStyle = COLORS.inkHi;
    for (let i = 0; i < this.g.n; i++) {
      if (this.g.cells[i] !== FILL) continue;
      ctx.fillRect(px + (i % w) * s, py + Math.floor(i / w) * s, Math.ceil(s), Math.ceil(s));
    }
    if (this.zoomed) {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1.5;
      const k = s / this.cs;
      ctx.strokeRect(px + this.sx * k, py + this.sy * k, Math.min(w * s, this.vw * k), Math.min(h * s, this.vh * k));
    }
  }

  drawReveal(ctx, now) {
    const R = this.reveal;
    const { w, h } = this.g;
    const p = this.revealDone ? 1 : Math.min(1, (now - R.t0) / R.dur);
    if (p >= 1) this.revealDone = true;
    // Phase 1: Leisten ausblenden
    const fade = R.from ? clamp(1 - p / 0.18, 0, 1) : 0;
    if (fade > 0) {
      this.hover = null;
      this.drawBoard(ctx, now, fade);
    }
    // Geometrie überblenden
    const mv = R.from ? ease.inOutCubic(clamp((p - 0.08) / 0.32, 0, 1)) : 1;
    const from = R.from || R.to;
    const cs = from.cs + (R.to.cs - from.cs) * mv;
    const gx = from.x + (R.to.x - from.x) * mv;
    const gy = from.y + (R.to.y - from.y) * mv;
    const bg = this.p.def.bg || '#fffaf3';
    const appear = R.from ? clamp((p - 0.04) / 0.2, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = appear;
    // Bildkarte
    ctx.save();
    ctx.shadowColor = 'rgba(70, 45, 20, 0.22)';
    ctx.shadowBlur = 24 * mv;
    ctx.shadowOffsetY = 8 * mv;
    ctx.fillStyle = mix('#ffffff', bg, clamp((p - 0.3) / 0.3, 0, 1));
    roundRect(ctx, gx - 6 * mv, gy - 6 * mv, w * cs + 12 * mv, h * cs + 12 * mv, 6 + 10 * mv);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, gx, gy, w * cs, h * cs, 4 + 6 * mv);
    ctx.clip();
    ctx.fillStyle = mix('#ffffff', bg, clamp((p - 0.3) / 0.3, 0, 1));
    ctx.fillRect(gx, gy, w * cs, h * cs);
    const diag = Math.max(1, w + h - 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (!this.p.mask[i]) continue;
        const d = (r + c) / diag;
        const lt = clamp((p - 0.32 - d * 0.42) / 0.2, 0, 1);
        const col = lt >= 1 ? this.p.colors[i] : mix(COLORS.ink, this.p.colors[i], ease.outCubic(lt));
        const bump = Math.sin(lt * Math.PI) * 0.22;
        const gap = cs * 0.08 * (1 - clamp((p - 0.3) / 0.25, 0, 1));
        const sz = cs * (1 + bump) - gap * 2 + 0.6;
        ctx.fillStyle = col;
        ctx.fillRect(gx + c * cs + (cs - sz) / 2, gy + r * cs + (cs - sz) / 2, sz, sz);
      }
    }
    // Glanz-Welle
    if (R.from && p > 0.3 && p < 0.95) {
      const t = (p - 0.3) / 0.65;
      const sweep = gx - w * cs * 0.4 + (w * cs * 1.8) * t;
      const grd = ctx.createLinearGradient(sweep - cs * 3, gy, sweep + cs * 3, gy + h * cs);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(gx, gy, w * cs, h * cs);
    }
    ctx.restore();
    ctx.restore();
  }
}

export const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Kleines Vorschaubild: farbig (gelöst) oder Fortschritt (dunkle Zellen). */
export function drawThumb(canvas, def, { mode = 'color', cells = null, size = 72 } = {}) {
  const rows = def.rows;
  const h = rows.length, w = rows[0].length;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const px = Math.max(1, Math.floor((size * dpr) / Math.max(w, h)));
  canvas.width = w * px;
  canvas.height = h * px;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (mode === 'color') {
    ctx.fillStyle = def.bg || '#fffaf3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = def.palette[ch];
      ctx.fillRect(c * px, r * px, px, px);
    }
  } else {
    // Fortschritt: helles Raster wie das Spielfeld, gefüllte Felder dunkel
    const gap = px >= 6 ? Math.max(1, Math.round(px * 0.08)) : 0;
    ctx.fillStyle = gap ? '#eee4d8' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < w * h; i++) {
      const filled = cells && cells.charCodeAt(i) === 49;
      if (!filled && !gap) continue;
      ctx.fillStyle = filled ? COLORS.inkHi : '#ffffff';
      ctx.fillRect((i % w) * px + gap, Math.floor(i / w) * px + gap, px - gap, px - gap);
    }
  }
}
