// Zusätzliche Ansichten für die Sichtprüfung (Screenshots in tests/out/): node jigsaw/tests/shots.mjs
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./out/', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:8223/jigsaw/';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.setItem('spielpause.tutorial.jigsaw', 'true'));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const which = process.argv[2] || 'all';
if (which === 'all' || which === 'menu') {
  await p.goto(BASE);
  await p.waitForSelector('.pz-pack');
  await p.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 620));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + 'menu-packs.png' });
  await p.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 99999));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: OUT + 'menu-bottom.png' });
}
if (which === 'all' || which === 'big') {
  await p.goto(BASE + '#play/wiesen%2Fmohnfeld@108');
  await p.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 20000 });
  // einige Teile direkt per Logik legen und ein paar lose verteilen (nur für die Ansicht)
  await p.evaluate(() => {
    const s = window.__jigsaw.state();
    const ids = s.tray.slice(0, 26);
    window.__jigsaw.debugPlace(ids.slice(0, 20), ids.slice(20));
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'big-108.png' });
  await p.evaluate(() => window.__jigsaw.zoom(2.4));
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'big-108-zoom.png' });
}
if (which === 'all' || which === 'paint') {
  await p.goto(BASE + '#play/farben%2Fa-rose@24');
  await p.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 20000 });
  await p.evaluate(() => { const s = window.__jigsaw.state(); window.__jigsaw.debugPlace(s.tray.slice(0, 10), s.tray.slice(10, 13)); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'paint-24.png' });
}
if (errs.length) console.log('ERRORS', errs.slice(0, 6));
await b.close();
