// Gemeinsamer Playwright-Ablauf für die Sortier-Spiele (Kugeln, Schrauben, Wolle).
// Spielt Level 1 mit echten Taps bis zum Gewinnblatt, prüft Fortsetzen nach Neuladen,
// Hilfen (Tipp, Extra-Stapel, Rückgängig), Tagesrätsel und dass keine Konsolenfehler auftreten.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire('/opt/node-tools/node_modules/')('playwright'); }
const { chromium, devices } = pw;

export async function runE2E({ id, base, out, extraChecks, finalChecks }) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
  const step = (s) => console.log('•', s);

  const waitBoard = async () => {
    await page.waitForFunction(() => window.__sg && window.__sg.board && window.__sg.board.count > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => window.__sg.idle(), null, { timeout: 8000 });
  };
  const tapStack = async (i) => {
    const c = await page.evaluate((k) => window.__sg.center(k), i);
    assert.ok(c, 'Stapel ' + i + ' hat eine Position');
    await page.touchscreen.tap(c.x, c.y);
  };
  const hist = () => page.evaluate(() => window.__sg.run.hist.length);
  const modalOpen = () => page.locator('.sp-modal-backdrop.show').count().then((n) => n > 0);

  async function playMoves(limit = Infinity, shotAt = -1) {
    const sol = await page.evaluate(() => window.__sg.solution());
    assert.ok(sol && sol.length, 'Löser findet eine Lösung');
    let k = 0;
    for (const m of sol) {
      if (k >= limit) break;
      await tapStack(m.from);
      await page.waitForTimeout(90);
      await tapStack(m.to);
      if (k === shotAt) { await page.waitForTimeout(160); await shot('05-move'); }
      await page.waitForTimeout(60);
      await page.waitForFunction(() => window.__sg.idle(), null, { timeout: 8000 });
      k++;
    }
    return { done: k, total: sol.length };
  }

  // 1) Startbildschirm
  step('Startbildschirm');
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.locator('.gm-primary').waitFor();
  assert.match(await page.locator('.gm-primary-label').textContent(), /Spielen/);
  assert.match(await page.locator('.gm-primary-sub').textContent(), /Level 1/);
  assert.equal(await page.locator('.gm-seg button').count(), 3, 'drei Modi als Segment-Schalter');
  assert.equal(await page.locator('.gm-daily').count(), 1, 'Tagesrätsel-Karte');
  await shot('01-menu');

  // 2) Erstes Spiel: Tutorial erscheint automatisch
  step('Tutorial vor dem ersten Spiel');
  await page.locator('.gm-primary').tap();
  await page.locator('.tut-backdrop.show').waitFor({ timeout: 5000 });
  const nSteps = await page.locator('.tut-dots span').count();
  assert.ok(nSteps >= 3 && nSteps <= 4, '3–4 Schritte');
  for (let i = 0; i < nSteps; i++) {
    await page.waitForTimeout(i === 0 ? 2600 : 1800);
    await shot(`02-tutorial-${i + 1}`);
    await page.locator('.tut-next').tap();
  }
  await page.locator('.tut-backdrop').waitFor({ state: 'detached', timeout: 5000 });
  await waitBoard();
  assert.equal(await page.evaluate(() => location.hash), '#play');

  // 3) Level 1 mit Coach-Mark
  step('Level 1: Coach-Mark und erste Züge');
  assert.equal(await page.locator('.sb-coach.on').count(), 1, 'Coach-Ring sichtbar');
  await shot('03-level1');
  const first = await playMoves(2, 0);
  assert.equal(await page.locator('.sb-coach.on').count(), 0, 'Coach-Ring nach dem ersten Zug weg');
  assert.equal(await hist(), first.done);

  // 4) Neu laden: Spielstand bleibt
  step('Neu laden setzt fort');
  await page.reload();
  await waitBoard();
  assert.equal(await hist(), first.done, 'Züge nach Neuladen erhalten');
  assert.equal(await page.locator('.tut-backdrop').count(), 0, 'kein Tutorial mehr');

  // 5) Zu Ende spielen bis zum Gewinnblatt
  step('Level 1 lösen');
  await playMoves();
  await page.locator('.sp-modal-backdrop.show .sg-win').waitFor({ timeout: 8000 });
  await page.waitForTimeout(900);
  await shot('06-win');
  assert.match(await page.locator('.sp-modal h2').textContent(), /Level 1 geschafft/);
  assert.ok(await page.locator('.sg-win-stars .sg-star.on').count() >= 1, 'Sterne');
  await page.locator('.sp-modal-buttons button', { hasText: 'Weiter zu Level 2' }).tap();
  await page.waitForFunction(() => location.hash === '#level/2');
  await waitBoard();
  assert.equal(await page.evaluate(() => window.__sg.run.n), 2);

  // 6) Hilfen: Tipp, Extra-Stapel, Rückgängig
  step('Hilfen');
  const tools = page.locator('.sg-tool');
  await tools.nth(1).tap(); // Tipp
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.sb-stack.hint-src').count(), 1, 'Tipp zeigt Quelle');
  await shot('07-hint');
  const before = await page.evaluate(() => window.__sg.state.stacks.length);
  await tools.nth(2).tap(); // Extra
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__sg.state.stacks.length), before + 1, 'Extra-Stapel');
  await playMoves(1);
  assert.equal(await hist(), 1);
  await tools.nth(0).tap(); // Rückgängig
  await page.waitForFunction(() => window.__sg.idle());
  assert.equal(await hist(), 0, 'Rückgängig');
  // ungültiger Zug wackelt nur
  await shot('08-level2');

  if (extraChecks) await extraChecks({ page, shot, tapStack, playMoves, waitBoard, step });

  // 7) Zurück ins Menü: «Weiterspielen»
  step('Menü zeigt Fortschritt');
  await playMoves(1);
  await page.locator('.sg-topbar a.icon-btn').first().tap();
  await page.locator('.gm-primary').waitFor();
  assert.match(await page.locator('.gm-primary-label').textContent(), /Weiterspielen/);
  assert.match(await page.locator('.gm-primary-sub').textContent(), /Level 2/);
  await shot('09-menu-after');

  // 8) Tagesrätsel lösen
  step('Tagesrätsel');
  await page.locator('.gm-daily').tap();
  await page.waitForFunction(() => location.hash === '#daily');
  await waitBoard();
  await shot('10-daily');
  await playMoves();
  await page.locator('.sp-modal-backdrop.show .sg-win').waitFor({ timeout: 8000 });
  assert.match(await page.locator('.sp-modal h2').textContent(), /Tagesrätsel gelöst/);
  await page.locator('.sp-modal-buttons button', { hasText: 'Zum Menü' }).tap();
  await page.locator('.gm-daily.done').waitFor({ timeout: 5000 });

  // 9) Modus «Entspannt» startet eine eigene Runde
  step('Modus Entspannt');
  await page.locator('.gm-seg button', { hasText: 'Entspannt' }).tap();
  await page.locator('.gm-primary').tap();
  await waitBoard();
  assert.equal(await page.evaluate(() => window.__sg.run.slot), 'zen');
  await page.locator('.sg-topbar a.icon-btn').first().tap();
  await page.locator('.gm-primary').waitFor();
  await page.locator('.gm-seg button', { hasText: 'Kapitel' }).tap();

  // 10) Keine Fehler, Zusammenfassung gemeldet
  const summary = await page.evaluate((gid) => localStorage.getItem('spielpause.summary.' + gid), id);
  assert.ok(summary && /Level 2/.test(summary), 'reportSummary');
  if (finalChecks) await finalChecks({ page, shot, tapStack, playMoves, waitBoard, step, base });
  assert.deepEqual(errors, [], 'keine Konsolenfehler');
  await browser.close();
  console.log('✓ alles gut');
}
