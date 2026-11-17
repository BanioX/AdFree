// Inhalte prüfen: Partie-Listen (stichprobenartig mit dem Löser nachgespielt), Tagesrätsel,
// Kartenrücken, Tische, Kartengesichter.   node --test solitaire/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLVABLE, DAILY } from '../data/seeds.js';
import { BACKS, DEFAULT_BACK, PATTERNS, backSVG } from '../data/backs.js';
import { TABLES, DEFAULT_TABLE, tableBackground } from '../data/tables.js';
import { MODES, newDeal } from '../logic/rules.js';
import { solveSeed, solveState } from '../logic/solve.js';
import { replayWins } from '../logic/replay.js';
import { faceHTML } from '../cardface.js';
import { dailyDeal, dayNumber, DAILY_VARIANTS, FIRST_DEAL } from '../deals.js';
import { findHint } from '../logic/hints.js';
import { doMove, stockAction, autoFoundationMove, isWon } from '../logic/rules.js';

const HEX = /^#[0-9a-f]{6}$/i;

test('Partie-Listen: Struktur', () => {
  for (const [key, list] of [...Object.entries(SOLVABLE), ...Object.entries(DAILY).map(([k, v]) => ['daily-' + k, v])]) {
    assert.ok(MODES[list.mode], key + ': Modus');
    assert.ok(list.seeds.length >= 300, key + ': genug Partien');
    for (let i = 0; i < list.seeds.length; i++) {
      const s = list.seeds[i];
      assert.ok(Number.isInteger(s) && s >= list.from && s <= list.to, key + ': im Bereich');
      if (i) assert.ok(s > list.seeds[i - 1], key + ': aufsteigend, ohne Doppel');
    }
  }
  for (const m of ['klondike1', 'klondike3', 'freecell', 'spider1']) assert.ok(SOLVABLE[m], 'Liste für ' + m);
  assert.ok(DAILY.klondike1 && DAILY.klondike1.seeds.length >= 366, 'Klondike-Tagesrätsel für ein Jahr');
  for (const v of Object.values(DAILY_VARIANTS)) assert.ok(DAILY[v.mode], 'Tagesliste für ' + v.mode);
});

test('Partie-Listen: Stichproben sind wirklich lösbar (Löser + Nachspielen)', () => {
  for (const [key, list] of [...Object.entries(SOLVABLE), ...Object.entries(DAILY).map(([k, v]) => ['daily-' + k, v])]) {
    const n = list.seeds.length;
    const picks = [list.seeds[0], list.seeds[(n / 2) | 0], list.seeds[n - 1]];
    for (const seed of picks) {
      const r = solveSeed(list.mode, seed, { wantMoves: true, maxNodes: 400000 });
      assert.ok(r.solved, `${key} #${seed} lösbar`);
      assert.ok(replayWins(newDeal(list.mode, seed), r.moves), `${key} #${seed} Lösung gewinnt`);
    }
  }
});

test('Löser: findet Lösungen und erkennt Unlösbares nicht fälschlich als gelöst', () => {
  const st = newDeal('freecell', 1);
  const r = solveState(st, { wantMoves: true });
  assert.ok(r.solved && replayWins(st, r.moves));
  // Klondike: eine Partie aus der Liste, ab einem Zwischenstand weiter lösbar
  const seed = SOLVABLE.klondike1.seeds[3];
  const k = solveSeed('klondike1', seed, { wantMoves: true });
  assert.ok(k.solved && replayWins(newDeal('klondike1', seed), k.moves));
});

test('Tagesrätsel: für alle gleich, jeden Tag anders, garantiert lösbar', async () => {
  assert.equal(dayNumber('2026-01-01'), 0);
  assert.equal(dayNumber('2026-11-17'), 320);
  for (const v of Object.keys(DAILY_VARIANTS)) {
    const a = await dailyDeal(v, '2026-11-17');
    const b = await dailyDeal(v, '2026-11-17');
    const c = await dailyDeal(v, '2026-11-18');
    assert.equal(a.seed, b.seed);
    assert.notEqual(a.seed, c.seed);
    assert.ok(a.verified, v + ' geprüft');
    assert.ok(DAILY[DAILY_VARIANTS[v].mode].seeds.includes(a.seed));
  }
  // 400 Tage hintereinander ohne Wiederholung (Klondike)
  const seen = new Set();
  const d0 = Date.UTC(2026, 10, 17);
  for (let i = 0; i < 366; i++) {
    const day = new Date(d0 + i * 864e5).toISOString().slice(0, 10);
    seen.add((await dailyDeal('klondike', day)).seed);
  }
  assert.equal(seen.size, 366);
});

