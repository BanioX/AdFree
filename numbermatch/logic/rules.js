// Zahlenpaare – reine Spielregeln (ohne DOM).
//
// Das Feld ist eine flache Liste in Lesereihenfolge mit COLS Spalten:
//   cells = [{ v: 1..9, x: false (gestrichen?), s: false (Stern?) }, …]
// Zwei Zahlen passen, wenn sie gleich sind oder zusammen 10 ergeben.
// Sie dürfen gestrichen werden, wenn zwischen ihnen nur gestrichene Felder liegen:
//   – in Lesereihenfolge (auch vom Zeilenende zum nächsten Zeilenanfang),
//   – senkrecht in derselben Spalte,
//   – diagonal (beide Richtungen).
// Eine ganz gestrichene Reihe verschwindet.

export const COLS = 9;

export const fits = (a, b) => a === b || a + b === 10;

/** Erstes ungestrichenes Feld ab i in Schrittweite step (Diagonalen ohne Zeilenumbruch). */
function nextOpen(cells, i, step, dc) {
  let c = i % COLS;
  let k = i + step;
  while (k < cells.length) {
    if (dc) {
      c += dc;
      if (c < 0 || c >= COLS) return -1;
    }
    if (!cells[k].x) return k;
    k += step;
  }
  return -1;
}

const DIRS = [
  { step: 1, dc: 0, kind: 'line' },          // Lesereihenfolge (inkl. Umbruch)
  { step: COLS, dc: 0, kind: 'down' },       // senkrecht
  { step: COLS + 1, dc: 1, kind: 'diag' },   // ↘
  { step: COLS - 1, dc: -1, kind: 'diag' },  // ↙
];

/** Sind i und j (beide offen) ein erlaubtes Paar? Gibt die Art zurück oder null. */
export function pairKind(cells, i, j) {
  if (i === j || i < 0 || j < 0 || i >= cells.length || j >= cells.length) return null;
  if (i > j) [i, j] = [j, i];
  const a = cells[i], b = cells[j];
  if (a.x || b.x || !fits(a.v, b.v)) return null;
  for (const d of DIRS) {
    if (nextOpen(cells, i, d.step, d.dc) === j) return d.kind;
  }
  return null;
}

/** Alle erlaubten Paare [i, j, kind, gap] mit i < j. gap = Anzahl gestrichener Felder dazwischen. */
export function findPairs(cells) {
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].x) continue;
    const seen = new Set();
    for (const d of DIRS) {
      const j = nextOpen(cells, i, d.step, d.dc);
      if (j < 0 || seen.has(j)) continue;
      seen.add(j);
      if (fits(cells[i].v, cells[j].v)) out.push([i, j, d.kind, Math.round((j - i) / d.step) - 1]);
    }
  }
  return out;
}

export const hasPair = (cells) => findPairs(cells).length > 0;

export const openCount = (cells) => cells.reduce((n, c) => n + (c.x ? 0 : 1), 0);

export const rowCount = (cells) => Math.ceil(cells.length / COLS);

/** Reihen, die vollständig gestrichen sind (Indizes, aufsteigend). */
export function clearedRows(cells) {
  const rows = [];
  for (let r = 0; r * COLS < cells.length; r++) {
    let all = true;
    for (let k = r * COLS; k < Math.min(cells.length, (r + 1) * COLS); k++) {
      if (!cells[k].x) { all = false; break; }
    }
    if (all) rows.push(r);
  }
  return rows;
}

/** Entfernt die angegebenen Reihen (gibt neue Liste zurück). */
export function removeRows(cells, rows) {
  if (!rows.length) return cells;
  const drop = new Set(rows);
  return cells.filter((_, k) => !drop.has(Math.floor(k / COLS)));
}

/** Kopiert alle offenen Zahlen in Reihenfolge ans Ende (ohne Sterne). */
export function appendOpen(cells) {
  const add = cells.filter((c) => !c.x).map((c) => ({ v: c.v, x: false, s: false }));
  return cells.concat(add);
}

export const POINTS = { pair: 10, far: 20, row: 50, board: 150 };

// ---------- Sicherer Weg (für Tipps) ----------
// Ein Feld ist «linear abräumbar», wenn die offenen Zahlen in Lesereihenfolge wie Klammern
// paarweise verschachtelt werden können (innerstes Paar zuerst). Dann gibt es sicher eine
// Lösung – unabhängig von senkrechten/diagonalen Zügen. Intervall-DP, O(n³), n ≤ ~150.

export function linearPlan(values) {
  const n = values.length;
  if (n % 2) return null;
  if (!n) return [];
  // ok[i][j] (j exklusiv, Länge gerade): Teilfolge i..j-1 abräumbar; pick = Partner von i
  const ok = new Array(n + 1);
  const pick = new Array(n + 1);
  for (let i = 0; i <= n; i++) { ok[i] = new Uint8Array(n + 1); pick[i] = new Int16Array(n + 1).fill(-1); ok[i][i] = 1; }
  for (let len = 2; len <= n; len += 2) {
    for (let i = 0; i + len <= n; i++) {
      const j = i + len;
      for (let k = i + 1; k < j; k += 2) {
        if (fits(values[i], values[k]) && ok[i + 1][k] && ok[k + 1][j]) {
          ok[i][j] = 1; pick[i][j] = k; break;
        }
      }
    }
  }
  if (!ok[0][n]) return null;
  // Paare rekonstruieren (Indizes in der Folge der offenen Zahlen), innerste zuerst
  const pairs = [];
  const walk = (i, j) => {
    while (i < j) {
      const k = pick[i][j];
      walk(i + 1, k);
      pairs.push([i, k]);
      i = k + 1;
    }
  };
  walk(0, n);
  return pairs;
}

/**
 * Tipp: ein Paar, nach dem das Feld sicher noch lösbar bleibt (falls möglich),
 * sonst irgendein erlaubtes Paar. null = kein Paar → «Zahlen hinzufügen».
 */
export function hintPair(cells) {
  const open = [];
  cells.forEach((c, k) => { if (!c.x) open.push(k); });
  const plan = linearPlan(open.map((k) => cells[k].v));
  if (plan && plan.length) {
    // erstes Paar, dessen Partner in der offenen Folge direkt benachbart ist
    for (const [a, b] of plan) {
      if (b === a + 1) return [open[a], open[b]];
    }
  }
  const all = findPairs(cells);
  if (!all.length) return null;
  // bevorzugt Züge, die eine Reihe leeren, dann kurze Wege
  let best = all[0], bestScore = -1;
  for (const p of all) {
    const test = cells.map((c) => ({ ...c }));
    test[p[0]].x = true; test[p[1]].x = true;
    const score = clearedRows(test).length * 10 - p[3] * 0.1 + (p[2] === 'line' ? 0.5 : 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return [best[0], best[1]];
}
