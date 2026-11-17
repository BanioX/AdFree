// End-to-End-Test für Juwelen (Playwright, iPhone 13).
//   1) Server: python3 -m http.server 8221 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   2) node match3/tests/e2e.mjs
// Spielt Level 1 mit echten Wisch-Gesten bis zum Siegerblatt, prüft Weiterspielen nach Neuladen,
// Levelkarte, Entspannt-Modus und dass keine Konsolenfehler auftreten. Screenshots: match3/tests/out/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8221';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const log = (...a) => console.log('·', ...a);

const cdp = await ctx.newCDPSession(page);
async function swipe(x1, y1, x2, y2) {
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x1, y1) });
  for (let k = 1; k <= 4; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x1 + ((x2 - x1) * k) / 4, y1 + ((y2 - y1) * k) / 4) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Wartet, bis das Brett bereit ist oder ein Dialog offen ist. Liefert 'modal' | 'ready'. */
async function settle() {
  await page.waitForFunction(() => {
    if (document.querySelector('.sp-modal-backdrop')) return true;
    const c = window.__m3 && window.__m3.cur;
    return c && !c.board.busy && c.game.status === 'play' && !document.querySelector('.m3-intro');
  }, null, { timeout: 30000 });
  return (await page.$('.sp-modal-backdrop')) ? 'modal' : 'ready';
}

/** Ein guter Zug (wie der Test-Spieler) als Wisch-Geste ausführen. */
async function playMove(k) {
  const m = await page.evaluate(async (k) => {
    const { chooseMove } = await import('/match3/solver.js');
    const { Rng } = await import('/match3/engine.js');
    const { game, board } = window.__m3.cur;
    const mv = chooseMove(game, new Rng(k + 1));
    if (!mv) return null;
    const r = board.canvas.getBoundingClientRect();
    const at = (i) => [r.left + board.ox + ((i % game.w) + 0.5) * board.cs, r.top + board.oy + (Math.floor(i / game.w) + 0.5) * board.cs];
    return { a: at(mv.a), b: at(mv.b), used: game.movesUsed };
  }, k);
  assert.ok(m, 'es gibt immer einen gültigen Zug');
  await swipe(m.a[0], m.a[1], m.b[0], m.b[1]);
  await page.waitForFunction((u) => window.__m3.cur.game.movesUsed > u || window.__m3.cur.board.busy, m.used, { timeout: 5000 });
}

async function modalText() { return (await page.textContent('.sp-modal-backdrop')) || ''; }
async function clickModal(re) { await page.locator('.sp-modal-backdrop button', { hasText: re }).first().tap(); await page.waitForTimeout(350); }

// ---------- 1) Erster Start: Tutorial ----------
await page.goto(BASE + '/match3/');
await page.evaluate(() => { localStorage.clear(); });
await page.goto(BASE + '/match3/');
await page.waitForSelector('.tut-next', { timeout: 8000 });
await page.waitForTimeout(1300);
await shot('01-tutorial');
for (let k = 0; k < 4; k++) { await page.locator('.tut-next').tap(); await page.waitForTimeout(450); }
await page.waitForSelector('.tut-next', { state: 'detached', timeout: 5000 });
log('Tutorial gezeigt und abgeschlossen');

// ---------- 2) Menü ----------
await page.waitForSelector('.gm-primary');
await page.waitForTimeout(400);
await shot('02-menu');
assert.match(await page.textContent('.gm-primary'), /Spielen/);
assert.ok(await page.$('a.icon-btn[href="../"]'), 'Zurück zur Startseite');
const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
assert.ok(noScroll, 'kein horizontales Scrollen');

// ---------- 3) Level 1 bis zum Sieg ----------
await page.locator('.gm-primary').tap();
await page.waitForFunction(() => location.hash === '#level/1' && window.__m3.cur);
await page.waitForSelector('.m3-intro');
await shot('03-intro');
await page.waitForSelector('.m3-intro', { state: 'detached', timeout: 6000 });
assert.ok(await page.$('.m3-coach'), 'Coach-Mark in Level 1');
const fits = await page.evaluate(() => {
  const el = document.querySelector('.m3-play');
  const tools = document.querySelector('.m3-tools').getBoundingClientRect();
  const { board } = window.__m3.cur;
  return { pageScroll: document.documentElement.scrollHeight <= innerHeight + 1, toolsVisible: tools.bottom <= innerHeight + 1, cs: board.cs, w: el.clientWidth };
});
log('Layout', JSON.stringify(fits));
assert.ok(fits.pageScroll && fits.toolsVisible, 'Spielfeld passt ohne Scrollen');

