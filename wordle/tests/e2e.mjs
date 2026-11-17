// Wortrate – End-to-End-Test (iPhone 13).
//   python3 -m http.server 8210 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node wordle/tests/e2e.mjs
// Screenshots landen in wordle/tests/out/.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8210/wordle/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const wait = (ms) => page.waitForTimeout(ms);
const step = (t) => console.log('• ' + t);

async function noPageScroll() {
  const m = await page.evaluate(() => ({
    sw: document.scrollingElement.scrollWidth, sh: document.scrollingElement.scrollHeight, w: innerWidth, hh: innerHeight,
  }));
  assert.ok(m.sw <= m.w, `horizontal overflow ${m.sw} > ${m.w}`);
  assert.ok(m.sh <= m.hh, `page scrolls vertically ${m.sh} > ${m.hh}`);
}

// Hinweis: setupPage() verhindert Doppeltipp-Zoom – zwei Tipps innerhalb 320 ms erzeugen keinen Klick.
async function tap(locator) {
  await locator.tap();
  await wait(360);
}

async function typeOnScreen(word) {
  for (const ch of word) await page.locator(`.kbd .key[data-k="${ch}"]`).tap();
}
async function enter() {
  await page.locator('.kbd .key[data-k="ENTER"]').tap();
}
async function waitIdle() {
  await page.waitForFunction(() => window.__wordle && !window.__wordle.busy, null, { timeout: 8000 });
}

