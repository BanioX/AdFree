// Puzzle – reine Spiellogik (ohne DOM, testbar mit `node --test`).
//
// Koordinaten: Das Puzzle-Bild ist WORLD_W (=1000) Einheiten breit und WORLD_W / aspect hoch.
// Jedes Teil hat eine Zelle (pw × ph). Positionen (x, y) bezeichnen die MITTE der Zelle.
// Teil i liegt in Spalte i % cols, Zeile floor(i / cols).
//
// Zustand eines Teils (s): 0 = in der Leiste, 1 = lose auf dem Tisch, 2 = fest eingerastet.
// Teile mit gleicher Gruppe (g) hängen zusammen und bewegen sich gemeinsam.
// Drehung r: 0..3 (Vielfache von 90° im Uhrzeigersinn) – nur im Dreh-Modus ≠ 0.

import { makeRng } from '../shared/rng.js';

export const TIERS = [12, 24, 48, 70, 108];
export const WORLD_W = 1000;
export const TRAY = 0, TABLE = 1, PLACED = 2;

// ---------- Raster passend zum Bildformat ----------

const EXACT_MAX_DEV = Math.log(1.45);

/** Wählt Spalten × Zeilen für `count` Teile (exakt, wenn das Format es mit hübschen Teilen erlaubt),
 *  so dass die Teile möglichst quadratisch sind. */
export function gridFor(count, aspect = 0.75) {
  let best = null;
  for (let cols = 2; cols <= 24; cols++) {
    for (let rows = 2; rows <= 24; rows++) {
      const n = cols * rows;
      const pieceAspect = (aspect * rows) / cols; // (W/cols) / (H/rows)
      const dev = Math.abs(Math.log(pieceAspect));
      // Die gewählte Stufe exakt treffen, solange die Teile noch angenehm (≤ 1.45 : 1) bleiben –
      // sonst lieber fast quadratische Teile mit einer Anzahl knapp daneben.
      const exact = n === count && dev <= EXACT_MAX_DEV ? -1 : 0;
      const score = dev + exact + (2.2 * Math.abs(n - count)) / count;
      if (!best || score < best.score - 1e-9) best = { cols, rows, score };
    }
  }
  return { cols: best.cols, rows: best.rows };
}

export function worldSize(aspect) {
  return { W: WORLD_W, H: WORLD_W / aspect };
}

// ---------- Kanten (Nasen und Buchten) ----------

function edgeParams(rng) {
  return {
    s: rng.chance(0.5) ? 1 : -1,     // Richtung der Nase
    t: rng.range(0.088, 0.108),      // Grösse der Nase
    a: rng.range(-0.035, 0.035),     // Schulter links
    b: rng.range(-0.045, 0.045),     // Verschiebung der Nase entlang der Kante
    c: rng.range(-0.03, 0.03),       // Höhe der Nase
    d: rng.range(-0.03, 0.03),       // Neigung
    e: rng.range(-0.035, 0.035),     // Schulter rechts
  };
}

/**
 * Erzeugt alle Innenkanten deterministisch aus dem Seed.
 * h[r][c] (r = 1..rows-1): waagrechte Kante oberhalb von Zeile r, Spalte c.
 * v[r][c] (c = 1..cols-1): senkrechte Kante links von Spalte c, Zeile r.
 */
export function makeEdges(cols, rows, seed) {
  const rng = makeRng((seed >>> 0) ^ 0x9e3779b9);
  const h = [], v = [];
  for (let r = 0; r <= rows; r++) {
    h.push([]);
    for (let c = 0; c < cols; c++) h[r].push(r > 0 && r < rows ? edgeParams(rng) : null);
  }
  for (let r = 0; r < rows; r++) {
    v.push([]);
    for (let c = 0; c <= cols; c++) v[r].push(c > 0 && c < cols ? edgeParams(rng) : null);
  }
  return { h, v };
}

/**
 * Punkte einer Kante im lokalen System: u entlang (0..L), w quer (positiv = Seite, in die die Nase zeigt × s).
 * Die Nase wird mit dem Massstab m (= kleinere Zellseite) gezeichnet, damit sie rund bleibt.
 * Ergebnis: 10 Punkte p0..p9 für drei kubische Bézier-Kurven (p0 C p1 p2 p3 C p4 p5 p6 C p7 p8 p9).
 */
