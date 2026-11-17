// Browser-Seite des Prüfers: rastert Puzzles, prüft Abdeckung/Flächen und rendert Vorschauen.
// Wird von check.html geladen und über Playwright (check.mjs) gesteuert.

const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\-\s]+$/;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Id-Farbe: rot/grün = Index, blau = Prüfsumme (damit Kantenmischungen nicht als gültig gelten). */
function idColor(id) {
  const r = id & 255, g = (id >> 8) & 255, b = (id * 97 + 31) & 255;
  return [r, g, b];
}

const paths = new WeakMap();
function pathsOf(p) {
  let a = paths.get(p);
  if (!a) {
    a = p.shapes.map((s) => new Path2D(s.d));
    paths.set(p, a);
  }
  return a;
}

/**
 * Analysiert ein Puzzle. Liefert Statistik + Daten für Vorschauen.
 * range: [min, max] erwartete Anzahl Flächen.
 */
export function analyze(p, { size = 1000, range = null } = {}) {
  const issues = [];
  const warn = [];
  const W = size, H = Math.round((size * p.height) / p.width);
  const sc = W / p.width;
  // --- Formale Prüfungen ---
  if (!/^[a-z0-9-]+$/.test(p.id || '')) issues.push('ungültige id: ' + p.id);
  if (!p.title) issues.push('kein Titel');
  if (!p.category) issues.push('keine Kategorie');
  if (!(p.width > 0 && p.height > 0)) issues.push('ungültige Grösse');
  if (!Array.isArray(p.palette) || p.palette.length < 2 || p.palette.length > 30) issues.push('Palettengrösse ' + (p.palette && p.palette.length));
  for (const c of p.palette) if (!/^#[0-9a-f]{6}$/i.test(c)) issues.push('ungültige Farbe ' + c);
  if (new Set(p.palette.map((c) => c.toLowerCase())).size !== p.palette.length) issues.push('doppelte Palettenfarben');
  const used = new Array(p.palette.length).fill(0);
  p.shapes.forEach((s, i) => {
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= p.palette.length) issues.push(`Form ${i}: ungültiger Farbindex ${s.c}`);
    else used[s.c]++;
    if (typeof s.d !== 'string' || !PATH_RE.test(s.d) || !/^\s*M/.test(s.d)) issues.push(`Form ${i}: ungültiger Pfad`);
    if (s.r && s.r !== 'evenodd' && s.r !== 'nonzero') issues.push(`Form ${i}: ungültige Füllregel`);
  });
  used.forEach((u, i) => { if (!u) issues.push(`Farbe ${i + 1} (${p.palette[i]}) wird nicht benutzt`); });
  if (range && (p.shapes.length < range[0] || p.shapes.length > range[1])) {
    issues.push(`Flächenzahl ${p.shapes.length} ausserhalb ${range[0]}–${range[1]}`);
  }
  const json = JSON.stringify(p);

  // --- Id-Raster ---
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const ps = pathsOf(p);
  p.shapes.forEach((s, i) => {
    const [r, g, b] = idColor(i + 1);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill(ps[i], s.r || 'nonzero');
  });
  const img = ctx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const ids = new Int32Array(N); // 0 = Kante/unklar, -1 = leer, sonst id
  let holes = 0, edges = 0;
  let holeSample = null;
  const n = p.shapes.length;
  for (let k = 0, q = 0; k < N; k++, q += 4) {
    const a = img[q + 3];
    if (a < 128) { ids[k] = -1; holes++; if (!holeSample) holeSample = [k % W, (k / W) | 0]; continue; }
    if (a < 255) { edges++; continue; }
    const id = img[q] | (img[q + 1] << 8);
    if (id >= 1 && id <= n && ((id * 97 + 31) & 255) === img[q + 2]) ids[k] = id;
    else edges++;
  }
  if (holes > N * 0.0002) issues.push(`unbedeckte Pixel: ${holes} (z.B. bei ${holeSample.map((v) => Math.round(v / sc))})`);
  else if (holes) warn.push(`${holes} unbedeckte Einzelpixel (Kantenglättung)`);

  // Flächen + Zusammenhang (8er-Nachbarschaft)
  const area = new Int32Array(n + 1);
  for (let k = 0; k < N; k++) if (ids[k] > 0) area[ids[k]]++;
  const seen = new Uint8Array(N);
  const comps = Array.from({ length: n + 1 }, () => []);
  const stack = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    const id = ids[k];
    if (id <= 0 || seen[k]) continue;
    let sp = 0, cnt = 0;
    stack[sp++] = k;
    seen[k] = 1;
    while (sp) {
      const v = stack[--sp];
      cnt++;
      const x = v % W, y = (v / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W || (!dx && !dy)) continue;
          const u = yy * W + xx;
          if (!seen[u] && ids[u] === id) { seen[u] = 1; stack[sp++] = u; }
        }
      }
    }
    comps[id].push(cnt);
  }
  const minArea = 1e9;
  let hidden = 0, tiny = 0, fragmented = 0;
  const fragList = [];
  const tinyList = [];
  let smallest = minArea;
  for (let id = 1; id <= n; id++) {
    const a = area[id];
    if (a < 3) { hidden++; tinyList.push(id - 1); continue; }
    smallest = Math.min(smallest, a);
    if (a < 40 * (sc * sc)) { tiny++; tinyList.push(id - 1); }
    const cs = comps[id].sort((x, y) => y - x);
    if (cs.length > 1 && cs[1] >= 40 * sc * sc) { fragmented++; fragList.push([id - 1, cs.slice(0, 4)]); }
  }
  if (hidden) issues.push(`${hidden} Formen ohne sichtbare Fläche: ${tinyList.slice(0, 8).join(',')}`);
  if (tiny) warn.push(`${tiny} sehr kleine Flächen (< 40 px²): ` + tinyList.slice(0, 10).join(','));
  if (fragmented) warn.push(`${fragmented} zerstückelte Formen: ` + fragList.slice(0, 6).map(([i, c]) => `${i}:${c.join('/')}`).join(' '));

  // Abstandstransformation für Zahlenpositionen (Chamfer 3-4)
  const dist = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const id = ids[k];
    if (id <= 0) { dist[k] = 0; continue; }
    const x = k % W, y = (k / W) | 0;
    const border = x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
      ids[k - 1] !== id || ids[k + 1] !== id || ids[k - W] !== id || ids[k + W] !== id;
    dist[k] = border ? 1 : 1e9;
  }
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    if (dist[k] <= 1) continue;
    dist[k] = Math.min(dist[k], dist[k - 1] + 1, dist[k - W] + 1, dist[k - W - 1] + 1.4142, dist[k - W + 1] + 1.4142);
  }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) {
    const k = y * W + x;
    if (dist[k] <= 1) continue;
    dist[k] = Math.min(dist[k], dist[k + 1] + 1, dist[k + W] + 1, dist[k + W + 1] + 1.4142, dist[k + W - 1] + 1.4142);
  }
  const label = Array.from({ length: n }, () => ({ d: 0, x: 0, y: 0 }));
  for (let k = 0; k < N; k++) {
    const id = ids[k];
    if (id <= 0) continue;
    const L = label[id - 1];
    if (dist[k] > L.d) { L.d = dist[k]; L.x = k % W; L.y = (k / W) | 0; }
  }
  // Wie viele Flächen sind für eine Zahl zu schmal? (Inkreis-Radius < 3 Einheiten)
  const thinList = [];
  label.forEach((L, i) => { if (L.d / sc < 3) thinList.push(i); });
  if (thinList.length) warn.push(`${thinList.length} sehr schmale Flächen (Inkreis < 3): ` + thinList.slice(0, 10).join(','));
  const areas = Array.from(area.slice(1)).map((a) => a / (sc * sc));
  const sortedA = areas.slice().sort((a, b) => a - b);
  return {
    ok: issues.length === 0,
    issues,
    warn,
    shapes: n,
    colors: p.palette.length,
    kb: Math.round(json.length / 1024),
    minArea: Math.round(sortedA[0]),
    medArea: Math.round(sortedA[sortedA.length >> 1]),
    holes,
    edgeFrac: +(edges / N).toFixed(4),
    labels: label.map((L) => [L.x / sc, L.y / sc, L.d / sc]),
  };
}

