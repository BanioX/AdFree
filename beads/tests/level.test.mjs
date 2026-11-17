// node --test beads/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePattern, makeState, levelConfig, generateTray, solve, Game, applyTap, cloneState,
  zoneCells, legalColumns, MAX_SLOTS, isValidPattern, remainingTraySequence, greedyClears,
} from '../level.js';
import { fixtures } from '../engine-fixtures.js';

let artPatterns = [];
try {
  const m = await import('../art/index.js');
  artPatterns = (m.patterns || m.default || []).filter(isValidPattern);
} catch { /* Bibliothek (noch) nicht vorhanden */ }

const tiny = {
  id: 'tiny', title: 'Test',
  palette: { a: '#ff0000', b: '#00ff00', c: '#0000ff', d: '#ffff00' },
  rows: ['abcd', 'aaaa'],
};

function multiset(game) {
  const st = game.st;
  const m = new Array(game.L.K).fill(0);
  for (let k = 0; k < game.L.K; k++) m[k] += st.counts[k];
  for (let s = 0; s < st.S; s++) if (st.slotK[s] >= 0) m[st.slotK[s]] += st.slotN[s];
  st.cols.forEach((col, c) => { for (let i = st.ptr[c]; i < col.length; i++) m[col[i]]++; });
  return m;
}

function playToEnd(game) {
  let guard = 0;
  while (!game.complete && guard++ < 5000) {
    const c = game.solverMove(50000);
    assert.ok(c >= 0, 'Löser findet einen Zug');
    const r = game.tap(c);
    assert.equal(r.status, 'ok');
  }
  return game.complete;
}

test('parsePattern: Masse, Farben, Füllreihenfolge von unten', () => {
  const L = parsePattern(tiny);
  assert.equal(L.W, 4);
  assert.equal(L.H, 2);
  assert.equal(L.total, 8);
  assert.equal(L.K, 4);
  // erste Farbe = unterste Zeile
  assert.equal(L.colors[0], '#ff0000');
  assert.deepEqual(Array.from(L.order.slice(0, 4)), [4, 5, 6, 7]);
  assert.equal(L.rbOf[0], 1);
  assert.equal(L.rbOf[4], 0);
});

test('parsePattern: gleiche Farben werden zusammengelegt, Punkte sind leer', () => {
  const L = parsePattern({ id: 'x', palette: { a: '#123456', b: '#123456', c: '#fff' }, rows: ['a.b', '.c.'] });
  assert.equal(L.K, 2);
  assert.equal(L.total, 3);
  assert.equal(L.cells[1], -1);
  assert.equal(L.cells[0], L.cells[2]);
});

test('Zone: die untersten R Zeilen mit leeren Zellen', () => {
  const L = parsePattern({ id: 'z', palette: { a: '#f00' }, rows: ['aa', 'aa', 'aa', 'aa'] });
  const st = makeState(L, [[0, 0, 0, 0, 0, 0, 0, 0]], 4, 2);
  assert.equal(zoneCells(L, st).length, 4);
  const t = cloneState(st);
  // eine Gruppe von 8 – alles passt, weil die Zone mitwandert
  assert.equal(applyTap(L, t, 0, null, true), 'ok');
  assert.equal(t.placed, 8);
});

test('Ablage voll -> Antippen wird abgelehnt; Kettenreaktion aus der Ablage', () => {
  const L = parsePattern(tiny);
  // a=0 (5x), b=1, c=2, d=3
  const g = new Game(L, makeState(L, [[1], [2], [3], [0, 0, 0, 0, 0]], 2, 1));
  let r = g.tap(0);
  assert.equal(r.status, 'ok');
  assert.equal(r.moves[0].t, 'park');
  r = g.tap(1);
  assert.equal(r.status, 'ok');
  assert.equal(r.moves[0].t, 'park');
  assert.deepEqual(g.legalColumns(), [3]);
  r = g.tap(2);
  assert.equal(r.status, 'refused');
  assert.equal(g.st.ptr[2], 0, 'abgelehnter Zug verändert nichts');
  r = g.tap(3);
  assert.equal(r.status, 'ok');
  const unparks = r.moves.filter((m) => m.t === 'unpark');
  assert.equal(unparks.length, 2, 'b und c fliegen automatisch ins Bild');
  assert.equal(g.st.slotK[0], -1);
  assert.equal(g.st.slotK[1], -1);
  r = g.tap(2);
  assert.equal(r.status, 'ok');
  assert.ok(g.complete);
  assert.equal(g.stars(), 3);
});

