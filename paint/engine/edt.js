// Euklidische Distanztransformation (Felzenszwalb & Huttenlocher, linear) + Helfer.
// Reine Logik, auch in node testbar.

export const INF = 1e20;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    const fq = f[q] + q * q;
    let s = (fq - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (fq - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/**
 * Quadrierte Distanz jedes Pixels zum nächsten "Merkmal"-Pixel.
 * grid: Float32Array/Float64Array (w*h), 0 = Merkmal (Rand), INF = sonst. Wird überschrieben.
 */
export function edt(grid, w, h) {
  const m = Math.max(w, h);
  const f = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  // Spalten
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  // Zeilen
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) f[x] = grid[o + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[o + x] = d[x];
  }
  return grid;
}

/**
 * Bestimmt den Punkt mit grösstem Randabstand in einer Maske (1 = innen).
 * Pixel ausserhalb des Bildes gelten als Rand. Rückgabe {x, y, r} in Pixeln
 * (Pixelmitte, r = Abstand Mitte -> Rand, ~ -0.5 korrigiert) oder null.
 */
export function poleOfMask(mask, w, h) {
  const g = new Float32Array(w * h);
  let any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (mask[p] && x > 0 && y > 0 && x < w - 1 && y < h - 1) { g[p] = INF; any = true; } else g[p] = 0;
    }
  }
  if (!any) {
    // nur Randpixel innen: trotzdem einen Punkt liefern
    for (let p = 0; p < w * h; p++) if (mask[p]) return { x: (p % w) + 0.5, y: Math.floor(p / w) + 0.5, r: 0 };
    return null;
  }
  edt(g, w, h);
  let best = -1, sx = 0, sy = 0, cnt = 0;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    if (g[p] > best) best = g[p];
    sx += p % w; sy += Math.floor(p / w); cnt++;
  }
  const bp = pickCentral(g, w, h, (p) => mask[p], best, sx / cnt, sy / cnt);
  return { x: (bp % w) + 0.5, y: Math.floor(bp / w) + 0.5, r: Math.max(0, Math.sqrt(g[bp]) - 0.5) };
}

/**
 * Unter allen Pixeln, deren Randabstand höchstens ~1 px unter dem Maximum liegt, den nehmen,
 * der dem Schwerpunkt am nächsten liegt (Nummern mittig in Rechtecken/Streifen).
 */
export function pickCentral(g, w, h, inside, best, cx, cy, list) {
  const rb = Math.sqrt(best);
  const lim = Math.max(0, rb - Math.min(1, rb * 0.12)) ** 2;
  let bp = -1, bd = Infinity;
  const visit = (p) => {
    if (g[p] < lim) return;
    const dx = (p % w) - cx, dy = Math.floor(p / w) - cy;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; bp = p; }
  };
  if (list) for (let k = list[0]; k < list[1]; k++) visit(list[2][k]);
  else for (let p = 0; p < w * h; p++) if (inside(p)) visit(p);
  return bp;
}
