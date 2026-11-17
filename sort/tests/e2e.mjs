// Farbfluss – End-to-End-Test (Playwright, iPhone 13).
// Start: Server aus dem Repo-Wurzelverzeichnis
//   python3 -m http.server 8206 --bind 127.0.0.1
//   node sort/tests/e2e.mjs
// Screenshots landen in sort/tests/out/ (nicht eingecheckt).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire('/opt/node-tools/')('playwright'); }
const { chromium, devices } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:8206/sort/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const step = (s) => console.log('•', s);
const modalOpen = () => page.locator('.sp-modal-backdrop.show').count().then((n) => n > 0);

async function closeModal(label) {
  const btn = label
    ? page.locator('.sp-modal-backdrop.show .sp-modal-buttons button', { hasText: label })
    : page.locator('.sp-modal-backdrop.show .sp-modal-buttons button').first();
  await btn.first().waitFor({ timeout: 5000 });
  await btn.first().tap();
  await page.waitForTimeout(450);
}

async function waitBoard() {
  await page.waitForFunction(() => window.__sort && window.__sort.game && window.__sort.game.board, null, { timeout: 20000 });
  await page.evaluate(() => window.__sort.idle());
}

async function tapTube(i) {
  const c = await page.evaluate((k) => window.__sort.center(k), i);
  assert.ok(c, 'Glas ' + i + ' hat eine Position');
  await page.touchscreen.tap(c.x, c.y);
}

/** Spielt die vom Löser gefundene Lösung mit echten Taps. */
async function solveByTaps({ maxMoves = 400, shotMid = null } = {}) {
  const sol = await page.evaluate(() => window.__sort.solution());
  assert.ok(sol && sol.length, 'Löser findet eine Lösung');
  let k = 0;
  for (const m of sol) {
    if (await modalOpen()) await closeModal();
    await tapTube(m.from);
    await page.waitForTimeout(60);
    await tapTube(m.to);
    if (shotMid && k === 1) { await page.waitForTimeout(260); await shot(shotMid); }
    await page.evaluate(() => window.__sort.idle());
    if (++k > maxMoves) break;
  }
  return sol.length;
}

async function moves() {
  return page.evaluate(() => window.__sort.game && window.__sort.game.run ? window.__sort.game.run.moves : -1);
}

// 1) Erster Start: Anleitung erscheint automatisch
step('Erster Start');
await page.goto(BASE);
await page.locator('.sp-modal-backdrop.show').waitFor({ timeout: 5000 });
const helpTitle = await page.locator('.sp-modal h2').first().textContent();
assert.match(helpTitle, /So geht/);
await shot('01-howto');
await closeModal();
assert.equal(await page.locator('.topbar a[href="../"], .topbar [href="../"]').count() > 0, true, 'Zurück zur Startseite');
await shot('02-menu');

// 2) Level 1 (Tutorial) spielen bis zum Gewinnblatt
step('Level 1 spielen');
await page.getByText('Spielen', { exact: false }).first().tap();
await page.waitForFunction(() => location.hash === '#play');
await waitBoard();
await shot('03-level1');
await solveByTaps({ shotMid: '04-pour' });
await page.locator('.sp-modal-backdrop.show .win-stats').waitFor({ timeout: 8000 });
await page.waitForTimeout(700);
await shot('05-win');
const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.sort.progress')));
assert.equal(prog.level, 2, 'Level 2 freigeschaltet');
await closeModal('Weiter');
await waitBoard();
const title = await page.locator('.title-block b').first().textContent();
assert.match(title, /Level 2/);

