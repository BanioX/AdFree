// Speichern: Einstellungen, Statistik, laufende Partien. Alles in localStorage (shared/storage.js).
import { store } from '../shared/storage.js';
import { difficulties } from './data/difficulties.js';

export const KEYS = {
  settings: 'sudoku.settings',
  stats: 'sudoku.stats',
  game: 'sudoku.game',
  daily: 'sudoku.daily',
  seq: 'sudoku.seq',
  fresh: 'sudoku.fresh',
  helpSeen: 'sudoku.helpSeen',
  lastDiff: 'sudoku.lastDiff',
  salt: 'sudoku.salt',
};

// ---------- Einstellungen ----------

export const DEFAULT_SETTINGS = {
  showMistakes: true,   // falsche Zahlen sofort rot zeigen (sonst nur Regel-Konflikte)
  threeStrikes: false,  // «3 Fehler»-Modus: nach 3 Fehlern ist Schluss (mit zweiter Chance)
  autoClean: true,      // Notizen nach dem Eintragen automatisch aufräumen
  hlUnits: true,        // Reihe/Spalte/Block hervorheben
  hlSame: true,         // gleiche Zahlen hervorheben
  hideDone: true,       // fertige Zahlen im Zahlenfeld ausblenden
  showTimer: true,
  theme: 'blau',
};

export function loadSettings() {
  const s = store.get(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
}

export function saveSettings(s) { store.set(KEYS.settings, s); }

// ---------- Statistik ----------
// Pro Stufe (und 'daily'): played, won, best (ms), total (ms, Summe gewonnener Zeiten),
// streak (Siege am Stück), bestStreak, perfect (ohne Fehler und ohne Tipps).

const EMPTY = () => ({ played: 0, won: 0, best: 0, total: 0, streak: 0, bestStreak: 0, perfect: 0 });

export function loadStats() {
  const raw = store.get(KEYS.stats, {}) || {};
  const out = {};
  for (const k of [...difficulties.map((d) => d.id), 'daily']) out[k] = { ...EMPTY(), ...(raw[k] || {}) };
  return out;
}

function saveStats(s) { store.set(KEYS.stats, s); }

export function statsKey(game) { return game.meta.mode === 'daily' ? 'daily' : game.meta.diff; }

export function recordStart(key) {
  const s = loadStats();
  if (!s[key]) s[key] = EMPTY();
  s[key].played++;
  saveStats(s);
}

/** Abgebrochene Partie (mit Zügen) beendet die Siegesserie. */
export function recordAbandon(key) {
  const s = loadStats();
  if (!s[key]) return;
  s[key].streak = 0;
  saveStats(s);
}

/** @returns {{ newBest: boolean, prevBest: number, stats: object }} */
export function recordWin(key, { time, mistakes, hints }) {
  const s = loadStats();
  if (!s[key]) s[key] = EMPTY();
  const st = s[key];
  const prevBest = st.best;
  st.won++;
  st.total += time;
  const newBest = !st.best || time < st.best;
  if (newBest) st.best = time;
  st.streak++;
  st.bestStreak = Math.max(st.bestStreak, st.streak);
  if (!mistakes && !hints) st.perfect++;
  saveStats(s);
  return { newBest: newBest && st.won > 1, prevBest, stats: st };
}

export function resetStats() { store.remove(KEYS.stats); }

export function totalWon() {
  const s = loadStats();
  return Object.values(s).reduce((a, x) => a + x.won, 0);
}

// ---------- Partien ----------

export function loadGameJSON(slot) { return store.get(slot === 'daily' ? KEYS.daily : KEYS.game, null); }
export function saveGameJSON(slot, json) { store.set(slot === 'daily' ? KEYS.daily : KEYS.game, json); }
export function clearGame(slot) { store.remove(slot === 'daily' ? KEYS.daily : KEYS.game); }

// ---------- Hilfen ----------

export function formatTime(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
