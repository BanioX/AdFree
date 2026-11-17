// Darstellung des Spielfelds: Brett, Teile-Leiste, Ziehen mit Vorschau, Effekte.
// Zwei Canvas: das Brett-Canvas (in der Seite) und ein durchsichtiges Effekt-Canvas über allem
// (für das gezogene Teil, Funken, Punkte-Texte, fliegende Edelsteine).

import { blockSprite, gemSprite, coverSprite, boardBase, roundRect, rgba, drawSparkle, clearSpriteCache } from './sprites.js';
import { renderPicture, pictureById } from './picture.js';
import { gems as GEMS, GEM_KEYS } from '../data/skins.js';
import { ease } from '../../shared/ui.js';

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

export class BoardView {
  constructor(stage, skin) {
    this.stage = stage;
    this.skin = skin;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'board-canvas';
    stage.append(this.canvas);
    this.fx = document.createElement('canvas');
    this.fx.className = 'fx-canvas';
    document.body.append(this.fx);
    this.ctx = this.canvas.getContext('2d');
    this.fctx = this.fx.getContext('2d');
    this.game = null;
    this.L = null;
    this.landing = new Map();
    this.clearing = [];
    this.flashes = [];
    this.reveals = [];
    this.parts = [];
    this.texts = [];
    this.flyers = [];
    this.trayIn = [0, 0, 0];
    this.drag = null;
    this.returning = null;
    this.hint = null;
    this.shakeT0 = 0;
    this.shakeAmp = 0;
    this.grayT0 = 0;
    this.winT0 = 0;
    this.fxDirty = false;
    this.raf = 0;
    this.onGemArrive = null;
    this.gemTarget = null;
    this.frame = this.frame.bind(this);
    this.ro = new ResizeObserver(() => { this.layout(); this.requestDraw(); });
    this.ro.observe(stage);
    this.onWinResize = () => { this.layout(); this.requestDraw(); };
    window.addEventListener('resize', this.onWinResize);
  }

  destroy() {
    this.ro.disconnect();
    window.removeEventListener('resize', this.onWinResize);
    cancelAnimationFrame(this.raf);
    this.fx.remove();
    this.canvas.remove();
  }

  setGame(game) {
    this.game = game;
    this.landing.clear();
    this.clearing = [];
    this.flashes = [];
    this.reveals = [];
    this.grayT0 = 0;
    this.winT0 = 0;
    this.hint = null;
    this.drag = null;
    this.returning = null;
    this.pic = game.picMask && game.goals && game.goals.picture ? pictureById(game.goals.picture) : null;
    this.layout();
    const now = performance.now();
    this.trayIn = [now + 80, now + 150, now + 220];
    this.requestDraw();
  }

  setSkin(skin) {
    this.skin = skin;
    this.requestDraw();
  }

  // ---------- Layout ----------

  layout() {
    if (!this.game) return;
    const r = this.stage.getBoundingClientRect();
    const W = Math.max(200, r.width), H = Math.max(240, r.height);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const n = this.game.size;
    const cs = Math.floor(Math.min((W - 22) / (n + 0.36), (H - 30) / (n + 0.36 + 2.9), 64));
    const pad = Math.round(cs * 0.18);
    const B = n * cs + 2 * pad;
    const ts = Math.floor(Math.min(cs * 0.6, (W / 3 - 12) / 5) * 2) / 2;
    const trayH = Math.max(ts * 5 + 22, 96);
    const gap = Math.max(12, Math.min(30, (H - B - trayH) * 0.25));
    const top = Math.max(4, (H - B - gap - trayH) * 0.42);
    const bx = Math.round((W - B) / 2 + pad);
    const by = Math.round(top + pad);
    const trayY = top + B + gap;
    const slots = [0, 1, 2].map((i) => ({ x: (W / 3) * i, y: trayY, w: W / 3, h: trayH }));
    const changed = !this.L || this.L.cs !== cs || this.L.dpr !== dpr;
    this.L = { W, H, dpr, n, cs, pad, B, bx, by, ts, trayY, trayH, slots };
    if (changed) clearSpriteCache();
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    if (this.fx.width !== Math.round(vw * dpr) || this.fx.height !== Math.round(vh * dpr)) {
      this.fx.width = Math.round(vw * dpr);
      this.fx.height = Math.round(vh * dpr);
      this.fx.style.width = vw + 'px';
      this.fx.style.height = vh + 'px';
    }
    this.rect = this.canvas.getBoundingClientRect();
    this.picCanvas = this.pic ? renderPicture(this.pic, n * cs, dpr) : null;
  }

