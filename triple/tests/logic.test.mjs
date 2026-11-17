// Logik-Tests für Dreierlei:  node --test triple/tests/
// Prüft Inhalte (Themen, Formen), Generator (Lösbarkeit, Vielfache von 3, Determinismus),
// Löser, Spielregeln, Hilfen und Speichern/Laden.

import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, themeById } from '../data/themes.js';
import { shapes } from '../data/shapes.js';
import { generate, generateLevel, generateFree, levelParams, themeForLevel, SIZES, STYLES } from '../logic/generator.js';
import { Game, simulate, starsFor, TRAY_SIZE } from '../logic/rules.js';
import { solve, findHint } from '../logic/solver.js';
import { coverGraph } from '../logic/board.js';
import { makeRng } from '../../shared/rng.js';

const countTypes = (level) => {
  const c = {};
  for (const t of level.tiles) c[t.t] = (c[t.t] || 0) + 1;
  return c;
};

function checkLevel(level, label) {
  assert.ok(level.tiles.length >= 9, `${label}: zu wenige Steine`);
  assert.equal(level.tiles.length % 3, 0, `${label}: Steinzahl kein Vielfaches von 3`);
  for (const [t, n] of Object.entries(countTypes(level))) assert.equal(n % 3, 0, `${label}: Sorte ${t} ${n}×`);
  assert.equal(level.verified, true, `${label}: Gewinn-Reihenfolge nicht bestätigt`);
  const seen = new Set();
  for (const t of level.tiles) {
    const k = `${t.x},${t.y},${t.z}`;
    assert.ok(!seen.has(k), `${label}: zwei Steine am selben Platz ${k}`);
    seen.add(k);
    assert.ok(t.t >= 0 && t.t < level.symbols.length, `${label}: Sorte ohne Bild`);
  }
  assert.ok(simulate(level, level.solution).won, `${label}: Lösung gewinnt nicht`);
}

// ---------- Inhalte ----------

