import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS, gridFor, makeGeometry, sampleSide, newGame, takeFromTray, returnToTray, dropGroup,
  isComplete, placedCount, serialize, deserialize, targetOf, rotateGroup, groupMembers, clampGroup,
  recordWin, emptyStats, formatTime, isEdgePiece, moveGroup, TRAY, TABLE, PLACED, rot,
} from '../logic.js';
import { makeRng } from '../../shared/rng.js';

const ASPECTS = [0.75, 0.8, 1, 4 / 3, 0.5625];

test('gridFor: exakte Stufen im 3:4-Format', () => {
  assert.deepEqual(gridFor(12, 0.75), { cols: 3, rows: 4 });
  assert.deepEqual(gridFor(24, 0.75), { cols: 4, rows: 6 });
  assert.deepEqual(gridFor(48, 0.75), { cols: 6, rows: 8 });
  assert.deepEqual(gridFor(70, 0.75), { cols: 7, rows: 10 });
  assert.deepEqual(gridFor(108, 0.75), { cols: 9, rows: 12 });
});

test('gridFor: andere Formate – Teile fast quadratisch, Anzahl nahe an der Stufe', () => {
  for (const a of ASPECTS) {
    for (const n of TIERS) {
      const { cols, rows } = gridFor(n, a);
      const pieceAspect = (a * rows) / cols;
      assert.ok(pieceAspect > 0.66 && pieceAspect < 1.5, `Teilformat ${pieceAspect} bei ${n}/${a}`);
      assert.ok(Math.abs(cols * rows - n) / n <= 0.2, `Anzahl ${cols * rows} statt ${n}`);
    }
  }
});

test('gridFor: Stufe wird auch bei anderen Formaten exakt getroffen, wo die Teile hübsch bleiben', () => {
  for (const a of [0.6, 0.75, 0.9, 1, 1.1, 4 / 3]) {
    for (const n of TIERS) {
      const { cols, rows } = gridFor(n, a);
      if (n === 24 && a === 1) { assert.equal(cols * rows, 25); continue; } // 4×6 gäbe Teile 1.5 : 1
      assert.equal(cols * rows, n, `${n} bei Format ${a}: ${cols}×${rows}`);
    }
  }
});

test('Kanten: Nachbarn teilen exakt dieselbe Kurve, Aussenränder sind gerade', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const aspect = ASPECTS[seed % ASPECTS.length];
    const { cols, rows } = gridFor(TIERS[seed % TIERS.length], aspect);
    const geo = makeGeometry({ cols, rows, seed: seed * 7919, aspect });
    for (let i = 0; i < geo.count; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const s = geo.pieceSides(i);
      if (c < cols - 1) {
        const other = geo.pieceSides(i + 1).left.slice().reverse();
        assert.deepEqual(s.right, other);
      } else assert.equal(s.right.length, 2);
      if (r < rows - 1) {
        const other = geo.pieceSides(i + cols).top.slice().reverse();
        assert.deepEqual(s.bottom, other);
      } else assert.equal(s.bottom.length, 2);
      if (c === 0) assert.equal(s.left.length, 2);
      if (r === 0) assert.equal(s.top.length, 2);
      // Umriss geschlossen: Ende einer Seite = Anfang der nächsten
      const order = ['top', 'right', 'bottom', 'left'];
      for (let k = 0; k < 4; k++) {
        const a = s[order[k]], b = s[order[(k + 1) % 4]];
        assert.deepEqual(a[a.length - 1], b[0]);
      }
    }
  }
});

