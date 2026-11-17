// node --test match3/tests/*.test.mjs
// Inhalte prüfen: handgemachte Level, Brettformen, Welten, Texte, erzeugte Level (≥150) und Lösbarkeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../data/levels.js';
import { shapes } from '../data/shapes.js';
import { worlds } from '../data/worlds.js';
import * as texts from '../data/texts.js';
import { getLevel, levelDef, shapeOk, fillable, MIN_LEVELS, PER_WORLD, HANDMADE, worldInfo } from '../levels.js';
import { parseLevel, Game, MAX_COLORS } from '../engine.js';
import { autoplay } from '../solver.js';
import { hashString } from '../../shared/rng.js';

function checkStart(L, label) {
  for (const seed of [L.seed, L.seed + 1, L.seed + 99]) {
    const g = new Game({ ...L, seed });
    assert.equal(g._anyMatch(), false, `${label}: keine fertigen Dreier am Start`);
    assert.ok(g.hasMove(), `${label}: mindestens ein Zug möglich`);
    assert.ok(g.cells.every((p, i) => !g.mask[i] || p), `${label}: Brett voll`);
  }
}

function checkLevel(L, label) {
  assert.ok(L.w >= 5 && L.w <= 9 && L.h >= 5 && L.h <= 9, `${label}: Grösse 5–9`);
  assert.ok(shapeOk(L.w, L.h, L.mask), `${label}: Form zusammenhängend, jede Zelle Teil einer möglichen Reihe`);
  assert.ok(fillable(L.w, L.h, L.mask, L.stone), `${label}: jede Zelle kann nachgefüllt werden`);
  assert.ok(L.colors >= 3 && L.colors <= MAX_COLORS, `${label}: 3–6 Farben`);
  assert.ok(L.moves >= 8 && L.moves <= 60, `${label}: Zuglimit sinnvoll (${L.moves})`);
  assert.ok(L.goals.length >= 1 && L.goals.length <= 3, `${label}: 1–3 Ziele`);
  for (const g of L.goals) {
    if (g.type === 'ice') assert.ok(L.ice.some((x) => x > 0), `${label}: Eis-Ziel ohne Eis`);
    if (g.type === 'stone') assert.ok(L.stone.some((x) => x > 0), `${label}: Stein-Ziel ohne Steine`);
    if (g.type === 'item') assert.ok(g.n >= 1 && g.n <= 10, `${label}: Eicheln 1–10`);
  }
  const s = L.stars;
  assert.ok(s[1] > 0 && s[2] > s[1], `${label}: Sterne-Punkte steigen (${s})`);
  checkStart(L, label);
}

test('Handgemachte Level (mind. 20) sind gültig', () => {
  assert.ok(levels.length >= 20 && HANDMADE === levels.length);
  levels.forEach((def, k) => {
    const n = k + 1;
    const L = getLevel(n);
    checkLevel(L, `Level ${n}`);
    assert.ok(def.map.every((row) => row.length === def.map[0].length), `Level ${n}: Zeilen gleich lang`);
  });
});

test('Brettformen sind gültig und eindeutig', () => {
  const ids = new Set();
  for (const s of shapes) {
    assert.ok(/^[a-zäöü0-9-]+$/.test(s.id) && !ids.has(s.id), `Form-ID ${s.id}`);
    ids.add(s.id);
    const h = s.map.length, w = s.map[0].length;
    assert.ok(w <= 9 && h <= 9 && s.map.every((r) => r.length === w && /^[.-]+$/.test(r)), `Form ${s.id}: Format`);
    const mask = s.map.join('').split('').map((ch) => (ch === '.' ? 1 : 0));
    assert.ok(shapeOk(w, h, mask), `Form ${s.id}: zusammenhängend und spielbar`);
    assert.ok(s.from >= 1, `Form ${s.id}: from`);
  }
  assert.ok(shapes.filter((s) => s.from <= 21).length >= 3, 'genug Formen ab Level 21');
});

test('Welten und Texte sind vollständig (Schweizer Rechtschreibung)', () => {
  assert.ok(worlds.length >= 8);
  for (const w of worlds) {
    assert.ok(w.name && w.emoji && w.deco.length >= 2 && w.sky.length === 2 && w.cells.length === 2 && /^#[0-9a-f]{6}$/i.test(w.accent), w.name);
  }
  assert.equal(worldInfo(worlds.length).title, worlds[0].name + ' II', 'Welten wiederholen sich mit Zusatz');
  assert.equal(texts.gemNames.length, MAX_COLORS);
  for (const k of ['ice', 'stone', 'item']) assert.ok(texts.firstTips[k].title && texts.firstTips[k].text);
  assert.ok(texts.winTitles.length && texts.loseTitles.length && texts.zenMilestones.length);
  const all = JSON.stringify([texts, worlds, levels.map((l) => l.tip || '')]);
  assert.ok(!all.includes('ß'), 'kein «ß» (Schweizer Rechtschreibung)');
});

test(`Mindestens ${MIN_LEVELS} Level werden deterministisch erzeugt und sind gültig`, () => {
  assert.ok(MIN_LEVELS >= 150 && MIN_LEVELS % PER_WORLD === 0);
  const kinds = new Set();
  for (let n = HANDMADE + 1; n <= MIN_LEVELS; n++) {
    const L = getLevel(n);
    checkLevel(L, `Level ${n}`);
    for (const g of L.goals) kinds.add(g.type);
    if (L.mask.some((x) => !x)) kinds.add('holes');
  }
  for (const k of ['score', 'color', 'ice', 'stone', 'item', 'holes']) assert.ok(kinds.has(k), `Zieltyp/Element «${k}» kommt vor`);
  for (const n of [21, 77, 150]) assert.deepEqual(levelDef(n), levelDef(n), `Level ${n} deterministisch`);
});

test('Lösbarkeit: der Test-Spieler schafft die Level mit Zuglimit (+5 Gratis-Züge)', () => {
  const sample = [];
  for (let n = 1; n <= HANDMADE; n++) sample.push(n);
  for (let n = HANDMADE + 1; n <= MIN_LEVELS; n += 4) sample.push(n);
  const failed = [];
  for (const n of sample) {
    const L = getLevel(n);
    let won = false;
    for (let k = 0; k < 4 && !won; k++) {
      const g = new Game({ ...L, moves: L.moves + 5, seed: hashString(`solve-${n}-${k}`) });
      won = autoplay(g, { seed: 100 + k });
    }
    if (!won) failed.push(n);
  }
  assert.deepEqual(failed, [], `nicht geschafft: ${failed.join(', ')}`);
});
