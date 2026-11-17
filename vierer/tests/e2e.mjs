// Browser-Test (iPhone-Breite): Menü, Partie, Zug, KI-Antwort, Neuladen.
//   python3 -m http.server 8765 --bind 127.0.0.1
//   node vierer/tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/vierer/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await page.addInitScript(() => localStorage.setItem('spielpause.tutorial.vierer', 'true'));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text())) return;
  errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await page.screenshot({ path: OUT + '01-menu.png' });

const scroll = await page.evaluate(() => ({
  sw: document.scrollingElement.scrollWidth,
  w: innerWidth,
  sh: document.scrollingElement.scrollHeight,
  h: innerHeight,
}));
assert.ok(scroll.sw <= scroll.w + 1, 'Seite nicht breiter als der Bildschirm');

await page.locator('.gm-primary').tap();
await page.waitForSelector('.c4');
await page.screenshot({ path: OUT + '02-board.png' });

const before = await page.evaluate(() => window.__sp.state().n);
const col = page.locator('.c4-col').nth(3);
const box = await col.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + 20);
await page.waitForFunction(() => window.__sp && window.__sp.state().n >= 2 && !window.__sp.busy(), null, { timeout: 8000 });
const after = await page.evaluate(() => {
  const s = window.__sp.state();
  return { n: s.n, turn: s.turn, h: s.h[3] };
});
assert.ok(after.n >= before + 2, 'Mensch und Computer haben gezogen');
assert.equal(after.turn, 1);
await page.screenshot({ path: OUT + '03-played.png' });

await page.reload();
await page.waitForSelector('.c4');
const kept = await page.evaluate(() => window.__sp.state().n);
assert.equal(kept, after.n, 'Partie bleibt nach dem Neuladen');

const nBeforeHint = await page.evaluate(() => window.__sp.state().n);
await page.locator('.bd-tool').nth(1).tap();
await page.waitForTimeout(400);
const hinted = await page.evaluate(() => ({
  n: window.__sp.state().n,
  ghost: !!document.querySelector('.c4-disc.ghost'),
}));
assert.equal(hinted.n, nBeforeHint, 'Tipp setzt keinen Stein');
assert.equal(hinted.ghost, true, 'Tipp hebt eine Reihe hervor');
await page.screenshot({ path: OUT + '04-hint.png' });

// iOS: pointerdown, dann pointercancel, danach nur click.
const ios = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ios.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.vierer', 'true');
  localStorage.removeItem('spielpause.vierer.match');
});
ios.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await ios.goto(BASE + '#play');
await ios.waitForSelector('.c4-col');
const placed = await ios.evaluate(() => {
  const col = document.querySelectorAll('.c4-col')[2];
  const r = col.getBoundingClientRect();
  // iOS schickt nach einem abgebrochenen Finger oft nur noch click.
  col.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + 24 }));
  return window.__sp.state().n;
});
assert.ok(placed >= 1, 'Klick ohne pointerup legt einen Stein');
await ios.close();

const narrow = await browser.newPage({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await narrow.addInitScript(() => localStorage.setItem('spielpause.tutorial.vierer', 'true'));
await narrow.goto(BASE + '#play');
await narrow.waitForSelector('.c4');
const fit = await narrow.evaluate(() => {
  const b = document.querySelector('.c4').getBoundingClientRect();
  const t = document.querySelector('.bd-tools').getBoundingClientRect();
  return { boardBottom: b.bottom, toolsTop: t.top, h: innerHeight, w: innerWidth, boardW: b.width };
});
assert.ok(fit.boardBottom <= fit.toolsTop + 2, 'Brett überdeckt die Werkzeuge nicht');
assert.ok(fit.toolsTop < fit.h, 'Werkzeuge sind sichtbar');
await narrow.screenshot({ path: OUT + '05-narrow.png' });

assert.deepEqual(errors, [], errors.join('\n'));
await browser.close();
console.log('e2e ok', after);
