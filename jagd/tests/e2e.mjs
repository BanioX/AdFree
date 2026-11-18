import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/jagd/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.jagd', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.jg-keys');
await page.screenshot({ path: OUT + '01.png' });
const word = await page.evaluate(() => window.__sp.state().word);
const letters = [...new Set(word)];
await page.locator('.jg-keys button[data-ch="' + letters[0] + '"]').tap();
await page.waitForFunction((ch) => window.__sp.state().guesses.includes(ch), letters[0]);
await page.waitForTimeout(650);
if (letters[1]) {
  await page.locator('.jg-keys button[data-ch="' + letters[1] + '"]').evaluate((el) => el.click());
  await page.waitForFunction((ch) => window.__sp.state().guesses.includes(ch), letters[1]);
}
for (const ch of letters.slice(2)) {
  await page.locator('.jg-keys button[data-ch="' + ch + '"]').tap();
  await page.waitForFunction((c) => window.__sp.state().guesses.includes(c), ch);
}
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto('http://127.0.0.1:8765/jagd/');
await page.evaluate(() => localStorage.removeItem('spielpause.jagd.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Letter Hunt/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('jagd e2e ok', word);