test('Kartenrücken', () => {
  const ids = new Set();
  for (const b of BACKS) {
    assert.match(b.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(b.id), 'id eindeutig: ' + b.id);
    ids.add(b.id);
    assert.ok(b.name && b.name.length <= 11, 'Name kurz genug: ' + b.name);
    for (const k of ['bg', 'fg', 'frame']) assert.match(b[k], HEX, `${b.id}.${k}`);
    assert.ok(b.svg || PATTERNS[b.pattern], 'Muster vorhanden: ' + b.id);
    const svg = backSVG(b);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    assert.ok(!/undefined|NaN/.test(svg), 'SVG sauber: ' + b.id);
  }
  assert.ok(ids.has(DEFAULT_BACK));
});

test('Tische', () => {
  const ids = new Set();
  for (const t of TABLES) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(t.id));
    ids.add(t.id);
    assert.ok(t.name && t.name.length <= 11, 'Name kurz genug: ' + t.name);
    for (const k of ['base', 'light', 'dark']) assert.match(t[k], HEX, `${t.id}.${k}`);
    assert.ok(['light', 'dark'].includes(t.ink));
    assert.ok(['felt', 'linen', 'wood', 'none'].includes(t.texture));
    assert.ok(!/undefined/.test(tableBackground(t)));
  }
  assert.ok(ids.has(DEFAULT_TABLE));
});

test('Kartengesichter: alle 52 Karten, beide Beschriftungen', () => {
  for (let code = 0; code < 52; code++) {
    for (const labels of ['BDK', 'JQK']) {
      const html = faceHTML(code, { labels });
      assert.ok(html.startsWith('<div class="face s') && !/undefined|NaN/.test(html), `Karte ${code}`);
    }
  }
  assert.match(faceHTML(10, { labels: 'BDK' }), />B</);
  assert.match(faceHTML(12, { labels: 'JQK' }), />K</);
});

test('Einstiegspartien: lösbar und schon mit «immer den Tipp nehmen» zu gewinnen', () => {
  for (const [mode, seed] of Object.entries(FIRST_DEAL)) {
    assert.ok(SOLVABLE[mode].seeds.includes(seed), `${mode} #${seed} in der Liste`);
    const st = newDeal(mode, seed);
    const hist = [];
    for (let k = 0; k < 400 && !isWon(st); k++) {
      const h = findHint(st, hist);
      assert.ok(h, `${mode} #${seed}: Tipp vorhanden (Zug ${k})`);
      const ops = h.kind === 'stock' ? stockAction(st).ops : doMove(st, h.from, h.index, h.to);
      hist.push({ ops });
      for (let m = autoFoundationMove(st); m; m = autoFoundationMove(st)) doMove(st, m.from, m.index, m.to);
    }
    assert.ok(isWon(st), `${mode} #${seed} mit Tipps gewonnen`);
  }
});

test('Sammlung: Freischaltungen zeigen auf echte Designs, Standard ist frei', async () => {
  const { UNLOCKS, isUnlocked, newlyUnlocked, nextUnlock, starsFor } = await import('../logic/unlocks.js');
  const seen = new Set();
  for (const u of UNLOCKS) {
    const list = u.kind === 'back' ? BACKS : TABLES;
    assert.ok(list.some((x) => x.id === u.id), `${u.kind} ${u.id} existiert`);
    assert.ok(!seen.has(u.kind + u.id), 'keine Doppel');
    seen.add(u.kind + u.id);
  }
  assert.ok(isUnlocked('back', DEFAULT_BACK, 0) && isUnlocked('table', DEFAULT_TABLE, 0), 'Standard frei');
  assert.ok(BACKS.filter((b) => isUnlocked('back', b.id, 0)).length >= 4, 'mind. 4 Rücken von Anfang an');
  assert.ok(newlyUnlocked(0, 1).length >= 1, 'erster Sieg schaltet etwas frei');
  assert.ok(isUnlocked('back', 'klee', 0, ['back:klee']), 'gewählte Designs bleiben frei');
  assert.equal(nextUnlock(999), null);
  assert.equal(starsFor({}), 3);
  assert.equal(starsFor({ undos: 2 }), 2);
  assert.equal(starsFor({ hints: 3, undos: 5 }), 1);
});
