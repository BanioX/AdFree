// End-to-End-Test Zahlenschlange (iPhone 13, Touch, deviceScaleFactor 1).
// Voraussetzung: python3 -m http.server 8304 --bind 127.0.0.1 (im Repo-Wurzelverzeichnis)
// Ausführen: node hidato/tests/e2e.mjs   (Screenshots → hidato/tests/out/)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const BASE = process.env.BASE || 'http://127.0.0.1:8304/hidato/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const errors = [];
const log = (...a) => console.log('·', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !/\/icons\/games\/(?!hidato)/.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const cdp = await ctx.newCDPSession(page);

const wait = (ms) => page.waitForTimeout(ms);
async function tapBtn(loc) { await wait(340); await loc.tap(); await wait(340); }
const center = (i) => page.evaluate((k) => window.__hd.center(k), i);
async function tapCell(i) { await wait(340); const p = await center(i); await page.touchscreen.tap(p.x, p.y); await wait(120); }
/** Echte Wischgeste über eine Folge von Feldern. */
async function swipe(cells) {
  await wait(350);
  const pts = [];
  for (const c of cells) pts.push(await center(c));
  const tp = (x, y) => [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0].x, pts[0].y) });
  for (let k = 1; k < pts.length; k++) {
    for (let s = 1; s <= 4; s++) {
      const x = pts[k - 1].x + (pts[k].x - pts[k - 1].x) * s / 4, y = pts[k - 1].y + (pts[k].y - pts[k - 1].y) * s / 4;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x, y) });
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(150);
}
const solPos = () => page.evaluate(() => { const p = []; window.__hd.state.puzzle.sol.forEach((v, i) => { if (v > 0) p[v] = i; }); return p; });
/** Fehlender Abschnitt: von der letzten richtigen Zahl bis zur nächsten gegebenen. */
async function nextSegment() {
  return page.evaluate(() => {
    const st = window.__hd.state, { sol, given, N } = st.puzzle;
    const pos = []; sol.forEach((v, i) => { if (v > 0) pos[v] = i; });
    for (let k = 1; k < N; k++) {
      if (st.vals[pos[k]] === k && st.vals[pos[k + 1]] !== k + 1) {
        const cells = [pos[k]];
        let m = k + 1;
        while (m <= N) { cells.push(pos[m]); if (given[pos[m]]) break; m++; }
        return cells;
      }
    }
    return null;
  });
}
async function solveBySwipes() {
  for (let guard = 0; guard < 80; guard++) {
    if (await page.evaluate(() => window.__hd.state.done)) return;
    const seg = await nextSegment();
    if (!seg) return;
    await swipe(seg);
  }
}
async function noPageScroll(label) {
  const m = await page.evaluate(() => {
    const b = document.querySelector('.hd-card');
    const r = b ? b.getBoundingClientRect() : null;
    return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth, bottom: r && r.bottom, right: r && r.right };
  });
  assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${label}: Seite scrollt ${JSON.stringify(m)}`);
  if (m.bottom != null) assert.ok(m.bottom <= m.ih && m.right <= m.iw, `${label}: Brett ragt hinaus`);
}

try {
  // 1) Tutorial beim ersten Start
  await page.goto(BASE);
  await page.waitForSelector('.tut-stage');
  await wait(2000);
  await page.screenshot({ path: OUT + '01-tutorial.png' });
  await tapBtn(page.locator('.tut-next'));
  await wait(1900);
  await page.screenshot({ path: OUT + '02-tutorial-drag.png' });
  await tapBtn(page.locator('.tut-next'));
  await wait(2000);
  await page.screenshot({ path: OUT + '03-tutorial-tap.png' });
  await tapBtn(page.locator('.tut-next'));
  await tapBtn(page.locator('.tut-next'));
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });

  // 2) Menü
  await page.waitForSelector('.gm-primary');
  assert.match(await page.locator('.gm-primary').innerText(), /Spielen[\s\S]*Leicht/);
  await page.screenshot({ path: OUT + '04-menu.png' });
  await noPageScroll('Menü');

  // 3) Erstes Rätsel
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForSelector('.hd-cell');
  assert.equal(await page.locator('.ng-coach').count(), 1, 'Coach-Mark');
  await wait(300);
  await page.screenshot({ path: OUT + '05-play.png' });
  await noPageScroll('Leicht');

  // Ziehen: erster Abschnitt, dann ein Feld zurück
  const seg = await nextSegment();
  await swipe(seg.slice(0, Math.min(seg.length, 3)));
  const placed1 = await page.evaluate(() => window.__hd.state.vals.filter((v, i) => v > 0 && !window.__hd.state.puzzle.given[i]).length);
  assert.ok(placed1 >= 1, 'Ziehen setzt Zahlen');
  assert.equal(await page.locator('.ng-coach').count(), 0, 'Coach weg');
  // Rückgängig – absichtlich schnell nach dem Ziehen
  await page.locator('.nx-tool', { hasText: 'Zurück' }).tap();
  await wait(200);
  assert.equal(await page.evaluate(() => window.__hd.state.vals.filter((v, i) => v > 0 && !window.__hd.state.puzzle.given[i]).length), 0, 'Rückgängig');
  // Antippen: aktive Zahl, dann Nachbarfeld
  const sp = await solPos();
  const s2 = await nextSegment();
  await tapCell(s2[0]);
  assert.equal(await page.evaluate(() => window.__hd.active), s2[0]);
  if (!(await page.evaluate((c) => window.__hd.state.puzzle.given[c], s2[1]))) {
    await tapCell(s2[1]);
    assert.ok(await page.evaluate((c) => window.__hd.state.vals[c] > 0, s2[1]), 'Antippen setzt die nächste Zahl');
  }
  // Antippen eines freien Feldes ohne aktive Nachbarschaft → Zahlenfeld
  const padCell = await page.evaluate(() => {
    const st = window.__hd.state, { w } = st.puzzle;
    const pos = []; st.vals.forEach((v, i) => { if (v > 0) pos[v] = i; });
    const t = (a, b) => Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= 1 && Math.abs(a % w - b % w) <= 1;
    return st.vals.findIndex((v, i) => v === 0 && st.puzzle.sol[i] > 1 && pos[st.puzzle.sol[i] - 1] >= 0 && !t(i, window.__hd.active));
  });
  if (padCell >= 0) {
    await tapCell(padCell);
    await page.waitForSelector('.np-pop.show');
    await page.screenshot({ path: OUT + '06-pad.png' });
    const want = await page.evaluate((c) => window.__hd.state.puzzle.sol[c], padCell);
    await tapBtn(page.locator(`.np-key[data-v="${want}"]`));
    assert.equal(await page.evaluate((c) => window.__hd.state.vals[c], padCell), want, 'Zahl aus dem Feld gesetzt');
    log('Zahlenfeld ok');
  }
  void sp;

  // Neuladen → Fortsetzen
  const vals = await page.evaluate(() => window.__hd.state.vals.join(','));
  await page.reload();
  await page.waitForSelector('.hd-cell');
  assert.equal(await page.evaluate(() => window.__hd.state.vals.join(',')), vals, 'Stand nach Neuladen');
  log('Fortsetzen ok');

  // Eine Lücke bis zur nächsten gegebenen Zahl schliessen → Lob «Verbunden!»
  const seg2 = await nextSegment();
  if (seg2 && seg2.length > 2) {
    await swipe(seg2);
    await page.waitForSelector('.nx-praise', { timeout: 1500 });
    await wait(200);
    await page.screenshot({ path: OUT + '06b-praise.png' });
    log('Lob beim Schliessen einer Lücke ok:', await page.locator('.nx-praise').innerText());
  }

  await solveBySwipes();
  await page.waitForSelector('.nx-win .nx-stars', { timeout: 8000 });
  await wait(1000);
  await page.screenshot({ path: OUT + '07-win.png' });
  log('Leicht Nr. 1 gelöst');
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForFunction(() => window.__hd && window.__hd.state.number === 2);

  // 4) Tipp und Löschen
  await tapBtn(page.locator('.nx-tool', { hasText: 'Tipp' }));
  const act = await page.evaluate(() => window.__hd.active);
  assert.ok(act >= 0 && await page.evaluate((c) => window.__hd.state.vals[c] > 0, act), 'Tipp setzt eine Zahl');
  await tapBtn(page.locator('.nx-tool', { hasText: 'Löschen' }));
  assert.equal(await page.evaluate((c) => window.__hd.state.vals[c], act), 0, 'Löschen');

  // 5) Tagesrätsel
  await tapBtn(page.locator('.nx-top a.icon-btn'));
  await page.waitForSelector('.gm-daily');
  await tapBtn(page.locator('.gm-daily'));
  await page.waitForFunction(() => window.__hd && window.__hd.slot === 'daily');
  await wait(300);
  await page.screenshot({ path: OUT + '08-daily.png' });
  await noPageScroll('Tagesrätsel');
  await solveBySwipes();
  await page.waitForSelector('.nx-win', { timeout: 8000 });
  await wait(900);
  await page.screenshot({ path: OUT + '09-daily-win.png' });
  await tapBtn(page.locator('.sp-modal .btn.primary'));
  await page.waitForSelector('.gm-daily.done');
  log('Tagesrätsel gelöst');

  // 6) Meister auf kleinem Bildschirm
  await page.setViewportSize({ width: 375, height: 667 });
  await tapBtn(page.locator('.gm-seg button[data-id="meister"]'));
  await tapBtn(page.locator('.gm-primary'));
  await page.waitForSelector('.hd-cell');
  const seg3 = await nextSegment();
  await swipe(seg3);
  await wait(300);
  await page.screenshot({ path: OUT + '10-meister-small.png' });
  await noPageScroll('Meister 375×667');

  assert.deepEqual(errors, [], 'Keine Konsolenfehler');
  console.log('OK – Zahlenschlange e2e bestanden');
} catch (e) {
  await page.screenshot({ path: OUT + 'fail.png' }).catch(() => {});
  console.error('FEHLER:', e.message, '\n', errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