export function edgePoints(e, L, m) {
  const { s, t, a, b, c, d } = e;
  const mid = L / 2 + b * m;
  const K = (du, dv) => [mid + du * m, s * dv * m];
  return [
    [0, 0],
    [0.22 * L, s * a * m],
    K(d + 0.02, -t + c),
    K(-t, t + c),
    K(-2.1 * t - d, 3.05 * t + c),
    K(2.1 * t - d, 3.05 * t + c),
    K(t, t + c),
    K(d - 0.02, -t + c),
    [0.78 * L, s * e.e * m],
    [L, 0],
  ];
}

/** Rand (über die Zelle hinaus), den ein Teil maximal braucht – in Welt-Einheiten. */
export function pieceMargin(pw, ph) {
  return Math.ceil(0.4 * Math.min(pw, ph) + 2);
}

function fmt(n) {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Geometrie eines Puzzles: Raster, Kanten und Teil-Umrisse.
 * pieceSides(i) liefert die vier Seiten als Punktlisten in Welt-Koordinaten (für Tests),
 * piecePath(i) einen SVG-Pfad relativ zur linken oberen Ecke der Zelle (für Path2D).
 */
export function makeGeometry({ cols, rows, seed, aspect }) {
  const { W, H } = worldSize(aspect);
  const pw = W / cols, ph = H / rows;
  const m = Math.min(pw, ph);
  const edges = makeEdges(cols, rows, seed);

  // Seite als Liste von Punkten (p0..p9 oder nur Ecken) in Welt-Koordinaten
  function hSide(r, c) { // waagrecht, von links nach rechts
    const x0 = c * pw, y0 = r * ph, x1 = (c + 1) * pw;
    const e = edges.h[r][c];
    if (!e) return [[x0, y0], [x1, y0]];
    const pts = edgePoints(e, pw, m).map(([u, w]) => [x0 + u, y0 + w]);
    pts[0] = [x0, y0]; pts[pts.length - 1] = [x1, y0];
    return pts;
  }
  function vSide(r, c) { // senkrecht, von oben nach unten
    const x0 = c * pw, y0 = r * ph, y1 = (r + 1) * ph;
    const e = edges.v[r][c];
    if (!e) return [[x0, y0], [x0, y1]];
    const pts = edgePoints(e, ph, m).map(([u, w]) => [x0 + w, y0 + u]);
    pts[0] = [x0, y0]; pts[pts.length - 1] = [x0, y1];
    return pts;
  }

  function pieceSides(i) {
    const c = i % cols, r = Math.floor(i / cols);
    return {
      top: hSide(r, c),
      right: vSide(r, c + 1),
      bottom: hSide(r + 1, c).slice().reverse(),
      left: vSide(r, c).slice().reverse(),
    };
  }

  const cache = new Map();
  function piecePath(i) {
    if (cache.has(i)) return cache.get(i);
    const c = i % cols, r = Math.floor(i / cols);
    const ox = c * pw, oy = r * ph;
    const sides = pieceSides(i);
    let d = `M${fmt(0)} ${fmt(0)}`;
    for (const key of ['top', 'right', 'bottom', 'left']) {
      const pts = sides[key];
      if (pts.length === 2) {
        d += `L${fmt(pts[1][0] - ox)} ${fmt(pts[1][1] - oy)}`;
      } else {
        for (let k = 1; k < pts.length; k += 3) {
          d += 'C' + [pts[k], pts[k + 1], pts[k + 2]].map((p) => `${fmt(p[0] - ox)} ${fmt(p[1] - oy)}`).join(' ');
        }
      }
    }
    d += 'Z';
    cache.set(i, d);
    return d;
  }

  return { cols, rows, W, H, pw, ph, m, margin: pieceMargin(pw, ph), edges, pieceSides, piecePath, count: cols * rows };
}

// ---------- Kubische Bézier-Helfer (für Tests und Treffer-Prüfung) ----------

export function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Tastet eine Seite (Punktliste wie aus pieceSides) ab. */
export function sampleSide(pts, steps = 12) {
  if (pts.length === 2) {
    const out = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t]);
    }
    return out;
  }
  const out = [pts[0]];
  for (let k = 0; k + 3 < pts.length; k += 3) {
    for (let j = 1; j <= steps; j++) out.push(bezierPoint(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], j / steps));
  }
  return out;
}

// ---------- Spielzustand ----------

export function isEdgePiece(i, cols, rows) {
  const c = i % cols, r = Math.floor(i / cols);
  return c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
}

export function targetOf(geo, i) {
  const c = i % geo.cols, r = Math.floor(i / geo.cols);
  return [(c + 0.5) * geo.pw, (r + 0.5) * geo.ph];
}

