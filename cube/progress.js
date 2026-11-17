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
