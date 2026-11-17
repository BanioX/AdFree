// Ablauf-Test (Playwright, iPhone 13): Menü → Tutorial → Level 1 bis zum Siegesblatt →
// Level 2 anspielen → Neuladen setzt fort → Entspannt-Modus → Levelkarte. Keine Konsolenfehler.
//
//   python3 -m http.server 8222 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node bubbles/tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8222/bubbles/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const step = (t) => console.log('·', t);

const savedLevel = () => page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.bubbles.level') || 'null'));
const savedEndless = () => page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.bubbles.endless') || 'null'));

/** Bildschirmpunkt (CSS-px) für Logik-Koordinaten des Spielfelds */
async function toScreen(x, y) {
  return page.evaluate(async ([x, y]) => {
    const hex = await import('./core/hex.js');
    const c = document.querySelector('.bz-canvas');
    const r = c.getBoundingClientRect();
    const s = Math.min(r.width / hex.WIDTH, r.height / hex.FIELD_H);
    const ox = (r.width - hex.WIDTH * s) / 2, oy = r.height - hex.FIELD_H * s;
    return { x: r.left + ox + x * s, y: r.top + oy + y * s };
  }, [x, y]);
}

/** Ein Zug des Computer-Spielers über echte Touch-Eingaben. */
async function playMove(key) {
  const m = await page.evaluate(async (key) => {
    const { Game } = await import('./core/game.js');
    const { bestMove } = await import('./core/solver.js');
    const hex = await import('./core/hex.js');
    const g = Game.fromJSON(JSON.parse(localStorage.getItem(key)));
    const mv = bestMove(g, { step: 1 });
    return mv && { ...mv, used: g.shotsUsed, LX: hex.LAUNCH_X, LY: hex.LAUNCH_Y };
  }, key);
  if (!m) return null;
  if (m.swap) {
    const p = await toScreen(m.LX, m.LY);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(350);
  }
  if (m.arm >= 0) {
    const SLOT_X = [15.4, 17.75, 20.1];
    const p = await toScreen(SLOT_X[m.arm], m.LY + 0.5);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(250);
  }
  const a = (m.angle * Math.PI) / 180;
  const d = Math.min(12, 10.2 / Math.max(1e-3, Math.abs(Math.cos(a))));
  const p = await toScreen(m.LX + Math.cos(a) * d, m.LY - Math.sin(a) * d);
  await page.touchscreen.tap(p.x, p.y);
  return m;
}

async function playUntil(key, done, maxShots = 60) {
  for (let i = 0; i < maxShots; i++) {
    if (await done()) return true;
    const before = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key)).shotsUsed;
    const m = await playMove(key);
    if (!m) return done();
    // warten, bis der Schuss angekommen ist (oder erneut versuchen, wenn das Feld noch beschäftigt war)
    for (let t = 0; t < 30; t++) {
      await page.waitForTimeout(100);
      const g = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
      if (g.shotsUsed > before) break;
    }
    await page.waitForTimeout(700);
  }
  return done();
}

async function noScroll() {
  const r = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth }));
  assert.ok(r.sh <= r.ih + 1 && r.sw <= r.iw + 1, `kein Seiten-Scrollen: ${JSON.stringify(r)}`);
}

// ---------- 1. Menü ----------
step('Menü');
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
assert.match(await page.textContent('.gm-primary'), /Spielen/);
await shot('01-menu');

// ---------- 2. Tutorial beim ersten Start ----------
step('Tutorial');
await page.click('.gm-primary');
await page.waitForSelector('.tut-card');
await page.waitForTimeout(1600);
await shot('02-tutorial');
for (let i = 0; i < 4; i++) {
  await page.click('.tut-next');
  await page.waitForTimeout(450);
}
await page.waitForFunction(() => !document.querySelector('.tut-backdrop'));
await page.waitForFunction(() => location.hash === '#level/1');
await page.waitForSelector('.bz-canvas');
assert.ok(await page.$('.bz-coach'), 'Coach-Mark im ersten Level');
await page.waitForTimeout(1700);
await shot('03-level1');
await noScroll();