/** Neues Spiel: alle Teile gemischt in der Leiste. */
export function newGame({ cols, rows, seed, aspect, rotate = false }) {
  const rng = makeRng(((seed >>> 0) ^ 0x51ed270b) >>> 0);
  const n = cols * rows;
  const pieces = [];
  for (let i = 0; i < n; i++) {
    pieces.push({ x: 0, y: 0, r: rotate ? rng.int(0, 3) : 0, g: i, s: TRAY });
  }
  // Randteile etwas nach vorne mischen: angenehmer Einstieg, aber nicht streng sortiert
  const order = [...Array(n).keys()];
  rng.shuffle(order);
  const key = (i) => (isEdgePiece(i, cols, rows) ? 0 : 0.6) + rng.next();
  const keyed = order.map((i) => [i, key(i)]).sort((a, b) => a[1] - b[1]);
  return {
    v: 1,
    cols, rows, seed: seed >>> 0, aspect, rotate: !!rotate,
    pieces,
    tray: keyed.map((k) => k[0]),
    order: [],        // Zeichenreihenfolge der losen Teile (unten -> oben)
    time: 0,          // gespielte Zeit in ms
    moves: 0,
    done: false,
  };
}

export function groupMembers(state, g) {
  const out = [];
  for (let i = 0; i < state.pieces.length; i++) if (state.pieces[i].g === g && state.pieces[i].s === TABLE) out.push(i);
  return out;
}

export function placedCount(state) {
  let n = 0;
  for (const p of state.pieces) if (p.s === PLACED) n++;
  return n;
}

export function isComplete(state) {
  return state.pieces.every((p) => p.s === PLACED);
}

/** Dreht einen Vektor um r × 90° im Uhrzeigersinn (Bildschirm: y nach unten). */
export function rot(dx, dy, r) {
  switch (((r % 4) + 4) % 4) {
    case 1: return [-dy, dx];
    case 2: return [-dx, -dy];
    case 3: return [dy, -dx];
    default: return [dx, dy];
  }
}

export function bringToTop(state, g) {
  const members = state.order.filter((i) => state.pieces[i].g === g);
  state.order = state.order.filter((i) => state.pieces[i].g !== g).concat(members);
}

/** Holt ein Teil aus der Leiste auf den Tisch (Mitte bei x, y). */
export function takeFromTray(state, i, x, y) {
  const p = state.pieces[i];
  if (p.s !== TRAY) return false;
  state.tray = state.tray.filter((k) => k !== i);
  p.s = TABLE; p.x = x; p.y = y; p.g = i;
  state.order.push(i);
  return true;
}

/** Legt ein einzelnes loses Teil zurück in die Leiste (an Position index). */
export function returnToTray(state, i, index = 0) {
  const p = state.pieces[i];
  if (p.s !== TABLE) return false;
  if (groupMembers(state, p.g).length !== 1) return false;
  p.s = TRAY; p.g = i;
  state.order = state.order.filter((k) => k !== i);
  const at = Math.max(0, Math.min(state.tray.length, index | 0));
  state.tray.splice(at, 0, i);
  return true;
}

export function moveGroup(state, g, dx, dy) {
  for (const i of groupMembers(state, g)) {
    state.pieces[i].x += dx;
    state.pieces[i].y += dy;
  }
}

/** Dreht eine Gruppe um 90° im Uhrzeigersinn um den Punkt (px, py). */
export function rotateGroup(state, g, px, py) {
  for (const i of groupMembers(state, g)) {
    const p = state.pieces[i];
    const [dx, dy] = rot(p.x - px, p.y - py, 1);
    p.x = px + dx; p.y = py + dy;
    p.r = (p.r + 1) % 4;
  }
}

