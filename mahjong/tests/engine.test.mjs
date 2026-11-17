// Reine Spiellogik: freie Steine, Gruppen, Generator (lösbar), Mischen, Löser, Spielstand.
//   node --test mahjong/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLayout, buildBoard, isFree, freeTiles, facesMatch, matchKey, generateDeal, verifySolution,
  reshuffle, solve, findHint, hasMoves, countPresent, generateLayoutDef, validateLayout, computeStars,
  FLOWER, SEASON, fitTileWidth,
} from '../engine.js';
import { Session } from '../game.js';
import { layouts } from '../data/layouts.js';

const full = (b) => new Uint8Array(b.n).fill(1);
const at = (L, x, y, z = 0) => L.tiles.findIndex((t) => t.x === x * 2 && t.y === y * 2 && t.z === z);

test('frei = nichts darauf und links oder rechts frei', () => {
  const L = parseLayout({ id: 't', layers: [['XXX'], ['.X.']] });
  const b = buildBoard(L);
  const p = full(b);
  const left = at(L, 0, 0), mid = at(L, 1, 0), right = at(L, 2, 0), top = at(L, 1, 0, 1);
  assert.equal(isFree(b, p, left), true);
  assert.equal(isFree(b, p, right), true);
  assert.equal(isFree(b, p, mid), false, 'Mitte: beide Seiten belegt und Stein darauf');
  assert.equal(isFree(b, p, top), true);
  p[left] = 0;
  assert.equal(isFree(b, p, mid), false, 'Stein darauf blockiert weiterhin');
  p[top] = 0;
  assert.equal(isFree(b, p, mid), true);
  assert.deepEqual(freeTiles(b, p).sort(), [mid, right].sort());
});

test('halb versetzter Stein blockiert beide Steine darunter', () => {
  const L = parseLayout({ id: 't', layers: [['XX'], { rows: ['X'], dx: 0.5, z: 1 }] });
  const b = buildBoard(L);
  const p = full(b);
  assert.equal(isFree(b, p, at(L, 0, 0)), false);
  assert.equal(isFree(b, p, at(L, 1, 0)), false);
});

test('Blumen und Jahreszeiten passen innerhalb ihrer Gruppe', () => {
  for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) {
    assert.ok(facesMatch(FLOWER + a, FLOWER + c));
    assert.ok(facesMatch(SEASON + a, SEASON + c));
    assert.ok(!facesMatch(FLOWER + a, SEASON + c));
  }
  assert.ok(facesMatch(5, 5));
  assert.ok(!facesMatch(5, 6));
  assert.notEqual(matchKey(FLOWER), matchKey(SEASON));
});

test('Generator: jede Verteilung hat ein gültiges Lösungs-Zertifikat', () => {
  for (const def of layouts) {
    const b = buildBoard(parseLayout(def));
    for (let s = 0; s < 3; s++) {
      const d = generateDeal(b, `${def.id}-${s}`);
      assert.equal(d.faces.length, b.n);
      assert.ok(verifySolution(b, d.faces, full(b), d.solution), `${def.id} Seed ${s} nicht lösbar`);
    }
  }
});

test('Generator ist deterministisch', () => {
  const b = buildBoard(parseLayout(layouts[3]));
  assert.deepEqual(generateDeal(b, 'abc').faces, generateDeal(b, 'abc').faces);
  assert.notDeepEqual(generateDeal(b, 'abc').faces, generateDeal(b, 'abd').faces);
});

test('Mischen liefert wieder eine lösbare Stellung mit denselben Bildern', () => {
  const def = layouts.find((l) => l.id === 'drache') || layouts[10];
  const b = buildBoard(parseLayout(def));
  const d = generateDeal(b, 'misch');
  const p = full(b);
  // ein paar Züge gemäss Lösung, dann mischen
  for (const [x, y] of d.solution.slice(0, 12)) { p[x] = 0; p[y] = 0; }
  const next = reshuffle(b, d.faces, p, 'm1');
  assert.ok(next);
  const keys = (f) => [...p].flatMap((v, i) => (v ? [matchKey(f[i])] : [])).sort((u, v) => u - v);
  assert.deepEqual(keys(next), keys(d.faces));
  const r = solve(b, next, p, { maxNodes: 200000 });
  assert.equal(r.result, 'solved');
  assert.ok(verifySolution(b, next, p, r.moves));
});

