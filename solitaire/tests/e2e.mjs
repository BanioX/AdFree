// End-to-End-Test (Playwright, iPhone 13):
//   python3 -m http.server 8201 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node solitaire/tests/e2e.mjs
// Spielt eine Klondike-Partie mit echten Gesten (Ziehen, Antippen) an, prüft Rückgängig, Tipp,
// Neuladen mitten im Spiel, spielt bis zum Gewinnblatt, löst das Tagesrätsel, prüft Spider bei 375 px
// und dass keine Konsolenfehler auftreten. Screenshots: solitaire/tests/out/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8201/solitaire/';
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

async function idle() {
  await page.waitForFunction(() => window.__solitaire && window.__solitaire.game && !window.__solitaire.game.busy);
  await S(() => window.__solitaire.idle());
}

async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** Spielt die Partie mit dem Löser zu Ende (über den Test-Zugang, mit allen Animationen). */
async function solveToEnd() {
  await S(async () => {
    const T = window.__solitaire;
    for (let round = 0; round < 40 && !T.isWon(); round++) {
      const r = await T.solution(9000);
      if (!r || !r.solved) throw new Error('Löser findet keinen Weg');
      for (const a of r.moves) {
        const before = JSON.stringify(T.state.piles);
        await T.play(a);
        await T.idle();
        if (T.isWon()) break;
        if (JSON.stringify(T.state.piles) === before) break; // abgewichen (z.B. Auto-Ablage) → neu lösen
      }
    }
  });
}

// ------------------------------------------------------------ 1. Erster Start: Tutorial, Menü
step('Erster Start mit Tutorial');
await page.goto(BASE);
await page.waitForSelector('.tut-card');
await page.waitForTimeout(900);
await shot('e2e-01-tutorial');
await page.locator('.tut-skip').tap();
await page.waitForSelector('.tut-backdrop', { state: 'detached' });
await page.waitForSelector('.gm-primary');
assert.match(await page.locator('.gm-primary').innerText(), /Spielen/);
assert.equal(await page.locator('.gm-daily').count(), 3, 'drei Tagesrätsel');
await noPageScroll();
await shot('e2e-02-menu');

// ------------------------------------------------------------ 2. Klondike: echte Gesten
step('Klondike starten');
await page.locator('.gm-primary').tap();
await page.waitForFunction(() => location.hash === '#play/klondike1');
await idle();
await page.waitForSelector('.coach-ring');
await noPageScroll();
await shot('e2e-03-klondike');

step('Züge mit Ziehen und Antippen');
const sol = await S(() => window.__solitaire.solution(9000));
assert.ok(sol.solved, 'Partie ist lösbar (Löser)');
let real = 0;
for (const a of sol.moves.slice(0, 10)) {
  if (a.t === 'stock') {
    const p = await S(() => window.__solitaire.pilePoint(0)); // Klondike: Stapel 0 = Talon
    await page.touchscreen.tap(p.x, p.y);
  } else {
    const id = await S((a) => window.__solitaire.state.piles[a.from][a.index], a);
    const from = await S((id) => window.__solitaire.cardPoint(id), id);
    const to = await S((p) => window.__solitaire.pilePoint(p), a.to);
    await drag(from, to);
  }
  await idle();
  real++;
}
const movesAfter = await S(() => window.__solitaire.session.moves);
assert.ok(movesAfter >= real, `Züge gezählt (${movesAfter})`);
assert.equal(await page.locator('.coach-ring').count(), 0, 'Coach-Mark verschwindet nach dem ersten Zug');

step('Rückgängig');
const beforeUndo = await S(() => JSON.stringify(window.__solitaire.state.piles));
const legal = await S(() => {
  const T = window.__solitaire; const st = T.state;
  // irgendeinen Zug per Antippen: oberste offene Karte einer Spalte, die ein Ziel hat
  return st.piles.map((a, p) => ({ p, id: a[a.length - 1] })).filter((x) => x.id != null && st.up[x.id] && x.p >= 6); // Spalten
});
let tapped = false;
for (const c of legal) {
  const pt = await S((id) => window.__solitaire.cardPoint(id), c.id);
  await page.touchscreen.tap(pt.x, pt.y);
  await idle();
  if ((await S(() => JSON.stringify(window.__solitaire.state.piles))) !== beforeUndo) { tapped = true; break; }
}
if (tapped) {
  await page.locator('.tool', { hasText: 'Zurück' }).tap();
  await idle();
  assert.equal(await S(() => JSON.stringify(window.__solitaire.state.piles)), beforeUndo, 'Rückgängig stellt den Stand wieder her');
}

