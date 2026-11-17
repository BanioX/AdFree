// End-to-End-Test (Playwright, iPhone 13):
//   python3 -m http.server 8301 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node tripeaks/tests/e2e.mjs
// Startet über das Menü, klickt das Tutorial durch, spielt mit echten Taps (Karten, Talon) und
// Ziehen, prüft Rückgängig und Neuladen mitten in der Runde, spielt bis zum Gewinnblatt, löst das
// Tagesrätsel, prüft 375 px Breite und dass keine Konsolenfehler auftreten.
// Screenshots: tripeaks/tests/out/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8301/tripeaks/';
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
    const g = window.__tripeaks && window.__tripeaks.game;
    return g && !g.dead && g.st && g.g && !g.busy && !g.table.locked && document.querySelector('.cg-hud b').textContent;
  });
  await S(() => window.__tripeaks.idle());
}

async function tapCard(id) {
  const r = await S((i) => window.__tripeaks.rect(i), id);
  await page.touchscreen.tap(r.x, r.y);
}

async function tapMove(m) {
  if (m.t === 'draw') await tapCard(await S(() => window.__tripeaks.stockId()));
  else await tapCard(m.i);
  await page.waitForTimeout(60);
  await ready();
}

const movesCount = () => S(() => window.__tripeaks.game.moves.length);

step('Menü');
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await noPageScroll();
await shot('01-menu');

step('Spielen → Tutorial beim ersten Start');
await page.click('.gm-primary');
await page.waitForSelector('.tut-card');
await page.waitForTimeout(1800);
await shot('02-tutorial');
for (let i = 0; i < 4; i++) { await page.click('.tut-next'); await page.waitForTimeout(350); }
await page.waitForSelector('.tut-backdrop', { state: 'detached' });

step('Runde wird ausgeteilt, Coach-Mark sichtbar');
await ready();
await noPageScroll();
assert.ok(await S(() => document.querySelector('.pc-ring').classList.contains('show')), 'Coach-Ring sichtbar');
await shot('03-game');

step('Mit echten Taps spielen (Lösungsweg)');
const sol = await S(() => window.__tripeaks.solution().moves);
assert.ok(sol.length > 20, 'Runde lösbar');
for (const m of sol.slice(0, 10)) {
  const before = await movesCount();
  await tapMove(m);
  assert.equal(await movesCount(), before + 1, 'Tap-Zug angenommen: ' + JSON.stringify(m));
}
assert.ok(!(await S(() => document.querySelector('.pc-ring').classList.contains('show'))), 'Coach-Ring weg');
assert.ok(await S(() => window.__tripeaks.state.score > 0), 'Punkte gesammelt');
await shot('04-midgame');

step('Unpassende Karte: kein Zug');
const n0 = await movesCount();
const unplayable = await S(() => {
  const g = window.__tripeaks.game;
  const free = [];
  for (let i = 0; i < 28; i++) if (!(g.st.tm & (1 << i)) && g.table.cards[i].up) free.push(i);
  const top = g.st.top % 13 + 1;
  return free.find((i) => { const r = g.st.tab[i] % 13 + 1; const d = Math.abs(r - top); return d !== 1 && d !== 12; }) ?? null;
});
if (unplayable != null) {
  await tapCard(unplayable);
  await page.waitForTimeout(250);
  assert.equal(await movesCount(), n0, 'kein Zug');
}

step('Rückgängig');
const scoreBefore = await S(() => window.__tripeaks.state.score);
await page.click('[data-tool="undo"]');
await ready();
assert.equal(await movesCount(), n0 - 1);
assert.ok((await S(() => window.__tripeaks.state.score)) <= scoreBefore);
await tapMove(sol[n0 - 1]);

step('Ziehen auf die Ablage (Drag)');
const dm = await S(() => { const r = window.__tripeaks.solution(); return r.moves.find((m, k) => k === 0 && m.t === 'play') || null; });
if (dm) {
  const a = await S((i) => window.__tripeaks.rect(i), dm.i);
  const w = await S(() => { const g = window.__tripeaks.game; const id = g.pile[g.pile.length - 1]; return window.__tripeaks.rect(id); });
  const before = await movesCount();
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 4, a.y + 8, { steps: 2 });
  await page.mouse.move(w.x, w.y, { steps: 10 });
  await page.mouse.up();
  await ready();
  assert.equal(await movesCount(), before + 1, 'Drag angenommen');
}

