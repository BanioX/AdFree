// Fortschritt & Spielstand des Pfeilwürfels (localStorage über shared/storage.js).
//   cube.progress = { unlocked: höchstes spielbares Level, stars: { "1": 3, ... } }
//   cube.current  = { level, removed: [ids], hearts, mistakes, q: [x,y,z,w] }

import { store, reportSummary, readSummary } from '../shared/storage.js';

const KEY = 'cube.progress';
const CUR = 'cube.current';

export function loadProgress() {
  const p = store.get(KEY, null) || {};
  const unlocked = Math.max(1, Number.isInteger(p.unlocked) ? p.unlocked : 1);
  const stars = p.stars && typeof p.stars === 'object' ? p.stars : {};
  return { unlocked, stars };
}

export function summaryText(p = loadProgress()) {
  return `Level ${p.unlocked}`;
}

/** Schreibt die Startseiten-Zusammenfassung (falls noch keine da ist oder sie veraltet ist). */
export function ensureSummary() {
  const text = summaryText();
  const s = readSummary('cube');
  if (!s || s.text !== text) reportSummary('cube', text);
}

export function totalStars(p = loadProgress()) {
  let n = 0;
  for (const k of Object.keys(p.stars)) n += Math.max(0, Math.min(3, p.stars[k] | 0));
  return n;
}

export function solvedCount(p = loadProgress()) {
  return Object.keys(p.stars).filter((k) => (p.stars[k] | 0) > 0).length;
}

/** Level gelöst: Sterne (Bestwert) speichern, nächstes Level freischalten. */
export function completeLevel(level, stars) {
  const p = loadProgress();
  const prev = p.stars[level] | 0;
  p.stars[level] = Math.max(prev, stars);
  p.unlocked = Math.max(p.unlocked, level + 1);
  store.set(KEY, p);
  clearCurrent();
  reportSummary('cube', summaryText(p));
  return { progress: p, best: p.stars[level], improved: stars > prev };
}

export function loadCurrent(level) {
  const c = store.get(CUR, null);
  if (!c || c.level !== level) return null;
  return c;
}

export function loadAnyCurrent() {
  return store.get(CUR, null);
}

export function saveCurrent(data) {
  store.set(CUR, data);
}

export function clearCurrent() {
  store.remove(CUR);
}

// ---------- Statistik ----------
//   cube.stats = { arrows, mistakes, hints, wins, playMs, bestStreak, streak }
const STATS = 'cube.stats';

export function loadStats() {
  const s = store.get(STATS, null) || {};
  const n = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return {
    arrows: n(s.arrows), mistakes: n(s.mistakes), hints: n(s.hints), wins: n(s.wins),
    playMs: n(s.playMs), streak: n(s.streak), bestStreak: n(s.bestStreak),
  };
}

/** Zählt Werte hoch, z.B. bumpStats({ arrows: 1 }). */
export function bumpStats(delta) {
  const s = loadStats();
  for (const k of Object.keys(delta)) if (k in s) s[k] = Math.max(0, s[k] + (delta[k] | 0));
  store.set(STATS, s);
  return s;
}

/** Nach einem gelösten Level: Siege und Serie perfekter Level (3 Sterne) nachführen. */
export function recordWin(stars) {
  const s = loadStats();
  s.wins++;
  s.streak = stars === 3 ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  store.set(STATS, s);
  return s;
}

export function perfectCount(p = loadProgress()) {
  return Object.keys(p.stars).filter((k) => (p.stars[k] | 0) >= 3).length;
}

// ---------- Einstellungen ----------
//   cube.settings = { mode: 'classic' | 'relax' }
const SETTINGS = 'cube.settings';
export function loadSettings() {
  const s = store.get(SETTINGS, null) || {};
  return { mode: s.mode === 'relax' ? 'relax' : 'classic' };
}
export function saveSettings(patch) {
  const s = { ...loadSettings(), ...patch };
  store.set(SETTINGS, s);
  return s;
}
