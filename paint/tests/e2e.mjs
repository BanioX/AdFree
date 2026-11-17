// End-to-End-Test für Farbenzauber (Playwright, iPhone 13).
//
//   node paint/tests/e2e.mjs [--shots <ordner>]
//
// Startet bei Bedarf einen statischen Server auf Port 8101 (und beendet ihn am Schluss),
// testet Galerie, Malen per Tippen, falsches Tippen, Pinsel, Pinch-Zoom (CDP mit zwei
// Touch-Punkten), Verschieben, Tipp, Abschluss mit Zeitraffer, Speichern/Neuladen und misst
// die Bildrate beim Verschieben des 1000-Formen-Testbilds.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const PORT = 8101;
const BASE = `http://127.0.0.1:${PORT}/paint/`;
const argShots = process.argv.indexOf('--shots');
const SHOTS = argShots > 0 ? resolve(process.argv[argShots + 1]) : join(here, 'out');
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const results = [];
function check(name, ok, info = '') {
  results.push(`${ok ? 'ok  ' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failures++;
}

async function ensureServer() {
  try {
    const r = await fetch(BASE);
    if (r.ok) return null;
  } catch { /* nicht erreichbar */ }
  const p = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let k = 0; k < 50; k++) {
    await new Promise((r) => setTimeout(r, 100));
    try { if ((await fetch(BASE)).ok) return p; } catch { /* warten */ }
  }
  throw new Error('Server startet nicht');
}

const server = await ensureServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const cdp = await ctx.newCDPSession(page);

const shot = (name) => page.screenshot({ path: join(SHOTS, name + '.png') });
const wait = (ms) => page.waitForTimeout(ms);
const P = (fn, arg) => page.evaluate(fn, arg);
const state = () => P(() => window.__paint && window.__paint.state());

async function waitReady(id) {
  await page.waitForFunction((id) => window.__paint && window.__paint.ready && window.__paint.state().id === id, id, { timeout: 60000 });
  await wait(400);
}

async function touch(type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, k) => ({ x: p.x, y: p.y, id: p.id ?? k, radiusX: 4, radiusY: 4, force: 1 })),
  });
}

async function pinch(cx, cy, d0, d1, steps = 12) {
  const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
  await touch('touchStart', pts(d0));
  for (let k = 1; k <= steps; k++) {
    await touch('touchMove', pts(d0 + ((d1 - d0) * k) / steps));
    await wait(16);
  }
  await touch('touchEnd', []);
}

async function drag(x0, y0, x1, y1, steps = 20, holdMs = 0) {
  await touch('touchStart', [{ x: x0, y: y0 }]);
  if (holdMs) await wait(holdMs);
  for (let k = 1; k <= steps; k++) {
    await touch('touchMove', [{ x: x0 + ((x1 - x0) * k) / steps, y: y0 + ((y1 - y0) * k) / steps }]);
    await wait(16);
  }
  await touch('touchEnd', []);
}

async function tapShape(i) {
  const p = await P((i) => window.__paint.labelPoint(i), i);
  await page.touchscreen.tap(p.x, p.y);
  return p;
}

async function stageCenter() {
  return P(() => {
    const r = document.querySelector('.pv-stage').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });
}

try {
  // ------------------------------------------------------------ Galerie
  await page.goto(BASE + '?debug=1', { waitUntil: 'load' });
  // Erster Start: «So geht's» erscheint automatisch
  await page.waitForSelector('.tut-backdrop.show', { timeout: 10000 });
  await wait(1800);
  await shot('00-so-gehts');
  check('Erster Start: «So geht\'s» mit animierter Szene', await page.isVisible('.tut-stage .tz-pic'));
  await page.locator('.tut-skip').tap();
  await page.waitForSelector('.tut-backdrop', { state: 'detached', timeout: 3000 });
  // Startbildschirm
  await page.waitForSelector('.gv-card', { timeout: 20000 });
  await wait(1200);
  await shot('01-menue');
  const primary = await page.textContent('.gm-primary');
  check('Startbildschirm: grosser «Spielen»-Knopf', /Spielen/.test(primary || ''), primary);
  check('Startbildschirm: Zurück zur Startseite', !!(await page.$('.gm-topbar a.icon-btn[href="../"]')));
  check('Startbildschirm: «Eigenes Foto» und «Zufallsbild»', (await page.$$eval('.gm-sec', (e) => e.map((x) => x.textContent).join('|'))).includes('Eigenes Foto'));
  await page.evaluate(() => { const g = document.querySelector('.gv-gal'); g.scrollIntoView(); });
  await wait(1500);
  await shot('01-galerie');
  const chips = await page.$$eval('.gv-chips .chip', (els) => els.map((e) => e.textContent));
  check('Galerie: Chips Alle/Begonnen/Fertig', chips[0] === 'Alle' && chips.includes('Begonnen') && chips.includes('Fertig'), chips.join(', '));
  check('Galerie: Test-Kategorie mit ?debug=1', chips.includes('Test'));
  await page.locator('.gv-chips .chip', { hasText: 'Test' }).tap();
  await wait(1500);
  const fxCards = await page.$$eval('.gv-card[data-id^="fx-"]', (els) => els.length);
  check('Galerie: Testbilder sichtbar', fxCards >= 6, String(fxCards));
  await shot('02-galerie-test');

  // ------------------------------------------------------------ Mini: Malen
  await page.locator('.gv-card[data-id="fx-mini"]').tap();
  await waitReady('fx-mini');
  await shot('03-mini-start');
  let st = await state();
  check('Mini: geladen', st.total === 7 && st.left === 7, JSON.stringify({ total: st.total, left: st.left }));
  await wait(800);
  check('Erstes Bild: Coach-Mark zeigt auf ein Feld', (await state()).coach === true);

  // falsches Tippen: Farbe 1 gewählt, Sonne (Farbe 3) antippen
  await P(() => window.__paint.select(0));
  await wait(200);
  await tapShape(2);
  await wait(120);
  const bounced = await page.$eval('.sw:nth-child(3)', (e) => e.classList.contains('bounce'));
  st = await state();
  check('Falsch tippen: keine Füllung, Farbfeld hüpft', st.left === 7 && bounced);

  // richtig tippen, Farbe für Farbe über die Palette
  const sw = await page.$$('.sw');
  await sw[1].tap();
  await wait(150);
  st = await state();
  check('Farbe wählen per Palette', st.selected === 1);
  await tapShape(1);
  await wait(500);
  st = await state();
  check('Tippen füllt Fläche', st.left === 6, String(st.left));
  check('Coach-Mark verschwindet nach dem ersten Feld', st.coach === false);
  check('Farbe fertig -> nächste Farbe automatisch gewählt', st.selected === 2, String(st.selected));
  await shot('04-mini-gefuellt');

  // grosszügiges Tippen: knapp neben die Tür (Farbe 5) tippen
  await P(() => window.__paint.select(4));
  await wait(250);
  const door = await P(() => {
    const M = window.__paint.model();
    const b = 5 * 4;
    const p = window.__paint.unitsToClient(M.bbox[b + 2] + 1.0 / window.__paint.state().cam.s * 6 + 0.75, (M.bbox[b + 1] + M.bbox[b + 3]) / 2);
    return p;
  });
  const hitOutside = await P((p) => window.__paint.hitAt(p.x, p.y), door);
  await page.touchscreen.tap(door.x, door.y);
  await wait(450);
  st = await state();
  check('Grosszügiges Tippen (≈6 px daneben) füllt die Tür', hitOutside !== 5 && st.order.includes(5), `hit=${hitOutside} order=${st.order}`);

  // restliche Flächen antippen
  for (let guard = 0; guard < 20; guard++) {
    st = await state();
    if (st.left === 0) break;
    const c = st.remaining.findIndex((r) => r > 0);
    await P((c) => window.__paint.select(c), c);
    await wait(120);
    const open = await P((c) => window.__paint.open(c), c);
    await tapShape(open[0]);
    await wait(320);
  }
  st = await state();
  check('Mini: alles gefüllt', st.left === 0 && st.done);
  const confetti = await page.waitForSelector('.sp-confetti', { timeout: 4000 }).catch(() => null);
  check('Abschluss: Konfetti', !!confetti);
  await page.waitForSelector('.pv-dock[data-mode="done"]', { timeout: 8000 });
  await wait(500);
  await shot('05-mini-fertig');
  check('Abschluss: Fertig-Blatt', await page.isVisible('text=Fertig!'));

  // Zeitraffer
  await page.locator('.pv-act', { hasText: 'Zeitraffer' }).tap();
  await page.waitForSelector('.pv-dock[data-mode="timelapse"]', { timeout: 3000 });
  await wait(2200);
  await shot('06-zeitraffer');
  const t0 = Date.now();
  await page.waitForSelector('.pv-dock[data-mode="done"]', { timeout: 15000 });
  const tlDur = Date.now() - t0 + 2200;
  check('Zeitraffer läuft und endet', tlDur > 3000 && tlDur < 14000, `${tlDur} ms`);

  // Neuladen: Fertig bleibt
  await page.reload({ waitUntil: 'load' });
  await waitReady('fx-mini');
  st = await state();
  check('Neuladen: fertiges Bild bleibt fertig', st.done && st.left === 0);
  const summary = await P(() => JSON.parse(localStorage.getItem('spielpause.summary.paint') || 'null'));
  check('Zusammenfassung für die Startseite', !!summary && /fertig/.test(summary.text), summary && summary.text);

  // zurück zur Galerie
  await page.locator('.pv-top .icon-btn').first().tap();
  await page.waitForSelector('.gv:not(.hidden) .gv-card', { timeout: 5000 });
  await wait(900);
  const doneBadge = await page.$('.gv-card[data-id="fx-mini"] .gv-done');
  check('Galerie: Häkchen beim fertigen Bild', !!doneBadge);

  // ------------------------------------------------------------ Voronoi: Zoom, Pan, Tipp, Pinsel, Leistung
  await page.locator('.gv-card[data-id="fx-voronoi"]').tap();
  const tv = Date.now();
  await waitReady('fx-voronoi');
  check('Voronoi geladen (Analyse)', true, `${Date.now() - tv} ms`);
  await shot('07-voronoi-fit');
  st = await state();
  const fitS = st.fit.s;
  const c = await stageCenter();

  // Bildrate beim Verschieben (eingezoomt)
  await pinch(c.x, c.y, 80, 240);
  await wait(700);
  st = await state();
  check('Pinch-Zoom vergrössert', st.cam.s > fitS * 2.2, `${(st.cam.s / fitS).toFixed(2)}x`);
  await shot('08-voronoi-zoom');
  await P(() => {
    window.__frames = [];
    const loop = (t) => { window.__frames.push(t); if (window.__frames.length < 400) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const camBefore = (await state()).cam;
  await drag(c.x + 120, c.y + 80, c.x - 120, c.y - 120, 40);
  await drag(c.x - 100, c.y - 100, c.x + 140, c.y + 60, 40);
  await wait(500);
  const frames = await P(() => {
    const f = window.__frames;
    const d = [];
    for (let k = 1; k < f.length; k++) d.push(f[k] - f[k - 1]);
    return d;
  });
  const sorted = frames.slice(0, 160).sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  st = await state();
  check('Verschieben bewegt die Kamera', Math.abs(st.cam.x - camBefore.x) > 5 || Math.abs(st.cam.y - camBefore.y) > 5);
  check('Bildrate beim Verschieben (1000 Formen)', avg < 25, `Ø ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, Vollbild-Render ${st.renderMs.toFixed(1)} ms`);

  // Zoom-Grenzen
  await pinch(c.x, c.y, 60, 330, 16);
  await pinch(c.x, c.y, 60, 330, 16);
  await pinch(c.x, c.y, 60, 330, 16);
  await wait(900);
  st = await state();
  check('Max-Zoom wird eingehalten', st.cam.s <= fitS * st.maxZoom * 1.001, `${(st.cam.s / fitS).toFixed(2)}x / max ${st.maxZoom.toFixed(2)}x`);
  await pinch(c.x, c.y, 300, 40, 16);
  await pinch(c.x, c.y, 300, 40, 16);
  await pinch(c.x, c.y, 300, 40, 16);
  await wait(900);
  st = await state();
  check('Min-Zoom (ganzes Bild) federt zurück', Math.abs(st.cam.s / fitS - 1) < 0.01, `${(st.cam.s / fitS).toFixed(3)}x`);

  // Farbe wählen + Hervorhebung
  await P(() => window.__paint.select(3));
  await wait(400);
  await shot('09-voronoi-hervorhebung');

  // Tipp
  const camH0 = (await state()).cam;
  await page.locator('.pv-hint').tap();
  await wait(1300);
  st = await state();
  const hinted = await P(() => {
    const s = window.__paint.state();
    const open = window.__paint.open(s.selected);
    const r = document.querySelector('.pv-stage').getBoundingClientRect();
    let best = 1e9;
    for (const i of open) {
      const p = window.__paint.labelPoint(i);
      best = Math.min(best, Math.hypot(p.x - (r.left + r.width / 2), p.y - (r.top + r.height / 2)));
    }
    return best;
  });
  check('Tipp: Kamera fährt zu einer offenen Fläche', (st.cam.s !== camH0.s || st.cam.x !== camH0.x) && hinted < 40, `Abstand zur Mitte ${hinted.toFixed(1)} px, Zoom ${(st.cam.s / fitS).toFixed(2)}x`);
  await wait(200);
  await shot('10-voronoi-tipp');

  // im Zoom tippen
  const openNow = await P(() => window.__paint.open(window.__paint.state().selected));
  const leftBefore = (await state()).left;
  let tapped = 0;
  for (const i of openNow) {
    const p = await P((i) => window.__paint.labelPoint(i), i);
    if (p.x < 30 || p.x > c.x * 2 - 30 || p.y < c.y - c.h / 2 + 30 || p.y > c.y + c.h / 2 - 30) continue;
    await page.touchscreen.tap(p.x, p.y);
    await wait(80);
    if (++tapped >= 3) break;
  }
  await wait(400);
  st = await state();
  check('Im Zoom antippen füllt', st.left === leftBefore - tapped && tapped > 0, `${tapped} getippt`);
  await shot('11-voronoi-gefuellt-zoom');

  // Pinsel: halten und ziehen über mehrere Flächen derselben Farbe
  const brushInfo = await P(() => {
    const api = window.__paint;
    const M = api.model();
    const s = api.state();
    const r = document.querySelector('.pv-stage').getBoundingClientRect();
    // Farbe mit vielen offenen Flächen auf dem Bildschirm suchen
    let best = null;
    for (let c = 0; c < M.palette.length; c++) {
      const pts = api.open(c).map((i) => ({ i, ...api.labelPoint(i) }))
        .filter((p) => p.x > r.left + 20 && p.x < r.right - 20 && p.y > r.top + 20 && p.y < r.bottom - 20);
      if (!best || pts.length > best.pts.length) best = { c, pts };
    }
    return { c: best.c, pts: best.pts.slice(0, 6), left: s.left };
  });
  await P((c) => window.__paint.select(c), brushInfo.c);
  await wait(300);
  if (brushInfo.pts.length >= 2) {
    const pts = brushInfo.pts;
    await touch('touchStart', [{ x: pts[0].x, y: pts[0].y }]);
    await wait(480);
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      for (let s = 1; s <= 10; s++) {
        await touch('touchMove', [{ x: a.x + ((b.x - a.x) * s) / 10, y: a.y + ((b.y - a.y) * s) / 10 }]);
        await wait(12);
      }
    }
    await shot('12-pinsel');
    await touch('touchEnd', []);
    await wait(400);
    st = await state();
    check('Pinsel füllt mehrere Flächen', brushInfo.left - st.left >= Math.min(2, pts.length), `${brushInfo.left - st.left} gefüllt (Ziel ${pts.length})`);
  } else {
    check('Pinsel: genug Flächen gefunden', false);
  }

  // Speichern + Neuladen
  await wait(800);
  const before = await state();
  await page.reload({ waitUntil: 'load' });
  await waitReady('fx-voronoi');
  st = await state();
  check('Neuladen: Fortschritt bleibt', st.left === before.left && st.order.length === before.order.length, `${st.left} / ${before.left}`);
  check('Neuladen: Kamera bleibt', Math.abs(st.cam.s / before.cam.s - 1) < 0.02, `${(st.cam.s / fitS).toFixed(2)}x`);
  check('Neuladen: Farbe bleibt', st.selected === before.selected);

  // Vorlage anzeigen
  await page.locator('.pv-top .icon-btn').last().tap();
  await wait(250);
  await shot('13-menue');
  await page.locator('.pv-menu-item', { hasText: 'Vorlage anzeigen' }).tap();
  await wait(700);
  await shot('14-vorlage');
  check('Vorlage: Hinweis sichtbar', await page.isVisible('.pv-badge'));
  await wait(2200);
  check('Vorlage: verschwindet wieder', !(await page.isVisible('.pv-badge')));

  // ------------------------------------------------------------ Analyse: Splitter
  await page.evaluate(() => { location.hash = '#paint/fx-slivers'; });
  await waitReady('fx-slivers');
  st = await state();
  const sl = await P(() => {
    const M = window.__paint.model();
    return Array.from(M.auto);
  });
  // Erwartung: Streifen 0.4/1 auto, 9 nicht; Punkte r .5/1/1.5 auto, 8 nicht; verdeckt, Fläche 0 und 1.5er-Rand auto
  const exp = { 1: 1, 2: 1, 6: 0, 7: 1, 8: 1, 9: 1, 12: 0, 13: 1, 15: 1, 16: 1, 18: 0 };
  const bad = Object.entries(exp).filter(([i, v]) => sl[i] !== v);
  check('Analyse: winzige/verdeckte Formen werden vorausgefüllt', bad.length === 0, bad.length ? 'abweichend: ' + bad.map(([i]) => `#${i}=${sl[i]}`).join(' ') : `${st.autoCount} auto`);

  // Nicht quadratisch
  await page.evaluate(() => { location.hash = '#paint/fx-tall'; });
  await waitReady('fx-tall');
  await shot('15-hochformat');
  st = await state();
  check('Hochformat: eingepasst', st.cam.s > 0 && Math.abs(st.cam.s - st.fit.s) < 1e-6);

  // ------------------------------------------------------------ Startbildschirm: Weitermalen + Statistik
  const backToMenu = async () => {
    await page.locator('.pv-top .icon-btn').first().tap();
    await page.waitForSelector('.gv:not(.hidden) .gm-primary', { timeout: 5000 });
    await wait(700);
  };
  await backToMenu();
  await page.evaluate(() => { document.querySelector('.gm-scroll').scrollTop = 0; });
  await wait(900);
  const prim2 = await page.textContent('.gm-primary');
  check('Startbildschirm: «Weitermalen» mit zuletzt begonnenem Bild', /Weitermalen/.test(prim2) && /Voronoi/.test(prim2), prim2);
  const statsTxt = await page.$$eval('.gm-stat', (e) => e.map((x) => x.textContent));
  check('Statistik: fertige Bilder und Felder', statsTxt.length === 4 && /^1/.test(statsTxt[0]) && parseInt(statsTxt[2].replace(/\D/g, ''), 10) > 10, statsTxt.join(' | '));
  check('Startbildschirm: Vorschau des Spielstands', await page.$eval('.gv-hero-art', (e) => e.classList.contains('thumb')));
  await shot('17-menue-weiter');
  await page.locator('.gm-primary').tap();
  await waitReady('fx-voronoi');
  check('«Weitermalen» öffnet das Bild', true);
  await backToMenu();

  // ------------------------------------------------------------ Generator: «Neues erzeugen»
  await page.locator('.gv-chips .chip', { hasText: 'Mandalas' }).tap();
  await wait(700);
  await page.locator('.gv-new').first().tap();
  await page.waitForFunction(() => window.__paint && window.__paint.ready && /^g-mandala-\d+$/.test(window.__paint.state().id), null, { timeout: 30000 });
  await wait(600);
  st = await state();
  check('«Neues erzeugen»: neues Mandala', st.total > 100, `${st.id}, ${st.total} Flächen`);
  await shot('18-neues-mandala');
  await backToMenu();
  const newCards = await page.$$eval('.gv-card[data-id^="g-mandala-"]', (e) => e.length);
  check('Neues Mandala erscheint in der Galerie', newCards >= 13, String(newCards));

  // ------------------------------------------------------------ Eigenes Foto
  await page.evaluate(() => { document.querySelector('.gm-scroll').scrollTop = 0; });
  await page.locator('.gm-sec', { hasText: 'Eigenes Foto' }).tap();
  await page.waitForSelector('.ph-sheet', { timeout: 3000 });
  const png = await P(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 480;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#5aa7e6'); sky.addColorStop(1, '#cfe9f7');
    g.fillStyle = sky; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(500, 90, 50, 0, 7); g.fill();
    g.fillStyle = '#5c9e3c'; g.beginPath(); g.moveTo(0, 300); g.bezierCurveTo(200, 230, 420, 340, 640, 270); g.lineTo(640, 480); g.lineTo(0, 480); g.fill();
    g.fillStyle = '#3d7a2a'; g.beginPath(); g.moveTo(0, 400); g.bezierCurveTo(250, 340, 400, 430, 640, 380); g.lineTo(640, 480); g.lineTo(0, 480); g.fill();
    g.fillStyle = '#d9483b'; g.fillRect(150, 230, 140, 110);
    g.fillStyle = '#7a3b22'; g.beginPath(); g.moveTo(135, 232); g.lineTo(220, 160); g.lineTo(305, 232); g.fill();
    g.fillStyle = '#fff3c4'; g.fillRect(180, 260, 34, 30);
    g.fillStyle = '#5a3420'; g.fillRect(232, 280, 34, 60);
    let x = 7;
    for (let k = 0; k < 900; k++) {
      x = (x * 16807) % 2147483647;
      g.fillStyle = ['#e85d9a', '#ffffff', '#ffd34d'][k % 3];
      g.fillRect(x % 640, 300 + ((x >> 8) % 180), 3, 3);
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('.ph-sheet input[type=file]', { name: 'garten.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const tp = Date.now();
  await page.waitForFunction(() => { const b = document.querySelector('.ph-sheet .btn.primary'); return b && !b.disabled; }, null, { timeout: 60000 });
  check('Eigenes Foto: Umwandlung mit Vorschau', await page.isVisible('.ph-sheet .ph-canvas'), `${Date.now() - tp} ms`);
  await wait(300);
  await shot('19-foto-vorschau');
  await page.locator('.ph-sheet .btn.primary').tap();
  await page.waitForFunction(() => window.__paint && window.__paint.ready && /^foto-/.test(window.__paint.state().id), null, { timeout: 60000 });
  await wait(500);
  st = await state();
  check('Eigenes Foto: wird zum Malbild', st.total > 15, `${st.total} Flächen`);
  await shot('20-foto-malen');
  await backToMenu();
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.gv:not(.hidden) .gv-card', { timeout: 20000 });
  await page.locator('.gv-chips .chip', { hasText: 'Meine Fotos' }).tap();
  await wait(700);
  check('Meine Fotos: nach Neuladen gespeichert', (await page.$$('.gv-card[data-id^="foto-"]')).length === 1);
  await page.locator('.gv-edit').tap();
  await wait(300);
  await page.locator('.gv-card[data-id^="foto-"]').tap({ force: true }); // wackelt im Bearbeiten-Modus
  await page.locator('.sp-modal .btn', { hasText: 'Löschen' }).tap();
  await wait(900);
  check('Meine Fotos: löschen', (await page.$$('.gv-card[data-id^="foto-"]')).length === 0);

  // ------------------------------------------------------------ Desktop: Mausrad-Zoom
  const dctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const dpage = await dctx.newPage();
  dpage.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
  dpage.on('console', (m) => { if (m.type() === 'error') errors.push('desktop: ' + m.text()); });
  await dpage.goto(BASE + '?debug=1#paint/fx-curves', { waitUntil: 'load' });
  await dpage.waitForFunction(() => window.__paint && window.__paint.ready, null, { timeout: 30000 });
  await dpage.waitForTimeout(400);
  const ds0 = await dpage.evaluate(() => window.__paint.state().cam.s);
  await dpage.mouse.move(550, 420);
  for (let k = 0; k < 5; k++) { await dpage.mouse.wheel(0, -120); await dpage.waitForTimeout(30); }
  await dpage.waitForTimeout(400);
  const ds1 = await dpage.evaluate(() => window.__paint.state().cam.s);
  check('Desktop: Mausrad zoomt', ds1 > ds0 * 1.3, `${(ds1 / ds0).toFixed(2)}x`);
  await dpage.screenshot({ path: join(SHOTS, '16-desktop.png') });
  await dctx.close();

  check('Keine Konsolenfehler', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (err) {
  check('Ausnahme im Test', false, err && err.stack ? err.stack.split('\n').slice(0, 4).join(' ') : String(err));
  await shot('99-fehler').catch(() => {});
} finally {
  await browser.close();
  if (server) server.kill();
}

console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} bestanden. Screenshots: ${SHOTS}`);
process.exit(failures ? 1 : 0);