step('Neuladen mitten in der Runde');
const snap = await S(() => JSON.stringify([window.__tripeaks.state.tm, window.__tripeaks.state.ptr, window.__tripeaks.state.score]));
await page.reload();
await ready();
assert.equal(await S(() => JSON.stringify([window.__tripeaks.state.tm, window.__tripeaks.state.ptr, window.__tripeaks.state.score])), snap);

step('Tipp');
await page.click('[data-tool="hint"]');
await page.waitForTimeout(200);
assert.ok(await S(() => !!document.querySelector('.pcard.hint')), 'Tipp leuchtet');

step('Zu Ende spielen → Gewinnblatt');
await S(async () => {
  const P = window.__tripeaks;
  const r = P.solution();
  if (!r.solved) throw new Error('nicht mehr lösbar');
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForTimeout(1250);
await shot('05a-fan');
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(700);
await shot('05-win');
const txt = await page.locator('.sp-modal').innerText();
assert.match(txt, /Runde 1/);
assert.match(txt, /Punkte/);

step('Nächste Runde');
await page.click('.sp-modal .btn.primary');
await ready();
assert.equal(await S(() => window.__tripeaks.game.n), 2);

step('Menü zeigt Punkte');
await page.click('.cg-top a.icon-btn');
await page.waitForSelector('.gm-primary');
assert.match(await page.locator('.gm-stats').innerText(), /1\s*Gelöst/);

step('Tagesrätsel');
await page.click('.gm-daily');
await ready();
assert.match(await page.locator('.cg-hud b').innerText(), /des Tages/);
await S(async () => {
  const P = window.__tripeaks;
  const r = P.solution();
  for (const m of r.moves) { await P.play(m); await P.idle(); }
});
await page.waitForSelector('.sp-modal h2', { timeout: 8000 });
await page.waitForTimeout(400);
await page.click('.sp-modal .btn.primary');
await page.waitForSelector('.gm-daily.done');

step('Modus «Normal» (ohne Umlauf), schmales Gerät');
await page.locator('.gm-seg button').nth(1).click();
await page.setViewportSize({ width: 375, height: 667 });
await page.click('.gm-primary');
await ready();
assert.equal(await S(() => window.__tripeaks.state.wrap), false);
await noPageScroll();
const fits = await S(() => {
  const b = document.querySelector('.ctable').getBoundingClientRect();
  return [...document.querySelectorAll('.pcard:not(.hidden-card)')].every((c) => {
    const r = c.getBoundingClientRect();
    return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  });
});
assert.ok(fits, 'alle Karten innerhalb der Spielfläche');
await shot('06-narrow');

step('Runde abschliessen, wenn nichts mehr geht');
await S(async () => {
  const P = window.__tripeaks;
  // ungeschickt spielen: immer zuerst ziehen, dann die erste passende Karte
  for (let k = 0; k < 80; k++) {
    const g = P.game;
    if (g.over) break;
    let m = null;
    if (g.st.ptr < 23) m = { t: 'draw' };
    else {
      m = P.legal()[0] || null;
    }
    if (!m) break;
    await P.play(m); await P.idle();
  }
});
await page.waitForSelector('.sp-modal h2', { timeout: 4000 });
await shot('07-stuck');
assert.match(await page.locator('.sp-modal h2').innerText(), /Talon leer/);
await page.locator('.sp-modal .btn.primary').click();
await page.waitForSelector('.sp-modal h2:text("Runde beendet")');
await page.locator('.sp-modal .btn.ghost').click();
await page.waitForSelector('.gm-primary');
assert.match(await page.locator('.gm-primary').innerText(), /Runde 2/);

await browser.close();
assert.deepEqual(errors, [], 'keine Konsolenfehler');
console.log('✓ Gipfel e2e ok');
