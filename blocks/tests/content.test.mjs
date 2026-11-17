// Blockpuzzle – Inhalte und Abenteuer-Level prüfen: node --test blocks/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getLevel, BASE_LEVELS, HANDCRAFTED, goalTypeOf, pictureOf, worldOf, sizeOf } from '../core/levels.js';
import { Board, fullLines } from '../core/board.js';
import { Game } from '../core/game.js';
import { simulate } from '../core/bot.js';
import { catalog } from '../core/shapes.js';
import { handcrafted, cycle, curve } from '../data/levels.js';
import { pictures } from '../data/pictures.js';
import { skins, gems, GEM_KEYS } from '../data/skins.js';
import { worlds, LEVELS_PER_WORLD } from '../data/worlds.js';
import { praise } from '../data/words.js';

const HEX = /^#[0-9a-f]{6}$/i;

test('Bilder: eindeutige IDs, gültiges Format', () => {
  const ids = new Set();
  for (const p of pictures) {
    assert.ok(/^[a-z0-9-]+$/.test(p.id), `ID ${p.id}`);
    assert.ok(!ids.has(p.id), `doppelt: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.title && p.title.length < 24, `Titel ${p.id}`);
    assert.ok(Array.isArray(p.bg) && p.bg.length === 2 && p.bg.every((c) => HEX.test(c)), `bg ${p.id}`);
    if (p.rows) {
      const w = p.rows[0].length;
      assert.ok(p.rows.every((r) => r.length === w), `Zeilenlänge ${p.id}`);
      for (const ch of p.rows.join('')) assert.ok(ch === '.' || p.palette[ch], `Farbe «${ch}» fehlt in ${p.id}`);
      assert.ok(Object.values(p.palette).every((c) => HEX.test(c)), `Palette ${p.id}`);
    } else {
      assert.ok(typeof p.emoji === 'string' && p.emoji.length > 0, `Emoji ${p.id}`);
    }
  }
  assert.ok(pictures.length >= 20, 'genug Bilder für das Album');
});

test('Aussehen: Juwelen, Pastell, Holz vorhanden, je 8 Farben', () => {
  const ids = skins.map((s) => s.id);
  for (const want of ['juwelen', 'pastell', 'holz']) assert.ok(ids.includes(want), want);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of skins) {
    assert.ok(['jewel', 'soft', 'wood'].includes(s.style), s.id);
    assert.equal(s.colors.length, 8, s.id);
    assert.ok(s.colors.every((c) => HEX.test(c)), s.id);
    for (const k of ['cell', 'edge', 'cover', 'coverMark']) assert.ok(HEX.test(s.board[k]), `${s.id}.${k}`);
    assert.ok(s.board.bg.length === 2 && HEX.test(s.gray));
  }
  assert.deepEqual(Object.keys(gems).sort(), [...GEM_KEYS].sort());
});

test('Welten und Texte', () => {
  assert.equal(new Set(worlds.map((w) => w.id)).size, worlds.length);
  assert.ok(worlds.length * LEVELS_PER_WORLD >= 60);
  for (const w of worlds) assert.ok(HEX.test(w.color) && HEX.test(w.tint) && w.emoji && w.title, w.id);
  for (const k of [2, 3, 4, 'perfect', 'streak']) assert.ok(praise[k] && praise[k].length > 0, `Lob ${k}`);
  const all = JSON.stringify({ worlds, praise, handcrafted, pictures: pictures.map((p) => p.title) });
  assert.ok(!all.includes('ß'), 'Schweizer Rechtschreibung: kein ß');
  assert.equal(cycle.length, LEVELS_PER_WORLD);
  for (const t of cycle) assert.ok(['gems', 'picture', 'lines', 'score'].includes(t));
  assert.ok(curve.start >= 0 && curve.end <= 1 && curve.start < curve.end);
});

test('Handgemachte Level: gültiges Format', () => {
  const cat = catalog();
  for (const [i, L] of handcrafted.entries()) {
    const n = L.size || 8;
    assert.ok(n === 8 || n === 10, `Level ${i + 1} Grösse`);
    assert.equal(L.board.length, n, `Level ${i + 1} Zeilen`);
    for (const row of L.board) assert.ok(row.length === n && /^[.1-8rbgyp]+$/.test(row), `Level ${i + 1}: «${row}»`);
    if (L.goals.picture) assert.ok(pictures.some((p) => p.id === L.goals.picture), `Bild ${L.goals.picture}`);
    if (L.start) for (const s of L.start) assert.ok(cat.find(s), `Level ${i + 1}: Startteil ${s} unbekannt`);
  }
});

test(`Abenteuer: alle ${BASE_LEVELS} Level gültig und vom Computer lösbar`, () => {
  assert.ok(BASE_LEVELS >= 60);
  const types = { gems: 0, picture: 0, lines: 0, score: 0 };
  const usedPics = new Set();
  let big = 0;
  for (let n = 1; n <= BASE_LEVELS; n++) {
    const L = getLevel(n);
    assert.equal(L.n, n);
    assert.ok(L.verified, `Level ${n} nicht lösbar (attempt ${L.attempt})`);
    assert.ok(L.par.three >= 2 && L.par.two > L.par.three, `Level ${n} Sterne-Grenzen`);
    assert.equal(L.size, sizeOf(n));
    if (L.size === 10) big++;
    const b = Board.deserialize(L.board);
    assert.equal(b.n, L.size);
    const fl = fullLines(b.rows, b.n);
    assert.equal(fl.rows.length + fl.cols.length, 0, `Level ${n}: volle Linie am Anfang`);
    assert.ok(b.filledCount < b.n * b.n * 0.7, `Level ${n}: zu voll`);
    const g = Game.fromLevel(L);
    assert.ok(g.goalStatus().length > 0, `Level ${n}: kein Ziel`);
    assert.ok(!g.over && !g.won, `Level ${n}: Start-Zustand`);
    if (L.goals.gems) assert.ok(Object.keys(g.totals.gems).length > 0, `Level ${n}: Edelstein-Ziel ohne Edelsteine`);
    if (L.goals.picture) {
      assert.ok(g.totals.cover > 0, `Level ${n}: Bild ohne verdeckte Felder`);
      assert.equal(L.goals.picture, pictureOf(n));
      usedPics.add(L.goals.picture);
    }
    assert.equal(goalTypeOf(n), L.type);
    types[L.type]++;
    // Bot-Ergebnis reproduzierbar
    if (n % 20 === 1) {
      const sim = simulate(Game.fromLevel(L), 200);
      assert.ok(sim.won, `Level ${n}: Wiederholung nicht gewonnen`);
    }
  }
  for (const k of Object.keys(types)) assert.ok(types[k] >= 10, `Zieltyp ${k} zu selten`);
  assert.ok(big >= 10, '10×10-Level vorhanden');
  assert.ok(usedPics.size >= Math.min(20, pictures.length), 'viele verschiedene Bilder');
  assert.equal(worldOf(1).index, 0);
  assert.equal(worldOf(LEVELS_PER_WORLD + 1).index, 1);
  assert.equal(worldOf(BASE_LEVELS + 1).title.endsWith('II'), true);
  assert.ok(HANDCRAFTED >= 5);
});

test('Abenteuer: Level jenseits der Basis werden ebenfalls erzeugt', () => {
  for (const n of [241, 260, 333]) {
    const L = getLevel(n);
    assert.equal(L.n, n);
    assert.ok(L.par.three >= 2);
  }
});
