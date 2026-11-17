// Bilderrätsel – Rätsel-Definitionen einlesen und prüfen (ohne DOM).
//
// Format einer Definition (wie Perlenbild, siehe CONTENT.md):
//   { id, title, category, palette: { k: '#4a2a22', r: '#ec4a3c' }, rows: ['..kk..', ...] }
// '.' = Hintergrund (leer). Jedes andere Zeichen = gefüllte Zelle in dieser Farbe.

import { cluesFor, checkUnique } from './solver.js';

/** Liest eine Definition ein. Wirft bei Formatfehlern einen Error mit deutscher Meldung. */
export function parsePuzzle(def, extra = {}) {
  const errs = validateDef(def);
  if (errs.length) throw new Error(`Rätsel «${def && def.id}»: ${errs.join('; ')}`);
  const h = def.rows.length;
  const w = def.rows[0].length;
  const mask = new Uint8Array(w * h);
  const colors = new Array(w * h).fill(null);
  for (let r = 0; r < h; r++) {
    const row = def.rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch !== '.') {
        mask[r * w + c] = 1;
        colors[r * w + c] = def.palette[ch];
      }
    }
  }
  const { rows, cols } = cluesFor(mask, w, h);
  return {
    id: def.id,
    title: def.title,
    category: def.category || 'Diverses',
    w, h, mask, colors,
    rowClues: rows,
    colClues: cols,
    def,
    ...extra,
  };
}

/** Formatprüfung. Gibt eine Liste deutscher Fehlermeldungen zurück (leer = ok). */
export function validateDef(def) {
  const errs = [];
  if (!def || typeof def !== 'object') return ['keine Definition'];
  if (typeof def.id !== 'string' || !/^[a-z0-9-]+$/.test(def.id)) errs.push('id fehlt oder enthält ungültige Zeichen');
  if (typeof def.title !== 'string' || !def.title.trim()) errs.push('title fehlt');
  if (!def.palette || typeof def.palette !== 'object') errs.push('palette fehlt');
  if (!Array.isArray(def.rows) || def.rows.length === 0) { errs.push('rows fehlt'); return errs; }
  const w = def.rows[0].length;
  if (!w) errs.push('leere Zeile');
  def.rows.forEach((row, i) => {
    if (typeof row !== 'string') { errs.push(`Zeile ${i + 1} ist kein Text`); return; }
    if (row.length !== w) errs.push(`Zeile ${i + 1} hat ${row.length} statt ${w} Zeichen`);
    for (const ch of row) {
      if (ch !== '.' && !(def.palette && Object.prototype.hasOwnProperty.call(def.palette, ch))) {
        errs.push(`Zeile ${i + 1}: Zeichen «${ch}» nicht in der Palette`);
        break;
      }
    }
  });
  if (def.palette) {
    for (const [k, v] of Object.entries(def.palette)) {
      if (k.length !== 1 || k === '.') errs.push(`Palettenzeichen «${k}» ungültig`);
      if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) errs.push(`Farbe für «${k}» ist kein #rrggbb`);
    }
  }
  return errs;
}

/** Ist die Definition ein gutes (eindeutig per Zeilenlogik lösbares) Rätsel? */
export function isGoodPuzzle(def) {
  if (validateDef(def).length) return false;
  const p = parsePuzzle(def);
  let filled = 0;
  for (let i = 0; i < p.mask.length; i++) filled += p.mask[i];
  if (filled === 0) return false;
  return checkUnique(p.mask, p.w, p.h).ok;
}

/** Spiegelt eine Definition horizontal (bleibt eindeutig lösbar). */
export function mirrorDef(def, idSuffix = '-m') {
  return { ...def, id: def.id + idSuffix, rows: def.rows.map((r) => [...r].reverse().join('')) };
}

/**
 * Macht eine Maske eindeutig lösbar, indem möglichst unauffällige Zellen umgeschaltet werden.
 * Wird von den Werkzeugen (tools/check.mjs) und vom Muster-Generator benutzt.
 * @param {string[]} rows  Zeilen im Definitionsformat
 * @param {number} maxFlips
 * @returns {{ rows: string[], flips: {r,c,from,to}[], ok: boolean }}
 */
export function fixRows(rows, maxFlips = 12) {
  let cur = rows.slice();
  const h = cur.length;
  const w = cur[0].length;
  const flips = [];
  const toMask = (rs) => {
    const m = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) m[r * w + c] = rs[r][c] === '.' ? 0 : 1;
    return m;
  };
  for (let step = 0; step <= maxFlips; step++) {
    const mask = toMask(cur);
    const res = checkUnique(mask, w, h);
    if (res.ok) return { rows: cur, flips, ok: true };
    if (step === maxFlips) break;
    // Kandidaten: unbestimmte Zellen
    const cands = [];
    for (let i = 0; i < w * h; i++) if (res.grid[i] === 0) cands.push(i);
    let best = null;
    for (const i of cands) {
      const r = Math.floor(i / w), c = i % w;
      const m2 = Uint8Array.from(mask);
      m2[i] = m2[i] ? 0 : 1;
      let filledN = 0;
      for (let j = 0; j < m2.length; j++) filledN += m2[j];
      if (!filledN) continue;
      const res2 = checkUnique(m2, w, h);
      // optische Kosten: wie viele Nachbarn (8er) weichen nach dem Umschalten ab
      let cost = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        const v = rr < 0 || cc < 0 || rr >= h || cc >= w ? 0 : mask[rr * w + cc];
        if (v !== m2[i]) cost += dr && dc ? 0.5 : 1;
      }
      const score = (res2.ok ? 0 : res2.unknown) * 4 + cost;
      if (!best || score < best.score) best = { i, score };
    }
    if (!best) break;
    const r = Math.floor(best.i / w), c = best.i % w;
    const from = cur[r][c];
    let to = '.';
    if (from === '.') {
      // Farbe: häufigste Farbe der Nachbarn
      const count = {};
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
        const ch = cur[rr][cc];
        if (ch !== '.') count[ch] = (count[ch] || 0) + (dr && dc ? 1 : 2);
      }
      const keys = Object.keys(count).sort((a, b) => count[b] - count[a]);
      to = keys[0] || Object.values(cur.join('').replace(/\./g, ''))[0] || 'k';
    }
    cur[r] = cur[r].slice(0, c) + to + cur[r].slice(c + 1);
    flips.push({ r, c, from, to });
  }
  return { rows: cur, flips, ok: false };
}
