import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/emoji/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.emoji', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

function indexFor(state, ch, used) {
  return state.bank.findIndex((letter, i) => letter === ch && !used.includes(i));
}

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ey-bank');
await page.screenshot({ path: OUT + '01.png' });
const first = await page.evaluate(() => window.__sp.state());
const i0 = indexFor(first, first.word[0], []);
await page.locator('.ey-bank button[data-i="' + i0 + '"]').tap();
await page.waitForFunction(() => window.__sp.state().picks.length === 1);
await page.waitForTimeout(650);
const mid = await page.evaluate(() => window.__sp.state());
const i1 = indexFor(mid, mid.word[1], mid.picks);
await page.locator('.ey-bank button[data-i="' + i1 + '"]').evaluate((el) => el.click());
await page.waitForFunction(() => window.__sp.state().picks.length === 2);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.emoji.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Emoji Riddle/);
const en = await page.evaluate(() => window.__sp.state());
assert.equal(en.which, 'en');
assert.ok(/^[A-Z]+$/.test(en.word));
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('emoji e2e ok', first.word, en.word);
