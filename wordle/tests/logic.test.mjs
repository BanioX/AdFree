// node --test wordle/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../logic.js';

const C = 'correct', P = 'present', A = 'absent';

test('normalizeWord: gross, NFC, ß → SS', () => {
  assert.equal(L.normalizeWord(' straße '), 'STRASSE');
  assert.equal(L.normalizeWord('blüte'), 'BLÜTE'); // NFD → NFC
  assert.equal(L.wordLength('BLÜTE'), 5);
});

test('parseWordList: Kommentare, Länge, Doppelte', () => {
  const t = '// Kommentar BLUME\nblume Tisch, TISCH  Haus\nSTRAßE\n';
  assert.deepEqual(L.parseWordList(t, 5), ['BLUME', 'TISCH']);
  assert.deepEqual(L.parseWordList(t, 4), ['HAUS']);
  assert.deepEqual(L.parseWordList(t, 7), ['STRASSE']);
});

test('scoreGuess: einfache Fälle und Umlaute', () => {
  assert.deepEqual(L.scoreGuess('BLUME', 'BLÜTE'), [C, C, A, A, C]);
  assert.deepEqual(L.scoreGuess('BLÜTE', 'BLÜTE'), [C, C, C, C, C]);
  assert.deepEqual(L.scoreGuess('BETON', 'BLÜTE'), [C, P, P, A, A]);
});

test('scoreGuess: doppelte Buchstaben korrekt', () => {
  // Grün hat Vorrang, gelb nur so oft wie noch übrig
  assert.deepEqual(L.scoreGuess('STOSS', 'TASSE'), [P, P, A, C, A]);
  assert.deepEqual(L.scoreGuess('EBENE', 'LEBEN'), [P, P, P, P, A]);
  // Doppelbuchstabe im Versuch, einfach im Lösungswort
  assert.deepEqual(L.scoreGuess('KANNE', 'KANTE'), [C, C, C, A, C]);
  assert.deepEqual(L.scoreGuess('NENNE', 'KANTE'), [A, A, C, A, C]); // E schon grün verbraucht
  // Doppelbuchstabe im Lösungswort, einfach im Versuch
  assert.deepEqual(L.scoreGuess('TANTE', 'MATTE'), [P, C, A, C, C]);
  assert.deepEqual(L.scoreGuess('AAAAA', 'ABBAB'), [C, A, A, C, A]);
});

test('keyboardStates: bester Zustand gewinnt', () => {
  const st = L.keyboardStates(['STOSS', 'TASTE'], 'TASSE');
  assert.equal(st.T, C);
  assert.equal(st.S, C);
  assert.equal(st.O, A);
  assert.equal(st.E, C);
});

test('hardModeViolation', () => {
  const prev = ['BETON']; // gegen BLÜTE: B grün, E und T gelb
  assert.equal(L.hardModeViolation('BLÜTE', prev, 'BLÜTE'), null);
  assert.deepEqual(L.hardModeViolation('LEBTE', prev, 'BLÜTE'), { type: 'position', index: 0, letter: 'B' });
  assert.deepEqual(L.hardModeViolation('BLASE', prev, 'BLÜTE'), { type: 'missing', letter: 'T', count: 1 });
  assert.match(L.hardModeMessage({ type: 'position', index: 0, letter: 'B' }), /1\. Buchstabe muss «B»/);
  // Doppelte Treffer müssen doppelt vorkommen
  const v = L.hardModeViolation('SALZE', ['STOSS'], 'TASSE');
  assert.equal(v.type, 'position'); // S an Stelle 4 grün
});

test('Spielablauf: tippen, löschen, prüfen, gewinnen', () => {
  let g = L.newGame({ answer: 'BLÜTE', now: 1 });
  for (const ch of 'blü') g = L.typeLetter(g, ch);
  assert.equal(g.input, 'BLÜ');
  assert.equal(L.typeLetter(g, '1'), g);
  g = L.deleteLetter(g);
  assert.equal(g.input, 'BL');
  let r = L.submitGuess(g);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'short');
  for (const ch of 'XYZ') g = L.typeLetter(g, ch);
  assert.equal(L.typeLetter(g, 'Q'), g, 'nicht mehr als 5 Buchstaben');
  r = L.submitGuess(g, { isAllowed: () => false });
  assert.equal(r.reason, 'unknown');
  assert.equal(r.message, 'Nicht in der Wortliste');
  r = L.submitGuess(g, { isAllowed: () => true });
  assert.equal(r.ok, true);
  g = r.game;
  for (const ch of 'BLÜTE') g = L.typeLetter(g, ch);
  r = L.submitGuess(g, { isAllowed: () => false }); // Lösungswort gilt immer
  assert.equal(r.ok, true);
  assert.equal(r.won, true);
  assert.equal(r.game.status, 'won');
  assert.equal(L.typeLetter(r.game, 'A'), r.game);
});

