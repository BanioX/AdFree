// Ablauf-Test «Puzzle» (Playwright, iPhone 13):
//   Anleitung beim ersten Start → Startbildschirm → 12er-Puzzle per Touch-Ziehen lösen
//   → Neuladen setzt den Stand fort → Gewinn-Blatt → zurück im Menü mit Statistik. Keine Konsolenfehler.
//
//   Server (Repo-Wurzel):  python3 -m http.server 8223 --bind 127.0.0.1
//   Start:                 node jigsaw/tests/e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8223/jigsaw/';

const errors = [];
let failed = false;
function check(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.log('  ✗', msg); failed = true; }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { errors.push('console: ' + m.text()); if (process.env.DEBUG) console.log('    [console error]', m.text().slice(0, 60)); } });
const cdp = await ctx.newCDPSession(page);
if (process.env.DEBUG) { await ctx.addInitScript(() => document.addEventListener('touchend', (e) => { if (!e.cancelable) console.log('NONCANCEL touchend on ' + (e.target.className || e.target.tagName) + ' touches=' + e.touches.length + ' changed=' + e.changedTouches.length); }, true)); page.on('console', (m) => { if (m.text().startsWith('NONCANCEL')) console.log('    ' + m.text()); }); }

const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y })) });

async function touchDrag(from, to, steps = 10) {
  await touch('touchStart', [from]);
  await page.waitForTimeout(16);
  // zuerst klar nach oben (aus der Leiste heben), dann zum Ziel
  const up = { x: from.x, y: from.y - 24 };
  await touch('touchMove', [up]);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    await touch('touchMove', [{ x: up.x + (to.x - up.x) * t, y: up.y + (to.y - up.y) * t }]);
    await page.waitForTimeout(8);
  }
  await touch('touchEnd', []);
}

async function placeFromTray(i) {
  const from = await page.evaluate((k) => window.__jigsaw.trayPoint(k), i);
  if (!from) throw new Error('Teil nicht in der Leiste: ' + i);
  await page.waitForTimeout(40);
  const again = await page.evaluate((k) => window.__jigsaw.trayPoint(k), i);
  const target = await page.evaluate((k) => window.__jigsaw.targetPoint(k), i);
  const lift = await page.evaluate(() => window.__jigsaw.lift());
  await touchDrag(again, { x: target.x, y: target.y + lift });
  await page.waitForTimeout(260);
}

const placed = () => page.evaluate(() => window.__jigsaw.state().pieces.filter((p) => p.s === 2).length);

