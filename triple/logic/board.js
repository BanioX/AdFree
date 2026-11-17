// Geometrie der Spielfläche (ohne DOM).
//
// Ein Stein ist 1×1 Einheit gross. Position (x, y) = linke obere Ecke in Einheiten,
// x/y dürfen halbe Werte haben (versetzte Ebenen). z = Ebene (0 = unten).
// Ein Stein A verdeckt Stein B, wenn A höher liegt und sich die beiden Flächen überlappen.

const EPS = 1e-6;

export function overlaps(a, b) {
  return Math.abs(a.x - b.x) < 1 - EPS && Math.abs(a.y - b.y) < 1 - EPS;
}

/**
 * above[i] = Steine, die i verdecken (höhere Ebene, überlappend)
 * below[i] = Steine, die i verdeckt
 */
export function coverGraph(tiles) {
  const n = tiles.length;
  const above = Array.from({ length: n }, () => []);
  const below = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = tiles[i];
    for (let j = i + 1; j < n; j++) {
      const b = tiles[j];
      if (a.z === b.z || !overlaps(a, b)) continue;
      if (a.z > b.z) { above[j].push(i); below[i].push(j); }
      else { above[i].push(j); below[j].push(i); }
    }
  }
  return { above, below };
}

/** Ausdehnung der Steine in Einheiten (inklusive Steingrösse). */
export function bounds(tiles) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0;
  for (const t of tiles) {
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.x + 1 > maxX) maxX = t.x + 1;
    if (t.y + 1 > maxY) maxY = t.y + 1;
    if (t.z > maxZ) maxZ = t.z;
  }
  if (!tiles.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, maxZ: 0, w: 1, h: 1 };
  return { minX, minY, maxX, maxY, maxZ, w: maxX - minX, h: maxY - minY };
}