/** Hält eine Gruppe innerhalb des Tisches (bounds: {x0, y0, x1, y1} für Teil-Mitten). */
export function clampGroup(state, g, bounds) {
  const members = groupMembers(state, g);
  if (!members.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const i of members) {
    const p = state.pieces[i];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  let dx = 0, dy = 0;
  if (maxX - minX > bounds.x1 - bounds.x0) dx = (bounds.x0 + bounds.x1) / 2 - (minX + maxX) / 2;
  else if (minX < bounds.x0) dx = bounds.x0 - minX;
  else if (maxX > bounds.x1) dx = bounds.x1 - maxX;
  if (maxY - minY > bounds.y1 - bounds.y0) dy = (bounds.y0 + bounds.y1) / 2 - (minY + maxY) / 2;
  else if (minY < bounds.y0) dy = bounds.y0 - minY;
  else if (maxY > bounds.y1) dy = bounds.y1 - maxY;
  if (dx || dy) moveGroup(state, g, dx, dy);
}

function neighbors(i, cols, rows) {
  const c = i % cols, r = Math.floor(i / cols);
  const out = [];
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  return out;
}

/**
 * Nach dem Loslassen einer Gruppe: einrasten auf dem Brett und/oder an Nachbarn andocken.
 * Gibt eine Liste von Ereignissen zurück: { type: 'board' | 'join', pieces: [...] }.
 * Teile, die bewegt wurden, stehen in `moved` (für Animationen).
 */
export function dropGroup(state, geo, g, tol) {
  const events = [];
  let current = g;
  const tol2 = tol * tol;
  for (let guard = 0; guard < 64; guard++) {
    const members = groupMembers(state, current);
    if (!members.length) break;

    // 1) Aufs Brett: nur ungedreht und nahe am Zielplatz
    const p0 = state.pieces[members[0]];
    if (members.every((i) => state.pieces[i].r === 0)) {
      const [tx, ty] = targetOf(geo, members[0]);
      const dx = tx - p0.x, dy = ty - p0.y;
      if (dx * dx + dy * dy <= tol2) {
        for (const i of members) {
          const p = state.pieces[i];
          const [qx, qy] = targetOf(geo, i);
          p.x = qx; p.y = qy; p.s = PLACED; p.r = 0;
        }
        state.order = state.order.filter((i) => state.pieces[i].s === TABLE);
        events.push({ type: 'board', pieces: members });
        // Andere lose Gruppen, die jetzt passend daneben liegen, rasten ebenfalls ein
        const more = pullAligned(state, geo, members, tol2);
        for (const ev of more) events.push(ev);
        return events;
      }
    }

    // 2) An Nachbarn andocken (lose oder fest)
    let best = null;
    for (const i of members) {
      const p = state.pieces[i];
      const [ti, tj] = targetOf(geo, i);
      for (const q of neighbors(i, state.cols, state.rows)) {
        const pq = state.pieces[q];
        if (pq.s === TRAY || (pq.s === TABLE && pq.g === current)) continue;
        if (pq.r !== p.r) continue;
        const [qi, qj] = targetOf(geo, q);
        const [ox, oy] = rot(qi - ti, qj - tj, p.r);
        const ex = p.x + ox, ey = p.y + oy;
        const dx = pq.x - ex, dy = pq.y - ey;
        const d2 = dx * dx + dy * dy;
        if (d2 <= tol2 && (!best || d2 < best.d2)) best = { q, dx, dy, d2 };
      }
    }
    if (!best) break;
    moveGroup(state, current, best.dx, best.dy);
    const other = state.pieces[best.q];
    if (other.s === PLACED) {
      for (const i of members) { state.pieces[i].s = PLACED; state.pieces[i].r = 0; }
      // Rundungsfehler ausgleichen
      for (const i of members) { const [x, y] = targetOf(geo, i); state.pieces[i].x = x; state.pieces[i].y = y; }
      state.order = state.order.filter((i) => state.pieces[i].s === TABLE);
      events.push({ type: 'board', pieces: members });
      for (const ev of pullAligned(state, geo, members, tol2)) events.push(ev);
      return events;
    }
    const target = other.g;
    for (const i of members) state.pieces[i].g = target;
    bringToTop(state, target);
    events.push({ type: 'join', pieces: members, with: target });
    current = target;
  }
  return events;
}

/** Lose Gruppen, die passend an frisch eingerastete Teile grenzen, ebenfalls einrasten. */
function pullAligned(state, geo, placedNow, tol2) {
  const events = [];
  const queue = [...placedNow];
  const seen = new Set();
  while (queue.length) {
    const i = queue.pop();
    for (const q of neighbors(i, state.cols, state.rows)) {
      const pq = state.pieces[q];
      if (pq.s !== TABLE || pq.r !== 0 || seen.has(pq.g)) continue;
      const [tx, ty] = targetOf(geo, q);
      const dx = tx - pq.x, dy = ty - pq.y;
      if (dx * dx + dy * dy > tol2) continue;
      seen.add(pq.g);
      const members = groupMembers(state, pq.g);
      for (const k of members) {
        const p = state.pieces[k];
        const [x, y] = targetOf(geo, k);
        p.x = x; p.y = y; p.s = PLACED;
      }
      state.order = state.order.filter((k) => state.pieces[k].s === TABLE);
      events.push({ type: 'board', pieces: members });
      queue.push(...members);
    }
  }
  return events;
}

// ---------- Speichern / Laden ----------

/** Kompakte, JSON-taugliche Form. */
export function serialize(state) {
  return {
    v: 1,
    cols: state.cols, rows: state.rows, seed: state.seed, aspect: state.aspect, rotate: state.rotate,
    p: state.pieces.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.r, p.g, p.s]),
    tray: state.tray.slice(),
    order: state.order.slice(),
    time: Math.round(state.time), moves: state.moves, done: !!state.done,
  };
}