test('Themen: mindestens 12, gültig und abwechslungsreich', () => {
  assert.ok(themes.length >= 12, 'mindestens 12 Themen');
  const ids = new Set();
  for (const t of themes) {
    assert.match(t.id, /^[a-z0-9-]+$/, `id ${t.id}`);
    assert.ok(!ids.has(t.id), `doppelte id ${t.id}`);
    ids.add(t.id);
    assert.ok(t.title && !/ß/.test(t.title), `Titel ${t.id} (Schweizer Schreibweise, kein ß)`);
    assert.match(t.color, /^#[0-9a-f]{6}$/i, `color ${t.id}`);
    assert.match(t.bg, /^#[0-9a-f]{6}$/i, `bg ${t.id}`);
    assert.ok(Array.isArray(t.emoji) && t.emoji.length >= 16, `${t.id}: mindestens 16 Emoji`);
    assert.equal(new Set(t.emoji).size, t.emoji.length, `${t.id}: doppelte Emoji`);
    for (const e of t.emoji) assert.ok(typeof e === 'string' && e.length > 0 && e.length <= 8, `${t.id}: Emoji «${e}»`);
    assert.equal(themeById(t.id), t);
  }
});

test('Formen: Raster gültig, Grösse passt aufs iPhone', () => {
  const ids = new Set();
  assert.ok(shapes.length >= 12);
  for (const s of shapes) {
    assert.match(s.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(s.id), `doppelte Form ${s.id}`);
    ids.add(s.id);
    assert.ok(s.title, `${s.id}: Titel`);
    assert.ok(s.rows.length >= 3 && s.rows.length <= 8, `${s.id}: 3–8 Zeilen`);
    const w = s.rows[0].length;
    assert.ok(w >= 3 && w <= 7, `${s.id}: 3–7 Spalten`);
    let n = 0;
    for (const r of s.rows) {
      assert.equal(r.length, w, `${s.id}: Zeilen ungleich lang`);
      assert.match(r, /^[#.]+$/, `${s.id}: nur # und .`);
      n += r.split('#').length - 1;
    }
    assert.ok(n >= 10, `${s.id}: mindestens 10 Steine`);
  }
});

// ---------- Generator ----------

test('Level-Reihe 1–150: lösbar, Vielfache von 3, deterministisch', () => {
  for (let L = 1; L <= 150; L++) checkLevel(generateLevel(L), `Level ${L}`);
  const a = generateLevel(37), b = generateLevel(37);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.symbols, b.symbols);
});

test('Level-Reihe: Schwierigkeit steigt, Themen und Formen wechseln', () => {
  const p1 = levelParams(1), p30 = levelParams(30);
  assert.ok(p30.tiles > p1.tiles && p30.kinds > p1.kinds);
  for (let L = 1; L <= 300; L++) {
    const p = levelParams(L);
    assert.equal(p.tiles % 3, 0, `Level ${L}`);
    assert.ok(p.cap >= 2 && p.cap < TRAY_SIZE);
  }
  for (let L = 1; L < 400; L++) assert.notEqual(themeForLevel(L).id, themeForLevel(L + 1).id, `Thema ${L}/${L + 1}`);
  const seenShapes = new Set(), seenStyles = new Set();
  for (let L = 1; L <= 60; L++) {
    const lv = generateLevel(L);
    seenShapes.add(lv.shape);
    seenStyles.add(lv.style);
    if (L > 1) assert.ok(lv.shape !== generateLevel(L - 1).shape || lv.style !== generateLevel(L - 1).style, `Level ${L} sieht aus wie ${L - 1}`);
  }
  assert.ok(seenShapes.size >= 15, 'viele verschiedene Formen');
  assert.equal(seenStyles.size, STYLES.length, 'alle Ebenen-Stile kommen vor');
});

test('Freies Spiel: alle Themen × Grössen lösbar', () => {
  for (const t of themes) {
    for (const size of Object.keys(SIZES)) {
      for (let k = 0; k < 3; k++) checkLevel(generateFree(t.id, size, `s${k}`), `${t.id}/${size}/${k}`);
    }
  }
});

test('Jede Form mit jedem Stil ergibt ein lösbares Level', () => {
  for (const s of shapes) {
    for (const style of STYLES) {
      const lv = generate({ seed: `t-${s.id}-${style}`, tiles: 60, layers: 5, kinds: 8, cap: 5, theme: 'obst', shape: s.id, style });
      checkLevel(lv, `${s.id}/${style}`);
    }
  }
});

// ---------- Löser ----------

test('Löser findet unabhängig eine Gewinn-Reihenfolge', () => {
  let solved = 0, tried = 0;
  for (let L = 1; L <= 40; L += 3) {
    const lv = generateLevel(L);
    const g = new Game(lv);
    const r = solve(g.position(), { nodeLimit: 200000 });
    tried++;
    if (r.ok) {
      solved++;
      assert.ok(simulate(lv, r.path).won, `Level ${L}: Löser-Pfad gewinnt nicht`);
    }
  }
  assert.ok(solved >= tried - 1, `Löser schafft ${solved}/${tried}`);
});

test('Löser erkennt unlösbare Stellung', () => {
  // 3 Sorten à 3, aber Ablage nur 2 Plätze: nach zwei verschiedenen Steinen ist Schluss
  const tiles = [];
  const types = [0, 1, 2, 0, 1, 2, 0, 1, 2];
  types.forEach((t, i) => tiles.push({ x: i, y: 0, z: 0, t }));
  const { below } = coverGraph(tiles);
  const pos = { types, where: new Uint8Array(9), block: new Int16Array(9), below, tray: [], trayLimit: 3 };
  assert.equal(solve(pos).ok, true, 'mit drei Plätzen lösbar');
  const r = solve({ ...pos, trayLimit: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unsolvable');
});

// ---------- Regeln ----------

function tinyLevel() {
  // Unten 3 verdeckte Steine, oben 3 freie (je eine Sorte), daneben 6 freie Steine.
  const tiles = [
    { x: 1, y: 1, z: 0, t: 0 }, { x: 2, y: 1, z: 0, t: 0 }, { x: 3, y: 1, z: 0, t: 0 },
    { x: 1.5, y: 1, z: 1, t: 1 }, { x: 2.5, y: 1, z: 1, t: 1 }, { x: 0, y: 3, z: 0, t: 1 },
    { x: 1, y: 3, z: 0, t: 2 }, { x: 2, y: 3, z: 0, t: 2 }, { x: 3, y: 3, z: 0, t: 2 },
    { x: 4, y: 3, z: 0, t: 3 }, { x: 5, y: 3, z: 0, t: 3 }, { x: 6, y: 3, z: 0, t: 3 },
  ];
  return { seed: 'tiny', theme: 'obst', symbols: ['🍓', '🍒', '🍋', '🍇'], tiles, layers: 2, solution: [] };
}

test('Regeln: nur freie Steine, Drillinge verschwinden, gewinnen', () => {
  const g = new Game(tinyLevel());
  assert.equal(g.isFree(0), false, 'verdeckter Stein');
  assert.equal(g.pick(0), null);
  assert.equal(g.isFree(3), true);
  g.pick(3);
  assert.equal(g.isFree(0), true, 'Stein 0 ist jetzt frei (nur von 3 verdeckt)');
  assert.equal(g.isFree(1), false, 'Stein 1 liegt noch unter 4');
  const ev = g.pick(4);
  assert.deepEqual(ev.freed.sort(), [1, 2]);
  const ev3 = g.pick(5);
  assert.deepEqual(ev3.matched.sort(), [3, 4, 5]);
  assert.equal(g.tray.length, 0);
  assert.equal(g.triples, 1);
  for (const id of [0, 1, 2, 6, 7, 8, 9, 10, 11]) g.pick(id);
  assert.equal(g.status, 'won');
  assert.equal(g.stars, 3);
});

test('Regeln: gleiche Steine liegen in der Ablage nebeneinander', () => {
  const g = new Game(tinyLevel());
  g.pick(6); g.pick(9); g.pick(7);
  assert.deepEqual(g.tray, [6, 7, 9]);
});

test('Regeln: volle Ablage = verloren, Hilfen retten', () => {
  const lv = generateFree('meer', 'riesig', 'lose');
  const g = new Game(lv);
  const used = new Set();
  // 7 verschiedene Sorten nehmen
  while (g.status === 'play' && g.tray.length < TRAY_SIZE) {
    const id = g.freeTiles().find((i) => !used.has(g.types[i]) && !g.tray.some((t) => g.types[t] === g.types[i]));
    if (id == null) break;
    used.add(g.types[id]);
    g.pick(id);
  }
  assert.equal(g.status, 'lost');
  assert.equal(g.pick(g.freeTiles()[0]), null, 'nach dem Verlieren keine Züge');
  // Auslagern
  assert.ok(g.canStash());
  const st = g.stash();
  assert.equal(st.moved.length, 3);
  assert.equal(g.status, 'play');
  assert.equal(g.shelf.length, 3);
  assert.equal(g.tray.length, 4);
  assert.equal(g.canStash(), false, 'nur einmal pro Level');
  assert.ok(g.isFree(g.shelf[0]), 'ausgelagerte Steine sind antippbar');
  const sid = g.shelf[0];
  g.pick(sid);
  assert.ok(!g.shelf.includes(sid));
  // Zurück legt ihn wieder in die Auslage
  assert.ok(g.canUndo());
  const u = g.undo();
  assert.equal(u.to, 's');
  assert.ok(g.shelf.includes(sid));
  assert.equal(g.canUndo(), false);
  assert.equal(g.used, 2);
  assert.equal(g.stars, 2);
  // Zweite Chance (gratis, einmal)
  assert.ok(g.canStash(true));
});

test('Hilfen: Zurück deckt wieder zu, Tipp und Mischen bleiben lösbar', () => {
  const lv = generateLevel(12);
  const g = new Game(lv);
  const first = lv.solution[0];
  const ev = g.pick(first);
  const u = g.undo();
  assert.deepEqual(u.covered.sort(), ev.freed.sort());
  assert.equal(g.tray.length, 0);
  for (const i of ev.freed) assert.equal(g.isFree(i), false);
  // Tipp: freie Steine einer Sorte
  const h = g.hint();
  assert.ok(h.ids.length >= 1);
  for (const id of h.ids) assert.ok(g.isFree(id));
  assert.equal(new Set(h.ids.map((i) => g.types[i])).size, 1);
  assert.equal(g.hint(), null, 'Tipp nur einmal');
  // Mischen: gleiche Bilder-Multimenge, Stellung lösbar
  for (const id of lv.solution.slice(0, 5)) g.pick(id);
  const before = Array.from(g.types).sort().join();
  const r = g.shuffle(makeRng('mix'));
  assert.ok(r);
  assert.equal(Array.from(g.types).sort().join(), before);
  assert.ok(r.solvable, 'nach dem Mischen lösbar');
  assert.ok(solve(g.position(), { nodeLimit: 200000 }).ok);
  assert.equal(g.canShuffle(), false);
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(4), 1);
});

test('Speichern und Laden ergibt denselben Zustand', () => {
  const lv = generateLevel(9);
  const g = new Game(lv);
  for (const id of lv.solution.slice(0, 7)) g.pick(id);
  g.stash();
  g.elapsed = 12345;
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const h = new Game(lv, json);
  assert.deepEqual(h.toJSON(), g.toJSON());
  assert.deepEqual(Array.from(h.block), Array.from(g.block));
  // Weiterspielen bis zum Sieg mit dem Löser
  const r = solve(h.position(), { nodeLimit: 300000 });
  assert.ok(r.ok);
  for (const id of r.path) assert.ok(h.pick(id));
  assert.equal(h.status, 'won');
  // Kaputter Spielstand wird abgelehnt
  assert.throws(() => new Game(lv, { ...json, where: json.where.slice(1) }));
  assert.throws(() => new Game(generateLevel(10), json));
});

test('Tipp-Heuristik liefert auch ohne Lösung einen Zug', () => {
  const lv = generateLevel(20);
  const g = new Game(lv);
  const r = findHint(g.position(), { nodeLimit: 1 });
  assert.ok(r.ids.length >= 1);
  for (const id of r.ids) assert.ok(g.isFree(id));
});