// ---------- 3. Level 1 bis zum Sieg ----------
step('Level 1 spielen');
const won = await playUntil('spielpause.bubbles.level', async () => (await savedLevel()).status === 'won', 40);
assert.ok(won, 'Level 1 gewonnen');
assert.equal(await page.$('.bz-coach'), null, 'Coach-Mark verschwindet nach dem ersten Schuss');
await page.waitForSelector('.sp-modal h2', { timeout: 15000 });
assert.match(await page.textContent('.sp-modal h2'), /Geschafft|Wunderbar|Perfekt/);
await page.waitForTimeout(900);
await shot('04-win');
const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.bubbles.progress')));
assert.equal(prog.top, 1);
assert.ok(prog.stars[1] >= 1);
const summary = await page.evaluate(() => localStorage.getItem('spielpause.summary.bubbles') || Object.keys(localStorage).filter((k) => k.includes('summary')).join());
assert.ok(summary, 'reportSummary geschrieben');

// ---------- 4. Level 2 anspielen, neu laden ----------
step('Level 2 + Neuladen');
await page.click('.sp-modal .btn.primary');
await page.waitForFunction(() => location.hash === '#level/2');
await page.waitForTimeout(1500);
await playUntil('spielpause.bubbles.level', async () => (await savedLevel()).shotsUsed >= 2, 4);
await page.waitForTimeout(1200);
const before = await savedLevel();
assert.equal(before.levelNo, 2);
await page.reload();
await page.waitForSelector('.bz-canvas');
await page.waitForTimeout(1500);
assert.equal(await page.evaluate(() => location.hash), '#level/2');
const after = await savedLevel();
assert.equal(after.shotsUsed, before.shotsUsed, 'Spielstand nach Neuladen erhalten');
assert.deepEqual(after.board, before.board);
assert.equal(after.score, before.score);
assert.match(await page.textContent('.bz-title'), /Level 2/);
await shot('05-level2-reload');
await noScroll();

// Tipp-Knopf zeigt eine Zielhilfe, «?» öffnet das Tutorial
await page.click('button[aria-label="Tipp"]');
await page.waitForTimeout(400);
await shot('06-hint');
await page.click('button[aria-label="So geht’s"]');
await page.waitForSelector('.tut-card');
await page.click('.tut-skip');
await page.waitForFunction(() => !document.querySelector('.tut-backdrop'));

// ---------- 5. Zurück ins Menü, Entspannt-Modus ----------
step('Entspannt');
await page.click('.topbar a.icon-btn');
await page.waitForSelector('.gm-primary');
assert.match(await page.textContent('.gm-primary'), /Weiterspielen/);
await page.click('.gm-seg button[data-id="endless"]');
await page.click('.gm-primary');
await page.waitForFunction(() => location.hash === '#endless');
await page.waitForTimeout(1500);
await playUntil('spielpause.bubbles.endless', async () => (await savedEndless()).shotsUsed >= 3, 6);
await page.waitForTimeout(1000);
await shot('07-endless');
await noScroll();
const e1 = await savedEndless();
await page.reload();
await page.waitForSelector('.bz-canvas');
await page.waitForTimeout(600);
assert.equal((await savedEndless()).shotsUsed, e1.shotsUsed, 'Entspannt-Runde nach Neuladen erhalten');

// ---------- 6. Levelkarte & Statistik ----------
step('Levelkarte');
await page.evaluate(() => { location.hash = '#map'; });
await page.waitForSelector('.bz-world');
const lvButtons = await page.$$eval('.bz-lv', (els) => els.length);
assert.ok(lvButtons >= 150, `mind. 150 Level auf der Karte (${lvButtons})`);
await page.waitForTimeout(300);
await shot('08-map');
await page.click('.topbar a.icon-btn');
await page.waitForSelector('.gm-primary');
await page.click('.gm-sec:nth-child(2)');
await page.waitForSelector('.bz-stats');
await page.waitForTimeout(400);
await shot('09-stats');

await browser.close();
assert.deepEqual(errors, [], 'keine Konsolenfehler');
console.log('e2e ok');
