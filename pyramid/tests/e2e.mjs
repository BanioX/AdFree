// End-to-End-Test (Playwright, iPhone 13):
//   python3 -m http.server 8301 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node pyramid/tests/e2e.mjs
// Startet über das Menü, klickt das Tutorial durch, spielt mit echten Taps (Paare, König, Talon),
// prüft Rückgängig und Neuladen mitten im Spiel, spielt bis zum Gewinnblatt, löst das
// Tagesrätsel, prüft 375 px Breite und dass keine Konsolenfehler auftreten.
// Screenshots: pyramid/tests/out/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8301/pyramid/';
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
    const g = window.__pyramid && window.__pyramid.game;
    return g && !g.dead && g.clock && !g.busy && !g.table.locked && document.querySelector('.cg-hud b').textContent;
  });
  await S(() => window.__pyramid.idle());
}

async function tapCard(id) {
  const r = await S((i) => window.__pyramid.rect(i), id);
  await page.touchscreen.tap(r.x, r.y);
}

async function tapStock() {
  const p = await S(() => {
    const s = window.__pyramid.game.table.slots.get('stock').getBoundingClientRect();
    return { x: s.left + s.width / 2, y: s.top + s.height / 2 };
  });
  await page.touchscreen.tap(p.x, p.y);
}

/** Einen Zug mit echten Taps ausführen */
async function tapMove(m) {
  if (m.t === 'draw' || m.t === 'redeal') { await tapStock(); }
  else {
    await tapCard(await S((ref) => window.__pyramid.idOf(ref), m.a));
    if (m.b != null) {
      await page.waitForTimeout(60);
      await tapCard(await S((ref) => window.__pyramid.idOf(ref), m.b));
    }
  }
  await page.waitForTimeout(80);
  await ready();
}

const movesCount = () => S(() => window.__pyramid.game.moves.length);

// ------------------------------------------------------------------ Menü
step('Menü');
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await noPageScroll();
await shot('01-menu');

step('Spielen → Tutorial beim ersten Start');
await page.click('.gm-primary');
await page.waitForSelector('.tut-card');
await page.waitForTimeout(1600);
await shot('02-tutorial');
for (let i = 0; i < 4; i++) { await page.click('.tut-next'); await page.waitForTimeout(350); }
await page.waitForSelector('.tut-backdrop', { state: 'detached' });

step('Partie wird ausgeteilt, Coach-Mark sichtbar');
await ready();
await noPageScroll();
assert.ok(await S(() => document.querySelector('.pc-ring').classList.contains('show')), 'Coach-Ring sichtbar');
await shot('03-game');

// ------------------------------------------------------------------ echte Taps
step('Mit echten Taps spielen (Lösungsweg)');
const sol = await S(() => window.__pyramid.solution().moves);
assert.ok(sol.length > 10, 'Partie lösbar');
for (const m of sol.slice(0, 8)) {
  const before = await movesCount();
  await tapMove(m);
  assert.equal(await movesCount(), before + 1, 'Tap-Zug angenommen: ' + JSON.stringify(m));
}
assert.ok(!(await S(() => document.querySelector('.pc-ring').classList.contains('show'))), 'Coach-Ring nach dem ersten Zug weg');
await shot('04-midgame');

step('Ungültiger Tap: bedeckte Karte wackelt, kein Zug');
const n0 = await movesCount();
await tapCard(0); // Spitze ist bedeckt
await page.waitForTimeout(300);
assert.equal(await movesCount(), n0);

step('Rückgängig');
await page.click('[data-tool="undo"]');
await ready();
assert.equal(await movesCount(), n0 - 1);
await tapMove(sol[n0 - 1]);
assert.equal(await movesCount(), n0);

