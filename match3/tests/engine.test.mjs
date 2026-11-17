// node --test match3/tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, parseLevel, SP, Rng, zenLevel } from '../engine.js';

// ---------- Hilfen ----------

/** Level aus Karte; danach Brett gezielt belegen. */
function make(map, opts = {}) {
  return new Game(parseLevel({ map, colors: 6, moves: 20, goals: [{ type: 'score', n: 1e9 }], seed: 7, ...opts }, 1));
}

/**
 * Belegt das Brett: Tokens pro Zeile, durch Leerzeichen getrennt.
 *   0..5 Juwel   h3/v3/b3 Spezial der Farbe 3   R Regenbogen   A Eichel   s/S Stein   _ leer   x Loch (unverändert)
 */
function setBoard(g, rows) {
  let id = 1000;
  rows.forEach((row, r) => {
    row.trim().split(/\s+/).forEach((tok, c) => {
      const i = r * g.w + c;
      if (tok === 'x') return;
      let p = null;
      if (/^[0-5]$/.test(tok)) p = { t: 'g', c: +tok, sp: 0, hp: 0 };
      else if (/^[hvb][0-5]$/.test(tok)) p = { t: 'g', c: +tok[1], sp: { h: SP.H, v: SP.V, b: SP.BOMB }[tok[0]], hp: 0 };
      else if (tok === 'R') p = { t: 'g', c: -1, sp: SP.RAINBOW, hp: 0 };
      else if (tok === 'A') p = { t: 'i', c: -1, sp: 0, hp: 0 };
      else if (tok === 's' || tok === 'S') p = { t: 's', c: -1, sp: 0, hp: tok === 's' ? 1 : 2 };
      else if (tok !== '_') throw new Error('token ' + tok);
      g.cells[i] = p ? { id: id++, ...p } : null;
    });
  });
  g.nextId = id;
}

const full = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
const I = (g, r, c) => r * g.w + c;
/** Neutrales Füllmuster ohne Dreier (Farben 3,4,5 diagonal versetzt). */
function filler(w, h) {
  const rows = [];
  for (let r = 0; r < h; r++) {
    const t = [];
    for (let c = 0; c < w; c++) t.push(String(3 + ((r + c * 2) % 3)));
    rows.push(t.join(' '));
  }
  return rows;
}
function withRow(rows, r, tokens) { const out = rows.slice(); out[r] = tokens; return out; }

// ---------- Tests ----------

test('Rng ist deterministisch und speicherbar', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let k = 0; k < 50; k++) assert.equal(a.next(), b.next());
  const c = new Rng(a.s);
  assert.equal(a.next(), c.next());
});

test('parseLevel liest Karte, Eis, Steine, Eicheln und prüft Fehler', () => {
  const L = parseLevel({ map: ['.-iI', 'sSa.', '....'], goals: [{ type: 'ice' }] }, 3);
  assert.equal(L.w, 4); assert.equal(L.h, 3);
  assert.deepEqual(L.mask.slice(0, 4), [1, 0, 1, 1]);
  assert.deepEqual(L.ice.slice(0, 4), [0, 0, 1, 2]);
  assert.deepEqual(L.stone.slice(4, 8), [1, 2, 0, 0]);
  assert.deepEqual(L.items, [6]);
  assert.throws(() => parseLevel({ map: ['..x'] }, 1));
  assert.throws(() => parseLevel({ map: ['...', '..'] }, 1));
  assert.throws(() => parseLevel({ map: ['...'], colors: 4, goals: [{ type: 'color', color: 5, n: 3 }] }, 1));
});

test('Startbrett: keine fertigen Dreier, immer ein möglicher Zug (viele Seeds)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = new Game(parseLevel({ map: full(8, 8), colors: 3 + (seed % 4), seed, goals: [{ type: 'score', n: 100 }] }, 1));
    assert.equal(g.findMatches().length, 0, 'Dreier bei Seed ' + seed);
    assert.ok(g.hasMove(), 'kein Zug bei Seed ' + seed);
  }
});

