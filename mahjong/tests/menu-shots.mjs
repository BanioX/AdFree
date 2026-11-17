// Screenshots von Startbildschirm, Tutorial und Coach-Mark (zum Anschauen, kein Pass/Fail).
//
//   python3 -m http.server 8135 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node mahjong/tests/menu-shots.mjs [teile]       teile: all | fresh,tut,coach,progress,small,dark
//
// Umgebungsvariablen: BASE (Standard http://127.0.0.1:8135), SHOTS (Standard mahjong/tests/out).

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8135';
const OUT = process.env.SHOTS || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
mkdirSync(OUT, { recursive: true });
const which = (process.argv[2] || 'all').split(',');
const has = (k) => which.includes('all') || which.includes(k);

const browser = await chromium.launch();
const errors = [];
async function mk(viewport) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, ...(viewport ? { viewport } : {}) });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

/** Fortschritt einspielen: 7 Layouts mit Sternen, ein laufendes Spiel. */
async function seedProgress(page, { running = true, stars } = {}) {
  await page.evaluate(async ({ running, stars }) => {
    localStorage.setItem('spielpause.tutorial.mahjong', 'true');
    localStorage.setItem('spielpause.mahjong.coached', 'true');
    localStorage.setItem('spielpause.mahjong.stats', JSON.stringify({ played: 14, won: 11, pairs: 600, best: { klein: 95, mittel: 260 }, streak: 3, bestStreak: 5 }));
    const { layouts } = await import('/mahjong/data/layouts.js');
    const levels = {};
    const st = stars || [3, 3, 2, 3, 1, 2, 3];
    st.forEach((s, i) => { levels[layouts[i].id] = { stars: s, best: 80 + i * 20, wins: 1, plays: 1 }; });
    localStorage.setItem('spielpause.mahjong.progress', JSON.stringify({ levels }));
    if (running) {
      const { parseLayout } = await import('/mahjong/engine.js');
      const { Session } = await import('/mahjong/game.js');
      const def = layouts[7];
      const s = Session.create(parseLayout(def), { kind: 'level', ref: def.id, seed: def.id + '-1', name: def.name });
      for (let k = 0; k < 14 && s.cert && s.cert.length; k++) { const [a, b] = s.cert[0]; s.match(a, b); }
      s.elapsed = 151;
      localStorage.setItem('spielpause.mahjong.cur', JSON.stringify(s.serialize()));
    }
  }, { running, stars });
}

if (has('fresh') || has('tut') || has('coach')) {
  const page = await mk();
  await page.goto(BASE + '/mahjong/');
  await page.locator('.tut-backdrop.show').waitFor({ timeout: 4000 });
  if (has('tut')) {
    const at = [1500, 3650, 1900, 1700];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(at[i]);
      await shot(page, `tut-${i + 1}`);
      await page.locator('.tut-next').click();
      await page.waitForTimeout(300);
    }
  } else {
    await page.locator('.tut-skip').click();
  }
  await page.waitForTimeout(600);
  await shot(page, 'menu-fresh');
  if (has('coach')) {
    await page.locator('.gm-primary').click();
    await page.waitForTimeout(2300);
    await shot(page, 'coach-level1');
  }
}
if (has('progress')) {
  const page = await mk();
  await page.goto(BASE + '/mahjong/');
  await seedProgress(page);
  await page.reload();
  await page.waitForTimeout(900);
  await shot(page, 'menu-progress');
  await page.locator('.gm-scroll').evaluate((e) => e.scrollTo(0, 9999));
  await page.waitForTimeout(400);
  await shot(page, 'menu-progress-bottom');
}
if (has('dark')) {
  const page = await mk();
  await page.goto(BASE + '/mahjong/');
  await seedProgress(page, { stars: Array(15).fill(3) });
  await page.evaluate(() => localStorage.setItem('spielpause.mahjong.settings', JSON.stringify({ tileset: 'tiere', table: 'nacht' })));
  await page.reload();
  await page.waitForTimeout(900);
  await shot(page, 'menu-dark-table');
  await page.locator('.gm-primary').click();
  await page.waitForTimeout(1200);
  await shot(page, 'game-dark-table');
}
if (has('small')) {
  const page = await mk({ width: 375, height: 667 });
  await page.goto(BASE + '/mahjong/');
  await page.evaluate(() => localStorage.setItem('spielpause.tutorial.mahjong', 'true'));
  await page.reload();
  await page.waitForTimeout(900);
  await shot(page, 'menu-375x667');
  const r = await page.locator('.gm-primary').boundingBox();
  console.log('Hauptknopf 375x667:', Math.round(r.y), '–', Math.round(r.y + r.height), r.y + r.height <= 667 ? '(sichtbar)' : '(NICHT sichtbar)');
}
console.log(errors.length ? 'Konsolenfehler: ' + errors.join(' | ') : 'Keine Konsolenfehler');
await browser.close();
if (errors.length) process.exitCode = 1;
