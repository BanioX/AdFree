// Prüft die Inhalte in cube/data/levels.js (Format, Werte, Rechtschreibung).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZES, LATE_SIZES, HEARTS, SPECIAL_EVERY, SPECIALS, CHAPTER_SIZE, THEMES, PRAISE,
} from '../data/levels.js';
import { levelParams, specialFor, themeFor, generateLevel, solve } from '../generator.js';
import { makeCube } from '../geometry.js';

const HEX = /^#[0-9a-f]{6}$/i;
const SPECIAL_KEYS = new Set(['id', 'title', 'emoji', 'text', 'grow', 'maxN', 'density', 'maxDensity', 'hearts', 'minLen', 'maxLen', 'turn', 'mustCross']);

/** Schweizer Rechtschreibung: kein ß, typografische Anführungszeichen «». */
function swiss(text, where) {
  assert.ok(!text.includes('ß'), `${where}: kein «ß» (Schweizer Rechtschreibung)`);
  assert.ok(!/["„“”]/.test(text), `${where}: Anführungszeichen «so»`);
}

test('Grössen-Rampe: aufsteigend, 3..10', () => {
  let prevTo = 0, prevN = 3;
  for (const r of SIZES) {
    assert.ok(Number.isInteger(r.to) && r.to > prevTo, 'to aufsteigend');
    assert.ok(Number.isInteger(r.N) && r.N >= 3 && r.N <= 10 && r.N >= prevN, 'N 3..10, nicht kleiner werdend');
    prevTo = r.to; prevN = r.N;
  }
  assert.ok(LATE_SIZES.length > 0 && LATE_SIZES.every((n) => Number.isInteger(n) && n >= 3 && n <= 10));
  assert.ok(HEARTS.every((r) => r.hearts >= 3 && r.hearts <= 5));
  assert.equal(HEARTS.at(-1).maxN >= 10, true, 'letzte Herzen-Zeile deckt alle Grössen ab');
});

test('Spezial-Level: gültige Regler, eindeutige IDs, Texte', () => {
  assert.ok(SPECIAL_EVERY >= 2);
  const ids = new Set();
  for (const sp of SPECIALS) {
    assert.match(sp.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(sp.id), `doppelte ID ${sp.id}`);
    ids.add(sp.id);
    for (const k of Object.keys(sp)) assert.ok(SPECIAL_KEYS.has(k), `${sp.id}: unbekannter Regler «${k}»`);
    assert.ok(sp.title && sp.title.length <= 18, `${sp.id}: kurzer Titel`);
    assert.ok(sp.text && sp.text.length <= 60, `${sp.id}: kurzer Satz`);
    swiss(sp.title + sp.text, sp.id);
    if ('turn' in sp) assert.ok(sp.turn >= 0 && sp.turn <= 1);
    if ('maxN' in sp) assert.ok(sp.maxN >= 3 && sp.maxN <= 10);
    if ('minLen' in sp) assert.ok(sp.minLen >= 2 && sp.minLen <= 8);
  }
});

test('Jeder Spezial-Typ erzeugt lösbare Level (mehrere Grössen)', () => {
  for (let k = 0; k < SPECIALS.length; k++) {
    for (let round = 0; round < 4; round++) {
      const L = SPECIAL_EVERY * (k + 1 + round * SPECIALS.length);
      assert.equal(specialFor(L).id, SPECIALS[k].id);
      const p = levelParams(L);
      assert.ok(p.hearts >= 3 && p.hearts <= 5, `L${L}: Herzen`);
      const lv = generateLevel(L);
      assert.ok(lv.arrows.length >= 6, `L${L}: genug Pfeile`);
      assert.ok(solve(makeCube(lv.N), lv.arrows), `L${L}: lösbar`);
    }
  }
});

test('Kapitel-Themen: gültige Farben, eindeutig, reihum', () => {
  assert.ok(CHAPTER_SIZE >= 5);
  const ids = new Set();
  for (const t of THEMES) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(t.id));
    ids.add(t.id);
    assert.ok(t.name && t.name.length <= 14);
    swiss(t.name, t.id);
    for (const k of ['light', 'dark', 'edge', 'ink']) assert.match(t[k], HEX, `${t.id}.${k}`);
    if (t.hint) assert.match(t.hint, HEX);
    // Tinte muss sich deutlich vom Papier abheben
    const lum = (hex) => { const v = parseInt(hex.slice(1), 16); return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255); };
    assert.ok(lum(t.light) - lum(t.ink) > 140, `${t.id}: Kontrast Tinte/Papier`);
    assert.ok(lum(t.dark) - lum(t.ink) > 100, `${t.id}: Kontrast Tinte/Schatten`);
  }
  assert.equal(themeFor(1).id, THEMES[0].id);
  assert.equal(themeFor(CHAPTER_SIZE + 1).id, THEMES[1 % THEMES.length].id);
  assert.equal(themeFor(CHAPTER_SIZE * THEMES.length + 1).id, THEMES[0].id);
  assert.equal(themeFor(CHAPTER_SIZE * 2).chapter, 2);
});

test('Lob-Sätze für 1–3 Sterne', () => {
  for (const k of [1, 2, 3]) {
    assert.ok(Array.isArray(PRAISE[k]) && PRAISE[k].length > 0);
    for (const t of PRAISE[k]) swiss(t, `PRAISE[${k}]`);
  }
});
