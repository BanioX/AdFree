// Stapel-Sortieren – Spielfeld (DOM). Stapel und Teile sind absolut positionierte Elemente,
// die das Spiel über ein «view»-Objekt selbst gestaltet (Röhre+Kugel, Schraube+Mutter, Spule+Wolle).
//
//   const board = createBoard(host, view, { onTap(i) {} });
//   board.set({ cap, stacks }, { hidden });       // aufbauen
//   board.lift(i, k); board.drop(i);               // Auswahl
//   await board.move(from, to, count, rec);        // Zug animieren
//   await board.undo(rec);                         // Rückgängig animieren
//
// view = {
//   aspect: 1,                     // Breite / Höhe eines Teils
//   step: 1,                       // Abstand der Teile übereinander (in Teil-Höhen)
//   padTop: .5, padBottom: .3,     // Rand im Stapel oben/unten (in Teil-Höhen)
//   side: .12,                     // seitlicher Rand im Stapel (in Teil-Breiten)
//   liftGap: .35,                  // Abstand angehobener Teile über dem Stapel (in Teil-Höhen)
//   liftTop?: -.6,                 // oder: Lage des obersten angehobenen Teils relativ zur Stapel-Oberkante
//   maxPiece: 52,                  // maximale Teil-Höhe in px
//   gapX: .35, gapY: .5,           // Abstände zwischen Stapeln (in Teil-Höhen)
//   makeStack(index) → Element, makePiece(color, { hidden }) → Element,
//   reveal?(el), complete?(stackEl, color, board, index, fx) – fx=false: ohne Effekte (Aufbau, Vorschau),
//   clear?(pieceEls, color, stackIndex, board) → Promise,
//   travel?(el, on)                // Klasse/Effekt während des Flugs (z.B. Drehen der Mutter)
// }

import { h } from '../../shared/ui.js';

const EASE = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  in: (t) => t * t,
  back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// ---------- kleine Tween-Maschine (ein rAF-Loop, schläft ohne Bewegung) ----------

const active = new Set();
let raf = 0;