/** Fertig gemaltes Bild. */
export function renderColored(p, size = 1000) {
  const W = size, H = Math.round((size * p.height) / p.width);
  const sc = W / p.width;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = p.background || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const ps = pathsOf(p);
  p.shapes.forEach((s, i) => {
    ctx.fillStyle = p.palette[s.c];
    ctx.fill(ps[i], s.r || 'nonzero');
    // Haarlinien zwischen Nachbarn verhindern (wie es eine Engine auch tun würde)
    ctx.strokeStyle = p.palette[s.c];
    ctx.lineWidth = 0.6 / sc;
    ctx.stroke(ps[i]);
  });
  drawLines(ctx, p);
  return cv;
}

function drawLines(ctx, p) {
  if (!p.lines) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of p.lines) {
    ctx.strokeStyle = l.color || '#2b2420';
    ctx.lineWidth = l.w || 2;
    ctx.stroke(new Path2D(l.d));
  }
}

/** Malbuch-Ansicht: weiss, dünne Umrisse, kleine Zahlen. */
export function renderColoring(p, labels, size = 1000) {
  const W = size, H = Math.round((size * p.height) / p.width);
  const sc = W / p.width;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const ps = pathsOf(p);
  ctx.lineJoin = 'round';
  p.shapes.forEach((s, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.fill(ps[i], s.r || 'nonzero');
    ctx.strokeStyle = '#8a8178';
    ctx.lineWidth = 1 / sc;
    ctx.stroke(ps[i]);
  });
  drawLines(ctx, p);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#6d645c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  p.shapes.forEach((s, i) => {
    const [x, y, d] = labels[i];
    const fs = Math.min(Math.max(d * sc * 1.0, 0), 28);
    if (fs < 5) return;
    ctx.font = `${Math.round(fs)}px sans-serif`;
    ctx.fillText(String(s.c + 1), x * sc, y * sc + 0.5);
  });
  return cv;
}