test('Ungültiger Tausch springt zurück und kostet keinen Zug', () => {
  const g = make(full(5, 5));
  setBoard(g, filler(5, 5));
  const before = JSON.stringify(g.save());
  const res = g.swap(0, 1);
  assert.equal(res.ok, false);
  assert.equal(res.events[0].type, 'swap');
  assert.equal(JSON.stringify(g.save()), before);
  assert.equal(g.swap(0, 7), null, 'nicht benachbart');
});

test('Dreier verschwindet, Brett füllt sich, Punkte und Zug zählen', () => {
  const g = make(full(5, 5));
  setBoard(g, withRow(filler(5, 5), 4, '0 0 1 0 3'));
  const moves = g.movesLeft;
  const res = g.swap(I(g, 4, 2), I(g, 4, 3));
  assert.ok(res.ok);
  assert.equal(g.movesLeft, moves - 1);
  assert.ok(g.score >= 60);
  assert.ok(g.collected[0] >= 3);
  assert.ok(g.cells.every((p) => p), 'alles wieder gefüllt');
  assert.equal(g.findMatches().length, 0, 'stabil');
  const types = res.events.map((e) => e.type);
  assert.deepEqual(types.slice(0, 3), ['swap', 'clear', 'fall']);
});

test('Vier in einer Reihe ergeben ein Blitz-Juwel an der Tauschstelle', () => {
  const g = make(full(6, 6));
  setBoard(g, withRow(withRow(filler(6, 6), 5, '0 0 1 0 3 4'), 4, '5 4 0 3 4 5'));
  // Juwel 0 von (4,2) nach (5,2) – waagrechte Vierer-Reihe
  const res = g.swap(I(g, 4, 2), I(g, 5, 2));
  assert.ok(res.ok);
  const clear = res.events.find((e) => e.type === 'clear');
  assert.equal(clear.created.length, 1);
  assert.equal(clear.created[0].sp, SP.H);
  assert.equal(clear.created[0].i, I(g, 5, 2));
});

test('L-Form ergibt eine Bombe an der Kreuzung', () => {
  const g = make(full(6, 6));
  const rows = filler(6, 6);
  rows[3] = '1 3 4 5 3 4';
  rows[4] = '1 4 5 3 4 5';
  rows[5] = '2 1 1 4 5 3';
  setBoard(g, rows);
  const res = g.swap(I(g, 5, 0), I(g, 5, 1)); // 1 nach (5,0)?? nein: tauscht 2 und 1
  // Nach dem Tausch: Spalte 0 hat 1,1,1 (Zeilen 3..5)? (5,0)=1 und Zeile 5 hat 1,2,1 – eher kein L.
  assert.ok(res === null || res.ok !== undefined);
  // Gezielt: L aus Zeile 5 (0,1,2) und Spalte 0 (3,4,5)
  const g2 = make(full(6, 6));
  const r2 = filler(6, 6);
  r2[3] = '1 3 4 5 3 4';
  r2[4] = '1 4 5 3 4 5';
  r2[5] = '5 1 1 4 5 3';
  r2[2] = '3 4 5 3 4 5';
  setBoard(g2, r2);
  // (5,0)=5 mit (4,0)? Nein – wir tauschen 1 von oben in die Ecke: (4,0)=1 ↔ (5,0)=5 ergibt Zeile 5: 1 1 1 und Spalte 0: 1(3),5(4),1(5)
  // Einfacher: Brett direkt so setzen, dass findMatches eine L-Form sieht.
  const g3 = make(full(5, 5));
  setBoard(g3, [
    '3 4 5 3 4',
    '1 5 3 4 5',
    '1 3 4 5 3',
    '1 1 1 3 4',
    '4 5 3 4 5',
  ]);
  const groups = g3.findMatches();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].create.sp, SP.BOMB);
  assert.equal(groups[0].create.at, I(g3, 3, 0));
  assert.equal(groups[0].cells.length, 5);
});

