// Hilfsskript: Screenshots einzelner Ansichten.  node nonogram/tests/shot.cjs '#hash' name [setup-js]
const { chromium, devices } = require('playwright');
(async () => {
  const [hash = '', name = 'shot', setup = ''] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEV || 'iPhone 13'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8205/nonogram/');
  await page.evaluate((s) => { localStorage.setItem('spielpause.nonogram.settings', JSON.stringify({ helpSeen: true, zoomTip: true, autoCross: true, timer: true })); if (s) eval(s); }, setup);
  await page.goto('http://127.0.0.1:8205/nonogram/' + hash);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `nonogram/tests/out/${name}.png` });
  console.log(errs.length ? 'ERR ' + errs.join('\n') : 'ok');
  await browser.close();
})();
