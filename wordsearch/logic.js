// Wortsuche – reine Spiellogik (kein DOM). In Node testbar.
//
// Rätsel-Format (JSON-kompatibel, wird so gespeichert):
//   {
//     v: 1, theme: 'blumen', mode: 'mittel', seed: '17', size: 10,
//     grid: ['ROSEXTULPE', ...],                      // size Zeilen à size Buchstaben
//     words: [{ w: 'ROSE', label: 'Rose', r: 0, c: 0, d: 'E' }, ...]   // alphabetisch nach label
//   }

import { makeRng } from '../shared/rng.js';

// Richtungen: dr = Zeile (nach unten +), dc = Spalte (nach rechts +).
// Reihenfolge = Winkel in 45°-Schritten ab «Osten» im Uhrzeigersinn (Bildschirmkoordinaten).
export const DIRS = [
  { id: 'E', dr: 0, dc: 1 },
  { id: 'SE', dr: 1, dc: 1 },
  { id: 'S', dr: 1, dc: 0 },
  { id: 'SW', dr: 1, dc: -1 },
  { id: 'W', dr: 0, dc: -1 },
  { id: 'NW', dr: -1, dc: -1 },
  { id: 'N', dr: -1, dc: 0 },
  { id: 'NE', dr: -1, dc: 1 },
];
export const DIR = Object.fromEntries(DIRS.map((d, i) => [d.id, { ...d, index: i }]));

export const LETTERS = /^[A-ZÄÖÜ]+$/;
export const MIN_LEN = 3;
export const MAX_LEN = 12;

// Ungefähre Buchstabenhäufigkeit im Deutschen (Promille), ohne seltene Q/X/Y.
const GERMAN_FREQ = {
  E: 174, N: 98, I: 76, S: 73, R: 70, A: 65, T: 62, D: 51, H: 48, U: 44, L: 34, C: 31, G: 30,
  M: 25, O: 25, B: 19, W: 19, F: 17, K: 12, Z: 11, P: 8, V: 7, Ü: 6, Ä: 5, Ö: 3, J: 3,
};

/** Anzeigewort → Rasterwort (Grossbuchstaben). */
export function toGridWord(label) {
  return String(label).trim().toUpperCase();
}

/** Wörter eines Themas (String mit Leerzeichen oder Array) → [{ label, w }]. Ungültige werden übersprungen. */
export function themeEntries(theme) {
  const raw = Array.isArray(theme.words) ? theme.words : String(theme.words || '').split(/\s+/);
  const seen = new Set();
  const out = [];
  for (const label0 of raw) {
    const label = String(label0).trim();
    if (!label) continue;
    const w = toGridWord(label);
    if (!LETTERS.test(w) || w.length < MIN_LEN || w.length > MAX_LEN || seen.has(w)) continue;
    seen.add(w);
    out.push({ label, w });
  }
  return out;
}

/** Prüft ein Thema und liefert eine Liste von Problemen (leer = alles gut). */
export function validateTheme(theme) {
  const problems = [];
  if (!theme || typeof theme !== 'object') return ['kein Objekt'];
  if (!/^[a-z0-9-]+$/.test(theme.id || '')) problems.push(`ungültige id «${theme.id}»`);
  if (!theme.title) problems.push('title fehlt');
  if (!theme.emoji) problems.push('emoji fehlt');
  if (!theme.group) problems.push('group fehlt');
  const raw = Array.isArray(theme.words) ? theme.words : String(theme.words || '').split(/\s+/).filter(Boolean);
  const seen = new Set();
  for (const label of raw) {
    const w = toGridWord(label);
    if (/ß/i.test(label)) problems.push(`«${label}»: bitte «ss» statt «ß»`);
    else if (!LETTERS.test(w)) problems.push(`«${label}»: nur Buchstaben erlaubt`);
    if (w.length < MIN_LEN || w.length > MAX_LEN) problems.push(`«${label}»: ${w.length} Buchstaben (erlaubt ${MIN_LEN}–${MAX_LEN})`);
    if (seen.has(w)) problems.push(`«${label}» doppelt`);
    seen.add(w);
  }
  if (raw.length < 20) problems.push(`nur ${raw.length} Wörter (mindestens 20)`);
  if (raw.length > 30) problems.push(`${raw.length} Wörter (höchstens 30)`);
  return problems;
}

