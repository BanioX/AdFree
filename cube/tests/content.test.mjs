// Prüft die Inhalte in cube/data/levels.js (Format, Werte, Rechtschreibung).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZES, LATE_SIZES, HEARTS, SPECIAL_EVERY, SPECIALS, CHAPTER_SIZE, THEMES, PRAISE, PRAISE_EN,
} from '../data/levels.js';
import { levelParams, specialFor, themeFor, generateLevel, solve } from '../generator.js';
import { makeCube } from '../geometry.js';

const HEX = /^#[0-9a-f]{6}$/i;
const SPECIAL_KEYS = new Set(['id', 'title', 'emoji', 'text', 'grow', 'maxN', 'density', 'maxDensity', 'hearts', 'minLen', 'maxLen', 'turn', 'maxTurns', 'mustCross', 'textMax',
  'title_en', 'text_en', 'textMax_en']);

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
    if ('textMax' in sp) { assert.ok(sp.textMax.length <= 60, `${sp.id}: kurzer textMax`); swiss(sp.textMax, sp.id); }
    // Englisch: Titel und Satz immer, textMax_en genau dann, wenn es textMax gibt
    assert.ok(sp.title_en && sp.title_en.length <= 18, `${sp.id}: englischer Titel`);
    assert.ok(sp.text_en && sp.text_en.length <= 60, `${sp.id}: englischer Satz`);
    assert.equal('textMax_en' in sp, 'textMax' in sp, `${sp.id}: textMax_en passend zu textMax`);
    if ('textMax_en' in sp) assert.ok(sp.textMax_en.length <= 60, `${sp.id}: kurzer textMax_en`);
    if ('maxTurns' in sp) assert.ok(Number.isInteger(sp.maxTurns) && sp.maxTurns >= 0);
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

/** Kurven pro Pfeil: Richtungswechsel innerhalb einer Seite (über eine Kante gerade weiter zählt nicht). */
function turnsOf(a, N) {
  const NN = N * N;
  const f = (c) => (c / NN) | 0, u = (c) => c % N, v = (c) => ((c % NN) / N) | 0;
  let t = 0;
  for (let i = 2; i < a.cells.length; i++) {
    const [p, q, r] = [a.cells[i - 2], a.cells[i - 1], a.cells[i]];
    if (f(p) !== f(q) || f(q) !== f(r)) continue;
    if (u(q) - u(p) !== u(r) - u(q) || v(q) - v(p) !== v(r) - v(q)) t++;
  }
  return t;
}

test('Spezial-Level halten, was ihr Text verspricht (Kurven, Kanten, Grösse)', () => {
  const agg = {};
  for (let L = 3; L <= 200; L++) {
    const sp = specialFor(L);
    const key = sp ? sp.id : 'normal';
    const g = agg[key] || (agg[key] = { arrows: 0, straight: 0, turns: 0 });
    const lv = generateLevel(L);
    for (const a of lv.arrows) {
      const t = turnsOf(a, lv.N);
      g.arrows++; g.turns += t; if (t === 0) g.straight++;
      if (sp && Number.isInteger(sp.maxTurns)) assert.ok(t <= sp.maxTurns, `L${L}: höchstens ${sp.maxTurns} Kurven`);
    }
    if (sp && sp.mustCross) {
      const geo = makeCube(lv.N);
      for (const a of lv.arrows) assert.ok(new Set(a.cells.map((c) => geo.faceOf(c))).size > 1, `L${L}: Pfeil über eine Kante`);
    }
    // «Riesenwürfel»: grösser als das Level davor – oder (bei Höchstgrösse) mit passendem Text
    if (sp && sp.grow) {
      const p = levelParams(L);
      assert.ok(p.grew || (p.N === 10 && sp.textMax), `L${L}: grösser oder textMax`);
    }
  }
  const rate = (k) => agg[k].turns / agg[k].arrows;
  const straightShare = (k) => agg[k].straight / agg[k].arrows;
  assert.ok(straightShare('straight') >= 0.9, `«Gerade Wege»: fast nur gerade (${straightShare('straight').toFixed(2)})`);
  assert.ok(rate('straight') < rate('normal') / 3, '«Gerade Wege»: viel weniger Kurven als normal');
  assert.ok(rate('twisty') > rate('normal') * 1.4, '«Kringel»: deutlich mehr Kurven als normal');
  assert.ok(rate('long') > rate('normal'), '«Lange Schlangen»: kurvenreicher als normal');
});

test('Kapitel-Themen: gültige Farben, eindeutig, reihum', () => {
  assert.ok(CHAPTER_SIZE >= 5);
  const ids = new Set();
  for (const t of THEMES) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(t.id));
    ids.add(t.id);
    assert.ok(t.name && t.name.length <= 14);
    assert.ok(t.name_en && t.name_en.length <= 14, `${t.id}: englischer Name`);
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
    assert.ok(Array.isArray(PRAISE_EN[k]) && PRAISE_EN[k].length > 0, `PRAISE_EN[${k}]`);
    for (const t of PRAISE_EN[k]) assert.ok(t.length > 0 && t.length <= 60);
  }
});
