// End-to-End-Test für Dreierlei (Playwright, iPhone-13-Emulation).
//
//   python3 -m http.server 8203 --bind 127.0.0.1     (im Repo-Wurzelverzeichnis)
//   node triple/tests/e2e.mjs                         (Screenshots: triple/tests/out/)
//
// Ablauf: Startseite → Kachel «Dreierlei» → Anleitung → Menü → Level 1 mit echten Taps
// bis zum Gewinn-Blatt (Löser liefert nur die Reihenfolge), Neuladen mitten im Spiel,
// Hilfen, verlorene Runde, Freies Spiel, Levelübersicht, Statistik, #daily-Umleitung.
// Es dürfen keine Konsolenfehler auftreten.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
const { chromium, devices } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:8203/';
const LOCALE = process.env.LOCALE || 'de-CH'; // Texte unten sind Deutsch
const SHOTS = process.env.SHOTS || path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, locale: LOCALE });
const page = await context.newPage();

const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // 404 von Kachel-Icons anderer (noch nicht fertiger) Spiele auf der Startseite ignorieren
  if (!page.url().includes('/triple/') && /Failed to load resource/.test(m.text())) return;
  problems.push('console: ' + m.text());
});
page.on('response', (r) => {
  const u = r.url();
  if (r.status() >= 400 && (u.includes('/triple/') || u.includes('/shared/') || u.includes('games/triple.svg'))) {
    problems.push(`HTTP ${r.status()} ${u}`);
  }
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  console.log('  📸', name);
};
const step = (t) => console.log('•', t);
const wait = (ms) => page.waitForTimeout(ms);

async function waitIdle(timeout = 4000) {
  await page.waitForFunction(() => window.__triple && !window.__triple.isBusy(), null, { timeout });
}

async function state() {
  return page.evaluate(() => {
    const g = window.__triple.game;
    return { status: g.status, remaining: g.remaining, tray: g.tray.slice(), shelf: g.shelf.slice(), moves: g.moves, used: g.used, n: g.n, helpers: { ...g.helpers } };
  });
}

/** Tippt Stein id mit einem echten Touch-Tap an. */
async function tapTile(id) {
  const c = await page.evaluate((i) => window.__triple.tileCenter(i), id);
  assert.ok(c, 'Stein ' + id + ' hat keine Position');
  await page.touchscreen.tap(c.x, c.y);
}

/** Spielt mit dem Löser als «Augen» weiter, bis status != play oder maxMoves erreicht. */
async function playMoves(maxMoves, { onMove } = {}) {
  for (let k = 0; k < maxMoves; k++) {
    const s = await state();
    if (s.status !== 'play') return s;
    await waitIdle();
    const id = await page.evaluate(() => window.__triple.nextMove());
    assert.ok(id >= 0, 'kein Zug gefunden');
    const before = s.moves;
    await tapTile(id);
    await page.waitForFunction((m) => window.__triple && window.__triple.game.moves > m, before, { timeout: 3000 });
    if (onMove) await onMove(k, id);
  }
  return state();
}

try {
  // ---------- Startseite → Kachel ----------
  step('Startseite öffnen und Dreierlei-Kachel antippen');
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('a.tile[href="triple/"]').waitFor();
  await shot('01-hub');
  await page.locator('a.tile[href="triple/"]').tap();
  await page.waitForURL(/\/triple\/$/);

  // ---------- Anleitung beim ersten Start ----------
  step('Anleitung erscheint automatisch');
  await page.locator('.tut-backdrop .tut-title').waitFor();
  await wait(1800);
  await shot('02-anleitung');
  for (let k = 0; k < 2; k++) { await page.locator('.tut-next').tap(); await wait(1300); }
  await shot('02b-anleitung-hilfen');
  await page.locator('.tut-next').tap();
  await wait(900);
  assert.match(await page.locator('.tut-next').textContent(), /Los geht/);
  await page.locator('.tut-next').tap();
  await page.locator('.tut-backdrop').waitFor({ state: 'detached' });

  step('Menü');
  await page.locator('.gm-primary').waitFor();
  await shot('03-menu');
  const sum = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.triple')));
  assert.ok(sum && /Level 1/.test(sum.text), 'reportSummary fehlt');

  // ---------- Level 1 ----------
  step('Level 1 starten');
  await page.locator('.gm-primary').tap();
  await page.waitForFunction(() => location.hash === '#play' && window.__triple);
  await wait(250);
  await shot('04-level1-deal');
  await waitIdle(5000);
  await page.locator('.tr-coach').waitFor({ state: 'attached' });
  await shot('05-level1-start');
  let s = await state();
  assert.equal(s.status, 'play');
  assert.equal(s.n % 3, 0);

  step('Verdeckten Stein antippen → nichts passiert');
  // ein verdeckter Stein, dessen sichtbarer Teil (unterer Rand) angetippt werden kann
  const coveredPt = await page.evaluate(() => {
    const g = window.__triple.game;
    for (let i = 0; i < g.n; i++) {
      if (g.where[i] !== 0 || g.block[i] === 0) continue;
      const el = document.querySelector(`.tr-tile[data-id="${i}"]`);
      const r = el.getBoundingClientRect();
      for (const fy of [0.9, 0.8, 0.5, 0.2]) for (const fx of [0.5, 0.15, 0.85]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && hit.closest('.tr-tile') === el) return { i, x, y };
      }
    }
    return null;
  });
  if (coveredPt) {
    await page.touchscreen.tap(coveredPt.x, coveredPt.y);
    await wait(150);
    assert.equal((await state()).moves, 0, 'verdeckter Stein darf nicht genommen werden');
  }

  step('Erste Züge mit echten Taps, Drilling-Moment festhalten');
  let shotPop = false;
  s = await playMoves(6, {
    onMove: async () => {
      if (shotPop) return;
      const triples = await page.evaluate(() => window.__triple.game.triples);
      if (triples > 0) { await wait(330); await shot('06-drilling-pop'); shotPop = true; }
    },
  });
  await waitIdle();
  await shot('07-level1-mitte');

  step('Neu laden mitten im Spiel → Zustand bleibt');
  const before = await state();
  await page.reload();
  await page.waitForFunction(() => window.__triple && window.__triple.game);
  await waitIdle(5000);
  const after = await state();
  assert.equal(after.remaining, before.remaining, 'Steine nach Neuladen');
  assert.deepEqual(after.tray, before.tray, 'Ablage nach Neuladen');
  assert.equal(after.moves, before.moves);
  assert.equal(await page.evaluate(() => location.hash), '#play');

  step('Tipp benutzen');
  await page.locator('.tr-helper[data-helper="hint"]').tap();
  await page.waitForFunction(() => document.querySelectorAll('.tr-tile.hint').length > 0, null, { timeout: 3000 });
  await wait(300);
  await shot('08-tipp');
  s = await state();
  assert.equal(s.helpers.hint, 0);

  step('Zurück benutzen');
  s = await playMoves(1);
  if ((await state()).tray.length > 0 && await page.evaluate(() => window.__triple.game.canUndo())) {
    const m0 = await state();
    await page.locator('.tr-helper[data-helper="undo"]').tap();
    await page.waitForFunction(() => window.__triple.game.helpers.undo === 0, null, { timeout: 3000 });
    const m1 = await state();
    assert.equal(m1.tray.length, m0.tray.length - 1, 'Zurück legt den Stein aufs Brett');
    assert.equal(m1.remaining, m0.remaining);
  }

  step('Level 1 zu Ende spielen');
  s = await playMoves(200);
  assert.equal(s.status, 'won', 'Level 1 sollte gewonnen sein');
  await page.locator('.sp-modal h2', { hasText: 'geschafft' }).waitFor({ timeout: 6000 });
  await wait(1200);
  await shot('09-gewonnen');
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.triple.progress')));
  assert.equal(prog.level, 2, 'Fortschritt: Level 2');
  assert.ok(prog.stars[1] >= 1 && prog.stars[1] <= 3);

  step('Weiter zu Level 2');
  await page.locator('.sp-modal .btn.primary').tap();
  await page.waitForFunction(() => window.__triple && /Level 2/.test(document.querySelector('.tr-title b').textContent));
  await waitIdle(5000);
  await shot('10-level2-start');

  step('Auslagern und Mischen');
  await playMoves(2);
  await waitIdle();
  if ((await state()).tray.length > 0) {
    await page.locator('.tr-helper[data-helper="stash"]').tap();
    await page.waitForFunction(() => window.__triple.game.shelf.length > 0);
    await waitIdle();
    await shot('11-auslage');
  }
  await page.locator('.tr-helper[data-helper="shuffle"]').tap();
  await wait(250);
  await shot('12-mischen');
  await waitIdle(5000);
  s = await state();
  assert.equal(s.helpers.shuffle, 0);

  step('Zurück ins Menü (Spiel bleibt gespeichert)');
  await page.locator('.tr-top .icon-btn').first().tap();
  await page.locator('.gm-primary').waitFor();
  assert.ok(page.url().includes('/triple/'), 'Zurück darf nicht zur Startseite durchtippen');
  const label = await page.locator('.gm-primary').textContent();
  assert.match(label, /Weiterspielen\s*Level 2/);
  await shot('13-menu-weiter');

  // ---------- Verlieren ----------
  step('Freies Spiel: Auswahl');
  await page.locator('.gm-sec', { hasText: 'Freies Spiel' }).tap();
  await page.locator('.tr-theme-grid').waitFor();
  await wait(400); // Doppeltipp-Sperre von setupPage()
  await page.locator('.tr-size[data-size="riesig"]').tap();
  await shot('14-freies-spiel');
  await wait(400);
  await page.locator('.tr-theme[data-theme="meer"]').tap();
  await page.waitForFunction(() => /^#free\/meer\/riesig\//.test(location.hash) && window.__triple);
  await waitIdle(6000);
  await shot('15-frei-riesig');

  step('Absichtlich verlieren (7 verschiedene)');
  for (let k = 0; k < 7; k++) {
    await waitIdle();
    const id = await page.evaluate(() => {
      const g = window.__triple.game;
      const inTray = new Set(g.tray.map((i) => g.types[i]));
      const free = g.freeTiles();
      return free.find((i) => !inTray.has(g.types[i])) ?? -1;
    });
    if (id < 0) break;
    await tapTile(id);
    await wait(60);
  }
  s = await state();
  assert.equal(s.status, 'lost', 'Runde sollte verloren sein');
  await page.locator('.sp-modal h2', { hasText: 'Ablage voll' }).waitFor({ timeout: 4000 });
  await wait(350);
  await shot('16-verloren');
  step('Rettung mit «Auslagern»');
  await page.locator('.sp-modal .btn', { hasText: 'Auslagern' }).tap();
  await page.waitForFunction(() => window.__triple.game.status === 'play');
  await waitIdle();
  await shot('17-gerettet');

  step('Nochmal neu starten');
  await page.locator('.tr-top .icon-btn[aria-label="Neu beginnen"]').tap();
  await page.locator('.sp-modal .btn.primary', { hasText: 'Neu beginnen' }).tap();
  await page.waitForFunction(() => window.__triple && window.__triple.game.moves === 0);
  await waitIdle(6000);

  // ---------- Übersichten ----------
  step('Levelübersicht und Statistik');
  await page.locator('.tr-top .icon-btn').first().tap();
  await wait(400);
  await page.locator('.gm-sec', { hasText: 'Levels' }).tap();
  await page.locator('.tr-level-grid').waitFor();
  await wait(200);
  await shot('18-levels');
  await page.locator('.tr-level').first().tap();
  await wait(400);
  if (await page.evaluate(() => location.hash) !== '#level/1') await page.locator('.tr-level').first().tap();
  await page.waitForFunction(() => location.hash === '#level/1' && window.__triple);
  await waitIdle(5000);
  await page.locator('.tr-top .icon-btn').first().tap();
  await page.locator('.tr-stat-link').waitFor();
  await wait(400);
  await page.locator('.tr-stat-link').tap();
  await page.locator('.sp-modal h2', { hasText: 'Statistik' }).waitFor();
  await wait(300);
  await shot('19-statistik');
  await page.locator('.sp-modal .btn.primary').tap();
  await page.locator('.sp-modal-backdrop').waitFor({ state: 'detached' });

  step('#daily leitet zur Level-Reihe (kein Tagesrätsel)');
  await page.goto(BASE + 'triple/#daily');
  await page.waitForFunction(() => location.hash === '#play' && window.__triple);
  await waitIdle(5000);

  step('«?» im Spiel zeigt die Anleitung');
  await page.locator('.tr-top .icon-btn[aria-label="So geht’s"]').tap();
  await page.locator('.tut-backdrop .tut-title').waitFor();
  await wait(500); // Doppeltipp-Sperre von setupPage()
  await page.locator('.tut-skip').tap();
  await page.locator('.tut-backdrop').waitFor({ state: 'detached' });

  step('Zurück zur Startseite');
  await page.locator('.tr-top .icon-btn').first().tap();
  await page.locator('.topbar a.icon-btn[href="../"]').tap();
  await page.waitForURL(BASE);
  const hubSum = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.triple')).text);
  assert.match(hubSum, /Level 2/);

  // ---------- kleiner Bildschirm ----------
  step('Kleiner Bildschirm (iPhone SE) ohne Scrollen');
  const small = await browser.newContext({ ...devices['iPhone SE'], deviceScaleFactor: 1, locale: LOCALE });
  const p2 = await small.newPage();
  p2.on('pageerror', (e) => problems.push('SE pageerror: ' + e.message));
  await p2.goto(BASE + 'triple/');
  await p2.evaluate(() => localStorage.setItem('spielpause.tutorial.triple', 'true'));
  await p2.goto(BASE + 'triple/#play');
  await p2.reload();
  await p2.waitForFunction(() => window.__triple && !window.__triple.isBusy(), null, { timeout: 6000 });
  const overflow = await p2.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
  assert.equal(overflow, false, 'Seite darf nicht scrollen');
  await p2.screenshot({ path: path.join(SHOTS, '20-iphone-se.png') });
  await small.close();

  assert.deepEqual(problems, [], 'Fehler in der Konsole');
  console.log('\n✅ E2E ok – Screenshots in', SHOTS);
} catch (e) {
  console.error('\n❌', e.message);
  if (problems.length) console.error(problems.join('\n'));
  await shot('zz-fehler').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
