// node --test solitaire/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, MODE_IDS, LAYOUTS, newDeal, validState, cloneState, doMove, revertOps, applyOps,
  canPick, canDrop, stockAction, legalMoves, isWon, foundTotal, makeCode, rankOf, suitOf,
  autoFoundationMove, tapTargets, maxMovable, hiddenCount,
} from '../logic/rules.js';
import { findHint, isStuck, canAutoFinish, finishActions } from '../logic/hints.js';
import { replayWins } from '../logic/replay.js';
import * as Stats from '../logic/stats.js';

const snap = (st) => JSON.stringify({ up: st.up, piles: st.piles });

test('newDeal: gültige, deterministische Partien in allen Modi', () => {
  for (const m of MODE_IDS) {
    const a = newDeal(m, 42), b = newDeal(m, 42), c = newDeal(m, 43);
    assert.ok(validState(a), m);
    assert.equal(snap(a), snap(b), m + ' deterministisch');
    assert.notEqual(snap(a), snap(c), m + ' anderer Seed → andere Partie');
  }
});

test('newDeal: Kartenverteilung je Spielart', () => {
  const k = newDeal('klondike1', 7);
  const L = LAYOUTS.klondike;
  L.tab.forEach((p, i) => {
    assert.equal(k.piles[p].length, i + 1);
    assert.equal(k.piles[p].filter((id) => k.up[id]).length, 1, 'nur oberste Karte offen');
  });
  assert.equal(k.piles[L.stock].length, 24);

  const f = newDeal('freecell', 7);
  assert.deepEqual(LAYOUTS.freecell.tab.map((p) => f.piles[p].length), [7, 7, 7, 7, 6, 6, 6, 6]);
  assert.ok(f.up.every((u) => u === 1));

  for (const [m, suits] of [['spider1', 1], ['spider2', 2], ['spider4', 4]]) {
    const s = newDeal(m, 7);
    const SL = LAYOUTS.spider;
    assert.equal(s.codes.length, 104);
    assert.equal(new Set(s.codes.map(suitOf)).size, suits);
    assert.deepEqual(SL.tab.map((p) => s.piles[p].length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    assert.equal(s.piles[SL.stock].length, 50);
    // jede Karte genau 8× (1 Farbe), 4× (2 Farben), 2× (4 Farben)
    const count = new Map();
    s.codes.forEach((c) => count.set(c, (count.get(c) || 0) + 1));
    assert.ok([...count.values()].every((n) => n === 8 / suits * 1), m);
  }
});

test('Züge und Rückgängig: zufällige Spielverläufe lassen sich exakt zurückspulen', () => {
  for (const m of MODE_IDS) {
    for (let seed = 1; seed <= 6; seed++) {
      const st = newDeal(m, seed);
      const start = snap(st);
      const hist = [];
      let x = seed * 9301;
      const rnd = (n) => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x % n; };
      for (let step = 0; step < 120; step++) {
        const moves = legalMoves(st);
        const useStock = !moves.length || rnd(5) === 0;
        if (useStock && LAYOUTS[st.game].stock >= 0) {
          const r = stockAction(st);
          if (!r.error) { hist.push(r.ops); continue; }
        }
        if (!moves.length) break;
        const mv = moves[rnd(moves.length)];
        assert.ok(canPick(st, mv.from, mv.index) && canDrop(st, mv.from, mv.index, mv.to));
        hist.push(doMove(st, mv.from, mv.index, mv.to));
        assert.ok(validState(st), `${m} gültig nach Zug`);
      }
      const mid = snap(st);
      for (let i = hist.length - 1; i >= 0; i--) revertOps(st, hist[i]);
      assert.equal(snap(st), start, `${m}/${seed}: Undo bis zum Anfang`);
      for (const ops of hist) applyOps(st, ops);
      assert.equal(snap(st), mid, `${m}/${seed}: Redo identisch`);
    }
  }
});

test('Klondike-Regeln: abwechselnde Farben, König auf leere Spalte, Ass auf Ablage', () => {
  const st = newDeal('klondike1', 1);
  const L = LAYOUTS.klondike;
  // Spalten leeren und gezielt belegen
  const all = st.piles.flat();
  st.piles = st.piles.map(() => []);
  st.up = st.up.map(() => 1);
  const idOf = (s, r) => st.codes.indexOf(makeCode(s, r));
  const put = (p, ...cards) => cards.forEach(([s, r]) => st.piles[p].push(idOf(s, r)));
  put(L.tab[0], [1, 8]);          // Herz 8
  put(L.tab[1], [0, 7]);          // Pik 7
  put(L.tab[2], [3, 7]);          // Karo 7
  put(L.tab[3], [2, 13]);         // Kreuz König
  put(L.tab[4], [0, 1]);          // Pik Ass
  const used = new Set(st.piles.flat());
  st.piles[L.stock] = all.filter((id) => !used.has(id));
  assert.ok(canDrop(st, L.tab[1], 0, L.tab[0]), 'schwarz 7 auf rot 8');
  assert.ok(!canDrop(st, L.tab[2], 0, L.tab[0]), 'rot 7 nicht auf rot 8');
  assert.ok(canDrop(st, L.tab[3], 0, L.tab[5]), 'König auf leere Spalte');
  assert.ok(!canDrop(st, L.tab[1], 0, L.tab[5]), 'nur König auf leere Spalte');
  assert.ok(canDrop(st, L.tab[4], 0, L.found[0]), 'Ass auf leere Ablage');
  assert.deepEqual(tapTargets(st, L.tab[4], 0).slice(0, 1), [L.found[0]], 'Antippen: Ablage zuerst');
  assert.equal(autoFoundationMove(st).from, L.tab[4], 'Ass fliegt automatisch');
});

test('Klondike Ziehe 3: Talon zieht drei, danach umdrehen', () => {
  const st = newDeal('klondike3', 5);
  const L = LAYOUTS.klondike;
  const r = stockAction(st);
  assert.equal(st.piles[L.waste].length, 3);
  assert.equal(st.piles[L.stock].length, 21);
  revertOps(st, r.ops);
  assert.equal(st.piles[L.stock].length, 24);
  for (let i = 0; i < 8; i++) stockAction(st);
  assert.equal(st.piles[L.stock].length, 0);
  const rec = stockAction(st);
  assert.equal(rec.ops[0].o, 'recycle');
  assert.equal(st.piles[L.stock].length, 24);
  assert.ok(st.piles[L.stock].every((id) => !st.up[id]));
});

test('FreeCell: Supermove-Grenze', () => {
  const st = newDeal('freecell', 3);
  assert.equal(maxMovable(st), 5); // 4 Zellen frei, keine leere Spalte
  const L = LAYOUTS.freecell;
  const moved = st.piles[L.tab[7]].splice(0);
  st.piles[L.cells[0]].push(moved.pop());
  st.piles[L.found[0]].push(...moved); // nur für die Zählung
  assert.equal(maxMovable(st), (3 + 1) * 2);
  assert.equal(maxMovable(st, L.tab[7]), 4, 'in die leere Spalte selbst zählt sie nicht');
});

test('Spider: vollständige Folge wandert auf die Ablage, Geben mit Lücke verboten', () => {
  const st = newDeal('spider1', 2);
  const L = LAYOUTS.spider;
  const pool = st.piles.flat();
  st.piles = st.piles.map(() => []);
  st.up = st.up.map(() => 0);
  const free = (r) => pool.find((id) => rankOf(st.codes[id]) === r && !st.piles.flat().includes(id));
  for (let r = 13; r >= 2; r--) { const id = free(r); st.piles[L.tab[0]].push(id); st.up[id] = 1; }
  const ace = free(1); st.piles[L.tab[1]].push(ace); st.up[ace] = 1;
  const rest = pool.filter((id) => !st.piles.flat().includes(id));
  // Rest auf die Spalten 2..9 und den Talon
  rest.slice(0, 40).forEach((id, k) => { st.piles[L.tab[2 + (k % 8)]].push(id); });
  st.piles[L.stock] = rest.slice(40);
  L.tab.forEach((p) => { const a = st.piles[p]; if (a.length) st.up[a[a.length - 1]] = 1; });
  assert.ok(validState(st));
  const ops = doMove(st, L.tab[1], 0, L.tab[0]);
  assert.ok(ops.some((o) => o.o === 'mv' && o.n === 13), 'Folge abgelegt');
  assert.equal(st.piles[L.found[0]].length, 13);
  assert.equal(st.piles[L.tab[0]].length, 0);
  assert.equal(stockAction(st).error, 'gap', 'leere Spalte → erst füllen');
});

test('Hinweise und Automatisch beenden', () => {
  for (const m of MODE_IDS) {
    const st = newDeal(m, 11);
    const h = findHint(st);
    assert.ok(h, m + ' hat einen Tipp');
    if (h.kind !== 'stock') assert.ok(canDrop(st, h.from, h.index, h.to), m + ' Tipp ist legal');
    assert.equal(isStuck(st), false);
  }
  // Klondike: alles offen und sortierbar → Automatisch beenden gewinnt
  const st = newDeal('klondike1', 9);
  st.up = st.up.map(() => 1);
  const L = LAYOUTS.klondike;
  st.piles = st.piles.map(() => []);
  // Pro Spalte eine Farbe absteigend: K..A
  for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) st.piles[L.tab[s]].push(st.codes.indexOf(makeCode(s, r)));
  assert.equal(hiddenCount(st), 0);
  assert.ok(canAutoFinish(st));
  const acts = finishActions(st);
  assert.ok(replayWins(st, acts));
});

