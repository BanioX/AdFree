// Schrauben & Muttern – End-to-End-Test (Playwright, iPhone 13, deviceScaleFactor 1).
// Start: Server aus dem Repo-Wurzelverzeichnis
//   python3 -m http.server 8306 --bind 127.0.0.1
//   node screws/tests/e2e.mjs
// Screenshots landen in screws/tests/out/ (nicht eingecheckt).
import assert from 'node:assert/strict';
import { runE2E } from '../../lib/sorting/tests/e2e-common.mjs';

await runE2E({
  id: 'screws',
  base: process.env.BASE || 'http://127.0.0.1:8306/screws/',
  out: new URL('./out/', import.meta.url).pathname,
  async finalChecks({ page, shot, playMoves, waitBoard, step, base }) {
    // Verdeckte Muttern (Level 15): eine Mutter zeigt sich, sobald sie oben liegt
    step('Verdeckte Muttern');
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('spielpause.screws.progress'));
      p.level = 15;
      localStorage.setItem('spielpause.screws.progress', JSON.stringify(p));
    });
    await page.goto(base + '#level/15');
    await page.reload();
    await waitBoard();
    const hiddenBefore = await page.locator('.sn-nut.sb-hidden').count();
    assert.ok(hiddenBefore > 0, 'verdeckte Muttern sichtbar');
    await playMoves(3);
    const hiddenAfter = await page.locator('.sn-nut.sb-hidden').count();
    const runHidden = await page.evaluate(() => window.__sg.run.hidden.flat().filter(Boolean).length);
    assert.ok(hiddenAfter < hiddenBefore, 'Muttern wurden aufgedeckt');
    assert.equal(hiddenAfter, runHidden, 'Anzeige und Spielstand stimmen überein');
    await shot('11-hidden');
    await page.reload();
    await waitBoard();
    assert.equal(await page.locator('.sn-nut.sb-hidden').count(), hiddenAfter, 'aufgedeckte Muttern bleiben nach Neuladen offen');
  },
});