// 3) Züge machen, neu laden → Spielstand bleibt
step('Speichern und Fortsetzen');
if (await modalOpen()) await closeModal();
const sol2 = await page.evaluate(() => window.__sort.solution());
for (const m of sol2.slice(0, 3)) {
  await tapTube(m.from); await page.waitForTimeout(60); await tapTube(m.to);
  await page.evaluate(() => window.__sort.idle());
}
const before = await page.evaluate(() => JSON.stringify(window.__sort.game.run.state));
assert.equal(await moves(), 3);
await page.reload();
await waitBoard();
assert.equal(await page.evaluate(() => location.hash), '#play');
assert.equal(await moves(), 3, 'Züge nach Neuladen erhalten');
assert.equal(await page.evaluate(() => JSON.stringify(window.__sort.game.run.state)), before, 'Gläser nach Neuladen erhalten');

// Rückgängig, +1 Glas, Neustart
step('Hilfen');
await page.locator('#tool-undo').tap();
await page.evaluate(() => window.__sort.idle());
assert.equal(await moves(), 2, 'Rückgängig');
const nTubes = await page.evaluate(() => window.__sort.game.run.state.tubes.length);
await page.locator('#tool-extra').tap();
await page.waitForTimeout(300);
if (await modalOpen()) await closeModal();
await page.evaluate(() => window.__sort.idle());
assert.equal(await page.evaluate(() => window.__sort.game.run.state.tubes.length), nTubes + 1, '+1 Glas');
assert.equal(await page.locator('#tool-extra').isDisabled(), true, '+1 Glas nur einmal');
await page.locator('#tool-hint').tap();
await page.waitForTimeout(400);
await shot('06-hint');
await page.locator('#tool-restart').tap();
await page.waitForTimeout(300);
if (await modalOpen()) await closeModal('Neu');
await page.evaluate(() => window.__sort.idle());
assert.equal(await moves(), 0, 'Neustart');
assert.equal(await page.evaluate(() => window.__sort.game.run.state.tubes.length), nTubes, 'Neustart entfernt Extra-Glas');

// 4) Zurück ins Menü
step('Zurück ins Menü');
await page.locator('.topbar .icon-btn').first().tap();
await page.waitForFunction(() => !location.hash || location.hash === '#');
await page.getByText('Weiter', { exact: false }).first().waitFor();

// 5) Tagesrätsel
step('Tagesrätsel');
await page.locator('#daily-card').tap();
await page.waitForFunction(() => location.hash === '#daily');
await waitBoard();
if (await modalOpen()) await closeModal();
await shot('07-daily');
await solveByTaps();
await page.locator('.sp-modal-backdrop.show .win-stats').waitFor({ timeout: 8000 });
const done = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('spielpause.daily.sort.') && localStorage.getItem(k) === 'true'));
assert.ok(done, 'Tagesrätsel als gelöst markiert');
await closeModal('Menü');
await page.waitForTimeout(500);
assert.ok(await page.locator('.daily-card.done').count() > 0, 'Häkchen beim Tagesrätsel');
await shot('08-menu-daily-done');

// 6) Statistik
step('Statistik');
await page.getByText('Statistik').first().tap();
await page.locator('.sp-modal-backdrop.show').waitFor();
await shot('09-stats');
await closeModal();

// 7) Grosses Level (16 Gläser) und Geheimnis-Level
step('Viele Gläser');
await page.evaluate(() => {
  localStorage.setItem('spielpause.sort.progress', JSON.stringify({ level: 125, stars: {} }));
});
await page.goto(BASE + '#replay/101');
await waitBoard();
if (await modalOpen()) await closeModal();
assert.equal(await page.evaluate(() => window.__sort.game.run.state.tubes.length), 16);
await shot('10-sixteen');
await page.goto(BASE + '#replay/120');
await waitBoard();
while (await modalOpen()) await closeModal();
await shot('11-geheimnis');
const hidden = await page.evaluate(() => window.__sort.game.run.state.tubes.some((t) => t.h > 0));
assert.ok(hidden, 'verdeckte Schichten');

await page.waitForTimeout(300);
assert.deepEqual(errors, [], 'keine Konsolenfehler');
await browser.close();
console.log('OK – alle E2E-Prüfungen bestanden');