test('Statistik', () => {
  let s = {};
  s = Stats.recordStart(s, 'klondike1');
  let r = Stats.recordWin(s, 'klondike1', { time: 120, moves: 90 });
  s = r.stats;
  assert.equal(r.entry.won, 1);
  assert.equal(r.records.time, false, 'erste Zeit ist kein «neuer» Rekord');
  s = Stats.recordStart(s, 'klondike1');
  r = Stats.recordWin(s, 'klondike1', { time: 100, moves: 95 });
  s = r.stats;
  assert.equal(r.records.time, true);
  assert.equal(r.records.moves, false);
  assert.equal(Stats.entry(s, 'klondike1').bestStreak, 2);
  s = Stats.recordStart(s, 'klondike1');
  s = Stats.recordLoss(s, 'klondike1');
  const e = Stats.entry(s, 'klondike1');
  assert.equal(e.streak, 0);
  assert.equal(Stats.winRate(e), 67);
  assert.equal(Stats.formatTime(65), '1:05');
  assert.equal(Stats.formatTime(3725), '1:02:05');
  assert.equal(Stats.entry(s, 'spider4').played, 0);
});

test('Modi sind vollständig beschrieben', () => {
  for (const m of MODE_IDS) {
    assert.ok(MODES[m].title && MODES[m].sub && LAYOUTS[MODES[m].game]);
    assert.equal(foundTotal(newDeal(m, 1)), 0);
    assert.equal(isWon(newDeal(m, 1)), false);
  }
  assert.ok(cloneState(newDeal('spider2', 1)).piles !== newDeal('spider2', 1).piles);
});