test('Kanten: Nasen bleiben innerhalb des Randes und ragen in den Nachbarn', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const geo = makeGeometry({ cols: 6, rows: 8, seed, aspect: 0.75 });
    for (let i = 0; i < geo.count; i++) {
      const c = i % geo.cols, r = Math.floor(i / geo.cols);
      const x0 = c * geo.pw, y0 = r * geo.ph;
      const sides = geo.pieceSides(i);
      for (const side of Object.values(sides)) {
        for (const [x, y] of sampleSide(side, 16)) {
          assert.ok(x >= x0 - geo.margin && x <= x0 + geo.pw + geo.margin, 'x im Rand');
          assert.ok(y >= y0 - geo.margin && y <= y0 + geo.ph + geo.margin, 'y im Rand');
        }
      }
      // Jede Innenkante hat eine deutliche Nase (Auslenkung > 15% der Zellgrösse)
      if (c < geo.cols - 1) {
        const xs = sampleSide(sides.right, 16).map((p) => Math.abs(p[0] - (x0 + geo.pw)));
        assert.ok(Math.max(...xs) > 0.15 * geo.m);
      }
    }
  }
});

test('Geometrie ist deterministisch und Seeds unterscheiden sich', () => {
  const a = makeGeometry({ cols: 7, rows: 10, seed: 1234, aspect: 0.75 });
  const b = makeGeometry({ cols: 7, rows: 10, seed: 1234, aspect: 0.75 });
  const c = makeGeometry({ cols: 7, rows: 10, seed: 1235, aspect: 0.75 });
  let diff = 0;
  for (let i = 0; i < a.count; i++) {
    assert.equal(a.piecePath(i), b.piecePath(i));
    if (a.piecePath(i) !== c.piecePath(i)) diff++;
  }
  assert.ok(diff > a.count * 0.8);
  // Pfad-Syntax: beginnt mit M, endet mit Z, nur Zahlen/Befehle
  assert.match(a.piecePath(10), /^M[\d. -]+([LC][\d. -]+)+Z$/);
});

function setup(n = 48, aspect = 0.75, seed = 99, rotate = false) {
  const { cols, rows } = gridFor(n, aspect);
  const geo = makeGeometry({ cols, rows, seed, aspect });
  const state = newGame({ cols, rows, seed, aspect, rotate });
  return { geo, state };
}

test('Neues Spiel: alle Teile in der Leiste, Leiste ist eine Permutation', () => {
  const { geo, state } = setup();
  assert.equal(state.pieces.length, geo.count);
  assert.equal(state.tray.length, geo.count);
  assert.deepEqual([...state.tray].sort((a, b) => a - b), [...Array(geo.count).keys()]);
  assert.ok(state.pieces.every((p) => p.s === TRAY && p.r === 0));
  // Randteile tendenziell vorne
  const firstHalf = state.tray.slice(0, geo.count / 2).filter((i) => isEdgePiece(i, geo.cols, geo.rows)).length;
  const secondHalf = state.tray.slice(geo.count / 2).filter((i) => isEdgePiece(i, geo.cols, geo.rows)).length;
  assert.ok(firstHalf > secondHalf);
  // Dreh-Modus: einige Teile gedreht
  const r = setup(48, 0.75, 5, true).state;
  assert.ok(r.pieces.some((p) => p.r !== 0));
});

test('Teil am richtigen Platz rastet ein, daneben nicht', () => {
  const { geo, state } = setup();
  const [tx, ty] = targetOf(geo, 5);
  takeFromTray(state, 5, tx + 10, ty - 8);
  const ev = dropGroup(state, geo, state.pieces[5].g, 30);
  assert.equal(ev[0].type, 'board');
  assert.equal(state.pieces[5].s, PLACED);
  assert.equal(state.pieces[5].x, tx);
  takeFromTray(state, 6, 0, 0);
  const ev2 = dropGroup(state, geo, state.pieces[6].g, 30);
  assert.equal(ev2.length, 0);
  assert.equal(state.pieces[6].s, TABLE);
});

