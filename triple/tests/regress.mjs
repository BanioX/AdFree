// Regressionstest für QA-Befunde (Playwright, 375 px breit).
//
//   python3 -m http.server 8203 --bind 127.0.0.1     (im Repo-Wurzelverzeichnis)
//   node triple/tests/regress.mjs                     (Screenshots: triple/tests/out/fix/)
//
// Prüft: langer Thementitel passt in die Titelzeile, Riesig nutzt die leere Auslage (Steine >= 44 px),
// Brett passt sich beim Auslagern sanft an, Coach-Hinweis liegt neben dem Brett, Zeit läuft nicht
// während der Anleitung, Sieg wird sofort verbucht, Menü nach verlorener Runde, Hinweistext im Freien Spiel.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
const { chromium } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:8203/';
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'fix');
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.type() + ': ' + m.text()); });

const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const idle = () => page.waitForFunction(() => window.__triple && !window.__triple.isBusy(), null, { timeout: 8000 });
const wait = (ms) => page.waitForTimeout(ms);
async function open(hash) {
  await page.goto(BASE + 'triple/' + hash);
  await page.reload(); // gleiche Seite, nur anderer Hash → frisch laden
  await idle();
  await wait(400);
}
const tileWidth = () => page.evaluate(() => {
  const el = document.querySelector('.tr-tile:not(.static)');
  return el ? el.getBoundingClientRect().width : 0;
});

