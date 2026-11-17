// Spielansicht: Canvas-Darstellung, Zielen per Ziehen, Animationen (Flug, Platzen,
// Fallen, Partikel, Tierchen) – die Spielregeln selbst stecken in core/game.js.

import { LAUNCH_X, LAUNCH_Y, FIELD_H, WIDTH, ROW_H, ROWS, DEAD_Y, angleTo, clampAngle, MIN_ANGLE } from './core/hex.js';
import { pointAt, pathLength } from './core/trace.js';
import { COMBO_STEP, MAX_SPECIALS, BOMB_RADIUS, SPECIAL_NAMES } from './core/game.js';
import { COLORS } from './data/colors.js';
import { SpriteCache, rgba, mix, EMOJI_FONT, paintSpecial } from './sprites.js';
import { sfx } from '../shared/sfx.js';

const FLY_SPEED = 64;          // Einheiten pro Sekunde
const POP_STEP = 0.055;        // Verzögerung pro Ring beim Platzen
const GRAVITY = 70;
const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Positionen im Werferbereich (Logik-Einheiten)
const NEXT_X = LAUNCH_X - 4.3;
const NEXT_Y = LAUNCH_Y + 0.55;
const NEXT_R = 0.72;
const SLOT_X = [15.4, 17.75, 20.1];
const SLOT_Y = LAUNCH_Y + 0.5;
const SLOT_R = 0.92;
const BADGE_X = 2.75;

const outBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const now = () => performance.now() / 1000;

function colorOf(v) {
  if (typeof v === 'string') return v === 'fire' ? '#ff8a3a' : v === 'bomb' ? '#5b62a8' : '#ffd23a';
  const k = v & 15;
  if (k === 9) return '#a59cb0';
  return (COLORS[k] || COLORS[1]).base;
}