// Folgt den Tipps; jeder Tipp muss ausführbar sein (Spider: nie «Geben» bei leerer Spalte).
function followHints(mode, seed, steps) {
  const st = newDeal(mode, seed);
  const hist = [];
  const seen = [JSON.stringify(st.piles)];
  for (let k = 0; k < steps && !isWon(st); k++) {
    const h = findHint(st, hist);
    if (!h) break;
    let ops;
    if (h.kind === 'stock') {
      const r = stockAction(st);
      assert.ok(!r.error, `${mode} #${seed} Schritt ${k}: Tipp «Geben» nicht ausführbar (${r.error})`);
      ops = r.ops;
    } else {
      assert.ok(canPick(st, h.from, h.index) && canDrop(st, h.from, h.index, h.to), `${mode} #${seed} Schritt ${k}: Tipp illegal`);
      ops = doMove(st, h.from, h.index, h.to);
    }
    hist.push({ ops });
    const key = JSON.stringify(st.piles);
    assert.ok(!seen.slice(-12).includes(key), `${mode} #${seed} Schritt ${k}: Tipp führt zurück in eine eben gesehene Stellung`);
    seen.push(key);
  }
}

test('Tipps sind immer ausführbar und pendeln nicht hin und her', () => {
  for (let seed = 1; seed <= 12; seed++) followHints('spider1', seed, 160);
  for (let seed = 1; seed <= 6; seed++) followHints('spider2', seed, 120);
  for (let seed = 1; seed <= 12; seed++) followHints('freecell', seed, 120);
  for (let seed = 1; seed <= 6; seed++) followHints('klondike1', seed, 120);
});

test('Spider: leere Spalte → Tipp füllt sie statt zu geben', () => {
  const st = newDeal('spider1', 6);
  const L = LAYOUTS.spider;
  // Spalte 0 leeren (Karten in Spalte 1 verschieben – Struktur egal, nur Zustand)
  st.piles[L.tab[1]].push(...st.piles[L.tab[0]].splice(0));
  for (const id of st.piles[L.tab[1]]) st.up[id] = 1;
  const h = findHint(st);
  assert.ok(h && h.kind === 'move', 'kein «Geben» bei leerer Spalte');
  assert.ok(canDrop(st, h.from, h.index, h.to));
});

test('FreeCell: Karte in Zelle → kein Tipp zurück auf dieselbe Spalte', () => {
  for (const seed of [1, 2]) {
    const st = newDeal('freecell', seed);
    const L = LAYOUTS.freecell;
    const p = L.tab[7];
    const ops = doMove(st, p, st.piles[p].length - 1, L.cells[0]);
    const h = findHint(st, [{ ops }]);
    if (h && h.kind === 'move') assert.ok(!(h.from === L.cells[0] && h.to === p), 'kein Zurück-Tipp');
  }
});
