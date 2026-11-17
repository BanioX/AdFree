import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLevel, buildDaily, levelParams, dailyParams, chapterOf, starsFor, parTarget } from '../logic/levels.js';
import { applyPour, isSolved, validateState, cloneState, isComplete } from '../logic/rules.js';
import { solve } from '../logic/solver.js';
import { makeRng } from '../../shared/rng.js';
import { generate } from '../logic/generator.js';

const N = Number(process.env.SORT_LEVELS || 150);

function replaySolves(level) {
  const s = cloneState(level.state);
  for (const m of level.solution) {
    const r = applyPour(s, m.from, m.to);
    if (!r) return false;
  }
  return isSolved(s);
}

const cache = new Map();
function L(n) {
  if (!cache.has(n)) cache.set(n, buildLevel(n));
  return cache.get(n);
}

test('Level sind deterministisch (gleiche Nummer → gleiches Level)', () => {
  for (const n of [1, 2, 7, 20, 25, 42, 99, 133]) {
    const a = JSON.stringify(buildLevel(n));
    const b = JSON.stringify(buildLevel(n));
    assert.equal(a, b, `Level ${n}`);
  }
  assert.equal(JSON.stringify(buildDaily('2026-11-17')), JSON.stringify(buildDaily('2026-11-17')));
});

test(`Level 1–${N}: gültig, lösbar, nicht trivial`, () => {
  for (let n = 1; n <= N; n++) {
    const lv = L(n);
    const p = levelParams(n);
    assert.equal(validateState(lv.state), null, `Level ${n} gültig`);
    assert.ok(lv.solution && lv.solution.length === lv.par, `Level ${n} hat Lösung`);
    assert.ok(replaySolves(lv), `Level ${n}: Lösung löst das Level`);
    assert.ok(!isSolved(lv.state), `Level ${n} nicht schon gelöst`);
    for (const t of lv.state.tubes) assert.ok(!isComplete(t), `Level ${n}: kein Glas schon fertig`);
    if (!p.handmade) {
      assert.ok(lv.par >= p.minMoves, `Level ${n}: ${lv.par} Züge ≥ ${p.minMoves}`);
      assert.equal(lv.colors.length, p.colors);
      assert.equal(new Set(lv.colors).size, lv.colors.length, 'Farben verschieden');
      const empties = lv.state.tubes.filter((t) => !t.l.length).length;
      assert.equal(empties, 2, `Level ${n}: zwei leere Gläser`);
    }
  }
});

test('Mindestlänge der Lösung wächst mit dem Level', () => {
  const avg = (a, b) => {
    let s = 0, k = 0;
    for (let n = a; n <= b; n++) { s += L(n).par; k++; }
    return s / k;
  };
  const steps = [[2, 10], [11, 20], [21, 35], [36, 60], [61, 100]].filter(([, b]) => b <= N);
  let prev = 0;
  for (const [a, b] of steps) {
    const v = avg(a, b);
    assert.ok(v > prev, `Durchschnitt ${a}–${b} (${v.toFixed(1)}) > ${prev.toFixed(1)}`);
    prev = v;
  }
});

test('alle Level sind verschieden', () => {
  const seen = new Map();
  for (let n = 1; n <= N; n++) {
    const key = JSON.stringify(L(n).state.tubes.map((t) => [t.cap, t.l]));
    assert.ok(!seen.has(key), `Level ${n} gleicht Level ${seen.get(key)}`);
    seen.set(key, n);
  }
});

test('Geheimnis-Level: nur oberste Schicht sichtbar, keine gleichen Nachbarn', () => {
  let count = 0;
  for (let n = 1; n <= N; n++) {
    const lv = L(n);
    if (!lv.geheimnis) continue;
    count++;
    for (const t of lv.state.tubes) {
      if (!t.l.length) continue;
      assert.equal(t.h, t.l.length - 1, `Level ${n}: verdeckt`);
      for (let i = 1; i < t.l.length; i++) assert.notEqual(t.l[i], t.l[i - 1], `Level ${n}: keine gleichen Nachbarn`);
    }
  }
  assert.ok(count >= 10, 'genügend Geheimnis-Level');
});

test('Grosse Gläser kommen vor (5–6 Schichten)', () => {
  let filled = 0, empty = 0;
  for (let n = 1; n <= N; n++) {
    const lv = L(n);
    if (lv.gross === 'filled') {
      filled++;
      assert.ok(lv.state.tubes.some((t) => t.cap >= 5 && t.l.length === t.cap), `Level ${n}`);
    }
    if (lv.gross === 'empty') {
      empty++;
      assert.ok(lv.state.tubes.some((t) => t.cap === 6 && !t.l.length), `Level ${n}`);
    }
  }
  assert.ok(filled >= 5 && empty >= 5);
});

test('Farben 3 → 12+ und 3–16 Gläser', () => {
  let maxColors = 0, minTubes = 99, maxTubes = 0;
  for (let n = 1; n <= N; n++) {
    const lv = L(n);
    maxColors = Math.max(maxColors, lv.colors.length);
    minTubes = Math.min(minTubes, lv.state.tubes.length);
    maxTubes = Math.max(maxTubes, lv.state.tubes.length);
  }
  assert.ok(maxColors >= 12, `max Farben ${maxColors}`);
  assert.equal(minTubes, 3);
  assert.ok(maxTubes <= 16);
});

test('Tagesrätsel: 60 Tage gültig und lösbar', () => {
  const d = new Date(2026, 10, 1);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const lv = buildDaily(day);
    const p = dailyParams(day);
    assert.equal(validateState(lv.state), null);
    assert.ok(replaySolves(lv), day);
    assert.ok(lv.par >= p.minMoves, day);
    assert.equal(lv.geheimnis, p.geheimnis);
    const key = JSON.stringify(lv.state);
    assert.ok(!seen.has(key));
    seen.add(key);
    d.setDate(d.getDate() + 1);
  }
});

test('Generator: unlösbare Kandidaten werden verworfen', () => {
  // Mit nur einem leeren Glas und grossen Gläsern sind viele Kandidaten unlösbar –
  // was generate() liefert, muss trotzdem lösbar sein.
  const rng = makeRng('test-unsolvable');
  for (let i = 0; i < 5; i++) {
    const g = generate({ colors: 6, empties: 1, tall: 'filled', minMoves: 0, attempts: 40, budget: 40000 }, rng);
    if (!g) continue;
    const r = solve(g.state, { maxNodes: 300000, weight: 1.5 });
    assert.ok(r.moves, 'geliefertes Level ist lösbar');
  }
});

test('Kapitel und Sterne', () => {
  assert.equal(chapterOf(1).index, 0);
  assert.equal(chapterOf(15).index, 0);
  assert.equal(chapterOf(16).index, 1);
  assert.equal(chapterOf(16).first, 16);
  const far = chapterOf(15 * 12 + 1);
  assert.match(far.name, / II$/);
  assert.equal(starsFor({ moves: 10, par: 10, extraUsed: false }), 3);
  assert.equal(starsFor({ moves: parTarget(10), par: 10, extraUsed: false }), 3);
  assert.equal(starsFor({ moves: 10, par: 10, extraUsed: true }), 2);
  assert.equal(starsFor({ moves: 60, par: 10, extraUsed: false }), 1);
});
