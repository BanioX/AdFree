// End-to-End-Test für den Pfeilwürfel (Playwright, Chromium, iPhone 13).
//   node cube/tests/e2e.mjs [ausgabeordner]
// Startet bei Bedarf selbst einen statischen Server auf Port 8303 (CUBE_PORT) (und beendet ihn wieder).
// Screenshots landen im Ausgabeordner (Standard: cube/tests/out, git-ignoriert).

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(here, 'out'));
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.CUBE_PORT) || 8303;
const BASE = `http://127.0.0.1:${PORT}/cube/`;

let server = null;
async function ensureServer() {
  try { await fetch(BASE); return; } catch { /* starten */ }
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { await fetch(BASE); return; } catch { /* warten */ }
  }
  throw new Error('Server startet nicht');
}

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.log('  ✗ ' + msg); }
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const wait = (page, ms) => page.waitForTimeout(ms);
const dbg = (page, fn, arg) => page.evaluate(fn, arg);

async function waitIdle(page, max = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    if (!(await dbg(page, () => window.__cube && window.__cube.animating))) return;
    await wait(page, 50);
  }
}

/** Tippt (echter Touch) auf Pfeil id; dreht vorher bei Bedarf. */
async function tapArrow(page, id) {
  let p = await dbg(page, (i) => window.__cube.tapPoint(i), id);
  if (!p) {
    await dbg(page, (i) => window.__cube.showArrow(i), id);
    await wait(page, 60);
    p = await dbg(page, (i) => window.__cube.tapPoint(i), id);
  }
  if (!p) return false;
  const hit = await dbg(page, ([x, y]) => window.__cube.hitTest(x, y), [p.x, p.y]);
  if (hit !== id) return false;
  await page.touchscreen.tap(p.x, p.y);
  return true;
}

/** Löst das aktuelle Level ausschliesslich mit echten Taps auf freie Pfeile. */
async function solveByTapping(page, { prefer = 'visible' } = {}) {
  let guard = 0;
  while (guard++ < 400) {
    const rem = await dbg(page, () => window.__cube.remaining);
    if (rem === 0) return true;
    const free = await dbg(page, () => window.__cube.freeIds());
    if (!free.length) { await wait(page, 60); continue; }
    // Sichtbare zuerst (wie ein Mensch)
    let id = free[0];
    if (prefer === 'visible') {
      let best = -1;
      for (const f of free) {
        const v = await dbg(page, (i) => window.__cube.visibility(i), f);
        if (v > best) { best = v; id = f; }
      }
    }
    const ok = await tapArrow(page, id);
    if (!ok) return false;
    await wait(page, 70);
    const rem2 = await dbg(page, () => window.__cube.remaining);
    if (rem2 !== rem - 1) return false;
  }
  return false;
}

