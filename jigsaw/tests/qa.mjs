// Regressionstest zu QA-Befunden «Puzzle» (Playwright, schmales iPhone 375×667):
//   Werkzeugleiste passt bei 108 Teilen, Filter-Chips ≥ 44 px, Hinweis-Blase verdeckt die Chips nicht,
//   Leisten-Teil bleibt beim Heben im DOM, zweiter Finger übernimmt das Ziehen nicht,
//   Uhr steht während Vorschau/Anleitung, Neuladen auf dem Gewinn-Blatt → Menü,
//   «Nächstes Bild» bleibt im Farbenzauber-Pack.
//
//   Server (Repo-Wurzel):  python3 -m http.server 8223 --bind 127.0.0.1
//   Start:                 node jigsaw/tests/qa.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8223/jigsaw/';

const errors = [];
let failed = false;
function check(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.log('  ✗', msg); failed = true; }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 8'], deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.setItem('spielpause.tutorial.jigsaw', 'true'));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id || 0 })) });
const J = (fn, arg) => page.evaluate(fn, arg);
const ready = () => page.waitForFunction(() => window.__jigsaw && window.__jigsaw.ready(), null, { timeout: 20000 });
const rect = (sel) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
const stats = () => J(() => JSON.parse(localStorage.getItem('spielpause.jigsaw.stats') || '{}'));

async function touchDrag(from, to, steps = 10) {
  await touch('touchStart', [from]);
  await page.waitForTimeout(16);
  const up = { x: from.x, y: from.y - 24 };
  await touch('touchMove', [up]);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    await touch('touchMove', [{ x: up.x + (to.x - up.x) * t, y: up.y + (to.y - up.y) * t }]);
    await page.waitForTimeout(8);
  }
  await touch('touchEnd', []);
}

/** Alle Teile bis auf eines direkt legen, das letzte per Touch einrasten → Gewinn-Blatt. */
async function solve() {
  const last = await J(() => { const s = window.__jigsaw.state(); const ids = s.tray.slice(); window.__jigsaw.debugPlace(ids.slice(0, -1)); return ids[ids.length - 1]; });
  await page.waitForTimeout(300);
  const from = await J((k) => window.__jigsaw.trayPoint(k), last);
  await page.waitForTimeout(60);
  const again = await J((k) => window.__jigsaw.trayPoint(k), last);
  const target = await J((k) => window.__jigsaw.targetPoint(k), last);
  const lift = await J(() => window.__jigsaw.lift());
  if (!from) throw new Error('letztes Teil fehlt');
  await touchDrag(again, { x: target.x, y: target.y + lift });
  await page.getByText('Geschafft!').waitFor({ timeout: 12000 });
  await page.waitForTimeout(600);
}

