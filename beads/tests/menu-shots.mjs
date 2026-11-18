// Perlenbild – Screenshots von Startbildschirm, Tutorial und Coach-Mark (iPhone 13, DSF 1).
//   python3 -m http.server 8132 --bind 127.0.0.1   (aus dem Repo-Wurzelverzeichnis)
//   node beads/tests/menu-shots.mjs [nur-diese-namen,…]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = new URL('./out/', import.meta.url).pathname;
const BASE = `http://127.0.0.1:${process.env.PORT || 8132}/beads/`;
const only = process.argv[2] ? process.argv[2].split(',') : null;
const want = (n) => !only || only.includes(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errors = [];
async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });

if (want('fresh') || want('tut')) {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE);
  await page.waitForSelector('.tut-title');
  for (let i = 0; i < 4; i++) {
    await sleep(i === 0 ? 2300 : 2000);
    if (want('tut')) await shot(page, `tut-${i + 1}`);
    if (i < 3) await page.locator('.tut-next').click();
  }
  await page.locator('.tut-next').click();
  await sleep(600);
  if (want('fresh')) await shot(page, 'menu-fresh');
  await ctx.close();
}
if (want('coach')) {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('spielpause.tutorial.beads', 'true'));
  await page.goto(BASE + '#play/1');
  await page.waitForSelector('.bp-coach');
  await sleep(900);
  await shot(page, 'coach-level1');
  await ctx.close();
}
if (want('progress') || want('se')) {
  for (const [name, vp] of [['progress', null], ['se', { width: 375, height: 667 }]]) {
    if (!want(name)) continue;
    const { ctx, page } = await ctxPage(vp ? { viewport: vp } : {});
    await page.goto(BASE);
    await page.evaluate(async () => {
      const lib = (await import('./art/index.js')).patterns;
      const done = {};
      lib.slice(0, 11).forEach((e, i) => { done[e.id] = i % 3 === 1 ? 2 : 3; });
      localStorage.setItem('spielpause.tutorial.beads', 'true');
      localStorage.setItem('spielpause.beads.progress', JSON.stringify({ level: 12, done, beads: 2140, recent: lib.slice(6, 11).map((e) => e.id).reverse() }));
    });
    await page.goto(BASE + '#play/12');
    await page.waitForFunction(() => window.__beads && window.__beads.state);
    await page.evaluate(async () => { for (let i = 0; i < 14; i++) { const c = window.__beads.solverMove(20000); if (c < 0) break; window.__beads.screen.tap(c); } window.__beads.screen.flush(); });
    await page.goto(BASE + '#menu');
    await sleep(1200);
    await shot(page, 'menu-' + name);
    if (name === 'progress') { await page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 9999)); await sleep(400); await shot(page, 'menu-progress-bottom'); }
    const vis = await page.evaluate(() => { const r = document.querySelector('.gm-primary').getBoundingClientRect(); return r.bottom <= innerHeight; });
    console.log(name, 'Hauptknopf sichtbar:', vis);
    await ctx.close();
  }
}
console.log('Fehler:', errors.length ? errors : 'keine');
await browser.close();
