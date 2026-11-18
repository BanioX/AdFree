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
// Farbfluss ist (noch) nur deutsch – Gerätesprache Deutsch, damit auch die gemeinsamen Bausteine deutsch sind
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-CH', deviceScaleFactor: 1 });
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
  await page.waitForTimeout(350); // Doppeltipp-Schutz der Seite
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

const tutOpen = () => page.locator('.tut-backdrop.show').count().then((n) => n > 0);

/** Geht alle Tutorial-Schritte mit «Weiter» durch (Screenshots optional). */
async function walkTutorial(prefix) {
  await page.locator('.tut-backdrop.show').waitFor({ timeout: 5000 });
  assert.match(await page.locator('.tut-kicker').textContent(), /So geht/);
  const n = await page.locator('.tut-dots span').count();
  assert.ok(n >= 3 && n <= 4, '3–4 Schritte');
  for (let i = 0; i < n; i++) {
    assert.ok(await page.locator('.tut-stage .tt-scene').count() > 0, 'animierte Demo in Schritt ' + (i + 1));
    // Bildschirmfoto mitten in der Animation (Giessen, ✕, Tipp-Pfeile)
    if (prefix) { await page.waitForTimeout([2600, 2600, 2600, 2700][i] || 1500); await shot(`${prefix}-${i + 1}`); }
    await page.locator('.tut-next').tap();
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => !document.querySelector('.tut-backdrop'), null, { timeout: 3000 });
}

// 1) Erster Start: Anleitung erscheint automatisch
step('Erster Start');
await page.goto(BASE);
await walkTutorial('01-howto');
assert.equal(await page.locator('.topbar a[href="../"], .topbar [href="../"]').count() > 0, true, 'Zurück zur Startseite');
assert.equal(await page.locator('.gm-stats').count(), 0, 'keine leeren Kennzahlen bei Neuinstallation');
assert.equal(await page.locator('.mp.cur').count(), 1, 'Levelkarte zeigt das aktuelle Level');
await shot('02-menu');

// 2) Level 1 (Tutorial) spielen bis zum Gewinnblatt
step('Level 1 spielen');
await page.getByText('Spielen', { exact: false }).first().tap();
await page.waitForFunction(() => location.hash === '#play');
await waitBoard();
// Coach-Mark: pulsierender Ring um das erste Glas, verschwindet nach dem ersten Giessen
await page.locator('.coach-ring:not(.hidden)').waitFor({ timeout: 4000 });
await page.waitForTimeout(500);
await shot('03-level1');
{
  const src = +(await page.locator('.coach-ring').getAttribute('data-tube'));
  await tapTube(src);
  await page.waitForTimeout(500);
  const dst = +(await page.locator('.coach-ring').getAttribute('data-tube'));
  assert.notEqual(src, dst, 'Ring wandert zum Zielglas');
  await tapTube(dst);
  await page.evaluate(() => window.__sort.idle());
  assert.equal(await page.locator('.coach-ring.hidden').count(), 1, 'Coach-Mark weg nach dem ersten Zug');
}
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

// Ziehen: von einem Glas zum anderen giesst
step('Ziehen');
{
  const sol = await page.evaluate(() => window.__sort.solution());
  const a = await page.evaluate((k) => window.__sort.center(k), sol[0].from);
  const b = await page.evaluate((k) => window.__sort.center(k), sol[0].to);
  const cdp = await ctx.newCDPSession(page);
  const tp = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(a.x, a.y) });
  for (let k = 1; k <= 6; k++) {
    await page.waitForTimeout(30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(a.x + ((b.x - a.x) * k) / 6, a.y + ((b.y - a.y) * k) / 6) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => window.__sort.idle());
  assert.equal(await moves(), 1, 'Ziehen giesst');
  await page.locator('#tool-undo').tap();
  await page.evaluate(() => window.__sort.idle());
  assert.equal(await moves(), 0);
}

// Schnelles Spielen: nie zwei Gläser gleichzeitig im selben Bereich
step('Schnelle Züge');
{
  const sol = await page.evaluate(() => window.__sort.solution());
  const watch = page.evaluate(() => new Promise((res) => {
    const b = window.__sort.game.board;
    let worst = 0, maxAnims = 0;
    const t0 = performance.now();
    const ov = (p, q) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
    (function tick() {
      const as = b.anims;
      maxAnims = Math.max(maxAnims, as.length);
      for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) if (ov(as[i].box, as[j].box)) worst++;
      if (performance.now() - t0 < 3500) requestAnimationFrame(tick); else res({ worst, maxAnims });
    })();
  }));
  for (const m of sol.slice(0, 4)) {
    await tapTube(m.from); await page.waitForTimeout(40); await tapTube(m.to); await page.waitForTimeout(40);
  }
  await page.waitForTimeout(120);
  await shot('06b-fast');
  const r = await watch;
  assert.equal(r.worst, 0, 'keine überlappenden Giess-Flüge');
  await page.evaluate(() => window.__sort.idle());
  assert.equal(await moves(), 4, 'alle schnellen Züge ausgeführt');
  await page.locator('#tool-restart').tap();
  await page.waitForTimeout(300);
  if (await modalOpen()) await closeModal('Neu');
  await page.evaluate(() => window.__sort.idle());
}