try {
  console.log('Schmales iPhone, 108 Teile');
  await page.goto(BASE + '#play/wiesen%2Fmohnfeld@108');
  await ready();
  await page.waitForTimeout(600);
  const n = await J(() => window.__jigsaw.geo().count);
  check(n === 108, `108 Teile (ist ${n})`);
  const tools = await page.locator('.pz-tool').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
  check(Math.max(...tools) <= 375 - 4, `Werkzeugleiste passt (rechter Rand ${Math.round(Math.max(...tools))})`);
  const chipH = await page.locator('.pz-chip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  check(Math.min(...chipH) >= 44, `Filter-Chips ≥ 44 px hoch (${chipH.map(Math.round).join('/')})`);
  const scrolls = await J(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
  check(scrolls, 'kein Seiten-Scrollen');
  check(await page.locator('.pz-coach').count() === 1, 'Hinweis beim ersten Spiel');
  const bub = await rect('.pz-coach-text'), fil = await rect('.pz-filter');
  const overlap = !(bub.r <= fil.l || bub.l >= fil.r || bub.b <= fil.t || bub.t >= fil.b);
  check(!overlap, 'Hinweis-Blase verdeckt die Filter-Chips nicht');
  check(bub.r <= 375, `Hinweis-Blase im Bild (rechts ${Math.round(bub.r)})`);
  await page.screenshot({ path: path.join(OUT, 'qa-se-108.png') });

  console.log('Teil aus der Leiste heben, zweiter Finger');
  const first = await J(() => window.__jigsaw.state().tray.find((i) => !document.querySelector(`.pz-ti[data-i="${i}"]`).classList.contains('hide')));
  await J((k) => window.__jigsaw.trayPoint(k), first);
  await page.waitForTimeout(60);
  const a = await J((k) => window.__jigsaw.trayPoint(k), first);
  await touch('touchStart', [{ ...a, id: 1 }]);
  await page.waitForTimeout(16);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: a.x, y: a.y - 20 * k, id: 1 }]); await page.waitForTimeout(10); }
  const liftedEl = await J((k) => { const el = document.querySelector(`.pz-ti[data-i="${k}"]`); return !!el && el.isConnected && el.classList.contains('lifted'); }, first);
  check(liftedEl, 'gehobenes Leisten-Teil bleibt bis zum Loslassen im DOM (iOS)');
  const before = await J((k) => window.__jigsaw.piecePoint(k), first);
  // zweiter Finger auf den Tisch, dann beide bewegen
  const f2 = { x: 300, y: 120, id: 2 };
  await touch('touchStart', [{ x: a.x, y: a.y - 120, id: 1 }, f2]);
  await page.waitForTimeout(16);
  for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: a.x + 12 * k, y: a.y - 120 - 20 * k, id: 1 }, { x: f2.x - 10 * k, y: f2.y + 10 * k, id: 2 }]); await page.waitForTimeout(10); }
  const after = await J((k) => window.__jigsaw.piecePoint(k), first);
  check(after.x - before.x > 40 && before.y - after.y > 100, 'erstes Teil folgt weiter dem ersten Finger');
  await touch('touchEnd', [{ x: f2.x - 50, y: f2.y + 50, id: 2 }]); // Finger 1 hebt ab
  await page.waitForTimeout(350);
  const dropped = await J((k) => { const s = window.__jigsaw.state(); return { inOrder: s.order.includes(s.pieces[k].g) || s.pieces[k].s === 2, gone: !document.querySelector(`.pz-ti[data-i="${k}"]`) }; }, first);
  check(dropped.inOrder && dropped.gone, 'Teil liegt nach dem Loslassen auf dem Tisch, Leisten-Element weg');
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const tbl = await rect('.pz-table'), pp = await J((k) => window.__jigsaw.piecePoint(k), first);
  check(pp.y < tbl.b - 4, 'Teil nicht unter der Leiste verschwunden');

  console.log('Uhr während Vorschau und Anleitung');
  const t0 = await J(() => window.__jigsaw.state().time);
  await page.locator('.pz-tool[aria-label="Bild ansehen"]').tap();
  await page.waitForTimeout(3500);
  await page.locator('.pz-preview').tap();
  await page.waitForTimeout(400);
  await page.locator('button[aria-label="So geht’s"]').tap();
  await page.waitForSelector('.tut-card');
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /Überspringen|Los geht|Fertig|Schliessen/ }).first().tap();
  await page.waitForTimeout(1200);
  const t1 = await J(() => window.__jigsaw.state().time);
  check(t1 - t0 < 3500, `Zeit läuft während der Überlagerungen nicht weiter (+${Math.round((t1 - t0) / 100) / 10} s in ~8 s)`);

  console.log('Gewinn-Blatt: Neuladen landet im Menü');
  await page.goto(BASE + '#play/farben%2Fa-rose@12');
  await ready();
  const started = (await stats()).started || 0;
  await solve();
  check(!(await J(() => location.hash)), 'Hash nach dem Lösen entfernt');
  await page.reload();
  await page.waitForSelector('.gm-primary', { timeout: 15000 });
  await page.waitForTimeout(500);
  check(await page.locator('.pz-root').count() === 0, 'nach Neuladen im Menü statt neuem Puzzle');
  const started2 = (await stats()).started || 0;
  check(started2 === started, `«Begonnen» nicht doppelt gezählt (${started} → ${started2})`);

  console.log('«Nächstes Bild» im Farbenzauber-Pack');
  await page.goto(BASE + '#play/farben%2Fa-rose@24');
  await ready();
  const n24 = await J(() => window.__jigsaw.geo().count);
  check(n24 === 24 || n24 === 25, `Stufe 24 auf Farbenzauber-Bild (${n24})`);
  await solve();
  await page.screenshot({ path: path.join(OUT, 'qa-win.png') });
  await page.getByRole('button', { name: /Nächstes Bild/ }).tap();
  await page.waitForFunction(() => /#play\//.test(location.hash), null, { timeout: 10000 });
  const nextHash = decodeURIComponent(await J(() => location.hash));
  check(/^#play\/farben\//.test(nextHash) && !nextHash.includes('a-rose'), `nächstes Bild aus demselben Pack (${nextHash})`);
  await ready();

  check(errors.length === 0, 'Keine Konsolenfehler' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
} catch (e) {
  console.log('  ✗ Abbruch:', e.message);
  failed = true;
  await page.screenshot({ path: path.join(OUT, 'qa-fail.png') }).catch(() => {});
}
await browser.close();
console.log(failed ? '\nQA: FEHLER' : '\nQA: OK');
process.exit(failed ? 1 : 0);
