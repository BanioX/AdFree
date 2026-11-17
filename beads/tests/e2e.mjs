// Perlenbild – End-to-End-Test mit Playwright (Chromium, iPhone 13).
//
//   node beads/tests/e2e.mjs            (Screenshots nach $BEADS_SHOTS oder beads/tests/out/)
//
// Startet bei Bedarf selbst einen statischen Server auf Port 8106 und beendet ihn am Schluss.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8106;
const BASE = `http://127.0.0.1:${PORT}/beads/`;
const OUT = process.env.BEADS_SHOTS || path.join(ROOT, 'beads/tests/out');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok  ', msg);
  else { failures++; console.log('  FAIL', msg); }
}

async function serverUp() {
  try { const r = await fetch(BASE); return r.ok; } catch { return false; }
}

async function startServer() {
  if (await serverUp()) return null;
  const proc = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await serverUp()) return proc;
    await sleep(100);
  }
  proc.kill();
  throw new Error('Server startet nicht');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  shot', name);
}

async function waitIdle(page, extra = 0) {
  await page.waitForFunction(() => window.__beads && window.__beads.idle(), null, { timeout: 15000 });
  if (extra) await sleep(extra);
}

async function tapColumn(page, c) {
  const pt = await page.evaluate((c) => window.__beads.columnPoint(c), c);
  await page.touchscreen.tap(pt.x, pt.y);
}

/** Findet eine Spalte, deren vorderste Steine in die Ablage müssten. */
async function parkingColumn(page) {
  return page.evaluate(() => {
    const g = window.__beads.game;
    for (const c of g.legalColumns()) {
      const st = g.st;
      const k = st.cols[c][st.ptr[c]];
      const n = st.counts[k];
      const cc = g.L.colorCells[k];
      if (n >= cc.length || g.L.rbOf[cc[n]] > st.zoneTop) return c;
    }
    return -1;
  });
}