test('Festgefahren wird erkannt, +1 Ablage hilft', () => {
  const L = parsePattern(tiny);
  const g = new Game(L, makeState(L, [[1], [2], [3, 0, 0, 0, 0, 0]], 1, 1));
  assert.equal(g.tap(0).status, 'ok');
  // Ablage (1 Platz) belegt mit b; c und d brauchen neue Plätze
  assert.ok(g.isStuck());
  assert.ok(g.addSlot());
  assert.ok(!g.isStuck());
  assert.equal(g.stars(), 2);
});

test('Erzeugung ist deterministisch (gleicher Seed = gleicher Vorrat)', () => {
  const L = parsePattern(fixtures[2]);
  const cfg = { ...levelConfig(L, 7), seed: 'det-1' };
  const a = generateTray(L, cfg);
  const b = generateTray(L, cfg);
  assert.deepEqual(a.cols, b.cols);
  const c = generateTray(L, { ...cfg, seed: 'det-2' });
  assert.notDeepEqual(a.cols, c.cols);
});

test('Vorrat enthält genau die Steine des Bildes', () => {
  for (const p of fixtures) {
    const L = parsePattern(p);
    const g = Game.create(L, { ...levelConfig(L, 9), seed: 'ms-' + p.id });
    assert.deepEqual(multiset(g), Array.from(L.colorTotals));
  }
});

function checkSolvable(list, label) {
  list.forEach((p, i) => {
    const n = i + 1;
    const L = parsePattern(p);
    const cfg = { ...levelConfig(L, n), seed: `beads:${p.id}:${n}` };
    const gen = generateTray(L, cfg);
    assert.ok(gen.solvable, `${label} ${p.id}: Erzeugung lösbar`);
    // unabhängig prüfen: mit S - slack Plätzen lösbar
    const st = makeState(L, gen.cols, Math.max(1, cfg.S - cfg.slack), cfg.R, gen.pri);
    const res = solve(L, st, { maxNodes: 60000 });
    assert.ok(res.solvable, `${label} ${p.id}: Löser bestätigt`);
    // und die Lösung wirklich durchspielen
    const g = new Game(L, makeState(L, gen.cols, cfg.S, cfg.R, gen.pri));
    for (const c of res.path) assert.equal(g.tap(c).status, 'ok');
    assert.ok(g.complete, `${label} ${p.id}: fertig gespielt`);
  });
}

test('alle Ersatz-Muster sind ohne Helfer lösbar', () => checkSolvable(fixtures, 'fixture'));

test('alle Muster der Bibliothek sind ohne Helfer lösbar', { skip: !artPatterns.length && 'keine Bibliothek' }, () => {
  checkSolvable(artPatterns, 'art');
});

test('Schwierigkeitskurve: auch ein gieriger Spielstil kommt ohne Helfer durch', { skip: !artPatterns.length && 'keine Bibliothek' }, () => {
  artPatterns.forEach((p, i) => {
    const n = i + 1;
    const L = parsePattern(p);
    const cfg = { ...levelConfig(L, n), seed: `beads:${p.id}:${n}` };
    const gen = generateTray(L, cfg);
    const fresh = (S = cfg.S) => makeState(L, gen.cols, S, cfg.R, gen.pri);
    assert.ok(greedyClears(L, fresh()), `Level ${n} ${p.id}: gierig lösbar`);
    if (n > 24) return;
    // frühe Level: auch mit gelegentlichen Fehltipps fast immer ohne Helfer (QA: Spitzen bei Level 8/16)
    let stuck = 0;
    for (let r = 0; r < 12; r++) if (!greedyClears(L, fresh(), { noise: 0.05, seed: `t${r}` })) stuck++;
    assert.ok(stuck <= (n <= 18 ? 1 : 3), `Level ${n} ${p.id}: ${stuck}/12 Mal stecken geblieben`);
  });
});

