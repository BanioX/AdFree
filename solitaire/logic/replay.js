// Spielt eine Aktionsliste (Löser-Ausgabe) auf einer Kopie nach und prüft, ob sie gewinnt.
import { cloneState, canDrop, doMove, stockAction, isWon, canPick } from './rules.js';

export function replayWins(st0, actions) {
  const st = cloneState(st0);
  for (const a of actions) {
    if (a.t === 'stock') {
      if (stockAction(st).error) return false;
    } else {
      if (!canPick(st, a.from, a.index) && st.game !== 'freecell') return false;
      if (!canDrop(st, a.from, a.index, a.to)) return false;
      doMove(st, a.from, a.index, a.to);
    }
  }
  return isWon(st);
}
