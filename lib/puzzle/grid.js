// Kleine Helfer für Rätselgitter. Index = Zeile * Breite + Spalte.

export function at(i, w) {
  return { c: i % w, r: Math.floor(i / w) };
}

export function index(c, r, w) {
  return r * w + c;
}

/** Orthogonal, oder mit Diagonalen, wenn `diag` wahr ist. */
export function around(i, w, h, diag = false) {
  const { c, r } = at(i, w);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (!diag && dr && dc) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < w && nr < h) out.push(nr * w + nc);
    }
  }
  return out;
}