let won = false;
for (let k = 0; k < 60 && !won; k++) {
  const st = await settle();
  if (st === 'modal') {
    const t = await modalText();
    if (/Weiter zu Level/.test(t)) { won = true; break; }
    if (/\+5 Züge/.test(t)) { log('Züge aus → +5 Züge'); await clickModal(/\+5 Züge/); continue; }
    if (/Nochmal versuchen/.test(t)) { await clickModal(/Nochmal versuchen/); continue; }
    if (/Verstanden/.test(t)) { await clickModal(/Verstanden/); continue; }
    throw new Error('Unerwarteter Dialog: ' + t.slice(0, 80));
  }
  if (k === 3) await shot('04-play');
  await playMove(k);
}
if (!won) { await page.waitForSelector('.m3-win', { timeout: 30000 }); won = true; }
await page.waitForTimeout(1600);
await shot('05-win');
assert.ok(await page.$('.m3-winstars span.on'), 'mindestens ein Stern');
const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.match3.progress')));
assert.ok(prog.max >= 2 && prog.stars[1] >= 1, 'Fortschritt gespeichert');
const summary = await page.evaluate(() => localStorage.getItem('spielpause.summary.match3') || Object.keys(localStorage).filter((k) => k.includes('summary')).map((k) => localStorage.getItem(k)).join('|'));
log('Level 1 gewonnen, Sterne:', prog.stars[1], 'Summary:', summary);

// ---------- 4) Level 2, zwei Züge, Neuladen → gleicher Stand ----------
await clickModal(/Weiter zu Level 2/);
await page.waitForFunction(() => location.hash === '#level/2' && window.__m3.cur && window.__m3.cur.n === 2);
await page.locator('.m3-intro').tap().catch(() => {});
for (let k = 0; k < 2; k++) { assert.equal(await settle(), 'ready'); await playMove(k); }
await settle();
const before = await page.evaluate(() => JSON.stringify(window.__m3.cur.game.save()));
await page.reload();
await page.waitForFunction(() => window.__m3 && window.__m3.cur && window.__m3.cur.n === 2);
const after = await page.evaluate(() => JSON.stringify(window.__m3.cur.game.save()));
assert.equal(after, before, 'Spielstand nach Neuladen identisch');
assert.equal(await page.evaluate(() => location.hash), '#level/2');
assert.equal(await page.$('.m3-intro'), null, 'kein Intro beim Fortsetzen');
await page.waitForTimeout(300);
await shot('06-resumed');
log('Neuladen setzt Level 2 exakt fort');

// Hammer benutzen
await page.locator('.m3-tool', { hasText: 'Hammer' }).tap();
await page.waitForSelector('.m3-hammerbar.show');
const hp = await page.evaluate(() => { const { game, board } = window.__m3.cur; const r = board.canvas.getBoundingClientRect(); const i = game.cells.findIndex((p) => p && p.t === 'g'); return [r.left + board.ox + ((i % game.w) + 0.5) * board.cs, r.top + board.oy + (Math.floor(i / game.w) + 0.5) * board.cs, game.hammers]; });
await page.touchscreen.tap(hp[0], hp[1]);
await settle();
assert.equal(await page.evaluate(() => window.__m3.cur.game.hammers), hp[2] - 1, 'Hammer verbraucht');
log('Hammer funktioniert');

// Zurück ins Menü (Zurück-Knopf im Spiel)
await page.locator('.m3-bar a.icon-btn').first().tap();
await page.waitForSelector('.gm-primary');
assert.match(await page.textContent('.gm-primary'), /Weiterspielen/);
assert.match(await page.textContent('.gm-primary'), /Level 2/);

// ---------- 5) Levelkarte ----------
await page.locator('.gm-sec', { hasText: 'Levelkarte' }).tap();
await page.waitForSelector('.m3-node.cur');
await page.waitForTimeout(300);
await shot('07-map');
const nodes = await page.$$eval('.m3-node', (n) => n.length);
assert.ok(nodes >= 150, `mind. 150 Level auf der Karte (${nodes})`);
await page.locator('.m3-map .topbar a.icon-btn').first().tap();
await page.waitForSelector('.gm-primary');

// ---------- 6) Entspannt-Modus ----------
await page.locator('.gm-seg button', { hasText: 'Entspannt' }).tap();
await page.locator('.gm-primary').tap();
await page.waitForFunction(() => location.hash === '#zen' && window.__m3.cur && window.__m3.cur.n === 0);
for (let k = 0; k < 3; k++) { await settle(); await playMove(k); }
await settle();
await shot('08-zen');
log('Entspannt-Modus läuft');

// ---------- 7) Erzeugte Level mit Eis, Steinen, Eicheln ----------
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('spielpause.match3.progress'));
  p.max = 200; localStorage.setItem('spielpause.match3.progress', JSON.stringify(p));
  localStorage.setItem('spielpause.match3.tips', JSON.stringify({ ice: true, stone: true, item: true }));
});
for (const n of [20, 44, 80]) {
  await page.goto(BASE + '/match3/#level/' + n);
  await page.waitForFunction((n) => window.__m3 && window.__m3.cur && window.__m3.cur.n === n, n, { timeout: 15000 });
  await page.locator('.m3-intro').tap().catch(() => {});
  await settle();
  await shot('09-level' + n);
}

await browser.close();
if (errors.length) { console.error('Konsolenfehler:\n' + errors.join('\n')); process.exit(1); }
console.log('OK – e2e bestanden, keine Konsolenfehler');