test('Bibliothek auch in späteren Runden (höhere Schwierigkeit) lösbar', { skip: !artPatterns.length && 'keine Bibliothek' }, () => {
  const P = artPatterns.length;
  artPatterns.forEach((p, i) => {
    const n = i + 1 + P * 2;
    const L = parsePattern(p);
    const cfg = { ...levelConfig(L, n), seed: `beads:${p.id}:${n}` };
    const gen = generateTray(L, cfg);
    assert.ok(gen.solvable, `${p.id} (Level ${n})`);
  });
});

test('Magnet legt bis zu 8 Steine, Steinmenge bleibt korrekt', () => {
  const L = parsePattern(fixtures[3]);
  const g = Game.create(L, { ...levelConfig(L, 12), seed: 'mag' });
  const before = g.st.placed;
  const moves = g.magnet();
  const placedMoves = moves.filter((m) => m.t === 'place' || m.t === 'unpark').length;
  assert.ok(moves.length >= 8);
  assert.equal(g.st.placed - before, placedMoves);
  assert.deepEqual(multiset(g), Array.from(L.colorTotals));
  assert.equal(g.meta.helpers.magnet, 1);
  assert.ok(playToEnd(g));
  assert.equal(g.stars(), 2);
});

test('Mischen: gleiche Steine, danach lösbar', () => {
  for (const p of fixtures) {
    const L = parsePattern(p);
    const g = Game.create(L, { ...levelConfig(L, 15), seed: 'mix-' + p.id });
    // ein paar Züge spielen, dann mischen
    for (let i = 0; i < 4 && !g.complete; i++) {
      const legal = g.legalColumns();
      if (!legal.length) break;
      g.tap(legal[legal.length - 1]);
    }
    if (g.complete) continue;
    const seqLen = remainingTraySequence(L, g.st).length;
    assert.equal(seqLen, g.traySize());
    g.shuffle();
    assert.deepEqual(multiset(g), Array.from(L.colorTotals));
    assert.ok(playToEnd(g), p.id + ' nach Mischen lösbar');
  }
});

test('Speichern und Wiederherstellen', () => {
  const L = parsePattern(fixtures[4]);
  const g = Game.create(L, { ...levelConfig(L, 6), seed: 'save' });
  for (let i = 0; i < 6 && !g.complete; i++) {
    const legal = g.legalColumns();
    g.tap(legal[i % legal.length]);
  }
  g.addSlot();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const h = Game.restore(L, data);
  assert.ok(h);
  assert.equal(h.st.placed, g.st.placed);
  assert.equal(h.st.S, g.st.S);
  assert.deepEqual(h.trayColumns(), g.trayColumns());
  assert.deepEqual(Array.from(h.filledMask()), Array.from(g.filledMask()));
  assert.equal(h.meta.helpers.slot, 1);
  assert.ok(playToEnd(h));
  // kaputte Daten -> null
  assert.equal(Game.restore(L, { ...data, counts: data.counts.map(() => 0) }), null);
  assert.equal(Game.restore(L, null), null);
});

test('schnelle Mehrfach-Taps: Zustand bleibt konsistent', () => {
  const L = parsePattern(fixtures[5]);
  const g = Game.create(L, { ...levelConfig(L, 20), seed: 'spam' });
  for (let i = 0; i < 400 && !g.complete; i++) {
    g.tap(i % g.st.cols.length);
    assert.deepEqual(multiset(g), Array.from(L.colorTotals));
    if (g.isStuck()) g.addSlot() || g.magnet();
  }
});

test('MAX_SLOTS begrenzt +1 Ablage', () => {
  const L = parsePattern(tiny);
  const g = new Game(L, makeState(L, [[0, 0, 0, 0, 0], [1], [2], [3]], 4, 1));
  let n = 0;
  while (g.addSlot()) n++;
  assert.equal(g.st.S, MAX_SLOTS);
  assert.equal(n, MAX_SLOTS - 4);
  assert.deepEqual(legalColumns(L, g.st), [0, 1, 2, 3]);
});
