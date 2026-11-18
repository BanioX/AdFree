// Prüft die Zweisprachigkeit des Pfeilwürfels: Englisch hat jeden deutschen Schlüssel,
// Platzhalter stimmen überein, Deutsch in Schweizer Rechtschreibung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXTS, t, starWord, spTitle, spText, themeName, praisePool } from '../i18n.js';
import { SPECIALS, THEMES } from '../data/levels.js';

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('Englisches Wörterbuch hat jeden deutschen Schlüssel (und keine zusätzlichen)', () => {
  const de = Object.keys(TEXTS.de);
  const en = Object.keys(TEXTS.en);
  for (const k of de) assert.ok(k in TEXTS.en, `Englisch fehlt: ${k}`);
  for (const k of en) assert.ok(k in TEXTS.de, `nur Englisch: ${k}`);
  assert.ok(de.length > 50);
});

test('Texte nicht leer, Platzhalter in beiden Sprachen gleich', () => {
  for (const k of Object.keys(TEXTS.de)) {
    assert.ok(String(TEXTS.de[k]).trim().length > 0, `leer (de): ${k}`);
    assert.ok(String(TEXTS.en[k]).trim().length > 0, `leer (en): ${k}`);
    assert.equal(vars(TEXTS.en[k]), vars(TEXTS.de[k]), `Platzhalter ${k}`);
  }
});

test('Deutsch: Schweizer Rechtschreibung; Englisch: keine Umlaute', () => {
  for (const [k, s] of Object.entries(TEXTS.de)) {
    assert.ok(!s.includes('ß'), `ß in ${k}`);
    assert.ok(!/["„“”]/.test(s), `Anführungszeichen in ${k}`);
  }
  for (const [k, s] of Object.entries(TEXTS.en)) assert.ok(!/[äöüÄÖÜß]/.test(s), `deutscher Rest in ${k}: ${s}`);
});

test('Anleitung: kurze Titel (2–4 Wörter) und ein Satz pro Schritt', () => {
  for (const l of ['de', 'en']) {
    for (let i = 1; i <= 4; i++) {
      const title = TEXTS[l][`tut${i}Title`];
      const text = TEXTS[l][`tut${i}Text`];
      const words = title.split(/\s+/).length;
      assert.ok(words >= 2 && words <= 4, `${l} tut${i}Title: ${title}`);
      assert.ok((text.match(/[.!?](\s|$)/g) || []).length === 1, `${l} tut${i}Text: genau ein Satz`);
      assert.ok(text.length <= 90, `${l} tut${i}Text: kurz`);
    }
  }
});

test('Helfer liefern in Node (Deutsch) die deutschen Inhalte', () => {
  assert.equal(t('level', { n: 4 }), 'Level 4');
  assert.equal(starWord(1), 'Stern');
  assert.equal(starWord(2), 'Sterne');
  assert.equal(spTitle(SPECIALS[0]), SPECIALS[0].title);
  assert.equal(spText(SPECIALS[1], true), SPECIALS[1].textMax);
  assert.equal(themeName(THEMES[0]), THEMES[0].name);
  assert.ok(praisePool(3).length > 0 && praisePool(9).length > 0);
});
