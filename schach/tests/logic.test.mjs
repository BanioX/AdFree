import assert from 'node:assert/strict';
import test from 'node:test';
import { aiMove, apply, clone, finishIf, inCheck, insufficient, legal, newGame, perft, sameMove, undo } from '../logic.js';

test('Perft der Grundstellung', () => {
  const s = newGame();
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
  assert.equal(s.turn, 1);
  assert.equal(s.board[4], 6);
});

test('Rochade, en passant und Umwandlung sind dabei', () => {
  const s = newGame();
  const castle = () => {
    const state = newGame();
    state.board[6] = 0; state.board[5] = 0;
    state.board[1] = 0; state.board[2] = 0; state.board[3] = 0;
    const list = legal(state);
    assert.ok(list.some((m) => m.from === 4 && m.to === 6 && m.rookFrom === 7));
    assert.ok(list.some((m) => m.from === 4 && m.to === 2 && m.rookFrom === 0));
    const m = list.find((x) => x.to === 6 && x.from === 4);
    apply(state, m);
    assert.equal(state.board[6], 6);
    assert.equal(state.board[5], 4);
    assert.equal(state.board[7], 0);
    undo(state, m);
    assert.equal(state.board[4], 6);
    assert.equal(state.board[7], 4);
  };
  castle();
  s.board = Array(64).fill(0);
  s.board[36] = 1;
  s.board[35] = -1;
  s.ep = 43;
  const ep = legal(s).find((m) => m.epCapture === 35);
  assert.ok(ep);
  apply(s, ep);
  assert.equal(s.board[43], 1);
  assert.equal(s.board[35], 0);
  undo(s, ep);
  assert.equal(s.board[36], 1);
  assert.equal(s.board[35], -1);

  const p = newGame();
  p.board = Array(64).fill(0);
  p.board[0] = 6;
  p.board[63] = -6;
  p.board[52] = 1;
  p.rights = 0;
  const promos = legal(p).filter((m) => m.from === 52);
  assert.equal(promos.length, 4);
});

test('Matt, Patt und KI zieht legal', () => {
  const mate = newGame();
  mate.board = Array(64).fill(0);
  mate.turn = -1;
  mate.rights = 0;
  mate.board[0] = -6;
  mate.board[16] = 5;
  mate.board[2] = 4;
  mate.board[7] = 6;
  assert.equal(legal(mate).length, 0);
  assert.equal(inCheck(mate, -1), true);
  finishIf(mate, null);
  assert.equal(mate.reason, 'mate');

  const stale = newGame();
  stale.board = Array(64).fill(0);
  stale.turn = -1;
  stale.rights = 0;
  stale.board[0] = -6;
  stale.board[17] = 5;
  stale.board[7] = 6;
  assert.equal(legal(stale).length, 0);
  assert.equal(inCheck(stale, -1), false);
  finishIf(stale, null);
  assert.equal(stale.reason, 'stalemate');

  const bare = Array(64).fill(0);
  bare[0] = 6;
  bare[63] = -6;
  assert.equal(insufficient(bare), true);

  const s = newGame();
  const m = aiMove(s, 'mittel');
  assert.ok(legal(s).some((x) => sameMove(x, m)));
  const copy = clone(s);
  apply(s, m);
  undo(s, m);
  assert.deepEqual(s.board, copy.board);
  assert.equal(s.turn, copy.turn);
});