function write(p) {
  p.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) rotate(${p.r.toFixed(2)}deg) scale(${p.sx.toFixed(3)}, ${p.sy.toFixed(3)})`;
}

function frame(now) {
  raf = 0;
  for (const p of [...active]) {
    let seg = p.segs[p.si];
    let t = seg.dur ? (now - p.t0) / seg.dur : 1;
    while (t >= 1) {
      set(p, seg, 1, 1);
      if (seg.end) seg.end(p);
      p.si++;
      if (p.si >= p.segs.length) break;
      p.t0 += seg.dur;
      p.from = snap(p);
      seg = p.segs[p.si];
      if (seg.start) seg.start(p);
      t = seg.dur ? (now - p.t0) / seg.dur : 1;
    }
    if (p.si >= p.segs.length) {
      active.delete(p);
      write(p);
      const r = p.resolve; p.resolve = null;
      if (r) r(true);
      continue;
    }
    set(p, seg, (EASE[seg.ease || 'out'])(Math.max(0, t)), Math.max(0, t));
    write(p);
  }
  if (active.size) raf = requestAnimationFrame(frame);
}

function snap(p) { return { x: p.x, y: p.y, r: p.r, sx: p.sx, sy: p.sy }; }

function set(p, seg, e, t) {
  const f = p.from;
  p.x = f.x + ((seg.x ?? f.x) - f.x) * e;
  p.y = f.y + ((seg.y ?? f.y) - f.y) * e - (seg.arc ? Math.sin(Math.PI * t) * seg.arc : 0);
  p.r = f.r + ((seg.r ?? f.r) - f.r) * e;
  p.sx = f.sx + ((seg.sx ?? f.sx) - f.sx) * e;
  p.sy = f.sy + ((seg.sy ?? f.sy) - f.sy) * e;
}

/** Startet eine Bewegung (unterbricht eine laufende). Promise: true = fertig, false = unterbrochen. */
function tween(p, segs) {
  if (p.resolve) { const r = p.resolve; p.resolve = null; r(false); }
  p.segs = segs.filter(Boolean);
  p.si = 0;
  p.t0 = performance.now();
  p.from = snap(p);
  if (p.segs[0] && p.segs[0].start) p.segs[0].start(p);
  active.add(p);
  if (!raf) raf = requestAnimationFrame(frame);
  return new Promise((res) => { p.resolve = res; });
}

function place(p, x, y) {
  if (p.resolve) { const r = p.resolve; p.resolve = null; r(false); }
  active.delete(p);
  p.x = x; p.y = y; p.r = 0; p.sx = 1; p.sy = 1;
  write(p);
}

// ---------- Layout ----------

/** Berechnet Reihen und Grössen so, dass alle Stapel möglichst gross in die Fläche passen. */
export function computeLayout(n, cap, W, H, view) {
  const v = { aspect: 1, step: 1, padTop: 0.5, padBottom: 0.3, side: 0.12, liftGap: 0.35, maxPiece: 52, gapX: 0.35, gapY: 0.55, ...view };
  let best = null;
  for (let rows = 1; rows <= 3; rows++) {
    const cols = Math.ceil(n / rows);
    if (rows > 1 && Math.ceil(n / (rows - 1)) === cols) continue;
    const unitW = v.aspect * (1 + 2 * v.side);            // Stapelbreite pro Teil-Höhe
    const unitH = v.padTop + v.padBottom + (cap - 1) * v.step + 1; // Stapelhöhe pro Teil-Höhe
    const lift = v.liftTop != null ? Math.max(0, -v.liftTop) : v.liftGap + 1; // Platz über dem Stapel
    const phW = W / (cols * unitW + (cols - 1) * v.gapX);
    const phH = H / (rows * (unitH + lift) + (rows - 1) * v.gapY);
    const ph = Math.min(phW, phH, v.maxPiece);
    // Mehr Reihen nur, wenn die Teile damit deutlich grösser werden (eine Reihe wirkt ruhiger)
    if (!best || ph > best.ph * 1.15) best = { rows, cols, ph };
  }
  const ph = Math.floor(best.ph * 10) / 10;
  const pw = ph * v.aspect;
  const m = {
    rows: best.rows, cols: best.cols, ph, pw,
    sw: pw * (1 + 2 * v.side),
    sh: ph * (v.padTop + v.padBottom + (cap - 1) * v.step + 1),
    step: ph * v.step, padT: ph * v.padTop, padB: ph * v.padBottom,
    lift: ph * (v.liftTop != null ? Math.max(0, -v.liftTop) : v.liftGap + 1), liftGap: ph * v.liftGap,
    liftTop: ph * (v.liftTop != null ? v.liftTop : -(v.liftGap + 1)),
    gx: ph * v.gapX, gy: ph * v.gapY,
  };
  // Stapel auf Reihen verteilen (oben eher mehr), zentrieren
  const per = [];
  let left = n;
  for (let r = 0; r < best.rows; r++) { const k = Math.ceil(left / (best.rows - r)); per.push(k); left -= k; }
  const blockH = best.rows * (m.sh + m.lift) + (best.rows - 1) * m.gy;
  const y0 = Math.max(0, (H - blockH) / 2) + m.lift;
  const pos = [];
  for (let r = 0; r < per.length; r++) {
    const k = per[r];
    const rowW = k * m.sw + (k - 1) * m.gx;
    const x0 = (W - rowW) / 2;
    for (let c = 0; c < k; c++) pos.push({ x: x0 + c * (m.sw + m.gx), y: y0 + r * (m.sh + m.lift + m.gy) });
  }
  m.pos = pos;
  return m;
}

// ---------- Spielfeld ----------

export function createBoard(host, view, opts = {}) {
  const stacksLayer = h('div.sb-stacks');
  const piecesLayer = h('div.sb-pieces');
  const frontLayer = h('div.sb-front');
  const fxLayer = h('div.sb-fx');
  const coachRing = h('div.sb-coach');
  fxLayer.append(coachRing);
  host.classList.add('sb-board');
  host.replaceChildren(stacksLayer, piecesLayer, frontLayer, fxLayer);

  let cap = 4;
  let stacks = [];      // [{ el, front, x, y }]
  let pieces = [];      // pro Stapel: [{ el, color, hidden, x, y, r, sx, sy }]
  let lifted = { i: -1, k: 0 };
  let m = null;
  let coachIdx = -1;
  let W = 0, H = 0;

  function slot(i, j) {
    const s = stacks[i];
    return { x: s.x + (m.sw - m.pw) / 2, y: s.y + m.sh - m.padB - j * m.step - m.ph };
  }
  function liftSlot(i, mIdx) { // mIdx 0 = oberstes Teil
    const s = stacks[i];
    return { x: s.x + (m.sw - m.pw) / 2, y: s.y + m.liftTop + mIdx * m.step };
  }

  function makePiece(color, hidden) {
    const el = view.makePiece(color, { hidden });
    el.classList.add('sb-piece');
    if (hidden) el.classList.add('sb-hidden');
    const p = { el, color, hidden: !!hidden, x: 0, y: 0, r: 0, sx: 1, sy: 1, resolve: null };
    piecesLayer.append(el);
    return p;
  }

  function measure() {
    // Layout-Grösse (ohne CSS-Transformationen, z.B. während ein Dialog hereinskaliert)
    W = host.clientWidth; H = host.clientHeight;
  }

  function applyLayout(animate = false) {
    if (!stacks.length) return;
    measure();
    if (W < 10 || H < 10) return;
    m = computeLayout(stacks.length, cap, W, H, view);
    host.style.setProperty('--ph', m.ph + 'px');
    host.style.setProperty('--pw', m.pw + 'px');
    host.style.setProperty('--sw', m.sw + 'px');
    host.style.setProperty('--sh', m.sh + 'px');
    host.style.setProperty('--step', m.step + 'px');
    host.style.setProperty('--padT', m.padT + 'px');
    host.style.setProperty('--padB', m.padB + 'px');
    stacks.forEach((s, i) => {
      s.x = m.pos[i].x; s.y = m.pos[i].y;
      for (const el of [s.el, s.front]) {
        if (!el) continue;
        el.style.width = m.sw + 'px';
        el.style.height = m.sh + 'px';
        if (animate) {
          el.style.transition = 'transform .38s cubic-bezier(.2,.8,.2,1)';
          setTimeout(() => { el.style.transition = ''; }, 420);
        }
        el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      }
    });
    pieces.forEach((col, i) => col.forEach((p, j) => {
      p.el.style.width = m.pw + 'px';
      p.el.style.height = m.ph + 'px';
      const liftedHere = lifted.i === i && j >= col.length - lifted.k;
      const t = liftedHere ? liftSlot(i, col.length - 1 - j) : slot(i, j);
      if (animate) tween(p, [{ x: t.x, y: t.y, dur: 380, ease: 'out' }]);
      else place(p, t.x, t.y);
    }));
    if (coachIdx >= 0) positionCoach(coachIdx);
  }

  function set(state, { hidden } = {}) {
    cap = state.cap;
    lifted = { i: -1, k: 0 };
    stacksLayer.replaceChildren();
    piecesLayer.replaceChildren();
    frontLayer.replaceChildren();
    stacks = state.stacks.map((_, i) => newStack(i));
    pieces = state.stacks.map((col, i) => col.map((c, j) => makePiece(c, hidden && hidden[i] && hidden[i][j])));
    applyLayout(false);
    refreshDone(state, false);
  }

  function refreshDone(state, fx = true) {
    if (!opts.lockComplete) return;
    state.stacks.forEach((col, i) => {
      const done = col.length === state.cap && col.every((c) => c === col[0]);
      const was = stacks[i].el.classList.contains('done');
      if (stacks[i].front) stacks[i].front.classList.toggle('done', done);
      if (done && !was) {
        stacks[i].el.classList.add('done');
        if (!fx) stacks[i].el.classList.add('sb-instant');
        if (view.complete) view.complete(stacks[i].el, col[0], api, i, fx);
        if (!fx) requestAnimationFrame(() => requestAnimationFrame(() => stacks[i] && stacks[i].el.classList.remove('sb-instant')));
      } else if (!done && was) stacks[i].el.classList.remove('done');
    });
  }

  function newStack(i) {
    const el = view.makeStack(i);
    el.classList.add('sb-stack');
    stacksLayer.append(el);
    let front = null;
    if (view.makeFront) {
      front = view.makeFront(i);
      front.classList.add('sb-stack-front');
      frontLayer.append(front);
    }
    return { el, front, x: 0, y: 0 };
  }

  function addStack() {
    const i = stacks.length;
    const st = newStack(i);
    const el = st.el;
    el.classList.add('sb-new');
    if (st.front) st.front.classList.add('sb-new');
    stacks.push(st);
    pieces.push([]);
    applyLayout(true);
    setTimeout(() => { el.classList.remove('sb-new'); if (st.front) st.front.classList.remove('sb-new'); }, 500);
  }

  function lift(i, k) {
    if (lifted.i >= 0 && lifted.i !== i) drop();
    const col = pieces[i];
    k = Math.min(k, col.length);
    lifted = { i, k };
    stacks[i].el.classList.add('sel');
    for (let mIdx = 0; mIdx < k; mIdx++) {
      const p = col[col.length - 1 - mIdx];
      const t = liftSlot(i, mIdx);
      p.el.classList.add('lifted');
      if (view.travel) view.travel(p.el, true);
      tween(p, [{ x: t.x, y: t.y, dur: 190 + mIdx * 25, ease: 'back' }]).then((ok) => { if (ok && view.travel && lifted.i !== i) view.travel(p.el, false); });
    }
  }

  function drop() {
    if (lifted.i < 0) return;
    const { i, k } = lifted;
    lifted = { i: -1, k: 0 };
    stacks[i].el.classList.remove('sel');
    const col = pieces[i];
    for (let mIdx = 0; mIdx < k; mIdx++) {
      const j = col.length - 1 - mIdx;
      const p = col[j];
      if (!p) continue;
      const t = slot(i, j);
      p.el.classList.remove('lifted');
      tween(p, [{ x: t.x, y: t.y, dur: 200, ease: 'out' }, { sy: 0.9, sx: 1.06, dur: 60, ease: 'out' }, { sy: 1, sx: 1, dur: 120, ease: 'out' }])
        .then((ok) => { if (ok && view.travel) view.travel(p.el, false); });
    }
  }

  /** Animiert einen Zug (state wurde bereits verändert). rec: { from, to, count, color, cleared } */
  async function move(rec, { fast = false } = {}) {
    const { from, to, count } = rec;
    const src = pieces[from], dst = pieces[to];
    if (lifted.i === from) {
      // Angehobene Teile, die nicht mitwandern, fallen zurück
      const keep = lifted.k - count;
      stacks[from].el.classList.remove('sel');
      for (let mIdx = count; mIdx < count + keep; mIdx++) {
        const j = src.length - 1 - mIdx;
        const p = src[j];
        if (!p) continue;
        p.el.classList.remove('lifted');
        const t = slot(from, j);
        tween(p, [{ x: t.x, y: t.y, dur: 180, ease: 'out' }]).then((ok) => { if (ok && view.travel) view.travel(p.el, false); });
      }
    } else if (lifted.i >= 0) drop();
    lifted = { i: -1, k: 0 };
    const moving = src.splice(src.length - count, count); // unten → oben
    const base = dst.length;
    dst.push(...moving);
    const sp = fast ? 0.55 : 1;
    const dist = Math.hypot(stacks[to].x - stacks[from].x, stacks[to].y - stacks[from].y);
    const fly = Math.round((240 + Math.min(260, dist * 0.55)) * sp);
    const proms = moving.map((p, idx) => {
      const mIdx = count - 1 - idx;           // 0 = oberstes
      const up = liftSlot(from, mIdx);
      const over = liftSlot(to, mIdx);
      const final = slot(to, base + idx);
      p.el.classList.add('lifted', 'flying');
      if (view.travel) view.travel(p.el, true);
      const segs = [];
      if (Math.abs(p.y - up.y) > 2) segs.push({ x: up.x, y: up.y, dur: Math.round(150 * sp), ease: 'out' });
      segs.push({ x: over.x, y: over.y, dur: fly, ease: 'inOut', arc: Math.min(40, 12 + dist * 0.1) });
      segs.push({ x: final.x, y: final.y, dur: Math.round((150 + (cap - base - idx) * 22) * sp), ease: 'in', end: () => {
        p.el.classList.remove('lifted', 'flying');
        if (view.travel) view.travel(p.el, false);
        if (idx === count - 1 && opts.onLand) opts.onLand(rec);
      } });
      segs.push({ sy: 0.86, sx: 1.08, dur: 70, ease: 'out' });
      segs.push({ sy: 1.04, sx: 0.98, dur: 110, ease: 'out' });
      segs.push({ sy: 1, sx: 1, dur: 120, ease: 'out' });
      return tween(p, segs);
    });
    // Abgeräumter Stapel ist im Zustand sofort leer – Teile hier lösen, damit neue Züge passen.
    const gone = rec.cleared ? dst.splice(0, dst.length) : null;
    await Promise.all(proms);
    if (gone) {
      if (view.clear) await view.clear(gone.map((p) => p.el), rec.color, to, api);
      gone.forEach((p) => { active.delete(p); p.el.remove(); });
    }
  }

  /** Animiert «Rückgängig» (state wurde bereits zurückgesetzt). */
  async function undo(rec) {
    if (lifted.i >= 0) drop();
    if (rec.cleared) {
      const col = pieces[rec.to];
      for (let j = 0; j < cap; j++) {
        const p = makePiece(rec.color, false);
        p.el.style.width = m.pw + 'px';
        p.el.style.height = m.ph + 'px';
        const t = slot(rec.to, j);
        place(p, t.x, t.y);
        p.sx = p.sy = 0.2; write(p);
        tween(p, [{ sx: 1, sy: 1, dur: 260, ease: 'back' }]);
        col.push(p);
      }
    }
    await move({ from: rec.to, to: rec.from, count: rec.count, color: rec.color, cleared: false }, { fast: true });
  }

  function shake(i) {
    const el = stacks[i] && stacks[i].el;
    if (!el) return;
    el.classList.remove('sb-shake');
    void el.offsetWidth;
    el.classList.add('sb-shake');
    for (const p of pieces[i]) {
      const x0 = p.x;
      if (p.el.classList.contains('lifted')) continue;
      tween(p, [{ x: x0 - 5, dur: 60, ease: 'out' }, { x: x0 + 5, dur: 80, ease: 'inOut' }, { x: x0 - 3, dur: 70, ease: 'inOut' }, { x: x0, dur: 70, ease: 'out' }]);
    }
  }

  function flash(i, cls, ms = 2600) {
    const el = stacks[i] && stacks[i].el;
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  function positionCoach(i) {
    const s = stacks[i];
    if (!s || !m) return;
    const pad = Math.max(8, m.ph * 0.25);
    Object.assign(coachRing.style, {
      width: m.sw + pad * 2 + 'px', height: m.sh + m.lift * 0.6 + pad * 2 + 'px',
      transform: `translate3d(${s.x - pad}px, ${s.y - m.lift * 0.6 - pad}px, 0)`,
    });
  }

  function coach(i) {
    coachIdx = i == null ? -1 : i;
    coachRing.classList.toggle('on', coachIdx >= 0);
    if (coachIdx >= 0) positionCoach(coachIdx);
  }

  function reveal(i, j) {
    const col = pieces[i];
    const p = col[j == null ? col.length - 1 : j];
    if (!p || !p.hidden) return false;
    p.hidden = false;
    p.el.classList.remove('sb-hidden');
    p.el.classList.add('revealing');
    setTimeout(() => p.el.classList.remove('revealing'), 520);
    if (view.reveal) view.reveal(p.el);
    return true;
  }

  /** Kleine Funken über einem Stapel (Abschluss-Effekt). */
  function burst(i, colors = ['#ffd84d', '#fff'], n = 12) {
    const s = stacks[i];
    if (!s || !m) return;
    const cx = s.x + m.sw / 2, cy = s.y + m.padT;
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n + Math.random() * 0.4;
      const d = m.ph * (0.9 + Math.random() * 0.9);
      const sz = Math.max(4, m.ph * (0.12 + Math.random() * 0.1));
      const el = h('i.sb-spark');
      Object.assign(el.style, {
        left: cx + 'px', top: cy + 'px', width: sz + 'px', height: sz + 'px', background: colors[k % colors.length],
      });
      el.style.setProperty('--dx', Math.cos(a) * d + 'px');
      el.style.setProperty('--dy', Math.sin(a) * d * 0.8 - m.ph * 0.4 + 'px');
      fxLayer.append(el);
      setTimeout(() => el.remove(), 900);
    }
  }

  function stackAt(cx, cy) {
    if (!m) return -1;
    const r = host.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    let best = -1, bd = Infinity;
    stacks.forEach((s, i) => {
      const x0 = s.x - m.gx / 2, x1 = s.x + m.sw + m.gx / 2;
      const y0 = s.y - m.lift, y1 = s.y + m.sh + m.gy / 2;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { best = i; bd = 0; return; }
      const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
      const d = Math.hypot(dx, dy);
      if (d < bd && d < m.ph * 0.6) { bd = d; best = i; }
    });
    return best;
  }

  /** Mittelpunkt eines Stapels in Bildschirm-Koordinaten (Tests, Effekte). */
  function center(i) {
    const s = stacks[i];
    if (!s || !m) return null;
    const r = host.getBoundingClientRect();
    return { x: r.left + s.x + m.sw / 2, y: r.top + s.y + m.sh * 0.55 };
  }

  function stackRect(i) {
    const s = stacks[i];
    if (!s || !m) return null;
    return { x: s.x, y: s.y, w: m.sw, h: m.sh };
  }

  host.addEventListener('pointerdown', (e) => {
    if (!opts.onTap) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    opts.onTap(stackAt(e.clientX, e.clientY), e);
  });

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    let last = '';
    ro = new ResizeObserver(() => {
      const k = host.clientWidth + 'x' + host.clientHeight;
      if (k === last) return;
      last = k;
      applyLayout(false);
    });
    ro.observe(host);
  }

  const api = {
    set, addStack, lift, drop, move, undo, shake, flash, coach, reveal, refreshDone, stackAt, center, stackRect, burst,
    get metrics() { return m; },
    get lifted() { return lifted; },
    get count() { return stacks.length; },
    stackEl: (i) => stacks[i] && stacks[i].el,
    pieceEls: (i) => (pieces[i] || []).map((p) => p.el),
    fx: fxLayer,
    host,
    idle: () => active.size === 0,
    layout: () => applyLayout(false),
    destroy() { if (ro) ro.disconnect(); for (const col of pieces) for (const p of col) active.delete(p); },
  };
  return api;
}

/**
 * Statisches Mini-Spielfeld (z.B. als Live-Vorschau im Startbildschirm).
 * Gibt ein Element mit fester Grösse zurück.
 */
export function miniBoard(state, view, { width = 260, height = 120, hidden } = {}) {
  const host = h('div.sb-board.sb-mini');
  host.style.width = width + 'px';
  host.style.height = height + 'px';
  const m = computeLayout(state.stacks.length, state.cap, width, height, { ...view, liftGap: 0, gapY: 0.35 });
  m.pos.forEach((p) => { p.y -= m.lift / 2; });
  for (const k of ['ph', 'pw', 'sw', 'sh', 'step']) host.style.setProperty('--' + k, m[k] + 'px');
  host.style.setProperty('--padT', m.padT + 'px');
  host.style.setProperty('--padB', m.padB + 'px');
  const layer = h('div.sb-stacks'), pl = h('div.sb-pieces'), fl = h('div.sb-front');
  host.append(layer, pl, fl);
  state.stacks.forEach((col, i) => {
    const el = view.makeStack(i);
    el.classList.add('sb-stack');
    Object.assign(el.style, { width: m.sw + 'px', height: m.sh + 'px', transform: `translate3d(${m.pos[i].x}px, ${m.pos[i].y}px, 0)` });
    if (col.length === state.cap && col.every((c) => c === col[0])) {
      el.classList.add('done', 'sb-instant');
      if (view.complete) view.complete(el, col[0], null, i, false);
    }
    layer.append(el);
    if (view.makeFront) {
      const f = view.makeFront(i);
      f.classList.add('sb-stack-front');
      if (el.classList.contains('done')) f.classList.add('done');
      Object.assign(f.style, { width: m.sw + 'px', height: m.sh + 'px', transform: el.style.transform });
      fl.append(f);
    }
    col.forEach((c, j) => {
      const hid = hidden && hidden[i] && hidden[i][j];
      const p = view.makePiece(c, { hidden: hid });
      p.classList.add('sb-piece');
      if (hid) p.classList.add('sb-hidden');
      const x = m.pos[i].x + (m.sw - m.pw) / 2;
      const y = m.pos[i].y + m.sh - m.padB - j * m.step - m.ph;
      Object.assign(p.style, { width: m.pw + 'px', height: m.ph + 'px', transform: `translate3d(${x}px, ${y}px, 0)` });
      pl.append(p);
    });
  });
  return host;
}
