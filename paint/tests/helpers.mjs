// Test-Helfer für Farbenzauber: Puzzle-Daten prüfen (Format aus DEV.md) und Abdeckung per Stichproben.

import { parsePath, segmentsBBox, flattenPath } from '../engine/path.js';

const HEX = /^#[0-9a-f]{6}$/i;

/** Liefert eine Liste von Problemen (leer = in Ordnung). */
export function validatePuzzle(p, { minShapes = 10, maxShapes = 2000, requireAllColors = true } = {}) {
  const out = [];
  if (!p || typeof p !== 'object') return ['kein Objekt'];
  if (!(p.width > 0 && p.height > 0)) out.push('ungültige Grösse');
  if (!Array.isArray(p.palette) || p.palette.length < 2 || p.palette.length > 30) out.push('Palettengrösse ' + (p.palette && p.palette.length));
  else for (const c of p.palette) if (!HEX.test(c)) out.push('ungültige Farbe ' + c);
  if (!Array.isArray(p.shapes)) return [...out, 'keine Formen'];
  if (p.shapes.length < minShapes || p.shapes.length > maxShapes) out.push(`Formenzahl ${p.shapes.length} ausserhalb ${minShapes}–${maxShapes}`);
  const used = new Array((p.palette || []).length).fill(false);
  p.shapes.forEach((s, i) => {
    if (!s || typeof s.d !== 'string' || !s.d.trim()) { out.push(`Form ${i}: kein Pfad`); return; }
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= used.length) out.push(`Form ${i}: Farbindex ${s.c}`);
    else used[s.c] = true;
    if (s.r !== undefined && s.r !== 'evenodd' && s.r !== 'nonzero') out.push(`Form ${i}: Füllregel ${s.r}`);
    let segs;
    try { segs = parsePath(s.d); } catch (e) { out.push(`Form ${i}: Pfad nicht lesbar (${e.message})`); return; }
    if (!segs.length || segs[0].t !== 'M') { out.push(`Form ${i}: Pfad beginnt nicht mit M`); return; }
    const b = segmentsBBox(segs);
    // darf über den Rand hinausragen (wird abgeschnitten), muss die Bildfläche aber berühren
    if (!b || !(b[2] > 0 && b[3] > 0 && b[0] < p.width && b[1] < p.height)) out.push(`Form ${i}: ausserhalb der Bildfläche`);
  });
  if (requireAllColors) used.forEach((u, c) => { if (!u) out.push(`Farbe ${c + 1} unbenutzt`); });
  if (p.lines !== undefined && !Array.isArray(p.lines)) out.push('lines ist keine Liste');
  return out;
}

function windingAt(polys, x, y) {
  let wn = 0, cross = 0;
  for (const poly of polys) {
    const m = poly.length;
    for (let k = 0; k < m; k += 2) {
      const x0 = poly[k], y0 = poly[k + 1];
      const x1 = poly[(k + 2) % m], y1 = poly[(k + 3) % m];
      if (y0 <= y) {
        if (y1 > y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) { wn++; cross++; }
      } else if (y1 <= y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) { wn--; cross++; }
    }
  }
  return { wn, cross };
}

/**
 * Anteil der Stichprobenpunkte (n×n Raster, leicht versetzt), die von KEINER Form bedeckt sind.
 * Liefert { holes, total, sample: [x,y] des ersten Lochs }.
 */
export function coverageHoles(p, n = 48) {
  const polys = p.shapes.map((s) => flattenPath(s.d, 8));
  const boxes = polys.map((ps) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const poly of ps) for (let k = 0; k < poly.length; k += 2) {
      a = Math.min(a, poly[k]); c = Math.max(c, poly[k]);
      b = Math.min(b, poly[k + 1]); d = Math.max(d, poly[k + 1]);
    }
    return [a, b, c, d];
  });
  let holes = 0, total = 0, sample = null;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x = ((gx + 0.37) / n) * p.width, y = ((gy + 0.61) / n) * p.height;
      total++;
      let hit = false;
      for (let i = p.shapes.length - 1; i >= 0 && !hit; i--) {
        const b = boxes[i];
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        const { wn, cross } = windingAt(polys[i], x, y);
        hit = p.shapes[i].r === 'evenodd' ? (cross & 1) === 1 : wn !== 0;
      }
      if (!hit) { holes++; if (!sample) sample = [Math.round(x), Math.round(y)]; }
    }
  }
  return { holes, total, sample };
}