test('Nachbarn verbinden sich auf dem Tisch und bewegen sich gemeinsam', () => {
  const { geo, state } = setup();
  takeFromTray(state, 10, -300, -300);
  const [ax, ay] = targetOf(geo, 10);
  const [bx, by] = targetOf(geo, 11);
  takeFromTray(state, 11, -300 + (bx - ax) + 7, -300 + (by - ay) - 5);
  const ev = dropGroup(state, geo, state.pieces[11].g, 30);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, 'join');
  assert.equal(state.pieces[10].g, state.pieces[11].g);
  assert.equal(state.pieces[11].x - state.pieces[10].x, bx - ax);
  moveGroup(state, state.pieces[10].g, 50, 20);
  assert.equal(state.pieces[11].x - state.pieces[10].x, bx - ax);
  assert.deepEqual(groupMembers(state, state.pieces[10].g).sort(), [10, 11]);
  // Gruppe passt nicht mehr in die Leiste
  assert.equal(returnToTray(state, 10, 0), false);
  // Ganze Gruppe ans Ziel ziehen -> beide fest
  moveGroup(state, state.pieces[10].g, ax - state.pieces[10].x + 4, ay - state.pieces[10].y);
  const ev2 = dropGroup(state, geo, state.pieces[10].g, 30);
  assert.equal(ev2[0].type, 'board');
  assert.equal(state.pieces[10].s, PLACED);
  assert.equal(state.pieces[11].s, PLACED);
});

test('Andocken an ein festes Teil setzt die Gruppe fest', () => {
  const { geo, state } = setup();
  const [ax, ay] = targetOf(geo, 0);
  takeFromTray(state, 0, ax, ay);
  dropGroup(state, geo, 0, 30);
  assert.equal(state.pieces[0].s, PLACED);
  // Teil 1 knapp neben seinem Ziel, aber ausserhalb der Brett-Toleranz für die Gruppe? -> Nachbar greift
  const [bx, by] = targetOf(geo, 1);
  takeFromTray(state, 1, bx + 20, by + 12);
  const ev = dropGroup(state, geo, 1, 30);
  assert.ok(ev.some((e) => e.type === 'board'));
  assert.equal(state.pieces[1].s, PLACED);
  assert.equal(state.pieces[1].x, bx);
});

test('Drehen: gedrehte Teile rasten nicht ein, nach vier Drehungen wieder ja', () => {
  const { geo, state } = setup(24, 0.75, 3, false);
  const [tx, ty] = targetOf(geo, 7);
  takeFromTray(state, 7, tx, ty);
  state.pieces[7].r = 1;
  assert.equal(dropGroup(state, geo, 7, 30).length, 0);
  for (let k = 0; k < 3; k++) rotateGroup(state, 7, tx, ty);
  assert.equal(state.pieces[7].r, 0);
  assert.equal(dropGroup(state, geo, 7, 30)[0].type, 'board');
});

test('Drehen: gedrehte Nachbarn verbinden sich, Gruppe dreht als Ganzes', () => {
  const { geo, state } = setup(24, 0.75, 3, false);
  const [ax, ay] = targetOf(geo, 8);
  const [bx, by] = targetOf(geo, 9); // rechts von 8
  takeFromTray(state, 8, 100, 100);
  takeFromTray(state, 9, 0, 0);
  state.pieces[8].r = 1; state.pieces[9].r = 1;
  const [ox, oy] = rot(bx - ax, by - ay, 1); // bei r=1 liegt der rechte Nachbar unterhalb
  state.pieces[9].x = 100 + ox + 3; state.pieces[9].y = 100 + oy - 4;
  const ev = dropGroup(state, geo, 9, 30);
  assert.equal(ev[0].type, 'join');
  const g = state.pieces[8].g;
  for (let k = 0; k < 3; k++) rotateGroup(state, g, state.pieces[8].x, state.pieces[8].y);
  assert.equal(state.pieces[8].r, 0);
  assert.equal(state.pieces[9].r, 0);
  assert.ok(Math.abs(state.pieces[9].x - state.pieces[8].x - (bx - ax)) < 1e-9);
  assert.ok(Math.abs(state.pieces[9].y - state.pieces[8].y - (by - ay)) < 1e-9);
});

