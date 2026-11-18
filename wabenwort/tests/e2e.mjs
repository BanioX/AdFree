import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/wabenwort/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.wabenwort', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

async function lay(word, how) {
  for (const ch of word) {
    const btn = page.locator('.hb-hive button[data-ch="' + ch + '"]').first();
    if (how === 'click') await btn.evaluate((el) => el.click());
    else await btn.tap();
  }
  if (how === 'click') await page.locator('[data-act="ok"]').evaluate((el) => el.click());
  else await page.locator('[data-act="ok"]').tap();
}

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.hb-hive');
const words = await page.evaluate(() => window.__sp.words());
assert.ok(words.length >= 2);
await page.screenshot({ path: OUT + '01.png' });
await lay(words[0], 'tap');
await page.waitForFunction((w) => window.__sp.state().found.includes(w), words[0]);
await page.waitForTimeout(650);
await lay(words[1], 'click');
await page.waitForFunction((w) => window.__sp.state().found.includes(w), words[1]);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.wabenwort.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Honeycomb/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
await page.screenshot({ path: OUT + '02-en.png' });
assert.deepEqual(errors, []);
await browser.close();
console.log('wabenwort e2e ok');