/** Liest einen gespeicherten Stand und repariert Unstimmigkeiten. Gibt null zurück, wenn unbrauchbar. */
export function deserialize(data, geo) {
  if (!data || data.v !== 1 || !Array.isArray(data.p)) return null;
  if (data.cols !== geo.cols || data.rows !== geo.rows) return null;
  const n = geo.cols * geo.rows;
  if (data.p.length !== n) return null;
  const state = {
    v: 1, cols: geo.cols, rows: geo.rows, seed: data.seed >>> 0, aspect: data.aspect, rotate: !!data.rotate,
    pieces: data.p.map((a, i) => {
      const [x, y, r, g, s] = Array.isArray(a) ? a : [];
      return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        r: Number.isInteger(r) ? ((r % 4) + 4) % 4 : 0,
        g: Number.isInteger(g) && g >= 0 && g < n ? g : i,
        s: s === TABLE || s === PLACED ? s : TRAY,
      };
    }),
    tray: [], order: [],
    time: Number.isFinite(data.time) ? Math.max(0, data.time) : 0,
    moves: Number.isInteger(data.moves) ? data.moves : 0,
    done: !!data.done,
  };
  // Eingerastete Teile liegen genau am Ziel
  state.pieces.forEach((p, i) => {
    if (p.s === PLACED) { const [x, y] = targetOf(geo, i); p.x = x; p.y = y; p.r = 0; p.g = i; }
    if (p.s === TRAY) p.g = i;
  });
  // Gruppen: nur gültig, wenn alle Mitglieder lose sind und gleich gedreht – sonst auflösen
  const byGroup = new Map();
  state.pieces.forEach((p, i) => { if (p.s === TABLE) { if (!byGroup.has(p.g)) byGroup.set(p.g, []); byGroup.get(p.g).push(i); } });
  for (const [, members] of byGroup) {
    const r0 = state.pieces[members[0]].r;
    if (members.some((i) => state.pieces[i].r !== r0)) members.forEach((i) => { state.pieces[i].g = i; });
  }
  // Leiste: gespeicherte Reihenfolge, ergänzt um fehlende Teile
  const inTray = new Set(state.pieces.map((p, i) => (p.s === TRAY ? i : -1)).filter((i) => i >= 0));
  const tray = (Array.isArray(data.tray) ? data.tray : []).filter((i) => inTray.has(i));
  const seenT = new Set(tray);
  for (const i of inTray) if (!seenT.has(i)) tray.push(i);
  state.tray = [...new Set(tray)];
  const onTable = new Set(state.pieces.map((p, i) => (p.s === TABLE ? i : -1)).filter((i) => i >= 0));
  const order = (Array.isArray(data.order) ? data.order : []).filter((i) => onTable.has(i));
  const seenO = new Set(order);
  for (const i of onTable) if (!seenO.has(i)) order.push(i);
  state.order = [...new Set(order)];
  if (state.done && !isComplete(state)) state.done = false;
  return state;
}

// ---------- Statistik ----------

export function emptyStats() {
  return { started: 0, won: 0, pieces: 0, time: 0, best: {}, days: { last: null, count: 0, max: 0 } };
}

/** Verbucht ein fertiges Puzzle. day/yesterday als 'JJJJ-MM-TT'. Gibt { stats, newBest } zurück. */
export function recordWin(stats, { tier, ms, pieces, day, yesterday }) {
  const s = { ...emptyStats(), ...(stats || {}) };
  s.best = { ...(s.best || {}) };
  s.days = { ...emptyStats().days, ...(s.days || {}) };
  s.won += 1;
  s.pieces += pieces;
  s.time += ms;
  const prev = s.best[tier];
  const newBest = !(prev > 0) || ms < prev;
  if (newBest) s.best[tier] = ms;
  if (s.days.last !== day) {
    s.days.count = s.days.last === yesterday ? s.days.count + 1 : 1;
    s.days.last = day;
    s.days.max = Math.max(s.days.max || 0, s.days.count);
  }
  return { stats: s, newBest: newBest && prev > 0 };
}

export function formatTime(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** Nächstgelegene Stufe (12, 24, …) für eine Teilezahl. */
export function tierIndex(tier) {
  const i = TIERS.indexOf(tier);
  return i < 0 ? 0 : i;
}