async function playToEnd(page, { maxTaps = 600, delay = 70, onTap } = {}) {
  let taps = 0;
  while (taps < maxTaps) {
    const st = await page.evaluate(() => window.__beads.state());
    if (st.complete) return taps;
    let c = await page.evaluate(() => window.__beads.solverMove(60000));
    if (c < 0) {
      // nach absichtlich schlechten Zügen: Helfer nutzen (immer gratis)
      await page.locator('.bp-helper').nth(0).tap();
      await sleep(delay);
      continue;
    }
    await tapColumn(page, c);
    taps++;
    if (onTap) await onTap(taps);
    await sleep(delay);
  }
  return taps;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    console.log('Startbildschirm');
    await page.goto(BASE);
    await page.waitForSelector('.tut-title');
    await sleep(900);
    check((await page.textContent('.tut-title')).includes('Spalte'), 'Tutorial erscheint beim ersten Start');
    check(await page.locator('.tut-stage .bt-gem').count() >= 6, 'Tutorial zeigt animierte Mini-Demo');
    await shot(page, '01-howto');
    for (let i = 0; i < 3; i++) { await page.locator('.tut-card button', { hasText: 'Weiter' }).last().tap(); await sleep(350); }
    await sleep(2500);
    await shot(page, '01b-howto-ablage');
    await page.locator('.tut-card button', { hasText: 'Los geht' }).tap();
    await sleep(550);
    await shot(page, '02-menu');
    check((await page.textContent('.gm-primary')).includes('Level 1'), 'Spielen-Knopf zeigt Level 1');
    check(await page.locator('.gm-sec').count() === 2, 'Sammlung und Eigenes Foto im Menü');
    check(await page.locator('.gm-stat').count() === 4, 'Statistik im Menü');
    await page.reload();
    await sleep(800);
    check(await page.locator('.tut-title').count() === 0, 'Tutorial nur beim ersten Start');

    console.log('Level 1 durchspielen');
    await page.locator('.gm-primary').tap();
    await page.waitForFunction(() => window.__beads && window.__beads.state);
    await sleep(400);
    check(page.url().endsWith('#play/1'), 'Route #play/1');
    check(await page.locator('.bp-coach').count() === 1, 'Coach-Mark zeigt die erste Spalte');
    await shot(page, '03-play-start');
    await page.locator('.topbar .icon-btn[aria-label^="So geht"]').tap();
    await page.waitForSelector('.tut-title');
    await sleep(400);
    check(true, '«?» öffnet die Anleitung im Spiel');
    await page.locator('.tut-card button', { hasText: 'Überspringen' }).tap();
    await sleep(450);
    const noScroll = await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1);
    check(noScroll, 'Spielbildschirm passt ohne Scrollen');

    let parked = false;
    await playToEnd(page, {
      delay: 60,
      onTap: async (n) => {
        if (n === 1) check(await page.locator('.bp-coach').count() === 0, 'Coach-Mark verschwindet nach dem ersten Zug');
        if (n === 4) {
          await sleep(140);
          await shot(page, '04-flying');
        }
        if (n === 6 && !parked) {
          await waitIdle(page);
          const c = await parkingColumn(page);
          if (c >= 0) {
            await tapColumn(page, c);
            parked = true;
            await waitIdle(page, 100);
            const s = await page.evaluate(() => window.__beads.state());
            check(s.slots.some((k) => k >= 0), 'Stein liegt in der Ablage');
            await shot(page, '05-parking');
          }
        }
      },
    });
    check((await page.evaluate(() => window.__beads.state())).complete, 'Level 1 fertig');
    await sleep(700);
    await shot(page, '06-shine');
    await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
    await sleep(900);
    check((await page.textContent('.sp-modal h2')).includes('Geschafft'), 'Gewinn-Blatt «Geschafft!»');
    await shot(page, '07-win');
    const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.beads') || 'null'));
    check(summary && summary.text === 'Level 2', 'reportSummary meldet «Level 2»');

    console.log('Sammlung');
    await page.locator('.sp-modal .btn', { hasText: 'Sammlung' }).tap();
    await page.waitForSelector('.bp-card canvas');
    await sleep(500);
    await shot(page, '08-album');
    check(await page.locator('button.bp-card').count() >= 1, 'Sammlung zeigt das fertige Bild');

    console.log('Level 2: Speichern + Neuladen');
    await page.goto(BASE + '#play/2');
    await page.waitForFunction(() => window.__beads && window.__beads.state);
    for (let i = 0; i < 4; i++) {
      const c = await page.evaluate(() => window.__beads.solverMove());
      await tapColumn(page, c);
      await sleep(90);
    }
    await waitIdle(page, 400);
    const before = await page.evaluate(() => window.__beads.state());
    await page.reload();
    await page.waitForFunction(() => window.__beads && window.__beads.state);
    await sleep(300);
    const after = await page.evaluate(() => window.__beads.state());
    check(after.placed === before.placed && after.placed > 0, `Spielstand nach Neuladen erhalten (${after.placed} Perlen)`);

    console.log('Helfer (Level 2)');
    const s0 = await page.evaluate(() => window.__beads.state());
    await page.locator('.bp-helper').nth(2).tap();
    await sleep(500);
    const s1 = await page.evaluate(() => window.__beads.state());
    check(s1.S === s0.S + 1, '+1 Ablage fügt einen Platz hinzu');
    await page.locator('.bp-helper').nth(0).tap();
    await sleep(160);
    await shot(page, '09-magnet');
    await waitIdle(page);
    const s2 = await page.evaluate(() => window.__beads.state());
    check(s2.placed > s1.placed, `Magnet legt Steine (${s2.placed - s1.placed})`);
    await page.locator('.bp-helper').nth(1).tap();
    await sleep(250);
    await shot(page, '10-mix');
    await waitIdle(page);
    const s3 = await page.evaluate(() => window.__beads.state());
    check(s3.placed === s2.placed && !s3.complete, 'Mischen verändert das Bild nicht');
    await playToEnd(page, { delay: 40 });
    await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
    await sleep(900);
    const starsOn = await page.locator('.bp-stars .on').count();
    check(starsOn === 1, `Mit 3 Helfern: ${starsOn} Stern`);
    await shot(page, '11-win-helpers');
    await page.locator('.sp-modal .btn', { hasText: 'Weiter' }).tap();
    await page.waitForFunction(() => location.hash === '#play/3' && window.__beads && !window.__beads.state().complete &&
      document.querySelector('.topbar .title').textContent.includes('Level 3'));
    check(true, '«Weiter» startet Level 3');

    console.log('Stresstest: schnelles Tippen + Helfer');
    let stressTaps = 0;
    for (let i = 0; i < 140; i++) {
      const done = await page.evaluate(() => window.__beads.state().complete);
      if (done) break;
      if (i % 37 === 20) await page.locator('.bp-helper').nth(i % 2).tap();
      const c = await page.evaluate((i) => (i * 7 + 3) % window.__beads.state().cols, i);
      await tapColumn(page, c);
      stressTaps++;
      await sleep(i % 5 === 0 ? 25 : 4);
      if (i === 30) await shot(page, '11a-stress-busy');
    }
    const stressTapCount = await page.evaluate(() => window.__beads.game.meta.taps);
    check(stressTapCount > 20, `Stresstest: ${stressTapCount} Züge ausgeführt (${stressTaps} Taps)`);
    await page.waitForFunction(() => window.__beads.idle(), null, { timeout: 15000 });
    const cons = await page.evaluate(() => window.__beads.consistent());
    check(cons === 'ok', `Anzeige stimmt nach Stresstest mit Logik überein (${cons})`);
    await shot(page, '11b-stress');

    console.log('Grosses Bild: Layout, Ablage voll, festgefahren');
    const big = await page.evaluate(async () => {
      const m = await import('./art/index.js').catch(() => null);
      const list = m ? (m.patterns || []) : [];
      let best = -1, score = 0;
      list.forEach((p, i) => {
        const n = p.rows ? p.rows.length * p.rows[0].length * Object.keys(p.palette).length : 0;
        if (n > score) { score = n; best = i; }
      });
      return best + 1;
    });
    if (big > 0) {
      await page.evaluate((n) => {
        const p = JSON.parse(localStorage.getItem('spielpause.beads.progress') || '{}');
        p.level = Math.max(p.level || 1, n);
        localStorage.setItem('spielpause.beads.progress', JSON.stringify(p));
      }, big);
      await page.goto(BASE + '#play/' + big);
      await page.waitForFunction(() => window.__beads && window.__beads.state);
      await sleep(300);
      for (let i = 0; i < 10; i++) {
        const c = await page.evaluate(() => window.__beads.solverMove(20000));
        if (c < 0) break;
        await tapColumn(page, c);
        await sleep(50);
      }
      await waitIdle(page, 200);
      await shot(page, '12-large');
      let refusedSeen = false;
      for (let i = 0; i < 80 && !refusedSeen; i++) {
        const c = await parkingColumn(page);
        if (c >= 0) { await tapColumn(page, c); await sleep(50); continue; }
        const refusedCol = await page.evaluate(() => {
          const g = window.__beads.game;
          const legal = new Set(g.legalColumns());
          for (let c = 0; c < g.st.cols.length; c++) if (!legal.has(c) && g.st.ptr[c] < g.st.cols[c].length) return c;
          return -1;
        });
        if (refusedCol < 0) {
          const m = await page.evaluate(() => window.__beads.legal()[0]);
          if (m === undefined) break;
          await tapColumn(page, m);
          await sleep(50);
          continue;
        }
        await waitIdle(page);
        await tapColumn(page, refusedCol);
        await sleep(200);
        const toastText = await page.evaluate(() => { const t = document.querySelector('.sp-toast.show'); return t ? t.textContent : ''; });
        refusedSeen = toastText.includes('Ablage voll');
        await shot(page, '13-refused');
      }
      check(refusedSeen, 'Abgelehnter Tipp zeigt «Ablage voll»');
      const stuck = await page.evaluate(() => window.__beads.stuck());
      await waitIdle(page, 300);
      if (stuck) {
        check(await page.locator('.bp-tip.show').count() === 1, 'festgefahren: Tipp «Nutze einen Helfer» erscheint');
        check(await page.locator('.bp-helper.pulse').count() >= 2, 'festgefahren: Helfer-Knöpfe pulsieren');
      } else {
        check(await page.locator('.bp-tip.show').count() === 0, 'nicht festgefahren: kein Tipp');
        await page.evaluate(() => window.__beads.screen.showTip());
        await sleep(400);
      }
      await shot(page, '14-stuck-tip');
    }

    console.log('Eigenes Foto');
    await page.goto(BASE + '#photo');
    await page.waitForSelector('.bp-preview');
    await sleep(300);
    await shot(page, '15-photo-empty');
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 300;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 300);
      grd.addColorStop(0, '#8fd3ff'); grd.addColorStop(0.65, '#e9f7ff'); grd.addColorStop(0.66, '#7ccf6a'); grd.addColorStop(1, '#3f9b47');
      g.fillStyle = grd; g.fillRect(0, 0, 400, 300);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(290, 80, 45, 0, 7); g.fill();
      g.fillStyle = '#e8483b'; g.fillRect(110, 140, 120, 90);
      g.fillStyle = '#8a3b2b'; g.beginPath(); g.moveTo(95, 145); g.lineTo(170, 80); g.lineTo(245, 145); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(150, 180, 30, 50);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const buf = new Uint8Array(await blob.arrayBuffer());
      return Array.from(buf);
    });
    await page.setInputFiles('.bp-file input', { name: 'haus.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    await page.waitForSelector('.bp-preview canvas:not(.hidden)');
    await page.locator('.bp-seg .chip', { hasText: '16' }).tap();
    await page.evaluate(() => { const r = document.querySelector('.bp-range input'); r.value = 6; r.dispatchEvent(new Event('input')); });
    await sleep(400);
    await shot(page, '16-photo-preview');
    check(await page.locator('.bp-swatches i').count() >= 4, 'Vorschau zeigt Farbpalette');
    await page.locator('.bp-photo .btn.primary').tap();
    await page.waitForFunction(() => location.hash.startsWith('#foto/') && window.__beads && window.__beads.state);
    await sleep(400);
    await shot(page, '17-photo-play');
    await playToEnd(page, { delay: 30, maxTaps: 900 });
    await page.waitForSelector('.sp-modal h2', { timeout: 10000 });
    await sleep(900);
    await shot(page, '18-photo-win');
    await page.locator('.sp-modal .btn', { hasText: 'Fertig' }).tap();
    await page.waitForSelector('.bp-grid .bp-card canvas');
    await sleep(400);
    await shot(page, '19-photo-list');
    check(await page.locator('.bp-grid .bp-card').count() >= 1, 'Gespeichertes Foto erscheint in «Meine Fotos»');

    console.log('Startbildschirm mit Fortschritt');
    await page.goto(BASE + '#menu');
    await sleep(600);
    await shot(page, '20-menu-later');

    check(errors.length === 0, 'keine Konsolenfehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  console.log(failures ? `\n${failures} Fehler` : '\nAlles gut.', 'Screenshots:', OUT);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
