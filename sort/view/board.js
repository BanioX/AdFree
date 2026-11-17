// Farbfluss – Spielfeld (Canvas): Layout, Zeichnen, Giess-Animationen, Eingabe.
//
// Die Logik (rules.js) ist die Wahrheit; das Board zeigt sie nur an. Ein Zug wird logisch
// sofort ausgeführt und hier als Animation nachgespielt. Gläser, die gerade animiert werden,
// sind «beschäftigt» – weitere Züge mit ihnen warten in einer Warteschlange.

import {
  G, geom, tubeHeight, cavityPath, glassSprites, shade, rgba, drawSymbol, drawCork, drawSparkle, roundRect,
} from './glass.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const outBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const outBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

const LIFT = 0.5;       // Anheben des gewählten Glases (× Breite)
const TOP_ROOM = 0.68;  // Platz über jeder Reihe (× Breite)
const SHELF = 0.2;      // Regalbrett (× Breite)
const ROW_GAP = 0.3;    // Abstand zwischen Reihen (× Breite)
const GAP = 0.44;       // Abstand zwischen Gläsern (× Breite)

function segsFrom(l) {
  const segs = [];
  for (const c of l) {
    const s = segs[segs.length - 1];
    if (s && s.c === c && !s.lock) s.a += 1;
    else segs.push({ c, a: 1 });
  }
  return segs;
}

function amountOf(segs) {
  let a = 0;
  for (const s of segs) a += s.a;
  return a;
}

function cloneSegs(segs) {
  return segs.map((s) => ({ c: s.c, a: s.a }));
}

