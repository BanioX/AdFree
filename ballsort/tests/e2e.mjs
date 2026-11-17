// Kugelsortierung – End-to-End-Test (Playwright, iPhone 13, deviceScaleFactor 1).
// Start: Server aus dem Repo-Wurzelverzeichnis
//   python3 -m http.server 8306 --bind 127.0.0.1
//   node ballsort/tests/e2e.mjs
// Screenshots landen in ballsort/tests/out/ (nicht eingecheckt).
import { runE2E } from '../../lib/sorting/tests/e2e-common.mjs';

await runE2E({
  id: 'ballsort',
  base: process.env.BASE || 'http://127.0.0.1:8306/ballsort/',
  out: new URL('./out/', import.meta.url).pathname,
});