step('Tipp');
await page.locator('.tool', { hasText: 'Tipp' }).tap();
await page.waitForFunction(() => document.querySelector('.card.hint') || document.querySelector('.drop-glow.show'), null, { timeout: 4000 });

step('Neuladen mitten im Spiel');
await page.waitForTimeout(1200);
const snap = await S(() => ({ piles: JSON.stringify(window.__solitaire.state.piles), moves: window.__solitaire.session.moves }));
await page.reload();
await idle();
const snap2 = await S(() => ({ piles: JSON.stringify(window.__solitaire.state.piles), moves: window.__solitaire.session.moves }));
assert.deepEqual(snap2, snap, 'Spielstand nach Neuladen identisch');
assert.equal(await page.locator('.tut-card').count(), 0, 'Tutorial nur beim ersten Start');

step('Partie zu Ende spielen');
await solveToEnd();
await page.waitForSelector('.sp-modal .win', { timeout: 20000 });
await page.waitForTimeout(400);
assert.match(await page.locator('.sp-modal').innerText(), /Gewonnen/);
await shot('e2e-04-win');
await page.locator('.sp-modal-buttons button', { hasText: 'Zum Menü' }).tap();
await page.waitForSelector('.gm-primary');
await page.waitForTimeout(300);
assert.match(await page.locator('.gm-stats').innerText(), /^1\s/m, 'Statistik zeigt einen Sieg');

// ------------------------------------------------------------ 3. Tagesrätsel
step('Tagesrätsel');
await page.locator('.gm-daily').first().tap();
await page.waitForFunction(() => location.hash === '#daily');
await idle();
assert.match(await page.locator('.hud b').innerText(), /des Tages/);
await solveToEnd();
await page.waitForSelector('.sp-modal .win', { timeout: 20000 });
assert.match(await page.locator('.sp-modal').innerText(), /Tagesrätsel gelöst/);
await page.locator('.sp-modal-buttons button', { hasText: 'Zum Menü' }).tap();
await page.waitForSelector('.gm-daily.done');
await shot('e2e-05-menu-daily-done');

// ------------------------------------------------------------ 4. FreeCell & Spider (Darstellung)
step('FreeCell und Spider');
await page.goto(BASE + '#play/freecell');
await idle();
await noPageScroll();
await shot('e2e-06-freecell');

const ctx2 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, viewport: { width: 375, height: 667 } });
await ctx2.addInitScript(() => localStorage.setItem('spielpause.tutorial.solitaire', 'true'));
const p2 = await ctx2.newPage();
p2.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await p2.goto(BASE + '#play/spider2');
await p2.waitForFunction(() => window.__solitaire && window.__solitaire.game && !window.__solitaire.game.busy);
await p2.evaluate(() => window.__solitaire.idle());
const box = await p2.evaluate(() => {
  const cs = [...document.querySelectorAll('.card')].map((c) => c.getBoundingClientRect());
  return { minX: Math.min(...cs.map((r) => r.left)), maxX: Math.max(...cs.map((r) => r.right)), w: innerWidth, cw: cs[0].width };
});
assert.ok(box.minX >= 0 && box.maxX <= box.w, `Spider passt in 375 px (${JSON.stringify(box)})`);
assert.ok(box.cw >= 30, 'Spider-Karten gross genug');
await p2.screenshot({ path: OUT + 'e2e-07-spider375.png' });
await ctx2.close();

// ------------------------------------------------------------ Ende
await browser.close();
assert.deepEqual(errors, [], 'keine Konsolenfehler');
console.log('✓ e2e ok');
