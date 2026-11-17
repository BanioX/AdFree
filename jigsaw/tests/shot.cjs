// Hilfswerkzeug: Screenshot einer Seite. node shot.cjs URL out.png [w] [h]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = '1000', h = '1400'] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url);
  await p.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 30000 }).catch(() => {});
  console.log(await p.title());
  await p.screenshot({ path: out, fullPage: true });
  if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
