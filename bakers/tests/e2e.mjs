// End-to-End-Test Bäckerdutzend (Playwright, iPhone 13):
//   python3 -m http.server 8302 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node bakers/tests/e2e.mjs
// Gemeinsamer Ablauf siehe lib/cards/tests/e2e-kit.mjs; hier zusätzlich «Automatisch beenden»
// und «nur oberste Karte».
import assert from 'node:assert/strict';
import { runE2E } from '../../lib/cards/tests/e2e-kit.mjs';

await runE2E({
  id: 'bakers',
  port: 8302,
  modes: 2,
  async beforeWin({ page, S, ready, shot, step }) {
    step('Untere Karte antippen: kein Zug');
    const covered = await S(() => { const st = window.__pat.state; const c = st.cols.findIndex((x) => x.length >= 2); return st.cols[c][0]; });
    const n0 = await S(() => window.__pat.game.moves.length);
    const r = await S((i) => { const e = window.__pat.game.table.cards[i].el.getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 6 }; }, covered);
    await page.touchscreen.tap(r.x, r.y);
    await page.waitForTimeout(250);
    assert.equal(await S(() => window.__pat.game.moves.length), n0);

    step('Bis alles geordnet ist → «Automatisch beenden»');
    await S(async () => {
      const P = window.__pat;
      const sol = P.solve();
      for (const m of sol) {
        if (P.game.finishMoves) break;
        P.play(m);
        await new Promise((res) => setTimeout(res, 20));
      }
    });
    await ready();
    await page.waitForSelector('.pt-finish:not(.hide)', { timeout: 4000 });
    await shot('06b-finish');
    await page.click('.pt-finish');
    await page.waitForSelector('.sp-modal h2', { timeout: 20000 });
    assert.match(await page.locator('.sp-modal').innerText(), /Geschafft/);
    await page.click('.sp-modal .btn.primary');
    await ready();
  },
});
