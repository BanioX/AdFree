// Prüft die Inhalte in merge/data/ (Stile, Modi, Etappen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { skins, skinById, tileOf, DEFAULT_SKIN } from '../data/skins.js';
import { modes, modeById, DEFAULT_MODE, undoRules } from '../data/modes.js';
import { chapters, shapes, chapterPlan, handmade, MAX_TARGET, MAX_BOSS_TARGET, MIN_TARGET } from '../data/levels.js';
import { makeLevel, parseShape } from '../levelgen.js';
import { FREE } from '../logic.js';

const HEX = /^#[0-9a-f]{6}$/i;

test('Stile: Pflicht-Stile vorhanden, ids eindeutig', () => {
  const ids = skins.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['zahlen', 'fruechte', 'tiere', 'suesses', 'blumen', 'weltall']) assert.ok(ids.includes(id), id);
  assert.ok(ids.includes(DEFAULT_SKIN));
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

test('Stile: mindestens 12 Stufen, Farben und Bilder gültig', () => {
  for (const s of skins) {
    assert.ok(s.title && s.icon, s.id);
    assert.match(s.board, HEX, s.id); assert.match(s.slot, HEX, s.id); assert.match(s.ink, HEX, s.id);
    assert.ok(s.tiles.length >= 12, `${s.id}: nur ${s.tiles.length} Stufen`);
    const seen = new Set();
    s.tiles.forEach((t, i) => {
      assert.match(t.color, HEX, `${s.id}[${i}]`);
      if (t.ink) assert.match(t.ink, HEX, `${s.id}[${i}]`);
      if (!s.numbers) {
        assert.ok(t.emoji && t.emoji.length <= 8, `${s.id}[${i}] emoji`);
        assert.ok(t.name && t.name.length <= 16, `${s.id}[${i}] name «${t.name}» fehlt/zu lang`);
        assert.ok(!/ß/.test(t.name), `${s.id}[${i}]: «ss» statt «ß»`);
        assert.ok(!seen.has(t.emoji), `${s.id}: ${t.emoji} doppelt`);
        seen.add(t.emoji);
      }
    });
  }
  const s = skinById('fruechte');
  assert.equal(tileOf(s, 1).emoji, s.tiles[0].emoji);
  assert.equal(tileOf(s, s.tiles.length + 2).extra, 2);
  assert.equal(skinById('gibtsnicht').id, DEFAULT_SKIN);
});

test('Modi: Klassisch 4×4, Entspannt 5×5/6×6, Knifflig 3×3', () => {
  const ids = modes.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const sizes = modes.map((m) => m.size).sort();
  assert.deepEqual(sizes, [3, 4, 5, 6]);
  for (const m of modes) {
    assert.ok(m.size >= 3 && m.size <= 6);
    assert.ok(m.target >= 6 && m.target <= 14);
    assert.ok(m.title && m.sub && m.blurb);
  }
  assert.equal(modeById(DEFAULT_MODE).size, 4);
  assert.ok(undoRules.start >= 1 && undoRules.max >= undoRules.start && undoRules.refillEvery > 0 && undoRules.history >= undoRules.max);
});

test('Etappen-Daten: Formen, Kapitel, Ablauf', () => {
  const shapeIds = new Set();
  for (const sh of shapes) {
    assert.ok(!shapeIds.has(sh.id), sh.id); shapeIds.add(sh.id);
    const n = sh.rows.length;
    assert.ok(n >= 3 && n <= 6, sh.id);
    for (const r of sh.rows) { assert.equal(r.length, n, sh.id); assert.match(r, /^[.ox]+$/, sh.id); }
    const { walls } = parseShape(sh);
    assert.ok(walls.filter((w) => w === FREE).length >= 7, `${sh.id}: zu wenig freie Felder`);
    assert.ok(sh.maxE >= 6 && sh.maxE <= 11, sh.id);
  }
  for (const ch of chapters) assert.ok(skins.some((s) => s.id === ch.skin), `${ch.id}: Stil ${ch.skin} fehlt`);
  assert.equal(chapterPlan.length, 12);
  for (const p of chapterPlan) {
    if (p.shapes) for (const id of p.shapes) assert.ok(shapeIds.has(id), id);
    else assert.ok(shapes.some((s) => s.rows.length === p.size), `keine Form für ${p.size}`);
  }
  for (const [n, hm] of Object.entries(handmade)) {
    assert.ok(shapeIds.has(hm.shape), `Etappe ${n}`);
    assert.ok(Number.isInteger(Math.log2(hm.goal.value)), `Etappe ${n}: Zielwert`);
  }
  assert.ok(MIN_TARGET <= MAX_TARGET && MAX_TARGET <= MAX_BOSS_TARGET);
});

test('Etappen 1–400: gültig, fest und nicht über der Machbarkeit', () => {
  for (let n = 1; n <= 400; n++) {
    const l = makeLevel(n);
    assert.deepEqual(makeLevel(n), l, 'deterministisch');
    assert.equal(l.walls.length, l.size * l.size);
    const sh = shapes.find((s) => s.id === l.shape);
    assert.ok(l.goal.e <= sh.maxE, `Etappe ${n}: Ziel über maxE`);
    assert.ok(l.goal.e >= 4);
    if (l.goal.type === 'count') assert.ok(l.goal.n >= 2 && l.goal.n <= 4);
    assert.ok(l.par > 0 && l.par2 >= l.par);
    assert.ok(skins.some((s) => s.id === l.skin));
  }
});
