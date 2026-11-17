// Kleiner localStorage-Wrapper mit Namensraum "spielpause." und try/catch.
// Für grosse Daten (z.B. Foto-Bilder) bitte shared/idb.js verwenden.

const PREFIX = 'spielpause.';

function ls() {
  try { return window.localStorage; } catch { return null; }
}

export const store = {
  get(key, fallback = null) {
    const s = ls();
    if (!s) return fallback;
    try {
      const raw = s.getItem(PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    const s = ls();
    if (!s) return false;
    try {
      s.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    const s = ls();
    if (!s) return;
    try { s.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
  /** Liest, verändert und schreibt einen Wert in einem Schritt. */
  update(key, fallback, fn) {
    const next = fn(this.get(key, fallback));
    this.set(key, next);
    return next;
  },
  keys(prefix = '') {
    const s = ls();
    if (!s) return [];
    const out = [];
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
      }
    } catch { /* ignore */ }
    return out;
  },
};

/**
 * Jedes Spiel meldet hier eine kurze Zusammenfassung für die Startseite,
 * z.B. reportSummary('paint', 'Bilder fertig: 3 von 24').
 */
export function reportSummary(gameId, text) {
  store.set(`summary.${gameId}`, { text, t: Date.now() });
}

export function readSummary(gameId) {
  return store.get(`summary.${gameId}`, null);
}

// ---------- Tagesrätsel ----------
// Spiele mit Tagesrätsel starten es unter "#daily". Der Seed ist das lokale Datum,
// z.B. makeRng(`sudoku-${todayKey()}`). Nach dem Lösen markDailyDone('sudoku') aufrufen.

/** Lokales Datum als 'JJJJ-MM-TT' (Tageswechsel um Mitternacht Ortszeit). */
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function markDailyDone(gameId, day = todayKey()) {
  store.set(`daily.${gameId}.${day}`, true);
  // Serie (Tage am Stück) mitführen
  const s = store.get(`dailyStreak.${gameId}`, { last: null, count: 0 });
  if (s.last !== day) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    s.count = s.last === todayKey(y) ? s.count + 1 : 1;
    s.last = day;
    store.set(`dailyStreak.${gameId}`, s);
  }
}

export function isDailyDone(gameId, day = todayKey()) {
  return store.get(`daily.${gameId}.${day}`, false) === true;
}

export function dailyStreak(gameId) {
  const s = store.get(`dailyStreak.${gameId}`, { last: null, count: 0 });
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return s.last === todayKey() || s.last === todayKey(y) ? s.count : 0;
}
