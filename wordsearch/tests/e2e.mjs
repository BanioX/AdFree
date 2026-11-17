// End-to-End-Test der Wortsuche (iPhone 13, Touch).
// Voraussetzung: statischer Server im Repo-Wurzelverzeichnis:
//   python3 -m http.server 8209 --bind 127.0.0.1
// Ausführen: node wordsearch/tests/e2e.mjs   (Screenshots → wordsearch/tests/out/)

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8209/wordsearch/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const errors = [];
const log = (...a) => console.log('·', ...a);

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, ...(viewport ? { viewport } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // 404-Meldungen werden separat mit URL erfasst (unten), damit klar ist, woher sie kommen.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const u = r.url();
      // Die Startseite (Hub) zeigt auch Spiele anderer Teams, deren Icons evtl. noch fehlen – nicht unser Bereich.
      if (u.includes('/wordsearch/') || u.includes('/shared/') || u.endsWith('/wordsearch.svg') || !u.includes('/icons/games/')) errors.push(`HTTP ${r.status()}: ${u}`);
      else console.log('  (Hinweis, fremd) HTTP', r.status(), u);
    }
  });
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

/** Echte Wischgeste per Touch-Events von Zelle a nach Zelle b. */
async function swipe(page, cdp, a, b, steps = 8) {
  const p0 = await page.evaluate(([r, c]) => window.__wordsearch.cellCenter(r, c), [a.r, a.c]);
  const p1 = await page.evaluate(([r, c]) => window.__wordsearch.cellCenter(r, c), [b.r, b.c]);
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(p0.x, p0.y) });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // leicht wackelige Bahn: Einrasten muss das ausgleichen
    const wob = Math.sin(t * Math.PI) * 4;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p0.x + (p1.x - p0.x) * t + wob, p0.y + (p1.y - p0.y) * t - wob) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// Pause nach jedem Tipp: setupPage() unterdrückt Doppeltipps (<320 ms) wie iOS.
async function tap(loc) { await loc.page().waitForTimeout(340); await loc.tap(); await loc.page().waitForTimeout(340); }

const wordEnd = (p) => {
  const d = { E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1], N: [-1, 0], NE: [-1, 1] }[p.d];
  return { r: p.r + d[0] * (p.w.length - 1), c: p.c + d[1] * (p.w.length - 1) };
};

async function noPageScroll(page, label) {
  const m = await page.evaluate(() => {
    const se = document.scrollingElement;
    const board = document.querySelector('.board');
    const r = board ? board.getBoundingClientRect() : null;
    return { sh: se.scrollHeight, ih: innerHeight, sw: se.scrollWidth, iw: innerWidth, bottom: r && r.bottom, right: r && r.right };
  });
  assert.ok(m.sh <= m.ih + 1 && m.sw <= m.iw + 1, `${label}: Seite scrollt (${JSON.stringify(m)})`);
  if (m.bottom != null) assert.ok(m.bottom <= m.ih && m.right <= m.iw, `${label}: Brett ragt hinaus`);
}

