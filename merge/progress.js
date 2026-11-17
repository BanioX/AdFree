// Verdoppeln – Fortschritt, Einstellungen und Spielstände (localStorage über shared/storage.js).
//
// Schlüssel (alle mit Präfix "spielpause."):
//   merge.progress        Einstellungen, Rekorde, Statistik, Album, Etappen-Fortschritt
//   merge.save.<modus>    laufendes freies Spiel pro Modus (siehe data/modes.js)
//   merge.save.etappe     laufende Etappe

import { store, reportSummary } from '../shared/storage.js';
import { DEFAULT_MODE, modeById } from './data/modes.js';
import { DEFAULT_SKIN, skins } from './data/skins.js';

const KEY = 'merge.progress';

function defaults() {
  return {
    v: 1,
    seenHelp: false,
    tab: 'free',          // 'free' | 'levels'
    mode: DEFAULT_MODE,
    skin: DEFAULT_SKIN,
    best: {},             // modus → Punkte
    bestTile: {},         // modus → Stufe
    played: {},           // modus → gestartete Spiele
    won: {},              // modus → Ziel erreicht
    merges: 0,            // alle Verschmelzungen
    moves: 0,             // alle Züge
    topE: 0,              // höchste Stufe überhaupt
    album: {},            // stil → höchste entdeckte Stufe
    levelMax: 1,          // höchste freigeschaltete Etappe
    levelStars: {},       // etappe → Sterne (1–3)
  };
}

let cache = null;

export function getProg() {
  if (!cache) {
    const raw = store.get(KEY, null);
    cache = Object.assign(defaults(), raw && typeof raw === 'object' ? raw : {});
    for (const k of ['best', 'bestTile', 'played', 'won', 'album', 'levelStars']) {
      if (!cache[k] || typeof cache[k] !== 'object') cache[k] = {};
    }
    if (!Number.isInteger(cache.levelMax) || cache.levelMax < 1) cache.levelMax = 1;
    if (!skins.some((s) => s.id === cache.skin)) cache.skin = DEFAULT_SKIN;
    cache.mode = modeById(cache.mode).id;
  }
  return cache;
}

export function saveProg(patch) {
  const p = getProg();
  if (patch) Object.assign(p, patch);
  store.set(KEY, p);
  return p;
}

/** Nur für Tests/Neustart: Cache verwerfen. */
export function resetCache() { cache = null; }

// ---------- Spielstände ----------

export function loadSave(slot) {
  return store.get('merge.save.' + slot, null);
}
export function writeSave(slot, data) {
  store.set('merge.save.' + slot, data);
}
export function clearSave(slot) {
  store.remove('merge.save.' + slot);
}

/** Abgeschlossene Spielstände (Spielende, geschaffte Etappe) verwerfen, damit «Spielen» neu beginnt. */
export function dropFinished(slot) {
  const sv = loadSave(slot);
  if (sv && sv.state && (sv.state.over || (slot === 'etappe' && sv.state.won))) clearSave(slot);
}

// ---------- Album ----------

/** Merkt sich eine entdeckte Stufe. Gibt true zurück, wenn sie neu ist. */
export function discover(skinId, e) {
  const p = getProg();
  const had = p.album[skinId] || 0;
  let changed = false;
  if (e > had) { p.album[skinId] = e; changed = true; }
  if (e > p.topE) { p.topE = e; changed = true; }
  if (changed) saveProg();
  return e > had;
}

export function albumCount() {
  const p = getProg();
  let have = 0, total = 0;
  for (const s of skins) {
    total += s.tiles.length;
    have += Math.min(s.tiles.length, p.album[s.id] || 0);
  }
  return { have, total };
}

// ---------- Etappen ----------

export function totalStars() {
  const p = getProg();
  return Object.values(p.levelStars).reduce((a, b) => a + (b | 0), 0);
}

export function recordLevel(n, stars) {
  const p = getProg();
  const old = p.levelStars[n] | 0;
  if (stars > old) p.levelStars[n] = stars;
  if (n + 1 > p.levelMax) p.levelMax = n + 1;
  saveProg();
  return { improved: stars > old, old };
}

// ---------- Kurztext für die Startseite ----------

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function formatNumber(n) { return fmt(n); }

export function report() {
  const p = getProg();
  const parts = [];
  const best = Math.max(0, ...Object.values(p.best).map((v) => v | 0));
  if (best > 0) parts.push('Rekord ' + fmt(best));
  if (p.levelMax > 1) parts.push('Etappe ' + p.levelMax);
  reportSummary('merge', parts.length ? parts.join(' · ') : 'Noch nicht gespielt');
}
