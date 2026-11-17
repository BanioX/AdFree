// Prüft die Wortlisten (Format, Länge, Umfang, Lösbarkeit des Tagesworts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, FILES } from '../tools/check-words.mjs';
import { parseWordList, dailyWord, addDays } from '../logic.js';

test('Wortlisten sind gültig', async () => {
  const { errors, warnings } = await checkAll();
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('mindestens 1500 Lösungswörter mit 5 Buchstaben, inkl. Umlaute', async () => {
  const text = (await import('../data/answers.js')).default;
  const answers = parseWordList(text, 5);
  assert.ok(answers.length >= 1500, `nur ${answers.length}`);
  assert.ok(answers.some((w) => /Ä/.test(w)) && answers.some((w) => /Ö/.test(w)) && answers.some((w) => /Ü/.test(w)));
  assert.ok(answers.every((w) => !/ß/.test(w)));
});

test('jedes Tageswort der nächsten zwei Jahre ist erratbar und wiederholt sich nicht', async () => {
  const f = FILES.find((x) => x.len === 5);
  const answers = parseWordList((await import('../data/' + f.answers)).default, 5);
  const allowed = new Set([...parseWordList((await import('../data/' + f.allowed)).default, 5), ...answers]);
  const seen = new Set();
  let day = '2026-11-17';
  for (let i = 0; i < 730; i++) {
    const w = dailyWord(answers, day);
    assert.ok(allowed.has(w), `${day}: ${w}`);
    if (i < answers.length) { assert.ok(!seen.has(w), `${w} doppelt am ${day}`); seen.add(w); }
    day = addDays(day, 1);
  }
});
