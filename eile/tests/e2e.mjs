import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/eile/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.eile', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await page.screenshot({ path: OUT + '01-menu.png' });
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ey-die');
await page.screenshot({ path: OUT + '02-board.png' });
const before = await page.evaluate(() => JSON.stringify(window.__sp.state()));
await page.locator('.ey-die').tap();
await page.waitForFunction((prev) => {
  const s = window.__sp && window.__sp.state();
  if (!s || window.__sp.busy()) return false;
  return JSON.stringify(s) !== prev;
}, before, { timeout: 12000 });
if (await page.locator('.ey-pc.on').count()) await page.locator('.ey-pc.on').first().tap();
await page.waitForFunction(() => !window.__sp.busy());
for (let n = 0; n < 30; n++) {
  const onTrack = await page.evaluate(() => window.__sp.state().p.some((row) => row.some((s) => s >= 0)));
  if (onTrack) break;
  await page.waitForFunction(() => !window.__sp.busy());
  const choice = await page.locator('.ey-pc.on').count();
  if (choice) await page.locator('.ey-pc.on').first().tap();
  else await page.locator('.ey-die').tap();
  await page.waitForFunction(() => !window.__sp.busy(), null, { timeout: 12000 });
}
await page.screenshot({ path: OUT + '03-played.png' });
await page.waitForTimeout(650);
const clickOnly = await page.evaluate(() => {
  const s = window.__sp.state();
  if (s.turn !== 0 || s.phase !== 'roll' || s.over) return true;
  const beforeTurn = s.turn + ':' + s.phase + ':' + s.dice;
  document.querySelector('.ey-die').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const n = window.__sp.state();
  return n.dice > 0 || n.phase !== 'roll' || n.turn !== 0 || (n.turn + ':' + n.phase + ':' + n.dice) !== beforeTurn;
});
assert.equal(clickOnly, true, 'Klick auf den Würfel würfelt');
const fit = await page.evaluate(() => {
  const b = document.querySelector('.ey').getBoundingClientRect();
  const t = document.querySelector('.bd-tools').getBoundingClientRect();
  return b.left >= -1 && b.right <= innerWidth + 1 && b.bottom <= t.top + 2 && t.bottom <= innerHeight + 1;
});
assert.equal(fit, true);
await page.evaluate(() => localStorage.setItem('spielpause.lang', JSON.stringify('en')));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.eile.match'));
await page.reload();
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ey-die');
assert.match(await page.locator('.ey-die').innerText(), /Roll/);
assert.match(await page.locator('.bd-status').innerText(), /Roll/);
await page.screenshot({ path: OUT + '04-en.png' });
assert.deepEqual(errors, []);
await browser.close();
console.log('eile e2e ok');
