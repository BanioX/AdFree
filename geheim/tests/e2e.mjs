import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/geheim/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.geheim', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.gs-line');
await page.screenshot({ path: OUT + '01.png' });
const pair = await page.evaluate(() => {
  const s = window.__sp.state();
  const symbol = Object.values(s.code).find((sym) => s.guess[sym] == null);
  const plain = Object.entries(s.code).find(([, sym]) => sym === symbol)[0];
  return { symbol, plain };
});
await page.locator('.gs-line button[data-sym="' + pair.symbol + '"]').first().tap();
await page.locator('.gs-keys button[data-plain="' + pair.plain + '"]').tap();
await page.waitForFunction((p) => window.__sp.state().guess[p.symbol] === p.plain, pair);
await page.waitForTimeout(650);
const pair2 = await page.evaluate(() => {
  const s = window.__sp.state();
  const symbol = Object.values(s.code).find((sym) => s.guess[sym] == null);
  if (!symbol) return null;
  const plain = Object.entries(s.code).find(([, sym]) => sym === symbol)[0];
  return { symbol, plain };
});
if (pair2) {
  await page.locator('.gs-line button[data-sym="' + pair2.symbol + '"]').first().evaluate((el) => el.click());
  await page.locator('.gs-keys button[data-plain="' + pair2.plain + '"]').evaluate((el) => el.click());
  await page.waitForFunction((p) => window.__sp.state().guess[p.symbol] === p.plain, pair2);
}
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.geheim.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Secret Script/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('geheim e2e ok');
