// End-to-End-Test Zahlensummen (iPhone 13, Touch, deviceScaleFactor 1).
// Voraussetzung: python3 -m http.server 8304 --bind 127.0.0.1 (im Repo-Wurzelverzeichnis)
// Ausführen: node numbersums/tests/e2e.mjs   (Screenshots → numbersums/tests/out/)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const BASE = process.env.BASE || 'http://127.0.0.1:8304/numbersums/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const errors = [];
const log = (...a) => console.log('·', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/\/icons\/games\/(?!numbersums)/.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const cdp = await ctx.newCDPSession(page);

const wait = (ms) => page.waitForTimeout(ms);
async function tapBtn(loc) { await wait(340); await loc.tap(); await wait(340); }
async function tapCell(i) {
  const p = await page.evaluate((k) => window.__ns.center(k), i);
  await page.touchscreen.tap(p.x, p.y);
  await wait(80);
}
async function setTool(t) {
  if (await page.evaluate(() => window.__ns.tool) !== t) await tapBtn(page.locator(`.ns-tool[data-tool="${t}"]`));
}
async function swipe(a, b) {
  const p0 = await page.evaluate((k) => window.__ns.center(k), a);
  const p1 = await page.evaluate((k) => window.__ns.center(k), b);
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(p0.x, p0.y) });
  for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p0.x + (p1.x - p0.x) * k / 6, p0.y + (p1.y - p0.y) * k / 6) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(120);
}
async function noPageScroll(label) {
  const m = await page.evaluate(() => {
    const b = document.querySelector('.ns-card');
    const r = b ? b.getBoundingClientRect() : null;
    return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth, bottom: r && r.bottom, right: r && r.right };
  });
  assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${label}: Seite scrollt ${JSON.stringify(m)}`);
  if (m.bottom != null) assert.ok(m.bottom <= m.ih && m.right <= m.iw, `${label}: Brett ragt hinaus ${JSON.stringify(m)}`);
}
/** Löst das laufende Rätsel mit echten Taps (erst radieren, dann einkreisen). */
async function solveByTaps() {
  for (const t of ['erase', 'keep']) {
    await setTool(t);
    for (let guard = 0; guard < 100; guard++) {
      const i = await page.evaluate((tool) => {
        const st = window.__ns.state;
        return st.marks.findIndex((m, k) => m === 0 && st.puzzle.keep[k] === (tool === 'keep'));
      }, t);
      if (i < 0 || await page.evaluate(() => window.__ns.state.done)) break;
      await tapCell(i);
    }
  }
}

try {
  // 1) Tutorial beim ersten Start
  await page.goto(BASE);
  await page.waitForSelector('.tut-stage');
  await wait(2200);
  await page.screenshot({ path: OUT + '01-tutorial.png' });
  await tapBtn(page.locator('.tut-next'));
  await tapBtn(page.locator('.tut-next'));
  await wait(2600);
  await page.screenshot({ path: OUT + '02-tutorial-3.png' });
  await tapBtn(page.locator('.tut-next'));
  await wait(1500);
  await page.screenshot({ path: OUT + '02-tutorial-4.png' });
  await tapBtn(page.locator('.tut-next'));
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });

  // 2) Menü
  await page.waitForSelector('.gm-primary');
  assert.match(await page.locator('.gm-primary').innerText(), /Spielen[\s\S]*Leicht/);
  await page.screenshot({ path: OUT + '03-menu.png' });
  await noPageScroll('Menü');

  // 3) Erstes Rätsel mit Coach-Mark
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForSelector('.ns-cell');
  assert.equal(await page.locator('.ng-coach').count(), 1, 'Coach-Mark');
  await wait(300);
  await page.screenshot({ path: OUT + '04-play.png' });
  await noPageScroll('Spiel Leicht');

  // Fehler: eine bleibende Zahl radieren → Herz weg
  const keepI = await page.evaluate(() => window.__ns.state.puzzle.keep.findIndex((k) => k));
  await setTool('erase');
  await tapCell(keepI);
  assert.equal(await page.evaluate(() => window.__ns.state.lives), 2);
  assert.equal(await page.locator('.nx-hearts span.off').count(), 1);

  // Wischen über zwei benachbarte falsche Zahlen
  const pair = await page.evaluate(() => {
    const { puzzle: p } = window.__ns.state;
    for (let i = 0; i < p.n * p.n; i++) if (i % p.n < p.n - 1 && !p.keep[i] && !p.keep[i + 1]) return [i, i + 1];
    return null;
  });
  if (pair) {
    await wait(400);
    await swipe(pair[0], pair[1]);
    assert.deepEqual(await page.evaluate((pr) => pr.map((k) => window.__ns.state.marks[k]), pair), [2, 2], 'Wischen radiert beide');
    log('Wischen ok');
  }
  // Tipp
  const before = await page.evaluate(() => window.__ns.state.marks.filter((m) => m).length);
  await tapBtn(page.locator('.nx-tool', { hasText: 'Tipp' }));
  assert.ok(await page.evaluate(() => window.__ns.state.marks.filter((m) => m).length) > before, 'Tipp löst ein Feld');
  await page.screenshot({ path: OUT + '05-midgame.png' });

  await solveByTaps();
  await page.waitForSelector('.nx-win .nx-stars');
  await wait(1100);
  await page.screenshot({ path: OUT + '06-win.png' });
  log('Leicht Nr. 1 gelöst');

  // 4) Nächstes Rätsel, ein paar Züge, Neuladen → Fortsetzen
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForFunction(() => window.__ns && window.__ns.state.number === 2);
  await setTool('erase');
  for (let k = 0; k < 3; k++) {
    const i = await page.evaluate(() => { const st = window.__ns.state; return st.marks.findIndex((m, j) => m === 0 && !st.puzzle.keep[j]); });
    await tapCell(i);
  }
  const marks = await page.evaluate(() => window.__ns.state.marks.join(''));
  await page.reload();
  await page.waitForSelector('.ns-cell');
  assert.equal(await page.evaluate(() => window.__ns.state.marks.join('')), marks, 'Stand nach Neuladen');
  assert.equal(await page.locator('.ns-cell.gone').count(), (marks.match(/2/g) || []).length);
  log('Fortsetzen ok');

  // 5) Drei Fehler → freundlich weiterspielen
  const k2 = await page.evaluate(() => { const st = window.__ns.state; return st.marks.findIndex((m, j) => m === 0 && st.puzzle.keep[j]); });
  await setTool('erase');
  for (let k = 0; k < 3; k++) { await tapCell(k2); await wait(150); }
  await page.waitForSelector('.sp-modal');
  assert.match(await page.locator('.sp-modal h2').innerText(), /Keine Herzen/);
  await page.screenshot({ path: OUT + '07-no-lives.png' });
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  assert.equal(await page.evaluate(() => window.__ns.state.lives), 3);
  log('Herzen aufgefüllt');

  // 6) Tagesrätsel
  await tapBtn(page.locator('.nx-top a.icon-btn'));
  await page.waitForSelector('.gm-daily');
  await tapBtn(page.locator('.gm-daily'));
  await page.waitForFunction(() => window.__ns && window.__ns.slot === 'daily');
  await wait(300);
  await page.screenshot({ path: OUT + '08-daily.png' });
  await noPageScroll('Tagesrätsel');
  await solveByTaps();
  await page.waitForSelector('.nx-win');
  await wait(600);
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForSelector('.gm-daily.done');
  log('Tagesrätsel gelöst');

  // 7) Meister auf kleinem Bildschirm
  await page.setViewportSize({ width: 375, height: 667 });
  await tapBtn(page.locator('.gm-seg button[data-id="meister"]'));
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForSelector('.ns-cell');
  await wait(300);
  await page.screenshot({ path: OUT + '09-meister-small.png' });
  await noPageScroll('Meister 375×667');

  assert.deepEqual(errors, [], 'Keine Konsolenfehler');
  console.log('OK – Zahlensummen e2e bestanden');
} catch (e) {
  await page.screenshot({ path: OUT + 'fail.png' }).catch(() => {});
  console.error('FEHLER:', e.message, '\n', errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
