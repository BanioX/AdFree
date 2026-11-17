// Screenshots für die visuelle Kontrolle (Startbildschirm, Tutorial, Coach-Mark, Lob, Bonus).
// Voraussetzung: python3 -m http.server 8142 --bind 127.0.0.1 (Repo-Wurzel)
// Ausführen: node wordsearch/tests/screens.mjs   → wordsearch/tests/out/s-*.png

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8142/wordsearch/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const errors = [];

async function open(browser, viewport) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, ...(viewport ? { viewport } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });

const browser = await chromium.launch();
try {
  // 1) Frische Installation: Tutorial-Schritte mitten in der Animation
  const a = await open(browser);
  await a.page.goto(BASE);
  await a.page.waitForSelector('.tut-stage');
  const waits = [1900, 5200, 6200, 1500];
  for (let i = 0; i < 4; i++) {
    await a.page.waitForTimeout(waits[i]);
    await shot(a.page, `s-tut-${i + 1}`);
    await a.page.locator('.tut-next').click();
  }
  await a.page.waitForTimeout(500);
  await shot(a.page, 's-menu-fresh');
  // 2) Erstes Rätsel: Coach-Mark
  await a.page.locator('.gm-primary').click();
  await a.page.waitForFunction(() => window.__wordsearch);
  await a.page.waitForTimeout(1300);
  await shot(a.page, 's-coach');
  // 3) Lob: zwei Wörter schnell hintereinander
  await a.page.evaluate(() => { window.__wordsearch.solveWord(0); });
  await a.page.waitForTimeout(250);
  await a.page.evaluate(() => { window.__wordsearch.solveWord(1); });
  await a.page.waitForTimeout(260);
  await shot(a.page, 's-praise');
  await a.page.evaluate(() => window.__wordsearch.solveAll());
  await a.page.waitForTimeout(2600);
  await shot(a.page, 's-win');
  await a.ctx.close();

  // 4) Menü mit Fortschritt + Bonusrätsel
  const b = await open(browser);
  await b.page.goto(BASE);
  await b.page.evaluate(async () => {
    localStorage.setItem('spielpause.tutorial.wordsearch', 'true');
    localStorage.setItem('spielpause.wordsearch.coachDone', 'true');
    const { themes } = await import('./data/themes.js');
    const prog = {};
    themes.slice(0, 40).forEach((t, i) => { if (i % 3 !== 1) prog[t.id] = { leicht: { w: 1, s: 1 + (i % 3) } }; });
    localStorage.setItem('spielpause.wordsearch.progress', JSON.stringify(prog));
    localStorage.setItem('spielpause.wordsearch.stats', JSON.stringify({ played: 30, won: 27, words: 290, stars: 61, hints: 9, time: 3600000, best: {}, wonBy: {}, perfect: 12, bonus: 4, combo: 5 }));
    localStorage.setItem('spielpause.wordsearch.seq', '29');
    localStorage.setItem('spielpause.wordsearch.settings', JSON.stringify({ mode: 'mittel' }));
  });
  await b.page.reload();
  await b.page.waitForSelector('.gm-primary');
  // Bonusrätsel (seq 30) starten, ein paar Wörter + Bonus finden, zurück ins Menü
  await b.page.locator('.gm-primary').click();
  await b.page.waitForFunction(() => window.__wordsearch);
  await b.page.waitForTimeout(500);
  await b.page.evaluate(() => { const w = window.__wordsearch; w.solveWord(0); w.solveWord(1); w.solveWord(2); w.state.elapsed = 74000; });
  await b.page.waitForTimeout(400);
  await b.page.evaluate(() => window.__wordsearch.solveBonus());
  await b.page.waitForTimeout(300);
  await shot(b.page, 's-bonus');
  await b.page.locator('.topbar .icon-btn').first().click();
  await b.page.waitForSelector('.gm-primary');
  await b.page.waitForTimeout(600);
  await shot(b.page, 's-menu-progress');
  await b.page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 99999));
  await b.page.waitForTimeout(300);
  await shot(b.page, 's-menu-progress-bottom');
  await b.ctx.close();

  // 5) Kleiner Bildschirm 375×667 (frisch, Tutorial gesehen)
  const c = await open(browser, { width: 375, height: 667 });
  await c.page.goto(BASE);
  await c.page.evaluate(() => localStorage.setItem('spielpause.tutorial.wordsearch', 'true'));
  await c.page.reload();
  await c.page.waitForSelector('.gm-primary');
  await c.page.waitForTimeout(700);
  const r = await c.page.evaluate(() => document.querySelector('.gm-primary').getBoundingClientRect().bottom);
  console.log('375×667: Hauptknopf unten bei', Math.round(r), 'px', r <= 667 ? '✓' : '✗');
  await shot(c.page, 's-menu-375x667');
  await c.ctx.close();

  console.log(errors.length ? 'Fehler:\n' + errors.join('\n') : 'keine Konsolenfehler ✓');
} finally {
  await browser.close();
}