const reverse = (s) => [...s].reverse().join('');

/** true, wenn a und b nicht zusammen in ein Rätsel dürfen (eines steckt im anderen, auch rückwärts). */
export function wordsConflict(a, b) {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return l.includes(s) || l.includes(reverse(s));
}

// ---------- Raster-Helfer ----------

export function cellAt(grid, r, c) {
  return grid[r][c];
}

/** Alle Fundstellen eines Wortes im Raster (alle 8 Richtungen). Palindrome zählen pro Zellenmenge nur einmal. */
export function findOccurrences(grid, w) {
  const n = grid.length;
  const out = [];
  const keys = new Set();
  const L = w.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== w[0]) continue;
      for (const d of DIRS) {
        const er = r + d.dr * (L - 1), ec = c + d.dc * (L - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        let ok = true;
        for (let i = 1; i < L; i++) {
          if (grid[r + d.dr * i][c + d.dc * i] !== w[i]) { ok = false; break; }
        }
        if (!ok) continue;
        const a = r * n + c, b = er * n + ec;
        const key = Math.min(a, b) + ':' + Math.max(a, b);
        if (keys.has(key)) continue;
        keys.add(key);
        out.push({ r, c, d: d.id });
      }
    }
  }
  return out;
}

/** Zellen eines platzierten Wortes. */
export function wordCells(p) {
  const d = DIR[p.d];
  const len = (p.w || '').length || p.len;
  const out = [];
  for (let i = 0; i < len; i++) out.push({ r: p.r + d.dr * i, c: p.c + d.dc * i });
  return out;
}

export function wordEnd(p) {
  const d = DIR[p.d];
  const L = p.w.length;
  return { r: p.r + d.dr * (L - 1), c: p.c + d.dc * (L - 1) };
}

// ---------- Generator ----------

function letterPicker(entries, rng) {
  const counts = {};
  let total = 0;
  for (const e of entries) for (const ch of e.w) { counts[ch] = (counts[ch] || 0) + 1; total++; }
  const baseTotal = Object.values(GERMAN_FREQ).reduce((a, b) => a + b, 0);
  const weights = new Map();
  const useUmlaut = { Ä: !!counts.Ä, Ö: !!counts.Ö, Ü: !!counts.Ü };
  for (const [ch, f] of Object.entries(GERMAN_FREQ)) {
    if (ch in useUmlaut && !useUmlaut[ch]) continue;
    weights.set(ch, 0.4 * (f / baseTotal));
  }
  for (const [ch, n] of Object.entries(counts)) {
    weights.set(ch, (weights.get(ch) || 0) + 0.6 * (n / total));
  }
  // Verteilung abflachen, damit häufige Buchstaben (E, N) nicht dominieren
  const list = [...weights.entries()].map(([ch, w]) => [ch, Math.pow(w, 0.6)]);
  const sum = list.reduce((a, [, w]) => a + w, 0);
  /** Zufallsbuchstabe nach Themenverteilung; avoid = Buchstabe oder Set von Buchstaben, die nicht kommen sollen. */
  return (avoid) => {
    const bad = avoid instanceof Set ? avoid : new Set(avoid ? [avoid] : []);
    for (let tries = 0; tries < 30; tries++) {
      let x = rng.next() * sum;
      for (const [ch, w] of list) {
        x -= w;
        if (x <= 0) { if (!bad.has(ch)) return ch; break; }
      }
    }
    const alt = list.filter(([ch]) => !bad.has(ch));
    return alt[Math.floor(rng.next() * alt.length)][0];
  };
}

