// Flugbahn eines Schusses: exakte Reflexion an den Wänden, analytische Kollision
// (Strahl gegen Kreis), Einrasten in die nächste freie Nachbarzelle.
//
// Ergebnis von traceShot():
//   points   Polylinie [{x, y}] vom Abschuss bis zum Andockpunkt (inkl. Wand-Abpraller)
//   target   {r, c} Zelle, in die die Blase einrastet (null bei Feuer)
//   hit      {r, c} getroffene Blase (null = Decke)
//   pierced  bei Feuer: [{r, c, s}] alle durchschlagenen Blasen, s = Weglänge bis dahin
//   length   gesamte Weglänge

import { WIDTH, HIT, FIRE_HIT, LAUNCH_X, LAUNCH_Y, clampAngle } from './hex.js';

const EPS = 1e-9;

export function traceShot(board, angleDeg, { pierce = false, maxBounces = 80, occ = null } = {}) {
  const a = clampAngle(angleDeg) * Math.PI / 180;
  let dx = Math.cos(a);
  const dy = -Math.sin(a);
  let x = LAUNCH_X;
  let y = LAUNCH_Y;
  const points = [{ x, y }];
  if (!occ) occ = board.occupied();
  const ceilY = 1;
  const pierced = [];
  const seen = new Set();
  let length = 0;

  for (let i = 0; i <= maxBounces; i++) {
    const tWall = dx > EPS ? (WIDTH - 1 - x) / dx : dx < -EPS ? (1 - x) / dx : Infinity;
    const tCeil = (y - ceilY) / -dy;
    const tSeg = Math.min(tWall, tCeil);

    if (pierce) {
      // Alle Blasen sammeln, denen das Segment näher als FIRE_HIT kommt.
      for (const o of occ) {
        const k = o.r * 16 + o.c;
        if (seen.has(k)) continue;
        const fx = o.x - x, fy = o.y - y;
        const t = Math.max(0, Math.min(tSeg, fx * dx + fy * dy));
        const px = x + dx * t - o.x, py = y + dy * t - o.y;
        if (px * px + py * py < FIRE_HIT * FIRE_HIT) {
          seen.add(k);
          pierced.push({ r: o.r, c: o.c, s: length + t });
        }
      }
    } else {
      let tHit = Infinity;
      let hit = null;
      for (const o of occ) {
        const fx = x - o.x, fy = y - o.y;
        const b = fx * dx + fy * dy;
        const c = fx * fx + fy * fy - HIT * HIT;
        let t;
        if (c <= 0) t = 0; // berührt bereits (sollte nicht vorkommen)
        else {
          if (b >= 0) continue; // entfernt sich
          const disc = b * b - c;
          if (disc < 0) continue;
          t = -b - Math.sqrt(disc);
        }
        if (t < tHit) { tHit = t; hit = o; }
      }
      if (hit && tHit <= tSeg + EPS) {
        x += dx * tHit; y += dy * tHit; length += tHit;
        points.push({ x, y });
        const target = snapNear(board, x, y, hit.r, hit.c);
        return { points, target, hit: { r: hit.r, c: hit.c }, pierced, length };
      }
    }

    if (tCeil <= tWall + EPS) {
      x += dx * tCeil; y = ceilY; length += tCeil;
      points.push({ x, y });
      if (pierce) {
        pierced.sort((p, q) => p.s - q.s);
        return { points, target: null, hit: null, pierced, length };
      }
      return { points, target: snapCeiling(board, x), hit: null, pierced, length };
    }

    // Wand: exakt reflektieren
    x = dx > 0 ? WIDTH - 1 : 1;
    y += dy * tWall;
    length += tWall;
    points.push({ x, y });
    dx = -dx;
  }
  // Sollte bei MIN_ANGLE nie passieren – zur Sicherheit an der Decke einrasten.
  points.push({ x, y: ceilY });
  return { points, target: pierce ? null : snapCeiling(board, x), hit: null, pierced, length };
}

/** Freie Nachbarzelle der getroffenen Blase, die dem Andockpunkt am nächsten liegt. */
export function snapNear(board, x, y, hr, hc) {
  let best = null;
  let bd = Infinity;
  for (const [r, c] of board.neighbors(hr, hc)) {
    if (board.get(r, c)) continue;
    const ddx = board.x(r, c) - x, ddy = board.y(r) - y;
    const d = ddx * ddx + ddy * ddy;
    if (d < bd) { bd = d; best = { r, c }; }
  }
  return best || snapAnywhere(board, x, y);
}

/** Freie Zelle in Zeile 0, die x am nächsten liegt. */
export function snapCeiling(board, x) {
  let best = null;
  let bd = Infinity;
  const len = board.rowLen(0);
  for (let c = 0; c < len; c++) {
    if (board.get(0, c)) continue;
    const d = Math.abs(board.x(0, c) - x);
    if (d < bd) { bd = d; best = { r: 0, c }; }
  }
  return best || snapAnywhere(board, x, 1);
}

/** Notfall: nächste freie Zelle, die an der Decke oder an einer Blase hängt. */
export function snapAnywhere(board, x, y) {
  let best = null;
  let bd = Infinity;
  const maxR = Math.max(0, board.maxRow() + 1);
  for (let r = 0; r <= maxR; r++) {
    const len = board.rowLen(r);
    for (let c = 0; c < len; c++) {
      if (board.get(r, c)) continue;
      const ok = r === 0 || board.neighbors(r, c).some(([nr, nc]) => board.get(nr, nc));
      if (!ok) continue;
      const ddx = board.x(r, c) - x, ddy = board.y(r) - y;
      const d = ddx * ddx + ddy * ddy;
      if (d < bd) { bd = d; best = { r, c }; }
    }
  }
  return best;
}

/** Punkt auf der Polylinie nach Weglänge s (für Animationen). */
export function pointAt(points, s) {
  let rest = s;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (rest <= len || i === points.length - 1) {
      const t = len > 0 ? Math.min(1, rest / len) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    rest -= len;
  }
  return { ...points[points.length - 1] };
}

export function pathLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return s;
}
