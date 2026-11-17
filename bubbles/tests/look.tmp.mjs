import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const OUT = '/home/user/AdFree/bubbles/tests/out/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const steps = process.argv.slice(2);
await page.goto('http://127.0.0.1:8222/bubbles/');
await page.waitForTimeout(600);
for (const s of steps) {
  if (s.startsWith('shot:')) { await page.screenshot({ path: OUT + s.slice(5) + '.png' }); }
  else if (s.startsWith('wait:')) await page.waitForTimeout(+s.slice(5));
  else if (s.startsWith('click:')) await page.locator(s.slice(6)).first().click();
  else if (s.startsWith('hash:')) await page.evaluate((h) => { location.hash = h; }, s.slice(5));
  else if (s.startsWith('eval:')) console.log(await page.evaluate(s.slice(5)));
  else if (s.startsWith('tap:')) { const [x, y] = s.slice(4).split(',').map(Number); await page.touchscreen.tap(x, y); }
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
