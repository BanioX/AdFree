import assert from 'node:assert/strict';
import test from 'node:test';
import { FLEET, N, aiShot, begin, canPlace, newGame, placeFleet, placeShip, shoot } from '../logic.js';

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s % 1000) / 1000;
  };
}

test('Schiffe dürfen sich nicht berühren und nicht über den Rand', () => {
  const grid = Array(N * N).fill(0);
  const ships = [];
  assert.equal(placeShip(grid, ships, 3, 0, 0, 'h'), true);
  assert.equal(canPlace(grid, 2, 0, 3, 'h'), null);
  assert.equal(canPlace(grid, 2, 1, 0, 'h'), null);
  assert.equal(canPlace(grid, 2, 0, 9, 'h'), null);
  assert.equal(placeShip(grid, ships, 2, 2, 5, 'v'), true);
  assert.equal(ships.length, 2);
});

test('Zufallsflotte legt fünf Schiffe ohne Berührung', () => {
  const fleet = placeFleet(rng(3));
  assert.ok(fleet);
  assert.equal(fleet.ships.length, FLEET.length);
  const seen = new Set();
  for (const ship of fleet.ships) {
    assert.equal(ship.cells.length, ship.len);
    for (const i of ship.cells) {
      assert.equal(seen.has(i), false);
      seen.add(i);
      assert.equal(fleet.grid[i], ship.id);
    }
  }
});

test('Treffer gibt einen weiteren Schuss, Versenken beendet', () => {
  const state = newGame();
  state.me = Array(N * N).fill(0);
  state.meShips = [];
  placeShip(state.me, state.meShips, 2, 0, 0, 'h');
  begin(state, placeFleet(rng(2)));
  state.turn = 2;
  const first = shoot(state, 0);
  assert.equal(first.hit, true);
  assert.equal(state.turn, 2);
  assert.equal(state.extra, true);
  const second = shoot(state, 1);
  assert.equal(second.sunk, true);
  assert.equal(state.over, true);
  assert.equal(state.winner, 2);
  assert.equal(shoot(state, 2), null);
});

test('Ein Fehlschuss wechselt den Zug', () => {
  const state = newGame();
  begin(state, placeFleet(rng(4)));
  const empty = state.foe.findIndex((v) => v === 0);
  const res = shoot(state, empty);
  assert.equal(res.hit, false);
  assert.equal(state.turn, 2);
  assert.equal(state.seen[empty], 1);
});

test('Schwere KI schiesst neben einen offenen Treffer', () => {
  const state = newGame();
  state.phase = 'fight';
  state.turn = 2;
  state.me = Array(N * N).fill(0);
  state.meShips = [];
  placeShip(state.me, state.meShips, 4, 4, 2, 'h');
  state.echo[4 * N + 2] = 2;
  state.meShips[0].hits = 1;
  const picks = new Set();
  for (let k = 0; k < 12; k++) picks.add(aiShot(state, 'schwer', () => (k % 5) / 5));
  for (const i of picks) {
    const near = i === 4 * N + 3 || i === 4 * N + 1 || i === 3 * N + 2 || i === 5 * N + 2;
    assert.equal(near, true, 'Schuss ' + i);
  }
});
