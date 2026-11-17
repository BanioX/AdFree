// End-to-End-Test (Playwright, iPhone 13):
//   python3 -m http.server 8301 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node golf/tests/e2e.mjs
// Startet über das Menü, klickt das Tutorial durch, spielt Loch 1 mit echten Taps und Ziehen,
// prüft Rückgängig und Neuladen, räumt das Loch ab (Lochblatt), spielt Loch 2 bis «Keine Züge mehr»,
// beendet die Runde (Rundenblatt mit Scorekarte), löst das Loch des Tages, prüft 375 px Breite
// und dass keine Konsolenfehler auftreten. Screenshots: golf/tests/out/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8301/golf/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const step = (t) => console.log('•', t);
const S = (fn, arg) => page.evaluate(fn, arg);

async function noPageScroll() {
  const o = await S(() => ({ sw: document.scrollingElement.scrollWidth, sh: document.scrollingElement.scrollHeight, w: innerWidth, h: innerHeight }));
  assert.ok(o.sw <= o.w && o.sh <= o.h, `Seite scrollt nicht (${JSON.stringify(o)})`);
}

async function ready() {
  await page.waitForFunction(() => {
    const g = window.__golf && window.__golf.game;
    return g && !g.dead && g.st && g.g && !g.busy && !g.table.locked && document.querySelector('.cg-hud b').textContent;
  });
  await S(() => window.__golf.idle());
}

async function tapCard(id) {
  const r = await S((i) => window.__golf.rect(i), id);
  await page.touchscreen.tap(r.x, r.y);
}

async function tapMove(m) {
  if (m.t === 'draw') await tapCard(await S(() => window.__golf.stockId()));
  else await tapCard(await S((c) => window.__golf.bottomId(c), m.c));
  await page.waitForTimeout(60);
  await ready();
}

const movesCount = () => S(() => window.__golf.game.moves.length);

step('Menü');
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await noPageScroll();
await shot('01-menu');

step('Spielen → Tutorial');
await page.click('.gm-primary');
await page.waitForSelector('.tut-card');
await page.waitForTimeout(1700);
await shot('02-tutorial');
for (let i = 0; i < 4; i++) { await page.click('.tut-next'); await page.waitForTimeout(350); }
await page.waitForSelector('.tut-backdrop', { state: 'detached' });

step('Loch 1 ausgeteilt, Coach-Mark');
await ready();
await noPageScroll();
assert.ok(await S(() => document.querySelector('.pc-ring').classList.contains('show')));
assert.match(await page.locator('.cg-hud b').innerText(), /Loch 1 von 9/);
await shot('03-game');

step('Echte Taps (Lösungsweg)');
const sol = await S(() => window.__golf.solution().moves);
assert.ok(sol.length > 20);
for (const m of sol.slice(0, 10)) {
  const before = await movesCount();
  await tapMove(m);
  assert.equal(await movesCount(), before + 1, 'Tap-Zug: ' + JSON.stringify(m));
}
await shot('04-midgame');

step('Verdeckte Karte antippen: kein Zug');
const n0 = await movesCount();
await tapCard(0);
await page.waitForTimeout(250);
assert.equal(await movesCount(), n0);

step('Rückgängig');
await page.click('[data-tool="undo"]');
await ready();
assert.equal(await movesCount(), n0 - 1);
await tapMove(sol[n0 - 1]);

step('Ziehen auf die Ablage');
const dm = await S(() => { const r = window.__golf.solution(); return r.moves[0] && r.moves[0].t === 'play' ? r.moves[0] : null; });
if (dm) {
  const a = await S((c) => window.__golf.rect(window.__golf.bottomId(c)), dm.c);
  const w = await S(() => { const g = window.__golf.game; return window.__golf.rect(g.pile[g.pile.length - 1]); });
  const before = await movesCount();
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 4, a.y + 8, { steps: 2 });
  await page.mouse.move(w.x, w.y, { steps: 10 });
  await page.mouse.up();
  await ready();
  assert.equal(await movesCount(), before + 1, 'Drag angenommen');
}

