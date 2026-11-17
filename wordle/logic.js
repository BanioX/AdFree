// Wortrate – reine Spiellogik (kein DOM). In Node und im Browser nutzbar.
//
//   scoreGuess('BLUME', 'BLÜTE')  → ['correct','correct','absent','absent','correct']
//
// Alle Wörter sind GROSSBUCHSTABEN in Unicode-NFC; Ä, Ö, Ü sind je ein Zeichen.

import { makeRng, hashString } from '../shared/rng.js';

export const MAX_GUESSES = 6;
export const LENGTHS = [4, 5, 6];
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
const WORD_RE = /^[A-ZÄÖÜ]+$/;

/** Ein Wort vereinheitlichen: trimmen, NFC, «ß» → «SS», gross. */
export function normalizeWord(s) {
  return String(s ?? '')
    .trim()
    .normalize('NFC')
    .replace(/ß/g, 'ss')
    .replace(/ẞ/g, 'SS')
    .toUpperCase();
}

/** Anzahl Buchstaben (Ä zählt als einer). */
export function wordLength(w) {
  return [...w].length;
}

export function isWordShape(w, len) {
  return WORD_RE.test(w) && wordLength(w) === len;
}

/**
 * Liest eine Wortliste (Text, Wörter durch Leerraum getrennt; Zeilen mit // sind Kommentare).
 * Gibt die gültigen Wörter der Länge `len` zurück – vereinheitlicht und ohne Doppelte.
 */
