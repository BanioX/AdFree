// Prüft die Perlenbild-Muster-Bibliothek (/beads/art/index.js) auf Format- und Qualitätsregeln.
//
//   node beads/art/tools/validate.mjs        # Fehler => Exit-Code 1, Warnungen nur Hinweis
//   node beads/art/tools/validate.mjs --table
//
// Regeln: Format laut DEV.md, eindeutige ids, gleich lange Zeilen, jedes Zeichen in der Palette,
// jede Palettenfarbe benutzt, keine fast gleichen Farben (CIEDE2000), Grössen und Farbanzahl
// je Schwierigkeitsstufe, aufsteigende Grösse, kein leerer Rand, keine verirrten Einzelperlen.

import { patterns } from '../index.js';

const CATEGORIES = ['Liebe', 'Essen', 'Tiere', 'Natur', 'Dinge', 'Jahreszeiten'];
// Stufen in Level-Reihenfolge: Anzahl Muster, Grösse (längere Seite), Farben.
const TIERS = [
  { name: 'klein (1–6)', count: 6, minDim: 8, maxDim: 12, minColors: 2, maxColors: 4 },
  { name: 'mittel (7–18)', count: 12, minDim: 12, maxDim: 20, minColors: 4, maxColors: 8 },
  { name: 'gross (19–30)', count: 12, minDim: 20, maxDim: 28, minColors: 6, maxColors: 10 },
  { name: 'Schaustück (31–36)', count: Infinity, minDim: 28, maxDim: 32, minColors: 8, maxColors: 12 },
];
const MIN_DELTA_E = 9;   // darunter: Farben als Perlen kaum unterscheidbar => Fehler
const WARN_DELTA_E = 12; // darunter: Warnung

const errors = [];
const warnings = [];
const err = (p, msg) => errors.push(`${p ? `[${p.id ?? '?'}] ` : ''}${msg}`);
const warn = (p, msg) => warnings.push(`${p ? `[${p.id ?? '?'}] ` : ''}${msg}`);

// ---------- Farbe: sRGB -> Lab, CIEDE2000 ----------
function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => { if (a === 0 && b === 0) return 0; const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hmp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hmp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad)
    + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// ---------- Prüfungen ----------
if (!Array.isArray(patterns) || patterns.length === 0) {
  console.error('patterns ist leer oder kein Array');
  process.exit(1);
}

const ids = new Set();
const stats = [];
let tierIndex = 0, inTier = 0;

