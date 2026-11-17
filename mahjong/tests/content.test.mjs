// Inhalte prüfen: Layouts («Reise»), Steinsätze, Tagesrätsel.
//   node --test mahjong/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { layouts } from '../data/layouts.js';
import { tilesets } from '../data/tilesets.js';
import { parseLayout, validateLayout, buildBoard, generateDeal, verifySolution, fitTileWidth, FACE_COUNT } from '../engine.js';
import { dailyDef } from '../daily.js';

test('mindestens 24 Layouts mit eindeutigen IDs und deutschen Namen', () => {
  assert.ok(layouts.length >= 24, `nur ${layouts.length} Layouts`);
  const ids = new Set();
  for (const def of layouts) {
    assert.match(def.id, /^[a-z0-9-]+$/, def.id);
    assert.ok(!ids.has(def.id), 'doppelte ID ' + def.id);
    ids.add(def.id);
    assert.ok(def.name && def.name.length <= 18, 'Name fehlt/zu lang: ' + def.id);
    assert.ok(!/ß/.test(def.name), 'Schweizer Rechtschreibung (ss statt ß): ' + def.name);
  }
});

test('jedes Layout ist gültig, passt aufs iPhone und lässt sich lösbar verteilen', () => {
  for (const def of layouts) {
    const L = parseLayout(def);
    assert.deepEqual(validateLayout(L), [], def.id);
    assert.ok(L.tiles.length >= 24 && L.tiles.length <= 144, def.id);
    // iPhone 13 (390 × ~560 px Spielfläche): ohne Zoom mindestens 26 px breite Steine
    const w = fitTileWidth(L.tiles, 390, 560);
    assert.ok(w >= 26, `${def.id}: Steine nur ${w.toFixed(1)} px breit`);
    const b = buildBoard(L);
    const d = generateDeal(b, def.id + '-test');
    assert.ok(verifySolution(b, d.faces, new Uint8Array(b.n).fill(1), d.solution), def.id);
  }
});

test('Reise wird grösser: Steinzahl steigt grob an', () => {
  const n = layouts.map((d) => parseLayout(d).tiles.length);
  assert.ok(n[0] <= 40, 'erstes Layout soll klein sein');
  assert.ok(Math.max(...n) >= 140, 'mindestens ein grosses Layout');
  for (let i = 1; i < n.length; i++) assert.ok(n[i] >= n[i - 1] - 20, `Sprung zurück bei ${layouts[i].id}`);
});

test('mindestens 3 Steinsätze, Emoji-Sätze vollständig und ohne Doppelte', () => {
  assert.ok(tilesets.length >= 3);
  assert.equal(tilesets[0].id, 'klassisch');
  assert.equal(tilesets[0].kind, 'drawn');
  const ids = new Set(tilesets.map((t) => t.id));
  assert.equal(ids.size, tilesets.length);
  for (const t of tilesets) {
    assert.ok(t.name && t.edge && t.edgeDark && t.bonusNames?.length === 2, t.id);
    if (t.kind !== 'emoji') continue;
    assert.equal(t.faces.length, 34, t.id + ': 34 Bilder');
    assert.equal(t.bonus.length, 2, t.id);
    for (const g of t.bonus) assert.equal(g.length, 4, t.id);
    const all = [...t.faces, ...t.bonus.flat()];
    assert.equal(all.length, FACE_COUNT);
    assert.equal(new Set(all).size, all.length, t.id + ': doppeltes Emoji');
  }
});

test('Tagesrätsel: für ein Datum immer gleich, gültig und lösbar', () => {
  const seen = new Set();
  for (let d = 1; d <= 20; d++) {
    const date = `2026-12-${String(d).padStart(2, '0')}`;
    const a = dailyDef(date), b = dailyDef(date);
    assert.deepEqual(a, b);
    const L = parseLayout(a);
    assert.deepEqual(validateLayout(L), [], date);
    assert.ok(fitTileWidth(L.tiles, 390, 560) >= 26, date);
    const board = buildBoard(L);
    const deal = generateDeal(board, 'mahjong-' + date);
    assert.ok(verifySolution(board, deal.faces, new Uint8Array(board.n).fill(1), deal.solution));
    seen.add(a.id);
  }
  assert.ok(seen.size >= 5, 'Tagesrätsel soll abwechseln');
});

test('Tische: eindeutig, aufsteigend, erster gratis, gültige Farben', async () => {
  const { tables } = await import('../data/tables.js');
  assert.ok(tables.length >= 2);
  assert.equal(tables[0].stars, 0);
  assert.equal(new Set(tables.map((t) => t.id)).size, tables.length);
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(t.name && !t.name.includes('ß'), t.name);
    assert.match(t.c1, /^#[0-9a-f]{6}$/i);
    assert.match(t.c2, /^#[0-9a-f]{6}$/i);
    if (i > 0) assert.ok(t.stars > tables[i - 1].stars, `${t.id}: Sterne aufsteigend`);
  }
});
