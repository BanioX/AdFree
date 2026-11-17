// Wollknäuel – End-to-End-Test (Playwright, iPhone 13, deviceScaleFactor 1).
// Start: Server aus dem Repo-Wurzelverzeichnis
//   python3 -m http.server 8306 --bind 127.0.0.1
//   node yarn/tests/e2e.mjs
// Screenshots landen in yarn/tests/out/ (nicht eingecheckt).
import assert from 'node:assert/strict';
import { runE2E } from '../../lib/sorting/tests/e2e-common.mjs';

await runE2E({
  id: 'yarn',
  base: process.env.BASE || 'http://127.0.0.1:8306/yarn/',
  out: new URL('./out/', import.meta.url).pathname,
  async extraChecks({ page, step }) {
    step('Strickkorb in der Spielansicht');
    assert.equal(await page.locator('.yn-basket-pill').count(), 1, 'Korb-Anzeige');
    assert.match(await page.locator('.yn-basket-pill b').textContent(), /^\d+\/\d+$/);
  },
  async finalChecks({ page, shot, step }) {
    step('Strickkorb im Menü');
    const basket = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.yarn.basket')));
    assert.ok(basket && basket.total >= 3, 'Strickstücke gesammelt');
    const cards = page.locator('.yn-basket-card:not(.locked)');
    assert.ok(await cards.count() >= 2, 'freigeschaltete Stücke sichtbar');
    await page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 5000));
    await page.waitForTimeout(400);
    await shot('11-basket');
  },
});
