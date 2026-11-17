// Juwelen – Spielfeld-Ansicht: Canvas-Zeichnung, Animation der Engine-Ereignisse, Eingabe.
//
//   const view = new BoardView(wrapEl, { theme, onSwap(a, b), onTap(i), getHint(), onHud(hud) });
//   view.setGame(game);              // Zustand übernehmen (ohne Animation)
//   await view.play(events);         // Ereignisse aus game.swap()/hammer()/… abspielen
//
// Die Engine liefert den Endzustand sofort; die Ansicht spielt die Ereignisse nur nach
// und gleicht sich am Ende mit dem Spielzustand ab (robust gegen Abweichungen).

import { SP } from './engine.js';
import { makeSprites, drawIce, gemMain, GEM_COLORS } from './sprites.js';
import { sfx } from '../shared/sfx.js';
import { praise, specialWords } from './data/texts.js';

const U = 105;                     // ms pro Verzögerungs-Einheit der Engine
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const E = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  inQ: (t) => t * t,
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  elastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
const RAINBOW = GEM_COLORS.map((c) => c[1]);

export class BoardView {
  constructor(wrap, opts = {}) {
    this.wrap = wrap;
    this.opts = opts;
    this.theme = opts.theme || { cells: ['#fffaf3', '#f6ecdf'] };
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'm3-canvas';
    this.ctx = this.canvas.getContext('2d');
    wrap.append(this.canvas);
    this.sprites = new Map();
    this.tweens = [];
    this.particles = [];
    this.effects = [];
    this.texts = [];
    this.busy = false;
    this.sel = -1;
    this.hint = null;
    this.mode = 'swap';
    this.raf = 0;
    this.frame = this.frame.bind(this);
    this.drag = null;
    this.idleMs = opts.idleMs || 5500;
    this._bindInput();
    this.ro = new ResizeObserver(() => { this.layout(); this.draw(); });
    this.ro.observe(wrap);
  }

