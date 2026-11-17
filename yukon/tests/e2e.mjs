// End-to-End-Test Yukon (Playwright, iPhone 13):
//   python3 -m http.server 8302 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node yukon/tests/e2e.mjs
// Gemeinsamer Ablauf siehe lib/cards/tests/e2e-kit.mjs; hier zusätzlich «Automatisch beenden».
import assert from 'node:assert/strict';
import { runE2E } from '../../lib/cards/tests/e2e-kit.mjs';

await runE2E({
  id: 'yukon',
  port: 8302,
  modes: 2,
  async beforeWin({ page, S, ready, shot, step }) {
    step('Bis alle Karten offen sind → «Automatisch beenden»');
    await S(async () => {
      const P = window.__pat;
      const sol = P.solve();
      for (const m of sol) {
        if (P.state.down.every((d) => d === 0)) break;
        P.play(m);
        await new Promise((r) => setTimeout(r, 20));
      }
    });
    await ready();
    await page.waitForSelector('.pt-finish:not(.hide)', { timeout: 4000 });
    await shot('06b-finish');
    await page.click('.pt-finish');
    await page.waitForSelector('.sp-modal h2', { timeout: 20000 });
    await page.waitForTimeout(500);
    await shot('07-fan');
    assert.match(await page.locator('.sp-modal').innerText(), /Geschafft/);
    await page.click('.sp-modal .btn.primary');
    await ready();
    assert.match(await page.locator('.cg-hud b').innerText(), /Spiel 2/);
  },
});