const browser = await chromium.launch();
try {
  const { page, cdp } = await newPage(browser);

  // 1) Erster Start: Tutorial erscheint automatisch
  await page.goto(BASE);
  await page.waitForSelector('.tut-stage', { timeout: 5000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: OUT + '01-tutorial.png' });
  await tap(page.locator('.tut-skip'));
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.tut-stage').count(), 0, 'Tutorial schliesst');
  log('Tutorial ok');

  // 2) Menü: Stufe Leicht wählen, Spielen
  await page.waitForSelector('.gm-primary');
  await tap(page.locator('.gm-seg button[data-id="leicht"]'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '02-menu.png' });
  assert.match(await page.locator('.gm-primary').innerText(), /Spielen/);
  await tap(page.locator('.gm-primary'));
  await page.waitForFunction(() => location.hash === '#play/leicht' && window.__wordsearch);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.g-coach').count(), 1, 'Coach-Mark beim ersten Rätsel');
  await noPageScroll(page, 'Leicht');
  await page.screenshot({ path: OUT + '03-play-leicht.png' });

  const pz = await page.evaluate(() => window.__wordsearch.puzzle);
  assert.equal(pz.size, 8);
  assert.equal(pz.words.length, 8);

  // 3) Zwei Wörter echt wischen (eines rückwärts)
  await swipe(page, cdp, pz.words[0], wordEnd(pz.words[0]));
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.g-coach').count(), 0, 'Coach-Mark verschwindet');
  await swipe(page, cdp, wordEnd(pz.words[1]), pz.words[1]);
  await page.waitForTimeout(400);
  let found = await page.evaluate(() => window.__wordsearch.state.found.length);
  assert.equal(found, 2, 'zwei Wörter gefunden');
  // Fehlwisch zählt nicht
  await swipe(page, cdp, { r: 0, c: 0 }, { r: 0, c: 1 }, 3);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__wordsearch.state.found.length), 2);
  log('Wischen ok');

  // 4) Tipp
  await tap(page.locator('.hint-btn'));
  await page.waitForTimeout(250);
  assert.ok(await page.locator('.hint-ring').count() >= 1, 'Tipp-Ring sichtbar');
  assert.equal(await page.evaluate(() => window.__wordsearch.state.hints), 1);

  // 5) Wortliste einklappen / ausklappen
  await tap(page.locator('.wh-toggle'));
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.words.collapsed').count() === 1, 'Liste eingeklappt');
  await page.screenshot({ path: OUT + '04-collapsed.png' });
  await tap(page.locator('.wh-toggle'));
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.words.collapsed').count(), 0);

  // 6) Neu laden → Stand bleibt
  await page.waitForTimeout(1200);
  const elapsedBefore = await page.evaluate(() => window.__wordsearch.state.elapsed);
  await page.reload();
  await page.waitForFunction(() => window.__wordsearch && location.hash === '#play/leicht');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ f: window.__wordsearch.state.found.length, g: window.__wordsearch.puzzle.grid.join(''), e: window.__wordsearch.state.elapsed }));
  assert.equal(after.f, 2, 'gefundene Wörter nach Reload');
  assert.equal(after.g, pz.grid.join(''), 'gleiches Raster nach Reload');
  assert.ok(after.e >= elapsedBefore - 600, 'Zeit läuft weiter');
  assert.equal(await page.locator('.wchip.found').count(), 2);
  assert.equal(await page.locator('.g-found line.cap').count(), 2, 'Kapseln nach Reload');
  log('Reload-Resume ok');

  // 7) Rest wischen bis zum Sieg
  for (let i = 2; i < pz.words.length; i++) {
    const p = pz.words[i];
    if (i % 2) await swipe(page, cdp, wordEnd(p), p);
    else await swipe(page, cdp, p, wordEnd(p));
    await page.waitForTimeout(140);
  }
  await page.waitForSelector('.sp-modal .win', { timeout: 5000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '05-win.png' });
  const st = await page.evaluate(() => window.__wordsearch.state);
  assert.equal(st.done, true);
  assert.ok(st.stars >= 1 && st.stars <= 2, 'mit Tipp höchstens 2 Sterne');
  const summary = await page.evaluate(() => localStorage.getItem('spielpause.summary.wordsearch') || Object.keys(localStorage).filter((k) => k.includes('summary')).map((k) => localStorage.getItem(k)).join('|'));
  assert.ok(summary && summary.length > 2, 'reportSummary gesetzt');
  log('Sieg ok', st.stars, 'Sterne');

  // 8) Nächstes Rätsel
  await tap(page.locator('.sp-modal .btn', { hasText: 'Nächstes Rätsel' }));
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__wordsearch && window.__wordsearch.state.found.length === 0 && !window.__wordsearch.state.done, null, { timeout: 4000 }).catch(() => {});
  const pz2 = await page.evaluate(() => window.__wordsearch.puzzle);
  assert.notEqual(pz2.grid.join(''), pz.grid.join(''), 'neues Rätsel');
  assert.equal(await page.evaluate(() => window.__wordsearch.state.found.length), 0);

  // 9) Zurück ins Menü, Tagesrätsel
  await tap(page.locator('.topbar .icon-btn').first());
  await page.waitForSelector('.gm-daily');
  assert.equal(await page.locator('.gm-daily.done').count(), 0);
  await tap(page.locator('.gm-daily'));
  await page.waitForFunction(() => location.hash === '#daily' && window.__wordsearch);
  await page.waitForTimeout(400);
  await noPageScroll(page, 'Tagesrätsel');
  await page.screenshot({ path: OUT + '06-daily.png' });
  const dz = await page.evaluate(() => window.__wordsearch.puzzle);
  assert.equal(dz.size, 10);
  await page.evaluate(() => window.__wordsearch.solveAll());
  await page.waitForSelector('.sp-modal .win', { timeout: 5000 });
  assert.match(await page.locator('.sp-modal h2').innerText(), /Tagesrätsel/);
  await tap(page.locator('.sp-modal .btn', { hasText: 'Zum Menü' }));
  await page.waitForSelector('.gm-daily.done');
  await page.screenshot({ path: OUT + '07-menu-daily-done.png' });
  log('Tagesrätsel ok');

  // 10) Themen-Katalog → Thema wählen
  await tap(page.locator('.gm-sec', { hasText: 'Themen' }));
  await page.waitForFunction(() => location.hash === '#themen');
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '08-themes.png' });
  await tap(page.locator('.theme-tile[data-theme="kaeserei"]'));
  await page.waitForFunction(() => window.__wordsearch && window.__wordsearch.puzzle.theme === 'kaeserei');
  log('Themenwahl ok');

  // 11) Statistik
  await tap(page.locator('.topbar .icon-btn').first());
  await page.waitForSelector('.gm-primary');
  await tap(page.locator('.gm-sec', { hasText: 'Statistik' }));
  await page.waitForSelector('.sp-modal .stats');
  await page.screenshot({ path: OUT + '09-stats.png' });
  assert.match(await page.locator('.sp-modal .stats').innerText(), /Gelöst/);
  await tap(page.locator('.sp-modal .btn', { hasText: 'Schliessen' }));
  await page.waitForTimeout(300);

  // 12) Zurück zur Startseite
  await tap(page.locator('.gm-topbar a, .gm-topbar .icon-btn').first());
  await page.waitForFunction(() => !location.pathname.includes('/wordsearch/'), null, { timeout: 5000 });
  log('Zurück zum Hub ok');

  // 13) Schwer auf kleinem Bildschirm (iPhone SE-Grösse): passt ohne Scrollen
  const small = await newPage(browser, { width: 375, height: 600 });
  await small.page.goto(BASE);
  await small.page.evaluate(() => {
    localStorage.setItem('spielpause.tutorial.wordsearch', 'true');
    localStorage.setItem('spielpause.wordsearch.coachDone', 'true');
  });
  await small.page.goto(BASE + '#play/schwer');
  await small.page.reload();
  await small.page.waitForFunction(() => window.__wordsearch);
  await small.page.waitForTimeout(500);
  await noPageScroll(small.page, 'Schwer klein');
  const sz = await small.page.evaluate(() => window.__wordsearch.puzzle);
  assert.ok(sz.size >= 12 && sz.words.length >= 16);
  // diagonal/rückwärts-Wort echt wischen
  const diag = sz.words.find((p) => ['NW', 'SW', 'W', 'N'].includes(p.d)) || sz.words[0];
  await swipe(small.page, small.cdp, diag, wordEnd(diag), 12);
  await small.page.waitForTimeout(300);
  assert.equal(await small.page.evaluate(() => window.__wordsearch.state.found.length), 1, 'Schwer: Wort gefunden');
  await small.page.screenshot({ path: OUT + '10-schwer-small.png' });
  log('Schwer klein ok');
  await small.ctx.close();

  assert.deepEqual(errors, [], 'keine Konsolenfehler');
  console.log('\nE2E: alles bestanden ✓');
} catch (e) {
  console.error('E2E FEHLER:', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