  destroy() {
    this.dead = true;
    this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.idleT);
    for (const tw of this.tweens) tw.res();
    this.tweens = [];
    this.canvas.remove();
    if (this.coachEl) this.coachEl.remove();
  }

  // ---------- Aufbau ----------

  setGame(game) {
    this.game = game;
    this.w = game.w; this.h = game.h;
    this.hasItems = game.itemsTotal > 0;
    this.layout();
    this.syncAll();
    this.armIdle();
    this.draw();
  }

  rc(i) { return [(i / this.w) | 0, i % this.w]; }

  layout() {
    if (!this.game) return;
    const W = Math.max(1, this.wrap.clientWidth), H = Math.max(1, this.wrap.clientHeight);
    const extraB = this.hasItems ? 0.32 : 0.12;
    const cs = Math.max(16, Math.min(66, Math.floor(Math.min((W - 8) / (this.w + 0.24), (H - 8) / (this.h + 0.12 + extraB)))));
    this.cs = cs;
    this.W = W; this.H = H;
    this.ox = Math.round((W - cs * this.w) / 2);
    this.oy = Math.round((H - cs * (this.h + extraB - 0.12)) / 2);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.atlas = makeSprites(cs * dpr);
    this.iceSprites = [null, this._iceSprite(1), this._iceSprite(2)];
    this._renderBg();
    if (this.coach) this._placeCoach();
  }

  _iceSprite(layers) {
    const s = Math.round(this.cs * this.dpr);
    const c = document.createElement('canvas');
    c.width = c.height = s;
    drawIce(c.getContext('2d'), 0, 0, s, layers);
    return c;
  }

  _renderBg() {
    const { cs, ox, oy, dpr, game } = this;
    const mk = () => { const c = document.createElement('canvas'); c.width = this.canvas.width; c.height = this.canvas.height; const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; };
    const [shape, sx] = mk();
    const pad = cs * 0.13;
    sx.fillStyle = 'rgba(255,255,255,.78)';
    for (let i = 0; i < game.size; i++) {
      if (!game.mask[i]) continue;
      const [r, c] = this.rc(i);
      sx.beginPath();
      sx.roundRect(ox + c * cs - pad, oy + r * cs - pad, cs + 2 * pad, cs + 2 * pad, cs * 0.3);
      sx.fill();
    }
    // Löcher ausschneiden, damit sie klar als Lücken erkennbar sind
    sx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < game.size; i++) {
      if (game.mask[i]) continue;
      const [r, c] = this.rc(i);
      sx.beginPath();
      sx.roundRect(ox + c * cs + 2, oy + r * cs + 2, cs - 4, cs - 4, cs * 0.22);
      sx.fill();
    }
    sx.globalCompositeOperation = 'source-over';
    const [bg, bx] = mk();
    bx.save();
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.shadowColor = 'rgba(90,50,30,.22)';
    bx.shadowBlur = 14 * dpr;
    bx.shadowOffsetY = 5 * dpr;
    bx.drawImage(shape, 0, 0);
    bx.restore();
    const cols = this.theme.cells;
    for (let i = 0; i < game.size; i++) {
      if (!game.mask[i]) continue;
      const [r, c] = this.rc(i);
      bx.beginPath();
      bx.roundRect(ox + c * cs + 1.5, oy + r * cs + 1.5, cs - 3, cs - 3, cs * 0.2);
      bx.fillStyle = cols[(r + c) % 2];
      bx.fill();
    }
    // Löcher im Inneren des Bretts: als gewollte Lücke zeigen (Mulde, gestrichelter Rand, Welt-Symbol)
    const deco = (this.theme.deco && this.theme.deco[0]) || '✿';
    for (const i of this._innerHoles()) {
      const [r, c] = this.rc(i);
      const x = ox + c * cs, y = oy + r * cs;
      bx.save();
      bx.beginPath();
      bx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * 0.22);
      bx.fillStyle = 'rgba(70,40,25,.13)';
      bx.fill();
      bx.beginPath();
      bx.roundRect(x + cs * 0.15, y + cs * 0.15, cs * 0.7, cs * 0.7, cs * 0.2);
      bx.setLineDash([cs * 0.08, cs * 0.07]);
      bx.lineWidth = Math.max(1.5, cs * 0.045);
      bx.strokeStyle = 'rgba(255,255,255,.8)';
      bx.stroke();
      bx.globalAlpha = 0.6;
      bx.font = `${Math.round(cs * 0.34)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      bx.textAlign = 'center';
      bx.textBaseline = 'middle';
      bx.fillText(deco, x + cs / 2, y + cs / 2 + cs * 0.03);
      bx.restore();
    }
    // Ausgänge für Eicheln
    if (this.hasItems) {
      for (let c = 0; c < this.w; c++) {
        const r = game.exitRow[c];
        if (r < 0) continue;
        const x = ox + c * cs + cs / 2, y = oy + (r + 1) * cs + pad * 0.3;
        bx.beginPath();
        bx.roundRect(x - cs * 0.24, y - 2, cs * 0.48, cs * 0.24, cs * 0.08);
        bx.fillStyle = '#d99a52';
        bx.fill();
        bx.lineWidth = 1.5; bx.strokeStyle = '#7a4a1c'; bx.stroke();
        bx.beginPath();
        bx.moveTo(x - cs * 0.09, y + cs * 0.035); bx.lineTo(x, y + cs * 0.12); bx.lineTo(x + cs * 0.09, y + cs * 0.035);
        bx.lineWidth = 2; bx.strokeStyle = '#fff'; bx.lineCap = 'round'; bx.lineJoin = 'round'; bx.stroke();
      }
    }
    this.bg = bg;
  }

  /** Löcher, die ganz vom Brett umschlossen sind (nicht über andere Löcher mit dem Rand verbunden). */
  _innerHoles() {
    const { game, w } = this;
    const h = game.size / w;
    const outside = new Uint8Array(game.size);
    const stack = [];
    for (let i = 0; i < game.size; i++) {
      const r = (i / w) | 0, c = i % w;
      if (!game.mask[i] && (r === 0 || c === 0 || r === h - 1 || c === w - 1)) { outside[i] = 1; stack.push(i); }
    }
    while (stack.length) {
      const i = stack.pop();
      const r = (i / w) | 0, c = i % w;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
        const j = rr * w + cc;
        if (!game.mask[j] && !outside[j]) { outside[j] = 1; stack.push(j); }
      }
    }
    const out = [];
    for (let i = 0; i < game.size; i++) if (!game.mask[i] && !outside[i]) out.push(i);
    return out;
  }

  _newSprite(p, i, extra = {}) {
    const [r, c] = typeof i === 'number' ? this.rc(i) : i;
    const s = { id: p.id, t: p.t, col: p.c, sp: p.sp, hp: p.hp, x: c, y: r, sx: 1, sy: 1, a: 1, rot: 0, oy: 0, z: 0, ...extra };
    this.sprites.set(p.id, s);
    return s;
  }

  /** Ansicht exakt an den Spielzustand angleichen. */
  syncAll() {
    const g = this.game;
    const seen = new Set();
    for (let i = 0; i < g.size; i++) {
      const p = g.cells[i];
      if (!p) continue;
      seen.add(p.id);
      let s = this.sprites.get(p.id);
      if (!s) s = this._newSprite(p, i);
      const [r, c] = this.rc(i);
      Object.assign(s, { t: p.t, col: p.c, sp: p.sp, hp: p.hp, x: c, y: r, sx: 1, sy: 1, a: 1, rot: 0, oy: 0, z: 0 });
    }
    for (const id of [...this.sprites.keys()]) if (!seen.has(id)) this.sprites.delete(id);
    this.ice = Array.from(g.ice);
  }

  spriteAt(i) {
    const [r, c] = this.rc(i);
    for (const s of this.sprites.values()) if (Math.round(s.x) === c && Math.round(s.y) === r && !s.dying) return s;
    return null;
  }

  // ---------- Animation ----------

  tween(dur, fn, delay = 0) {
    return new Promise((res) => {
      this.tweens.push({ start: performance.now() + delay, dur: Math.max(1, dur), fn, res });
      this.kick();
    });
  }

  at(delay, fn) { return this.tween(1, (t) => { if (t >= 1) fn(); }, delay); }

  kick() { if (!this.raf && !this.dead) this.raf = requestAnimationFrame(this.frame); }

  frame(now) {
    this.raf = 0;
    const dt = Math.min(50, now - (this.last || now));
    this.last = now;
    const done = [];
    const list = this.tweens;
    this.tweens = [];
    const keep = [];
    for (const tw of list) {
      if (now < tw.start) { keep.push(tw); continue; }
      const t = clamp01((now - tw.start) / tw.dur);
      tw.fn(t);
      if (t >= 1) done.push(tw); else keep.push(tw);
    }
    this.tweens = keep.concat(this.tweens);
    this._stepParticles(dt);
    this.draw(now);
    for (const tw of done) tw.res();
    if (this.tweens.length || this.particles.length || this.effects.length || this.texts.length || this.hint || this.shake || this.sel >= 0) this.kick();
    else this.last = 0;
  }

  async play(events) {
    this.busy = true;
    this.clearHint();
    this.sel = -1;
    try {
      for (const e of events) {
        if (this.dead) return;
        await this._event(e);
        if (e.hud && this.opts.onHud) this.opts.onHud(e.hud, e);
      }
    } finally {
      if (!this.dead) {
        this.syncAll();
        this.busy = false;
        this.armIdle();
        this.kick();
      }
    }
  }

  async _event(e) {
    switch (e.type) {
      case 'swap': return this._swap(e);
      case 'clear': return this._clear(e);
      case 'fall': return this._fall(e);
      case 'collect': return this._collect(e);
      case 'shuffle': return this._shuffle(e);
      case 'hammer': return this._hammer(e);
      case 'convert': return this._convert(e);
      default: return null;
    }
  }

  async _swap(e) {
    const A = this.spriteAt(e.a), B = this.spriteAt(e.b);
    if (!A || !B) return;
    const [ra, ca] = this.rc(e.a), [rb, cb] = this.rc(e.b);
    A.z = 2; B.z = 1;
    const move = (k) => {
      A.x = ca + (cb - ca) * k; A.y = ra + (rb - ra) * k;
      B.x = cb + (ca - cb) * k; B.y = rb + (ra - rb) * k;
    };
    if (e.ok) {
      sfx.play('tap');
      await this.tween(150, (t) => move(E.inOut(t)));
    } else {
      await this.tween(120, (t) => move(E.out(t) * 0.92));
      sfx.play('error');
      await this.tween(170, (t) => move(0.92 * (1 - E.back(t))));
      move(0);
    }
    A.z = B.z = 0;
  }

  async _clear(e) {
    const jobs = [];
    const mergeTo = new Map();
    for (const cr of e.created) for (const f of cr.from) mergeTo.set(f, cr.i);
    sfx.play('pop');
    if (e.combo >= 2) this.at(60, () => sfx.play('pop'));
    for (const x of e.cleared) {
      const s = this.sprites.get(x.id);
      if (!s) continue;
      s.dying = true;
      const delay = x.d * U;
      const target = mergeTo.get(x.i);
      if (target !== undefined && x.m && x.d === 0) {
        const [tr, tc] = this.rc(target);
        const x0 = s.x, y0 = s.y;
        jobs.push(this.tween(170, (t) => {
          const k = E.inQ(t);
          s.x = x0 + (tc - x0) * k; s.y = y0 + (tr - y0) * k;
          s.a = 1 - t * 0.7; s.sx = s.sy = 1 - t * 0.35;
        }, delay).then(() => this.sprites.delete(x.id)));
      } else {
        jobs.push(this.tween(230, (t) => {
          s.sx = s.sy = t < 0.3 ? 1 + (t / 0.3) * 0.22 : 1.22 * (1 - E.inQ((t - 0.3) / 0.7));
          s.a = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
          s.rot = t * 0.4;
        }, delay).then(() => this.sprites.delete(x.id)));
        this.at(delay + 50, () => this._burst(x.i, x.c, x.sp ? 16 : 8));
      }
    }
    for (const ef of e.effects) {
      jobs.push(this.at(ef.d * U, () => this._effect(ef)));
    }
    for (const cr of e.created) {
      const s = this.sprites.get(cr.id);
      if (!s) continue;
      jobs.push(this.at(170, () => {
        s.sp = cr.sp; s.col = cr.c;
        sfx.play('sparkle');
        this._burst(cr.i, cr.color, 12, 'spark');
        this._float(cr.i, specialWords[cr.sp] || '', '#fff', 0.5, gemMain(cr.color), 900);
        this.tween(380, (t) => { s.sx = s.sy = 1.55 - 0.55 * E.elastic(t); });
      }));
    }
    for (const sh of e.stoneHits) {
      jobs.push(this.at(sh.d * U, () => {
        const s = this.sprites.get(sh.id);
        sfx.play('thud');
        this._burst(sh.i, -2, sh.hp <= 0 ? 14 : 6, 'shard');
        if (!s) return;
        if (sh.hp <= 0) {
          s.dying = true;
          this.tween(160, (t) => { s.a = 1 - t; s.sx = s.sy = 1 + t * 0.2; }).then(() => this.sprites.delete(sh.id));
        } else {
          s.hp = sh.hp;
          this.tween(220, (t) => { s.rot = Math.sin(t * Math.PI * 4) * 0.12 * (1 - t); });
        }
      }));
    }
    for (const ih of e.iceHits) {
      jobs.push(this.at(ih.d * U + 30, () => {
        this.ice[ih.i] = ih.left;
        this._burst(ih.i, -1, ih.left ? 6 : 10, 'shard');
      }));
    }
    for (const pp of e.popups) jobs.push(this.at(90, () => this._float(pp.i, '+' + pp.pts, gemMain(pp.c), 0.32, null, 750)));
    if (e.combo >= 2) {
      const word = praise[Math.min(e.combo, praise.length - 1)];
      if (word) jobs.push(this.at(120, () => { this._banner(word); if (e.combo >= 3) sfx.play('sparkle'); }));
    }
    await Promise.all(jobs);
    await this.tween(40, () => {});
  }

  async _fall(e) {
    const frames = e.frames;
    const F = frames.length;
    const durs = frames.map((_, k) => Math.max(30, 74 - k * 8));
    const times = [0];
    for (let k = 0; k < F; k++) times.push(times[k] + durs[k]);
    const paths = new Map();
    frames.forEach((moves, k) => {
      for (const m of moves) {
        let p = paths.get(m.id);
        if (!p) {
          p = { pts: new Array(F + 1).fill(null), first: k, last: k, spawn: !!m.p };
          paths.set(m.id, p);
          p.pts[k] = [m.fr, m.fc];
          if (m.p) {
            const s = this._newSprite({ id: m.id, ...m.p }, [m.fr, m.fc]);
            s.a = 0;
          }
        }
        if (!p.pts[k]) p.pts[k] = [m.fr, m.fc];
        p.pts[k + 1] = this.rc(m.to);
        p.last = k + 1;
      }
    });
    for (const p of paths.values()) {
      for (let k = 0; k <= F; k++) {
        if (!p.pts[k]) p.pts[k] = k < p.first ? p.pts[p.first] : p.pts[k - 1];
      }
    }
    const BOUNCE = 150;
    const total = times[F] + BOUNCE;
    let landed = false;
    await this.tween(total, (tt) => {
      const now = tt * total;
      if (!landed && now >= times[F] - 20) { landed = true; sfx.play('place'); }
      for (const [id, p] of paths) {
        const s = this.sprites.get(id);
        if (!s) continue;
        if (now >= times[p.last]) {
          const [r, c] = p.pts[p.last];
          s.x = c; s.y = r; s.a = 1;
          const b = (now - times[p.last]) / BOUNCE;
          const q = b < 1 ? Math.sin(b * Math.PI) * (1 - b * 0.4) : 0;
          s.sy = 1 - 0.13 * q; s.sx = 1 + 0.08 * q; s.oy = 0.065 * q;
          continue;
        }
        let k = p.first;
        while (k < F - 1 && times[k + 1] <= now) k++;
        const f = clamp01((now - times[k]) / durs[k]);
        const [r0, c0] = p.pts[k], [r1, c1] = p.pts[k + 1];
        s.x = c0 + (c1 - c0) * f; s.y = r0 + (r1 - r0) * f;
        if (p.spawn) s.a = k === p.first ? f : 1;
        s.sy = 1.04; s.sx = 0.97;
      }
    });
  }

  async _collect(e) {
    sfx.play('complete');
    const jobs = [];
    for (const it of e.items) {
      const s = this.sprites.get(it.id);
      this._burst(it.i, -3, 16, 'spark');
      this._float(it.i, '+300', '#b5651d', 0.34, null, 900);
      if (!s) continue;
      s.dying = true;
      const y0 = s.y;
      jobs.push(this.tween(420, (t) => { s.y = y0 + E.inQ(t) * 0.8; s.a = 1 - t; s.sx = s.sy = 1 + t * 0.25; })
        .then(() => this.sprites.delete(it.id)));
    }
    await Promise.all(jobs);
  }

  async _shuffle(e) {
    sfx.play('whoosh');
    if (e.reason === 'auto') this._banner('Neu gemischt!');
    const ids = new Set(e.moves.map((m) => m.id));
    for (const s of this.sprites.values()) {
      if (s.t === 'g' && !ids.has(s.id)) { s.dying = true; this.tween(200, (t) => { s.a = 1 - t; }).then(() => this.sprites.delete(s.id)); }
    }
    const cx = (this.w - 1) / 2, cy = (this.h - 1) / 2;
    const jobs = [];
    e.moves.forEach((m, k) => {
      let s = this.sprites.get(m.id);
      if (!s) { s = this._newSprite({ id: m.id, t: 'g', c: m.c, sp: m.sp, hp: 0 }, [cy, cx]); s.a = 0; }
      const x0 = s.x, y0 = s.y, a0 = s.a;
      const [tr, tc] = this.rc(m.to);
      const ang = (k * 2.4) % (Math.PI * 2);
      jobs.push(this.tween(720, (t) => {
        if (t < 0.45) {
          const q = E.inOut(t / 0.45);
          const mx = cx + Math.cos(ang) * 0.6, my = cy + Math.sin(ang) * 0.6;
          s.x = x0 + (mx - x0) * q; s.y = y0 + (my - y0) * q; s.sx = s.sy = 1 - 0.4 * q; s.a = a0 + (1 - a0) * q;
          s.rot = q * 2;
        } else {
          const q = E.out((t - 0.45) / 0.55);
          const mx = cx + Math.cos(ang) * 0.6, my = cy + Math.sin(ang) * 0.6;
          s.x = mx + (tc - mx) * q; s.y = my + (tr - my) * q; s.sx = s.sy = 0.6 + 0.4 * q; s.a = 1;
          s.rot = 2 * (1 - q);
        }
      }, (k % 9) * 8));
    });
    await Promise.all(jobs);
  }

  async _hammer(e) {
    const fx = { k: 'hammer', i: e.i, t0: performance.now(), dur: 420 };
    this.effects.push(fx);
    this.kick();
    await this.tween(230, () => {});
    sfx.play('thud');
    this._shake(5, 220);
    this._burst(e.i, -4, 10, 'spark');
  }

  async _convert(e) {
    if (e.finale) this._banner('Bonus!', 1300);
    const jobs = e.list.map((x) => this.at(x.d * U * (e.finale ? 0.75 : 1), () => {
      const s = this.sprites.get(x.id);
      sfx.play('sparkle');
      this._burst(x.i, x.c, 8, 'spark');
      if (!s) return;
      s.sp = x.sp; s.col = x.c;
      this.tween(320, (t) => { s.sx = s.sy = 1.5 - 0.5 * E.elastic(t); });
    }));
    await Promise.all(jobs);
    await this.tween(e.finale ? 260 : 120, () => {});
  }

  // ---------- Effekte ----------

  _cellCenter(i) {
    const [r, c] = this.rc(i);
    return [this.ox + (c + 0.5) * this.cs, this.oy + (r + 0.5) * this.cs];
  }

  _effect(ef) {
    const now = performance.now();
    if (ef.k === 'line') { sfx.play('whoosh'); this.effects.push({ ...ef, t0: now, dur: 460 }); }
    else if (ef.k === 'bomb') { sfx.play('thud'); this._shake(ef.rad > 1 ? 7 : 4, 260); this.effects.push({ ...ef, t0: now, dur: 480 }); }
    else if (ef.k === 'rainbow') { sfx.play('sparkle'); this.effects.push({ ...ef, t0: now, dur: 650 }); }
    else if (ef.k === 'nova') { sfx.play('complete'); this._shake(9, 420); this.effects.push({ ...ef, t0: now, dur: 900 }); }
    this.kick();
  }

  _shake(amp, dur) { this.shake = { amp, dur, t0: performance.now() }; this.kick(); }

  /** Partikel: col ≥ 0 Juwelfarbe, -1 Eis, -2 Stein, -3 Gold, -4 Weiss. */
  _burst(i, col, n, kind = 'dot') {
    const [x, y] = this._cellCenter(i);
    const cs = this.cs;
    const palette = col >= 0 ? [GEM_COLORS[col][0], GEM_COLORS[col][1], '#ffffff']
      : col === -1 ? ['#e3f6ff', '#9fd7f5', '#ffffff']
        : col === -2 ? ['#b8afa4', '#857b70', '#d9d2c8']
          : col === -3 ? ['#ffd43b', '#ffa94d', '#ffffff'] : ['#ffffff', '#fff3bf'];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random() * 1.6) * cs * 0.06;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'shard' ? cs * 0.04 : 0),
        g: kind === 'shard' ? cs * 0.006 : kind === 'spark' ? 0 : cs * 0.002,
        life: 0, max: 380 + Math.random() * 320, size: cs * (kind === 'spark' ? 0.09 : 0.06) * (0.6 + Math.random() * 0.7),
        col: palette[k % palette.length], kind,
      });
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
    this.kick();
  }

  _float(i, text, col, size = 0.32, stroke = null, dur = 750) {
    const [x, y] = this._cellCenter(i);
    this.texts.push({ x, y, text, col, size, stroke, dur, t0: performance.now() });
    this.kick();
  }

  _banner(text, dur = 1000) {
    this.texts.push({ banner: true, text, dur, t0: performance.now() });
    this.kick();
  }

  _stepParticles(dt) {
    const k = dt / 16.7;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.vy += p.g * k;
      p.x += p.vx * k; p.y += p.vy * k;
      p.vx *= 0.97; p.vy *= 0.97;
      return p.life < p.max;
    });
    const now = performance.now();
    this.effects = this.effects.filter((f) => now - f.t0 < f.dur);
    this.texts = this.texts.filter((t) => now - t.t0 < t.dur);
    if (this.shake && now - this.shake.t0 > this.shake.dur) this.shake = null;
  }

  // ---------- Hinweise ----------

  armIdle() {
    clearTimeout(this.idleT);
    if (this.dead) return;
    this.idleT = setTimeout(() => {
      if (this.busy || this.dead || !this.opts.getHint) return;
      const m = this.opts.getHint();
      if (m) this.showHint(m);
    }, this.idleMs);
  }

  showHint(m) {
    const A = this.spriteAt(m.a), B = this.spriteAt(m.b);
    if (!A || !B) return;
    this.hint = { a: m.a, b: m.b, A: A.id, B: B.id, t0: performance.now() };
    this.kick();
  }

  clearHint() {
    if (this.hint) { this.hint = null; this.draw(); }
    clearTimeout(this.idleT);
  }

  /** Coach-Mark: Finger zeigt den ersten Zug (Level 1). */
  setCoach(m) {
    this.coach = m;
    if (!m) { if (this.coachEl) { this.coachEl.remove(); this.coachEl = null; } return; }
    if (!this.coachEl) {
      this.coachEl = document.createElement('div');
      this.coachEl.className = 'm3-coach';
      this.coachEl.innerHTML = '<span class="m3-coach-ring"></span><span class="m3-coach-finger"></span>';
      this.wrap.append(this.coachEl);
    }
    this._placeCoach();
  }

  _placeCoach() {
    const [ax, ay] = this._cellCenter(this.coach.a), [bx, by] = this._cellCenter(this.coach.b);
    const st = this.coachEl.style;
    st.left = ax + 'px'; st.top = ay + 'px';
    st.setProperty('--dx', bx - ax + 'px'); st.setProperty('--dy', by - ay + 'px');
    st.setProperty('--cs', this.cs + 'px');
  }

  // ---------- Eingabe ----------

  _cellFrom(ev) {
    const r = this.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left - this.ox, y = ev.clientY - r.top - this.oy;
    const c = Math.floor(x / this.cs), rr = Math.floor(y / this.cs);
    if (c < 0 || rr < 0 || c >= this.w || rr >= this.h) return -1;
    const i = rr * this.w + c;
    return this.game.mask[i] ? i : -1;
  }

  _bindInput() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (ev) => {
      if (!this.game) return;
      ev.preventDefault();
      sfx.unlock && sfx.unlock();
      const i = this._cellFrom(ev);
      this.clearHint();
      if (i < 0 || this.busy) { this.armIdle(); return; }
      if (this.mode === 'hammer') { this.opts.onTap && this.opts.onTap(i); return; }
      try { cv.setPointerCapture(ev.pointerId); } catch { /* egal */ }
      this.drag = { i, x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false };
    });
    cv.addEventListener('pointermove', (ev) => {
      const d = this.drag;
      if (!d || d.id !== ev.pointerId || this.busy) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cs * 0.32) return;
      const [r, c] = this.rc(d.i);
      let rr = r, cc = c;
      if (Math.abs(dx) > Math.abs(dy)) cc += dx > 0 ? 1 : -1; else rr += dy > 0 ? 1 : -1;
      this.drag = null;
      if (rr < 0 || cc < 0 || rr >= this.h || cc >= this.w) return;
      const j = rr * this.w + cc;
      this.sel = -1;
      if (this.game.mask[j]) this._requestSwap(d.i, j);
    });
    const up = (ev) => {
      const d = this.drag;
      if (!d || d.id !== ev.pointerId) return;
      this.drag = null;
      if (this.busy) return;
      const i = d.i;
      if (this.sel >= 0 && this.sel !== i && this.game.adjacent(this.sel, i)) {
        const a = this.sel; this.sel = -1; this._requestSwap(a, i);
      } else if (this.sel === i) { this.sel = -1; this.draw(); } else {
        const p = this.game.cells[i];
        if (p && (p.t === 'g' || p.t === 'i')) { this.sel = i; this.selT = performance.now(); sfx.play('click'); this.kick(); }
      }
      this.armIdle();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { this.drag = null; });
    // Schnelles Wischen nacheinander ist hier gewollt: Doppeltipp-Schutz der Seite nicht anwenden
    // (touch-action: none verhindert das Zoomen auf dem Brett ohnehin).
    cv.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
  }

  _requestSwap(a, b) {
    if (this.coach) this.setCoach(null);
    this.opts.onSwap && this.opts.onSwap(a, b);
  }

  // ---------- Zeichnen ----------

  draw(now = performance.now()) {
    if (!this.game || !this.bg) return;
    const { ctx, cs, ox, oy, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let sx = 0, sy = 0;
    if (this.shake) {
      const k = 1 - (now - this.shake.t0) / this.shake.dur;
      if (k > 0) { sx = (Math.random() - 0.5) * this.shake.amp * k * dpr; sy = (Math.random() - 0.5) * this.shake.amp * k * dpr; }
    }
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, sx, sy);
    // Eis
    for (let i = 0; i < this.game.size; i++) {
      const l = this.ice[i];
      if (l > 0) { const [r, c] = this.rc(i); ctx.drawImage(this.iceSprites[Math.min(2, l)], ox + c * cs, oy + r * cs, cs, cs); }
    }
    // Auswahl
    if (this.sel >= 0) {
      const [r, c] = this.rc(this.sel);
      const pulse = 0.5 + 0.5 * Math.sin((now - this.selT) / 160);
      ctx.beginPath();
      ctx.roundRect(ox + c * cs + 2, oy + r * cs + 2, cs - 4, cs - 4, cs * 0.22);
      ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.3 * pulse})`;
      ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,170,60,.95)'; ctx.stroke();
    }
    // Tipp-Leuchten
    let hintOff = null;
    if (this.hint) {
      const t = (now - this.hint.t0) / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      for (const i of [this.hint.a, this.hint.b]) {
        const [x, y] = this._cellCenter(i);
        const g = ctx.createRadialGradient(x, y, cs * 0.15, x, y, cs * 0.62);
        g.addColorStop(0, `rgba(255,236,150,${0.55 + 0.35 * pulse})`);
        g.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - cs, y - cs, cs * 2, cs * 2);
      }
      const [ra, ca] = this.rc(this.hint.a), [rb, cb] = this.rc(this.hint.b);
      const n = Math.max(0, Math.sin(t * 5)) * 0.1;
      hintOff = { [this.hint.A]: [(cb - ca) * n, (rb - ra) * n], [this.hint.B]: [(ca - cb) * n, (ra - rb) * n] };
    }
    // Steine & Juwelen
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox - cs * 0.2, oy, cs * (this.w + 0.4), cs * (this.h + 0.6));
    ctx.clip();
    const list = [...this.sprites.values()].sort((a, b) => a.z - b.z);
    const selId = this.sel >= 0 && this.game.cells[this.sel] ? this.game.cells[this.sel].id : -1;
    for (const s of list) {
      if (s.a <= 0) continue;
      const img = this.atlas.get({ t: s.t, c: s.col, sp: s.sp, hp: s.hp });
      if (!img) continue;
      let x = ox + (s.x + 0.5) * cs, y = oy + (s.y + 0.5 + s.oy) * cs;
      if (hintOff && hintOff[s.id]) { x += hintOff[s.id][0] * cs; y += hintOff[s.id][1] * cs; }
      let scx = s.sx, scy = s.sy;
      if (s.id === selId) { const p = 1 + 0.06 * Math.sin((now - this.selT) / 130); scx *= p; scy *= p; }
      ctx.globalAlpha = s.a;
      if (s.rot || scx !== 1 || scy !== 1 || s.sp === SP.RAINBOW) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.rot + (s.sp === SP.RAINBOW ? now / 900 : 0));
        ctx.scale(scx, scy);
        ctx.drawImage(img, -cs / 2, -cs / 2, cs, cs);
        ctx.restore();
      } else ctx.drawImage(img, x - cs / 2, y - cs / 2, cs, cs);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this._drawEffects(now);
    this._drawParticles();
    this._drawTexts(now);
  }

  _drawEffects(now) {
    const { ctx, cs, ox, oy } = this;
    for (const f of this.effects) {
      const t = clamp01((now - f.t0) / f.dur);
      if (f.k === 'line') {
        const wide = f.wide ? 3 : 1;
        const a = 1 - E.inQ(t);
        const grow = E.out(clamp01(t / 0.35));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (f.dir === 'h') {
          const y = oy + (f.r + 0.5) * cs, x0 = ox + (f.c + 0.5) * cs;
          const len = grow * cs * this.w * 1.05;
          const th = cs * (0.42 * wide) * (1 - t * 0.5);
          const g = ctx.createLinearGradient(0, y - th, 0, y + th);
          g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.fillStyle = g;
          ctx.fillRect(Math.max(ox - cs * 0.2, x0 - len), y - th, Math.min(len * 2, cs * (this.w + 0.4)), th * 2);
        } else {
          const x = ox + (f.c + 0.5) * cs, y0 = oy + (f.r + 0.5) * cs;
          const len = grow * cs * this.h * 1.05;
          const th = cs * (0.42 * wide) * (1 - t * 0.5);
          const g = ctx.createLinearGradient(x - th, 0, x + th, 0);
          g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - th, Math.max(oy - cs * 0.2, y0 - len), th * 2, Math.min(len * 2, cs * (this.h + 0.4)));
        }
        ctx.restore();
      } else if (f.k === 'bomb' || f.k === 'nova') {
        const [x, y] = [ox + (f.c + 0.5) * cs, oy + (f.r + 0.5) * cs];
        const R = (f.k === 'nova' ? Math.max(this.w, this.h) : f.rad + 0.6) * cs * E.out(t);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, R));
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.6, 'rgba(255,230,160,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = cs * 0.12 * (1 - t);
        ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, R * 0.95), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (f.k === 'rainbow') {
        const x0 = ox + (f.c + 0.5) * cs, y0 = oy + (f.r + 0.5) * cs;
        ctx.save();
        ctx.globalAlpha = 1 - E.inQ(t);
        ctx.lineCap = 'round';
        f.targets.forEach((i, k) => {
          const [x1, y1] = this._cellCenter(i);
          const reach = clamp01(t * 3 - k * 0.03);
          if (reach <= 0) return;
          ctx.strokeStyle = RAINBOW[(k + Math.floor(now / 80)) % 6];
          ctx.lineWidth = cs * 0.09;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          const mx = x0 + (x1 - x0) * 0.5 + Math.sin(k * 7.1) * cs * 0.4, my = y0 + (y1 - y0) * 0.5 + Math.cos(k * 3.3) * cs * 0.4;
          ctx.quadraticCurveTo(mx, my, x0 + (x1 - x0) * reach, y0 + (y1 - y0) * reach);
          ctx.stroke();
        });
        const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, cs * 1.2);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x0 - cs * 1.2, y0 - cs * 1.2, cs * 2.4, cs * 2.4);
        ctx.restore();
      } else if (f.k === 'hammer') {
        const [x, y] = this._cellCenter(f.i);
        const swing = t < 0.55 ? -1.1 + E.inQ(t / 0.55) * 1.5 : 0.4 - (t - 0.55) * 0.6;
        ctx.save();
        ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
        ctx.translate(x + cs * 0.45, y + cs * 0.1);
        ctx.rotate(swing);
        ctx.font = `${Math.round(cs * 1.1)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔨', -cs * 0.35, -cs * 0.35);
        ctx.restore();
      }
    }
  }

  _drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.col;
      if (p.kind === 'spark') {
        const r = p.size * (0.6 + a * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r); ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
        ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
        ctx.fill();
      } else if (p.kind === 'shard') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.7);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawTexts(now) {
    const { ctx, cs } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = clamp01((now - t.t0) / t.dur);
      if (t.banner) {
        const s = k < 0.25 ? E.back(k / 0.25) : 1;
        const a = k > 0.75 ? (1 - k) / 0.25 : 1;
        const fs = Math.round(Math.min(cs * 1.05, this.W / 8));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(this.W / 2, this.oy + (this.h * cs) / 2 - k * cs * 0.4);
        ctx.scale(s, s);
        ctx.rotate(-0.04);
        ctx.font = `800 ${fs}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
        ctx.lineWidth = fs * 0.2;
        ctx.strokeStyle = '#a3215a';
        ctx.strokeText(t.text, 0, 0);
        const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
        g.addColorStop(0, '#fff6c9'); g.addColorStop(1, '#ffc43d');
        ctx.fillStyle = g;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
        continue;
      }
      const fs = Math.round(cs * t.size * (t.stroke ? 1.6 : 1));
      ctx.save();
      ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      ctx.font = `800 ${fs}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      const y = t.y - E.out(k) * cs * 0.7;
      ctx.lineWidth = fs * 0.22;
      ctx.strokeStyle = t.stroke || 'rgba(255,255,255,.95)';
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.text, t.x, y);
      ctx.restore();
    }
  }
}