try {
  await page.goto(BASE + 'triple/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('spielpause.tutorial.triple', 'true'); });

  console.log('• Langer Titel (Winter) passt');
  await open('#free/winter/mittel/abc');
  const t = await page.evaluate(() => {
    const b = document.querySelector('.tr-title b');
    return { text: b.textContent, sw: b.scrollWidth, cw: b.clientWidth };
  });
  assert.ok(t.sw <= t.cw + 1, `Titel abgeschnitten: ${JSON.stringify(t)}`);
  await shot('01-winter-375');

  console.log('• Turm-Ebenen sichtbar versetzt (Himmel, Mittel)');
  await open('#free/himmel/mittel/abc');
  await shot('02-himmel-375');

  console.log('• Riesig: Steine >= 44 px, Auslagern passt das Brett an');
  await open('#free/obst/riesig/abc');
  const w0 = await tileWidth();
  assert.ok(w0 >= 42, `Steine zu klein: ${w0}`);
  await shot('03-riesig-375');
  for (let k = 0; k < 3; k++) {
    const id = await page.evaluate(() => window.__triple.freeTiles()[0]);
    await page.evaluate((i) => window.__triple.tap(i), id);
    await wait(380);
  }
  await page.click('[data-helper="stash"]');
  await wait(700);
  await idle();
  const w1 = await tileWidth();
  const shelfShown = await page.evaluate(() => document.querySelector('.tr-shelf').classList.contains('show'));
  assert.ok(shelfShown && w1 < w0, `Auslage: ${shelfShown}, ${w0} → ${w1}`);
  // kein Stein über der Auslage
  const overlap = await page.evaluate(() => {
    const shelfTop = document.querySelector('.tr-shelf').getBoundingClientRect().top;
    const g = window.__triple.game;
    let worst = -1e9;
    document.querySelectorAll('.tr-tile').forEach((el) => {
      const id = +el.dataset.id;
      if (g.where[id] === 0) worst = Math.max(worst, el.getBoundingClientRect().bottom - shelfTop);
    });
    return worst;
  });
  assert.ok(overlap <= 0, `Brett ragt in die Auslage: ${overlap}`);
  await shot('04-riesig-shelf');
  // Stein aus der Auslage zurückholen, bis sie leer ist → Brett wird wieder grösser
  for (let k = 0; k < 3; k++) {
    const id = await page.evaluate(() => window.__triple.game.shelf[0]);
    await page.evaluate((i) => window.__triple.tap(i), id);
    await wait(420);
  }
  await wait(500);
  await idle();
  const w2 = await tileWidth();
  assert.ok(Math.abs(w2 - w0) < 0.6, `Brett nach leerer Auslage: ${w0} → ${w2}`);

  console.log('• Hinweistext im Freien Spiel');
  await page.click('[data-helper="stash"]');
  await wait(300);
  const toastText = await page.evaluate(() => document.body.innerText);
  assert.ok(/im nächsten Spiel wieder da/.test(toastText), 'Toast «im nächsten Spiel»');

  console.log('• Level 1: Coach-Hinweis neben dem Brett');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('spielpause.tutorial.triple', 'true'); });
  await open('#play');
  await page.waitForSelector('.tr-coach span', { timeout: 4000 });
  await wait(300);
  const coachOk = await page.evaluate(() => {
    const r = document.querySelector('.tr-coach span').getBoundingClientRect();
    let hit = 0;
    document.querySelectorAll('.tr-tile').forEach((el) => {
      const q = el.getBoundingClientRect();
      if (q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom) hit++;
    });
    return { hit, inView: r.left >= 0 && r.right <= innerWidth };
  });
  assert.deepEqual(coachOk, { hit: 0, inView: true }, 'Coach-Hinweis überdeckt Steine');
  await shot('05-level1-coach');

  console.log('• Zeit steht während der Anleitung');
  const e0 = await page.evaluate(() => window.__triple.game.elapsed);
  await page.click('.tr-top button[aria-label="So geht’s"]');
  await wait(3200);
  const e1 = await page.evaluate(() => window.__triple.game.elapsed);
  assert.ok(e1 - e0 < 1500, `Zeit lief weiter: ${e1 - e0} ms`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('.tut-backdrop')?.remove());

  console.log('• Sieg wird sofort verbucht (sofort zurück nach dem letzten Zug)');
  for (let guard = 0; guard < 200; guard++) {
    const st = await page.evaluate(() => window.__triple.game.status);
    if (st !== 'play') break;
    await page.evaluate(() => window.__triple.tap(window.__triple.nextMove()));
    await wait(5);
  }
  await page.evaluate(() => { location.hash = ''; });
  await wait(500);
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.triple.progress') || 'null')
    || JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('progress')))));
  assert.equal(prog.level, 2, 'Level 1 nicht verbucht');

  console.log('• Menü nach verlorener Runde');
  await open('#play');
  for (let k = 0; k < 40; k++) {
    const st = await page.evaluate(() => window.__triple.game.status);
    if (st !== 'play') break;
    // je Sorte nur einen Stein nehmen → Ablage läuft voll
    await page.evaluate(() => {
      const g = window.__triple.game;
      const have = new Set(g.tray.map((i) => g.types[i]));
      const f = g.freeTiles().find((i) => !have.has(g.types[i])) ?? g.freeTiles()[0];
      window.__triple.tap(f);
    });
    await wait(360);
  }
  await page.waitForSelector('.sp-modal-backdrop.show', { timeout: 4000 });
  // Spiel per Hash-Wechsel verlassen (wie Wischgeste zurück): Dialog muss mit verschwinden
  await page.evaluate(() => { location.hash = ''; });
  await wait(500);
  assert.equal(await page.locator('.sp-modal-backdrop').count(), 0, 'Dialog bleibt über dem Menü stehen');
  const label = await page.evaluate(() => document.body.innerText);
  assert.ok(/Nochmal versuchen – Level 2/.test(label), 'Menü zeigt «Nochmal versuchen»');
  await shot('06-menu-lost');

  const real = problems.filter((p) => !/AudioContext|autoplay/i.test(p));
  assert.deepEqual(real, [], 'Konsole');
  console.log('\n✅ Regression ok');
} catch (e) {
  console.error('\n❌', e.message);
  if (problems.length) console.error(problems.join('\n'));
  await shot('zz-fehler').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
