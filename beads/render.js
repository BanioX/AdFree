// Perlenbild – Canvas-Darstellung: Bild, aktive Zone, Ablage, Vorrat, fliegende Steine.
//
// Die Spiellogik (level.js) ändert ihren Zustand sofort. Diese Ansicht führt einen
// eigenen «sichtbaren» Zustand, der den Animationen folgt: Ein Stein erscheint im Bild
// erst, wenn er gelandet ist. So bleibt alles robust gegen schnelles Mehrfach-Tippen.

import { gemSprite, shadowSprite, drawGem, ghostColor } from './gems.js';
import { mixRgb, rgba, parseHex } from './colors.js';
import { plink, tock, chime } from './sound.js';
import { MAX_SLOTS } from './level.js';

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const ACCENT = [63, 142, 240];
const POP_MS = 300;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

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

function makeCanvas() { return document.createElement('canvas'); }

export class BoardView {
  /**
   * opts: { onColumnTap(c), onProgress(placed, total) }
   */
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.bg = makeCanvas();
    this.pic = makeCanvas();
    this.flyers = [];
    this.pops = [];
    this.parts = [];
    this.flashes = [];
    this.shake = [];
    this.press = [];
    this.slotFx = new Float64Array(MAX_SLOTS);
    this.idleWaiters = [];
    this.raf = 0;
    this.lastT = 0;
    this.nextId = 1;
    this.shine = null;
    this.band = null;
    this.lastChime = 0;
    this.destroyed = false;
    this._frame = (t) => this.frame(t);
    this._down = (e) => this.onPointerDown(e);
    canvas.addEventListener('pointerdown', this._down);
    this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    if (this._ro && canvas.parentElement) this._ro.observe(canvas.parentElement);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.cv.removeEventListener('pointerdown', this._down);
    window.removeEventListener('resize', this._onResize);
    if (this._ro) this._ro.disconnect();
  }

  // ------------------------------------------------------------------ Zustand

  setGame(game) {
    this.game = game;
    this.L = game.L;
    const L = this.L;
    const st = game.st;
    this.R = st.R;
    this.visFilled = game.filledMask();
    this.pending = new Uint8Array(L.W * L.H);
    this.visRowRem = new Int32Array(L.H);
    for (let i = 0; i < L.cells.length; i++) if (L.cells[i] >= 0 && !this.visFilled[i]) this.visRowRem[L.rbOf[i]]++;
    this.visPlaced = st.placed;
    this.zoneDirty = true;
    this.band = null;
    this.slots = [];
    for (let s = 0; s < MAX_SLOTS; s++) this.slots.push(st.slotK[s] >= 0 ? { k: st.slotK[s], n: st.slotN[s] } : null);
    this.nSlots = st.S;
    this.slotReady = new Float64Array(MAX_SLOTS);
    this.cols = game.trayColumns().map((col) => col.map((k) => this.newGem(k)));
    this.shake = this.cols.map(() => -1e9);
    this.press = this.cols.map(() => -1e9);
    this.flyers = [];
    this.pops = [];
    this.parts = [];
    this.flashes = [];
    this.shine = null;
    // Farb-Infos vorbereiten
    this.colorInfo = L.colors.map((hex) => {
      const rgb = parseHex(hex);
      const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
      return {
        hex,
        ghost: ghostColor(hex),
        ghostStrong: ghostColor(hex, 0.4),
        zoneFill: rgba(rgb, lum > 0.85 ? 0.9 : 0.62),
        zoneRing: rgba(lum > 0.85 ? mixRgb(rgb, [90, 90, 110], 0.45) : rgb, 0.55),
        light: lum > 0.85,
      };
    });
    this.W = 0;
    this.resize();
  }

  newGem(k) { return { id: this.nextId++, k, x: NaN, y: NaN, a: 0 }; }

  // ------------------------------------------------------------------ Layout

  resize() {
    if (this.destroyed || !this.L) return;
    const parent = this.cv.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const W = Math.max(240, Math.round(r.width));
    const H = Math.max(260, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.finishAll();
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px';
    this.cv.style.height = H + 'px';
    this.layout();
    this.renderBg();
    this.renderPic();
    this.snapTray();
    this.band = null;
    this.kick();
  }

  layout() {
    const { W, H, L } = this;
    const C = this.cols.length;
    const pad = 12;
    const panelPad = 8;
    const gap = C >= 8 ? 5 : 7;
    const inner = W - 2 * pad - 2 * panelPad;
    const colW = (inner - (C - 1) * gap) / C;
    let gem = Math.min(46, colW * 0.86);
    const STEP = 0.64;
    const trayHFor = (g, v) => 10 + g + (v - 1) * g * STEP + 24;
    const budget = H * 0.34;
    let V = H > 640 ? 6 : 5;
    while (V > 3 && trayHFor(gem, V) > budget) V--;
    if (trayHFor(gem, V) > budget) gem = Math.max(24, (budget - 34) / (1 + (V - 1) * STEP));
    const step = gem * STEP;
    const trayH = trayHFor(gem, V);
    const trayY = H - trayH - 4;

    const S = this.nSlots;
    const slotGap = S > 6 ? 6 : 9;
    const slotD = Math.min(46, gem * 1.02, (W - 2 * pad - 2 * panelPad - (S - 1) * slotGap) / S);
    const parkH = slotD + 18;
    const parkY = trayY - 10 - parkH;
    const slotsW = S * slotD + (S - 1) * slotGap;
    const parkW = W - 2 * pad;
    const showLabel = (parkW - slotsW) / 2 >= 66;

    const top = 4;
    const bottom = parkY - 10;
    const bpad = 10;
    const maxW = W - 2 * pad - 2 * bpad;
    const maxH = bottom - top - 2 * bpad;
    const cs = Math.max(4, Math.min(maxW / L.W, maxH / L.H, 40));
    const bw = cs * L.W + 2 * bpad;
    const bh = cs * L.H + 2 * bpad;
    const bx = (W - bw) / 2;
    const by = top + Math.max(0, (bottom - top - bh) / 2);
    this.g = {
      pad, panelPad, gap, colW, gem, step, V,
      trayX: pad, trayY, trayW: W - 2 * pad, trayH,
      parkX: pad, parkY, parkW, parkH, slotD, slotGap, slotsW, showLabel,
      cs, bx, by, bw, bh, bpad, ox: bx + bpad, oy: by + bpad,
    };
  }

  colX(c) {
    const g = this.g;
    return g.trayX + g.panelPad + c * (g.colW + g.gap) + g.colW / 2;
  }

  trayXY(c, i) {
    const g = this.g;
    const vi = Math.min(i, g.V - 1) + (i >= g.V ? 0.35 : 0);
    return [this.colX(c), g.trayY + 10 + g.gem / 2 + vi * g.step];
  }

  slotXY(s) {
    const g = this.g;
    const x0 = g.parkX + (g.parkW - g.slotsW) / 2 + (g.showLabel ? 22 : 0);
    return [x0 + s * (g.slotD + g.slotGap) + g.slotD / 2, g.parkY + g.parkH / 2];
  }

  cellXY(cell) {
    const g = this.g;
    const W = this.L.W;
    return [g.ox + (cell % W + 0.5) * g.cs, g.oy + (Math.floor(cell / W) + 0.5) * g.cs];
  }

  /** Mitte der vordersten Stein-Position einer Spalte (CSS-Pixel relativ zum Canvas). */
  columnCenter(c) {
    const [x, y] = this.trayXY(c, 0);
    return { x, y };
  }

  columnAt(x, y) {
    const g = this.g;
    if (!g || y < g.trayY - 8 || y > g.trayY + g.trayH + 8) return -1;
    if (x < g.trayX - 6 || x > g.trayX + g.trayW + 6) return -1;
    const rel = x - (g.trayX + g.panelPad);
    return clamp(Math.floor((rel + g.gap / 2) / (g.colW + g.gap)), 0, this.cols.length - 1);
  }

  onPointerDown(e) {
    if (!this.g) return;
    const r = this.cv.getBoundingClientRect();
    const c = this.columnAt(e.clientX - r.left, e.clientY - r.top);
    if (c >= 0 && this.opts.onColumnTap) {
      e.preventDefault();
      this.opts.onColumnTap(c);
    }
  }

  // ------------------------------------------------------------------ statische Ebenen

  renderBg() {
    const { W, H, dpr, g } = this;
    const cv = this.bg;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Bild-Karte
    ctx.save();
    ctx.shadowColor = 'rgba(70,45,20,0.13)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, g.bx, g.by, g.bw, g.bh, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    roundRect(ctx, g.bx + 0.5, g.by + 0.5, g.bw - 1, g.bh - 1, 21.5);
    ctx.strokeStyle = 'rgba(120,100,80,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ablage
    ctx.save();
    ctx.shadowColor = 'rgba(40,70,120,0.10)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, g.parkX, g.parkY, g.parkW, g.parkH, g.parkH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.fill();
    ctx.restore();
    if (g.showLabel) {
      ctx.fillStyle = '#8f9bb3';
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const [sx] = this.slotXY(0);
      ctx.fillText('ABLAGE', Math.max(g.parkX + 16, sx - g.slotD / 2 - 64), g.parkY + g.parkH / 2 + 0.5);
    }
    for (let s = 0; s < this.nSlots; s++) {
      const [x, y] = this.slotXY(s);
      const r = g.slotD / 2;
      const grd = ctx.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r);
      grd.addColorStop(0, '#f4f7fc');
      grd.addColorStop(1, '#e2e9f4');
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(80,110,160,0.16)';
      ctx.stroke();
      // innerer Schatten oben
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.35, r * 1.05, 0, TAU);
      ctx.lineWidth = r * 0.5;
      ctx.strokeStyle = 'rgba(60,90,140,0.06)';
      ctx.stroke();
      ctx.restore();
    }

    // Vorrat
    ctx.save();
    ctx.shadowColor = 'rgba(40,70,120,0.12)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, g.trayX, g.trayY, g.trayW, g.trayH, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
    for (let c = 0; c < this.cols.length; c++) {
      const x = this.colX(c) - g.colW / 2;
      const y = g.trayY + 5;
      const h = g.trayH - 10;
      const grd = ctx.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, rgba(ACCENT, 0.11));
      grd.addColorStop(1, rgba(ACCENT, 0.035));
      roundRect(ctx, x, y, g.colW, h, Math.min(g.colW / 2, 18));
      ctx.fillStyle = grd;
      ctx.fill();
    }
  }

  renderPic() {
    const { L, g, dpr } = this;
    const cv = this.pic;
    const w = g.cs * L.W;
    const h = g.cs * L.H;
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const popping = new Set(this.pops.map((p) => p.cell));
    // Lochraster + Geister (bei kleinen Zellen grösser und kräftiger, damit das Motiv lesbar bleibt)
    const small = g.cs < 14;
    const gr = g.cs * (g.cs < 11 ? 0.34 : small ? 0.29 : 0.22);
    for (let i = 0; i < L.cells.length; i++) {
      const k = L.cells[i];
      const x = (i % L.W + 0.5) * g.cs;
      const y = (Math.floor(i / L.W) + 0.5) * g.cs;
      if (k < 0) {
        ctx.fillStyle = '#f1ebe2';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, g.cs * 0.08), 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = small ? this.colorInfo[k].ghostStrong : this.colorInfo[k].ghost;
        ctx.beginPath();
        ctx.arc(x, y, gr, 0, TAU);
        ctx.fill();
      }
    }
    for (let i = 0; i < L.cells.length; i++) {
      if (L.cells[i] >= 0 && this.visFilled[i] && !popping.has(i)) this.commitCell(i, ctx);
    }
  }

  /** Zeichnet einen gelandeten Stein dauerhaft in die Bild-Ebene. */
  commitCell(cell, ctx = this.pic.getContext('2d')) {
    const { L, g, dpr } = this;
    const x = (cell % L.W + 0.5) * g.cs;
    const y = (Math.floor(cell / L.W) + 0.5) * g.cs;
    const d = g.cs * 0.94;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Schatten hinter bereits liegende Steine (Nachbarn bleiben sauber)
    const D = Math.max(4, Math.round(d * dpr));
    const sh = shadowSprite(D);
    const sw = sh.width * (d / D);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(sh, x - sw / 2, y - sw / 2 + d * 0.09, sw, sw);
    ctx.globalCompositeOperation = 'source-over';
    drawGem(ctx, L.colors[L.cells[cell]], x, y, d, dpr, { shadow: false });
  }

  snapTray() {
    for (let c = 0; c < this.cols.length; c++) {
      this.cols[c].forEach((gm, i) => {
        const [x, y] = this.trayXY(c, i);
        gm.x = x;
        gm.y = y;
        gm.a = i < this.g.V ? 1 : 0;
      });
    }
  }

  // ------------------------------------------------------------------ Zone

  visZone() {
    if (!this.zoneDirty) return this.zone;
    const L = this.L;
    let low = 0;
    while (low < L.H && this.visRowRem[low] === 0) low++;
    if (low >= L.H) { this.zone = null; this.zoneDirty = false; return null; }
    let n = 0;
    let top = low;
    for (let r = low; r < L.H; r++) {
      if (this.visRowRem[r] > 0) { top = r; if (++n === this.R) break; }
    }
    const cells = [];
    for (let r = low; r <= top; r++) {
      const y = L.H - 1 - r;
      for (let x = 0; x < L.W; x++) {
        const i = y * L.W + x;
        if (L.cells[i] >= 0 && !this.visFilled[i]) cells.push(i);
      }
    }
    this.zone = { low, top, cells };
    this.zoneDirty = false;
    return this.zone;
  }

  // ------------------------------------------------------------------ Aktionen

  kick() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this._frame);
  }

  whenIdle(cb) {
    this.idleWaiters.push(cb);
    this.kick();
  }

  flightDur(x0, y0, x1, y1) {
    return 300 + Math.min(240, Math.hypot(x1 - x0, y1 - y0) * 0.45);
  }

  addFlyer(f) {
    const dx = f.x1 - f.x0;
    const dy = f.y1 - f.y0;
    const dist = Math.hypot(dx, dy) || 1;
    let px = -dy / dist;
    let py = dx / dist;
    const mx = (f.x0 + f.x1) / 2;
    if ((px > 0) !== (mx > this.W / 2)) { px = -px; py = -py; }
    const bow = dist * (0.12 + ((this.nextId * 7) % 5) * 0.015);
    f.cx = mx + px * bow;
    f.cy = (f.y0 + f.y1) / 2 + py * bow - dist * 0.06;
    f.launched = false;
    this.flyers.push(f);
    return f;
  }

  /** Übernimmt die Züge einer Spiel-Aktion als Animationen. */
  applyMoves(moves, opts = {}) {
    if (!moves || !moves.length) return;
    const t = performance.now();
    const g = this.g;
    const stagger = opts.stagger ?? 36;
    let trayIdx = 0;
    let lastPlaceLand = t;
    let chainIdx = 0;
    let chainBase = t;
    let prevWasUnpark = false;
    for (const mv of moves) {
      if (mv.from === 'tray') {
        prevWasUnpark = false;
        const col = this.cols[mv.col];
        let gem = col ? col.splice(mv.depth, 1)[0] : null;
        if (!gem) gem = this.newGem(mv.k);
        if (Number.isNaN(gem.x)) { const p = this.trayXY(mv.col, mv.depth); gem.x = p[0]; gem.y = p[1]; }
        const launch = t + stagger * trayIdx++;
        const a0 = gem.a;
        const s0 = g.gem * (gem.a > 0.5 ? 1 : 0.7);
        if (this.press[mv.col] !== undefined) this.press[mv.col] = t;
        if (mv.t === 'place') {
          const [x1, y1] = this.cellXY(mv.cell);
          const dur = this.flightDur(gem.x, gem.y, x1, y1);
          this.pending[mv.cell] = 1;
          this.addFlyer({ k: mv.k, x0: gem.x, y0: gem.y, s0, a0, x1, y1, s1: g.cs * 0.94, t0: launch, dur, pre: true,
            onLand: (tt) => this.landCell(mv.cell, mv.k, tt) });
          lastPlaceLand = launch + dur;
        } else {
          const s = mv.slot;
          const [x1, y1] = this.slotXY(s);
          let dur = this.flightDur(gem.x, gem.y, x1, y1);
          if (launch + dur <= this.slotReady[s]) dur = this.slotReady[s] - launch + 20;
          this.slotReady[s] = launch + dur;
          this.addFlyer({ k: mv.k, x0: gem.x, y0: gem.y, s0, a0, x1, y1, s1: g.slotD * 0.84, t0: launch, dur, pre: true,
            onLand: (tt) => this.landSlot(s, mv.k, tt) });
        }
      } else if (mv.t === 'unpark') {
        const s = mv.slot;
        if (!prevWasUnpark) { chainIdx = 0; chainBase = Math.max(t, lastPlaceLand - 40); }
        prevWasUnpark = true;
        const launch = Math.max(chainBase + chainIdx * 48, this.slotReady[s] + 1);
        chainIdx++;
        this.slotReady[s] = launch;
        const [x0, y0] = this.slotXY(s);
        const [x1, y1] = this.cellXY(mv.cell);
        const dur = this.flightDur(x0, y0, x1, y1);
        this.pending[mv.cell] = 1;
        const first = chainIdx === 1;
        this.addFlyer({ k: mv.k, x0, y0, s0: g.slotD * 0.84, a0: 1, x1, y1, s1: g.cs * 0.94, t0: launch, dur, pre: false,
          onLaunch: () => { this.launchFromSlot(s); if (first) chime(); },
          onLand: (tt) => this.landCell(mv.cell, mv.k, tt) });
        lastPlaceLand = launch + dur;
      }
    }
    this.kick();
  }

  launchFromSlot(s) {
    const sl = this.slots[s];
    if (!sl) return;
    sl.n--;
    if (sl.n <= 0) this.slots[s] = null;
  }

  landSlot(s, k, t) {
    let sl = this.slots[s];
    if (!sl) sl = this.slots[s] = { k, n: 0 };
    sl.k = k;
    sl.n++;
    this.slotFx[s] = t;
    tock();
  }

  landCell(cell, k, t) {
    if (this.visFilled[cell]) return;
    const L = this.L;
    this.visFilled[cell] = 1;
    this.pending[cell] = 0;
    const rb = L.rbOf[cell];
    this.visRowRem[rb]--;
    this.visPlaced++;
    this.zoneDirty = true;
    this.pops.push({ cell, k, t0: t });
    const [x, y] = this.cellXY(cell);
    const cs = this.g.cs;
    this.parts.push({ type: 'ring', x, y, r0: cs * 0.35, r1: cs * 0.95, col: this.L.colors[k], t0: t, dur: 380 });
    if (cs >= 9) {
      for (let j = 0; j < 3; j++) {
        const a = Math.random() * TAU;
        const sp = cs * (1.2 + Math.random());
        this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cs * 0.6, t0: t, dur: 420 + Math.random() * 200, size: Math.max(1.4, cs * 0.12) });
      }
    }
    plink();
    if (this.visRowRem[rb] === 0) {
      this.flashes.push({ rb, t0: t });
      if (t - this.lastChime > 220) { this.lastChime = t; chime(); }
    }
    if (this.opts.onProgress) this.opts.onProgress(this.visPlaced, L.total);
  }

  refuse(c) {
    if (this.shake[c] !== undefined) this.shake[c] = performance.now();
    this.kick();
  }

  /** Nach «Mischen»: Steine gleiten an ihre neuen Plätze. */
  shuffleTray(cols) {
    const pool = new Map();
    for (const col of this.cols) for (const gm of col) {
      if (!pool.has(gm.k)) pool.set(gm.k, []);
      pool.get(gm.k).push(gm);
    }
    this.cols = cols.map((col) => col.map((k) => {
      const arr = pool.get(k);
      return arr && arr.length ? arr.shift() : this.newGem(k);
    }));
    // gemischte Steine dürfen kurz alle sichtbar «fliegen»
    for (const col of this.cols) for (const gm of col) if (Number.isNaN(gm.x)) { gm.x = this.W / 2; gm.y = this.g.trayY + this.g.trayH; }
    this.mixT = performance.now();
    this.kick();
  }

  setSlots(n) {
    const old = this.nSlots;
    this.finishAll();
    this.nSlots = n;
    this.layout();
    this.renderBg();
    this.renderPic();
    this.snapTray();
    const t = performance.now();
    for (let s = old; s < n; s++) this.slotFx[s] = t;
    this.kick();
  }

  /** Glanz-Welle über das fertige Bild. */
  startShine(cb) {
    this.finishAll();
    this.shine = { t0: performance.now() + 120, dur: 1250, cb };
    this.kick();
  }

  /** Alle laufenden Animationen sofort abschliessen (z.B. vor Grössenänderung). */
  finishAll() {
    if (!this.flyers) return;
    const events = [];
    for (const f of this.flyers) {
      if (!f.launched) events.push({ time: f.t0, f, kind: 0 });
      events.push({ time: f.t0 + f.dur, f, kind: 1 });
    }
    events.sort((a, b) => a.time - b.time || a.kind - b.kind);
    this.flyers = [];
    for (const ev of events) {
      if (ev.kind === 0) { ev.f.launched = true; if (ev.f.onLaunch) ev.f.onLaunch(); }
      else if (ev.f.onLand) ev.f.onLand(ev.time);
    }
    if (this.pic.width > 1) for (const p of this.pops) this.commitCell(p.cell);
    this.pops = [];
    this.parts = [];
    this.flashes = [];
  }

  // ------------------------------------------------------------------ Schleife

  frame(t) {
    this.raf = 0;
    if (this.destroyed || !this.g) return;
    const busy = this.update(t);
    this.draw(t);
    if (busy) this.kick();
    else {
      this.lastT = 0;
      const w = this.idleWaiters;
      this.idleWaiters = [];
      for (const cb of w) { try { cb(); } catch (e) { console.error(e); } }
    }
  }

  update(t) {
    const dt = this.lastT ? Math.min(64, t - this.lastT) : 16;
    this.lastT = t;
    let busy = false;

    // Flug-Ereignisse in zeitlicher Reihenfolge
    if (this.flyers.length) {
      const events = [];
      for (const f of this.flyers) {
        if (!f.launched && t >= f.t0) events.push({ time: f.t0, f, kind: 0 });
        if (t >= f.t0 + f.dur) events.push({ time: f.t0 + f.dur, f, kind: 1 });
      }
      if (events.length) {
        events.sort((a, b) => a.time - b.time || a.kind - b.kind);
        for (const ev of events) {
          if (ev.kind === 0) { ev.f.launched = true; if (ev.f.onLaunch) ev.f.onLaunch(); }
          else { ev.f.done = true; if (ev.f.onLand) ev.f.onLand(ev.time); }
        }
        this.flyers = this.flyers.filter((f) => !f.done);
      }
      busy = true;
    }

    if (this.pops.length) {
      const keep = [];
      for (const p of this.pops) {
        if (t - p.t0 >= POP_MS) this.commitCell(p.cell);
        else keep.push(p);
      }
      this.pops = keep;
      busy = true;
    }
    if (this.parts.length) { this.parts = this.parts.filter((p) => t - p.t0 < p.dur); busy = true; }
    if (this.flashes.length) { this.flashes = this.flashes.filter((f) => t - f.t0 < 520); busy = true; }
    for (let c = 0; c < this.shake.length; c++) if (t - this.shake[c] < 420 || t - this.press[c] < 220) busy = true;
    for (let s = 0; s < MAX_SLOTS; s++) if (t - this.slotFx[s] < 380) busy = true;

    // Vorrat: weiche Bewegung zu den Zielplätzen
    const k = 1 - Math.exp(-dt / (this.mixT && t - this.mixT < 900 ? 110 : 50));
    const ka = 1 - Math.exp(-dt / 70);
    const V = this.g.V;
    for (let c = 0; c < this.cols.length; c++) {
      const col = this.cols[c];
      for (let i = 0; i < col.length; i++) {
        const gm = col[i];
        const [tx, ty] = this.trayXY(c, i);
        const ta = i < V ? 1 : 0;
        if (Number.isNaN(gm.x)) { gm.x = tx; gm.y = ty + this.g.step; gm.a = 0; }
        if (i > V + 1) { gm.x = tx; gm.y = ty; gm.a = 0; continue; }
        const dx = tx - gm.x;
        const dy = ty - gm.y;
        const da = ta - gm.a;
        if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15 || Math.abs(da) > 0.01) {
          gm.x += dx * k;
          gm.y += dy * k;
          gm.a += da * ka;
          busy = true;
        } else { gm.x = tx; gm.y = ty; gm.a = ta; }
      }
    }

    // Zonen-Band gleitet mit
    const z = this.visZone();
    if (z) {
      const g = this.g;
      const L = this.L;
      const yTop = L.H - 1 - z.top;
      const yBot = L.H - 1 - z.low;
      const target = { y: g.oy + yTop * g.cs - 3, h: (yBot - yTop + 1) * g.cs + 6, a: 1 };
      if (!this.band) this.band = { ...target };
      const kb = 1 - Math.exp(-dt / 90);
      const b = this.band;
      if (Math.abs(target.y - b.y) > 0.2 || Math.abs(target.h - b.h) > 0.2) {
        b.y += (target.y - b.y) * kb;
        b.h += (target.h - b.h) * kb;
        busy = true;
      } else { b.y = target.y; b.h = target.h; }
    } else if (this.band) {
      this.band.a -= dt / 300;
      if (this.band.a <= 0) this.band = null;
      busy = true;
    }

    if (this.shine) {
      if (t - this.shine.t0 > this.shine.dur) {
        const cb = this.shine.cb;
        this.shine = null;
        if (cb) setTimeout(cb, 0);
      } else busy = true;
    }
    return busy;
  }

  // ------------------------------------------------------------------ Zeichnen

  draw(t) {
    const { ctx, dpr, W, H, g, L } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawBand(ctx);
    if (this.shine) this.drawShine(ctx, t);
    else ctx.drawImage(this.pic, g.ox, g.oy, g.cs * L.W, g.cs * L.H);
    this.drawZoneGhosts(ctx);
    this.drawPops(ctx, t);
    this.drawFlashes(ctx, t);
    this.drawSlots(ctx, t);
    this.drawTray(ctx, t);
    this.drawFlyers(ctx, t);
    this.drawParticles(ctx, t);
  }

  drawBand(ctx) {
    const b = this.band;
    if (!b) return;
    const g = this.g;
    ctx.save();
    ctx.globalAlpha = clamp(b.a, 0, 1);
    const x = g.ox - 5;
    const w = g.cs * this.L.W + 10;
    const r = Math.min(14, g.cs * 0.7);
    ctx.shadowColor = rgba(ACCENT, 0.35);
    ctx.shadowBlur = 12;
    roundRect(ctx, x, b.y, w, b.h, r);
    ctx.fillStyle = rgba(ACCENT, 0.10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(ACCENT, 0.38);
    ctx.stroke();
    ctx.restore();
  }

  drawZoneGhosts(ctx) {
    const z = this.visZone();
    if (!z || this.shine) return;
    const { g, L } = this;
    const cs = g.cs;
    for (const i of z.cells) {
      if (this.visFilled[i]) continue;
      const info = this.colorInfo[L.cells[i]];
      const [x, y] = this.cellXY(i);
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.27, 0, TAU);
      ctx.fillStyle = info.zoneFill;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.38, 0, TAU);
      ctx.lineWidth = Math.max(1, cs * 0.065);
      ctx.strokeStyle = info.zoneRing;
      ctx.stroke();
    }
  }

  drawPops(ctx, t) {
    const { g, L, dpr } = this;
    for (const p of this.pops) {
      const u = clamp((t - p.t0) / POP_MS, 0, 1);
      const s = lerp(0.55, 1, easeOutBack(u));
      const [x, y] = this.cellXY(p.cell);
      drawGem(ctx, L.colors[p.k], x, y, g.cs * 0.94 * s, dpr);
    }
  }

  drawFlashes(ctx, t) {
    if (!this.flashes.length) return;
    const { g, L } = this;
    ctx.save();
    for (const f of this.flashes) {
      const u = clamp((t - f.t0) / 520, 0, 1);
      const y = g.oy + (L.H - 1 - f.rb + 0.5) * g.cs;
      const x = g.ox + easeOut(u) * g.cs * L.W;
      const r = g.cs * 1.6;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - u)})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }

  drawSlots(ctx, t) {
    const { g, L, dpr } = this;
    let used = 0;
    for (let s = 0; s < this.nSlots; s++) {
      const [x, y] = this.slotXY(s);
      const fx = t - this.slotFx[s];
      const sl = this.slots[s];
      if (sl && sl.n > 0) {
        used++;
        const bump = fx < 380 ? 1 + 0.16 * Math.sin((fx / 380) * Math.PI) * (1 - fx / 380) : 1;
        drawGem(ctx, L.colors[sl.k], x, y, g.slotD * 0.84 * bump, dpr);
        if (sl.n > 1) {
          const label = String(sl.n);
          ctx.font = `800 11px ${FONT}`;
          const tw = ctx.measureText(label).width;
          const bw = Math.max(18, tw + 9);
          const bx = x + g.slotD * 0.34;
          const by = y - g.slotD * 0.34;
          ctx.save();
          ctx.shadowColor = 'rgba(30,60,120,0.25)';
          ctx.shadowBlur = 4;
          roundRect(ctx, bx - bw / 2, by - 9, bw, 18, 9);
          ctx.fillStyle = rgba(ACCENT, 1);
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bx, by + 0.5);
        }
      } else if (fx < 380) {
        // neuer Platz: weicher Ring
        const u = fx / 380;
        ctx.beginPath();
        ctx.arc(x, y, g.slotD / 2 + 2 + u * 8, 0, TAU);
        ctx.lineWidth = 2.5 * (1 - u);
        ctx.strokeStyle = rgba(ACCENT, 0.7 * (1 - u));
        ctx.stroke();
      }
    }
    // Ablage voll: zarter warmer Rand
    if (used >= this.nSlots && this.nSlots > 0) {
      roundRect(ctx, g.parkX + 1, g.parkY + 1, g.parkW - 2, g.parkH - 2, g.parkH / 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(245,165,36,0.55)';
      ctx.stroke();
    }
  }

  drawTray(ctx, t) {
    const { g, L, dpr } = this;
    const V = g.V;
    for (let c = 0; c < this.cols.length; c++) {
      const col = this.cols[c];
      const st = t - this.shake[c];
      const sx = st < 420 ? Math.sin(st / 420 * Math.PI * 5) * 6 * (1 - st / 420) : 0;
      const pt = t - this.press[c];
      if (pt < 220) {
        const x = this.colX(c) - g.colW / 2;
        roundRect(ctx, x, g.trayY + 5, g.colW, g.trayH - 10, Math.min(g.colW / 2, 18));
        ctx.fillStyle = rgba(ACCENT, 0.16 * (1 - pt / 220));
        ctx.fill();
      }
      if (!col.length) {
        // leere Spalte: kleines Häkchen
        const x = this.colX(c);
        const y = g.trayY + g.trayH / 2;
        const r = Math.min(13, g.colW * 0.24);
        ctx.save();
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(ACCENT, 0.32);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.75, y);
        ctx.lineTo(x - r * 0.2, y + r * 0.55);
        ctx.lineTo(x + r * 0.8, y - r * 0.5);
        ctx.stroke();
        ctx.restore();
      }
      const n = Math.min(col.length, V + 1);
      for (let i = n - 1; i >= 0; i--) {
        const gm = col[i];
        if (gm.a <= 0.02) continue;
        const depth = Math.min(i, V);
        const s = 1 - 0.03 * depth;
        drawGem(ctx, L.colors[gm.k], gm.x + sx, gm.y, g.gem * s, dpr, { alpha: gm.a });
        if (depth > 0) {
          ctx.beginPath();
          ctx.arc(gm.x + sx, gm.y, g.gem * s / 2, 0, TAU);
          ctx.fillStyle = `rgba(240,245,253,${Math.min(0.42, 0.075 * depth) * gm.a})`;
          ctx.fill();
        }
      }
      const hidden = col.length - V;
      if (hidden > 0) {
        const label = '+' + hidden;
        ctx.font = `800 11px ${FONT}`;
        const tw = ctx.measureText(label).width;
        const bw = tw + 12;
        const x = this.colX(c) + sx;
        const y = g.trayY + g.trayH - 14;
        roundRect(ctx, x - bw / 2, y - 8, bw, 16, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.fillStyle = '#6f7f9c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 0.5);
      }
    }
  }

  flyerPos(f, u) {
    const e = easeInOut(u);
    const a = 1 - e;
    return [
      a * a * f.x0 + 2 * a * e * f.cx + e * e * f.x1,
      a * a * f.y0 + 2 * a * e * f.cy + e * e * f.y1,
      lerp(f.s0, f.s1, e) * (1 + 0.2 * Math.sin(Math.PI * u)),
    ];
  }

  drawFlyers(ctx, t) {
    const { L, dpr } = this;
    for (const f of this.flyers) {
      const hex = L.colors[f.k];
      if (t < f.t0) {
        if (!f.pre) continue;
        drawGem(ctx, hex, f.x0, f.y0, f.s0 * 1.06, dpr, { alpha: Math.max(0.3, f.a0) });
        continue;
      }
      const u = clamp((t - f.t0) / f.dur, 0, 1);
      // zarter Schweif
      if (u > 0.08 && u < 0.92) {
        const [x, y, s] = this.flyerPos(f, u - 0.07);
        drawGem(ctx, hex, x, y, s * 0.72, dpr, { shadow: false, alpha: 0.2 });
      }
      const [x, y, s] = this.flyerPos(f, u);
      const alpha = f.a0 < 1 ? clamp(f.a0 + u * 3, 0, 1) : 1;
      drawGem(ctx, hex, x, y, s, dpr, { alpha });
    }
  }

  drawParticles(ctx, t) {
    if (!this.parts.length) return;
    ctx.save();
    for (const p of this.parts) {
      const u = clamp((t - p.t0) / p.dur, 0, 1);
      if (p.type === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, lerp(p.r0, p.r1, easeOut(u)), 0, TAU);
        ctx.lineWidth = Math.max(1, this.g.cs * 0.09) * (1 - u);
        ctx.strokeStyle = rgba(p.col, 0.7 * (1 - u));
        ctx.stroke();
      } else {
        const tt = (t - p.t0) / 1000;
        const x = p.x + p.vx * tt;
        const y = p.y + p.vy * tt + 0.5 * 900 * tt * tt * 0.4;
        const s = p.size * (1 - u * 0.6);
        ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - u)})`;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.6);
        ctx.quadraticCurveTo(x, y, x + s * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y + s * 1.6);
        ctx.quadraticCurveTo(x, y, x - s * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y - s * 1.6);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,214,90,${0.6 * (1 - u)})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawShine(ctx, t) {
    const { g, L, dpr } = this;
    const u = clamp((t - this.shine.t0) / this.shine.dur, 0, 1);
    const p = -0.25 + u * 1.5;
    const cs = g.cs;
    const d = cs * 0.94;
    const D = Math.max(4, Math.round(d * dpr));
    const sh = shadowSprite(D);
    const sw = sh.width * (d / D);
    const items = [];
    for (let i = 0; i < L.cells.length; i++) {
      if (L.cells[i] < 0) continue;
      const x = i % L.W;
      const y = Math.floor(i / L.W);
      const pos = (x / L.W + y / L.H) / 2;
      const dd = pos - p;
      const bump = Math.exp(-(dd * dd) / 0.006);
      items.push([i, bump]);
    }
    for (const [i] of items) {
      const [x, y] = this.cellXY(i);
      ctx.drawImage(sh, x - sw / 2, y - sw / 2 + d * 0.09, sw, sw);
    }
    for (const [i, bump] of items) {
      const [x, y] = this.cellXY(i);
      const s = 1 + 0.16 * bump;
      drawGem(ctx, L.colors[L.cells[i]], x, y, d * s, dpr, { shadow: false });
      if (bump > 0.05) {
        ctx.beginPath();
        ctx.arc(x, y, d * s / 2, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${0.55 * bump})`;
        ctx.fill();
      }
    }
  }
}
