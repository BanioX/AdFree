// Prüft die Inhalts-Dateien in /sort/data/ (hilft beim Erweitern, siehe CONTENT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liquids, PRIMARY_COUNT, hiddenLiquid } from '../data/colors.js';
import { ramp, endless, minMovesFor, features, handmade } from '../data/levels.js';
import { chapters, CHAPTER_SIZE } from '../data/chapters.js';
import { dailyWeek } from '../data/daily.js';
import { praise, tips, howTo, featureIntro, stuck } from '../data/texts.js';
import { buildLevel, levelParams } from '../logic/levels.js';

const SYMBOLS = new Set(['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'drop', 'flower', 'cross', 'moon', 'ring', 'hexagon', 'bolt', 'leaf', 'bars', 'sun']);
const HEX = /^#[0-9a-f]{6}$/i;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Farben: eindeutig, gültig, mit Symbol', () => {
  assert.ok(liquids.length >= 14 && liquids.length <= 26);
  assert.ok(PRIMARY_COUNT <= liquids.length);
  assert.equal(new Set(liquids.map((l) => l.id)).size, liquids.length);
  assert.equal(new Set(liquids.map((l) => l.color.toLowerCase())).size, liquids.length);
  assert.equal(new Set(liquids.map((l) => l.symbol)).size, liquids.length, 'jedes Symbol nur einmal');
  for (const l of liquids) {
    assert.match(l.id, /^[a-z0-9-]+$/);
    assert.match(l.color, HEX);
    assert.ok(SYMBOLS.has(l.symbol), l.symbol);
    assert.ok(l.name.length > 1);
  }
  assert.match(hiddenLiquid.color, HEX);
});

test('Farben sind gut unterscheidbar (Mindestabstand)', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < liquids.length; i++) {
    for (let j = i + 1; j < liquids.length; j++) {
      const a = rgb(liquids[i].color), b = rgb(liquids[j].color);
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(d > 55, `${liquids[i].id} / ${liquids[j].id} zu ähnlich (${d.toFixed(0)})`);
    }
  }
});

test('Schwierigkeitskurve ist aufsteigend und machbar', () => {
  let prev = 0, prevColors = 0;
  for (const r of ramp) {
    assert.ok(r.from > prev, 'from aufsteigend');
    assert.ok(r.colors >= prevColors, 'Farben steigen');
    assert.ok(r.colors >= 2 && r.colors <= liquids.length);
    assert.ok(r.minMoves >= r.colors);
    prev = r.from; prevColors = r.colors;
  }
  assert.ok(endless.from > prev);
  for (const c of endless.colors) assert.ok(c >= 2 && c <= liquids.length && minMovesFor[c] > 0);
  for (const f of Object.values(features)) assert.ok(f.from >= 1 && f.every >= 1);
});

test('Handgemachte Level sind gültig', () => {
  for (const [n, def] of Object.entries(handmade)) {
    for (const c of def.colors) assert.ok(liquids.some((l) => l.id === c), c);
    const lv = buildLevel(Number(n));
    assert.ok(lv.par > 0);
    assert.ok(levelParams(Number(n)).handmade);
  }
});

test('Kapitel und Tagesrätsel', () => {
  assert.ok(CHAPTER_SIZE >= 5);
  assert.ok(chapters.length >= 10);
  for (const c of chapters) {
    assert.ok(c.name && c.emoji);
    assert.match(c.bg[0], HEX);
    assert.match(c.bg[1], HEX);
    assert.match(c.shelf, HEX);
  }
  assert.equal(dailyWeek.length, 7);
  for (const d of dailyWeek) {
    assert.ok(d.name && d.colors >= 4 && d.colors <= liquids.length);
    if (d.gross) assert.ok(['filled', 'empty'].includes(d.gross));
  }
});

test('Texte vorhanden', () => {
  assert.ok(praise.length >= 10);
  assert.ok(tips.length >= 5);
  assert.equal(howTo.length, 4);
  assert.ok(featureIntro.geheimnis && featureIntro.gross);
  assert.ok(stuck.title && stuck.text);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'tests') walk(p, out); }
    else if (/\.(js|html|css|md)$/.test(name)) out.push(p);
  }
  return out;
}

test('Schweizer Rechtschreibung: kein «ß» in den Spieldateien', () => {
  for (const f of walk(root)) {
    const txt = readFileSync(f, 'utf8');
    assert.ok(!txt.includes('ß'), `ß in ${f}`);
  }
});

test('keine externen Adressen im Laufzeit-Code', () => {
  for (const f of walk(root)) {
    if (f.endsWith('.md')) continue;
    const txt = readFileSync(f, 'utf8');
    assert.ok(!/https?:\/\//.test(txt), `externe URL in ${f}`);
  }
});
