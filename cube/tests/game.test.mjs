import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../generator.js';
import { makeCube } from '../geometry.js';
import { Game } from '../game.js';

test('Freie Pfeile entfernen bis zum Sieg', () => {
  for (const L of [1, 3, 12, 40]) {
    const lv = generateLevel(L);
    const g = new Game(lv, makeCube(lv.N));
    let guard = 0;
    while (!g.won && guard++ < 1000) {
      const free = g.freeIds();
      assert.ok(free.length > 0, 'nie festgefahren');
      for (const id of free) assert.ok(g.remove(id));
    }
    assert.ok(g.won);
    assert.equal(g.remaining, 0);
    assert.equal(g.stars(), 3);
  }
});

test('Blockierte Pfeile melden Hindernis und Abstand', () => {
  const lv = generateLevel(15);
  const geo = makeCube(lv.N);
  const g = new Game(lv, geo);
  let found = 0;
  for (let i = 0; i < g.n; i++) {
    const r = g.check(i);
    if (r.free) continue;
    found++;
    const ray = g.rays[i];
    assert.equal(g.occ[ray[r.dist]], r.blocker);
    for (let k = 0; k < r.dist; k++) assert.equal(g.occ[ray[k]], -1);
    assert.notEqual(r.blocker, i);
  }
  assert.ok(found > 0);
});

test('Entfernter Pfeil blockiert sofort nicht mehr', () => {
  const lv = generateLevel(20);
  const g = new Game(lv, makeCube(lv.N));
  const blocked = [];
  for (let i = 0; i < g.n; i++) { const r = g.check(i); if (!r.free) blocked.push([i, r.blocker]); }
  const [victim, blocker] = blocked.find(([, b]) => g.isFree(b)) || [];
  assert.ok(victim != null);
  g.remove(blocker);
  const r2 = g.check(victim);
  assert.ok(r2.free || r2.blocker !== blocker);
});

test('Herzen, Fehler und Sterne', () => {
  const lv = generateLevel(5);
  const g = new Game(lv, makeCube(lv.N));
  assert.equal(g.hearts, lv.hearts);
  g.loseHeart();
  assert.equal(g.stars(), 2);
  g.loseHeart();
  assert.equal(g.stars(), 1);
  while (g.hearts > 0) g.loseHeart();
  assert.equal(g.hearts, 0);
  g.loseHeart();
  assert.equal(g.hearts, 0);
});

test('Spielstand speichern und wiederherstellen', () => {
  const lv = generateLevel(9);
  const geo = makeCube(lv.N);
  const g = new Game(lv, geo);
  const free = g.freeIds();
  g.remove(free[0]);
  g.loseHeart();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = new Game(lv, geo, data);
  assert.equal(g2.remaining, g.remaining);
  assert.equal(g2.hearts, g.hearts);
  assert.equal(g2.mistakes, 1);
  assert.deepEqual([...g2.removed], [...g.removed]);
  // Ungültige Daten werden ignoriert
  const g3 = new Game(lv, geo, { removed: [-1, 99999, 'x', free[0], free[0]], hearts: 99 });
  assert.equal(g3.removedCount, 1);
  assert.equal(g3.hearts, lv.hearts);
});
