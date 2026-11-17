// Stapel-Sortieren – gemeinsame Spielregeln (reine Logik, kein DOM).
// Wird von Kugelsortierung, Schrauben & Muttern und Wollknäuel benutzt.
//
// Zustand:  { cap, stacks }  – stacks[i] ist ein Array von Farbnummern (0 … n-1), unten → oben.
// Regeln:   { move: 'single' | 'group', complete: 'lock' | 'clear' }
//   move     'single'  – pro Zug wandert genau ein Teil (Kugeln)
//            'group'   – alle obersten Teile gleicher Farbe, so viele Platz haben (Muttern, Wolle)
//   complete 'lock'    – ein voller, einfarbiger Stapel ist fertig und wird gesperrt
//            'clear'   – ein voller, einfarbiger Stapel wird abgeräumt (Stapel wird wieder leer)
//
// Ein Zug ist erlaubt, wenn der Ziel-Stapel leer ist oder oben dieselbe Farbe hat und Platz bietet.

export const DEFAULT_RULES = Object.freeze({ move: 'single', complete: 'lock' });

export function makeState(stacks, cap) {
  return { cap, stacks: stacks.map((s) => s.slice()) };
}

export function cloneState(s) {
  return { cap: s.cap, stacks: s.stacks.map((t) => t.slice()) };
}

export function isMono(stack) {
  for (let i = 1; i < stack.length; i++) if (stack[i] !== stack[0]) return false;
  return true;
}

/** Voller, einfarbiger Stapel. */
export function isComplete(stack, cap) {
  return stack.length === cap && isMono(stack);
}

/** Farbe und Länge der obersten gleichfarbigen Reihe. */
export function topRun(stack) {
  const n = stack.length;
  if (!n) return { color: -1, len: 0 };
  const c = stack[n - 1];
  let k = 1;
  while (k < n && stack[n - 1 - k] === c) k++;
  return { color: c, len: k };
}

/** Wie viele Teile würden von «from» nach «to» wandern? 0 = nicht erlaubt. */
export function moveCount(state, from, to, rules = DEFAULT_RULES) {
  if (from === to) return 0;
  const a = state.stacks[from], b = state.stacks[to];
  if (!a || !b || !a.length) return 0;
  if (rules.complete === 'lock' && isComplete(a, state.cap)) return 0;
  const space = state.cap - b.length;
  if (space <= 0) return 0;
  const run = topRun(a);
  if (b.length && b[b.length - 1] !== run.color) return 0;
  return rules.move === 'group' ? Math.min(run.len, space) : 1;
}

export function canMove(state, from, to, rules) {
  return moveCount(state, from, to, rules) > 0;
}

/** Ob man diesen Stapel anfassen kann (nicht leer, nicht gesperrt). */
export function canPick(state, i, rules = DEFAULT_RULES) {
  const a = state.stacks[i];
  if (!a || !a.length) return false;
  return !(rules.complete === 'lock' && isComplete(a, state.cap));
}

/** Wie viele Teile oben angehoben werden (Auswahl). */
export function pickCount(state, i, rules = DEFAULT_RULES) {
  if (!canPick(state, i, rules)) return 0;
  return rules.move === 'group' ? topRun(state.stacks[i]).len : 1;
}

/**
 * Führt einen Zug aus (verändert state). Gibt einen Zug-Datensatz für undoMove zurück oder null.
 * Datensatz: { from, to, count, color, cleared } – cleared = true, wenn der Ziel-Stapel abgeräumt wurde.
 */
export function applyMove(state, from, to, rules = DEFAULT_RULES) {
  const count = moveCount(state, from, to, rules);
  if (!count) return null;
  const a = state.stacks[from], b = state.stacks[to];
  const color = a[a.length - 1];
  for (let k = 0; k < count; k++) b.push(a.pop());
  let cleared = false;
  if (rules.complete === 'clear' && isComplete(b, state.cap)) {
    b.length = 0;
    cleared = true;
  }
  return { from, to, count, color, cleared };
}

/** Macht einen Zug rückgängig (verändert state). */
export function undoMove(state, rec) {
  const a = state.stacks[rec.from], b = state.stacks[rec.to];
  if (rec.cleared) {
    b.length = 0;
    for (let k = 0; k < state.cap; k++) b.push(rec.color);
  }
  for (let k = 0; k < rec.count; k++) a.push(b.pop());
}

/** Gelöst: jeder Stapel ist leer oder voll und einfarbig (bei 'clear': alles abgeräumt). */
export function isSolved(state, rules = DEFAULT_RULES) {
  for (const s of state.stacks) {
    if (!s.length) continue;
    if (rules.complete === 'clear') return false;
    if (!isComplete(s, state.cap)) return false;
  }
  return true;
}

/**
 * Alle erlaubten Züge. Mit useful=true werden sinnlose Züge weggelassen
 * (einfarbigen Stapel komplett in einen leeren Stapel umziehen).
 */
export function legalMoves(state, rules = DEFAULT_RULES, { useful = true } = {}) {
  const out = [];
  const n = state.stacks.length;
  for (let f = 0; f < n; f++) {
    const a = state.stacks[f];
    if (!a.length) continue;
    for (let t = 0; t < n; t++) {
      if (t === f) continue;
      const count = moveCount(state, f, t, rules);
      if (!count) continue;
      if (useful && !state.stacks[t].length && isMono(a) && count === a.length) continue;
      out.push({ from: f, to: t, count });
    }
  }
  return out;
}

export function hasUsefulMove(state, rules = DEFAULT_RULES) {
  return legalMoves(state, rules, { useful: true }).length > 0;
}

/** Anzahl Teile pro Farbe. */
export function colorCounts(state) {
  const m = new Map();
  for (const s of state.stacks) for (const c of s) m.set(c, (m.get(c) || 0) + 1);
  return m;
}

/** Prüft die Form eines Zustands. Gibt eine Fehlermeldung oder '' zurück. */
export function validateState(state, { colors } = {}) {
  if (!state || !Number.isInteger(state.cap) || state.cap < 2) return 'cap fehlt';
  if (!Array.isArray(state.stacks) || state.stacks.length < 2) return 'stacks fehlen';
  for (const s of state.stacks) {
    if (!Array.isArray(s)) return 'Stapel ist kein Array';
    if (s.length > state.cap) return 'Stapel zu voll';
    for (const c of s) if (!Number.isInteger(c) || c < 0) return 'ungültige Farbe';
  }
  const counts = colorCounts(state);
  for (const [c, k] of counts) {
    if (k % state.cap !== 0) return `Farbe ${c}: ${k} Teile`;
  }
  if (colors != null && counts.size > colors) return 'zu viele Farben';
  return '';
}

/** Zustand vergleichbar machen (für Tests und Speicherstand). */
export function stateKey(state) {
  return state.stacks.map((s) => s.join(',')).join('|');
}
