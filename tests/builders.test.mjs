import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { games, builders } from '../games.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('jedes Spiel nennt einen bekannten Erbauer', () => {
  const ids = new Set(builders.map((b) => b.id));
  assert.ok(builders.length >= 2);
  const seen = new Set();
  for (const b of builders) {
    assert.equal(seen.has(b.id), false, b.id);
    seen.add(b.id);
    assert.match(b.color, /^#[0-9a-f]{6}$/i);
    assert.ok(b.name && b.glyph);
    assert.equal(existsSync(path.join(root, b.glyph)), true, b.glyph);
  }
  for (const g of games) {
    assert.equal(ids.has(g.builder), true, `${g.id} hat keinen gültigen builder`);
  }
});

test('die ersten 16 Spiele sind von Claude, der Rest von Grok', () => {
  const claude = games.filter((g) => g.builder === 'claude').map((g) => g.id);
  const grok = games.filter((g) => g.builder === 'grok').map((g) => g.id);
  assert.deepEqual(claude, [
    'paint', 'beads', 'cube', 'solitaire', 'mahjong', 'triple', 'sudoku', 'nonogram',
    'sort', 'blocks', 'merge', 'wordsearch', 'wordle', 'match3', 'bubbles', 'jigsaw',
  ]);
  assert.equal(grok.length, games.length - 16);
  assert.equal(grok.includes('vierer'), true);
  assert.equal(grok.includes('sternkater'), true);
  assert.equal(claude.includes('vierer'), false);
});