// «So geht's» im Spiel: Zeit steht still
step('Hilfe im Spiel');
{
  const e0 = await page.evaluate(() => window.__sort.game.elapsed);
  await page.locator('#game-help').tap();
  await page.locator('.tut-backdrop.show').waitFor({ timeout: 3000 });
  await page.waitForTimeout(1500);
  await page.locator('.tut-skip').tap();
  await page.waitForFunction(() => !document.querySelector('.tut-backdrop'), null, { timeout: 3000 });
  const e1 = await page.evaluate(() => window.__sort.game.elapsed);
  assert.ok(e1 - e0 < 900, 'Zeit pausiert während der Anleitung (' + Math.round(e1 - e0) + ' ms)');
}

// 4) Zurück ins Menü
step('Zurück ins Menü');
await page.locator('.topbar .icon-btn').first().tap();
await page.waitForFunction(() => !location.hash || location.hash === '#');
await page.getByText('Weiter', { exact: false }).first().waitFor();

// 5) Tagesrätsel
step('Tagesrätsel');
await page.waitForTimeout(400); // Doppeltipp-Schutz der Seite
await page.locator('.gm-daily').tap();
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
assert.ok(await page.locator('.gm-daily.done').count() > 0, 'Häkchen beim Tagesrätsel');
await shot('08-menu-daily-done');

// 6) Statistik
step('Statistik');
await page.waitForTimeout(400);
await page.getByText('Statistik').first().tap();
await page.locator('.sp-modal-backdrop.show').waitFor();
await page.waitForTimeout(400);
await shot('09-stats');
await closeModal();

// 7) Grosses Level (16 Gläser) und Geheimnis-Level
step('Viele Gläser');
await page.evaluate(() => {
  localStorage.setItem('spielpause.sort.progress', JSON.stringify({ level: 125, stars: {} }));
});
await page.evaluate(() => { history.replaceState(null, '', '#replay/101'); });
await page.reload();
await waitBoard();
// Viele Farben: Farbsymbole werden einmal angeboten
await page.locator('.sp-modal-backdrop.show').waitFor({ timeout: 4000 });
assert.match(await page.locator('.sp-modal h2').first().textContent(), /Viele Farben/);
await closeModal('Nein');
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => window.__sort.game.run.state.tubes.length), 16);
await shot('10-sixteen');
await page.waitForTimeout(400);
await page.evaluate(() => { location.hash = 'replay/120'; });
await page.waitForFunction(() => window.__sort.game && window.__sort.game.run && window.__sort.game.run.n === 120, null, { timeout: 20000 });
await waitBoard();
// Einführung «Geheimnis-Level» erscheint beim ersten Mal
await page.locator('.sp-modal-backdrop.show').waitFor({ timeout: 4000 });
assert.match(await page.locator('.sp-modal h2').first().textContent(), /Geheimnis/);
await closeModal();
await page.waitForTimeout(600);
await shot('11-geheimnis');
const hidden = await page.evaluate(() => window.__sort.game.run.state.tubes.some((t) => t.h > 0));
assert.ok(hidden, 'verdeckte Schichten');

// 8) Kleines iPhone (375×667): Hauptknopf ohne Scrollen sichtbar
step('Kleiner Bildschirm');
{
  const small = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-CH', viewport: { width: 375, height: 667 }, deviceScaleFactor: 1 });
  const p2 = await small.newPage();
  p2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p2.goto(BASE);
  await p2.evaluate(() => {
    localStorage.setItem('spielpause.tutorial.sort', 'true');
    localStorage.setItem('spielpause.sort.progress', JSON.stringify({ level: 23, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 16: 3, 17: 2, 18: 3, 19: 3, 20: 1, 21: 3, 22: 3 } }));
  });
  await p2.reload();
  await p2.waitForTimeout(1200);
  const box = await p2.locator('.gm-primary').boundingBox();
  assert.ok(box && box.y + box.height <= 667, 'Hauptknopf sichtbar ohne Scrollen');
  assert.match(await p2.locator('.gm-primary-sub').textContent(), /Level 23/);
  await p2.screenshot({ path: OUT + '12-menu-375x667.png' });
  await small.close();
}

await page.waitForTimeout(300);
assert.deepEqual(errors, [], 'keine Konsolenfehler');
await browser.close();
console.log('OK – alle E2E-Prüfungen bestanden');