test('Löser erkennt unlösbare Türme, Tipp liefert Paar', () => {
  const L = parseLayout({ id: 't', layers: [['X'], ['X']] });
  const b = buildBoard(L);
  const r = solve(b, [3, 3], full(b));
  assert.equal(r.result, 'unsolvable');
  assert.equal(hasMoves(b, [3, 3], full(b)), false);
  assert.equal(findHint(b, [3, 3], full(b)), null);
  const L2 = parseLayout({ id: 't2', layers: [['XXXX']] });
  const b2 = buildBoard(L2);
  const h = findHint(b2, [1, 2, 2, 1], full(b2));
  assert.ok(h && h.safe);
});

test('Zufallsformen sind gültig, passen aufs Handy und sind lösbar', () => {
  for (const size of ['klein', 'mittel', 'gross']) {
    for (let s = 0; s < 6; s++) {
      const def = generateLayoutDef(`t${s}`, size);
      const L = parseLayout(def);
      assert.deepEqual(validateLayout(L), [], `${size}/${s}`);
      assert.ok(L.tiles.length % 2 === 0 && L.tiles.length <= 144);
      const b = buildBoard(L);
      const d = generateDeal(b, 'x' + s);
      assert.ok(verifySolution(b, d.faces, full(b), d.solution));
      assert.ok(fitTileWidth(L.tiles, 390, 560) >= 26, `${size}/${s} zu klein`);
    }
  }
});

test('Sterne: 3 ohne Hilfe, 2 mit wenig, 1 mit viel Hilfe', () => {
  assert.equal(computeStars({}), 3);
  assert.equal(computeStars({ hints: 1, shuffles: 1 }), 2);
  assert.equal(computeStars({ hints: 3 }), 1);
});

test('Session: Paar, Zurück, Mischen, Speichern/Laden', () => {
  const def = layouts[0];
  const s = Session.create(parseLayout(def), { kind: 'level', ref: def.id, seed: 'sess', name: def.name });
  const [a, c] = s.solution[0];
  assert.ok(s.canMatch(a, c));
  s.match(a, c);
  assert.equal(s.remaining, s.n - 2);
  s.elapsed = 42;
  const back = Session.fromSave(JSON.parse(JSON.stringify(s.serialize())));
  assert.equal(back.remaining, s.n - 2);
  assert.deepEqual([...back.faces], [...s.faces]);
  assert.equal(Math.round(back.elapsed), 42);
  s.undo();
  assert.equal(s.remaining, s.n);
  const before = s.faces.join();
  assert.ok(s.shuffle());
  assert.notEqual(s.faces.join(), before);
  s.undo();
  assert.equal(s.faces.join(), before);
  // ganze Lösung durchspielen → gewonnen
  for (const [x, y] of s.solution) s.match(x, y);
  assert.equal(s.won, true);
  assert.equal(countPresent(s.present), 0);
});

test('bekannte Lösung bleibt bei beliebigen Zügen, Zurück und Mischen gültig', () => {
  let kept = 0, total = 0;
  for (const def of layouts.filter((_, k) => k % 3 === 0)) {
    for (let seed = 0; seed < 4; seed++) {
      const s = Session.create(parseLayout(def), { kind: 'level', ref: def.id, seed: `c${seed}`, name: def.name });
      let r = seed * 7919 + 1;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let step = 0; step < 200 && !s.won; step++) {
        const free = s.freeList();
        const pairs = [];
        for (let x = 0; x < free.length; x++) for (let y = x + 1; y < free.length; y++) if (s.canMatch(free[x], free[y])) pairs.push([free[x], free[y]]);
        const roll = rnd();
        if (!pairs.length || roll < 0.04) { if (!s.shuffle()) s.undo(); }
        else if (roll < 0.12 && s.history.length) s.undo();
        else { const [x, y] = pairs[Math.floor(rnd() * pairs.length)]; s.match(x, y); }
        total++;
        if (s.cert) {
          kept++;
          assert.ok(verifySolution(s.board, s.faces, s.present, s.cert), `${def.id}: Lösung ungültig`);
          const back = Session.fromSave(JSON.parse(JSON.stringify(s.serialize())));
          assert.equal(back.cert?.length, s.cert.length);
        }
      }
    }
  }
  assert.ok(kept > 0 && total > 0);
});