/** Wischen mit einem Finger über CDP-Touch-Events. */
async function swipe(page, cdp, x0, y0, x1, y1, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, id: 1 }] });
    await wait(page, 12);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pinch(page, cdp, cx, cy, d0, d1, steps = 10) {
  const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * (i / steps)) });
    await wait(page, 16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function main() {
  await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const cdp = await context.newCDPSession(page);

  console.log('Startbildschirm');
  await page.goto(BASE);
  await dbg(page, () => localStorage.clear());
  await page.goto(BASE);
  await wait(page, 1600);
  check(await page.locator('.tut-next').count() === 1, '«So geht\'s» erscheint beim ersten Start');
  await shot(page, '00-howto');
  for (let i = 0; i < 4; i++) { await page.locator('.tut-next').tap(); await wait(page, i < 3 ? 700 : 500); }
  check(await page.locator('.tut-next').count() === 0, 'Anleitung lässt sich durchblättern und schliessen');
  check(await dbg(page, () => localStorage.getItem('spielpause.tutorial.cube')) === 'true', 'Anleitung als gesehen gemerkt');
  check((await page.locator('.gm-primary').textContent()).includes('Level 1'), 'Hauptknopf zeigt Level 1');
  check((await page.locator('.level-tile').count()) === 20, 'Levelkarte: zwei Kapitel à 10 Level');
  check((await page.locator('.level-tile.locked').count()) === 19, 'spätere Level gesperrt');
  await shot(page, '01-start');

  console.log('Level 1 (Tutorial) durch echtes Antippen lösen');
  await page.locator('.gm-primary').tap();
  await wait(page, 1300);
  check(page.url().endsWith('#play/1'), 'Hash-Route #play/1');
  check(await page.locator('.bubble:not(.hidden)').count() === 1, 'Tutorial-Blase sichtbar');
  check((await page.locator('.bubble').textContent()).includes('dessen Weg frei ist'), 'Tutorial-Text');
  await shot(page, '02-level1');
  const total1 = await dbg(page, () => window.__cube.arrowCount);
  const solved1 = await solveByTapping(page);
  check(solved1, `Level 1 gelöst (${total1} Pfeile, nur echte Taps)`);
  check(await dbg(page, () => window.__cube.mistakes) === 0, 'keine Fehler beim Lösen');
  await page.waitForSelector('.sp-modal', { timeout: 4000 });
  await wait(page, 1500);
  check((await page.locator('.sp-modal h2').textContent()).includes('Level 1 gelöst'), 'Gewinn-Sheet erscheint');
  check(await page.locator('.win-star.on').count() === 3, '3 Sterne ohne Fehler');
  await shot(page, '03-win');
  const summary = await dbg(page, () => JSON.parse(localStorage.getItem('spielpause.summary.cube') || 'null'));
  check(summary && summary.text === 'Level 2 · 3 Sterne', 'reportSummary meldet «Level 2 · 3 Sterne»');
  const st1 = await dbg(page, () => JSON.parse(localStorage.getItem('spielpause.cube.stats') || '{}'));
  check(st1.arrows === total1 && st1.wins === 1 && st1.streak === 1, 'Statistik zählt Pfeile, Siege und Serie');

  console.log('Weiter zu Level 2, drehen, zoomen, neu laden');
  await page.locator('.sp-modal .btn.primary').tap();
  await wait(page, 1300);
  check(page.url().endsWith('#play/2'), 'Weiter → #play/2');
  check((await page.locator('.bubble').textContent()).includes('Wische'), 'Wisch-Hinweis auf Level 2');
  const q0 = await dbg(page, () => window.__cube.view.q);
  const box = await page.locator('.cube-canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await swipe(page, cdp, cx - 90, cy + 40, cx + 70, cy - 10);
  await wait(page, 120);
  const q1 = await dbg(page, () => window.__cube.view.q);
  const dq = Math.abs(q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3]);
  check(dq < 0.98, 'Wischen dreht den Würfel');
  await wait(page, 500);
  check(await page.locator('.bubble.hidden').count() === 1, 'Wisch-Hinweis verschwindet nach dem Drehen');
  await waitIdle(page);
  await pinch(page, cdp, cx, cy, 120, 220);
  await wait(page, 100);
  const z = await dbg(page, () => window.__cube.view.zoom);
  check(z > 1.3, `Pinch zoomt (${z.toFixed(2)})`);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 300);
  await wait(page, 100);
  check(await dbg(page, () => window.__cube.view.zoom) < z, 'Mausrad zoomt heraus');
  await wait(page, 400); // ausserhalb des Doppeltipp-Schutzes von setupPage()
  await page.locator('.tool.view').tap();
  await wait(page, 800);
  check(Math.abs(await dbg(page, () => window.__cube.view.zoom) - 1) < 0.01, '«Ansicht» setzt Zoom zurück');
  const free2 = await dbg(page, () => window.__cube.freeIds());
  await tapArrow(page, free2[0]);
  await wait(page, 800);
  const before = await dbg(page, () => ({ removed: window.__cube.removedIds, hearts: window.__cube.hearts, q: window.__cube.view.q }));
  await page.reload();
  await wait(page, 900);
  const after = await dbg(page, () => ({ removed: window.__cube.removedIds, hearts: window.__cube.hearts, q: window.__cube.view.q }));
  check(JSON.stringify(after.removed) === JSON.stringify(before.removed) && after.hearts === before.hearts, 'Neu laden setzt genau dort fort');
  check(page.url().endsWith('#play/2'), 'Route bleibt nach Neuladen');
  check(await page.locator('.tut-next').count() === 0, 'Anleitung kommt nicht erneut');
  await page.locator('.help-btn').tap();
  await wait(page, 600);
  check(await page.locator('.tut-next').count() === 1, '«?» im Spiel öffnet die Anleitung');
  await page.locator('.tut-skip').tap();
  await wait(page, 500);
  check(await page.locator('.tut-next').count() === 0, 'Anleitung schliesst wieder');

  console.log('Blockierter Pfeil, Herzverlust, Tipp (Level 15)');
  await dbg(page, () => localStorage.setItem('spielpause.cube.progress', JSON.stringify({ unlocked: 60, stars: { 1: 3 } })));
  await page.goto(BASE + '#play/15');
  await wait(page, 1400);
  check(await dbg(page, () => window.__cube.level) === 15, 'Level 15 geöffnet');
  await shot(page, '04-level15');
  const hearts0 = await dbg(page, () => window.__cube.hearts);
  const blocked = await dbg(page, () => window.__cube.blockedIds());
  let bid = -1, bestVis = -1;
  for (const id of blocked) {
    const v = await dbg(page, (i) => window.__cube.visibility(i), id);
    if (v > bestVis && await dbg(page, (i) => window.__cube.tapPoint(i), id)) { bid = id; bestVis = v; }
  }
  check(bid >= 0, 'sichtbarer blockierter Pfeil gefunden');
  await dbg(page, () => window.__cube.setTimeScale(0.05));
  await tapArrow(page, bid);
  // bis zum Anstossen warten (Herz geht verloren), dann sofort festhalten
  for (let k = 0; k < 200 && await dbg(page, () => window.__cube.hearts) === hearts0; k++) await wait(page, 30);
  check(await dbg(page, () => window.__cube.hearts) === hearts0 - 1, 'Anstossen kostet genau ein Herz');
  await wait(page, 400);
  await shot(page, '05-blocked');
  await dbg(page, () => window.__cube.setTimeScale(1));
  await waitIdle(page);

  // Blockierter Pfeil mit verdeckter Spitze: Würfel dreht sich erst hin
  const hiddenBlocked = [];
  for (const id of await dbg(page, () => window.__cube.blockedIds())) {
    const fac = await dbg(page, (i) => window.__cube.headFacing(i), id);
    if (fac < 0.3 && await dbg(page, (i) => window.__cube.tapPoint(i), id)) hiddenBlocked.push(id);
  }
  if (hiddenBlocked.length) {
    await tapArrow(page, hiddenBlocked[0]);
    await wait(page, 900);
    check(await dbg(page, (i) => window.__cube.headFacing(i), hiddenBlocked[0]) > 0.3, 'verdeckte Spitze wird beim Anstossen ins Bild gedreht');
    await waitIdle(page);
    await dbg(page, () => { window.__cube.restartQuiet(); });
    await wait(page, 1300);
  }
  await waitIdle(page);
  check(await dbg(page, () => window.__cube.hearts) === hearts0, 'Herzen nach Neustart wieder voll');
  check(await dbg(page, () => window.__cube.remaining) === await dbg(page, () => window.__cube.arrowCount), 'blockierter Pfeil bleibt liegen');
  await page.locator('.tool.hint').tap();
  await wait(page, 900);
  check(await dbg(page, () => window.__cube.highlightCount) >= 1, 'Tipp hebt einen Pfeil hervor');
  const hinted = await dbg(page, () => window.__cube.freeIds().map((i) => window.__cube.visibility(i)));
  check(Math.max(...hinted) > 0.5, 'Tipp dreht einen freien Pfeil gut sichtbar ins Bild');
  await shot(page, '06-hint');

  console.log('Mittendrin: exit-Animation in Zeitlupe');
  const fr = await dbg(page, () => window.__cube.freeIds());
  await dbg(page, () => window.__cube.setTimeScale(0.1));
  await tapArrow(page, fr[0]);
  await wait(page, 1700);
  await shot(page, '07-exit');
  await dbg(page, () => window.__cube.setTimeScale(1));
  await waitIdle(page);

  console.log('Herzen aufbrauchen → «Keine Herzen mehr» → Nochmal');
  for (let k = 0; k < 8; k++) {
    if (await page.locator('.sp-modal').count()) break;
    const bl = await dbg(page, () => window.__cube && window.__cube.blockedIds());
    if (!bl || !bl.length) break;
    let done = false;
    for (const id of bl) { if (await tapArrow(page, id)) { done = true; break; } }
    if (!done) await tapArrow(page, bl[0]);
    await wait(page, 750);
  }
  await page.waitForSelector('.sp-modal', { timeout: 4000 }).catch(() => {});
  await wait(page, 500);
  check((await page.locator('.sp-modal h2').textContent().catch(() => '')) === 'Keine Herzen mehr', '«Keine Herzen mehr»-Sheet');
  await shot(page, '08-lost');
  await page.locator('.sp-modal .btn.primary').tap();
  await wait(page, 1200);
  check(await dbg(page, () => window.__cube.hearts) === 4 && await dbg(page, () => window.__cube.remaining) === await dbg(page, () => window.__cube.arrowCount), 'Nochmal startet das Level frisch');

  console.log('Entspannt-Modus: Anstossen kostet kein Herz');
  await dbg(page, () => localStorage.setItem('spielpause.cube.settings', JSON.stringify({ mode: 'relax' })));
  await page.goto(BASE + '#play/16');
  await wait(page, 1400);
  check(await page.locator('.relax-chip').count() === 1, 'Herzen durch «Entspannt» ersetzt');
  const relaxBlocked = await dbg(page, () => window.__cube.blockedIds());
  let rb = false;
  for (const id of relaxBlocked) { if (await tapArrow(page, id)) { rb = true; break; } }
  await wait(page, 1000);
  check(rb && await dbg(page, () => window.__cube.mistakes) === 1 && await page.locator('.sp-modal').count() === 0, 'Fehler gezählt, aber kein Herzverlust');
  await dbg(page, () => localStorage.setItem('spielpause.cube.settings', JSON.stringify({ mode: 'classic' })));

  console.log('Weitere Level ansehen');
  for (const L of [10, 20, 30, 40, 45, 60]) {
    await page.goto(BASE + '#play/' + L);
    await wait(page, 1500);
    await shot(page, `09-level${L}`);
    check(await dbg(page, () => window.__cube.level) === L, `Level ${L} lädt`);
  }
  const ms = await dbg(page, () => window.__cube.bench(60));
  console.log(`  Renderzeit Level 60 (N=10): ${ms.toFixed(2)} ms/Bild (Desktop-Chromium)`);
  check(ms < 8, 'Rendern schnell genug');

  console.log('Spielstand pro Level und Verlauf (Wiederholen löscht nichts)');
  await page.goto(BASE);
  await wait(page, 900);
  const h0 = await dbg(page, () => history.length);
  await page.locator('.gm-primary').tap();
  await wait(page, 1300);
  check(page.url().endsWith('#play/60'), 'Hauptknopf öffnet das Front-Level 60');
  const fr60 = await dbg(page, () => window.__cube.freeIds());
  await dbg(page, (i) => window.__cube.tap(i), fr60[0]);
  await wait(page, 800);
  const rem60 = await dbg(page, () => window.__cube.remaining);
  await page.locator('.topbar .icon-btn').first().tap();
  await wait(page, 800);
  check((await page.locator('.gm-primary').textContent()).includes('Weiterspielen'), 'Menü: «Weiterspielen» nach einem Zug');
  await page.locator('.level-tile[data-level="5"]').tap();
  await wait(page, 1300);
  check(await dbg(page, () => window.__cube.level) === 5, 'altes Level 5 aus der Levelkarte geöffnet');
  await page.locator('.topbar .icon-btn').first().tap();
  await wait(page, 800);
  check((await page.locator('.gm-primary').textContent()).includes('Weiterspielen'), 'Front-Level-Stand bleibt nach Wiederholung erhalten');
  check(await dbg(page, () => history.length) === h0 + 1, `kein doppelter Menü-Eintrag im Verlauf (${await dbg(page, () => history.length)} statt ${h0 + 1})`);
  await page.locator('.gm-primary').tap();
  await wait(page, 1300);
  check(await dbg(page, () => window.__cube.remaining) === rem60, 'Level 60 setzt beim alten Stand fort');

  console.log('Schneller Doppeltipp trifft keinen Nachbarn');
  // Wie in der QA: Tippstellen, an denen nach dem Entfernen ein Nachbar in Tipp-Reichweite liegt
  let dblBad = 0, dblTried = 0;
  for (let k = 0; k < 40 && dblTried < 6; k++) {
    const spot = await dbg(page, () => {
      const C = window.__cube;
      for (const f of C.freeIds()) {
        const p = C.tapPoint(f);
        if (!p) continue;
        for (let dy = -24; dy <= 24; dy += 4) for (let dx = -24; dx <= 24; dx += 4) {
          const x = p.x + dx, y = p.y + dy;
          if (C.hitTest(x, y) === f && C.hitTestWithout(x, y, f) >= 0) return { x, y };
        }
      }
      return null;
    });
    if (!spot) { // keine passende Stelle sichtbar: zu einem anderen freien Pfeil drehen
      await dbg(page, (n) => { const f = window.__cube.freeIds(); if (f.length) window.__cube.showArrow(f[n % f.length]); }, k);
      await wait(page, 120);
      continue;
    }
    const before = await dbg(page, () => ({ h: window.__cube.hearts, r: window.__cube.remaining }));
    await page.touchscreen.tap(spot.x, spot.y);
    await wait(page, 90);
    await page.touchscreen.tap(spot.x, spot.y);
    await wait(page, 900);
    const after = await dbg(page, () => ({ h: window.__cube.hearts, r: window.__cube.remaining }));
    dblTried++;
    if (after.h !== before.h || after.r !== before.r - 1) dblBad++;
  }
  check(dblTried >= 3 && dblBad === 0, `Doppeltipps neben Nachbarn: ${dblTried} versucht, ${dblBad} falsch`);

  console.log('Neu laden während der Startfahrt speichert die Grundansicht');
  await page.goto(BASE + '#play/7');
  await wait(page, 150);
  await dbg(page, () => window.__cube.tap(window.__cube.freeIds()[0]));
  await page.reload();
  await wait(page, 300);
  const qDot = await page.evaluate(async () => {
    const { Q_DEFAULT } = await import('./view.js');
    const s = JSON.parse(localStorage.getItem('spielpause.cube.saves') || '{}')[7];
    return s && s.q ? Math.abs(s.q.reduce((a, v, i) => a + v * Q_DEFAULT[i], 0)) : 0;
  });
  check(qDot > 0.999, `gespeicherte Ansicht = Grundansicht (${qDot.toFixed(4)})`);

  console.log('Tutorial-Blase verdeckt die Herzen nicht');
  await page.goto(BASE + '#play/1');
  await wait(page, 1300);
  const bb = await page.locator('.bubble:not(.hidden)').boundingBox();
  const pb = await page.locator('.pill').boundingBox();
  const pillOp = await dbg(page, () => getComputedStyle(document.querySelector('.pill')).opacity);
  check(bb && pb && bb.y >= pb.y + pb.height - 1 && pillOp === '1', 'Blase liegt unter der sichtbaren Herzen-Anzeige');
  await shot(page, '13-level1-bubble');

  console.log('Neu laden auf dem Gewinn-Blatt geht weiter');
  await page.goto(BASE + '#play/3');
  await wait(page, 1300);
  for (let k = 0; k < 60 && await dbg(page, () => window.__cube && window.__cube.remaining > 0); k++) {
    await dbg(page, () => { const f = window.__cube.freeIds(); if (f.length) window.__cube.tap(f[0]); });
    await wait(page, 60);
  }
  await page.waitForSelector('.sp-modal', { timeout: 4000 }).catch(() => {});
  check(page.url().endsWith('#play/4'), 'Adresse zeigt beim Gewinn schon aufs nächste Level');
  await page.reload();
  await wait(page, 1300);
  check(await dbg(page, () => window.__cube.level) === 4 && await page.locator('.sp-modal').count() === 0, 'Neu laden öffnet Level 4 statt Level 3 erneut');

  console.log('Gesperrtes Level per URL, Zurück ins Menü');
  await page.goto(BASE + '#play/999');
  await wait(page, 900);
  check(page.url().endsWith('#play/60'), 'gesperrtes Level → höchstes freigeschaltetes');
  await page.locator('.topbar .icon-btn').first().tap();
  await wait(page, 700);
  check(await page.locator('.gm-primary').count() === 1 && !page.url().includes('#play'), 'Zurück führt ins Menü');
  check(await page.locator('.level-tile.current').count() === 1, 'aktuelles Level hervorgehoben');
  check(await page.locator('.chapter').count() === 7, 'Levelkarte zeigt Kapitel bis eins nach dem aktuellen');
  await shot(page, '10-menu-progress');
  await page.locator('.gm-sec', { hasText: 'Statistik' }).tap();
  await wait(page, 500);
  check(await page.locator('.cube-statrow').count() >= 8, 'Statistik-Blatt');
  await shot(page, '11-stats');
  await page.locator('.sp-modal .btn.primary').tap();
  await wait(page, 400);
  await page.locator('.gm-sec', { hasText: 'Levelkarte' }).tap();
  await wait(page, 800);
  await shot(page, '12-map');

  check(errors.length === 0, 'keine Konsolenfehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen` : '\nAlles grün.');
  console.log('Screenshots: ' + OUT);
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(() => {
    if (server) server.kill();
    process.exitCode = failures ? 1 : 0;
  });
