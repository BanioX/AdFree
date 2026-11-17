// Bilderrätsel – Bibliothek: Pakete, Nachschlagen per id, Tagesrätsel, Endlos, Perlenbilder.
// Ohne DOM (die Perlenbild-Bibliothek wird optional dynamisch geladen).

import { packs as dataPacks, themes as dataThemes } from '../data/index.js';
import { parsePuzzle, isGoodPuzzle, mirrorDef, validateDef } from './puzzle.js';
import { makeEndless } from './generator.js';
import { makeRng } from '../../shared/rng.js';

export const themes = dataThemes;
export const ENDLESS_SIZES = [5, 10, 15, 20];

/** Alle Bibliotheks-Pakete mit gültigen Definitionen. */
export const packs = dataPacks.map((p) => ({
  ...p,
  puzzles: p.puzzles.filter((d) => validateDef(d).length === 0),
}));

const byId = new Map();
for (const pack of packs) for (const def of pack.puzzles) if (!byId.has(def.id)) byId.set(def.id, { def, pack });

let beadsPack = null;
let beadsPromise = null;

/**
 * Lädt die Perlenbild-Muster (falls vorhanden) als Zusatzpaket – nur eindeutig lösbare.
 * @param {() => Promise<any>} importer  z.B. () => import('../../beads/art/index.js')
 */
export function loadBeadsPack(importer) {
  if (beadsPromise) return beadsPromise;
  beadsPromise = (async () => {
    try {
      const m = await importer();
      const list = (m && (m.patterns || m.default)) || [];
      const puzzles = [];
      for (const pat of list) {
        if (!pat || !Array.isArray(pat.rows) || !pat.rows.length) continue;
        const w = pat.rows[0].length, h = pat.rows.length;
        if (w > 25 || h > 25 || w < 4 || h < 4) continue;
        const def = {
          id: `p-${String(pat.id).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
          title: pat.title || 'Perlenbild',
          category: pat.category || 'Perlen',
          palette: pat.palette,
          rows: pat.rows,
        };
        try { if (isGoodPuzzle(def)) puzzles.push(def); } catch { /* ungültig -> überspringen */ }
      }
      if (!puzzles.length) return null;
      beadsPack = { id: 'perlen', title: 'Perlenbilder', subtitle: 'Aus dem Spiel «Perlenbild»', emoji: '💎', puzzles, extra: true };
      for (const def of puzzles) if (!byId.has(def.id)) byId.set(def.id, { def, pack: beadsPack });
      return beadsPack;
    } catch {
      return null;
    }
  })();
  return beadsPromise;
}

export function getBeadsPack() { return beadsPack; }

/** Alle Pakete inkl. Zusatzpaket (falls geladen). */
export function allPacks() { return beadsPack ? [...packs, beadsPack] : packs; }

export function packById(id) { return allPacks().find((p) => p.id === id) || null; }

// ---------- Tagesrätsel ----------

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
}

let dailyPools = null;
function pools() {
  if (dailyPools) return dailyPools;
  const all = packs.flatMap((p) => p.puzzles);
  const pick = (size) => all.filter((d) => d.rows.length === size && d.rows[0].length === size).map((d) => d.id).sort();
  dailyPools = { 10: pick(10), 15: pick(15) };
  return dailyPools;
}

/**
 * Tagesrätsel für einen Tag ('JJJJ-MM-TT'): unter der Woche 10×10, am Wochenende 15×15.
 * Gleiches Datum => gleiches Rätsel (für alle). Der Vorrat wird pro Runde neu gemischt,
 * so wiederholt sich innerhalb einer Runde kein Bild; jede zweite Runde gespiegelt.
 */
export function dailyDef(key) {
  const day = dayNumber(key);
  const weekday = new Date(day * 864e5).getUTCDay(); // 0 = So, 6 = Sa
  const size = weekday === 0 || weekday === 6 ? 15 : 10;
  const base = pools()[size];
  const round = Math.floor(day / base.length);
  const order = makeRng(`nonogram-daily-${size}-${round}`).shuffle(base.slice());
  const sourceId = order[day % base.length];
  let def = byId.get(sourceId).def;
  if (round % 2 === 1) def = mirrorDef(def, '');
  return { ...def, id: `daily-${key}`, sourceId, category: 'Tagesrätsel' };
}

// ---------- Nachschlagen ----------

/** Liefert { def, pack, kind } für eine Rätsel-id oder null. */
export function lookup(id) {
  if (typeof id !== 'string') return null;
  let m = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (m) return { def: dailyDef(m[1]), pack: null, kind: 'daily', day: m[1] };
  m = /^e(5|10|15|20)-(\d{1,6})$/.exec(id);
  if (m) {
    const size = Number(m[1]), n = Number(m[2]);
    if (n < 1) return null;
    return { def: makeEndless(size, n), pack: null, kind: 'endless', size, n };
  }
  const hit = byId.get(id);
  if (hit) return { def: hit.def, pack: hit.pack, kind: hit.pack.extra ? 'beads' : 'library' };
  return null;
}

/** Fertiges Rätsel-Objekt (parsePuzzle) oder null. */
export function loadPuzzle(id) {
  const hit = lookup(id);
  if (!hit) return null;
  try { return { puzzle: parsePuzzle(hit.def), ...hit }; } catch { return null; }
}

/** Nummer eines Bildes im Paket (1-basiert). */
export function indexInPack(pack, id) { return pack.puzzles.findIndex((d) => d.id === id) + 1; }

/** Bilder eines Pakets nach Themen gruppiert (Reihenfolge laut themes). */
export function groupByTheme(pack) {
  const groups = new Map();
  for (const def of pack.puzzles) {
    const t = def.category || 'Diverses';
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(def);
  }
  const order = (t) => { const i = themes.indexOf(t); return i < 0 ? 99 : i; };
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([theme, defs]) => ({ theme, defs }));
}

/** Gesamtzahl Bilder der Bibliothek (ohne Endlos/Tagesrätsel). */
export function libraryCount() { return allPacks().reduce((n, p) => n + p.puzzles.length, 0); }