patterns.forEach((p, idx) => {
  const lvl = idx + 1;
  while (tierIndex < TIERS.length - 1 && inTier >= TIERS[tierIndex].count) { tierIndex++; inTier = 0; }
  const tier = TIERS[tierIndex];
  inTier++;

  if (!p || typeof p !== 'object') return err(null, `Level ${lvl}: kein Objekt`);
  const allowedKeys = new Set(['id', 'title', 'category', 'palette', 'rows']);
  for (const k of Object.keys(p)) if (!allowedKeys.has(k)) warn(p, `unerwartetes Feld «${k}»`);
  if (typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) err(p, `ungültige id «${p.id}»`);
  if (ids.has(p.id)) err(p, 'id doppelt');
  ids.add(p.id);
  if (typeof p.title !== 'string' || !p.title.trim()) err(p, 'title fehlt');
  if (/ß/.test(p.title)) err(p, 'Schweizer Rechtschreibung: «ss» statt «ß»');
  if (!CATEGORIES.includes(p.category)) err(p, `unbekannte Kategorie «${p.category}»`);
  if (!p.palette || typeof p.palette !== 'object') return err(p, 'palette fehlt');
  if (!Array.isArray(p.rows) || p.rows.length === 0) return err(p, 'rows fehlt');

  const pal = p.palette;
  for (const [k, v] of Object.entries(pal)) {
    if (!/^[a-zA-Z0-9]$/.test(k)) err(p, `Palettenzeichen «${k}» ungültig (a-z, A-Z, 0-9)`);
    if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/.test(v)) err(p, `Farbe ${k}: «${v}» ist nicht #rrggbb (klein)`);
  }
  const w = p.rows[0].length, h = p.rows.length;
  const used = new Map();
  p.rows.forEach((r, y) => {
    if (typeof r !== 'string') return err(p, `Zeile ${y} ist kein String`);
    if (r.length !== w) err(p, `Zeile ${y} hat Länge ${r.length} statt ${w}`);
    for (const c of r) {
      if (c === '.') continue;
      if (!(c in pal)) err(p, `Zeichen «${c}» (Zeile ${y}) fehlt in der Palette`);
      used.set(c, (used.get(c) || 0) + 1);
    }
  });
  for (const k of Object.keys(pal)) if (!used.has(k)) err(p, `Palettenfarbe «${k}» wird nicht benutzt`);
  const colors = Object.keys(pal).length;
  const beads = [...used.values()].reduce((a, b) => a + b, 0);

  // fast gleiche Farben
  const entries = Object.entries(pal).filter(([, v]) => /^#[0-9a-f]{6}$/.test(v));
  const labs = entries.map(([k, v]) => [k, v, hexToLab(v)]);
  for (let i = 0; i < labs.length; i++) {
    if (labs[i][1] === '#000000') err(p, `Farbe ${labs[i][0]} ist reines Schwarz`);
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaE2000(labs[i][2], labs[j][2]);
      const msg = `Farben ${labs[i][0]} ${labs[i][1]} und ${labs[j][0]} ${labs[j][1]} sind sehr ähnlich (ΔE2000 ${d.toFixed(1)})`;
      if (d < MIN_DELTA_E) err(p, msg); else if (d < WARN_DELTA_E) warn(p, msg);
    }
  }

  // Grösse / Farben je Stufe
  const big = Math.max(w, h), small = Math.min(w, h);
  if (big < tier.minDim || big > tier.maxDim) err(p, `Grösse ${w}×${h}: längere Seite muss ${tier.minDim}–${tier.maxDim} sein (Stufe ${tier.name})`);
  if (small < tier.minDim - 3) err(p, `Grösse ${w}×${h}: kürzere Seite zu klein für Stufe ${tier.name}`);
  if (w > 32 || h > 32) err(p, `Grösse ${w}×${h}: höchstens 32×32`);
  if (colors < tier.minColors || colors > tier.maxColors) err(p, `${colors} Farben: Stufe ${tier.name} erlaubt ${tier.minColors}–${tier.maxColors}`);

  // leerer Rand
  const grid = p.rows.map((r) => [...r]);
  const rowEmpty = (y) => grid[y].every((c) => c === '.');
  const colEmpty = (x) => grid.every((r) => r[x] === '.');
  if (rowEmpty(0) || rowEmpty(h - 1) || colEmpty(0) || colEmpty(w - 1)) err(p, 'leerer Rand (Zeile/Spalte ohne Perlen am Rand) – bitte zuschneiden');

  // verirrte Einzelperlen + Zusammenhang
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x] !== '.';
  const seen = grid.map((r) => r.map(() => false));
  let comps = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && filled(x + dx, y + dy)) n++;
      if (n === 0) err(p, `einzelne, freistehende Perle bei (${x}, ${y})`);
      if (seen[y][x]) continue;
      comps++;
      const st = [[x, y]];
      seen[y][x] = true;
      while (st.length) {
        const [cx, cy] = st.pop();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (filled(nx, ny) && !seen[ny][nx]) { seen[ny][nx] = true; st.push([nx, ny]); }
        }
      }
    }
  }
  if (comps > 1) warn(p, `${comps} getrennte Teile`);

  stats.push({ lvl, p, w, h, colors, beads, tier: tier.name });
});

// Reihenfolge: Grösse (Fläche) und Perlenzahl ungefähr aufsteigend
let maxArea = 0, maxBeads = 0;
for (const s of stats) {
  const area = s.w * s.h;
  if (area < maxArea * 0.75) err(s.p, `Level ${s.lvl}: Fläche ${area} deutlich kleiner als vorher (${maxArea}) – Reihenfolge prüfen`);
  else if (area < maxArea * 0.9) warn(s.p, `Level ${s.lvl}: Fläche ${area} etwas kleiner als vorher (${maxArea})`);
  if (s.beads < maxBeads * 0.7) err(s.p, `Level ${s.lvl}: ${s.beads} Perlen, deutlich weniger als vorher (${maxBeads})`);
  maxArea = Math.max(maxArea, area);
  maxBeads = Math.max(maxBeads, s.beads);
}
const cats = new Map();
for (const s of stats) cats.set(s.p.category, (cats.get(s.p.category) || 0) + 1);
for (const c of CATEGORIES) if (!cats.has(c)) warn(null, `Kategorie «${c}» ist leer`);

if (process.argv.includes('--table')) {
  for (const s of stats) {
    console.log(`${String(s.lvl).padStart(2)}  ${s.p.id.padEnd(14)} ${s.p.title.padEnd(26)} ${s.p.category.padEnd(13)} ${`${s.w}x${s.h}`.padEnd(6)} ${String(s.colors).padStart(2)} Farben ${String(s.beads).padStart(4)} Perlen`);
  }
  console.log('Kategorien:', [...cats].map(([k, v]) => `${k} ${v}`).join(', '));
}
for (const w of warnings) console.warn('Warnung: ' + w);
for (const e of errors) console.error('FEHLER: ' + e);
console.log(`${patterns.length} Muster geprüft: ${errors.length} Fehler, ${warnings.length} Warnungen.`);
process.exit(errors.length ? 1 : 0);