test('Fünf in einer Reihe ergeben ein Regenbogen-Juwel', () => {
  const g = make(full(5, 5));
  setBoard(g, [
    '3 4 5 3 4',
    '4 5 3 4 5',
    '5 3 4 5 3',
    '2 2 2 2 2',
    '4 5 3 4 5',
  ]);
  const groups = g.findMatches();
  assert.equal(groups[0].create.sp, SP.RAINBOW);
});

test('Blitz-Juwel räumt die ganze Reihe ab', () => {
  const g = make(full(6, 6));
  const rows = filler(6, 6);
  rows[5] = 'h0 0 1 3 3 4';   // Tausch ergibt einen Dreier inkl. Blitz-Juwel (kein neues Spezial)
  rows[4] = '5 4 0 3 4 5';
  setBoard(g, rows);
  const res = g.swap(I(g, 4, 2), I(g, 5, 2));
  const clear = res.events.find((e) => e.type === 'clear');
  assert.ok(clear.effects.some((e) => e.k === 'line' && e.dir === 'h' && e.r === 5));
  const row5 = clear.cleared.filter((x) => x.i >= 30).length;
  assert.equal(row5, 6, 'alle 6 Zellen der untersten Reihe');
});

test('Bombe räumt 3×3 ab', () => {
  const g = make(full(6, 6));
  const rows = filler(6, 6);
  rows[5] = '3 4 1 0 0 b2';
  rows[4] = '5 3 4 5 2 4';
  setBoard(g, rows);
  // Kein direkter Dreier nötig: Hammer auf die Bombe
  const res = g.hammer(I(g, 5, 5));
  const clear = res.events.find((e) => e.type === 'clear');
  assert.ok(clear.effects.some((e) => e.k === 'bomb'));
  const set = new Set(clear.cleared.map((x) => x.i));
  for (const [r, c] of [[4, 4], [4, 5], [5, 4], [5, 5]]) assert.ok(set.has(I(g, r, c)));
});

test('Regenbogen + Juwel: alle Juwelen dieser Farbe verschwinden', () => {
  const g = make(full(5, 5));
  setBoard(g, [
    '0 4 5 3 0',
    '4 5 0 4 5',
    '5 3 4 5 3',
    '0 R 3 4 0',
    '4 5 3 0 5',
  ]);
  const zeros = g.cells.filter((p) => p && p.c === 0).length;
  const res = g.swap(I(g, 3, 1), I(g, 3, 0));
  assert.ok(res.ok);
  const clear = res.events.find((e) => e.type === 'clear');
  assert.equal(clear.cleared.filter((x) => x.c === 0).length, zeros);
  assert.ok(clear.effects.some((e) => e.k === 'rainbow' && e.color === 0));
});

test('Spezial-Kombinationen: Blitz+Blitz, Bombe+Bombe, Regenbogen+Regenbogen', () => {
  const g = make(full(7, 7));
  const rows = filler(7, 7);
  rows[3] = '3 4 5 h0 v1 4 5';
  setBoard(g, rows);
  let res = g.swap(I(g, 3, 3), I(g, 3, 4));
  let clear = res.events.find((e) => e.type === 'clear');
  let set = new Set(clear.cleared.map((x) => x.i));
  for (let c = 0; c < 7; c++) assert.ok(set.has(I(g, 3, c)), 'Reihe');
  for (let r = 0; r < 7; r++) assert.ok(set.has(I(g, r, 4)), 'Spalte');

  const g2 = make(full(7, 7));
  const rows2 = filler(7, 7);
  rows2[3] = '3 4 5 b0 b1 4 5';
  setBoard(g2, rows2);
  res = g2.swap(I(g2, 3, 3), I(g2, 3, 4));
  clear = res.events.find((e) => e.type === 'clear');
  set = new Set(clear.cleared.map((x) => x.i));
  for (let r = 1; r <= 5; r++) for (let c = 2; c <= 6; c++) assert.ok(set.has(I(g2, r, c)), `5×5 ${r},${c}`);

  const g3 = make(full(6, 6));
  const rows3 = filler(6, 6);
  rows3[2] = '3 4 R R 4 5';
  setBoard(g3, rows3);
  res = g3.swap(I(g3, 2, 2), I(g3, 2, 3));
  clear = res.events.find((e) => e.type === 'clear');
  assert.equal(clear.cleared.length, 36);
});

