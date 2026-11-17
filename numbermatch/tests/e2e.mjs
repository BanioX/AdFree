// End-to-End-Test Zahlenpaare (iPhone 13, Touch, deviceScaleFactor 1).
// Voraussetzung: python3 -m http.server 8304 --bind 127.0.0.1 (im Repo-Wurzelverzeichnis)
// Ausführen: node numbermatch/tests/e2e.mjs   (Screenshots → numbermatch/tests/out/)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const BASE = process.env.BASE || 'http://127.0.0.1:8304/numbermatch/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const errors = [];
const log = (...a) => console.log('·', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/\/icons\/games\/(?!numbermatch)/.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const wait = (ms) => page.waitForTimeout(ms);
async function tapBtn(loc) { await wait(340); await loc.tap(); await wait(340); }
async function tapCell(i) {
  await page.evaluate((k) => document.querySelectorAll('.nm-grid .ng-cell')[k].scrollIntoView({ block: 'nearest' }), i);
  const p = await page.evaluate((k) => window.__nm.center(k), i);
  await page.touchscreen.tap(p.x, p.y);
  await wait(60);
}
async function idle() { await page.waitForFunction(() => window.__nm && !window.__nm.busy); }
async function noPageScroll(label) {
  const m = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth }));
  assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${label}: Seite scrollt ${JSON.stringify(m)}`);
}
/** Spielt mit dem Tipp-Weg per echten Taps, bis gewonnen. */
async function playToWin(maxMoves = 80) {
  for (let k = 0; k < maxMoves; k++) {
    await idle();
    const st = await page.evaluate(() => ({ done: window.__nm.state.done, lost: window.__nm.state.lost }));
    if (st.done || st.lost) break;
    const p = await page.evaluate(() => window.__nm.hint());
    if (!p) break;
    await tapCell(p[0]);
    await tapCell(p[1]);
  }
}

try {
  // 1) Erster Start: Tutorial
  await page.goto(BASE);
  await page.waitForSelector('.tut-stage');
  await wait(2600);
  await page.screenshot({ path: OUT + '01-tutorial.png' });
  for (let k = 0; k < 3; k++) await tapBtn(page.locator('.tut-next'));
  await wait(2200);
  await page.screenshot({ path: OUT + '02-tutorial-4.png' });
  await tapBtn(page.locator('.tut-next'));
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });

  // 2) Menü
  await page.waitForSelector('.gm-primary');
  assert.match(await page.locator('.gm-primary').innerText(), /Spielen[\s\S]*Level 1/);
  await page.screenshot({ path: OUT + '03-menu.png' });
  await noPageScroll('Menü');

  // 3) Level 1 mit Coach-Mark
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForSelector('.nm-grid .ng-cell');
  assert.equal(await page.locator('.ng-coach').count(), 1, 'Coach-Mark sichtbar');
  await wait(400);
  await page.screenshot({ path: OUT + '04-level1.png' });
  await noPageScroll('Level 1');
  // ungültiges Paar: schüttelt, kein Fehler
  const bad = await page.evaluate(() => {
    const c = window.__nm.state.cells;
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
      if (c[i].v + c[j].v !== 10 && c[i].v !== c[j].v) return [i, j];
    }
    return null;
  });
  await tapCell(bad[0]); await tapCell(bad[1]);
  assert.equal(await page.evaluate(() => window.__nm.state.pairs), 0);
  await tapCell(bad[1]); // abwählen
  await playToWin();
  await page.waitForSelector('.nx-win .nx-stars');
  await wait(1200);
  await page.screenshot({ path: OUT + '05-win.png' });
  log('Level 1 gewonnen');

  // 4) Nächstes Level, ein paar Züge, Neuladen → Fortsetzen
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForFunction(() => window.__nm && window.__nm.state.level === 2);
  for (let k = 0; k < 3; k++) {
    await idle();
    const p = await page.evaluate(() => window.__nm.hint());
    await tapCell(p[0]); await tapCell(p[1]);
  }
  await idle();
  const before = await page.evaluate(() => ({ pairs: window.__nm.state.pairs, n: window.__nm.state.cells.length, score: window.__nm.state.score }));
  await page.reload();
  await page.waitForSelector('.nm-grid .ng-cell');
  const after = await page.evaluate(() => ({ pairs: window.__nm.state.pairs, n: window.__nm.state.cells.length, score: window.__nm.state.score }));
  assert.deepEqual(after, before, 'Stand nach Neuladen');
  assert.match(await page.locator('.nx-title b').innerText(), /Level 2/);
  log('Fortsetzen ok', JSON.stringify(after));

  // Tipp-Knopf und Hinzufügen
  await tapBtn(page.locator('.nx-tool', { hasText: 'Tipp' }));
  assert.equal(await page.locator('.nm-cell.hint').count(), 2);
  const n0 = await page.evaluate(() => window.__nm.state.cells.length);
  await tapBtn(page.locator('.nm-add'));
  await wait(900);
  const n1 = await page.evaluate(() => window.__nm.state.cells.length);
  assert.ok(n1 > n0, 'Zahlen hinzugefügt');
  await page.screenshot({ path: OUT + '06-added.png' });
  await noPageScroll('Nach Hinzufügen');

  // 5) Zurück ins Menü: Weiterspielen
  await tapBtn(page.locator('.nx-top a.icon-btn'));
  await page.waitForSelector('.gm-primary');
  assert.match(await page.locator('.gm-primary').innerText(), /Weiterspielen[\s\S]*Level 2/);
  await page.screenshot({ path: OUT + '07-menu-continue.png' });

  // 6) Tagesrätsel bis zum Ende
  await tapBtn(page.locator('.gm-daily'));
  await page.waitForFunction(() => window.__nm && window.__nm.slot === 'daily');
  await wait(300);
  await page.screenshot({ path: OUT + '08-daily.png' });
  await playToWin(120);
  await page.waitForSelector('.nx-win');
  await wait(800);
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForSelector('.gm-daily.done');
  log('Tagesrätsel gelöst');

  // 7) Endlos
  await tapBtn(page.locator('.gm-seg button[data-id="endless"]'));
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForFunction(() => window.__nm && window.__nm.slot === 'endless');
  for (let k = 0; k < 6; k++) {
    await idle();
    const p = await page.evaluate(() => window.__nm.hint());
    if (!p) break;
    await tapCell(p[0]); await tapCell(p[1]);
  }
  await idle();
  assert.ok(await page.evaluate(() => window.__nm.state.score) > 0);
  await page.screenshot({ path: OUT + '09-endless.png' });

  // 8) Steckenbleiben im Level → freundlicher Neustart
  await page.evaluate(() => {
    const k = 'spielpause.numbermatch.game.level';
    const st = JSON.parse(localStorage.getItem(k));
    st.cells = [3, 7, 1, 2].map((v) => ({ v, x: false, s: false }));
    st.addsLeft = 0;
    localStorage.setItem(k, JSON.stringify(st));
  });
  await page.goto(BASE + '#play');
  await page.waitForSelector('.nm-grid .ng-cell');
  await tapCell(0); await tapCell(1);
  await page.waitForSelector('.sp-modal', { timeout: 4000 });
  assert.match(await page.locator('.sp-modal h2').innerText(), /Keine Paare/);
  await page.screenshot({ path: OUT + '11-stuck.png' });
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForFunction(() => window.__nm && window.__nm.state.cells.length === window.__nm.state.start.length && window.__nm.state.addsLeft === window.__nm.state.adds);
  log('Neustart nach Steckenbleiben ok');

  // 9) Kleiner Bildschirm (375×667)
  await page.setViewportSize({ width: 375, height: 667 });
  await wait(300);
  await page.screenshot({ path: OUT + '10-small.png' });
  await noPageScroll('375×667');

  assert.deepEqual(errors, [], 'Keine Konsolenfehler');
  console.log('OK – Zahlenpaare e2e bestanden');
} catch (e) {
  await page.screenshot({ path: OUT + 'fail.png' }).catch(() => {});
  console.error('FEHLER:', e.message, '\n', errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