/** Palettenleiste. */
export function renderPalette(p, w = 1000) {
  const n = p.palette.length;
  const cell = Math.min(60, Math.floor(w / n));
  const cv = canvas(w, cell + 10);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fbf6ef';
  ctx.fillRect(0, 0, w, cell + 10);
  p.palette.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(i * cell + cell / 2 + 5, cell / 2 + 5, cell / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00000088';
    ctx.font = `${Math.round(cell * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), i * cell + cell / 2 + 5, cell / 2 + 5);
  });
  return cv;
}

/** Setzt Bilder (Canvas) nebeneinander bzw. in ein Raster. */
export function sheet(items, { cols = 3, cell = 480, gap = 12, captions = [] } = {}) {
  const rows = Math.ceil(items.length / cols);
  const capH = captions.length ? 22 : 0;
  const cv = canvas(cols * (cell + gap) + gap, rows * (cell + gap + capH) + gap);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fbf6ef';
  ctx.fillRect(0, 0, cv.width, cv.height);
  items.forEach((it, i) => {
    const cx = gap + (i % cols) * (cell + gap);
    const cy = gap + Math.floor(i / cols) * (cell + gap + capH);
    const s = Math.min(cell / it.width, cell / it.height);
    const w = it.width * s, h = it.height * s;
    ctx.drawImage(it, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);
    if (captions[i]) {
      ctx.fillStyle = '#2b2420';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(captions[i], cx, cy + cell + 16);
    }
  });
  return cv;
}

export async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}