function tryBuild(entries, mode, size, count, rng) {
  const N = size * size;
  const grid = new Array(N).fill(null);
  const axis = new Uint8Array(N); // Bitmaske belegter Achsen (E/W=1, SE/NW=2, S/N=4, SW/NE=8)
  const locked = new Uint8Array(N);
  const dirs = mode.dirs.map((id) => DIR[id]);

  const pool = rng.shuffle(entries.filter((e) => e.w.length <= size));
  // Wörter wählen (ohne Konflikte), dann lange zuerst platzieren
  const chosen = [];
  const spare = [];
  for (const e of pool) {
    if (chosen.length < count && !chosen.some((x) => wordsConflict(x.w, e.w))) chosen.push(e);
    else spare.push(e);
  }
  chosen.sort((a, b) => b.w.length - a.w.length);

  const placed = [];
  const place = (e) => {
    const L = e.w.length;
    const cands = [];
    let bestOverlap = 0;
    for (const d of dirs) {
      const bit = 1 << (d.index % 4);
      const r0 = d.dr < 0 ? L - 1 : 0, r1 = d.dr > 0 ? size - L : size - 1;
      const c0 = d.dc < 0 ? L - 1 : 0, c1 = d.dc > 0 ? size - L : size - 1;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          let ov = 0, ok = true;
          for (let i = 0; i < L; i++) {
            const idx = (r + d.dr * i) * size + (c + d.dc * i);
            const g = grid[idx];
            if (g !== null) {
              if (g !== e.w[i] || (axis[idx] & bit)) { ok = false; break; }
              ov++;
            }
          }
          if (!ok) continue;
          if (ov === L) continue; // vollständig in anderen Wörtern versteckt
          cands.push({ r, c, d, ov });
          if (ov > bestOverlap) bestOverlap = ov;
        }
      }
    }
    if (!cands.length) return false;
    let pickFrom = cands;
    if (bestOverlap > 0 && rng.chance(mode.overlap)) pickFrom = cands.filter((x) => x.ov > 0);
    const p = rng.pick(pickFrom);
    const bit = 1 << (p.d.index % 4);
    for (let i = 0; i < L; i++) {
      const idx = (p.r + p.d.dr * i) * size + (p.c + p.d.dc * i);
      grid[idx] = e.w[i];
      axis[idx] |= bit;
      locked[idx] = 1;
    }
    placed.push({ w: e.w, label: e.label, r: p.r, c: p.c, d: p.d.id });
    return true;
  };

  for (const e of chosen) place(e);
  // Ersatzwörter für nicht platzierbare
  for (const e of spare) {
    if (placed.length >= count) break;
    if (placed.some((x) => wordsConflict(x.w, e.w))) continue;
    place(e);
  }
  if (placed.length < count) return null;

  // Lockvögel: Wortanfänge an freien Stellen
  for (let k = 0; k < (mode.decoys || 0); k++) {
    const src = rng.pick(placed);
    if (src.w.length < 4) continue;
    const fl = src.w.length - (src.w.length >= 7 && rng.chance(0.5) ? 2 : 1);
    const frag = src.w.slice(0, fl);
    for (let t = 0; t < 40; t++) {
      const d = rng.pick(dirs);
      const r = rng.int(0, size - 1), c = rng.int(0, size - 1);
      const er = r + d.dr * (fl - 1), ec = c + d.dc * (fl - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      let ok = true;
      for (let i = 0; i < fl; i++) {
        const idx = (r + d.dr * i) * size + (c + d.dc * i);
        if (grid[idx] !== null && grid[idx] !== frag[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = 0; i < fl; i++) {
        const idx = (r + d.dr * i) * size + (c + d.dc * i);
        if (grid[idx] === null) grid[idx] = frag[i];
      }
      break;
    }
  }

  // Auffüllen
  const pick = letterPicker(entries, rng);
  for (let i = 0; i < N; i++) {
    if (grid[i] !== null) continue;
    // keine drei gleichen Buchstaben hintereinander (waagrecht/senkrecht)
    const r = Math.floor(i / size), c = i % size;
    const avoid = new Set();
    if (c >= 2 && grid[i - 1] === grid[i - 2]) avoid.add(grid[i - 1]);
    if (r >= 2 && grid[i - size] === grid[i - 2 * size]) avoid.add(grid[i - size]);
    grid[i] = pick(avoid);
  }

  // Doppelte Fundstellen reparieren
  const rows = () => {
    const out = [];
    for (let r = 0; r < size; r++) out.push(grid.slice(r * size, r * size + size));
    return out;
  };
  for (let iter = 0; iter < 400; iter++) {
    let changed = false;
    const g = rows();
    for (const p of placed) {
      const occ = findOccurrences(g, p.w);
      if (occ.length <= 1) continue;
      const own = new Set([p.r * size + p.c, (() => { const e = wordEnd(p); return e.r * size + e.c; })()]);
      for (const o of occ) {
        const end = wordEnd({ ...o, w: p.w });
        const a = o.r * size + o.c, b = end.r * size + end.c;
        if (own.has(a) && own.has(b)) continue; // die echte Platzierung
        const cells = wordCells({ ...o, w: p.w }).map((x) => x.r * size + x.c).filter((i) => !locked[i]);
        if (!cells.length) return null;
        const idx = rng.pick(cells);
        grid[idx] = pick(grid[idx]);
        changed = true;
      }
      if (changed) break;
    }
    if (!changed) {
      const words = placed.slice().sort((a, b) => a.label.localeCompare(b.label, 'de'));
      return { grid: rows().map((r) => r.join('')), words };
    }
  }
  return null;
}

/**
 * Erzeugt ein Rätsel – deterministisch für (Thema, Stufe, Seed).
 * theme: { id, words }, mode: Objekt aus data/modes.js, seed: beliebiger String/Zahl.
 */
export function generatePuzzle(theme, mode, seed) {
  const rng = makeRng(`ws|${theme.id}|${mode.id}|${seed}`);
  const entries = themeEntries(theme);
  for (let shrink = 0; shrink < 6; shrink++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const si = rng.int(0, mode.sizes.length - 1);
      const size = mode.sizes[si];
      const count = Math.max(4, mode.words[si] - shrink);
      const res = tryBuild(entries, mode, size, count, rng);
      if (res) {
        return { v: 1, theme: theme.id, mode: mode.id, seed: String(seed), size, grid: res.grid, words: res.words };
      }
    }
  }
  throw new Error(`Rätsel für «${theme.id}» (${mode.id}) konnte nicht erzeugt werden`);
}

/** Prüft ein Rätsel vollständig. Liefert Liste von Fehlern (leer = gültig). */
export function verifyPuzzle(pz, mode) {
  const errors = [];
  const n = pz.size;
  if (pz.grid.length !== n || pz.grid.some((row) => [...row].length !== n)) errors.push('Rastergrösse falsch');
  const g = pz.grid.map((row) => [...row]);
  for (const row of g) for (const ch of row) if (!LETTERS.test(ch)) errors.push(`ungültiger Buchstabe ${ch}`);
  for (const p of pz.words) {
    if (mode && !mode.dirs.includes(p.d)) errors.push(`${p.w}: Richtung ${p.d} nicht erlaubt`);
    const cells = wordCells(p);
    const read = cells.map(({ r, c }) => (g[r] && g[r][c]) || '?').join('');
    if (read !== p.w) errors.push(`${p.w}: steht nicht an seiner Stelle (${read})`);
    const occ = findOccurrences(g, p.w);
    if (occ.length !== 1) errors.push(`${p.w}: ${occ.length}× im Raster`);
  }
  for (let i = 0; i < pz.words.length; i++) {
    for (let j = i + 1; j < pz.words.length; j++) {
      if (wordsConflict(pz.words[i].w, pz.words[j].w)) errors.push(`${pz.words[i].w} / ${pz.words[j].w} überschneiden sich`);
    }
  }
  return errors;
}

// ---------- Auswahl ----------

const sameCell = (a, b) => a.r === b.r && a.c === b.c;

/** Zellen auf der Geraden von a nach b (inkl.), oder null, wenn keine der 8 Richtungen. */
export function lineCells(a, b) {
  const dr = b.r - a.r, dc = b.c - a.c;
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr), sc = Math.sign(dc);
  const out = [];
  for (let i = 0; i <= steps; i++) out.push({ r: a.r + sr * i, c: a.c + sc * i });
  return out;
}

