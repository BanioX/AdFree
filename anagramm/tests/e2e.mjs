import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/anagramm/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.anagramm', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ag-tiles');
await page.screenshot({ path: OUT + '01.png' });
const word = await page.evaluate(() => window.__sp.state().word);
const first = await page.evaluate((ch) => {
  const s = window.__sp.state();
  return s.tiles.findIndex((c) => c === ch);
}, word[0]);
await page.locator('.ag-tiles button[data-i="' + first + '"]').tap();
await page.waitForFunction(() => window.__sp.current().length === 1);
await page.waitForTimeout(650);
const second = await page.evaluate((ch) => {
  const s = window.__sp.state();
  return s.tiles.findIndex((c, i) => c === ch && !s.picked.includes(i));
}, word[1]);
await page.locator('.ag-tiles button[data-i="' + second + '"]').evaluate((el) => el.click());
await page.waitForFunction(() => window.__sp.current().length === 2);
for (const ch of [...word].slice(2)) {
  const i = await page.evaluate((letter) => {
    const s = window.__sp.state();
    return s.tiles.findIndex((c, n) => c === letter && !s.picked.includes(n));
  }, ch);
  const before = await page.evaluate(() => window.__sp.state().picked.length);
  await page.locator('.ag-tiles button[data-i="' + i + '"]').tap();
  await page.waitForFunction((n) => window.__sp.state().picked.length > n, before);
}
await page.waitForFunction(() => window.__sp.current() === window.__sp.state().word);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.anagramm.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Anagram/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('anagramm e2e ok', word);