export class PlayView {
  /**
   * @param {HTMLElement} host
   * @param {Game} game
   * @param {object} opts { pets, symbols, onShot(ev), onSettled(ev), onChange(), onBonusDone() }
   */
  constructor(host, game, opts = {}) {
    this.host = host;
    this.game = game;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bz-canvas';
    this.canvas.setAttribute('aria-label', 'Spielfeld');
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.sprites = new SpriteCache();
    this.symbols = opts.symbols !== false;
    this.disp = game.board.clone();
    this.particles = [];
    this.falling = [];
    this.pending = [];
    this.popups = [];
    this.flyers = [];       // Tierchen & Spezialkugeln, die zu einem Ziel fliegen
    this.banners = [];
    this.springs = new Map();
    this.flight = null;
    this.aim = null;
    this.pointer = null;
    this.hint = null;
    this.raf = 0;
    this.shiftY = 0;
    this.shiftAnim = null;
    this.placeAnim = null;
    this.shooterAnim = null;
    this.swapAnim = null;
    this.bonus = null;
    this.lastEv = null;
    this.settledPending = false;
    this.hudShots = game.shotsLeft;
    this.introT0 = now();
    this.destroyed = false;

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
    }
    this.bind();
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    if (this.ro) this.ro.disconnect();
    this.canvas.remove();
  }

  setSymbols(on) {
    this.symbols = on;
    this.sprites.setSize(this.sprites.px, on);
    this.invalidate();
  }

  /** Nach Änderungen von aussen (Neustart, +5 Schüsse, Rettung) Anzeige neu aufbauen. */
  syncFromGame({ intro = false } = {}) {
    this.disp = this.game.board.clone();
    this.hudShots = this.game.shotsLeft;
    this.shiftY = 0;
    this.shiftAnim = null;
    if (intro) this.introT0 = now();
    this.invalidate();
  }

  // ---------- Masse ----------

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const s = Math.min(w / WIDTH, h / FIELD_H);
    this.s = s;
    this.ox = (w - WIDTH * s) / 2;
    this.oy = h - FIELD_H * s;
    this.sprites.setSize(s * dpr, this.symbols);
    this.cloudCache = null;
    this.invalidate();
  }

  X(x) { return this.ox + x * this.s; }
  Y(y) { return this.oy + y * this.s; }
  toLogic(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.s, y: (clientY - r.top - this.oy) / this.s };
  }

  // ---------- Eingabe ----------

  bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', () => { this.pointer = null; this.aim = null; this.invalidate(); });
    c.addEventListener('lostpointercapture', () => { if (this.pointer) { this.pointer = null; this.aim = null; this.invalidate(); } });
  }

  hitTarget(p) {
    const d = (x, y) => Math.hypot(p.x - x, p.y - y);
    if (d(LAUNCH_X, LAUNCH_Y) < 1.55) return { type: 'shooter' };
    if (d(NEXT_X, NEXT_Y) < 1.7) return { type: 'next' };
    for (let i = 0; i < MAX_SPECIALS; i++) if (d(SLOT_X[i], SLOT_Y) < 1.2) return { type: 'slot', i };
    return null;
  }

  down(e) {
    if (this.destroyed || this.game.status !== 'play' || this.bonus) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.toLogic(e.clientX, e.clientY);
    this.hint = null;
    const hit = this.hitTarget(p);
    this.pointer = { id: e.pointerId, sx: e.clientX, sy: e.clientY, hit, moved: false };
    if (!hit && p.y < LAUNCH_Y - 0.6) this.updateAim(p);
    this.invalidate();
  }

  move(e) {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 10) ptr.moved = true;
    const p = this.toLogic(e.clientX, e.clientY);
    if (ptr.hit && ptr.hit.type === 'shooter' && ptr.moved) ptr.hit = null; // vom Werfer aus zielen
    if (!ptr.hit) this.updateAim(p);
  }

  up(e) {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== e.pointerId) return;
    this.pointer = null;
    const p = this.toLogic(e.clientX, e.clientY);
    if (ptr.hit && !ptr.moved) {
      if (ptr.hit.type === 'shooter' || ptr.hit.type === 'next') this.doSwap();
      else if (ptr.hit.type === 'slot') this.doArm(ptr.hit.i);
      this.aim = null;
      this.invalidate();
      return;
    }
    if (!ptr.hit) this.updateAim(p);
    const a = this.aim;
    this.aim = null;
    if (a && a.valid && this.canShoot()) this.fire(a.angle);
    this.invalidate();
  }

  updateAim(p) {
    const valid = p.y < LAUNCH_Y - 0.6;
    if (!valid) { this.aim = { valid: false }; this.invalidate(); return; }
    const angle = clampAngle(angleTo(p.x, p.y));
    if (!this.aim || !this.aim.valid || Math.abs(this.aim.angle - angle) > 1e-4 || this.aim.armed !== this.game.armedType) {
      this.aim = { valid: true, angle, armed: this.game.armedType, trace: this.game.aim(angle) };
    }
    this.invalidate();
  }

  canShoot() {
    return !this.flight && !this.pending.some((p) => p.how !== 'drop' && p.how !== 'finale') && !this.shiftAnim && !this.bonus && this.game.status === 'play';
  }

  doSwap() {
    const g = this.game;
    const before = { cur: g.current, next: g.next };
    const r = g.swap();
    if (!r) return;
    if (r === 'disarm') sfx.play('click');
    else {
      sfx.play('tap');
      if (before.cur !== before.next) this.swapAnim = { t0: now() };
    }
    this.opts.onChange?.('swap');
    this.invalidate();
  }

  doArm(i) {
    if (i >= this.game.specials.length) return;
    if (this.game.arm(i)) {
      sfx.play(this.game.armed >= 0 ? 'sparkle' : 'click');
      this.opts.onChange?.('arm');
      this.invalidate();
    }
  }

  /** Zeigt einen Tipp (Winkel) für einige Sekunden. */
  showHint(move) {
    if (!move) return;
    const g = this.game;
    if (move.swap && g.armed < 0) g.swap();
    if (move.arm >= 0 && g.armed !== move.arm) g.arm(move.arm);
    this.hint = { angle: move.angle, t0: now(), trace: g.aim(move.angle) };
    this.opts.onChange?.('hint');
    this.invalidate();
  }

  // ---------- Schuss ----------

  fire(angle) {
    const g = this.game;
    const v = g.armedType || g.current;
    const ev = g.shoot(angle);
    if (!ev) return;
    this.lastEv = ev;
    this.settledPending = true;
    this.opts.onShot?.(ev);
    const t = now();
    const len = pathLength(ev.path);
    this.flight = { path: ev.path, len, t0: t, v, ev, seg: 1, fireIdx: 0 };
    if (ev.kind === 'normal') {
      this.shooterAnim = { t0: t };
      this.hudShots = g.shotsLeft;
    }
    sfx.play(ev.kind === 'fire' ? 'whoosh' : 'tap');
    if (ev.kind === 'fire') {
      // Getroffene Blasen platzen, sobald die Flamme sie erreicht
      for (const o of ev.removed) {
        if (o.how === 'fire') this.pending.push({ ...o, at: t + o.d / FLY_SPEED, fromDisp: true });
      }
    }
    this.invalidate();
  }

  impact(ev) {
    const t = now();
    const g = this.game;
    const pops = ev.removed.filter((o) => o.how === 'pop' || o.how === 'boom');
    const drops = ev.removed.filter((o) => o.how === 'drop');
    const finale = ev.removed.filter((o) => o.how === 'finale');
    const maxD = pops.reduce((m, o) => Math.max(m, o.d), 0);
    const popEnd = pops.length ? t + 0.06 + maxD * POP_STEP : t;
    for (const o of pops) this.pending.push({ ...o, at: t + 0.06 + o.d * POP_STEP });
    drops.forEach((o, i) => this.pending.push({ ...o, at: popEnd + 0.08 + Math.min(i, 30) * 0.012 }));
    const finStart = popEnd + (drops.length ? 0.4 : 0.15);
    finale.forEach((o, i) => this.pending.push({ ...o, at: finStart + Math.min(i, 80) * 0.018 }));

    // Feld auf den neuen Stand umstellen (verschwindende Blasen zeichnet «pending»)
    this.disp = g.board.clone();
    const k = ev.inserted || 0;
    if (k) {
      this.shiftY = -k * ROW_H;
      this.shiftAnim = { from: -k * ROW_H, t0: Math.max(popEnd, t) + (drops.length ? 0.45 : 0.2), dur: 0.55, ev };
    }
    if (ev.placed && ev.target) {
      this.placeAnim = { r: ev.target.r + k, c: ev.target.c, t0: t };
      sfx.play('place');
    }
    if (ev.target) this.kick(ev.target.x, ev.target.y, k, ev.kind === 'bomb' ? 2.2 : 1);

    if (ev.kind === 'bomb' && ev.target) {
      sfx.play('thud');
      this.ring(ev.target.x, ev.target.y, '#ffffff', BOMB_RADIUS * 2.2 + 1, 0.45, 0.32);
      this.ring(ev.target.x, ev.target.y, '#ffd23a', BOMB_RADIUS * 2 + 0.5, 0.35, 0.22);
      for (let i = 0; i < 18; i++) this.spark(ev.target.x, ev.target.y, '#ffd23a', 10 + Math.random() * 10);
    }
    if (ev.kind === 'rainbow' && ev.target) {
      const cols = ['#f0475e', '#ff9a2e', '#ffd23a', '#49c463', '#3d8ef0', '#9a62ee'];
      for (let i = 0; i < 14; i++) this.spark(ev.target.x, ev.target.y, cols[i % cols.length], 8 + Math.random() * 8);
    }

    // Punkte & Texte
    if (ev.score > 0 && ev.target) {
      this.popup(ev.target.x, ev.target.y - 0.5, `+${ev.score.toLocaleString('de-CH')}`, '#ffffff', 1.05, popEnd - t + 0.1);
    }
    const total = ev.removed.length - finale.length;
    if (ev.combo >= 2 && total > 0) this.banner(`Kombo ×${ev.combo}`, 0.95, '#ffffff', popEnd - t);
    if (drops.length >= 12) this.banner('Fantastisch!', 1.5, '#ffd23a', popEnd - t + 0.2);
    else if (drops.length >= 7) this.banner('Wunderbar!', 1.35, '#ffd23a', popEnd - t + 0.2);
    else if (total >= 9) this.banner('Super!', 1.25, '#ffd23a', popEnd - t + 0.1);
    if (ev.earned) {
      const slot = Math.max(0, g.specials.length - 1);
      const from = ev.target || { x: LAUNCH_X, y: 8 };
      this.flyers.push({ kind: 'special', type: ev.earned, x0: from.x, y0: from.y, x1: SLOT_X[slot], y1: SLOT_Y, t0: popEnd + 0.15, dur: 0.75 });
      this.banner(`${SPECIAL_NAMES[ev.earned]} erhalten!`, 0.9, '#ffffff', popEnd - t + 0.35);
    }
    if (ev.specialBonus) this.banner(`Bonus +${ev.specialBonus}`, 0.9, '#ffffff', popEnd - t + 0.35);
    if (!ev.removed.length && ev.kind === 'normal' && g.mode === 'endless') {
      const left = g.missLimit - g.misses;
      if (!ev.descended && left <= 2) this.banner(left === 1 ? 'Noch 1 Fehlschuss' : `Noch ${left} Fehlschüsse`, 0.75, '#ffffff', 0.1);
    }
    this.invalidate();
  }

  kick(x, y, k, strength = 1) {
    for (const o of this.disp.occupied()) {
      const oy = o.y - k * ROW_H;
      const dx = o.x - x, dy = oy - y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01 || d > 6.5) continue;
      const f = strength * 5.5 * Math.max(0, 1 - d / 6.5);
      const key = o.r * 16 + o.c;
      const sp = this.springs.get(key) || { x: 0, y: 0, vx: 0, vy: 0 };
      sp.vx += (dx / d) * f;
      sp.vy += (dy / d) * f;
      this.springs.set(key, sp);
    }
  }

  // ---------- Effekte ----------

  burst(x, y, v, big = false) {
    const col = colorOf(v);
    const n = big ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 5 + Math.random() * (big ? 12 : 8);
      this.particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, r: 0.14 + Math.random() * 0.2, color: col, age: 0, life: 0.45 + Math.random() * 0.3, g: 26 });
    }
    this.ring(x, y, col, 1.9, 0.32, 0.12);
    for (let i = 0; i < 3; i++) this.spark(x, y, '#ffffff', 5 + Math.random() * 6);
  }

  ring(x, y, color, r1, life, w) {
    this.particles.push({ kind: 'ring', x, y, r0: 0.8, r1, color, age: 0, life, w });
  }

  spark(x, y, color, speed) {
    const a = Math.random() * Math.PI * 2;
    this.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.18 + Math.random() * 0.14, color, age: 0, life: 0.5 + Math.random() * 0.3, g: 6 });
  }

  popup(x, y, text, color, size = 1, delay = 0) {
    this.popups.push({ x, y, text, color, size, age: -Math.max(0, delay), life: 0.95 });
  }

  banner(text, size = 1, color = '#ffffff', delay = 0) {
    this.banners.push({ text, size, color, age: -Math.max(0, delay), life: 1.15 });
  }

  freePet(o) {
    const emoji = this.game.pets[(o.v >> 4) - 1] || '🐣';
    this.flyers.push({ kind: 'pet', emoji, x0: o.x, y0: o.y, x1: LAUNCH_X + (Math.random() - 0.5) * 3, y1: -2.5, t0: now(), dur: 1.25 });
    for (let i = 0; i < 4; i++) this.particles.push({ kind: 'heart', x: o.x, y: o.y, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 3, r: 0.32, color: '#ff6f91', age: 0, life: 0.9, g: -1 });
    sfx.play('sparkle');
  }

  /** Siegesbonus: übrige Schüsse sprühen als Funken nach oben. */
  startBonus(onDone) {
    const shots = this.game.shotsLeft;
    if (shots <= 0) { onDone?.(); return; }
    this.bonus = { left: shots, nextAt: now() + 0.35, step: shots > 15 ? 0.06 : 0.11, onDone };
    this.invalidate();
  }

  skipBonus() {
    if (!this.bonus) return;
    const cb = this.bonus.onDone;
    this.hudShots = 0;
    this.bonus = null;
    cb?.();
  }

  /** Animiert ein Ereignis, das nicht aus einem Schuss stammt (z.B. Rettung). */
  animateExternal(ev) {
    this.lastEv = ev;
    this.settledPending = true;
    this.hudShots = this.game.shotsLeft;
    this.impact(ev);
  }

  // ---------- Animation ----------

  invalidate() {
    if (!this.raf && !this.destroyed) {
      this.lastT = now();
      this.raf = requestAnimationFrame(() => this.frame());
    }
  }

  frame() {
    this.raf = 0;
    if (this.destroyed) return;
    const t = now();
    const dt = Math.min(0.05, Math.max(0, t - (this.lastT || t)));
    this.lastT = t;
    const active = this.update(t, dt);
    this.draw(t);
    if (active) this.raf = requestAnimationFrame(() => this.frame());
  }

  update(t, dt) {
    let active = false;
    const g = this.game;

    // Flug
    const f = this.flight;
    if (f) {
      active = true;
      const s = (t - f.t0) * FLY_SPEED;
      // Abpraller-Geräusch
      let acc = 0;
      for (let i = 1; i < f.path.length; i++) {
        acc += Math.hypot(f.path[i].x - f.path[i - 1].x, f.path[i].y - f.path[i - 1].y);
        if (i >= f.seg && i < f.path.length - 1 && s >= acc) { f.seg = i + 1; sfx.play('click'); }
      }
      if (f.v === 'fire' && Math.random() < 0.9) {
        const p = pointAt(f.path, Math.min(s, f.len));
        this.particles.push({ kind: 'dot', x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + 0.3, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, r: 0.2 + Math.random() * 0.25, color: Math.random() < 0.5 ? '#ffb02e' : '#ff6a2a', age: 0, life: 0.35, g: -4 });
      }
      if (s >= f.len) {
        this.flight = null;
        if (f.ev.kind === 'fire') {
          sfx.play('whoosh');
          this.impact({ ...f.ev, target: null, removed: f.ev.removed.filter((o) => o.how !== 'fire') });
        } else this.impact(f.ev);
      }
    }

    // anstehendes Platzen / Fallen
    if (this.pending.length) {
      active = true;
      const keep = [];
      for (const p of this.pending) {
        if (t < p.at) { keep.push(p); continue; }
        if (p.fromDisp && this.disp.get(p.r, p.c)) this.disp.rows[p.r][p.c] = 0;
        if (p.how === 'drop' || p.how === 'finale') {
          this.falling.push({ x: p.x, y: p.y + this.shiftY * 0, v: p.v, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, rot: 0 });
          if (p.v >> 4) this.freePet(p);
        } else {
          this.burst(p.x, p.y, p.v, p.how === 'boom');
          sfx.play('pop');
          if (p.v >> 4) this.freePet(p);
          const key = p.r * 16 + p.c;
          this.springs.delete(key);
        }
      }
      this.pending = keep;
    }

    // Fallende Blasen
    if (this.falling.length) {
      active = true;
      const floor = FIELD_H - 0.9;
      this.falling = this.falling.filter((b) => {
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 1 || b.x > WIDTH - 1) b.vx *= -0.6;
        if (b.y > floor) {
          this.burst(b.x, floor, b.v);
          sfx.play('fill');
          return false;
        }
        return true;
      });
    }

    // Partikel
    if (this.particles.length) {
      active = true;
      this.particles = this.particles.filter((p) => {
        p.age += dt;
        if (p.kind !== 'ring') {
          p.vy += (p.g || 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        return p.age < p.life;
      });
    }
    if (this.popups.length) {
      active = true;
      this.popups = this.popups.filter((p) => (p.age += dt) < p.life);
    }
    if (this.banners.length) {
      active = true;
      this.banners = this.banners.filter((b) => (b.age += dt) < b.life);
    }
    if (this.flyers.length) {
      active = true;
      this.flyers = this.flyers.filter((fl) => {
        if (t >= fl.t0 + fl.dur) {
          if (fl.kind === 'special') { sfx.play('sparkle'); this.ring(fl.x1, fl.y1, '#ffffff', 2, 0.35, 0.15); }
          return false;
        }
        return true;
      });
    }

    // Federn (Wackeln nach Aufprall)
    if (this.springs.size) {
      active = true;
      for (const [k, sp] of this.springs) {
        sp.vx += (-220 * sp.x - 13 * sp.vx) * dt;
        sp.vy += (-220 * sp.y - 13 * sp.vy) * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        if (Math.abs(sp.x) + Math.abs(sp.y) < 0.002 && Math.abs(sp.vx) + Math.abs(sp.vy) < 0.02) this.springs.delete(k);
      }
    }

    // Decke sinkt (Entspannt-Modus)
    if (this.shiftAnim) {
      active = true;
      const a = this.shiftAnim;
      if (t >= a.t0 && !a.started) {
        a.started = true;
        if (a.ev && a.ev.descended) { sfx.play('thud'); this.banner('Die Decke sinkt', 0.9, '#ffffff'); }
        else if (a.ev && a.ev.refilled) { sfx.play('whoosh'); this.banner('Neue Blasen!', 0.9, '#ffffff'); }
      }
      const p = clamp01((t - a.t0) / a.dur);
      this.shiftY = a.from * (1 - outBack(p));
      if (p >= 1) { this.shiftY = 0; this.shiftAnim = null; }
    }

    if (this.placeAnim && t - this.placeAnim.t0 < 0.4) active = true;
    if (this.shooterAnim && t - this.shooterAnim.t0 < 0.3) active = true;
    if (this.swapAnim && t - this.swapAnim.t0 < 0.25) active = true;
    if (t - this.introT0 < 1.4) active = true;
    if (this.aim || this.hint || g.armed >= 0) active = true;
    if (this.hint && t - this.hint.t0 > 3.2) this.hint = null;

    // Siegesbonus
    if (this.bonus) {
      active = true;
      const b = this.bonus;
      if (t >= b.nextAt && !this.flight && this.pending.length === 0) {
        if (b.left > 0) {
          b.left--;
          this.hudShots = b.left;
          b.nextAt = t + b.step;
          const x = BADGE_X, y = LAUNCH_Y;
          for (let i = 0; i < 5; i++) this.spark(x, y - 0.5, ['#ffd23a', '#ffffff', '#ff9ad5'][i % 3], 8 + Math.random() * 6);
          this.popup(x + 0.4, y - 1.6, '+100', '#ffd23a', 0.8);
          sfx.play('place');
        } else if (t >= b.nextAt + 0.35) {
          const cb = b.onDone;
          this.bonus = null;
          cb?.();
        }
      }
    }

    // Alles zur Ruhe gekommen?
    if (this.settledPending && !this.flight && this.pending.length === 0 && !this.shiftAnim) {
      this.settledPending = false;
      const ev = this.lastEv;
      queueMicrotask(() => this.opts.onSettled?.(ev));
    }
    return active || this.falling.length > 0;
  }

  // ---------- Zeichnen ----------

  draw(t) {
    const ctx = this.ctx;
    const { dpr, s } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const g = this.game;

    // Spielfläche (leicht aufgehellt)
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, this.X(0) - 2, this.Y(0), WIDTH * s + 4, (FIELD_H) * s + 4, 18);
    ctx.fill();

    // Todeslinie
    const danger = this.disp.maxRow() >= ROWS - 3;
    ctx.save();
    ctx.setLineDash([s * 0.5, s * 0.45]);
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    const pulse = danger ? 0.45 + 0.35 * Math.sin(t * 6) : 0.35;
    ctx.strokeStyle = danger ? `rgba(240,71,94,${pulse})` : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(this.X(0.6), this.Y(DEAD_Y));
    ctx.lineTo(this.X(WIDTH - 0.6), this.Y(DEAD_Y));
    ctx.stroke();
    ctx.restore();
    if (danger) {
      const grd = ctx.createLinearGradient(0, this.Y(DEAD_Y - 3), 0, this.Y(DEAD_Y));
      grd.addColorStop(0, 'rgba(240,71,94,0)');
      grd.addColorStop(1, `rgba(240,71,94,${0.12 + 0.08 * Math.sin(t * 6)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(this.X(0), this.Y(DEAD_Y - 3), WIDTH * s, 3 * s);
    }

    // Blasen im Feld
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.Y(0) - 2, this.w, this.h);
    ctx.clip();
    const intro = t - this.introT0;
    const pa = this.placeAnim;
    for (const o of this.disp.occupied()) {
      let scale = 1;
      if (intro < 1.4) scale = outBack(clamp01((intro - o.r * 0.045 - Math.abs(o.x - 11) * 0.008) / 0.32));
      if (scale <= 0.01) continue;
      if (pa && pa.r === o.r && pa.c === o.c) {
        const p = clamp01((t - pa.t0) / 0.35);
        scale *= 1 + 0.18 * Math.sin(p * Math.PI) * (1 - p);
      }
      const sp = this.springs.get(o.r * 16 + o.c);
      const x = o.x + (sp ? sp.x : 0), y = o.y + this.shiftY + (sp ? sp.y : 0);
      this.drawCell(o.v, x, y, scale);
    }
    // Blasen, die gleich platzen/fallen
    for (const p of this.pending) {
      if (p.fromDisp) continue;
      const until = p.at - t;
      const swell = until < 0.12 ? 1 + (0.12 - until) * 1.2 : 1;
      this.drawCell(p.v, p.x, p.y, swell);
    }
    ctx.restore();

    // Hervorhebung für Bombe/Feuer beim Zielen
    const aimTrace = this.aim && this.aim.valid ? this.aim.trace : this.hint ? this.hint.trace : null;
    if (aimTrace && !this.flight) this.drawAim(aimTrace, t, !!this.hint && !this.aim);

    // Fliegende Blase
    if (this.flight) {
      const f = this.flight;
      const p = pointAt(f.path, Math.min(f.len, (t - f.t0) * FLY_SPEED));
      if (f.v === 'fire') {
        const glow = ctx.createRadialGradient(this.X(p.x), this.Y(p.y), 0, this.X(p.x), this.Y(p.y), s * 2.2);
        glow.addColorStop(0, 'rgba(255,200,80,0.55)');
        glow.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(this.X(p.x) - s * 2.2, this.Y(p.y) - s * 2.2, s * 4.4, s * 4.4);
      }
      this.drawCell(f.v, p.x, p.y, 1);
    }

    // Fallende Blasen
    for (const b of this.falling) this.drawCell(b.v, b.x, b.y, 1);

    // Wolkendecke (über den Blasen, damit neue Reihen «darunter hervor» kommen)
    this.drawCeiling();

    // Partikel
    for (const p of this.particles) this.drawParticle(p);

    // Werferbereich
    this.drawShooter(t);

    // Fliegende Tierchen / Spezialkugeln
    for (const fl of this.flyers) this.drawFlyer(fl, t);

    // Punkte
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      if (p.age < 0) continue;
      const k = p.age / p.life;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const y = p.y - outCubic(Math.min(1, k * 1.4)) * 1.6;
      const fs = Math.round(s * 0.95 * p.size);
      ctx.font = `800 ${fs}px ${FONT}`;
      ctx.lineWidth = Math.max(2, fs * 0.16);
      ctx.strokeStyle = 'rgba(80,40,90,0.55)';
      ctx.strokeText(p.text, this.X(p.x), this.Y(y));
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, this.X(p.x), this.Y(y));
    }
    ctx.globalAlpha = 1;

    // Banner (Kombo, Super!)
    let by = this.Y(DEAD_Y - 6.2);
    for (const b of this.banners) {
      if (b.age < 0) continue;
      const k = b.age / b.life;
      const sc = k < 0.18 ? outBack(k / 0.18) : 1;
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const fs = Math.round(s * 1.25 * b.size);
      ctx.save();
      ctx.translate(this.w / 2, by - k * s * 0.8);
      ctx.scale(sc, sc);
      ctx.font = `900 ${fs}px ${FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, fs * 0.2);
      ctx.strokeStyle = 'rgba(90,50,110,0.6)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
      by -= fs * 1.25;
    }
    ctx.globalAlpha = 1;
  }

  drawCell(v, x, y, scale = 1) {
    if (!v) return;
    const pet = typeof v === 'number' && v >> 4 ? this.game.pets[(v >> 4) - 1] || '🐣' : null;
    const key = typeof v === 'number' ? v & 15 : v;
    const img = this.sprites.get(key, pet);
    const size = (img.width / this.dpr) * scale;
    this.ctx.drawImage(img, this.X(x) - size / 2, this.Y(y) - size / 2, size, size);
  }

  drawAim(tr, t, isHint) {
    const ctx = this.ctx;
    const s = this.s;
    const g = this.game;
    const armed = g.armedType;
    const v = armed || g.current;
    const pts = tr.points;
    const len = pathLength(pts);
    const end = armed === 'fire' ? len : Math.max(0, len - 0.6);
    const spacing = 1.05;
    const offset = (t * 3.2) % spacing;
    const rainbow = ['#f0475e', '#ff9a2e', '#ffd23a', '#49c463', '#3d8ef0', '#9a62ee'];
    const base = isHint ? '#ffd23a' : colorOf(v);
    let i = 0;
    for (let d = 1.4 + offset; d < end; d += spacing, i++) {
      const p = pointAt(pts, d);
      const fade = 1 - Math.min(0.55, d / 70);
      const r = s * (0.2 - Math.min(0.06, d / 400));
      ctx.beginPath();
      ctx.arc(this.X(p.x), this.Y(p.y), r + s * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.X(p.x), this.Y(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = armed === 'rainbow' ? rainbow[i % rainbow.length] : base;
      ctx.globalAlpha = fade;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (armed === 'fire') {
      for (const p of tr.pierced) {
        const x = this.disp.x(p.r, p.c), y = this.disp.y(p.r) + this.shiftY;
        ctx.beginPath();
        ctx.arc(this.X(x), this.Y(y), s * 1.02, 0, Math.PI * 2);
        ctx.lineWidth = s * 0.14;
        ctx.strokeStyle = `rgba(255,140,40,${0.6 + 0.3 * Math.sin(t * 10)})`;
        ctx.stroke();
      }
      return;
    }
    if (tr.target) {
      const x = this.disp.x(tr.target.r, tr.target.c), y = this.disp.y(tr.target.r) + this.shiftY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.X(x), this.Y(y), s * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = armed ? 'rgba(255,255,255,0.35)' : rgba(isHint ? '#ffd23a' : colorOf(v), 0.3);
      ctx.fill();
      ctx.setLineDash([s * 0.32, s * 0.22]);
      ctx.lineDashOffset = -t * s * 1.5;
      ctx.lineWidth = s * 0.1;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      ctx.restore();
      if (armed === 'bomb') {
        ctx.beginPath();
        ctx.arc(this.X(x), this.Y(y), s * (BOMB_RADIUS * 2 + 0.9), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,210,58,${0.12 + 0.06 * Math.sin(t * 8)})`;
        ctx.fill();
        ctx.lineWidth = s * 0.08;
        ctx.strokeStyle = 'rgba(255,170,40,0.6)';
        ctx.stroke();
      }
    }
  }

  drawParticle(p) {
    const ctx = this.ctx;
    const s = this.s;
    const k = p.age / p.life;
    if (p.kind === 'ring') {
      const r = p.r0 + (p.r1 - p.r0) * outCubic(k);
      ctx.beginPath();
      ctx.arc(this.X(p.x), this.Y(p.y), r * s, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, p.w * s * (1 - k));
      ctx.strokeStyle = rgba(p.color.startsWith('#') ? p.color : '#ffffff', 0.7 * (1 - k));
      ctx.stroke();
      return;
    }
    if (p.kind === 'heart') {
      ctx.globalAlpha = 1 - k;
      ctx.font = `${Math.round(s * 0.8)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💗', this.X(p.x), this.Y(p.y));
      ctx.globalAlpha = 1;
      return;
    }
    if (p.kind === 'spark') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      const r = p.r * s * (1 - k * 0.5);
      ctx.save();
      ctx.translate(this.X(p.x), this.Y(p.y));
      ctx.rotate(k * 3);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const rr = i % 2 ? r * 0.35 : r * 1.4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.beginPath();
    ctx.arc(this.X(p.x), this.Y(p.y), Math.max(0.5, p.r * s * (1 - k * 0.4)), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawFlyer(fl, t) {
    const ctx = this.ctx;
    const s = this.s;
    const k = clamp01((t - fl.t0) / fl.dur);
    if (t < fl.t0) return;
    if (fl.kind === 'pet') {
      const e = outCubic(k);
      const x = fl.x0 + (fl.x1 - fl.x0) * e + Math.sin(k * 9) * 0.6 * (1 - k);
      const y = fl.y0 + (fl.y1 - fl.y0) * e;
      const sc = k < 0.25 ? 1 + k * 2.4 : 1.6 - (k - 0.25) * 0.6;
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.font = `${Math.round(s * 1.3 * sc)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fl.emoji, this.X(x), this.Y(y));
      ctx.globalAlpha = 1;
      return;
    }
    // Spezialkugel fliegt in ihr Fach
    const e = outCubic(k);
    const x = fl.x0 + (fl.x1 - fl.x0) * e;
    const y = fl.y0 + (fl.y1 - fl.y0) * e - Math.sin(k * Math.PI) * 3;
    const img = this.sprites.get(fl.type);
    const size = (img.width / this.dpr) * (0.9 + Math.sin(k * Math.PI) * 0.5);
    ctx.drawImage(img, this.X(x) - size / 2, this.Y(y) - size / 2, size, size);
  }

  drawCeiling() {
    const ctx = this.ctx;
    const s = this.s;
    const top = 0, bottom = this.Y(0.2);
    if (!this.cloudCache || this.cloudCache.h !== bottom) {
      const cv = document.createElement('canvas');
      const hgt = Math.ceil(bottom + s * 1.2);
      cv.width = Math.ceil(this.w * this.dpr);
      cv.height = Math.ceil(hgt * this.dpr);
      const c = cv.getContext('2d');
      c.scale(this.dpr, this.dpr);
      // weiche Wolkenbank
      const grd = c.createLinearGradient(0, top, 0, bottom);
      grd.addColorStop(0, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0.96)');
      c.fillStyle = grd;
      c.fillRect(0, top, this.w, bottom - top);
      c.fillStyle = 'rgba(255,255,255,0.96)';
      const step = s * 1.55;
      for (let x = -step / 2, i = 0; x < this.w + step; x += step, i++) {
        const r = s * (0.75 + ((i * 37) % 5) * 0.09);
        c.beginPath();
        c.arc(x, bottom - r * 0.35, r, 0, Math.PI * 2);
        c.fill();
      }
      // Schatten unter der Kante
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = 'rgba(150,120,170,0.12)';
      for (let x = -step / 2, i = 0; x < this.w + step; x += step, i++) {
        const r = s * (0.75 + ((i * 37) % 5) * 0.09);
        c.beginPath();
        c.arc(x, bottom - r * 0.35 + s * 0.16, r, 0, Math.PI * 2);
        c.fill();
      }
      this.cloudCache = { cv, h: bottom };
    }
    const cc = this.cloudCache.cv;
    ctx.drawImage(cc, 0, 0, cc.width / this.dpr, cc.height / this.dpr);
  }

  drawShooter(t) {
    const ctx = this.ctx;
    const s = this.s;
    const g = this.game;
    const X = (x) => this.X(x), Y = (y) => this.Y(y);

    // Sockel
    ctx.save();
    const py = LAUNCH_Y + 1.05;
    const grd = ctx.createRadialGradient(X(LAUNCH_X), Y(py), 0, X(LAUNCH_X), Y(py), s * 3);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(X(LAUNCH_X), Y(py), s * 3, s * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ring mit Zielpfeil
    const aimAngle = this.aim && this.aim.valid ? this.aim.angle : this.hint ? this.hint.angle : 90;
    ctx.beginPath();
    ctx.arc(X(LAUNCH_X), Y(LAUNCH_Y), s * 1.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = s * 0.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    const a = -aimAngle * Math.PI / 180;
    ctx.save();
    ctx.translate(X(LAUNCH_X), Y(LAUNCH_Y));
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(s * 1.75, 0);
    ctx.lineTo(s * 1.38, -s * 0.32);
    ctx.lineTo(s * 1.38, s * 0.32);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = 'rgba(120,90,150,0.35)';
    ctx.stroke();
    ctx.restore();

    if (g.status === 'play' || this.flight) {
      // aktuelle + nächste Blase
      const armed = g.armedType;
      let curScale = 1, curX = LAUNCH_X, curY = LAUNCH_Y;
      let nextScale = 1;
      const sa = this.shooterAnim;
      if (sa) {
        const k = clamp01((t - sa.t0) / 0.24);
        curX = NEXT_X + (LAUNCH_X - NEXT_X) * outCubic(k);
        curY = NEXT_Y + (LAUNCH_Y - NEXT_Y) * outCubic(k) - Math.sin(k * Math.PI) * 0.8;
        curScale = NEXT_R + (1 - NEXT_R) * k;
        nextScale = outBack(clamp01((t - sa.t0 - 0.12) / 0.25));
        if (k >= 1 && nextScale >= 1) this.shooterAnim = null;
      }
      let nX = NEXT_X, nY = NEXT_Y, nS = NEXT_R * nextScale;
      const sw = this.swapAnim;
      if (sw) {
        const k = clamp01((t - sw.t0) / 0.22);
        const e = outCubic(k);
        curX = NEXT_X + (LAUNCH_X - NEXT_X) * e;
        curY = NEXT_Y + (LAUNCH_Y - NEXT_Y) * e - Math.sin(k * Math.PI) * 1.1;
        curScale = NEXT_R + (1 - NEXT_R) * e;
        nX = LAUNCH_X + (NEXT_X - LAUNCH_X) * e;
        nY = LAUNCH_Y + (NEXT_Y - LAUNCH_Y) * e + Math.sin(k * Math.PI) * 0.8;
        nS = 1 + (NEXT_R - 1) * e;
        if (k >= 1) this.swapAnim = null;
      }
      if (!this.flight || this.flight.v !== 'fire' || true) {
        if (armed) {
          const bob = Math.sin(t * 5) * 0.08;
          this.drawCell(armed, LAUNCH_X, LAUNCH_Y + bob, 1.04);
          // aktuelle Farbe wartet klein daneben
          this.drawCell(g.current, nX, nY, NEXT_R * 0.85);
        } else if (!this.flight || this.shooterAnim) {
          this.drawCell(g.current, curX, curY, curScale);
          this.drawCell(g.next, nX, nY, nS);
        } else {
          this.drawCell(g.next, nX, nY, nS);
        }
      }
      if (!armed) {
        // Tausch-Pfeil
        ctx.save();
        ctx.translate(X((LAUNCH_X + NEXT_X) / 2), Y(LAUNCH_Y + 1.45));
        ctx.beginPath();
        ctx.arc(0, -s * 1.2, s * 1.45, Math.PI * 0.62, Math.PI * 0.38, true);
        ctx.lineWidth = s * 0.11;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    // Kombo-Punkte unter dem Werfer
    const dots = COMBO_STEP;
    const filled = g.comboDots;
    for (let i = 0; i < dots; i++) {
      const x = LAUNCH_X + (i - (dots - 1) / 2) * 0.72;
      const y = LAUNCH_Y + 1.95;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), s * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = i < filled ? '#ffd23a' : 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.lineWidth = s * 0.05;
      ctx.strokeStyle = i < filled ? '#e08a00' : 'rgba(150,120,170,0.35)';
      ctx.stroke();
    }

    // Spezial-Fächer
    for (let i = 0; i < MAX_SPECIALS; i++) {
      const x = SLOT_X[i];
      const type = g.specials[i];
      const armedHere = g.armed === i;
      const y = SLOT_Y - (armedHere ? 0.35 : 0);
      if (!type) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(X(x), Y(SLOT_Y), s * SLOT_R * 0.82, 0, Math.PI * 2);
        ctx.setLineDash([s * 0.22, s * 0.18]);
        ctx.lineWidth = s * 0.07;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (this.flyers.some((fl) => fl.kind === 'special' && fl.x1 === x && t < fl.t0 + fl.dur)) continue;
      if (armedHere) {
        ctx.beginPath();
        ctx.arc(X(x), Y(y), s * (1.2 + 0.08 * Math.sin(t * 6)), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,230,120,0.55)';
        ctx.fill();
        continue; // die Kugel liegt im Werfer
      }
      const img = this.sprites.get(type);
      const size = (img.width / this.dpr) * SLOT_R;
      ctx.drawImage(img, X(x) - size / 2, Y(y) - size / 2, size, size);
    }

    // Schüsse (Level) bzw. Fehlschüsse bis die Decke sinkt (Entspannt)
    ctx.save();
    const bx = X(BADGE_X), byy = Y(LAUNCH_Y + 0.35);
    const bw = s * 3.6, bh = s * 2.6;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.shadowColor = 'rgba(90,60,110,0.18)';
    ctx.shadowBlur = s * 0.6;
    ctx.shadowOffsetY = s * 0.12;
    roundRect(ctx, bx - bw / 2, byy - bh / 2, bw, bh, s * 0.8);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (g.mode === 'level') {
      const n = this.hudShots;
      const low = n <= 3 && g.status === 'play' && !this.bonus;
      ctx.fillStyle = low ? '#e5484d' : '#3a2a44';
      const pulse = low ? 1 + 0.06 * Math.sin(t * 8) : 1;
      ctx.font = `900 ${Math.round(s * 1.25 * pulse)}px ${FONT}`;
      ctx.fillText(String(n), bx, byy - s * 0.32);
      // Sterne
      const st = this.bonus ? g.starsNow : g.starsNow;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(bx + (i - 1) * s * 0.85, byy + s * 0.72);
        starPath(ctx, s * 0.36);
        ctx.fillStyle = i < st ? '#ffc21a' : 'rgba(160,140,170,0.35)';
        ctx.fill();
        ctx.restore();
      }
    } else {
      const left = Math.max(0, g.missLimit - g.misses);
      ctx.fillStyle = '#3a2a44';
      ctx.font = `800 ${Math.round(s * 0.62)}px ${FONT}`;
      ctx.fillText('Decke', bx, byy - s * 0.55);
      const n = g.missLimit;
      for (let i = 0; i < n; i++) {
        const x = bx + (i - (n - 1) / 2) * s * 0.55;
        ctx.beginPath();
        ctx.arc(x, byy + s * 0.45, s * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = i < left ? (left <= 2 ? '#ff8a3a' : '#5ab0f0') : 'rgba(160,140,170,0.3)';
        ctx.fill();
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

export { colorOf, paintSpecial, mix };
