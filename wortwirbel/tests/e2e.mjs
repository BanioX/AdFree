import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/wortwirbel/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.wortwirbel', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

async function trace(word, how) {
  const path = await page.evaluate((w) => window.__sp.pathOf(w), word);
  for (const i of path) {
    const btn = page.locator('.ww-grid button[data-i="' + i + '"]');
    if (how === 'click') await btn.evaluate((el) => el.click());
    else await btn.tap();
  }
  if (how === 'click') await page.locator('[data-act="ok"]').evaluate((el) => el.click());
  else await page.locator('[data-act="ok"]').tap();
}

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ww-grid');
await page.screenshot({ path: OUT + '01.png' });
const words = await page.evaluate(() => window.__sp.state().words);
assert.ok(words.length >= 2);
await trace(words[0], 'tap');
await page.waitForFunction((w) => window.__sp.state().found.includes(w), words[0]);
await page.waitForTimeout(650);
await trace(words[1], 'click');
await page.waitForFunction((w) => window.__sp.state().found.includes(w), words[1]);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.wortwirbel.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Word Swirl/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('wortwirbel e2e ok', words[0]);