  /** Canvas-Koordinaten → Bildschirm-Koordinaten */
  toClient(x, y) {
    const r = this.rect || this.canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  }

  fromClient(x, y) {
    const r = this.rect = this.canvas.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  }

  cellCenter(i) {
    const { n, cs, bx, by } = this.L;
    const r = Math.floor(i / n), c = i % n;
    return { x: bx + c * cs + cs / 2, y: by + r * cs + cs / 2 };
  }

  trayPiecePos(slot, v) {
    const s = this.L.slots[slot];
    const ts = this.L.ts;
    return { x: s.x + (s.w - v.w * ts) / 2, y: s.y + (s.h - v.h * ts) / 2, ts };
  }

  /** Welches Fach liegt unter (x, y)? -1 = keines */
  slotAt(x, y) {
    const L = this.L;
    if (!L) return -1;
    if (y < L.trayY - 14 || y > L.trayY + L.trayH + 40) return -1;
    return Math.max(0, Math.min(2, Math.floor(x / (L.W / 3))));
  }

  // ---------- Ziehen ----------

  startDrag(slot, x, y, pointerType) {
    const v = this.game.tray[slot];
    if (!v) return false;
    const p = this.trayPiecePos(slot, v);
    const cs = this.L.cs;
    const lift = pointerType === 'mouse' ? -(v.h * cs) / 2 : Math.max(52, cs * 1.25);
    this.drag = { slot, v, x, y, lift, t0: performance.now(), from: { x: p.x, y: p.y, k: p.ts / cs }, snap: null, preview: null };
    this.hint = null;
    this.returning = null;
    this.updateDrag(x, y);
    return true;
  }

  /** Ziel-Position (oben links) des angehobenen Teils in Canvas-Koordinaten. */
  dragTarget(d = this.drag) {
    const cs = this.L.cs;
    return { x: d.x - (d.v.w * cs) / 2, y: d.y - d.v.h * cs - d.lift };
  }

  updateDrag(x, y) {
    const d = this.drag;
    if (!d) return;
    d.x = x;
    d.y = y;
    const t = this.dragTarget(d);
    const snap = this.computeSnap(d.v, t.x, t.y);
    const key = snap ? snap.r + ',' + snap.c : '';
    if (key !== d.snapKey) {
      d.snapKey = key;
      d.snap = snap;
      d.preview = null;
      if (snap) {
        const fl = this.game.board.previewLines(d.v, snap.r, snap.c);
        if (fl.rows.length || fl.cols.length) {
          const n = this.L.n;
          const set = new Set();
          for (const r of fl.rows) for (let c = 0; c < n; c++) set.add(r * n + c);
          for (const c of fl.cols) for (let r = 0; r < n; r++) set.add(r * n + c);
          d.preview = set;
        }
      }
      d.changed = true;
    }
    this.requestDraw();
  }

  computeSnap(v, tx, ty) {
    const { cs, bx, by, n } = this.L;
    const fr = (ty - by) / cs, fc = (tx - bx) / cs;
    let best = null, bestD = 0.8;
    const r0 = Math.floor(fr), c0 = Math.floor(fc);
    for (let r = r0 - 1; r <= r0 + 2; r++) {
      for (let c = c0 - 1; c <= c0 + 2; c++) {
        if (r < 0 || c < 0 || r + v.h > n || c + v.w > n) continue;
        const dd = Math.hypot(r - fr, c - fc);
        if (dd < bestD && this.game.board.canPlace(v, r, c)) { bestD = dd; best = { r, c }; }
      }
    }
    return best;
  }

