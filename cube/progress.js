// Fortschritt & Spielstand des Pfeilwürfels (localStorage über shared/storage.js).
//   cube.progress = { unlocked: höchstes spielbares Level, stars: { "1": 3, ... } }
//   cube.saves    = { "<level>": { level, removed: [ids], hearts, mistakes, q: [x,y,z,w], t } }
//                   Ein Spielstand pro Level: das freigeschaltete Level (Front) bleibt immer erhalten,
//                   dazu die zuletzt wiederholten Level (höchstens MAX_REPLAYS).

import { store, reportSummary, readSummary } from '../shared/storage.js';
import { t, starWord } from './i18n.js';

const KEY = 'cube.progress';
const SAVES = 'cube.saves';
const OLD_CUR = 'cube.current'; // früheres Format (nur ein Spielstand)
const MAX_REPLAYS = 3;

export function loadProgress() {
  const p = store.get(KEY, null) || {};
  const unlocked = Math.max(1, Number.isInteger(p.unlocked) ? p.unlocked : 1);
  const stars = p.stars && typeof p.stars === 'object' ? p.stars : {};
  return { unlocked, stars };
}

export function summaryText(p = loadProgress()) {
  const st = totalStars(p);
  return st > 0 ? t('summaryStars', { n: p.unlocked, s: st, stars: starWord(st) }) : t('summary', { n: p.unlocked });
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
  clearCurrent(level);
  reportSummary('cube', summaryText(p));
  return { progress: p, best: p.stars[level], improved: stars > prev };
}

function loadSaves() {
  let saves = store.get(SAVES, null);
  if (!saves || typeof saves !== 'object' || Array.isArray(saves)) saves = {};
  const old = store.get(OLD_CUR, null);
  if (old && Number.isInteger(old.level)) {
    if (!saves[old.level]) saves[old.level] = old;
    store.set(SAVES, saves);
    store.remove(OLD_CUR);
  }
  return saves;
}

/** Gespeicherter Zwischenstand von Level `level` – oder null. */
export function loadCurrent(level) {
  const c = loadSaves()[level];
  return c && c.level === level ? c : null;
}

export function saveCurrent(data) {
  const saves = loadSaves();
  saves[data.level] = { ...data, t: Date.now() };
  // Aufräumen: das freigeschaltete Level nie, sonst nur die zuletzt gespielten Wiederholungen behalten
  const front = loadProgress().unlocked;
  const replays = Object.keys(saves).filter((k) => +k !== front)
    .sort((a, b) => (saves[b].t || 0) - (saves[a].t || 0));
  for (const k of replays.slice(MAX_REPLAYS)) delete saves[k];
  store.set(SAVES, saves);
}

export function clearCurrent(level) {
  const saves = loadSaves();
  if (!(level in saves)) return;
  delete saves[level];
  store.set(SAVES, saves);
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
