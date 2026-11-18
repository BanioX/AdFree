// Fortschritt, Statistik und Spielstände von Dreierlei (localStorage über shared/storage.js).

import { store, reportSummary } from '../shared/storage.js';
import { L } from '../shared/i18n.js';

const P = 'triple.';

export function loadProgress() {
  const p = store.get(P + 'progress', null) || {};
  return {
    level: Math.max(1, (p.level | 0) || 1),
    stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
    times: p.times && typeof p.times === 'object' ? p.times : {},
  };
}

export function saveProgress(p) {
  store.set(P + 'progress', p);
  updateSummary(p);
}

export function totalStars(p = loadProgress()) {
  let s = 0;
  for (const v of Object.values(p.stars)) s += v | 0;
  return s;
}

const STATS_DEFAULT = {
  played: 0, won: 0, triples: 0, helpers: 0, streak: 0, bestStreak: 0,
  freePlayed: 0, freeWon: 0, freeBest: {}, totalTime: 0,
};

export function loadStats() {
  const s = store.get(P + 'stats', null) || {};
  return { ...STATS_DEFAULT, ...s, freeBest: { ...(s.freeBest || {}) } };
}

export function saveStats(s) {
  store.set(P + 'stats', s);
}

export function updateStats(fn) {
  const s = loadStats();
  fn(s);
  saveStats(s);
  return s;
}

// ---------- Spielstände (ein Platz pro Art: Level-Reihe, Wiederholung, freies Spiel) ----------

export function loadSave(kind) {
  return store.get(P + 'save.' + kind, null);
}

export function writeSave(kind, data) {
  store.set(P + 'save.' + kind, data);
}

export function clearSave(kind) {
  store.remove(P + 'save.' + kind);
}

// ---------- Einstellungen ----------

export function getPref(key, fallback) {
  return store.get(P + 'pref.' + key, fallback);
}

export function setPref(key, value) {
  store.set(P + 'pref.' + key, value);
}

// ---------- Kachel-Status für die Startseite ----------

export function updateSummary(p = loadProgress()) {
  const stars = totalStars(p);
  const done = p.level - 1;
  reportSummary('triple', done > 0 ? `Level ${p.level} · ${stars} ★` : L('Level 1 – los geht’s!', 'Level 1 – let’s go!'));
}

export function formatTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}