  /** Teil fliegt zurück in die Leiste. */
  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    const t = this.dragTarget(d);
    const k = clamp01((performance.now() - d.t0) / 110);
    const e = ease.outCubic(k);
    this.returning = {
      slot: d.slot, v: d.v, t0: performance.now(),
      from: { x: lerp(d.from.x, t.x, e), y: lerp(d.from.y, t.y, e), k: lerp(d.from.k, 1, e) },
    };
    this.drag = null;
    this.requestDraw();
  }

  endDrag() { this.drag = null; this.requestDraw(); }

  showHint(m) {
    if (!m) { this.hint = null; return; }
    this.hint = { ...m, v: this.game.tray[m.slot], t0: performance.now() };
    this.requestDraw();
  }

  // ---------- Ereignisse aus dem Spiel ----------

  /** Nach einem Zug: Lande-, Abräum- und Punkte-Effekte starten. */
  onPlaced(res, opts = {}) {
    const now = performance.now();
    const L = this.L;
    const n = L.n;
    for (const i of res.placed) this.landing.set(i, now);
    let cx = 0, cy = 0;
    for (const i of res.placed) { const p = this.cellCenter(i); cx += p.x; cy += p.y; }
    cx /= res.placed.length;
    cy /= res.placed.length;

    if (res.lines) {
      for (const r of res.rows) this.flashes.push({ row: r, t0: now });
      for (const c of res.cols) this.flashes.push({ col: c, t0: now });
      for (const cl of res.cleared) {
        const p = this.cellCenter(cl.i);
        const dist = Math.hypot(p.x - cx, p.y - cy) / L.cs;
        const t0 = now + 50 + Math.min(300, dist * 34);
        this.clearing.push({ ...cl, t0, emitted: false });
        if (cl.cover) this.reveals.push({ i: cl.i, t0: t0 + 60 });
      }
      const amp = res.lines >= 2 ? Math.min(11, 3 + res.lines * 2) : 2.2;
      this.shake(amp);
      const total = res.points.total;
      const lc = this.toClient(cx, cy - L.cs * 0.4);
      this.texts.push({ kind: 'score', text: '+' + total.toLocaleString('de-CH'), x: lc.x, y: lc.y, t0: now + 120, dur: 1000 });
      if (opts.praise) {
        const bc = this.toClient(L.bx + (n * L.cs) / 2, L.by + (n * L.cs) * 0.42);
        this.texts.push({ kind: 'praise', text: opts.praise, x: bc.x, y: bc.y, t0: now + 160, dur: 1250, sub: opts.sub || null });
      } else if (opts.sub) {
        const bc = this.toClient(L.bx + (n * L.cs) / 2, L.by + (n * L.cs) * 0.42);
        this.texts.push({ kind: 'sub', text: opts.sub, x: bc.x, y: bc.y, t0: now + 160, dur: 1000 });
      }
    }
    if (res.refill) {
      const base = now + (res.lines ? 320 : 120);
      this.trayIn = [base, base + 70, base + 140];
    }
    this.requestDraw();
  }

  shake(amp) {
    this.shakeT0 = performance.now();
    this.shakeAmp = amp;
    this.requestDraw();
  }

  newTray() {
    const now = performance.now();
    this.trayIn = [now, now + 70, now + 140];
    this.requestDraw();
  }

  startGameOver() { this.grayT0 = performance.now(); this.requestDraw(); }
  stopGameOver() { this.grayT0 = 0; this.requestDraw(); }

  /** Sieg: alle Steine platzen nacheinander weg (Bild wird ganz sichtbar). */
  startWin(instant = false) {
    const now = performance.now();
    this.winT0 = instant ? now - 5000 : now;
    const b = this.game.board;
    const L = this.L;
    const mid = (L.n - 1) / 2;
    if (!instant) {
      for (let i = 0; i < b.cells.length; i++) {
        if (!b.cells[i]) continue;
        const r = Math.floor(i / L.n), c = i % L.n;
        const t0 = now + 80 + Math.hypot(r - mid, c - mid) * 70;
        this.clearing.push({ i, color: b.cells[i] - 1, gem: b.gems[i], cover: 0, t0, emitted: false });
      }
      if (this.game.picMask) {
        for (let i = 0; i < b.cover.length; i++) {
          if (b.cover[i]) {
            const r = Math.floor(i / L.n), c = i % L.n;
            this.reveals.push({ i, t0: now + 80 + Math.hypot(r - mid, c - mid) * 70 });
          }
        }
      }
    }
    this.requestDraw();
  }

  // ---------- Zeichnen ----------

  requestDraw() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    if (!this.game || !this.L) return;
    const busy1 = this.drawBoard(now);
    const busy2 = this.drawFx(now);
    if (busy1 || busy2) this.requestDraw();
  }

  drawBoard(now) {
    const { ctx, L, game, skin } = this;
    const { dpr, n, cs, pad, bx, by, B } = L;
    const b = game.board;
    let busy = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);

    // Mikro-Schütteln
    let sx = 0, sy = 0;
    if (this.shakeT0) {
      const t = (now - this.shakeT0) / 320;
      if (t >= 1) this.shakeT0 = 0;
      else {
        const a = this.shakeAmp * (1 - t) * (1 - t);
        sx = Math.sin(t * 47) * a;
        sy = Math.cos(t * 39) * a * 0.6;
        busy = true;
      }
    }
    ctx.save();
    ctx.translate(sx, sy);

    // Brett
    const base = boardBase(skin, n, cs, pad, dpr);
    ctx.drawImage(base, bx - pad, by - pad, B, B);

    const winning = this.winT0 > 0;
    // Bild unter aufgedeckten Feldern
    if (this.pic && this.picCanvas) {
      const pm = game.picMask;
      const pc = this.picCanvas;
      const k = pc.width / (n * cs);
      ctx.save();
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n * n; i++) {
        if (pm[i] !== 'x') continue;
        if (b.cover[i] && !winning) continue;
        const r = Math.floor(i / n), c = i % n;
        ctx.rect(bx + c * cs, by + r * cs, cs, cs);
        any = true;
      }
      if (any) {
        ctx.clip();
        ctx.drawImage(pc, 0, 0, pc.width, pc.height, bx, by, n * cs, n * cs);
        // feine Linien, damit das Raster sichtbar bleibt
        if (!winning || now - this.winT0 < 1600) {
          ctx.globalAlpha = winning ? clamp01(1 - (now - this.winT0 - 900) / 700) * 0.18 : 0.18;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 1; i < n; i++) {
            ctx.moveTo(bx + i * cs, by); ctx.lineTo(bx + i * cs, by + n * cs);
            ctx.moveTo(bx, by + i * cs); ctx.lineTo(bx + n * cs, by + i * cs);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (winning) busy = true;
        }
      }
      ctx.restore();
    }

    // Verdeckte Felder
    const cover = coverSprite(skin, cs, dpr);
    for (let i = 0; i < n * n; i++) {
      if (!b.cover[i] || b.cells[i] || winning) continue;
      const r = Math.floor(i / n), c = i % n;
      ctx.drawImage(cover, bx + c * cs, by + r * cs, cs, cs);
    }
    // Aufdecken-Animation
    this.reveals = this.reveals.filter((rv) => {
      const t = (now - rv.t0) / 420;
      if (t >= 1) return false;
      busy = true;
      const r = Math.floor(rv.i / n), c = rv.i % n;
      const x = bx + c * cs + cs / 2, y = by + r * cs + cs / 2;
      if (t < 0) { ctx.drawImage(cover, x - cs / 2, y - cs / 2, cs, cs); return true; }
      const s = 1 - ease.inOutCubic(t) * 0.7;
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(cover, x - (cs * s) / 2, y - (cs * s) / 2, cs * s, cs * s);
      ctx.globalAlpha = 1;
      return true;
    });

    // Steine
    const drag = this.drag;
    const preview = drag && drag.preview;
    const pulse = 0.5 + 0.5 * Math.sin(now / 110);
    for (let i = 0; i < n * n; i++) {
      const v = b.cells[i];
      if (!v) continue;
      const r = Math.floor(i / n), c = i % n;
      let x = bx + c * cs, y = by + r * cs;
      if (winning) {
        // Steine verschwinden über die Abräum-Animation
        continue;
      }
      let color = v - 1;
      if (this.grayT0) {
        const tg = now - this.grayT0 - (n - 1 - r) * 55;
        if (tg > 0) color = 'gray';
        if (tg < 300) busy = true;
      }
      if (preview && preview.has(i)) color = drag.v.color;
      let s = 1;
      const lt = this.landing.get(i);
      if (lt != null) {
        const t = (now - lt) / 220;
        if (t >= 1) this.landing.delete(i);
        else { s = 1 + 0.16 * (1 - ease.outCubic(t)); busy = true; }
      }
      const spr = blockSprite(skin, color, cs, dpr);
      if (s !== 1) ctx.drawImage(spr, x + cs / 2 - (cs * s) / 2, y + cs / 2 - (cs * s) / 2, cs * s, cs * s);
      else ctx.drawImage(spr, x, y, cs, cs);
      if (b.gems[i]) ctx.drawImage(gemSprite(GEM_KEYS[b.gems[i] - 1], cs, dpr), x, y, cs, cs);
      if (preview && preview.has(i)) {
        ctx.globalAlpha = 0.18 + 0.22 * pulse;
        ctx.drawImage(blockSprite(skin, 'white', cs, dpr), x, y, cs, cs);
        ctx.globalAlpha = 1;
      }
      if (lt != null && s !== 1) {
        ctx.globalAlpha = 0.45 * (s - 1) / 0.16;
        ctx.drawImage(blockSprite(skin, 'white', cs, dpr), x, y, cs, cs);
        ctx.globalAlpha = 1;
      }
    }
    if (preview) busy = true;

    // Vorschau (Geist)
    if (drag && drag.snap) {
      const { r, c } = drag.snap;
      const spr = blockSprite(skin, drag.v.color, cs, dpr);
      ctx.globalAlpha = preview ? 0.75 : 0.42;
      for (const [dr, dc] of drag.v.cells) ctx.drawImage(spr, bx + (c + dc) * cs, by + (r + dr) * cs, cs, cs);
      ctx.globalAlpha = 1;
    }

    // Tipp
    if (this.hint && this.hint.v && !drag) {
      const t = (now - this.hint.t0) / 1000;
      if (t > 3.2 || !game.tray[this.hint.slot]) this.hint = null;
      else {
        busy = true;
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.4));
        const spr = blockSprite(skin, this.hint.v.color, cs, dpr);
        ctx.globalAlpha = a;
        for (const [dr, dc] of this.hint.v.cells) ctx.drawImage(spr, bx + (this.hint.c + dc) * cs, by + (this.hint.r + dr) * cs, cs, cs);
        ctx.globalAlpha = 1;
      }
    }

    // Linien-Blitz
    this.flashes = this.flashes.filter((f) => {
      const t = (now - f.t0) / 460;
      if (t >= 1) return false;
      busy = true;
      const grow = cs * 0.25 * ease.outCubic(t);
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - t) * (1 - t);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = cs * 0.6;
      if (f.row != null) roundRect(ctx, bx - grow, by + f.row * cs + cs * 0.06 - grow / 2, n * cs + 2 * grow, cs * 0.88 + grow, cs * 0.3);
      else roundRect(ctx, bx + f.col * cs + cs * 0.06 - grow / 2, by - grow, cs * 0.88 + grow, n * cs + 2 * grow, cs * 0.3);
      ctx.fill();
      ctx.restore();
      return true;
    });

    // Abräumen: Steine poppen
    this.clearing = this.clearing.filter((cl) => {
      const t = (now - cl.t0) / 380;
      if (t >= 1) return false;
      busy = true;
      const r = Math.floor(cl.i / n), c = cl.i % n;
      const x = bx + c * cs + cs / 2, y = by + r * cs + cs / 2;
      if (t < 0) {
        const spr = blockSprite(skin, cl.color, cs, dpr);
        ctx.drawImage(spr, x - cs / 2, y - cs / 2, cs, cs);
        if (cl.gem) ctx.drawImage(gemSprite(GEM_KEYS[cl.gem - 1], cs, dpr), x - cs / 2, y - cs / 2, cs, cs);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(blockSprite(skin, 'white', cs, dpr), x - cs / 2, y - cs / 2, cs, cs);
        ctx.globalAlpha = 1;
        return true;
      }
      if (!cl.emitted) { cl.emitted = true; this.burst(cl); }
      const s = t < 0.25 ? 1 + 0.22 * ease.outCubic(t / 0.25) : 1.22 * (1 - ease.inOutCubic((t - 0.25) / 0.75));
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.drawImage(blockSprite(skin, cl.color, cs, dpr), x - (cs * s) / 2, y - (cs * s) / 2, cs * s, cs * s);
      ctx.globalAlpha = clamp01(0.7 - t);
      ctx.drawImage(blockSprite(skin, 'white', cs, dpr), x - (cs * s) / 2, y - (cs * s) / 2, cs * s, cs * s);
      ctx.globalAlpha = 1;
      return true;
    });
    ctx.restore();

    // Teile-Leiste
    busy = this.drawTray(now) || busy;
    return busy;
  }

  drawTray(now) {
    const { ctx, L, game, skin } = this;
    const { dpr, ts } = L;
    let busy = false;
    const fit = game.fitMap();
    // weiche Fläche hinter der Leiste
    const tp = 8;
    roundRect(ctx, tp, L.trayY + 2, L.W - tp * 2, L.trayH - 4, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,120,80,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const v = game.tray[k];
      if (!v) continue;
      if (this.drag && this.drag.slot === k) continue;
      if (this.returning && this.returning.slot === k) continue;
      const p = this.trayPiecePos(k, v);
      const t = (now - this.trayIn[k]) / 360;
      if (t < 1) busy = true;
      if (t < 0) continue;
      const e = ease.outBack(clamp01(t));
      const s = lerp(0.4, 1, e);
      const ox = (1 - clamp01(t * 1.4)) * 50;
      const pw = v.w * ts, ph = v.h * ts;
      const cx = p.x + pw / 2 + ox, cy = p.y + ph / 2;
      const color = fit[k] ? v.color : 'gray';
      // Tipp: leuchtender Hof
      if (this.hint && this.hint.slot === k && !this.drag) {
        const a = 0.3 + 0.25 * Math.sin(now / 160);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(pw, ph) * 0.9);
        g.addColorStop(0, `rgba(255,236,150,${a})`);
        g.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - Math.max(pw, ph), cy - Math.max(pw, ph), Math.max(pw, ph) * 2, Math.max(pw, ph) * 2);
        busy = true;
      }
      const spr = blockSprite(skin, color, ts, dpr);
      ctx.globalAlpha = clamp01(t * 2.5) * (fit[k] ? 1 : 0.55);
      for (const [dr, dc] of v.cells) {
        const x = cx + (p.x + dc * ts - (p.x + pw / 2)) * s;
        const y = cy + (p.y + dr * ts - (p.y + ph / 2)) * s;
        ctx.drawImage(spr, x, y, ts * s, ts * s);
      }
      ctx.globalAlpha = 1;
    }
    return busy;
  }

  drawPiece(ctx, v, x, y, cs, color, alpha = 1, shadow = false) {
    const spr = blockSprite(this.skin, color, cs, this.L.dpr);
    if (shadow) {
      ctx.fillStyle = 'rgba(50,30,10,0.18)';
      for (const [dr, dc] of v.cells) {
        roundRect(ctx, x + dc * cs + cs * 0.12, y + dr * cs + cs * 0.3, cs * 0.9, cs * 0.9, cs * 0.18);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
    for (const [dr, dc] of v.cells) ctx.drawImage(spr, x + dc * cs, y + dr * cs, cs, cs);
    ctx.globalAlpha = 1;
  }

  drawFx(now) {
    const { fctx: ctx, L } = this;
    const dpr = L.dpr;
    const active = this.drag || this.returning || this.parts.length || this.texts.length || this.flyers.length;
    if (!active && !this.fxDirty) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.fx.width / dpr, this.fx.height / dpr);
    this.fxDirty = !!active;
    if (!active) return false;
    const r = this.rect || this.canvas.getBoundingClientRect();
    const cs = L.cs;

    // gezogenes Teil
    if (this.drag) {
      const d = this.drag;
      const t = this.dragTarget(d);
      const k = ease.outCubic(clamp01((now - d.t0) / 110));
      const x = lerp(d.from.x, t.x, k), y = lerp(d.from.y, t.y, k);
      const sc = lerp(d.from.k, 1, k);
      const size = cs * sc;
      // relativ zur Mitte skalieren
      this.drawPiece(ctx, d.v, r.left + x, r.top + y, size, d.v.color, 1, true);
    }
    if (this.returning) {
      const rt = this.returning;
      const t = clamp01((now - rt.t0) / 200);
      const p = this.trayPiecePos(rt.slot, rt.v);
      const e = ease.outCubic(t);
      const x = lerp(rt.from.x, p.x, e), y = lerp(rt.from.y, p.y, e);
      const k = lerp(rt.from.k, L.ts / cs, e);
      this.drawPiece(ctx, rt.v, r.left + x, r.top + y, cs * k, rt.v.color);
      if (t >= 1) this.returning = null;
    }

    // Partikel
    const dt = 1 / 60;
    this.parts = this.parts.filter((p) => {
      const age = (now - p.t0) / 1000;
      if (age < 0) return true;
      if (age > p.life) return false;
      const a = 1 - age / p.life;
      const x = p.x + p.vx * age, y = p.y + p.vy * age + 0.5 * p.g * age * age;
      if (p.kind === 'shard') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.vr * age);
        ctx.fillStyle = p.color;
        const s = p.size * (0.6 + 0.4 * a);
        roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.25);
        ctx.fill();
        ctx.restore();
      } else {
        const tw = 0.6 + 0.4 * Math.sin(age * 30 + p.rot);
        drawSparkle(ctx, x, y, p.size * tw * (0.5 + 0.5 * a), p.color, a);
      }
      return true;
    });
    void dt;

    // fliegende Edelsteine
    this.flyers = this.flyers.filter((f) => {
      const t = (now - f.t0) / f.dur;
      if (t < 0) return true;
      if (t >= 1) {
        if (this.onGemArrive) this.onGemArrive(f.key);
        return false;
      }
      const e = ease.inOutCubic(t);
      const mx = (f.x0 + f.x1) / 2 + (f.x0 < f.x1 ? -40 : 40), my = Math.min(f.y0, f.y1) - 80;
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * mx + e * e * f.x1;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * my + e * e * f.y1;
      const s = f.size * lerp(1.15, 0.7, e);
      ctx.drawImage(gemSprite(f.key, f.size, dpr), x - s / 2, y - s / 2, s, s);
      if (Math.random() < 0.5) this.parts.push({ kind: 'spark', x, y, vx: 0, vy: 20, g: 0, life: 0.4, t0: now, size: 5, color: '#fff6c8', rot: Math.random() * 6 });
      return true;
    });

    // Texte
    this.texts = this.texts.filter((tx) => {
      const t = (now - tx.t0) / tx.dur;
      if (t < 0) return true;
      if (t >= 1) return false;
      this.drawText(ctx, tx, t);
      return true;
    });
    return true;
  }

  drawText(ctx, tx, t) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (tx.kind === 'praise' || tx.kind === 'sub') {
      const big = tx.kind === 'praise';
      const inT = clamp01(t / 0.22);
      const s = ease.outBack(inT);
      const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      const y = tx.y - (t > 0.72 ? (t - 0.72) * 90 : 0);
      ctx.globalAlpha = fade;
      ctx.translate(tx.x, y);
      ctx.scale(s, s);
      const size = big ? Math.min(46, this.L.cs * 1.05) : 30;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = 'rgba(80,40,10,0.85)';
      ctx.strokeText(tx.text, 0, 0);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#fff7c2');
      g.addColorStop(0.5, '#ffd23f');
      g.addColorStop(1, '#ff9a1f');
      ctx.fillStyle = g;
      ctx.fillText(tx.text, 0, 0);
      if (big && tx.sub) {
        ctx.font = `800 ${Math.round(size * 0.48)}px ${FONT}`;
        ctx.lineWidth = size * 0.14;
        ctx.strokeStyle = 'rgba(80,40,10,0.8)';
        ctx.strokeText(tx.sub, 0, size * 0.85);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tx.sub, 0, size * 0.85);
      }
    } else {
      const small = tx.kind === 'small';
      const size = small ? 17 : 26;
      const rise = (small ? 26 : 50) * ease.outCubic(t);
      ctx.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const s = small ? 1 : 0.7 + 0.3 * ease.outBack(clamp01(t / 0.2));
      ctx.translate(tx.x, tx.y - rise);
      ctx.scale(s, s);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.lineWidth = size * 0.24;
      ctx.strokeStyle = 'rgba(60,35,15,0.75)';
      ctx.strokeText(tx.text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tx.text, 0, 0);
    }
    ctx.restore();
  }

  /** Funken und Splitter, wenn ein Stein platzt. */
  burst(cl) {
    const now = performance.now();
    const p = this.cellCenter(cl.i);
    const c = this.toClient(p.x, p.y);
    const color = typeof cl.color === 'number' && cl.color >= 0 ? this.skin.colors[cl.color] : this.skin.gray;
    const cs = this.L.cs;
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 200;
      this.parts.push({
        kind: 'shard', x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 900,
        life: 0.55 + Math.random() * 0.35, t0: now, size: cs * (0.14 + Math.random() * 0.12), color,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
    if (Math.random() < 0.7) {
      this.parts.push({
        kind: 'spark', x: c.x + (Math.random() - 0.5) * cs * 0.6, y: c.y + (Math.random() - 0.5) * cs * 0.6,
        vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 60, g: 0, life: 0.5 + Math.random() * 0.4, t0: now,
        size: cs * (0.16 + Math.random() * 0.14), color: Math.random() < 0.5 ? '#ffffff' : '#fff1a8', rot: Math.random() * 6,
      });
    }
    if (cl.gem && this.gemTarget) {
      const key = GEM_KEYS[cl.gem - 1];
      const tgt = this.gemTarget(key);
      if (tgt) this.flyers.push({ key, x0: c.x, y0: c.y, x1: tgt.x, y1: tgt.y, t0: now, dur: 700, size: cs * 0.95 });
    }
    if (cl.gem) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        this.parts.push({ kind: 'spark', x: c.x, y: c.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, g: 0, life: 0.5, t0: now, size: cs * 0.18, color: GEMS[GEM_KEYS[cl.gem - 1]].light, rot: k });
      }
    }
    this.requestDraw();
  }

  /** Funkeln über dem ganzen Brett (z.B. bei Sieg). */
  sparkleBoard(count = 26) {
    const now = performance.now();
    const L = this.L;
    for (let k = 0; k < count; k++) {
      const c = this.toClient(L.bx + Math.random() * L.n * L.cs, L.by + Math.random() * L.n * L.cs);
      this.parts.push({ kind: 'spark', x: c.x, y: c.y, vx: 0, vy: -30, g: 0, life: 0.7 + Math.random() * 0.6, t0: now + Math.random() * 700, size: L.cs * (0.15 + Math.random() * 0.2), color: Math.random() < 0.5 ? '#ffffff' : '#ffe98a', rot: Math.random() * 6 });
    }
    this.requestDraw();
  }
}
