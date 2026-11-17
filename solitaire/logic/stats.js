// Statistik pro Spielart (reine Funktionen auf einem JSON-Objekt).
//   stats = { [modeId]: { played, won, bestTime, fewestMoves, streak, bestStreak, totalTime } }
// "Gespielt" zählt ab dem ersten Zug einer Partie. Eine Partie, die ohne Sieg verlassen wird
// (neue Partie / neu starten), beendet die Siegesserie.

export function emptyEntry() {
  return { played: 0, won: 0, bestTime: null, fewestMoves: null, streak: 0, bestStreak: 0, totalTime: 0 };
}

export function entry(stats, mode) {
  return { ...emptyEntry(), ...(stats && stats[mode]) };
}

/** Partie hat begonnen (erster Zug). */
export function recordStart(stats, mode) {
  const e = entry(stats, mode);
  e.played++;
  return { ...stats, [mode]: e };
}

/** Partie gewonnen. Liefert { stats, records: { time, moves } } */
export function recordWin(stats, mode, { time, moves }) {
  const e = entry(stats, mode);
  e.won++;
  e.streak++;
  e.bestStreak = Math.max(e.bestStreak, e.streak);
  e.totalTime += Math.max(0, time | 0);
  const records = { time: false, moves: false };
  if (time > 0 && (e.bestTime == null || time < e.bestTime)) { records.time = e.bestTime != null; e.bestTime = time; }
  if (moves > 0 && (e.fewestMoves == null || moves < e.fewestMoves)) { records.moves = e.fewestMoves != null; e.fewestMoves = moves; }
  return { stats: { ...stats, [mode]: e }, records, entry: e };
}

/** Begonnene Partie ohne Sieg aufgegeben. */
export function recordLoss(stats, mode) {
  const e = entry(stats, mode);
  e.streak = 0;
  return { ...stats, [mode]: e };
}

export function winRate(e) {
  return e.played ? Math.round((e.won / e.played) * 100) : 0;
}

export function formatTime(sec) {
  if (sec == null) return '–';
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export function totals(stats) {
  let played = 0, won = 0;
  for (const k of Object.keys(stats || {})) { played += stats[k].played || 0; won += stats[k].won || 0; }
  return { played, won };
}
