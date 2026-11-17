// Sammlung: Kartenrücken und Tische, die mit gewonnenen Partien freigeschaltet werden.
// Die ersten vier Rücken und Tische sind immer frei. Siege zählen über alle Spielarten
// inklusive Tagesrätsel. Was einmal gewählt war, bleibt frei (keep-Liste).

export const UNLOCKS = [
  { wins: 1, kind: 'back', id: 'nacht' },
  { wins: 1, kind: 'table', id: 'bordeaux' },
  { wins: 2, kind: 'back', id: 'lavendel' },
  { wins: 3, kind: 'table', id: 'lavendel' },
  { wins: 4, kind: 'back', id: 'sonne' },
  { wins: 5, kind: 'table', id: 'rose' },
  { wins: 6, kind: 'back', id: 'kirsch' },
  { wins: 7, kind: 'table', id: 'holz' },
  { wins: 8, kind: 'back', id: 'mosaik' },
  { wins: 10, kind: 'table', id: 'schiefer' },
  { wins: 12, kind: 'back', id: 'karo' },
  { wins: 14, kind: 'table', id: 'leinen' },
  { wins: 16, kind: 'back', id: 'kupfer' },
  { wins: 18, kind: 'table', id: 'mint' },
  { wins: 20, kind: 'back', id: 'klee' },
  { wins: 25, kind: 'table', id: 'pfirsich' },
];

export function needWins(kind, id) {
  const u = UNLOCKS.find((x) => x.kind === kind && x.id === id);
  return u ? u.wins : 0;
}

export function isUnlocked(kind, id, wins, keep = []) {
  return needWins(kind, id) <= wins || keep.includes(`${kind}:${id}`);
}

/** Was zwischen zwei Siegzahlen neu dazukommt. */
export function newlyUnlocked(before, after) {
  return UNLOCKS.filter((u) => u.wins > before && u.wins <= after);
}

export function nextUnlock(wins) {
  return UNLOCKS.find((u) => u.wins > wins) || null;
}

/** Sterne für eine gewonnene Partie: 3 ohne Hilfen, 2 mit wenigen, sonst 1. */
export function starsFor({ hints = 0, undos = 0 } = {}) {
  if (!hints && !undos) return 3;
  if (hints + undos <= 3) return 2;
  return 1;
}