test('Eis schmilzt Schicht für Schicht; Ziel «ice» wird erfüllt', () => {
  const g = new Game(parseLevel({ map: ['.....', '.....', '.....', '.....', 'IIi..'], colors: 6, moves: 9, goals: [{ type: 'ice' }], seed: 3 }, 1));
  setBoard(g, withRow(filler(5, 5), 4, '0 0 3 0 4'));
  g.ice[2 + 20] = 1;
  assert.equal(g.goalRemaining()[0], 3);
  g.swap(I(g, 4, 2), I(g, 4, 3));
  assert.equal(g.ice[20], 1);
  assert.equal(g.ice[21], 1);
  assert.equal(g.ice[22], 0);
  assert.equal(g.goalRemaining()[0], 2);
});

test('Steine: Nachbar-Treffer, harte Steine brauchen zwei', () => {
  const g = new Game(parseLevel({ map: full(5, 5), colors: 6, moves: 9, goals: [{ type: 'stone' }], seed: 3 }, 1));
  const rows = filler(5, 5);
  rows[3] = 's S 3 4 5';
  rows[4] = '0 0 4 0 3';
  setBoard(g, rows);
  g.swap(I(g, 4, 2), I(g, 4, 3));
  // (3,0) Stein mit 1 HP über (4,0) → zerbrochen; (3,1) harter Stein → 1 HP übrig
  const stones = g.cells.filter((p) => p && p.t === 's');
  assert.equal(stones.length, 1);
  assert.equal(stones[0].hp, 1);
  assert.equal(g.stonesBroken, 1);
});

test('Eicheln fallen durch Löcher und werden unten eingesammelt', () => {
  const g = new Game(parseLevel({ map: ['...', '...', '-.-', '...', '...'], colors: 6, moves: 9, goals: [{ type: 'item', n: 1 }], seed: 3 }, 1));
  setBoard(g, [
    '3 4 5',
    '4 A 4',
    'x 5 x',
    '1 0 3',
    '1 4 1',
  ]);
  g.itemsSpawned = 1;
  // Gravitation direkt prüfen: (4,1) leeren → Spalte rutscht nach
  g.cells[I(g, 4, 1)] = null; g.cells[I(g, 3, 1)] = null; g.cells[I(g, 2, 1)] = null;
  g._gravity();
  while (g._collect()) g._gravity();
  assert.equal(g.itemsCollected, 1);
  assert.ok(g.cells.every((p, i) => !g.mask[i] || p));
  // Spalte 0: Juwel aus Zeile 1 fällt durch das Loch in Zeile 3
  const g2 = make(['...', '...', '-..', '...']);
  setBoard(g2, ['3 4 5', '4 5 3', 'x 3 4', '5 4 3']);
  const top = g2.cells[I(g2, 1, 0)].id;
  g2.cells[I(g2, 3, 0)] = null;
  g2._gravity();
  assert.equal(g2.cells[I(g2, 3, 0)].id, top);
});

test('Diagonal nachrutschen unter einem Stein', () => {
  const g = make(['...', '...', '...']);
  setBoard(g, ['3 s 4', '4 5 3', '5 3 4']);
  g.cells[I(g, 1, 1)] = null;
  g.cells[I(g, 2, 1)] = null;
  g._gravity();
  assert.ok(g.cells.every((p) => p), 'alles gefüllt trotz Stein oben');
});

test('Kein Zug mehr → automatisch gemischt', () => {
  const g = make(full(4, 4), { colors: 4 });
  setBoard(g, [
    '0 1 2 3',
    '2 3 0 1',
    '0 1 2 3',
    '2 3 0 1',
  ]);
  assert.equal(g.hasMove(), false);
  g._begin();
  g._afterAction();
  assert.ok(g.hasMove());
  assert.equal(g.findMatches().length, 0);
  assert.ok(g.ev.some((e) => e.type === 'shuffle'));
});

