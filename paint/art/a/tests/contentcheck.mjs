// Gemeinsame Inhaltsprüfung für die Bilder von Team A und Team B (reine Node-Logik, ohne Browser).
// Wird von a/tests/pictures.test.mjs und b/tests/pictures.test.mjs benutzt.

import assert from 'node:assert/strict';
import { flattenPath, scanFill } from '../src/raster.mjs';

export const LIMITS = { minRegions: 60, maxRegions: 250, maxColors: 30, minColors: 8, tinyPx: 300, maxTiny: 6 };

/** Prüft das Puzzle-Format (DEV.md) und gibt eine Liste von Fehlermeldungen zurück (leer = gut). */
export function formatErrors(pz, meta) {
  const err = [];
  if (pz.id !== meta.id) err.push(`id ${pz.id} ≠ Liste ${meta.id}`);
  if (pz.title !== meta.title) err.push(`Titel ${pz.title} ≠ Liste ${meta.title}`);
  if (pz.category !== meta.category) err.push(`Kategorie ${pz.category} ≠ Liste ${meta.category}`);
  if (!/^[a-z0-9-]+$/.test(pz.id)) err.push('id ungültig');
  if (/ß/.test(pz.title)) err.push('Titel mit ß (Schweizer Rechtschreibung: ss)');
  if (!(pz.width > 0 && pz.height > 0)) err.push('Grösse fehlt');
  if (!Array.isArray(pz.palette) || pz.palette.length < LIMITS.minColors || pz.palette.length > LIMITS.maxColors) err.push(`Palette: ${pz.palette && pz.palette.length} Farben`);
  for (const c of pz.palette || []) if (!/^#[0-9a-f]{6}$/i.test(c)) err.push(`Farbe ${c} ungültig`);
  if (new Set((pz.palette || []).map((c) => c.toLowerCase())).size !== (pz.palette || []).length) err.push('doppelte Palettenfarbe');
  const n = (pz.shapes || []).length;
  if (n < LIMITS.minRegions || n > LIMITS.maxRegions) err.push(`${n} Bereiche (erlaubt ${LIMITS.minRegions}–${LIMITS.maxRegions})`);
  const used = new Set();
  (pz.shapes || []).forEach((s, i) => {
    if (typeof s.d !== 'string' || !/^\s*M/i.test(s.d)) err.push(`Form ${i}: Pfad ungültig`);
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= pz.palette.length) err.push(`Form ${i}: Farbindex ${s.c}`);
    if (s.r !== undefined && s.r !== 'evenodd') err.push(`Form ${i}: Füllregel ${s.r}`);
    used.add(s.c);
  });
  if (used.size !== (pz.palette || []).length) err.push('unbenutzte Palettenfarbe');
  for (const l of pz.lines || []) if (typeof l.d !== 'string' || !(l.w > 0)) err.push('Deko-Linie ungültig');
  if ((pz.lines || []).length > 12) err.push('zu viele Deko-Linien');
  return err;
}

/** Rastert die Id-Karte (Maler-Reihenfolge) und liefert Abdeckung und sichtbare Fläche je Form. */
export function rasterStats(pz) {
  const W = pz.width, H = pz.height;
  const ids = new Int32Array(W * H).fill(-1);
  pz.shapes.forEach((s, i) => {
    scanFill(flattenPath(s.d), W, H, s.r === 'evenodd', (y, x0, x1) => ids.fill(i, y * W + x0, y * W + x1 + 1));
  });
  const area = new Array(pz.shapes.length).fill(0);
  let uncovered = 0;
  for (let p = 0; p < ids.length; p++) {
    if (ids[p] < 0) uncovered++;
    else area[ids[p]]++;
  }
  return { uncovered, area };
}

/** Komplette Prüfung eines Bildes (wirft bei Fehlern). */
export async function checkPicture(meta, { idPrefix, categories }) {
  assert.ok(meta.id.startsWith(idPrefix), `${meta.id}: Präfix ${idPrefix}`);
  assert.ok(categories.includes(meta.category), `${meta.id}: Kategorie ${meta.category}`);
  const pz = await meta.load();
  assert.deepEqual(JSON.parse(JSON.stringify(pz)), pz, 'JSON-kompatibel');
  assert.deepEqual(formatErrors(pz, meta), []);
  const st = rasterStats(pz);
  assert.ok(st.uncovered <= pz.width * pz.height * 0.0005, `${meta.id}: ${st.uncovered} unbedeckte Pixel`);
  const hidden = st.area.map((a, i) => (a === 0 ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(hidden, [], `${meta.id}: Formen ohne sichtbare Fläche`);
  const tiny = st.area.filter((a) => a < LIMITS.tinyPx).length;
  assert.ok(tiny <= LIMITS.maxTiny, `${meta.id}: ${tiny} Mini-Bereiche < ${LIMITS.tinyPx}px`);
  return { pz, st };
}
