// Gewichtetes k-means in 3D (Lab) mit deterministischer k-means++-Initialisierung.

/**
 * @param {Float32Array|Float64Array} data  n*3 Werte
 * @param {Float32Array|null} weights       n Gewichte (oder null = 1)
 * @param {number} k
 * @param {{ next(): number }} rng
 * @returns {{ centers: Float64Array, labels: Int32Array, k: number }}
 */
export function kmeans(data, weights, k, rng, { iters = 14, eps = 0.05 } = {}) {
  const n = data.length / 3;
  k = Math.max(1, Math.min(k, n));
  const w = (i) => (weights ? weights[i] : 1);
  const centers = new Float64Array(k * 3);
  // k-means++
  const d2 = new Float64Array(n).fill(Infinity);
  let total = 0;
  for (let i = 0; i < n; i++) total += w(i);
  let r = rng.next() * total, first = 0;
  for (let i = 0; i < n; i++) { r -= w(i); if (r <= 0) { first = i; break; } }
  centers[0] = data[first * 3]; centers[1] = data[first * 3 + 1]; centers[2] = data[first * 3 + 2];
  for (let c = 1; c < k; c++) {
    const px = centers[(c - 1) * 3], py = centers[(c - 1) * 3 + 1], pz = centers[(c - 1) * 3 + 2];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const dx = data[i * 3] - px, dy = data[i * 3 + 1] - py, dz = data[i * 3 + 2] - pz;
      const dd = dx * dx + dy * dy + dz * dz;
      if (dd < d2[i]) d2[i] = dd;
      sum += d2[i] * w(i);
    }
    let pick = -1;
    if (sum > 0) {
      let t = rng.next() * sum;
      for (let i = 0; i < n; i++) { t -= d2[i] * w(i); if (t <= 0) { pick = i; break; } }
      if (pick < 0) pick = n - 1;
    } else {
      pick = Math.floor(rng.next() * n);
    }
    centers[c * 3] = data[pick * 3]; centers[c * 3 + 1] = data[pick * 3 + 1]; centers[c * 3 + 2] = data[pick * 3 + 2];
  }
  const labels = new Int32Array(n);
  const acc = new Float64Array(k * 4);
  for (let it = 0; it < iters; it++) {
    acc.fill(0);
    for (let i = 0; i < n; i++) {
      const x = data[i * 3], y = data[i * 3 + 1], z = data[i * 3 + 2];
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = x - centers[c * 3], dy = y - centers[c * 3 + 1], dz = z - centers[c * 3 + 2];
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd = dd; best = c; }
      }
      labels[i] = best;
      const ww = w(i);
      acc[best * 4] += x * ww; acc[best * 4 + 1] += y * ww; acc[best * 4 + 2] += z * ww; acc[best * 4 + 3] += ww;
    }
    let moved = 0;
    for (let c = 0; c < k; c++) {
      const s = acc[c * 4 + 3];
      if (s <= 0) continue;
      const nx = acc[c * 4] / s, ny = acc[c * 4 + 1] / s, nz = acc[c * 4 + 2] / s;
      moved = Math.max(moved, Math.abs(nx - centers[c * 3]) + Math.abs(ny - centers[c * 3 + 1]) + Math.abs(nz - centers[c * 3 + 2]));
      centers[c * 3] = nx; centers[c * 3 + 1] = ny; centers[c * 3 + 2] = nz;
    }
    if (moved < eps) break;
  }
  return { centers, labels, k };
}

/** Index des nächsten Zentrums. */
export function nearest(centers, k, x, y, z) {
  let best = 0, bd = Infinity;
  for (let c = 0; c < k; c++) {
    const dx = x - centers[c * 3], dy = y - centers[c * 3 + 1], dz = z - centers[c * 3 + 2];
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < bd) { bd = dd; best = c; }
  }
  return best;
}
