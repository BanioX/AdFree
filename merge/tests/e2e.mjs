// Ende-zu-Ende-Test für «Verdoppeln» (iPhone 13, Touch).
//   Server: python3 -m http.server 8208 --bind 127.0.0.1   (aus dem Repo-Wurzelverzeichnis)
//   Start:  node merge/tests/e2e.mjs
// Screenshots landen in merge/tests/out/.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8208/merge/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const cdp = await ctx.newCDPSession(page);

const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const wait = (ms) => page.waitForTimeout(ms);
const save = (slot) => page.evaluate((k) => JSON.parse(localStorage.getItem('spielpause.merge.save.' + k) || 'null'), slot);
const step = (msg) => console.log('•', msg);

/** Echte Wischgeste über Touch-Ereignisse (wie auf dem iPhone). */
async function swipe(dir) {
  const box = await page.locator('.board').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const pts = [0, 0.25, 0.5, 0.75, 1].map((k) => ({ x: cx + d[0] * 70 * k, y: cy + d[1] * 70 * k }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function modalTitle() {
  const t = page.locator('.sp-modal h2');
  return (await t.count()) ? (await t.first().textContent()) : null;
}
async function clickModal(label) {
  await page.locator('.sp-modal .btn', { hasText: label }).first().click();
  await wait(350);
}

try {
  // ---------- Erster Start: Anleitung ----------
  step('Erster Start zeigt «So geht\'s»');
  await page.goto(BASE);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('spielpause.merge')) localStorage.removeItem(k); });
  await page.reload();
  await page.waitForSelector('.sp-modal h2');
  assert.equal(await modalTitle(), "So geht's");
  await shot('01-help');
  await clickModal("Los geht's");
  assert.equal(await page.locator('.sp-modal').count(), 0);
  assert.equal(await page.locator('.topbar a.icon-btn').getAttribute('href'), '../', 'Zurück zur Startseite');
  await shot('02-menu');

  // ---------- Menü: Aussehen, Statistik ----------
  step('Aussehen wählen und Statistik öffnen');
  await page.locator('.quick', { hasText: 'Aussehen' }).click();
  await page.locator('.skin-row', { hasText: 'Tiere' }).click();
  await wait(400);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.merge.progress')).skin), 'tiere');
  await page.locator('.quick', { hasText: 'Statistik' }).click();
  await page.waitForSelector('table.stats');
  await shot('03-stats');
  await clickModal('Schliessen');

  // ---------- Freies Spiel: Züge, Rückgängig, Neu laden ----------
  step('Freies Spiel 4×4 starten, wischen, rückgängig, neu laden');
  await page.locator('.big-play').click();
  await page.waitForSelector('.board .tile');
  assert.match(page.url(), /#spiel\/klassisch$/);
  let moves = 0;
  for (const d of ['down', 'left', 'down', 'right', 'down', 'left', 'up', 'left', 'down', 'right']) {
    const before = (await save('klassisch')).state.moves;
    await swipe(d);
    await wait(170);
    if ((await save('klassisch')).state.moves > before) moves++;
  }
  assert.ok(moves >= 5, 'Wischen bewegt Kacheln');
  await page.keyboard.press('ArrowDown'); await wait(160);
  await page.keyboard.press('ArrowLeft'); await wait(160);
  const s1 = await save('klassisch');
  await page.locator('.tool', { hasText: 'Zurück' }).click();
  await wait(250);
  const s2 = await save('klassisch');
  assert.equal(s2.state.moves, s1.state.moves - 1, 'Rückgängig nimmt einen Zug zurück');
  assert.equal(s2.undos, 2);
  const scrollable = await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 1);
  assert.equal(scrollable, false, 'keine Seiten-Scrollbarkeit im Spiel');
  const bb = await page.locator('.board').boundingBox();
  const tb = await page.locator('.tools').boundingBox();
  assert.ok(bb.y + bb.height <= tb.y + 1 && bb.width >= 330, 'Brett passt auf den Bildschirm');
  await page.locator('.tool', { hasText: 'Tipp' }).click();
  await wait(300);
  assert.equal(await page.locator('.hint-arrow').count(), 1, 'Tipp-Pfeil');
  await shot('04-play');
  const tilesBefore = await page.locator('.board .tile').count();
  const scoreBefore = await page.locator('.stat.score .val').textContent();
  await page.reload();
  await page.waitForSelector('.board .tile');
  await wait(300);
  assert.match(page.url(), /#spiel\/klassisch$/);
  assert.equal(await page.locator('.board .tile').count(), tilesBefore, 'Kacheln nach Neuladen gleich');
  assert.equal(await page.locator('.stat.score .val').textContent(), scoreBefore, 'Punkte nach Neuladen gleich');
  assert.equal((await save('klassisch')).state.moves, s2.state.moves);

  // ---------- Freies Spiel: Ziel erreichen, weiterspielen ----------
  step('Ziel 2048 erreichen → Siegesblatt → weiterspielen');
  await page.evaluate(async () => {
    const L = await import('/merge/logic.js');
    const s = L.fromText('1024 1024 4 2\n8 16 32 4\n2 4 8 16\n4 8 2 4', { target: 11 });
    s.seed = 'e2e'; s.spawns = 3;
    localStorage.setItem('spielpause.merge.save.klassisch', JSON.stringify({ kind: 'free', mode: 'klassisch', state: s, hist: [], undos: 3, refill: 25, winSeen: false }));
  });
  await page.reload();
  await page.waitForSelector('.board .tile');
  await swipe('left');
  await page.waitForSelector('.sp-modal h2', { timeout: 3000 });
  assert.equal(await modalTitle(), 'Geschafft!');
  await wait(400);
  await shot('05-win-free');
  await clickModal('Weiterspielen');
  assert.equal(await page.locator('.sp-modal').count(), 0);
  const w = await save('klassisch');
  assert.ok(w.state.won && w.winSeen);
  await page.keyboard.press('ArrowDown'); await wait(200);
  await page.keyboard.press('ArrowRight'); await wait(200);
  assert.equal(await page.locator('.sp-modal').count(), 0, 'kein zweites Siegesblatt');

  // ---------- Spielende ----------
  step('Spielende zeigt «Keine Züge mehr»');
  await page.evaluate(async () => {
    const L = await import('/merge/logic.js');
    const s = L.fromText('2 4 2\n4 2 4\n2 4 8', { target: 8 });
    s.seed = 'x';
    localStorage.setItem('spielpause.merge.save.knifflig', JSON.stringify({ kind: 'free', mode: 'knifflig', state: s, hist: [], undos: 0, refill: 3, winSeen: false }));
  });
  await page.goto(BASE + '#spiel/knifflig');
  await page.waitForSelector('.sp-modal h2', { timeout: 3000 });
  assert.equal(await modalTitle(), 'Keine Züge mehr');
  await clickModal('Neues Spiel');
  assert.equal((await save('knifflig')).state.moves, 0);
  assert.equal(await page.locator('.board .tile').count(), 2);

  // Zurück ins Menü
  await page.locator('.topbar .icon-btn').first().click();
  await wait(300);
  assert.ok(/#$|merge\/$/.test(page.url()), 'Zurück führt ins Menü: ' + page.url());

  // ---------- Etappe 1 komplett spielen ----------
  step('Etappe 1 per Wischen bis zum Ziel spielen');
  await page.locator('.segmented button', { hasText: 'Etappen' }).click();
  await wait(200);
  await shot('06-menu-levels');
  await page.locator('.btn-pair .big-play').click();
  await page.waitForSelector('.board .tile');
  assert.match(page.url(), /#etappe\/1$/);
  const order = ['down', 'left', 'down', 'left', 'right', 'up'];
  let won = false;
  for (let i = 0; i < 400 && !won; i++) {
    const before = (await save('etappe')).state;
    if (before.over) {
      await clickModal('Nochmal');
      continue;
    }
    for (const d of order) {
      await swipe(d);
      await wait(60);
      const after = (await save('etappe')).state;
      if (after.moves !== before.moves || after.seed !== before.seed) break;
    }
    if (i === 8) await shot('07-level-play');
    await wait(60);
    won = (await save('etappe')).state.won;
  }
  assert.ok(won, 'Etappe 1 geschafft');
  await page.waitForSelector('.sp-modal h2', { timeout: 3000 });
  assert.equal(await modalTitle(), 'Etappe 1 geschafft!');
  await wait(900);
  await shot('08-level-done');
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.merge.progress')));
  assert.equal(prog.levelMax, 2);
  assert.ok(prog.levelStars[1] >= 1);
  const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.merge')));
  assert.ok(summary && /Etappe 2/.test(summary.text), 'reportSummary');
  await clickModal('Nächste Etappe');
  assert.match(page.url(), /#etappe\/2$/);
  await page.reload();
  await page.waitForSelector('.board .tile');
  assert.match(await page.locator('.topbar .title').first().textContent(), /Etappe 2/);

  // ---------- Karte und Album ----------
  step('Karte und Album');
  await page.goto(BASE + '#etappen');
  await page.waitForSelector('.lv');
  assert.equal(await page.locator('.lv.current').count(), 1);
  await page.locator('.lv.locked').first().click();
  await shot('09-map');
  await page.goto(BASE + '#album');
  await page.waitForSelector('.album-cell');
  assert.ok(await page.locator('.album-cell:not(.unknown)').count() >= 3, 'entdeckte Kacheln im Album');
  await shot('10-album');

  // Unbekannte Route → Menü
  await page.goto(BASE + '#quatsch');
  await page.waitForSelector('.segmented');

  assert.deepEqual(errors, [], 'keine Konsolenfehler');
  console.log('OK – alle Schritte bestanden');
} catch (err) {
  await shot('zz-failure').catch(() => {});
  console.error('FEHLER:', err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