export class Board {
  /**
   * opts: {
   *   colorOf(c) → { color, symbol }, hiddenColor, symbols() → bool, speed() → Faktor,
   *   onTap(i), onIdle(), onCork(i, count), onReveal(i), interactive = true,
   *   maxW = 66, shelf = true, sound: { pour(), reveal(), cork() } | null
   * }
   */
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = Object.assign({ interactive: true, maxW: 66, shelf: true, shelfColor: '#e9dcc8', per: 4 }, opts);
    this.tubes = [];
    this.anims = [];
    this.queue = [];
    this.parts = [];
    this.selected = -1;
    this.hint = null;
    this.hintT0 = 0;
    this.W = 0; this.H = 0; this.w = 40;
    this.rows = [];
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.raf = 0;
    this.last = 0;
    this.layoutT0 = -1;
    this.corkCount = 0;
    this.idleWaiters = [];
    this.loop = this.loop.bind(this);
    if (this.o.interactive) {
      canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement || canvas);
    this.resize();
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.dead = true;
  }

  // ---------- Zustand ----------

  /** Baut alle Gläser neu aus dem logischen Zustand auf. intro = Einblend-Animation. */
  setState(state, { intro = false } = {}) {
    this.anims = [];
    this.queue = [];
    this.parts = [];
    this.selected = -1;
    this.hint = null;
    this.o.per = state.per || 4;
    const now = performance.now();
    this.tubes = state.tubes.map((t, i) => this.makeTube(t, intro ? now + 60 + i * 45 : -1));
    this.corkCount = this.tubes.filter((t) => t.corked).length;
    this.layout(false);
    this.wake();
  }

  makeTube(t, appearT0 = -1) {
    const vt = {
      cap: t.cap,
      segs: segsFrom(t.l),
      visH: t.h | 0,
      x: 0, base: 0, fromX: 0, fromBase: 0,
      lift: 0, liftV: 0,
      shakeT0: -1,
      corked: false, corkT0: -1,
      revealT0: -1, revealIdx: -1,
      appearT0,
      busy: 0,
      pose: null,
    };
    vt.corked = this.isComplete(vt);
    return vt;
  }

  /** Bringt die Anzeige ohne Animation auf den logischen Stand (Rückgängig, Neustart …). */
  sync(state) {
    this.anims = [];
    this.queue = [];
    for (const t of this.tubes) t.busy = 0, t.pose = null;
    const now = performance.now();
    let relayout = false;
    while (this.tubes.length > state.tubes.length) { this.tubes.pop(); relayout = true; }
    for (let i = 0; i < state.tubes.length; i++) {
      const s = state.tubes[i];
      let vt = this.tubes[i];
      if (!vt) { vt = this.makeTube(s, now); this.tubes.push(vt); relayout = true; }
      vt.cap = s.cap;
      vt.segs = segsFrom(s.l);
      vt.visH = s.h | 0;
      const done = this.isComplete(vt);
      if (done && !vt.corked) vt.corkT0 = -1;
      vt.corked = done;
    }
    this.corkCount = this.tubes.filter((t) => t.corked).length;
    if (relayout) this.layout(true);
    this.wake();
  }

  isComplete(vt) {
    return vt.segs.length === 1 && Math.abs(vt.segs[0].a - this.o.per) < 1e-6 && vt.visH === 0;
  }

  addTube(t) {
    const vt = this.makeTube(t, performance.now() + 120);
    this.tubes.push(vt);
    this.layout(true);
    this.wake();
  }

  select(i) {
    this.selected = i;
    this.wake();
  }

  setHint(move) {
    this.hint = move;
    this.hintT0 = performance.now();
    this.wake();
  }

  shake(i) {
    const t = this.tubes[i];
    if (!t) return;
    t.shakeT0 = performance.now();
    this.wake();
  }

  /** Kleiner Hüpfer aller Gläser nacheinander (Level geschafft). */
  celebrate() {
    this.tubes.forEach((t, i) => {
      setTimeout(() => { t.liftV -= this.w * 9; this.wake(); }, i * 55);
    });
    this.wake();
  }

  get idle() {
    return !this.anims.length && !this.queue.length;
  }

  whenIdle() {
    if (this.idle) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  /** Alle Animationen sofort beenden. */
  finishAll() {
    for (const a of [...this.anims, ...this.queue]) this.finishAnim(a, true);
    this.anims = [];
    this.queue = [];
    this.wake();
  }

  /**
   * Spielt einen (logisch schon ausgeführten) Zug ab.
   * move: { from, to, n, color }, srcH: verdeckte Schichten im Quellglas danach.
   */
  pour(move, srcH = 0) {
    const a = { ...move, srcH, t0: -1 };
    this.queue.push(a);
    this.pump(performance.now());
    this.wake();
  }

  // ---------- Layout ----------

  resize() {
    const host = this.cv.parentElement || this.cv;
    const r = host.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (W === this.W && H === this.H && this.cv.width === Math.round(W * this.dpr)) return;
    this.W = W; this.H = H;
    this.cv.width = Math.round(W * this.dpr);
    this.cv.height = Math.round(H * this.dpr);
    this.cv.style.width = W + 'px';
    this.cv.style.height = H + 'px';
    this.layout(false);
    this.wake();
  }

  layout(tween) {
    const n = this.tubes.length;
    if (!n || !this.W) return;
    const padX = this.o.padX ?? 14;
    const padY = this.o.padY ?? 6;
    let best = null;
    for (let r = 1; r <= Math.min(4, n); r++) {
      const rows = [];
      let idx = 0;
      for (let k = 0; k < r; k++) {
        const cnt = Math.ceil((n - idx) / (r - k));
        rows.push([...Array(cnt).keys()].map((j) => idx + j));
        idx += cnt;
      }
      const per = Math.max(...rows.map((x) => x.length));
      const wW = (this.W - 2 * padX) / (per + GAP * (per - 1));
      let hc = 0;
      for (const row of rows) {
        const cap = Math.max(...row.map((i) => this.tubes[i].cap));
        hc += TOP_ROOM + tubeHeight(cap) + (this.o.shelf ? SHELF : 0.05);
      }
      hc += ROW_GAP * (rows.length - 1);
      const wH = (this.H - 2 * padY) / hc;
      const w = Math.min(wW, wH, this.o.maxW);
      if (!best || w > best.w * 1.04) best = { w, rows, hc };
    }
    const w = Math.max(10, best.w);
    this.w = w;
    const used = best.hc * w;
    let y = padY + Math.max(0, (this.H - 2 * padY - used) * (this.o.vAlign ?? 0.42));
    const now = performance.now();
    this.rows = [];
    for (const row of best.rows) {
      const cap = Math.max(...row.map((i) => this.tubes[i].cap));
      y += TOP_ROOM * w;
      const base = y + tubeHeight(cap) * w;
      const k = row.length;
      const rowW = k * w + (k - 1) * GAP * w;
      const x0 = (this.W - rowW) / 2 + w / 2;
      row.forEach((i, j) => {
        const t = this.tubes[i];
        const nx = x0 + j * w * (1 + GAP);
        if (tween && t.x) { t.fromX = this.posX(t, now); t.fromBase = this.posBase(t, now); }
        else { t.fromX = nx; t.fromBase = base; }
        t.x = nx; t.base = base;
      });
      this.rows.push({ y0: y - TOP_ROOM * w, base, x0: x0 - w / 2, x1: x0 + rowW - w / 2, items: row });
      y = base + (this.o.shelf ? SHELF : 0.05) * w + ROW_GAP * w;
    }
    this.layoutT0 = tween ? now : -1;
  }

  layoutProgress(now) {
    if (this.layoutT0 < 0) return 1;
    const p = clamp((now - this.layoutT0) / 380, 0, 1);
    if (p >= 1) this.layoutT0 = -1;
    return inOut(p);
  }

  posX(t, now) { return lerp(t.fromX, t.x, this.layoutProgress(now)); }
  posBase(t, now) { return lerp(t.fromBase, t.base, this.layoutProgress(now)); }

  /** Oberkante (Rand) eines ruhenden Glases inkl. Anheben. */
  restTop(t, now) {
    return this.posBase(t, now) - tubeHeight(t.cap) * this.w - t.lift;
  }

  /** Mittelpunkt eines Glases in Client-Koordinaten (für Tests und Hinweise). */
  tubeCenter(i) {
    const t = this.tubes[i];
    if (!t) return null;
    const r = this.cv.getBoundingClientRect();
    const now = performance.now();
    const h = tubeHeight(t.cap) * this.w;
    return { x: r.left + this.posX(t, now), y: r.top + this.posBase(t, now) - h * 0.45 };
  }

  hitTest(x, y) {
    const now = performance.now();
    const w = this.w;
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.tubes.length; i++) {
      const t = this.tubes[i];
      const cx = this.posX(t, now);
      const base = this.posBase(t, now);
      const top = base - tubeHeight(t.cap) * w - TOP_ROOM * w;
      const half = (w * (1 + GAP)) / 2;
      if (x >= cx - half && x <= cx + half && y >= top && y <= base + (SHELF + ROW_GAP / 2) * w) {
        const d = Math.abs(x - cx);
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }

  onPointer(e) {
    if (e.button && e.button !== 0) return;
    const r = this.cv.getBoundingClientRect();
    const i = this.hitTest(e.clientX - r.left, e.clientY - r.top);
    this.o.onTap && this.o.onTap(i);
  }

  // ---------- Animation ----------

  wake() {
    if (this.raf || this.dead) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  speed() {
    return this.o.speed ? this.o.speed() : 1;
  }

  pump(now) {
    // Wartende Züge starten, sobald beide Gläser frei sind (Reihenfolge je Glas bleibt erhalten)
    const blocked = new Set();
    for (const a of this.anims) { blocked.add(a.from); blocked.add(a.to); }
    const rest = [];
    for (const a of this.queue) {
      if (blocked.has(a.from) || blocked.has(a.to)) {
        rest.push(a);
        blocked.add(a.from); blocked.add(a.to);
        continue;
      }
      this.startAnim(a, now);
      blocked.add(a.from); blocked.add(a.to);
    }
    this.queue = rest;
  }

  startAnim(a, now) {
    const src = this.tubes[a.from], dst = this.tubes[a.to];
    const sp = this.speed();
    a.t0 = now;
    a.dMove = 260 * sp;
    a.dPour = Math.max(260, 150 * a.n + 120) * sp;
    a.dBack = 250 * sp;
    a.srcSegs = cloneSegs(src.segs);
    a.dstSegs = cloneSegs(dst.segs);
    a.V0 = amountOf(src.segs);
    a.Vd0 = amountOf(dst.segs);
    const sx = this.posX(src, now), dx = this.posX(dst, now);
    a.dir = sx < dx - 1 ? 1 : sx > dx + 1 ? -1 : (dx < this.W / 2 ? -1 : 1);
    a.startLift = src.lift;
    a.poured = 0;
    a.splashAcc = 0;
    src.busy++; dst.busy++;
    this.anims.push(a);
    if (this.o.sound) this.o.sound.pour((a.dMove) / 1000, a.dPour / 1000, a.n, a.Vd0 / dst.cap);
  }

  /** Position der Ausgusskante im Ruhezustand (Weltkoordinaten). */
  lipRest(t, dir, now, lift) {
    const w = this.w;
    const top = this.posBase(t, now) - tubeHeight(t.cap) * w - lift;
    return { x: this.posX(t, now) + dir * (G.iw / 2) * w, y: top };
  }

  lipPour(a, now) {
    const dst = this.tubes[a.to];
    const w = this.w;
    const top = this.posBase(dst, now) - tubeHeight(dst.cap) * w - dst.lift;
    return { x: this.posX(dst, now) - a.dir * w * 0.13, y: top - w * 0.55 };
  }

  stepAnim(a, now) {
    const src = this.tubes[a.from], dst = this.tubes[a.to];
    const g = geom(src.cap);
    const t = now - a.t0;
    const thetaAt = (V) => g.theta(V);
    let lip, th, phase, p;
    const restA = this.lipRest(src, a.dir, now, a.startLift);
    const pourP = this.lipPour(a, now);
    if (t < a.dMove) {
      phase = 0; p = inOut(t / a.dMove);
      lip = { x: lerp(restA.x, pourP.x, p), y: lerp(restA.y, pourP.y, p) - Math.sin(p * Math.PI) * this.w * 0.35 };
      th = lerp(0, thetaAt(a.V0), p);
    } else if (t < a.dMove + a.dPour) {
      phase = 1; p = (t - a.dMove) / a.dPour;
      const q = p < 0.08 ? 0 : clamp((p - 0.08) / 0.84, 0, 1);
      a.poured = a.n * (q * q * (3 - 2 * q) * 0.35 + q * 0.65);
      lip = pourP;
      th = thetaAt(a.V0 - a.poured);
    } else if (t < a.dMove + a.dPour + a.dBack) {
      phase = 2; p = inOut((t - a.dMove - a.dPour) / a.dBack);
      a.poured = a.n;
      const restB = this.lipRest(src, a.dir, now, 0);
      lip = { x: lerp(pourP.x, restB.x, p), y: lerp(pourP.y, restB.y, p) };
      th = lerp(thetaAt(a.V0 - a.n), 0, p);
    } else {
      return false;
    }
    // Flüssigkeiten anpassen
    src.segs = cloneSegs(a.srcSegs);
    if (a.poured > 0) {
      let rem = a.poured;
      while (rem > 1e-9 && src.segs.length) {
        const top = src.segs[src.segs.length - 1];
        const take = Math.min(top.a, rem);
        top.a -= take; rem -= take;
        if (top.a <= 1e-9) src.segs.pop();
      }
      dst.segs = cloneSegs(a.dstSegs);
      const dt = dst.segs[dst.segs.length - 1];
      if (dt && dt.c === a.color) dt.a += a.poured;
      else dst.segs.push({ c: a.color, a: a.poured });
    }
    src.pose = { lipX: lip.x, lipY: lip.y, th: a.dir * th, dir: a.dir };
    a.phase = phase;
    a.p = p;
    a.lip = lip;
    return true;
  }

  finishAnim(a, instant) {
    const src = this.tubes[a.from], dst = this.tubes[a.to];
    if (!src || !dst) return;
    if (a.t0 < 0) {
      // noch nicht gestartet
      a.srcSegs = cloneSegs(src.segs);
      a.dstSegs = cloneSegs(dst.segs);
    }
    // Endzustand exakt herstellen
    src.segs = cloneSegs(a.srcSegs);
    let rem = a.n;
    while (rem > 1e-9 && src.segs.length) {
      const top = src.segs[src.segs.length - 1];
      const take = Math.min(top.a, rem);
      top.a -= take; rem -= take;
      if (top.a <= 1e-9) src.segs.pop();
    }
    for (const s of src.segs) s.a = Math.round(s.a);
    dst.segs = cloneSegs(a.dstSegs);
    const dt = dst.segs[dst.segs.length - 1];
    if (dt && dt.c === a.color) dt.a += a.n;
    else dst.segs.push({ c: a.color, a: a.n });
    for (const s of dst.segs) s.a = Math.round(s.a);
    src.pose = null;
    if (a.t0 >= 0) { src.busy = Math.max(0, src.busy - 1); dst.busy = Math.max(0, dst.busy - 1); }
    const now = performance.now();
    if (src.visH !== a.srcH) {
      src.visH = a.srcH;
      if (!instant) {
        src.revealT0 = now;
        src.revealIdx = a.srcH;
        this.burstAt(a.from, a.srcH + 0.5, '#ffffff', 7);
        this.o.onReveal && this.o.onReveal(a.from);
      }
    }
    for (const [t, i] of [[dst, a.to], [src, a.from]]) {
      if (!t.corked && this.isComplete(t)) {
        t.corked = true;
        this.corkCount++;
        if (!instant) {
          t.corkT0 = now + 60;
          this.o.onCork && this.o.onCork(i, this.corkCount);
          setTimeout(() => this.burstAt(i, -0.1, '#fff6c8', 12, true), 220);
        }
      } else if (t.corked && !this.isComplete(t)) {
        t.corked = false;
        this.corkCount--;
      }
    }
  }

  /** Funken an einem Glas; unit = Höhe in Schichten (negativ = über dem Rand). */
  burstAt(i, unit, color, count = 8, big = false) {
    const t = this.tubes[i];
    if (!t) return;
    const now = performance.now();
    const w = this.w;
    const top = this.restTop(t, now);
    const yb = top + (tubeHeight(t.cap) - G.wall) * w;
    const y = unit < 0 ? top - w * 0.1 : yb - unit * G.lh * w;
    const x = this.posX(t, now);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + Math.random() * 0.5;
      const sp = (big ? 2.4 : 1.4) * w * (0.6 + Math.random() * 0.6);
      this.parts.push({
        k: 's', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (big ? w * 1.2 : w * 0.3),
        r: w * (big ? 0.13 : 0.09) * (0.7 + Math.random() * 0.6), t0: now, life: 650 + Math.random() * 350,
        color: k % 3 === 0 ? '#ffd76a' : color,
      });
    }
    this.wake();
  }

  loop(now) {
    this.raf = 0;
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let active = false;

    // Anheben (Feder)
    for (let i = 0; i < this.tubes.length; i++) {
      const t = this.tubes[i];
      const target = i === this.selected && !t.pose ? LIFT * this.w : 0;
      const k = 520, c = 30;
      t.liftV += (k * (target - t.lift) - c * t.liftV) * dt;
      t.lift += t.liftV * dt;
      if (Math.abs(target - t.lift) > 0.2 || Math.abs(t.liftV) > 2) active = true;
      else { t.lift = target; t.liftV = 0; }
      if (t.shakeT0 >= 0) { if (now - t.shakeT0 > 420) t.shakeT0 = -1; else active = true; }
      if (t.corkT0 >= 0) { if (now - t.corkT0 > 700) t.corkT0 = -1; else active = true; }
      if (t.revealT0 >= 0) { if (now - t.revealT0 > 600) t.revealT0 = -1; else active = true; }
      if (t.appearT0 >= 0) { if (now - t.appearT0 > 520) t.appearT0 = -1; else active = true; }
    }
    if (this.layoutT0 >= 0) active = true;

    // Giess-Animationen
    this.pump(now);
    const still = [];
    for (const a of this.anims) {
      if (this.stepAnim(a, now)) { still.push(a); this.spawnSplash(a, now, dt); }
      else this.finishAnim(a, false);
    }
    this.anims = still;
    if (this.queue.length) this.pump(now);
    if (this.anims.length || this.queue.length) active = true;

    // Partikel
    if (this.parts.length) {
      const g = this.w * 6;
      this.parts = this.parts.filter((p) => now - p.t0 < p.life);
      for (const p of this.parts) {
        p.vy += (p.k === 'd' ? g * 2.2 : g * 0.6) * dt;
        p.vx *= 1 - 1.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (this.parts.length) active = true;
    }
    if (this.hint) active = true;

    this.draw(now);

    if (this.idle && this.idleWaiters.length) {
      const ws = this.idleWaiters; this.idleWaiters = [];
      ws.forEach((r) => r());
    }
    if (this.idle && this.wasBusy) {
      this.wasBusy = false;
      this.o.onIdle && this.o.onIdle();
    }
    if (!this.idle) this.wasBusy = true;
    if (active) this.raf = requestAnimationFrame(this.loop);
  }

  spawnSplash(a, now, dt) {
    if (a.phase !== 1 || a.p < 0.1 || a.p > 0.92) return;
    a.splashAcc += dt;
    if (a.splashAcc < 0.045) return;
    a.splashAcc = 0;
    const dst = this.tubes[a.to];
    const w = this.w;
    const top = this.restTop(dst, now);
    const yb = top + (tubeHeight(dst.cap) - G.wall) * w;
    const surf = yb - amountOf(dst.segs) * G.lh * w;
    const col = this.o.colorOf(a.color).color;
    for (let k = 0; k < 2; k++) {
      this.parts.push({
        k: 'd', x: a.lip.x + (Math.random() - 0.5) * w * 0.2, y: surf - 1,
        vx: (Math.random() - 0.5) * w * 2.2, vy: -w * (1.2 + Math.random() * 1.2),
        r: w * (0.035 + Math.random() * 0.03), t0: now, life: 260 + Math.random() * 120, color: col,
        clipX: this.posX(dst, now), clipW: G.iw * w * 0.46,
      });
    }
  }

  // ---------- Zeichnen ----------

  draw(now) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (!this.tubes.length) return;
    const w = this.w;

    // Regalbretter
    if (this.o.shelf) {
      for (const row of this.rows) this.drawShelf(row, now);
    }
    // Schatten der ruhenden Gläser
    for (const t of this.tubes) {
      if (t.pose) continue;
      const x = this.posX(t, now) + this.shakeX(t, now);
      const base = this.posBase(t, now);
      const k = clamp(1 - t.lift / (w * 1.2), 0.3, 1) * this.appearScale(t, now);
      ctx.beginPath();
      ctx.ellipse(x, base + w * 0.02, w * 0.46 * k, w * 0.09 * k, 0, 0, TAU);
      ctx.fillStyle = `rgba(90, 64, 40, ${0.16 * k})`;
      ctx.fill();
    }
    // Ruhende Gläser
    for (let i = 0; i < this.tubes.length; i++) {
      const t = this.tubes[i];
      if (!t.pose) this.drawUpright(t, i, now);
    }
    // Ströme und fliegende Gläser
    for (const a of this.anims) this.drawStream(a, now);
    for (let i = 0; i < this.tubes.length; i++) {
      const t = this.tubes[i];
      if (t.pose) this.drawTilted(t, now);
    }
    // Partikel
    for (const p of this.parts) {
      const age = (now - p.t0) / p.life;
      if (p.k === 's') {
        drawSparkle(ctx, p.x, p.y, p.r * (1 - age * 0.5), p.color, clamp(1.2 - age * 1.2, 0, 1));
      } else {
        if (p.clipX !== undefined && Math.abs(p.x - p.clipX) > p.clipW) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clamp(1.3 - age, 0, 1);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (this.hint) this.drawHint(now);
  }

  drawShelf(row, now) {
    const ctx = this.ctx;
    const w = this.w;
    const m = Math.min(10, w * 0.25);
    const x0 = Math.max(m, row.x0 - w * 0.5), x1 = Math.min(this.W - m, row.x1 + w * 0.5);
    const y = row.base - w * 0.01;
    const h = SHELF * w * 0.62;
    // Schatten
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, y + h + w * 0.06, (x1 - x0) / 2, w * 0.1, 0, 0, TAU);
    ctx.fillStyle = 'rgba(110, 80, 50, 0.08)';
    ctx.fill();
    roundRect(ctx, x0, y, x1 - x0, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(this.o.shelfColor, 0.45));
    g.addColorStop(0.5, this.o.shelfColor);
    g.addColorStop(1, shade(this.o.shelfColor, -0.08));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(130, 100, 70, 0.18)';
    ctx.stroke();
  }

  shakeX(t, now) {
    if (t.shakeT0 < 0) return 0;
    const p = (now - t.shakeT0) / 420;
    return Math.sin(p * Math.PI * 7) * (1 - p) * this.w * 0.14;
  }

  appearScale(t, now) {
    if (t.appearT0 < 0) return 1;
    const p = (now - t.appearT0) / 520;
    if (p <= 0) return 0;
    return clamp(outBack(clamp(p, 0, 1)), 0, 1.2);
  }

  drawUpright(t, i, now) {
    const ctx = this.ctx;
    const w = this.w;
    const sc = this.appearScale(t, now);
    if (sc <= 0) return;
    const x = this.posX(t, now) + this.shakeX(t, now);
    const base = this.posBase(t, now);
    const H = tubeHeight(t.cap) * w;
    const top = base - H - t.lift;
    const spr = glassSprites(w, t.cap, this.dpr);
    ctx.save();
    ctx.translate(x, top);
    if (sc !== 1) {
      ctx.translate(0, H);
      ctx.scale(sc, sc);
      ctx.translate(0, -H);
      ctx.globalAlpha = clamp(sc, 0, 1);
    }
    if (i === this.selected && t.lift > 1) {
      // sanfter Schein unter dem gewählten Glas
      ctx.save();
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = w * 0.5;
      ctx.drawImage(spr.back, spr.ox, spr.oy, spr.sw, spr.sh);
      ctx.restore();
    } else {
      ctx.drawImage(spr.back, spr.ox, spr.oy, spr.sw, spr.sh);
    }
    this.drawLiquidUpright(t, now);
    ctx.drawImage(spr.front, spr.ox, spr.oy, spr.sw, spr.sh);
    if (t.corked) {
      let dy = 0, al = 1;
      if (t.corkT0 >= 0) {
        const p = clamp((now - t.corkT0) / 520, 0, 1);
        if (now < t.corkT0) { al = 0; } else { dy = -(1 - outBounce(p)) * w * 1.3; al = clamp(p * 4, 0, 1); }
      }
      if (al > 0) {
        ctx.globalAlpha *= al;
        ctx.translate(0, dy);
        drawCork(ctx, w);
      }
    }
    ctx.restore();
  }

  liquidStyle(c) {
    const info = this.o.colorOf(c);
    return info;
  }

  drawLiquidUpright(t, now) {
    const ctx = this.ctx;
    const w = this.w;
    const iw = G.iw * w;
    const H = tubeHeight(t.cap) * w;
    const yb = H - G.wall * w;
    const lh = G.lh * w;
    if (!t.segs.length) return;
    ctx.save();
    cavityPath(ctx, w, t.cap);
    ctx.clip();
    let cum = 0;
    const hiddenCol = this.o.hiddenColor || '#5d6377';
    const symbols = this.o.symbols && this.o.symbols();
    for (let s = 0; s < t.segs.length; s++) {
      const seg = t.segs[s];
      const y1 = yb - cum * lh;
      const y0 = yb - (cum + seg.a) * lh;
      const info = this.liquidStyle(seg.c);
      // verdeckte Einheiten innerhalb dieses Abschnitts?
      const hidUnits = Math.max(0, Math.min(seg.a, t.visH - cum));
      ctx.fillStyle = info.color;
      ctx.fillRect(-iw / 2 - 1, y0, iw + 2, y1 - y0 + (s === 0 ? w : 0.6));
      if (hidUnits > 0) {
        ctx.fillStyle = hiddenCol;
        ctx.fillRect(-iw / 2 - 1, yb - (cum + hidUnits) * lh, iw + 2, hidUnits * lh + (s === 0 ? w : 0.6));
      }
      cum += seg.a;
    }
    // Aufdecken: verdeckte Farbe blendet aus
    if (t.revealT0 >= 0 && t.revealIdx >= 0) {
      const p = clamp((now - t.revealT0) / 600, 0, 1);
      const yy = yb - (t.revealIdx + 1) * lh;
      ctx.globalAlpha = 1 - outCubic(p);
      ctx.fillStyle = hiddenCol;
      ctx.fillRect(-iw / 2 - 1, yy, iw + 2, lh + (t.revealIdx === 0 ? w : 0.6));
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillRect(-iw / 2 - 1, yy, iw + 2, lh);
      ctx.globalAlpha = 1;
    }
    // Glanz/Schattierung über der ganzen Flüssigkeit
    const total = cum;
    const yTop = yb - total * lh;
    const shadeG = ctx.createLinearGradient(-iw / 2, 0, iw / 2, 0);
    shadeG.addColorStop(0, 'rgba(0,0,0,0.13)');
    shadeG.addColorStop(0.22, 'rgba(255,255,255,0.16)');
    shadeG.addColorStop(0.55, 'rgba(255,255,255,0)');
    shadeG.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = shadeG;
    ctx.fillRect(-iw / 2 - 1, yTop, iw + 2, yb - yTop + w);
    // Trennlinien zwischen Farben
    cum = 0;
    for (let s = 0; s < t.segs.length - 1; s++) {
      cum += t.segs[s].a;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(-iw / 2, yb - cum * lh - 0.75, iw, 1.5);
    }
    // Oberfläche (Meniskus)
    const topInfo = this.liquidStyle(t.segs[t.segs.length - 1].c);
    const topHidden = t.visH >= total - 0.001 && total > 0;
    ctx.fillStyle = shade(topHidden ? hiddenCol : topInfo.color, 0.32);
    ctx.beginPath();
    ctx.ellipse(0, yTop + 0.5, iw / 2, Math.max(1.2, lh * 0.09), 0, 0, TAU);
    ctx.fill();
    // Symbole und Fragezeichen pro ganzer Schicht
    cum = 0;
    for (const seg of t.segs) {
      const info = this.liquidStyle(seg.c);
      for (let u = Math.ceil(cum - 1e-6); u + 1 <= cum + seg.a + 1e-6; u++) {
        const cy = yb - (u + 0.5) * lh + (u === 0 ? -lh * 0.06 : 0);
        const hidden = u < t.visH;
        const revealing = t.revealT0 >= 0 && u === t.revealIdx;
        if (hidden || revealing) {
          const p = revealing ? clamp((now - t.revealT0) / 600, 0, 1) : 0;
          if (p < 1) {
            ctx.save();
            ctx.translate(0, cy);
            const sc = revealing ? 1 + p * 0.8 : 1;
            ctx.scale(sc, sc);
            ctx.globalAlpha = 1 - p;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = `800 ${Math.round(lh * 0.62)}px ui-rounded, -apple-system, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, lh * 0.04);
            ctx.restore();
          }
          if (hidden) continue;
        }
        if (symbols && info.symbol) {
          ctx.save();
          ctx.translate(0, cy);
          drawSymbol(ctx, info.symbol, Math.min(iw, lh) * 0.3);
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.fill();
          ctx.lineWidth = Math.max(1, w * 0.025);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.stroke();
          ctx.restore();
        }
      }
      cum += seg.a;
    }
    ctx.restore();
  }

  drawTilted(t, now) {
    const ctx = this.ctx;
    const w = this.w;
    const pose = t.pose;
    const spr = glassSprites(w, t.cap, this.dpr);
    const g = geom(t.cap);
    const lipLocal = { x: pose.dir * (G.iw / 2) * w, y: 0 };
    const th = pose.th;
    const cos = Math.cos(th), sin = Math.sin(th);
    // Weltposition = lip + R(th) * (p - lipLocal)
    ctx.save();
    ctx.translate(pose.lipX, pose.lipY);
    ctx.rotate(th);
    ctx.translate(-lipLocal.x, -lipLocal.y);
    // Schatten der Flasche selbst weglassen; Rückseite
    ctx.drawImage(spr.back, spr.ox, spr.oy, spr.sw, spr.sh);
    if (t.segs.length) {
      ctx.save();
      cavityPath(ctx, w, t.cap);
      ctx.clip();
      // in Weltkoordinaten zeichnen (Flüssigkeit bleibt waagrecht)
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const offY = pose.lipY - (lipLocal.x * sin + lipLocal.y * cos);
      const big = tubeHeight(t.cap) * w * 2.5;
      let cum = 0;
      let prevY = pose.lipY + big;
      const levels = [];
      for (const seg of t.segs) { cum += seg.a; levels.push(cum); }
      const absTh = Math.abs(th);
      for (let s = 0; s < t.segs.length; s++) {
        const Y = g.levelY(absTh, levels[s]) * w + offY;
        const seg = t.segs[s];
        const lower = s === 0 ? pose.lipY + big : prevY;
        const unitStart = s === 0 ? 0 : levels[s - 1];
        const hidden = unitStart < t.visH - 1e-6;
        ctx.fillStyle = hidden ? (this.o.hiddenColor || '#5d6377') : this.liquidStyle(seg.c).color;
        ctx.fillRect(pose.lipX - big, Y, big * 2, lower - Y + 0.6);
        if (s > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(pose.lipX - big, lower - 0.75, big * 2, 1.5);
        }
        prevY = Y;
      }
      // Oberfläche
      const topC = this.liquidStyle(t.segs[t.segs.length - 1].c).color;
      ctx.fillStyle = shade(topC, 0.3);
      ctx.fillRect(pose.lipX - big, prevY - 0.5, big * 2, Math.max(1.5, w * 0.06));
      ctx.restore();
    }
    ctx.drawImage(spr.front, spr.ox, spr.oy, spr.sw, spr.sh);
    ctx.restore();
  }

  drawStream(a, now) {
    if (a.phase !== 1) return;
    const ctx = this.ctx;
    const w = this.w;
    const dst = this.tubes[a.to];
    const col = this.liquidStyle(a.color).color;
    const top = this.restTop(dst, now);
    const yb = top + (tubeHeight(dst.cap) - G.wall) * w;
    const surf = yb - amountOf(dst.segs) * G.lh * w;
    const p = a.p;
    const fall = surf - a.lip.y;
    // Kopf fällt am Anfang, Schwanz am Ende
    const head = a.lip.y + fall * clamp(p / 0.1, 0, 1);
    const tail = a.lip.y + fall * clamp((p - 0.9) / 0.1, 0, 1);
    if (head - tail < 1) return;
    const sw = G.iw * w * (0.26 + 0.04 * Math.sin(now / 45));
    const x = a.lip.x + a.dir * w * 0.02;
    ctx.save();
    roundRect(ctx, x - sw / 2, tail, sw, head - tail, sw / 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - sw * 0.22, tail + sw * 0.3, sw * 0.16, Math.max(0, head - tail - sw * 0.6));
    // Aufprall
    if (p > 0.08 && p < 0.95) {
      ctx.beginPath();
      ctx.ellipse(x, surf, sw * 0.9, sw * 0.32, 0, 0, TAU);
      ctx.fillStyle = shade(col, 0.25);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHint(now) {
    const ctx = this.ctx;
    const h = this.hint;
    const w = this.w;
    const t = (now - this.hintT0) / 1000;
    const draw = (i, k, filled) => {
      const tube = this.tubes[i];
      if (!tube) return;
      const x = this.posX(tube, now);
      const top = this.restTop(tube, now);
      const bob = Math.sin(t * 5 + k) * w * 0.12;
      const y = top - w * 0.35 + bob;
      const s = w * 0.34;
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 1.15);
      ctx.lineTo(s * 0.55, -s * 1.15);
      ctx.lineTo(s * 0.55, -s * 0.45);
      ctx.lineTo(s * 1.0, -s * 0.45);
      ctx.lineTo(0, s * 0.45);
      ctx.lineTo(-s * 1.0, -s * 0.45);
      ctx.lineTo(-s * 0.55, -s * 0.45);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, w * 0.07);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = filled ? (this.o.accent || '#2bb3c0') : '#ffffff';
      ctx.fill();
      if (!filled) {
        ctx.lineWidth = Math.max(1.5, w * 0.05);
        ctx.strokeStyle = this.o.accent || '#2bb3c0';
        ctx.stroke();
      }
      ctx.restore();
    };
    if (h.from >= 0 && (this.selected !== h.from)) draw(h.from, 0, true);
    if (h.to >= 0 && (this.selected === h.from || h.from < 0)) draw(h.to, 1.5, true);
    else if (h.to >= 0) draw(h.to, 1.5, false);
  }
}
