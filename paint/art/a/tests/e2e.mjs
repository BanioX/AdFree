// End-to-End-Test der handgezeichneten Bilder (Team A + Team B) in der echten Farbenzauber-App.
//
//   node paint/art/a/tests/e2e.mjs
//
// iPhone 13 (Playwright). Startet bei Bedarf einen statischen Server auf Port 8102 und beendet ihn.
// Prüft: alle a-/b-Bilder stehen in der Galerie, jedes Bild lässt sich öffnen und analysieren
// (wenige automatisch vorausgefüllte Bereiche), ein Bild wird per Tippen bis zum Fertig-Blatt
// gemalt, Neuladen setzt fort (halb gemaltes Bild bleibt halb gemalt), keine Konsolenfehler.
// Screenshots: paint/art/a/tests/out/

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const PORT = 8102;
const BASE = `http://127.0.0.1:${PORT}/paint/`;
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });

const { pictures: listA } = await import('../index.js');
const { pictures: listB } = await import('../../b/index.js');
const ART = [...listA, ...listB];

let failures = 0;
const results = [];
function check(name, ok, info = '') {
  results.push(`${ok ? 'ok  ' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failures++;
}

async function ensureServer() {
  try {
    if ((await fetch(BASE)).ok) return null;
  } catch { /* läuft noch nicht */ }
  const p = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let k = 0; k < 50; k++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      if ((await fetch(BASE)).ok) return p;
    } catch { /* weiter warten */ }
  }
  throw new Error('Server startet nicht');
}

const server = await ensureServer();
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const wait = (ms) => page.waitForTimeout(ms);
const P = (fn, arg) => page.evaluate(fn, arg);
const state = () => P(() => window.__paint && window.__paint.state());
const shot = (name) => page.screenshot({ path: join(OUT, name + '.png') });
async function waitReady(id) {
  await page.waitForFunction((id) => window.__paint && window.__paint.ready && window.__paint.state().id === id, id, { timeout: 60000 });
  await wait(300);
}
async function tapShape(i) {
  const p = await P((i) => window.__paint.labelPoint(i), i);
  await page.touchscreen.tap(p.x, p.y);
}

try {
  await page.goto(BASE + '?debug=1', { waitUntil: 'load' });
  const tut = await page.waitForSelector('.tut-backdrop.show', { timeout: 6000 }).catch(() => null);
  if (tut) {
    await page.locator('.tut-skip').tap();
    await page.waitForSelector('.tut-backdrop', { state: 'detached', timeout: 3000 });
  }
  await page.waitForSelector('.gv-card', { timeout: 20000 });
  await wait(800);

  // ---------------------------------------------------------------- Galerie
  const ids = await P(() => [...document.querySelectorAll('.gv-card[data-id]')].map((b) => b.dataset.id));
  const missing = ART.filter((p) => !ids.includes(p.id)).map((p) => p.id);
  check(`Galerie zeigt alle ${ART.length} handgezeichneten Bilder`, ART.length >= 18 && !missing.length, missing.join(', '));
  await page.evaluate(() => {
    const c = document.querySelector('.gv-card[data-id^="b-"]');
    if (c) c.scrollIntoView({ block: 'center' });
  });
  await wait(900);
  await shot('galerie');

  // ---------------------------------------------------------------- jedes Bild öffnen
  for (const pic of ART) {
    const t0 = Date.now();
    await P((id) => { location.hash = '#paint/' + id; }, pic.id);
    await waitReady(pic.id);
    const st = await state();
    const pz = await pic.load();
    const ms = Date.now() - t0;
    check(`${pic.id}: öffnet (${st.n} Formen, ${st.autoCount} vorausgefüllt, ${ms} ms)`, st.n === pz.shapes.length && st.autoCount <= 6 && st.total > 50 && ms < 20000);
  }

  // ---------------------------------------------------------------- ein ganzes Bild malen
  const ID = 'a-seerose';
  await P((id) => { location.hash = '#paint/' + id; }, ID);
  await waitReady(ID);
  await shot('seerose-start');
  // alle bis auf drei Bereiche über die Debug-Schnittstelle füllen, den Rest wirklich antippen
  await P(() => window.__paint.fillAllBut(3));
  await wait(400);
  let st = await state();
  check('Seerose: fast fertig, 3 Bereiche offen', st.left === 3, `left=${st.left}`);
  for (let guard = 0; guard < 10; guard++) {
    st = await state();
    if (st.left === 0) break;
    const c = st.remaining.findIndex((r) => r > 0);
    await P((c) => window.__paint.select(c), c);
    await wait(150);
    const open = await P((c) => window.__paint.open(c), c);
    await tapShape(open[0]);
    await wait(350);
  }
  st = await state();
  check('Seerose: durch Antippen fertig gemalt', st.left === 0 && st.done);
  const confetti = await page.waitForSelector('.sp-confetti', { timeout: 4000 }).catch(() => null);
  check('Abschluss mit Konfetti', !!confetti);
  await page.waitForSelector('.pv-dock[data-mode="done"]', { timeout: 10000 });
  await wait(600);
  check('Fertig-Blatt sichtbar', await page.isVisible('text=Fertig!'));
  await shot('seerose-fertig');

  // ---------------------------------------------------------------- Fortsetzen nach Neuladen
  await page.reload({ waitUntil: 'load' });
  await waitReady(ID);
  st = await state();
  check('Neuladen: fertiges Bild bleibt fertig', st.done && st.left === 0);

  const ID2 = 'b-bergsee';
  await P((id) => { location.hash = '#paint/' + id; }, ID2);
  await waitReady(ID2);
  const before = (await state()).left;
  for (let k = 0; k < 4; k++) {
    st = await state();
    const c = st.remaining.findIndex((r) => r > 0);
    await P((c) => window.__paint.select(c), c);
    await wait(120);
    const open = await P((c) => window.__paint.open(c), c);
    await tapShape(open[0]);
    await wait(300);
  }
  const after = (await state()).left;
  check('Bergsee: 4 Bereiche gemalt', before - after === 4, `${before} → ${after}`);
  await shot('bergsee-angefangen');
  await page.reload({ waitUntil: 'load' });
  await waitReady(ID2);
  st = await state();
  check('Neuladen: Bergsee setzt beim selben Stand fort', st.left === after, `left=${st.left}`);
} catch (e) {
  check('Ablauf ohne Ausnahme', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
}

check('keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
if (server) server.kill();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} Fehler` : '\nalles gut');
process.exit(failures ? 1 : 0);
