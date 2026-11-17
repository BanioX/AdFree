// Speichern: Einstellungen, Spielstände, Fortschritt und Statistik (localStorage über shared/storage.js).

import { store, reportSummary } from '../../shared/storage.js';
import { skins } from '../data/skins.js';

const K = {
  settings: 'blocks.settings',
  adv: 'blocks.adv',
  stats: 'blocks.stats',
  level: 'blocks.level',
  classic: (size) => `blocks.classic.${size}`,
};

export const SIZES = [8, 10];

export function getSettings() {
  const s = { skin: 'juwelen', size: 8, tab: 'classic', ...store.get(K.settings, {}) };
  if (!skins.some((k) => k.id === s.skin)) s.skin = 'juwelen';
  if (!SIZES.includes(s.size)) s.size = 8;
  if (s.tab !== 'classic' && s.tab !== 'adventure') s.tab = 'classic';
  return s;
}

export function saveSettings(patch) {
  const s = { ...getSettings(), ...patch };
  store.set(K.settings, s);
  return s;
}

export function currentSkin() {
  const id = getSettings().skin;
  return skins.find((k) => k.id === id) || skins[0];
}

// ---------- Abenteuer-Fortschritt ----------

export function getAdv() {
  const a = { max: 1, stars: {}, pics: [], gems: 0, wins: 0, tries: 0, ...store.get(K.adv, {}) };
  if (!Number.isFinite(a.max) || a.max < 1) a.max = 1;
  return a;
}

export function saveAdv(a) { store.set(K.adv, a); }

export function totalStars(a = getAdv()) {
  return Object.values(a.stars).reduce((x, y) => x + (y | 0), 0);
}

/** Level gewonnen: Sterne, Freischalten, Album. Gibt { first, improved, newPic } zurück. */
export function recordWin(n, stars, picId, gemsCount) {
  const a = getAdv();
  const prev = a.stars[n] | 0;
  const first = prev === 0;
  if (stars > prev) a.stars[n] = stars;
  if (n >= a.max) a.max = n + 1;
  let newPic = false;
  if (picId && !a.pics.includes(picId)) { a.pics.push(picId); newPic = true; }
  a.gems += gemsCount | 0;
  a.wins += 1;
  saveAdv(a);
  return { first, improved: stars > prev, newPic };
}

export function recordTry() {
  const a = getAdv();
  a.tries += 1;
  saveAdv(a);
}

// ---------- Spielstände ----------

export function loadClassic(size) { return store.get(K.classic(size), null); }
export function saveClassic(size, data) {
  if (data) store.set(K.classic(size), data); else store.remove(K.classic(size));
}
export function loadLevelSave() { return store.get(K.level, null); }
export function saveLevelSave(data) {
  if (data) store.set(K.level, data); else store.remove(K.level);
}

// ---------- Statistik ----------

function emptyClassic() { return { played: 0, best: 0, total: 0, lines: 0, bestCombo: 0, bestStreak: 0, perfects: 0 }; }

export function getStats() {
  const s = store.get(K.stats, {}) || {};
  s.classic = s.classic || {};
  for (const size of SIZES) s.classic[size] = { ...emptyClassic(), ...(s.classic[size] || {}) };
  return s;
}

export function saveStats(s) { store.set(K.stats, s); }

/** Rekord laufend aktualisieren (damit ein Rekord nie verloren geht). Gibt true bei neuem Rekord. */
export function updateBest(size, score) {
  const s = getStats();
  const c = s.classic[size];
  if (score > c.best) {
    c.best = score;
    saveStats(s);
    return true;
  }
  return false;
}

/** Ein klassisches Spiel ist zu Ende (oder wurde abgebrochen). */
export function recordClassicGame(game) {
  const s = getStats();
  const c = s.classic[game.size];
  c.played += 1;
  c.total += game.score;
  c.lines += game.lines;
  c.best = Math.max(c.best, game.score);
  c.bestCombo = Math.max(c.bestCombo, game.bestCombo);
  c.bestStreak = Math.max(c.bestStreak, game.bestStreak);
  c.perfects += game.perfects;
  saveStats(s);
}

export function bestScore(size) { return getStats().classic[size].best; }

// ---------- Status für die Startseite ----------

export function updateSummary() {
  const a = getAdv();
  const best = Math.max(...SIZES.map((sz) => bestScore(sz)));
  const parts = [];
  if (a.max > 1 || totalStars(a) > 0) parts.push(`Abenteuer: Level ${a.max}`);
  if (best > 0) parts.push(`Rekord ${best.toLocaleString('de-CH')}`);
  reportSummary('blocks', parts.length ? parts.join(' · ') : 'Noch nicht gespielt');
}