test('Speichern und Laden ergibt identischen Verlauf', () => {
  const L = parseLevel({ map: full(8, 8), colors: 5, moves: 30, goals: [{ type: 'score', n: 1e9 }], seed: 99 }, 5);
  const a = new Game(L);
  for (let k = 0; k < 5; k++) { const m = a.hint(); a.swap(m.a, m.b); }
  const b = new Game(L, JSON.parse(JSON.stringify(a.save())));
  for (let k = 0; k < 8; k++) {
    const m = a.hint();
    a.swap(m.a, m.b); b.swap(m.a, m.b);
  }
  assert.deepEqual(a.save(), b.save());
});

test('Hammer, +5 Züge (einmal), Finale', () => {
  const L = parseLevel({ map: full(8, 8), colors: 5, moves: 2, goals: [{ type: 'color', color: 0, n: 500 }], seed: 4 }, 5);
  const g = new Game(L);
  const gem = g.cells.findIndex((p) => p && p.t === 'g');
  assert.ok(g.hammer(gem).ok);
  assert.equal(g.hammers, 2);
  assert.equal(g.movesLeft, 2, 'Hammer kostet keinen Zug');
  let m = g.hint(); g.swap(m.a, m.b);
  m = g.hint(); g.swap(m.a, m.b);
  assert.equal(g.status, 'lost');
  assert.ok(g.addMoves(5).ok);
  assert.equal(g.movesLeft, 5);
  assert.equal(g.status, 'play');
  m = g.hint(); g.swap(m.a, m.b);
  // erzwinge Sieg
  g.collected[0] = 999;
  m = g.hint(); g.swap(m.a, m.b);
  assert.equal(g.status, 'won');
  const before = g.score;
  const left = g.movesLeft;
  assert.ok(left > 0);
  const fin = g.finale();
  assert.ok(fin.ok);
  assert.equal(g.movesLeft, 0);
  assert.ok(g.score > before);
  assert.ok(fin.events.some((e) => e.type === 'convert'));
  assert.equal(g.finale(), null, 'nur einmal');
  // verloren → +5 nur einmal
  const g2 = new Game(L);
  m = g2.hint(); g2.swap(m.a, m.b); m = g2.hint(); g2.swap(m.a, m.b);
  assert.ok(g2.addMoves().ok);
  for (let k = 0; k < 5; k++) { m = g2.hint(); g2.swap(m.a, m.b); }
  assert.equal(g2.status, 'lost');
  assert.equal(g2.addMoves(), null);
});

test('Zen-Modus: kein Zuglimit, kein Ende', () => {
  const g = new Game(zenLevel(123));
  for (let k = 0; k < 60; k++) {
    const m = g.hint();
    assert.ok(m, 'immer ein Zug');
    g.swap(m.a, m.b);
  }
  assert.equal(g.status, 'play');
  assert.ok(g.score > 0);
});

test('Lange Zufallspartien bleiben konsistent (Invarianten)', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const L = parseLevel({ map: ['-.......-', '.........', '...s.s...', '.........', '...---...', '.........', '..i...i..', '.........', '-.......-'],
      colors: 5, moves: 60, goals: [{ type: 'score', n: 1e9 }, { type: 'item', n: 6 }], seed }, 1);
    const g = new Game(L);
    const rng = new Rng(seed);
    for (let k = 0; k < 40 && g.status === 'play'; k++) {
      const moves = g.findMoves();
      assert.ok(moves.length > 0, 'immer ein Zug');
      const m = moves[rng.int(moves.length)];
      const res = g.swap(m.a, m.b);
      assert.ok(res.ok);
      // Invarianten: keine Matches, keine leeren Zellen ausser unerreichbaren, IDs eindeutig
      assert.equal(g.findMatches().length, 0);
      const ids = new Set();
      for (let i = 0; i < g.size; i++) {
        const p = g.cells[i];
        if (!g.mask[i]) { assert.equal(p, null); continue; }
        assert.ok(p, 'Zelle leer bei Seed ' + seed);
        assert.ok(!ids.has(p.id)); ids.add(p.id);
      }
    }
  }
});