step('Ziehen & Ablegen (Drag) eines Paares');
const dragMove = await S(() => {
  const g = window.__pyramid.game;
  const r = window.__pyramid.solution();
  const m = r.moves[0];
  return m && m.t === 'rm' && m.b != null ? m : null;
});
if (dragMove) {
  const a = await S((ref) => window.__pyramid.rect(window.__pyramid.idOf(ref)), dragMove.a);
  const b = await S((ref) => window.__pyramid.rect(window.__pyramid.idOf(ref)), dragMove.b);
  const before = await movesCount();
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 5, a.y + 6, { steps: 2 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await ready();
  assert.equal(await movesCount(), before + 1, 'Drag-Zug angenommen');
}

step('Neuladen mitten im Spiel → Spielstand bleibt');
const snap = await S(() => JSON.stringify({ pm: window.__pyramid.state.pm, sm: window.__pyramid.state.sm, ptr: window.__pyramid.state.ptr, n: window.__pyramid.game.moves.length }));
await page.reload();
await ready();
const snap2 = await S(() => JSON.stringify({ pm: window.__pyramid.state.pm, sm: window.__pyramid.state.sm, ptr: window.__pyramid.state.ptr, n: window.__pyramid.game.moves.length }));
assert.equal(snap2, snap, 'gleicher Stand nach Neuladen');
assert.equal(await page.locator('.tut-card').count(), 0, 'Tutorial nicht nochmals');

step('Tipp zeigt einen Zug');
await page.click('[data-tool="hint"]');
await page.waitForTimeout(200);
assert.ok(await S(() => !!document.querySelector('.pcard.hint, .pslot.hint')), 'Tipp leuchtet');

step('Zu Ende spielen (Löser, mit Animationen) → Gewinnblatt');
await S(async () => {
  const P = window.__pyramid;
  const r = P.solution();
  if (!r.solved) throw new Error('nicht mehr lösbar');
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForTimeout(1250);
await shot('05a-fan');
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(700);
await shot('05-win');
const winText = await page.locator('.sp-modal').innerText();
assert.match(winText, /Partie 1/);
assert.match(winText, /Nächste Partie/);

step('Nächste Partie');
await page.click('.sp-modal .btn.primary');
await ready();
assert.equal(await S(() => window.__pyramid.game.n), 2);
assert.equal(await movesCount(), 0);

step('Zurück ins Menü: Statistik zeigt den Gewinn');
await page.click('.cg-top a.icon-btn');
await page.waitForSelector('.gm-primary');
const statTxt = await page.locator('.gm-stats').innerText();
assert.match(statTxt, /1\s*Gewonnen/);

// ------------------------------------------------------------------ Tagesrätsel
step('Tagesrätsel lösen');
await page.click('.gm-daily');
await ready();
assert.match(await page.locator('.cg-hud b').innerText(), /des Tages/);
await S(async () => {
  const P = window.__pyramid;
  const r = P.solution();
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(500);
await page.click('.sp-modal .btn.primary'); // Zum Menü
await page.waitForSelector('.gm-daily.done');

step('Einstellungen: Design wechseln');
await page.click('.gm-sec:nth-child(3)');
await page.waitForSelector('.cg-pick');
await page.locator('.cg-pick.table').nth(3).click();
await page.locator('.cg-picks').first().locator('.cg-pick').nth(4).click();
await shot('06-settings');
await page.click('.sp-modal .btn.primary');

step('Schmales Gerät (375 × 667)');
await page.setViewportSize({ width: 375, height: 667 });
await page.evaluate(() => { location.hash = 'play'; });
await ready();
await page.waitForTimeout(300);
await noPageScroll();
const fits = await S(() => {
  const b = document.querySelector('.ctable').getBoundingClientRect();
  return [...document.querySelectorAll('.pcard:not(.hidden-card)')].every((c) => {
    const r = c.getBoundingClientRect();
    return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  });
});
assert.ok(fits, 'alle Karten innerhalb der Spielfläche');
await shot('07-narrow');

await browser.close();
assert.deepEqual(errors, [], 'keine Konsolenfehler');
console.log('✓ Pyramide e2e ok');