try {
  console.log('Startbildschirm & Anleitung');
  await page.goto(BASE);
  await page.waitForSelector('.tut-card', { timeout: 8000 });
  check(true, 'Anleitung erscheint beim ersten Start');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, 'e2e-1-tutorial.png') });
  await page.getByRole('button', { name: /Überspringen/ }).tap();
  await page.waitForSelector('.gm-primary');
  await page.waitForTimeout(900);
  check(await page.locator('.gm-title', { hasText: 'Puzzle' }).count() === 1, 'Menü mit Titel');
  check(await page.locator('.pz-pack').count() >= 9, 'Bilder-Packs werden angezeigt');
  await page.screenshot({ path: path.join(OUT, 'e2e-2-menu.png') });

  console.log('Puzzle mit 12 Teilen');
  await page.locator('.gm-seg button', { hasText: /^12$/ }).tap();
  await page.waitForTimeout(400);
  await page.locator('.gm-primary').tap();
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  check(/#play\//.test(page.url()), 'Hash-Route #play/…');
  const n = await page.evaluate(() => window.__jigsaw.geo().count);
  check(n === 12, `12 Teile (ist ${n})`);
  check(await page.locator('.pz-coach').count() === 1, 'Hinweis am ersten Teil beim ersten Spiel');
  await page.waitForTimeout(400);
  await page.locator('.pz-chip[data-id="alle"]').tap();
  await page.waitForTimeout(400);
  const order = await page.evaluate(() => window.__jigsaw.state().tray.slice());

  // eins auf den Tisch legen (nicht am Ziel) – bleibt lose liegen
  const first = order[0];
  const from0 = await page.evaluate((k) => window.__jigsaw.trayPoint(k), first);
  const t0 = await page.evaluate((k) => window.__jigsaw.targetPoint(k), first);
  // weit weg vom eigenen Platz ablegen
  await touchDrag(from0, { x: t0.x < 195 ? 310 : 80, y: t0.y < 300 ? 430 : 170 });
  await page.waitForTimeout(300);
  const loose = await page.evaluate(() => window.__jigsaw.state().order.length);
  check(loose === 1, 'Teil liegt lose auf dem Tisch');

  for (const i of order.slice(1, 6)) await placeFromTray(i);
  const p1 = await placed();
  check(p1 === 5, `5 Teile eingerastet (ist ${p1})`);
  await page.screenshot({ path: path.join(OUT, 'e2e-3-play.png') });

  console.log('Neuladen setzt fort');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check(await placed() === p1, 'Gleicher Stand nach dem Neuladen');
  check(await page.evaluate(() => window.__jigsaw.state().order.length) === 1, 'Loses Teil liegt noch auf dem Tisch');

  console.log('Fertig legen');
  await page.locator('.pz-chip[data-id="alle"]').tap();
  await page.waitForTimeout(400);
  const rest = await page.evaluate(() => window.__jigsaw.state().tray.slice());
  for (const i of rest) await placeFromTray(i);
  // loses Teil vom Tisch an seinen Platz ziehen
  const st = await page.evaluate(() => window.__jigsaw.state().order.slice());
  for (const i of st) {
    const pos = await page.evaluate((k) => ({ from: window.__jigsaw.piecePoint(k), to: window.__jigsaw.targetPoint(k) }), i);
    await touch('touchStart', [pos.from]);
    for (let k = 1; k <= 10; k++) await touch('touchMove', [{ x: pos.from.x + (pos.to.x - pos.from.x) * k / 10, y: pos.from.y + (pos.to.y - pos.from.y) * k / 10 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(300);
  }
  check(await placed() === 12, 'Alle 12 Teile eingerastet');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'e2e-4-finish.png') });
  await page.waitForSelector('.sp-modal .pz-win', { timeout: 6000 });
  await page.waitForTimeout(500);
  check(await page.locator('.sp-modal h2', { hasText: 'Geschafft' }).count() === 1, 'Gewinn-Blatt «Geschafft!»');
  await page.screenshot({ path: path.join(OUT, 'e2e-5-win.png') });

  console.log('Zurück ins Menü');
  await page.getByRole('button', { name: 'Zum Menü' }).tap();
  await page.waitForSelector('.gm-primary');
  await page.waitForTimeout(600);
  const won = await page.locator('.gm-stat').first().locator('b').textContent();
  check(won === '1', `Statistik «Gelegt» = 1 (ist ${won})`);
  check(await page.locator('.pz-badge.done').count() >= 1, 'Gelöst-Abzeichen am Bild');
  const summary = await page.evaluate(() => localStorage.getItem('spielpause.summary.jigsaw') || Object.keys(localStorage).filter((k) => k.includes('summary')).join(','));
  check(!!summary, 'reportSummary geschrieben');

  console.log('Zurück-Knopf im Spiel und Startseite');
  await page.locator('.pz-tile[data-key]').nth(3).tap();
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  await page.locator('.pz-top a.icon-btn').tap();
  await page.waitForSelector('.gm-primary');
  check(await page.locator('.gm-primary-label', { hasText: 'Weiterspielen' }).count() === 1, '«Weiterspielen» nach dem Verlassen');
  const back = await page.locator('.gm-topbar a.icon-btn').getAttribute('href');
  check(back === '../', 'Zurück zur Startseite aus dem Menü');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'e2e-6-menu-continue.png') });

  console.log('Zoomen mit zwei Fingern');
  await page.locator('.gm-primary').tap();
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const tb = await page.locator('.pz-table').boundingBox();
  const cx = tb.x + tb.width / 2, cy = tb.y + tb.height / 2;
  await touch('touchStart', [{ x: cx - 30, y: cy - 30 }, { x: cx + 30, y: cy + 30 }]);
  for (let k = 1; k <= 8; k++) await touch('touchMove', [{ x: cx - 30 - k * 10, y: cy - 30 - k * 10 }, { x: cx + 30 + k * 10, y: cy + 30 + k * 10 }]);
  // Finger nacheinander lösen (wie in echt)
  await touch('touchMove', [{ x: cx - 110, y: cy - 110 }]);
  await page.waitForTimeout(400);
  await touch('touchEnd', []);
  await page.waitForTimeout(300);
  check(await page.locator('.pz-fit.show').count() === 1, 'Pinch zoomt hinein (Knopf «Ganzes Brett» erscheint)');
  await page.waitForTimeout(400);
  await page.locator('.pz-fit').tap();
  await page.waitForTimeout(500);
  check(await page.locator('.pz-fit.show').count() === 0, 'Zurück auf ganze Ansicht');
  await page.locator('.pz-top a.icon-btn').tap();
  await page.waitForSelector('.gm-primary');

  console.log('Teile drehen');
  await page.waitForTimeout(400);
  await page.locator('.pz-switch').tap();
  await page.waitForTimeout(400);
  await page.locator('.pz-tile[data-key="berge/sommertag"]').tap();
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  check(/@12r$/.test(decodeURIComponent(page.url())), 'Dreh-Modus in der Route');
  await page.waitForTimeout(300);
  const ri = await page.evaluate(() => window.__jigsaw.state().tray.find((i) => window.__jigsaw.state().pieces[i].r !== 0));
  if (ri != null) {
    const r0 = await page.evaluate((k) => window.__jigsaw.state().pieces[k].r, ri);
    const fromR = await page.evaluate((k) => window.__jigsaw.trayPoint(k), ri);
    await touchDrag(fromR, { x: tb.x + 70, y: tb.y + 90 });
    await page.waitForTimeout(400);
    const pp = await page.evaluate((k) => window.__jigsaw.piecePoint(k), ri);
    await page.touchscreen.tap(pp.x, pp.y);
    await page.waitForTimeout(500);
    const r1 = await page.evaluate((k) => window.__jigsaw.state().pieces[k].r, ri);
    check(r1 === (r0 + 1) % 4, `Antippen dreht das Teil (${r0} → ${r1})`);
  } else check(false, 'gedrehtes Teil in der Leiste');
  await page.locator('.pz-top a.icon-btn').tap();
  await page.waitForSelector('.gm-primary');
  await page.waitForTimeout(400);
  await page.locator('.pz-switch').tap();

  console.log('Eigenes Foto');
  await page.waitForTimeout(400);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.gm-sec', { hasText: 'Eigenes Foto' }).tap();
  await (await chooser).setFiles(path.join(OUT, 'e2e-4-finish.png'));
  await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 15000 });
  check(/#play\/foto\//.test(decodeURIComponent(page.url())), 'Foto-Puzzle startet');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'e2e-7-photo.png') });
  await page.locator('.pz-top a.icon-btn').tap();
  await page.waitForSelector('.gm-primary');
  check(await page.locator('.pz-tile[data-key^="foto/"]').count() >= 1, 'Foto erscheint unter «Meine Fotos»');
} catch (e) {
  console.log('FEHLER', e.message);
  failed = true;
  await page.screenshot({ path: path.join(OUT, 'e2e-error.png') }).catch(() => {});
}

check(errors.length === 0, 'Keine Konsolenfehler' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
await browser.close();
if (failed) { console.log('\nE2E: FEHLGESCHLAGEN'); process.exit(1); }
console.log('\nE2E: OK');