test('Lösbarkeit: viele Seeds und Stufen lassen sich vollständig legen', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const aspect = ASPECTS[seed % ASPECTS.length];
    const n = TIERS[seed % TIERS.length];
    const { geo, state } = setup(n, aspect, seed * 31, seed % 3 === 0);
    const rng = makeRng(seed);
    // Zufällige Reihenfolge, zufällige Ablage, dann ans Ziel – inklusive Umweg über Gruppen
    while (state.tray.length) {
      const i = state.tray[rng.int(0, state.tray.length - 1)];
      takeFromTray(state, i, rng.range(-200, geo.W + 200), rng.range(-200, geo.H + 200));
      dropGroup(state, geo, state.pieces[i].g, 25);
    }
    let guard = 0;
    while (!isComplete(state) && guard++ < 10000) {
      const loose = state.pieces.map((p, i) => (p.s === TABLE ? i : -1)).filter((i) => i >= 0);
      const i = loose[rng.int(0, loose.length - 1)];
      const g = state.pieces[i].g;
      while (state.pieces[i].r !== 0) rotateGroup(state, g, state.pieces[i].x, state.pieces[i].y);
      const [tx, ty] = targetOf(geo, i);
      moveGroup(state, g, tx - state.pieces[i].x + rng.range(-10, 10), ty - state.pieces[i].y + rng.range(-10, 10));
      dropGroup(state, geo, g, 25);
    }
    assert.ok(isComplete(state), `Seed ${seed} nicht lösbar`);
    assert.equal(placedCount(state), geo.count);
    assert.equal(state.order.length, 0);
    state.pieces.forEach((p, i) => {
      const [tx, ty] = targetOf(geo, i);
      assert.ok(Math.abs(p.x - tx) < 1e-6 && Math.abs(p.y - ty) < 1e-6);
    });
  }
});

test('Teile gehen nie verloren (Zufallsspiel mit Leiste hin und zurück)', () => {
  const { geo, state } = setup(70, 0.75, 77, true);
  const rng = makeRng(42);
  for (let step = 0; step < 2000; step++) {
    const roll = rng.next();
    if (roll < 0.4 && state.tray.length) {
      const i = rng.pick(state.tray);
      takeFromTray(state, i, rng.range(0, geo.W), rng.range(0, geo.H));
      dropGroup(state, geo, i, 25);
    } else if (roll < 0.55) {
      const loose = state.pieces.map((p, i) => (p.s === TABLE ? i : -1)).filter((i) => i >= 0);
      if (loose.length) returnToTray(state, rng.pick(loose), rng.int(0, state.tray.length));
    } else {
      const loose = state.pieces.map((p, i) => (p.s === TABLE ? i : -1)).filter((i) => i >= 0);
      if (!loose.length) continue;
      const i = rng.pick(loose);
      if (rng.chance(0.2)) rotateGroup(state, state.pieces[i].g, state.pieces[i].x, state.pieces[i].y);
      moveGroup(state, state.pieces[i].g, rng.range(-80, 80), rng.range(-80, 80));
      clampGroup(state, state.pieces[i].g, { x0: -100, y0: -100, x1: geo.W + 100, y1: geo.H + 100 });
      dropGroup(state, geo, state.pieces[i].g, 25);
    }
    const tray = state.pieces.filter((p) => p.s === TRAY).length;
    const table = state.pieces.filter((p) => p.s === TABLE).length;
    assert.equal(tray, state.tray.length);
    assert.equal(table, state.order.length);
    assert.equal(new Set(state.tray).size, state.tray.length);
    // Gruppen sind starr: relative Lage passt zur Zielgeometrie
    const groups = new Map();
    state.pieces.forEach((p, i) => { if (p.s === TABLE) { if (!groups.has(p.g)) groups.set(p.g, []); groups.get(p.g).push(i); } });
    for (const members of groups.values()) {
      const a = members[0];
      for (const b of members) {
        const pa = state.pieces[a], pb = state.pieces[b];
        assert.equal(pa.r, pb.r);
        const [ax, ay] = targetOf(geo, a), [bx, by] = targetOf(geo, b);
        const [ox, oy] = rot(bx - ax, by - ay, pa.r);
        assert.ok(Math.abs(pb.x - pa.x - ox) < 1e-6 && Math.abs(pb.y - pa.y - oy) < 1e-6);
      }
    }
  }
});

