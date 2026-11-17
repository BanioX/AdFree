// Web Worker: Löser im Hintergrund (Partien prüfen, Tipps für FreeCell, automatisch beenden).
import { solveSeed, solveState } from './logic/solve.js';

self.onmessage = (e) => {
  const { id, cmd, mode, seed, state, opts } = e.data || {};
  let res;
  try {
    if (cmd === 'seed') res = solveSeed(mode, seed, opts || {});
    else if (cmd === 'state') res = solveState(state, opts || {});
    else res = { error: 'cmd' };
  } catch (err) {
    res = { error: String(err && err.message || err) };
  }
  self.postMessage({ id, ...res });
};
