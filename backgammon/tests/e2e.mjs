import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/backgammon/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.backgammon', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.bg-dice');
await page.screenshot({ path: OUT + '01-board.png' });
await page.locator('.bg-dice button').first().tap();
await page.waitForFunction(() => window.__sp.state().phase === 'move' && !window.__sp.busy());
const step = await page.evaluate(() => {
  const play = window.__sp.plays().find((p) => p.length);
  return play ? play[0] : null;
});
assert.ok(step);
const before = await page.evaluate((from) => (from === 'bar' ? window.__sp.state().barW : window.__sp.state().pts[from]), step.from);
if (step.from === 'bar') await page.locator('.bg-row.bot [data-from="bar"]').tap();
else await page.locator('.bg [data-i="' + step.from + '"]').tap();
if (step.to === 'off') await page.locator('[data-to="off"]').tap();
else await page.locator('.bg [data-i="' + step.to + '"]').tap();
await page.waitForFunction((arg) => {
  const s = window.__sp.state();
  const now = arg.from === 'bar' ? s.barW : s.pts[arg.from];
  return now < arg.before;
}, { from: step.from, before }, { timeout: 8000 });
await page.screenshot({ path: OUT + '02-moved.png' });

await page.waitForTimeout(650);
const more = await page.evaluate(() => {
  const s = window.__sp.state();
  if (s.turn !== 1 || s.phase !== 'move') return null;
  const play = window.__sp.plays().find((p) => p.length);
  return play ? play[0] : null;
});
if (more) {
  const fromSel = more.from === 'bar' ? '.bg-row.bot [data-from="bar"]' : '.bg [data-i="' + more.from + '"]';
  const toSel = more.to === 'off' ? '[data-to="off"]' : '.bg [data-i="' + more.to + '"]';
  const had = await page.evaluate((from) => (from === 'bar' ? window.__sp.state().barW : window.__sp.state().pts[from]), more.from);
  await page.locator(fromSel).evaluate((el) => el.click());
  await page.locator(toSel).evaluate((el) => el.click());
  await page.waitForFunction((arg) => {
    const s = window.__sp.state();
    const now = arg.from === 'bar' ? s.barW : s.pts[arg.from];
    return !window.__sp.busy() && now < arg.had;
  }, { from: more.from, had }, { timeout: 12000 });
}

await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.backgammon.match'));
await page.reload();
await page.locator('.gm-primary').tap();
await page.waitForSelector('.bd-status');
assert.match(await page.locator('.bd-status').innerText(), /Roll/);
assert.match(await page.locator('.bd-title b').innerText(), /Backgammon/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
await page.screenshot({ path: OUT + '03-en.png' });
assert.deepEqual(errors, []);
await browser.close();
console.log('backgammon e2e ok');
