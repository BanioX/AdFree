// End-to-End-Test Skorpion (Playwright, iPhone 13):
//   python3 -m http.server 8302 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node scorpion/tests/e2e.mjs
// Gemeinsamer Ablauf siehe lib/cards/tests/e2e-kit.mjs; hier zusätzlich Reserve und fertige Reihe.
import assert from 'node:assert/strict';
import { runE2E } from '../../lib/cards/tests/e2e-kit.mjs';

await runE2E({
  id: 'scorpion',
  port: 8302,
  modes: 2,
  async beforeWin({ page, S, ready, shot, step }) {
    step('Reserve antippen');
    const hadStock = await S(() => window.__pat.state.stock.length);
    if (hadStock) {
      const r = await S(() => window.__pat.slotRect('s'));
      await page.touchscreen.tap(r.x - 6, r.y);
      await ready();
      assert.equal(await S(() => window.__pat.state.stock.length), 0, 'Reserve ausgeteilt');
      await page.click('[data-tool="undo"]');
      await ready();
      assert.equal(await S(() => window.__pat.state.stock.length), 3);
    }
    step('Bis zur ersten fertigen Reihe');
    await S(async () => {
      const P = window.__pat;
      const sol = P.solve();
      for (const m of sol) {
        if (P.state.done.length) break;
        P.play(m);
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    await page.waitForTimeout(150);
    await shot('06c-run');
    await ready();
    assert.equal(await S(() => window.__pat.state.done.length), 1);
    assert.ok(await S(() => +document.querySelector('.pt-meter b').textContent.replace(/\D/g, '') >= 25), 'Fortschritt sichtbar');
  },
});