test('Spielablauf: nach sechs Fehlversuchen verloren', () => {
  let g = L.newGame({ answer: 'BLÜTE' });
  for (let i = 0; i < 6; i++) {
    for (const ch of 'TISCH') g = L.typeLetter(g, ch);
    const r = L.submitGuess(g);
    assert.equal(r.ok, true);
    g = r.game;
    assert.equal(r.lost, i === 5);
  }
  assert.equal(g.status, 'lost');
  assert.equal(L.submitGuess(g).reason, 'over');
});

test('Schwerer Modus blockiert ungültige Versuche', () => {
  let g = L.newGame({ answer: 'BLÜTE', hard: true });
  for (const ch of 'BETON') g = L.typeLetter(g, ch);
  g = L.submitGuess(g).game;
  for (const ch of 'TISCH') g = L.typeLetter(g, ch);
  const r = L.submitGuess(g);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'hard');
});

test('dailyWord: deterministisch, keine Wiederholung innerhalb einer Runde', () => {
  const words = Array.from({ length: 400 }, (_, i) => 'W' + String(i).padStart(4, '0'));
  assert.equal(L.dailyWord(words, '2026-11-17'), L.dailyWord([...words].reverse(), '2026-11-17'));
  const seen = new Set();
  let day = '2026-01-01';
  for (let i = 0; i < 400; i++) { seen.add(L.dailyWord(words, day)); day = L.addDays(day, 1); }
  assert.equal(seen.size, 400);
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(L.dayNumber('2026-01-02'), 1);
});

test('pickEndless: keine Wiederholung, bis alle durch sind', () => {
  const words = ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD'];
  let used = [];
  let rnd = 0.3;
  for (let i = 0; i < 4; i++) {
    const { word, resetUsed } = L.pickEndless(words, used, () => rnd, ['DDDDD']);
    if (i < 3) {
      assert.equal(resetUsed, false);
      assert.ok(!used.includes(word));
      assert.notEqual(word, 'DDDDD');
      used.push(word);
    } else {
      assert.equal(resetUsed, true, 'neue Runde, wenn alle gespielt');
    }
    rnd = (rnd + 0.37) % 1;
  }
});

test('Statistik: Verteilung und Tages-Serie', () => {
  let s = L.emptyStats();
  s = L.recordResult(s, { won: true, guesses: 3, day: '2026-11-15' });
  s = L.recordResult(s, { won: true, guesses: 4, day: '2026-11-16' });
  assert.equal(s.streak, 2);
  assert.deepEqual(s.dist, [0, 0, 1, 1, 0, 0]);
  assert.equal(L.currentStreak(s, '2026-11-17'), 2);
  assert.equal(L.currentStreak(s, '2026-11-18'), 0, 'Serie verfällt nach einem verpassten Tag');
  s = L.recordResult(s, { won: true, guesses: 2, day: '2026-11-18' });
  assert.equal(s.streak, 1, 'Lücke → Serie beginnt neu');
  assert.equal(s.maxStreak, 2);
  s = L.recordResult(s, { won: false, guesses: 6, day: '2026-11-19' });
  assert.equal(s.streak, 0);
  assert.equal(s.played, 4);
  assert.equal(L.winRate(s), 75);
});

test('shareText: Emoji-Raster', () => {
  let g = L.newGame({ answer: 'BLÜTE', mode: 'daily', day: '2026-11-17', hard: true });
  for (const w of ['BETON', 'BLÜTE']) {
    for (const ch of w) g = L.typeLetter(g, ch);
    g = L.submitGuess(g).game;
  }
  const t = L.shareText(g);
  assert.equal(t, 'Wortrate 17.11.2026 · 2/6*\n\n🟩🟨🟨⬜⬜\n🟩🟩🟩🟩🟩');
  assert.match(L.shareText(g, { contrast: true }), /🟧🟦🟦/);
});