step('Neuladen mitten im Loch');
const snap = await S(() => JSON.stringify([window.__golf.state.h, window.__golf.state.ptr]));
await page.reload();
await ready();
assert.equal(await S(() => JSON.stringify([window.__golf.state.h, window.__golf.state.ptr])), snap);

step('Tipp');
await page.click('[data-tool="hint"]');
await page.waitForTimeout(150);
assert.ok(await S(() => !!document.querySelector('.pcard.hint')));

step('Loch abräumen → Lochblatt');
await S(async () => {
  const P = window.__golf;
  const r = P.solution();
  if (!r.cleared) throw new Error('nicht mehr abräumbar');
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForTimeout(1200);
await shot('05a-fan');
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(600);
await shot('05-hole');
assert.match(await page.locator('.sp-modal').innerText(), /Weiter zu Loch 2/);
await page.click('.sp-modal .btn.primary');
await ready();
assert.match(await page.locator('.cg-hud b').innerText(), /Loch 2 von 9/);

step('Loch 2: schlecht spielen bis «Keine Züge mehr»');
await S(async () => {
  const P = window.__golf;
  for (let k = 0; k < 60; k++) {
    const g = P.game;
    if (g.over) break;
    const legal = P.legal();
    const m = legal.find((x) => x.t === 'draw') || legal[0];
    if (!m) break;
    await P.play(m); await P.idle();
  }
});
const cleared2 = await S(() => window.__golf.state.h.every((x) => x === 0));
if (!cleared2) {
  await page.waitForSelector('.sp-modal h2:text("Keine Züge mehr")', { timeout: 4000 });
  await shot('06-stuck');
  await page.click('.sp-modal .btn.primary');
}
await page.waitForSelector('.sp-modal .golf-card', { timeout: 8000 });
await page.waitForTimeout(400);
await shot('07-hole2');
await page.click('.sp-modal .btn.primary');
await ready();

step('Löcher 3–9 beenden → Rundenblatt');
for (let hole = 3; hole <= 9; hole++) {
  await ready();
  assert.match(await page.locator('.cg-hud b').innerText(), new RegExp(`Loch ${hole} von 9`));
  await S(() => window.__golf.finishHole());
  await page.waitForSelector('.sp-modal .btn.primary', { timeout: 8000 });
  await page.waitForTimeout(250);
  await page.click('.sp-modal .btn.primary');
}
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(500);
await shot('08-round');
const roundTxt = await page.locator('.sp-modal').innerText();
assert.match(roundTxt, /Neue Runde/);
assert.equal(await page.locator('.sp-modal .golf-cell').count(), 9);
await page.click('.sp-modal .btn.ghost'); // Zum Menü
await page.waitForSelector('.gm-primary');
assert.match(await page.locator('.gm-stats').innerText(), /1\s*Runden/);
assert.match(await page.locator('.gm-primary').innerText(), /Runde 2/);

step('Loch des Tages');
await page.click('.gm-daily');
await ready();
assert.match(await page.locator('.cg-hud b').innerText(), /Loch des Tages/);
await S(async () => {
  const P = window.__golf;
  const r = P.solution();
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(400);
await page.click('.sp-modal .btn.primary');
await page.waitForSelector('.gm-daily.done');

step('Klassisch, schmales Gerät');
await page.locator('.gm-seg button').nth(1).click();
await page.setViewportSize({ width: 375, height: 667 });
await page.click('.gm-primary');
await ready();
assert.equal(await S(() => window.__golf.state.wrap), false);
await noPageScroll();
const fits = await S(() => {
  const b = document.querySelector('.ctable').getBoundingClientRect();
  return [...document.querySelectorAll('.pcard:not(.hidden-card)')].every((c) => {
    const r = c.getBoundingClientRect();
    return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  });
});
assert.ok(fits, 'alle Karten innerhalb der Spielfläche');
await shot('09-narrow');

await browser.close();
assert.deepEqual(errors, [], 'keine Konsolenfehler');
console.log('✓ Golf e2e ok');