export function readLine(pz, a, b) {
  const cells = lineCells(a, b);
  if (!cells) return null;
  return cells.map(({ r, c }) => [...pz.grid[r]][c]).join('');
}

/**
 * Rastet die Auswahl auf eine der 8 Richtungen ein.
 * start: {r,c}; px/py: Zeigerposition in Zelleneinheiten (x = Spalte, y = Zeile, Zellmitte = +0.5).
 */
export function snapEnd(start, px, py, size) {
  const vx = px - (start.c + 0.5), vy = py - (start.r + 0.5);
  if (vx * vx + vy * vy < 0.36) return { r: start.r, c: start.c };
  const ang = Math.atan2(vy, vx);
  const di = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const d = DIRS[di];
  const len2 = d.dr * d.dr + d.dc * d.dc;
  let k = Math.round((vx * d.dc + vy * d.dr) / len2);
  k = Math.max(0, k);
  const lim = (pos, step) => (step > 0 ? size - 1 - pos : step < 0 ? pos : Infinity);
  k = Math.min(k, lim(start.r, d.dr), lim(start.c, d.dc));
  return { r: start.r + d.dr * k, c: start.c + d.dc * k };
}

/**
 * Prüft eine Auswahl a→b. Liefert { index, already } für ein Wort der Liste, sonst null.
 * found: Array von Booleans (oder Set von Indizes).
 */
