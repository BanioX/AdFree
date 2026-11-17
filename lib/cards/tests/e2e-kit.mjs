// Gemeinsamer End-to-End-Ablauf für Spalten-Patiencen (lib/cards/patience.js), Playwright, iPhone 13.
//   import { runE2E } from '../../lib/cards/tests/e2e-kit.mjs';
//   await runE2E({ id: 'yukon', port: 8302, modes: 2, extra: async (ctx) => { … } });
// Ablauf: Menü → Tutorial → Coach-Mark → echte Taps → verdeckte Karte → Rückgängig → Ziehen
// (Gruppe) → Neuladen → Tipp → Lösen bis zum Gewinnblatt → Neues Spiel → Menü-Statistik →
// Tagesspiel → zweite Variante auf schmalem Gerät → keine Konsolenfehler.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');

export async function runE2E(opts) {
  const { id, port = 8302 } = opts;
  const BASE = process.env.BASE || `http://127.0.0.1:${port}/${id}/`;
  const OUT = new URL(`../../../${id}/tests/out/`, import.meta.url).pathname;
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
      const g = window.__pat && window.__pat.game;
      return g && !g.dead && g.states && g.g && !g.busy && !g.table.locked && document.querySelector('.cg-hud b').textContent;
    }, null, { timeout: 15000 });
    await S(() => window.__pat.idle());
  }

  const movesCount = () => S(() => window.__pat.game.moves.length);

  /** Tippt auf den sichtbaren oberen Rand einer Karte. */
  async function tapCard(cardId) {
    const r = await S((i) => {
      const el = window.__pat.game.table.cards[i].el.getBoundingClientRect();
      return { x: el.left + el.width * 0.5, y: el.top + 6 };
    }, cardId);
    await page.touchscreen.tap(r.x, r.y);
  }

  async function tapMove(m) {
    const lead = await S((mm) => window.__pat.moved(mm)[0], m);
    await tapCard(lead);
    await page.waitForTimeout(80);
    await ready();
  }

  async function solveAll() {
    await S(async () => {
      const P = window.__pat;
      const sol = P.solve();
      if (!sol) throw new Error('nicht lösbar');
      for (const m of sol) { if (P.game.over) break; P.play(m); await new Promise((r) => setTimeout(r, 25)); }
    });
  }

  const tutSteps = opts.tutorialSteps || 4;

  step('Menü');
  await page.goto(BASE);
  await page.waitForSelector('.gm-primary');
  await noPageScroll();
  await shot('01-menu');

  step('Spielen → Tutorial');
  await page.click('.gm-primary');
  await page.waitForSelector('.tut-card');
  await page.waitForTimeout(1800);
  await shot('02-tutorial');
  for (let i = 0; i < tutSteps; i++) { await page.click('.tut-next'); await page.waitForTimeout(450); }
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });

  step('Ausgeteilt, Coach-Mark');
  await ready();
  await noPageScroll();
  assert.ok(await S(() => document.querySelector('.pc-ring').classList.contains('show')), 'Coach-Ring sichtbar');
  assert.match(await page.locator('.cg-hud b').innerText(), /Spiel 1/);
  await shot('03-game');

  step('Echte Taps (Lösungsweg)');
  let tapped = 0;
  for (let k = 0; k < 14 && tapped < 8; k++) {
    const m = await S(() => { const s = window.__pat.solve(); return s && s[0]; });
    if (!m || m.t === 'd') break;
    // Tippen wählt selbst ein Ziel – nur Züge, die eindeutig sind, sicher per Tap
    const best = await S((mm) => { const g = window.__pat.game; const loc = g.locate(window.__pat.moved(mm)[0]); const b = g.bestMove(loc.c, loc.i); return JSON.stringify(b) === JSON.stringify(mm); }, m);
    const before = await movesCount();
    if (best) {
      await tapMove(m);
      assert.equal(await movesCount(), before + 1, 'Tap-Zug: ' + JSON.stringify(m));
      tapped++;
    } else {
      await S((mm) => window.__pat.play(mm), m);
      await ready();
    }
  }
  assert.ok(tapped >= 3, `mindestens 3 echte Taps (${tapped})`);
  assert.ok(await S(() => !document.querySelector('.pc-ring').classList.contains('show')), 'Coach-Ring weg');
  await shot('04-midgame');

  step('Verdeckte Karte antippen: kein Zug');
  const downId = await S(() => { const st = window.__pat.state; for (let c = 0; c < st.cols.length; c++) { if (st.down && st.down[c] > 0) return st.cols[c][0]; } return null; });
  if (downId != null) {
    const n0 = await movesCount();
    await tapCard(downId);
    await page.waitForTimeout(250);
    assert.equal(await movesCount(), n0);
  }

  step('Rückgängig');
  {
    const n0 = await movesCount();
    const snap = await S(() => JSON.stringify(window.__pat.game.states[window.__pat.game.states.length - 2]));
    await page.click('[data-tool="undo"]');
    await ready();
    assert.equal(await movesCount(), n0 - 1);
    assert.equal(await S(() => JSON.stringify(window.__pat.state)), snap);
  }

  step('Ziehen (wenn möglich Gruppe)');
  {
    const m = await S(() => {
      const P = window.__pat;
      const st = P.state;
      const legal = P.legal().filter((x) => x.t === 'm' && st.cols[x.to].length);
      return legal.find((x) => x.idx < st.cols[x.from].length - 1) || legal[0] || null;
    });
    if (m) {
      const lead = await S((mm) => window.__pat.moved(mm)[0], m);
      const a = await S((i) => { const r = window.__pat.game.table.cards[i].el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 6 }; }, lead);
      const t = await S((mm) => { const tg = window.__pat.target(mm); const r = (typeof tg === 'number' ? window.__pat.game.table.cards[tg].el : window.__pat.game.table.slots.get(tg.slot)).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 }; }, m);
      const before = await movesCount();
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x + 4, a.y + 8, { steps: 2 });
      await page.mouse.move(t.x, t.y + 6, { steps: 12 });
      await page.waitForTimeout(80);
      await shot('05-drag');
      await page.mouse.up();
      await ready();
      assert.equal(await movesCount(), before + 1, 'Ziehen angenommen: ' + JSON.stringify(m));
      // und gleich wieder zurück, damit die Partie lösbar bleibt
      await page.click('[data-tool="undo"]');
      await ready();
    }
  }

  step('Neuladen mitten im Spiel');
  {
    const snap = await S(() => JSON.stringify(window.__pat.state));
    const n = await movesCount();
    await page.reload();
    await ready();
    assert.equal(await S(() => JSON.stringify(window.__pat.state)), snap, 'gleiche Stellung nach Neuladen');
    assert.equal(await movesCount(), n);
  }

  step('Tipp');
  await page.click('[data-tool="hint"]');
  await page.waitForTimeout(200);
  assert.ok(await S(() => !!document.querySelector('.pcard.hint, .pslot.hint')), 'Tipp leuchtet');
  await shot('06-hint');

  if (opts.beforeWin) await opts.beforeWin({ page, S, ready, shot, step });

  step('Lösen → Gewinnblatt');
  const noBefore = +(await page.locator('.cg-hud b').innerText()).replace(/\D+/g, '');
  await solveAll();
  await page.waitForTimeout(1500);
  await shot('07-fan');
  await page.waitForSelector('.sp-modal h2', { timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('08-win');
  const winTxt = await page.locator('.sp-modal').innerText();
  assert.match(winTxt, /Geschafft/);
  assert.match(winTxt, /Neues Spiel/);
  await page.click('.sp-modal .btn.primary');
  await ready();
  assert.match(await page.locator('.cg-hud b').innerText(), new RegExp(`Spiel ${noBefore + 1}\\b`));
  assert.equal(await movesCount(), 0);

  step('Menü-Statistik');
  await page.click('.cg-top a.icon-btn');
  await page.waitForSelector('.gm-primary');
  const wonTxt = (await page.locator('.gm-stats').innerText()).match(/(\d+)\s*Gewonnen/);
  assert.ok(wonTxt && +wonTxt[1] >= 1, 'Statistik zählt den Gewinn');

  step('Tagesspiel');
  await page.click('.gm-daily');
  await ready();
  assert.match(await page.locator('.cg-hud b').innerText(), /Tagesspiel/);
  await solveAll();
  await page.waitForSelector('.sp-modal h2', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.click('.sp-modal .btn.primary');
  await page.waitForSelector('.gm-daily.done');
  await shot('09-menu-after');

  if (opts.modes > 1) {
    step('Zweite Variante, schmales Gerät');
    await page.locator('.gm-seg button').nth(1).click();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('.gm-primary');
    await ready();
    await noPageScroll();
    const fits = await S(() => {
      const b = document.querySelector('.ctable').getBoundingClientRect();
      return [...document.querySelectorAll('.pcard:not(.hidden-card)')].every((c) => {
        const r = c.getBoundingClientRect();
        return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
      });
    });
    assert.ok(fits, 'alle Karten innerhalb der Spielfläche');
    if (opts.secondMode) await opts.secondMode({ page, S, ready, shot, step });
    await shot('10-narrow');
  }

  if (opts.extra) await opts.extra({ page, S, ready, shot, step, solveAll });

  await browser.close();
  assert.deepEqual(errors, [], 'keine Konsolenfehler');
  console.log(`✓ ${id} e2e ok`);
}
