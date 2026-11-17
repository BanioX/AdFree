// Zusatz-Screenshots (375 px breit): helle Steine in der Ablage, lange Titel, Foto-Bildschirm.
//   node beads/tests/qa-shots.mjs   (Server auf Port 8106 muss laufen)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = new URL('./out/', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:8106/beads/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone SE'], viewport: { width: 375, height: 667 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.setItem('spielpause.tutorial.beads', 'true');
  localStorage.setItem('spielpause.beads.progress', JSON.stringify({ level: 36, done: {}, beads: 0, recent: [] }));
});
await page.goto(BASE + '#menu');
await sleep(800);
await page.screenshot({ path: OUT + 'qa-menu-375.png' });
// Cupcake: weisse Steine in die Ablage
const lvl = await page.evaluate(async () => (await import('./art/index.js')).patterns.findIndex((p) => p.id === 'cupcake') + 1);
await page.goto(BASE + '#play/' + lvl);
await page.waitForFunction(() => window.__beads && window.__beads.state);
const parked = await page.evaluate(async () => {
  const s = window.__beads.screen, g = s.game, L = g.L;
  const w = L.colors.findIndex((c) => c.toLowerCase() === '#ffffff');
  // ersten weissen Lauf vorne in einer Spalte suchen und antippen, bis er in der Ablage liegt
  for (let i = 0; i < 60; i++) {
    for (let k = 0; k < g.st.S; k++) if (g.st.slotK[k] === w) return true;
    const legal = g.legalColumns();
    const c = legal.find((c) => g.st.cols[c][g.st.ptr[c]] === w) ?? legal[0];
    s.tap(c);
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
});
await sleep(1200);
await page.screenshot({ path: OUT + 'qa-white-slot.png' });
console.log('weiss in Ablage:', parked, 'Level', lvl, 'Fehler:', errors.length ? errors : 'keine');
await browser.close();