export function matchSelection(pz, a, b, found = []) {
  if (sameCell(a, b)) return null;
  const isFound = (i) => (found instanceof Set ? found.has(i) : !!found[i]);
  for (let i = 0; i < pz.words.length; i++) {
    const p = pz.words[i];
    const s = { r: p.r, c: p.c }, e = wordEnd(p);
    if ((sameCell(a, s) && sameCell(b, e)) || (sameCell(a, e) && sameCell(b, s))) {
      return { index: i, already: isFound(i) };
    }
  }
  const str = readLine(pz, a, b);
  if (!str) return null;
  const rev = reverse(str);
  for (let i = 0; i < pz.words.length; i++) {
    if (isFound(i)) continue;
    const w = pz.words[i].w;
    if (w === str || w === rev) return { index: i, already: false, alt: true };
  }
  return null;
}

// ---------- Wertung ----------

/** Richtzeit in ms für ein Rätsel. */
export function parTime(mode, wordCount) {
  return mode.secPerWord * wordCount * 1000;
}

/** Sterne (1–3) nach Zeit und Tipps. */
export function starsFor(mode, wordCount, elapsedMs, hints) {
  const par = parTime(mode, wordCount);
  let s = 3;
  if (elapsedMs > par) s--;
  if (elapsedMs > par * 2.5) s--;
  if (hints >= 1) s--;
  if (hints >= 3) s--;
  return Math.max(1, Math.min(3, s));
}

export function formatTime(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------- Tagesrätsel ----------

/** Thema des Tages: wiederholungsfrei durch alle Themen (pro Zyklus neu gemischt). */
export function dailyThemeIndex(dayKey, themeCount) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  const cycle = Math.floor(dayNum / themeCount);
  const perm = makeRng(`ws-daily-cycle-${cycle}-${themeCount}`).shuffle([...Array(themeCount).keys()]);
  return perm[dayNum % themeCount];
}

/** Nächstes Wort für einen Tipp: zufällig unter den noch nicht gefundenen. */
export function pickHintWord(pz, found, rng = Math.random) {
  const open = pz.words.map((_, i) => i).filter((i) => !(found instanceof Set ? found.has(i) : found[i]));
  if (!open.length) return -1;
  return open[Math.floor(rng() * open.length)];
}
