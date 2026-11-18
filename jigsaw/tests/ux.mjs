// Sichtprüfung Startbildschirm & Anleitung (Screenshots in tests/out/ux-*.png)
//   Server (Repo-Wurzel): python3 -m http.server 8146 --bind 127.0.0.1
//   Start: node jigsaw/tests/ux.mjs [all|tut|menu|coach|small|en]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8146/jigsaw/';
const which = process.argv[2] || 'all';
const want = (k) => which === 'all' || which === k;
const errs = [];

const b = await chromium.launch();
async function newPage(opts = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, locale: opts.locale || 'de-CH', ...(opts.viewport ? { viewport: opts.viewport } : {}) });
  if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  return p;
}

// Fortschritt: ein paar gelöste Bilder, ein angefangenes Puzzle
const progress = () => {
  const set = (k, v) => localStorage.setItem('spielpause.' + k, JSON.stringify(v));
  set('tutorial.jigsaw', true);
  set('jigsaw.done', { 'berge/alpenglut': [12, 24], 'berge/sommertag': [12], 'berge/nebelmorgen': [24], 'wiesen/mohnfeld': [12], 'meer/abendrot': [24] });
  set('jigsaw.stats', { started: 7, won: 6, pieces: 108, time: 1500000, best: { 12: 61000, 24: 245000 }, days: { last: null, count: 3, max: 4 } });
};

if (want('tut')) {
  const p = await newPage();
  await p.goto(BASE);
  await p.waitForSelector('.tut-card');
  for (let i = 1; i <= 4; i++) {
    await p.waitForTimeout(i === 1 ? 1500 : 1700);
    await p.screenshot({ path: `${OUT}ux-tut-${i}.png` });
    if (i < 4) await p.locator('.tut-next').tap();
  }
  await p.locator('.tut-next').tap();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}ux-menu-fresh.png` });
  if (want('coach') || which === 'tut') {
    await p.locator('.gm-primary').tap();
    await p.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}ux-coach.png` });
  }
  await p.context().close();
}

if (want('menu')) {
  const p = await newPage({ init: progress });
  await p.goto(BASE);
  await p.waitForSelector('.gm-primary');
  // ein Puzzle anfangen und ein paar Teile legen
  await p.locator('.gm-primary').tap();
  await p.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  await p.evaluate(() => { const s = window.__jigsaw.state(); window.__jigsaw.debugPlace(s.tray.slice(0, 9), s.tray.slice(9, 11)); });
  await p.waitForTimeout(500);
  await p.locator('.pz-top a.icon-btn').tap();
  await p.waitForSelector('.gm-primary');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}ux-menu-progress.png` });
  await p.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 560));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}ux-menu-progress-2.png` });
  await p.context().close();
}

if (want('small')) {
  const p = await newPage({ viewport: { width: 375, height: 667 }, init: () => localStorage.setItem('spielpause.tutorial.jigsaw', 'true') });
  await p.goto(BASE);
  await p.waitForSelector('.gm-primary');
  await p.waitForTimeout(900);
  const r = await p.locator('.gm-primary').boundingBox();
  console.log('375x667 Hauptknopf unten bei', Math.round(r.y + r.height), r.y + r.height <= 667 ? 'OK' : 'NICHT SICHTBAR');
  await p.screenshot({ path: `${OUT}ux-menu-375.png` });
  await p.context().close();
}

if (want('en')) {
  const p = await newPage({ locale: 'en-US', init: progress });
  await p.goto(BASE);
  await p.waitForSelector('.gm-primary');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}ux-menu-en.png` });
  await p.locator('.gm-howto').tap();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}ux-tut-en.png` });
  await p.context().close();
}

console.log(errs.length ? 'FEHLER: ' + errs.slice(0, 6).join(' | ') : 'keine Konsolenfehler');
await b.close();