test('clampGroup hält Gruppen auf dem Tisch', () => {
  const { geo, state } = setup(12);
  takeFromTray(state, 0, 5000, -5000);
  clampGroup(state, 0, { x0: 0, y0: 0, x1: geo.W, y1: geo.H });
  assert.equal(state.pieces[0].x, geo.W);
  assert.equal(state.pieces[0].y, 0);
});

test('Speichern und Laden ergibt denselben Stand, kaputte Stände werden repariert', () => {
  const { geo, state } = setup(48, 0.75, 11);
  const rng = makeRng(3);
  for (let k = 0; k < 20; k++) {
    const i = state.tray[0];
    const [tx, ty] = targetOf(geo, i);
    takeFromTray(state, i, k % 2 ? tx : rng.range(0, 900), k % 2 ? ty : rng.range(0, 900));
    dropGroup(state, geo, i, 25);
  }
  state.time = 12345; state.moves = 20;
  const json = JSON.parse(JSON.stringify(serialize(state)));
  const back = deserialize(json, geo);
  assert.deepEqual(serialize(back), serialize(state));
  assert.equal(placedCount(back), placedCount(state));

  // Falsche Grösse -> null
  assert.equal(deserialize({ ...json, cols: 3 }, geo), null);
  assert.equal(deserialize(null, geo), null);
  // Leiste unvollständig, Reihenfolge fehlt -> wird ergänzt
  const broken = { ...json, tray: [], order: undefined, p: json.p.map((a) => [...a]) };
  broken.p[0] = ['x', null, 9, -4, 7];
  const fixed = deserialize(broken, geo);
  assert.equal(fixed.tray.length, fixed.pieces.filter((p) => p.s === TRAY).length);
  assert.equal(fixed.order.length, fixed.pieces.filter((p) => p.s === TABLE).length);
});

test('Komplett gelöst wird erkannt', () => {
  const { geo, state } = setup(12);
  for (let i = 0; i < geo.count; i++) {
    const [tx, ty] = targetOf(geo, i);
    takeFromTray(state, i, tx, ty);
    dropGroup(state, geo, i, 10);
  }
  assert.ok(isComplete(state));
});

test('Statistik: Bestzeit und Tage am Stück', () => {
  let s = emptyStats();
  let r = recordWin(s, { tier: 24, ms: 90000, pieces: 24, day: '2026-11-10', yesterday: '2026-11-09' });
  assert.equal(r.stats.won, 1);
  assert.equal(r.stats.best[24], 90000);
  assert.equal(r.newBest, false); // erstes Mal ist keine «neue» Bestzeit
  r = recordWin(r.stats, { tier: 24, ms: 80000, pieces: 24, day: '2026-11-11', yesterday: '2026-11-10' });
  assert.equal(r.newBest, true);
  assert.equal(r.stats.days.count, 2);
  r = recordWin(r.stats, { tier: 24, ms: 85000, pieces: 24, day: '2026-11-11', yesterday: '2026-11-10' });
  assert.equal(r.newBest, false);
  assert.equal(r.stats.days.count, 2);
  r = recordWin(r.stats, { tier: 12, ms: 5000, pieces: 12, day: '2026-11-14', yesterday: '2026-11-13' });
  assert.equal(r.stats.days.count, 1);
  assert.equal(r.stats.days.max, 2);
  assert.equal(r.stats.pieces, 84);
});

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65000), '1:05');
  assert.equal(formatTime(3725000), '1:02:05');
});
