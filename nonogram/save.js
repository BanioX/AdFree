// Bilderrätsel – Speichern (localStorage über shared/storage.js).
// Schlüssel (mit Präfix "spielpause."):
//   nonogram.settings          Einstellungen
//   nonogram.p.<id>            Spielstand eines Rätsels { c, u, t, h, m, k, v }
//   nonogram.solved            { <id>: { t: Bestzeit ms, n: Anzahl, p: ohne Hilfe, d: Datum } }
//   nonogram.stats             Zähler
//   nonogram.last              zuletzt gespieltes Rätsel
//   nonogram.endless           { 5: n, 10: n, … } nächstes Endlos-Bild je Grösse
//   nonogram.daily             { 'JJJJ-MM-TT': { t, s: sourceId } }

import { store, reportSummary, todayKey, isDailyDone } from '../shared/storage.js';

const K = 'nonogram.';

const DEFAULT_SETTINGS = { autoCross: true, instantErrors: false, timer: true, helpSeen: false, zoomTip: false };

export const settings = {
  get() { return { ...DEFAULT_SETTINGS, ...(store.get(K + 'settings', {}) || {}) }; },
  set(patch) { const s = { ...this.get(), ...patch }; store.set(K + 'settings', s); return s; },
};

export function loadProgress(id) { return store.get(K + 'p.' + id, null); }
export function saveProgress(id, data) { store.set(K + 'p.' + id, data); }
export function clearProgress(id) { store.remove(K + 'p.' + id); }

export function solvedMap() { return store.get(K + 'solved', {}) || {}; }
export function isSolved(id) { return !!solvedMap()[id]; }

/** Rätsel als gelöst eintragen. Gibt { first, best, prevBest } zurück. */
export function markSolved(id, { time, perfect }) {
  const map = solvedMap();
  const prev = map[id];
  const best = prev ? Math.min(prev.t, time) : time;
  map[id] = { t: best, n: (prev ? prev.n : 0) + 1, p: !!(perfect || (prev && prev.p)), d: todayKey() };
  store.set(K + 'solved', map);
  return { first: !prev, best, prevBest: prev ? prev.t : null };
}

const DEFAULT_STATS = { started: 0, solved: 0, perfect: 0, hints: 0, time: 0, bySize: {} };

export function getStats() { return { ...DEFAULT_STATS, ...(store.get(K + 'stats', {}) || {}) }; }

export function bumpStats(fn) {
  const s = getStats();
  fn(s);
  store.set(K + 'stats', s);
  return s;
}

export function recordStart() { bumpStats((s) => { s.started++; }); }

export function recordWin({ size, time, hints, perfect }) {
  return bumpStats((s) => {
    s.solved++;
    s.time += time;
    s.hints += hints;
    if (perfect) s.perfect++;
    const k = String(size);
    const b = s.bySize[k] || { solved: 0, best: null };
    b.solved++;
    b.best = b.best == null ? time : Math.min(b.best, time);
    s.bySize[k] = b;
  });
}

export function lastPlayed() { return store.get(K + 'last', null); }
export function setLastPlayed(id) { store.set(K + 'last', id); }

export function endlessNext(size) { return (store.get(K + 'endless', {}) || {})[size] || 1; }
export function endlessAdvance(size, solvedN) {
  store.update(K + 'endless', {}, (m) => { m = m || {}; m[size] = Math.max(m[size] || 1, solvedN + 1); return m; });
}

export function dailyLog() { return store.get(K + 'daily', {}) || {}; }
export function logDaily(day, entry) { store.update(K + 'daily', {}, (m) => { m = m || {}; m[day] = entry; return m; }); }

/** Kurzer Status für die Startseite. */
export function updateSummary(total) {
  const solved = Object.keys(solvedMap()).filter((id) => !id.startsWith('daily-')).length;
  const daily = isDailyDone('nonogram') ? ' · Tagesrätsel ✓' : '';
  reportSummary('nonogram', `${solved} von ${total} Bildern gelöst${daily}`);
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
