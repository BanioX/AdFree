// Zugwahl für Brettspiele: Negamax mit Alpha-Beta und iterativer Vertiefung.
// Drei Stärken (leicht / mittel / schwer). Die Regeln bleiben im jeweiligen Spiel.
//
//   pickMove({
//     state, clone, moves, apply, undo, evaluate, outcome,
//     difficulty: 'mittel',
//     depth: { leicht: 2, mittel: 4, schwer: 7 },
//     noise: { leicht: 0.5, mittel: 0.06, schwer: 0 },
//     time:  { leicht: 50, mittel: 200, schwer: 450 },
//     rank(state, move) => number,   // optional, höhere Werte zuerst
//     key(move) => string,           // optional
//     random() => 0..1,              // optional
//   })

const PRESET = {
  leicht: { depth: 2, noise: 0.5, time: 70 },
  mittel: { depth: 4, noise: 0.06, time: 220 },
  schwer: { depth: 6, noise: 0, time: 460 },
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function pick(table, diff, fallback) {
  if (table && typeof table === 'object' && diff in table) return table[diff];
  if (typeof table === 'number') return table;
  return fallback;
}

/**
 * Wählt einen Zug. `outcome(state)` liefert null (läuft), 0 (Remis) oder die
 * Sieger-Seite (dieselbe Kennung wie `state.turn`). `evaluate` bewertet aus
 * Sicht der Seite, die am Zug ist – deutlich kleiner als 100000.
 */
export function pickMove(opts) {
  const diff = opts.difficulty || 'mittel';
  const preset = PRESET[diff] || PRESET.mittel;
  const maxDepth = pick(opts.depth, diff, preset.depth);
  const noise = pick(opts.noise, diff, preset.noise);
  const budget = pick(opts.time, diff, preset.time);
  const random = opts.random || Math.random;
  const key = opts.key || ((m) => (typeof m === 'object' ? JSON.stringify(m) : String(m)));
  const state = opts.clone(opts.state);

  const rootMoves = opts.moves(state);
  if (!rootMoves.length) return null;
  if (rootMoves.length === 1) return rootMoves[0];

  const deadline = now() + budget;
  let timedOut = false;
  let nodes = 0;
  const NODE_CAP = 250000;

  function ordered(s, list) {
    if (!opts.rank || list.length < 2) return list.slice();
    return list.slice().sort((a, b) => opts.rank(s, b) - opts.rank(s, a));
  }

  function terminal(s, ply) {
    const o = opts.outcome(s);
    if (o == null) return null;
    if (o === 0) return 0;
    return (o === s.turn ? 1 : -1) * (100000 - ply);
  }

  // Extra-Zug (z.B. Kalaha): am Zug bleibt dieselbe Seite, dann wird nicht negiert.
  function after(s, turnBefore, depth, alpha, beta, ply) {
    const same = s.turn === turnBefore && opts.outcome(s) == null;
    if (same) return search(s, depth - 1, alpha, beta, ply + 1);
    return -search(s, depth - 1, -beta, -alpha, ply + 1);
  }

  function search(s, depth, alpha, beta, ply) {
    const done = terminal(s, ply);
    if (done != null) return done;
    if (++nodes > NODE_CAP || now() > deadline) {
      timedOut = true;
      return opts.evaluate(s);
    }
    if (depth === 0) return opts.evaluate(s);
    let list = opts.moves(s);
    if (!list.length) return -(100000 - ply);
    list = ordered(s, list);
    let best = -Infinity;
    for (const m of list) {
      const turnBefore = s.turn;
      opts.apply(s, m);
      const v = after(s, turnBefore, depth, alpha, beta, ply);
      opts.undo(s, m);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
      if (timedOut) break;
    }
    return best;
  }

  let bestMove = rootMoves[Math.floor(rootMoves.length / 2)] || rootMoves[0];
  let completed = null;

  for (let d = 1; d <= maxDepth; d++) {
    if (d > 1 && now() > deadline) break;
    timedOut = false;
    nodes = 0;
    const scores = new Map();
    let alpha = -Infinity;
    let localBest = bestMove;
    let localScore = -Infinity;
    const list = ordered(state, rootMoves);
    const prefer = list.findIndex((m) => key(m) === key(bestMove));
    if (prefer > 0) {
      const [m] = list.splice(prefer, 1);
      list.unshift(m);
    }
    for (const m of list) {
      if (d > 1 && now() > deadline) { timedOut = true; break; }
      const turnBefore = state.turn;
      opts.apply(state, m);
      const v = after(state, turnBefore, d, alpha, Infinity, 0);
      opts.undo(state, m);
      scores.set(key(m), v);
      if (v > localScore) { localScore = v; localBest = m; }
      if (v > alpha) alpha = v;
    }
    if (timedOut && d > 1) break;
    bestMove = localBest;
    completed = { depth: d, scores, score: localScore };
  }

  if (!completed || !(noise > 0)) return bestMove;

  const entries = rootMoves.map((m) => ({ m, s: completed.scores.get(key(m)) ?? -Infinity }));
  entries.sort((a, b) => b.s - a.s);
  const safe = entries.filter((e) => e.s > -50000);
  const pool = safe.length ? safe : entries;
  const span = pool[0].s - pool[pool.length - 1].s;
  const margin = Math.max(8, span * noise);
  const near = pool.filter((e) => pool[0].s - e.s <= margin + 0.5);
  if (near.length < 2) return bestMove;
  if (random() < Math.min(0.92, noise + 0.15)) return near[Math.floor(random() * near.length)].m;
  return bestMove;
}