export function parseWordList(text, len) {
  const out = [];
  const seen = new Set();
  for (const line of String(text).split('\n')) {
    const clean = line.replace(/\/\/.*$/, '');
    for (const raw of clean.split(/[\s,;]+/)) {
      if (!raw) continue;
      const w = normalizeWord(raw);
      if (!isWordShape(w, len) || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

// ---------- Bewertung ----------

export const CORRECT = 'correct';
export const PRESENT = 'present';
export const ABSENT = 'absent';

/**
 * Bewertet einen Versuch. Doppelte Buchstaben korrekt: zuerst alle Treffer an richtiger Stelle,
 * dann «present» nur so oft, wie der Buchstabe im Lösungswort noch übrig ist.
 */
export function scoreGuess(guess, answer) {
  const g = [...guess];
  const a = [...answer];
  if (g.length !== a.length) throw new Error('Länge passt nicht');
  const res = new Array(g.length).fill(ABSENT);
  const left = new Map();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) res[i] = CORRECT;
    else left.set(a[i], (left.get(a[i]) || 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (res[i] === CORRECT) continue;
    const n = left.get(g[i]) || 0;
    if (n > 0) {
      res[i] = PRESENT;
      left.set(g[i], n - 1);
    }
  }
  return res;
}

export function isSolved(score) {
  return score.every((s) => s === CORRECT);
}

const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 };

/** Farbe jeder Taste: bester bekannter Zustand pro Buchstabe. */
export function keyboardStates(guesses, answer) {
  const out = {};
  for (const g of guesses) {
    const sc = scoreGuess(g, answer);
    [...g].forEach((ch, i) => {
      const s = sc[i];
      if (!out[ch] || RANK[s] > RANK[out[ch]]) out[ch] = s;
    });
  }
  return out;
}

/**
 * Schwerer Modus: Prüft, ob `guess` alle bisherigen Hinweise nutzt.
 * Grüne Buchstaben müssen an derselben Stelle stehen, gelbe/grüne Buchstaben
 * müssen (mindestens so oft wie angezeigt) vorkommen.
 * Gibt null zurück, wenn alles passt, sonst { type: 'position', index, letter }
 * oder { type: 'missing', letter, count }.
 */
export function hardModeViolation(guess, previous, answer) {
  const g = [...guess];
  for (const prev of previous) {
    const p = [...prev];
    const sc = scoreGuess(prev, answer);
    for (let i = 0; i < p.length; i++) {
      if (sc[i] === CORRECT && g[i] !== p[i]) return { type: 'position', index: i, letter: p[i] };
    }
    const need = new Map();
    p.forEach((ch, i) => { if (sc[i] !== ABSENT) need.set(ch, (need.get(ch) || 0) + 1); });
    for (const [ch, n] of need) {
      const have = g.filter((c) => c === ch).length;
      if (have < n) return { type: 'missing', letter: ch, count: n };
    }
  }
  return null;
}

export function hardModeMessage(v) {
  if (!v) return '';
  if (v.type === 'position') return `Der ${v.index + 1}. Buchstabe muss «${v.letter}» sein`;
  return v.count > 1 ? `«${v.letter}» muss ${v.count}× vorkommen` : `Das Wort muss «${v.letter}» enthalten`;
}

// ---------- Spielzustand (reines JSON, wird gespeichert) ----------

/**
 * Neues Spiel. mode: 'daily' | 'endless'.
 */
export function newGame({ answer, mode = 'endless', day = null, hard = false, now = Date.now() }) {
  return {
    v: 1,
    mode,
    len: wordLength(answer),
    answer,
    day,
    hard: !!hard,
    guesses: [],
    input: '',
    status: 'playing', // 'playing' | 'won' | 'lost'
    started: now,
    finished: null,
    counted: false,
  };
}

/** Ein Buchstabe dazu (gibt neuen Zustand zurück, oder denselben, wenn nicht möglich). */
export function typeLetter(game, ch) {
  if (game.status !== 'playing') return game;
  const c = normalizeWord(ch);
  if (c.length !== 1 || !ALPHABET.includes(c)) return game;
  if (wordLength(game.input) >= game.len) return game;
  return { ...game, input: game.input + c };
}

export function deleteLetter(game) {
  if (game.status !== 'playing' || !game.input) return game;
  const arr = [...game.input];
  arr.pop();
  return { ...game, input: arr.join('') };
}

/**
 * Versuch abschicken. isAllowed(word) entscheidet über die Wortliste.
 * Ergebnis: { ok: false, reason, message } oder { ok: true, game, score, won, lost }.
 */
export function submitGuess(game, { isAllowed = () => true, now = Date.now() } = {}) {
  if (game.status !== 'playing') return { ok: false, reason: 'over', message: '' };
  const w = game.input;
  if (wordLength(w) < game.len) return { ok: false, reason: 'short', message: 'Zu wenige Buchstaben' };
  if (!isAllowed(w) && w !== game.answer) return { ok: false, reason: 'unknown', message: 'Nicht in der Wortliste' };
  if (game.hard) {
    const v = hardModeViolation(w, game.guesses, game.answer);
    if (v) return { ok: false, reason: 'hard', message: hardModeMessage(v) };
  }
  const score = scoreGuess(w, game.answer);
  const won = isSolved(score);
  const guesses = [...game.guesses, w];
  const lost = !won && guesses.length >= MAX_GUESSES;
  const next = {
    ...game,
    guesses,
    input: '',
    status: won ? 'won' : lost ? 'lost' : 'playing',
    finished: won || lost ? now : null,
  };
  return { ok: true, game: next, score, won, lost };
}

// ---------- Tageswort ----------

const EPOCH = Date.UTC(2026, 0, 1);

/** 'JJJJ-MM-TT' → Tage seit 1.1.2026 (kann negativ sein). */
export function dayNumber(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5);
}

/** Tageskey + n Tage. */
export function addDays(dayKey, n) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x) => String(x).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Deterministische Reihenfolge (Fisher-Yates mit Seed). */
export function seededOrder(n, seed) {
  const rng = makeRng(typeof seed === 'string' ? hashString(seed) : seed);
  const arr = Array.from({ length: n }, (_, i) => i);
  return rng.shuffle(arr);
}

/**
 * Wort des Tages – für alle gleich. Die Lösungsliste wird alphabetisch (Codepunkte) sortiert,
 * dann in Runden zu je n Tagen durchgemischt: innerhalb einer Runde kommt kein Wort doppelt vor.
 */
export function dailyWord(answers, dayKey, salt = 'wortrate') {
  const sorted = [...new Set(answers)].sort();
  const n = sorted.length;
  if (!n) return null;
  const d = dayNumber(dayKey);
  const round = Math.floor(d / n);
  const pos = ((d % n) + n) % n;
  const order = seededOrder(n, `${salt}-runde-${round}`);
  return sorted[order[pos]];
}

/**
 * Tageswörter rund um einen Tag (back Tage zurück bis ahead Tage voraus).
 * Endlos schliesst sie aus, damit ein Endlos-Wort nicht bald (oder kürzlich) das Tageswort ist.
 */
export function dailyWordsNear(answers, dayKey, back = 30, ahead = 90, salt = 'wortrate') {
  const sorted = [...new Set(answers)].sort();
  const n = sorted.length;
  if (!n) return [];
  const d0 = dayNumber(dayKey);
  const orders = new Map();
  const out = new Set();
  for (let d = d0 - back; d <= d0 + ahead; d++) {
    const round = Math.floor(d / n);
    if (!orders.has(round)) orders.set(round, seededOrder(n, `${salt}-runde-${round}`));
    out.add(sorted[orders.get(round)[((d % n) + n) % n]]);
  }
  return [...out];
}

/** Laufende Nummer des Tagesworts (für «Wortrate Nr. 321»). */
export function dailyNumber(dayKey) {
  return dayNumber(dayKey) + 1;
}

// ---------- Endlos-Modus ----------

/**
 * Zufälliges Wort, das noch nicht dran war. `used` = bisher gespielte Wörter.
 * Wenn alle durch sind, beginnt eine neue Runde (resetUsed = true).
 */
export function pickEndless(answers, used = [], rng = Math.random, exclude = []) {
  const usedSet = new Set(used);
  const ex = new Set(exclude);
  let pool = answers.filter((w) => !usedSet.has(w) && !ex.has(w));
  let resetUsed = false;
  if (!pool.length) {
    resetUsed = true;
    pool = answers.filter((w) => !ex.has(w));
    if (!pool.length) pool = answers.slice();
  }
  const r = typeof rng === 'function' ? rng() : rng.next();
  return { word: pool[Math.floor(r * pool.length)], resetUsed };
}

// ---------- Statistik ----------

export function emptyStats() {
  return { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: null, lastWinDay: null };
}

/**
 * Ergebnis eintragen. Für das Tageswort `day` mitgeben: die Serie zählt dann
 * aufeinanderfolgende gewonnene Tage.
 */
export function recordResult(stats, { won, guesses, day = null }) {
  const s = { ...emptyStats(), ...stats, dist: [...((stats && stats.dist) || [0, 0, 0, 0, 0, 0])] };
  s.played += 1;
  if (won) {
    s.won += 1;
    if (guesses >= 1 && guesses <= 6) s.dist[guesses - 1] += 1;
    if (day) s.streak = s.lastWinDay && addDays(s.lastWinDay, 1) === day ? s.streak + 1 : 1;
    else s.streak += 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    if (day) s.lastWinDay = day;
  } else {
    s.streak = 0;
  }
  if (day) s.lastDay = day;
  return s;
}

/** Aktuelle Serie zur Anzeige (beim Tageswort verfällt sie, wenn gestern nicht gelöst). */
export function currentStreak(stats, today = null) {
  if (!stats) return 0;
  if (!today || !stats.lastWinDay) return stats.streak || 0;
  if (stats.lastWinDay === today || addDays(stats.lastWinDay, 1) === today) return stats.streak || 0;
  return 0;
}

export function winRate(stats) {
  return stats && stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
}

// ---------- Teilen ----------

const EMOJI = {
  normal: { [CORRECT]: '🟩', [PRESENT]: '🟨', [ABSENT]: '⬜' },
  contrast: { [CORRECT]: '🟧', [PRESENT]: '🟦', [ABSENT]: '⬜' },
};

export function emojiGrid(guesses, answer, contrast = false) {
  const map = contrast ? EMOJI.contrast : EMOJI.normal;
  return guesses.map((g) => scoreGuess(g, answer).map((s) => map[s]).join('')).join('\n');
}

/** Text zum Teilen, z.B. «Wortrate 17.11.2026 · 4/6». */
export function shareText(game, { contrast = false } = {}) {
  const tries = game.status === 'won' ? game.guesses.length : 'X';
  let head;
  if (game.mode === 'daily' && game.day) {
    const [y, m, d] = game.day.split('-');
    head = `Wortrate ${d}.${m}.${y} · ${tries}/${MAX_GUESSES}`;
  } else {
    head = `Wortrate Endlos (${game.len} Buchstaben) · ${tries}/${MAX_GUESSES}`;
  }
  if (game.hard) head += '*';
  return `${head}\n\n${emojiGrid(game.guesses, game.answer, contrast)}`;
}

// ---------- Texte ----------

const PRAISE = ['Unglaublich!', 'Grossartig!', 'Wunderbar!', 'Super!', 'Gut gemacht!', 'Puh, geschafft!'];
export function praise(guessCount) {
  return PRAISE[Math.min(Math.max(guessCount, 1), 6) - 1];
}

/** «17. November» */
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function formatDay(dayKey) {
  const [, m, d] = String(dayKey).split('-').map(Number);
  return `${d}. ${MONTHS[m - 1]}`;
}
