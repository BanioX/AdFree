// End-to-End-Test für das Blockpuzzle (Playwright, Chromium, iPhone 13).
//   node blocks/tests/e2e.mjs
// Startet bei Bedarf selbst einen statischen Server auf Port 8207 (und beendet ihn wieder).
// Screenshots landen in blocks/tests/out/ (git-ignoriert).

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const OUT = path.join(here, 'out');
mkdirSync(OUT, { recursive: true });
const PORT = 8207;
const BASE = `http://127.0.0.1:${PORT}/blocks/`;

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
const ev = (page, fn, arg) => page.evaluate(fn, arg);

/** Echte Touch-Geste über CDP: Finger von a nach b ziehen. */
async function touchDrag(page, cdp, a, b, { steps = 12, holdShot = null } = {}) {
  const pt = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a) });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) });
    await wait(page, 16);
  }
  if (holdShot) { await wait(page, 120); await shot(page, holdShot); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Spielt den Tipp-Zug per echter Ziehgeste. Gibt true zurück, wenn ein Teil gesetzt wurde. */
async function playHintMove(page, cdp, opts = {}) {
  const before = await ev(page, () => window.__blocks.game.moves);
  const plan = await ev(page, () => {
    const m = window.__blocks.hint();
    return m ? { m, ...window.__blocks.dragPlan(m.slot, m.r, m.c) } : null;
  });
  if (!plan) return false;
  await touchDrag(page, cdp, plan.from, plan.to, opts);
  await wait(page, 80);
  return (await ev(page, () => window.__blocks.game.moves)) === before + 1;
}

async function dialogTitle(page) {
  return ev(page, () => { const t = document.querySelector('.sp-modal-backdrop .sp-modal h2'); return t ? t.textContent : null; });
}

async function run() {
  await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const cdp = await context.newCDPSession(page);

  console.log('Start & Tutorial');
  await page.goto(BASE);
  await wait(page, 900);
  check(await page.locator('.tut-stage').isVisible(), 'Tutorial erscheint beim ersten Start');
  await shot(page, 'e2e-01-tutorial');
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await wait(page, 400);
  check(await page.locator('.gm-primary').isVisible(), 'Startbildschirm mit Hauptknopf');
  check((await page.locator('.gm-primary-label').textContent()) === 'Spielen', 'Hauptknopf «Spielen»');
  const noScroll = await ev(page, () => document.documentElement.scrollWidth <= window.innerWidth);
  check(noScroll, 'kein waagrechtes Scrollen');
  await shot(page, 'e2e-02-menu');

  console.log('Abenteuer Level 1 bis zum Sieg');
  await page.locator('.gm-seg button[data-id="adventure"]').click();
  await wait(page, 200);
  await page.locator('.gm-primary').click();
  await wait(page, 600);
  check((await ev(page, () => location.hash)) === '#level/1', 'Route #level/1');
  await page.locator('.level-intro').waitFor({ state: 'visible' });
  await shot(page, 'e2e-03-level1-intro');
  await wait(page, 3200);
  check(await ev(page, () => !!(window.__blocks.view.hint && window.__blocks.view.hint.persist)), 'Coach-Mark zeigt den ersten Zug');
  await shot(page, 'e2e-04-coach');
  let moves = 0;
  for (let i = 0; i < 12; i++) {
    const won = await ev(page, () => window.__blocks.game.won);
    if (won) break;
    const ok = await playHintMove(page, cdp, { holdShot: i === 0 ? 'e2e-05-drag' : null });
    check(ok, `Zug ${i + 1} per Ziehen gesetzt`);
    if (!ok) break;
    moves++;
    await wait(page, 450);
  }
  check(await ev(page, () => window.__blocks.game.won), `Level 1 gewonnen (${moves} Teile)`);
  await page.locator('.win-stars').waitFor({ state: 'visible', timeout: 5000 });
  await wait(page, 900);
  check((await dialogTitle(page)) === 'Level 1 geschafft!', 'Sieg-Blatt erscheint');
  check(await ev(page, () => document.querySelectorAll('.win-stars i.on').length) === 3, 'drei Sterne');
  await shot(page, 'e2e-06-win');
  const adv = await ev(page, () => JSON.parse(localStorage.getItem('spielpause.blocks.adv')));
  check(adv && adv.max === 2 && adv.stars[1] === 3, 'Fortschritt gespeichert');
  const summary = await ev(page, () => Object.keys(localStorage).filter((k) => k.includes('summary')).map((k) => localStorage.getItem(k)).join(' '));
  check(/Level 2/.test(summary), 'Status für die Startseite gemeldet');
  await page.getByRole('button', { name: /Weiter zu Level 2/ }).click();
  await wait(page, 700);
  check((await ev(page, () => location.hash)) === '#level/2', 'weiter zu Level 2');

  console.log('Fortsetzen nach Neuladen (Abenteuer)');
  await wait(page, 2800);
  check(await playHintMove(page, cdp), 'Zug in Level 2');
  await wait(page, 700);
  const snap = await ev(page, () => ({ moves: window.__blocks.game.moves, board: window.__blocks.game.board.serialize().cells, tray: window.__blocks.game.tray.map((v) => v && v.key) }));
  await page.reload();
  await wait(page, 900);
  const after = await ev(page, () => ({ moves: window.__blocks.game.moves, board: window.__blocks.game.board.serialize().cells, tray: window.__blocks.game.tray.map((v) => v && v.key) }));
  check(after.moves === snap.moves && after.board === snap.board && JSON.stringify(after.tray) === JSON.stringify(snap.tray), 'Level 2 exakt fortgesetzt');
  await shot(page, 'e2e-07-level2-resumed');

  console.log('Levelkarte & Menü');
  await page.locator('.topbar .icon-btn').first().click();
  await wait(page, 500);
  check((await ev(page, () => location.hash)) === '' || (await ev(page, () => location.hash)) === '#', 'Zurück ins Menü');
  check((await page.locator('.gm-primary-label').textContent()) === 'Weiterspielen', 'Menü bietet «Weiterspielen»');
  await page.getByRole('button', { name: /Levelkarte/ }).click();
  await wait(page, 600);
  check(await page.locator('.lv.current').count() === 1, 'Karte zeigt aktuelles Level');
  await shot(page, 'e2e-08-map');
  await page.locator('.topbar .icon-btn').first().click();
  await wait(page, 400);

  console.log('Klassisch: ziehen, Punkte, Neuladen');
  await page.locator('.gm-seg button[data-id="classic8"]').click();
  await wait(page, 200);
  await page.locator('.gm-primary').click();
  await wait(page, 800);
  check((await ev(page, () => location.hash)) === '#classic/8', 'Route #classic/8');
  for (let i = 0; i < 8; i++) {
    const ok = await playHintMove(page, cdp, { holdShot: i === 5 ? 'e2e-09-classic-drag' : null });
    if (!ok) { check(false, `Klassisch Zug ${i + 1}`); break; }
    await wait(page, 300);
  }
  // ein paar schnelle Züge, um Abräumen und Kombos auszulösen
  await ev(page, () => { for (let i = 0; i < 14; i++) { const m = window.__blocks.hint(); if (!m || window.__blocks.game.over) break; window.__blocks.place(m.slot, m.r, m.c); } });
  await wait(page, 300);
  const cl = await ev(page, () => ({ score: window.__blocks.game.score, lines: window.__blocks.game.lines, moves: window.__blocks.game.moves }));
  check(cl.score > 0 && cl.lines > 0, `Punkte ${cl.score}, ${cl.lines} Linien`);
  await wait(page, 900);
  await shot(page, 'e2e-10-classic');
  await page.reload();
  await wait(page, 900);
  const cl2 = await ev(page, () => ({ score: window.__blocks.game.score, lines: window.__blocks.game.lines, moves: window.__blocks.game.moves }));
  check(JSON.stringify(cl) === JSON.stringify(cl2), 'Klassisch nach Neuladen fortgesetzt');
  const layout = await ev(page, () => { const L = window.__blocks.layout(); const st = document.querySelector('.stage').getBoundingClientRect(); return { boardBottom: L.top + L.by + L.n * L.cs, stageBottom: st.bottom, vh: innerHeight, docH: document.documentElement.scrollHeight }; });
  check(layout.docH <= layout.vh + 1, 'Spielseite scrollt nicht');

  console.log('Spielende, Rettung, Neues Spiel');
  await ev(page, () => {
    const b = window.__blocks;
    const g = b.game;
    // Brett fast voll: nur Spalte 7 frei, Teile passen nicht – ausser einem Punkt
    const rows = [];
    for (let r = 0; r < 8; r++) rows.push(r % 2 ? '1212121.' : '2121212.');
    g.board = g.board.constructor.fromLayout(8, rows);
    const cat = g.cat;
    g.tray = [cat.find('#'), cat.find('##|##'), cat.find('###|###|###')];
    g.over = false;
    b.view.setGame(g);
  });
  await wait(page, 200);
  const dot = await ev(page, () => window.__blocks.dragPlan(0, 0, 7));
  await touchDrag(page, cdp, dot.from, dot.to);
  await wait(page, 300);
  // Spalte 7 ist nun bei Zeile 0 belegt: weitere Punkte gibt es nicht – das Spiel ist vorbei
  await page.locator('.over-score').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await wait(page, 400);
  check((await dialogTitle(page)) != null && await page.locator('.over-score').isVisible(), 'Ende-Blatt erscheint');
  await shot(page, 'e2e-11-over');
  await page.getByRole('button', { name: /Neue Teile/ }).click();
  await wait(page, 600);
  check(await ev(page, () => !window.__blocks.game.over && window.__blocks.game.rescues === 1), 'Rettung: neue Teile, Spiel geht weiter');
  await page.getByRole('button', { name: 'Pause' }).click();
  await wait(page, 400);
  await shot(page, 'e2e-12-pause');
  await page.getByRole('button', { name: 'Zum Menü' }).click();
  await wait(page, 500);
  check(await page.locator('.gm-primary').isVisible(), 'Pause → Zum Menü');

  console.log('Aussehen wechseln, 10×10');
  await page.locator('.skin-opt[aria-label="Holz"]').click();
  await wait(page, 300);
  await page.locator('.gm-seg button[data-id="classic10"]').click();
  await wait(page, 200);
  await page.locator('.gm-primary').click();
  await wait(page, 900);
  check(await ev(page, () => window.__blocks.game.size === 10 && document.getElementById('app').classList.contains('skin-holz')), '10×10 mit Holz-Aussehen');
  check(await playHintMove(page, cdp), 'Zug auf 10×10');
  await wait(page, 600);
  await shot(page, 'e2e-13-wood-10');
  await page.locator('.topbar .icon-btn').first().click();
  await wait(page, 400);
  await page.locator('.skin-opt[aria-label="Pastell"]').click();
  await wait(page, 300);
  await page.locator('.gm-seg button[data-id="adventure"]').click();
  await wait(page, 300);
  await page.locator('.gm-primary').click();
  await wait(page, 3200);
  await shot(page, 'e2e-14-pastel-level2');

  console.log('Bild-Level');
  await ev(page, () => { location.hash = 'level/5'; });
  await wait(page, 600);
  check((await ev(page, () => location.hash)) === '#level/2', 'gesperrtes Level wird auf freigeschaltetes begrenzt');

  check(errors.length === 0, 'keine Konsolenfehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
}

try {
  await run();
} catch (e) {
  failures++;
  console.error(e);
} finally {
  if (server) server.kill();
}
console.log(failures ? `\n${failures} Fehler` : '\nAlles in Ordnung');
process.exit(failures ? 1 : 0);