try {
  // 1) Erster Start: Tutorial erscheint automatisch
  step('Erster Start mit Tutorial');
  await page.goto(BASE);
  await page.waitForSelector('.tut-backdrop', { timeout: 5000 });
  await wait(1500);
  await shot('e2e-01-tutorial');
  for (let i = 0; i < 3; i++) { await tap(page.locator('.tut-backdrop button', { hasText: 'Weiter' }).last()); }
  await tap(page.locator('.tut-backdrop button', { hasText: 'Los geht' }));
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });

  // 2) Menü
  step('Menü');
  await page.waitForSelector('.gm-primary');
  assert.match(await page.locator('.gm-primary').innerText(), /Spielen/);
  assert.equal(await page.locator('.gm-daily.done').count(), 0);
  await noPageScroll();
  await wait(700);
  await shot('e2e-02-menu');

  // 3) Tageswort: falsches Wort, unbekanntes Wort, Neuladen, lösen
  step('Tageswort');
  await tap(page.locator('.gm-daily'));
  await page.waitForSelector('.kbd');
  assert.equal(new URL(page.url()).hash, '#daily');
  await noPageScroll();
  const answer = await page.evaluate(() => window.__wordle.answer);
  assert.equal([...answer].length, 5);
  assert.equal(await page.locator('.coach').count(), 1, 'Coach-Mark beim ersten Spiel');

  // Unbekanntes Wort → Schütteln + Meldung
  await typeOnScreen('QXQXQ');
  await enter();
  await page.waitForSelector('.sp-toast, .toast', { timeout: 3000 }).catch(() => {});
  const toastText = await page.evaluate(() => document.body.innerText);
  assert.match(toastText, /Nicht in der Wortliste/);
  assert.equal(await page.locator('.coach').count(), 0, 'Coach-Mark verschwindet nach dem ersten Tippen');
  for (let i = 0; i < 5; i++) await page.locator('.kbd .key[data-k="DEL"]').tap();

  // Ein erlaubtes, falsches Wort (aus der Liste)
  const wrong = await page.evaluate(async (ans) => {
    const cands = ['TISCH', 'BLUME', 'NEBEL', 'STERN', 'WOLKE'];
    for (const c of cands) if (c !== ans && await window.__wordle.isAllowed(c)) return c;
    return null;
  }, answer);
  assert.ok(wrong);
  await typeOnScreen(wrong);
  await enter();
  await waitIdle();
  let g = await page.evaluate(() => window.__wordle.game);
  assert.deepEqual(g.guesses, [wrong]);
  // Tastatur eingefärbt
  assert.ok(await page.locator('.kbd .key[data-state]').count() > 0);
  await typeOnScreen([...answer].slice(0, 2).join(''));
  await shot('e2e-03-daily-mid');

  // Neuladen → Stand bleibt (inkl. angefangener Eingabe)
  step('Neuladen setzt fort');
  await page.reload();
  await page.waitForSelector('.kbd');
  g = await page.evaluate(() => window.__wordle.game);
  assert.equal(g.mode, 'daily');
  assert.deepEqual(g.guesses, [wrong]);
  assert.equal(g.input, [...answer].slice(0, 2).join(''));
  const tile0 = await page.locator('.row').first().locator('.tile').first().getAttribute('data-state');
  assert.ok(['correct', 'present', 'absent'].includes(tile0));

  // Physische Tastatur: löschen und Lösung eintippen
  step('Lösen mit physischer Tastatur');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(answer.toLowerCase());
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sp-modal-backdrop', { timeout: 10000 });
  await wait(900);
  const sheet = await page.locator('.sp-modal-backdrop').innerText();
  assert.match(sheet, /Erraten in 2 Versuchen/);
  assert.match(sheet, /Teilen/);
  assert.match(sheet, /Verteilung/i);
  await shot('e2e-04-win-sheet');
  g = await page.evaluate(() => window.__wordle.game);
  assert.equal(g.status, 'won');
  assert.equal(g.counted, true);
  const dailyDone = await page.evaluate(() => Object.keys(localStorage).filter((k) => /daily/i.test(k)).map((k) => k + '=' + localStorage.getItem(k)).join('\n'));
  assert.match(dailyDone, /wordle/);

  // Teilen kopiert das Emoji-Raster
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
  await tap(page.locator('#share'));
  await wait(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (clip) assert.match(clip, /Wortrate .* 2\/6\n\n.+\n🟩🟩🟩🟩🟩/u);

  // Zurück ins Menü → Tageswort abgehakt
  step('Menü zeigt gelöstes Tageswort');
  await tap(page.locator('.sp-modal-backdrop button', { hasText: 'Zum Menü' }));
  await page.waitForSelector('.gm-primary');
  await wait(400);
  assert.equal(await page.locator('.gm-daily.done').count(), 1);
  const summary = await page.evaluate(() => Object.entries(localStorage).find(([k]) => /summary/i.test(k) && /wordle/.test(k)));
  assert.ok(summary, 'reportSummary geschrieben');

  // 4) Endlos: Wortlänge wählen, verlieren durch Aufgeben, nächstes Wort neu
  step('Endlos-Modus');
  await tap(page.locator('.gm-seg button[data-id="5"]'));
  await tap(page.locator('.gm-primary'));
  await wait(500);
  await page.waitForSelector('.kbd');
  assert.equal(new URL(page.url()).hash, '#endlos/5');
  const e1 = await page.evaluate(() => window.__wordle.answer);
  assert.notEqual(e1, answer, 'Endlos-Wort ist nicht das Tageswort');
  // «Alle Wörter erlauben» einschalten → unbekanntes Wort wird angenommen
  await tap(page.locator('.topbar [aria-label="Einstellungen"]'));
  await tap(page.locator('.sp-modal-backdrop [data-setting="lenient"]'));
  await tap(page.locator('.sp-modal-backdrop button', { hasText: 'Fertig' }));
  await page.waitForSelector('.sp-modal-backdrop', { state: 'detached' });
  await typeOnScreen('QXQXQ');
  await enter();
  await waitIdle();
  g = await page.evaluate(() => window.__wordle.game);
  assert.deepEqual(g.guesses, ['QXQXQ']);
  await shot('e2e-05-endless');
  // Aufgeben über «Neues Wort»
  await tap(page.locator('#newword'));
  await tap(page.locator('.sp-modal-backdrop button', { hasText: 'Aufgeben' }));
  await page.waitForSelector('.reveal-banner.show');
  await page.waitForSelector('.sp-modal-backdrop', { timeout: 8000 });
  await wait(500);
  assert.ok((await page.locator('.sp-modal-backdrop').innerText()).replace(/\s+/g, '').includes(e1), 'Lösung wird gezeigt');
  await tap(page.locator('.sp-modal-backdrop button', { hasText: 'Nächstes Wort' }));
  await page.waitForSelector('.kbd');
  await wait(400);
  const e2 = await page.evaluate(() => window.__wordle.answer);
  assert.notEqual(e2, e1, 'kein Wort doppelt');
  const used = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.wordle.used.5')));
  assert.ok(used.includes(e1) && used.includes(e2));

  // 5) Zurück: Spiel → Menü → Startseite-Link
  step('Navigation');
  await tap(page.locator('.topbar a[aria-label="Zurück"]'));
  await page.waitForSelector('.gm-primary');
  assert.equal(await page.locator('.gm-topbar a[aria-label="Zurück"]').getAttribute('href'), '../');
  const stats = await page.locator('.gm-stats').innerText();
  assert.match(stats, /1\s*Gespielt/);

  // 6) Andere Wortlänge lädt
  await tap(page.locator('.gm-seg button[data-id="6"]'));
  await tap(page.locator('.gm-primary'));
  await page.waitForSelector('.kbd');
  assert.equal(await page.locator('.row').first().locator('.tile').count(), 6);
  await noPageScroll();

  // 7) Kleiner Bildschirm (375 × 667, iPhone SE)
  step('Kleiner Bildschirm');
  await page.setViewportSize({ width: 375, height: 600 });
  await wait(400);
  await noPageScroll();
  const kb = await page.locator('.kbd').boundingBox();
  assert.ok(kb.y + kb.height <= 600 + 1, 'Tastatur sichtbar');
  const keyBox = await page.locator('.kbd .key[data-k="A"]').boundingBox();
  assert.ok(keyBox.height >= 44, 'Tasten mindestens 44 px hoch');
  await shot('e2e-06-small');

  assert.deepEqual(errors, [], 'keine Konsolenfehler');
  console.log('✓ Alle E2E-Prüfungen bestanden');
} catch (e) {
  await shot('e2e-fail').catch(() => {});
  console.error('✗', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
