// End-to-End-Test für Sudoku (Playwright, iPhone-13-Emulation).
//   1. Server im Repo-Wurzelverzeichnis starten: python3 -m http.server 8204 --bind 127.0.0.1
//   2. node sudoku/tests/e2e.mjs            (Screenshots landen in sudoku/tests/out/)
// Prüft: Start über die Kachel der Startseite, «So geht's», Menü, ganze Runde per Tippen bis zum
// Sieg-Blatt, Neuladen mitten im Spiel, Notizen, Rückgängig, Tipp, Pause, Einstellungen, Statistik,
// Tagesrätsel, «3 Fehler»-Modus, Worker, kleines iPhone (375 px) ohne Scrollen, keine Konsolenfehler.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8204/';
const OUT = process.env.SHOTS || fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const errors = [];
const log = (...a) => console.log('•', ...a);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); log('Screenshot', name); };

function watch(page) {
  // Fehlende Icons anderer (noch im Bau befindlicher) Spiele auf der Startseite ignorieren
  // sowie ready.json der Startseite (entsteht erst beim Build, lokal absichtlich 404)
  const foreign = (url) => (/\/icons\/games\//.test(url || '') && !/sudoku\.svg/.test(url)) || /\/ready\.json$/.test(url || '');
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    if (foreign(m.location() && m.location().url)) return;
    errors.push(`[${m.type()}] ${m.text()} ${(m.location() && m.location().url) || ''}`);
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => { if (!foreign(r.url())) errors.push('[requestfailed] ' + r.url()); });
  page.on('response', (r) => { if (r.status() >= 400 && !foreign(r.url())) errors.push(`[http ${r.status()}] ${r.url()}`); });
}

async function center(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  assert.ok(box, 'Element nicht gefunden: ' + sel);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
// Hinweis: shared/ui.js unterdrückt einen zweiten Klick innerhalb von 320 ms (Doppeltipp-Zoom-Schutz).
// Knöpfe mit «click» brauchen deshalb etwas Abstand; Brett, Zahlenfeld und Werkzeuge reagieren sofort.
async function tapSel(page, sel, wait = 380) {
  const c = await center(page, sel);
  await page.touchscreen.tap(c.x, c.y);
  await page.waitForTimeout(wait);
}
async function tapLoc(page, loc) { await loc.tap(); await page.waitForTimeout(380); }
async function tapCell(page, i) { await tapSel(page, `.cell[data-i="${i}"]`, 30); }
async function tapKey(page, d) { await tapSel(page, `.key[data-d="${d}"]`, 30); }
const game = (page) => page.evaluate(() => window.__sudoku.game());

/** Füllt per Tippen alle leeren Felder bis auf `leave` Stück. */
async function fillByTaps(page, leave = 0, onEach) {
  const g = await game(page);
  const sol = g.solution;
  const empties = [];
  for (let i = 0; i < 81; i++) if (g.values[i] === '0') empties.push(i);
  const todo = empties.slice(0, Math.max(0, empties.length - leave));
  let k = 0;
  for (const i of todo) {
    await tapCell(page, i);
    await tapKey(page, +sol[i]);
    k++;
    if (onEach) await onEach(k, todo.length, i);
  }
  return empties.slice(todo.length);
}

async function closeModal(page, label) {
  const btn = page.locator('.sp-modal .btn', { hasText: label }).first();
  await btn.waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
  await btn.tap();
  await page.waitForTimeout(400);
}

/** Wartet auf das Tutorial («So geht's») und schliesst es. */
async function skipTutorial(page) {
  await page.waitForSelector('.tut-backdrop.show .tut-skip');
  await page.waitForTimeout(350);
  await page.locator('.tut-skip').tap();
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watch(page);

  // ---------- Start über die Startseite ----------
  await page.goto(BASE);
  await page.waitForSelector('a.tile[href="sudoku/"]');
  await shot(page, '00-hub');
  await tapLoc(page, page.locator('a.tile[href="sudoku/"]'));
  await page.waitForURL(/sudoku\/$/);
  // Tutorial beim ersten Start: 4 animierte Schritte
  await page.waitForSelector('.tut-backdrop.show');
  assert.match(await page.locator('.tut-kicker').textContent(), /So geht/);
  assert.equal(await page.locator('.tut-dots span').count(), 4);
  for (let k = 1; k <= 4; k++) {
    await page.waitForTimeout(k === 2 ? 2600 : 1800);
    assert.ok(await page.locator('.tut-stage .sdt-scene').count(), 'Demo-Szene ' + k);
    await shot(page, `01-tutorial-${k}`);
    await page.locator('.tut-next').tap();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('.tut-backdrop', { state: 'detached' });
  await page.waitForSelector('.screen.menu');
  assert.ok(await page.locator('.screen.menu .topbar .gm-q').count(), '«?» im Menü');
  await shot(page, '02-menu');

  // ---------- Neues Spiel (Leicht) ----------
  await tapLoc(page, page.locator('.seg button[data-id="leicht"]'));
  await tapLoc(page, page.locator('.newgame .btn.big'));
  await page.waitForSelector('.screen.play');
  assert.equal(new URL(page.url()).hash, '#play');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.coach-ring').count(), 1, 'Coach-Mark beim ersten Rätsel');
  await shot(page, '03-play-start');

  // Zahlenfeld: Tasten breit genug, Lücken zwischen den Tasten reagieren
  const keyInfo = await page.evaluate(() => {
    const a = document.querySelector('.key[data-d="4"]').getBoundingClientRect();
    const b = document.querySelector('.key[data-d="5"]').getBoundingClientRect();
    const t = document.elementFromPoint((a.right + b.left) / 2, a.top + a.height / 2);
    return { w: a.width, h: a.height, gap: b.left - a.right, hit: !!(t && t.closest('.key')) };
  });
  log('Taste', keyInfo);
  assert.ok(keyInfo.hit, 'Lücke zwischen Tasten trifft eine Taste');
  assert.ok(keyInfo.w >= 38 && keyInfo.h >= 44, 'Tasten gross genug');

  // «?» im laufenden Spiel öffnet das Tutorial, die Uhr steht still
  await tapSel(page, '.play-top button[aria-label="So geht’s"]');
  await page.waitForSelector('.tut-backdrop.show');
  const t0 = (await game(page)).elapsed;
  await page.waitForTimeout(1200);
  await skipTutorial(page);
  assert.ok((await game(page)).elapsed - t0 < 400, 'Uhr pausiert während der Hilfe');

  // Kein Seiten-Scrollen, alles im Bild
  const fit = await page.evaluate(() => {
    const pad = document.querySelector('.pad').getBoundingClientRect();
    return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, padBottom: pad.bottom };
  });
  assert.ok(fit.sh <= fit.ih + 1, 'Seite scrollt');
  assert.ok(fit.padBottom <= fit.ih, 'Zahlenfeld ausserhalb');

  let g = await game(page);
  const sol = g.solution;
  const empties = [];
  for (let i = 0; i < 81; i++) if (g.values[i] === '0') empties.push(i);

  // Feld wählen, falsche Zahl => Fehler
  const e0 = empties[0];
  await tapCell(page, e0);
  assert.equal(await page.locator('.coach-ring').count(), 0, 'Coach-Mark verschwindet nach der ersten Aktion');
  assert.equal(await page.evaluate(() => window.__sudoku.selected()), e0);
  const wrong = ((+sol[e0]) % 9) + 1;
  await tapKey(page, wrong);
  await page.waitForTimeout(120);
  g = await game(page);
  assert.equal(g.mistakes, 1, 'Fehler wird gezählt');
  assert.ok(await page.locator(`.cell[data-i="${e0}"].wrong`).count(), 'falsche Zahl rot');
  await shot(page, '04-play-mistake');

  // Rückgängig
  await tapSel(page, '.tool[data-tool="undo"]');
  g = await game(page);
  assert.equal(g.values[e0], '0', 'Rückgängig entfernt die Zahl');

  // Notizen
  await tapSel(page, '.tool[data-tool="notes"]');
  const e1 = empties[1];
  await tapCell(page, e1);
  await tapKey(page, +sol[e1]);
  await tapKey(page, ((+sol[e1]) % 9) + 1);
  g = await game(page);
  assert.equal(g.notes[e1], (1 << (+sol[e1] - 1)) | (1 << (((+sol[e1]) % 9))), 'Notizen gesetzt');
  await shot(page, '05-play-notes');
  await tapSel(page, '.tool[data-tool="notes"]');

  // Alle Notizen
  await tapSel(page, '.tool[data-tool="auto"]');
  await page.waitForTimeout(350);
  g = await game(page);
  assert.ok(g.notes.filter((n) => n).length >= empties.length - 1, 'Auto-Notizen gefüllt');
  await shot(page, '06-play-autonotes');
  // Notizen wieder weg (Rückgängig)
  await tapSel(page, '.tool[data-tool="undo"]');

  // Tipp
  await tapSel(page, '.tool[data-tool="hint"]');
  await page.waitForSelector('.controls.hinting');
  await page.waitForTimeout(350);
  const hintTitle = await page.locator('.hint-title').textContent();
  const hintText = await page.locator('.hint-text').textContent();
  log('Tipp:', hintTitle, '–', hintText);
  assert.ok(hintText.length > 10);
  await shot(page, '07-play-hint');
  // Derselbe Tipp nochmals geöffnet zählt nicht doppelt
  await tapSel(page, '.hint-ok');
  await tapSel(page, '.tool[data-tool="hint"]');
  await page.waitForSelector('.controls.hinting');
  assert.equal(await page.locator('.hint-title').textContent(), hintTitle);
  await tapSel(page, '.hint-act');
  await page.waitForTimeout(300);
  g = await game(page);
  assert.equal(g.hints, 1, 'gleicher Tipp zählt einmal');

  // Pause
  await tapSel(page, '.timer-pill');
  await page.waitForTimeout(350);
  assert.ok(await page.locator('.screen.play.is-paused').count(), 'Pause aktiv');
  await shot(page, '08-play-paused');
  await tapSel(page, '.pause-veil .resume');

  // Hälfte füllen, Wellen-Moment festhalten
  let waveShot = false;
  const rest = await fillByTaps(page, 12, async (k, n) => {
    if (!waveShot && (await page.locator('.cell.wave').count()) > 0) {
      waveShot = true;
      await page.waitForTimeout(140);
      await shot(page, '09-play-wave');
    }
    if (k === Math.floor(n / 2)) await shot(page, '10-play-mid');
  });
  assert.ok(rest.length >= 1);

  // Neuladen mitten im Spiel (mit gewähltem Feld und Notizen-Modus)
  await tapCell(page, rest[0]);
  await tapSel(page, '.tool[data-tool="notes"]');
  const before = await game(page);
  await page.reload();
  await page.waitForSelector('.screen.play');
  await page.waitForTimeout(300);
  const after = await game(page);
  assert.equal(after.values, before.values, 'Spielstand nach Neuladen gleich');
  assert.equal(after.mistakes, before.mistakes);
  assert.ok(after.elapsed >= before.elapsed - 1000, 'Zeit bleibt erhalten');
  assert.equal(await page.evaluate(() => window.__sudoku.selected()), rest[0], 'Auswahl bleibt');
  assert.ok(await page.locator('.tool[data-tool="notes"].on').count(), 'Notizen-Modus bleibt');
  await tapSel(page, '.tool[data-tool="notes"]');
  log('Neuladen ok, Zeit', after.elapsed);

  // Rest füllen => Sieg
  await fillByTaps(page, 0);
  await page.waitForSelector('.sp-modal .win', { timeout: 6000 });
  await page.waitForTimeout(900);
  await shot(page, '11-win-sheet');
  g = await game(page);
  assert.equal(g.done, true);
  const stats1 = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.sudoku.stats')));
  assert.equal(stats1.leicht.won, 1, 'Sieg gezählt');
  const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.sudoku')));
  assert.ok(summary && summary.text, 'reportSummary gesetzt');
  log('Summary:', summary.text);

  // Nächstes Rätsel
  await closeModal(page, 'Nächstes Rätsel');
  await page.waitForSelector('.screen.play');
  g = await game(page);
  assert.equal(g.done, false);
  assert.equal(g.meta.number, 2);

  // Zurück ins Menü => «Weiter»-Karte
  await tapSel(page, '.play-top .icon-btn');
  await page.waitForSelector('.screen.menu .hero .btn.primary');
  await page.waitForTimeout(300);
  await shot(page, '12-menu-continue');

  // Einstellungen
  await tapLoc(page, page.locator('.mini-btn', { hasText: 'Einstellungen' }));
  await page.waitForSelector('.settings');
  await page.waitForTimeout(350);
  await shot(page, '13-settings');
  // «3 Fehler»-Modus einschalten, Thema Salbei
  await tapLoc(page, page.locator('.set-row', { hasText: '3 Fehler' }).locator('input'));
  const dotBg = await page.locator('.theme-dots button[aria-label="Salbei"]').evaluate((b) => getComputedStyle(b).backgroundColor);
  assert.notEqual(dotBg, 'rgba(0, 0, 0, 0)', 'Farbpunkt sichtbar');
  await tapLoc(page, page.locator('.theme-dots button[aria-label="Salbei"]'));
  await closeModal(page, 'Fertig');

  // Statistik
  await tapLoc(page, page.locator('.mini-btn', { hasText: 'Statistik' }));
  await page.waitForSelector('.screen.stats');
  await page.waitForTimeout(400);
  await shot(page, '14-stats');
  const statTxt = await page.locator('.stats-panel').textContent();
  assert.ok(/Ø Fehler/.test(statTxt) && /Bestzeit/.test(statTxt), 'Statistik pro Stufe');
  await tapSel(page, '.screen.stats .topbar .icon-btn');
  await page.waitForSelector('.screen.menu');

  // «3 Fehler»-Modus: drei falsche Zahlen
  await tapLoc(page, page.locator('.hero .btn.primary'));
  await page.waitForSelector('.screen.play');
  g = await game(page);
  const em = [];
  for (let i = 0; i < 81; i++) if (g.values[i] === '0') em.push(i);
  for (let k = 0; k < 3; k++) {
    await tapCell(page, em[k]);
    await tapKey(page, ((+g.solution[em[k]]) % 9) + 1);
    await page.waitForTimeout(150);
  }
  await page.waitForSelector('.sp-modal h2:has-text("Drei Fehler")', { timeout: 4000 });
  await page.waitForTimeout(400);
  await shot(page, '15-three-strikes');
  await closeModal(page, 'Zweite Chance');
  g = await game(page);
  assert.equal(g.extraLives, 1);
  await shot(page, '16-play-salbei');
  await tapSel(page, '.play-top .icon-btn');
  await page.waitForSelector('.screen.menu');

  // ---------- Tagesrätsel ----------
  await tapLoc(page, page.locator('.card.daily'));
  await page.waitForSelector('.screen.play');
  assert.equal(new URL(page.url()).hash, '#daily');
  assert.equal(await page.locator('.title-wrap .title').textContent(), 'Tagesrätsel');
  await page.waitForTimeout(300);
  await shot(page, '17-daily-start');
  const dg = await game(page);
  assert.equal(dg.meta.mode, 'daily');
  // Gleiches Rätsel wie in einem frischen Browser (für alle gleich)
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const p2 = await ctx2.newPage();
  watch(p2);
  await p2.goto(BASE + 'sudoku/#daily');
  await p2.waitForSelector('.screen.play');
  const dg2 = await p2.evaluate(() => window.__sudoku.game());
  assert.equal(dg2.puzzle, dg.puzzle, 'Tagesrätsel ist für alle gleich');
  await ctx2.close();

  await fillByTaps(page, 0);
  await page.waitForSelector('.sp-modal .win', { timeout: 6000 });
  await page.waitForTimeout(900);
  await shot(page, '18-daily-win');
  const today = await page.evaluate(() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
  assert.equal(await page.evaluate((t) => localStorage.getItem('spielpause.daily.sudoku.' + t), today), 'true', 'markDailyDone');
  await closeModal(page, 'Zum Menü');
  await page.waitForSelector('.card.daily.done');
  await page.waitForTimeout(300);
  await shot(page, '19-menu-daily-done');

  // Neuladen auf #daily nach dem Lösen => gelöstes Brett mit Fertig-Feld
  await page.goto(BASE + 'sudoku/#daily');
  await page.waitForSelector('.screen.play.is-done');
  await shot(page, '20-daily-done-reload');
  // Hauptknopf führt ins freie Spiel (hier: laufendes Spiel), nicht ins Menü
  assert.equal(await page.locator('.done-btns .btn.primary').textContent(), 'Weiterspielen');
  await tapSel(page, '.done-btns .btn.primary');
  await page.waitForSelector('.screen.play:not(.is-done)');
  assert.equal(new URL(page.url()).hash, '#play');
  await tapSel(page, '.play-top .icon-btn');
  await page.waitForSelector('.screen.menu');

  // Zurück zur Startseite: Tagesrätsel mit Haken
  await tapLoc(page, page.locator('.screen.menu .topbar a.icon-btn'));
  await page.waitForSelector('.daily a.done[href="sudoku/#daily"]');
  await shot(page, '21-hub-daily-done');

  // Worker erzeugt frische Rätsel
  await page.goto(BASE + 'sudoku/');
  await page.waitForSelector('.screen.menu');
  const fresh = await page.evaluate(() => window.__sudoku.generateFresh('experte'));
  assert.ok(fresh && /^[0-9]{81}$/.test(fresh.puzzle) && fresh.tier >= 3, 'Worker liefert Experte-Rätsel');
  log('Worker:', fresh.givens, 'Vorgaben, Stufe', fresh.tier);

  // ---------- Kleines iPhone (375 × 667) ----------
  const ctx3 = await browser.newContext({ ...devices['iPhone SE'], deviceScaleFactor: 1 });
  const p3 = await ctx3.newPage();
  watch(p3);
  await p3.goto(BASE + 'sudoku/');
  await skipTutorial(p3);
  await shot(p3, '22-se-menu');
  await tapLoc(p3, p3.locator('.seg button[data-id="experte"]'));
  await tapLoc(p3, p3.locator('.newgame .btn.big'));
  await p3.waitForSelector('.screen.play');
  await p3.waitForTimeout(300);
  await tapSel(p3, '.tool[data-tool="auto"]');
  await p3.waitForTimeout(300);
  await tapSel(p3, '.tool[data-tool="hint"]');
  await p3.waitForTimeout(400);
  await shot(p3, '23-se-play-hint');
  const fit3 = await p3.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, pad: document.querySelector('.pad').getBoundingClientRect().bottom, board: document.querySelector('.board').getBoundingClientRect().width }));
  assert.ok(fit3.sh <= fit3.ih + 1 && fit3.pad <= fit3.ih, 'SE: kein Scrollen');
  log('SE: Brett', Math.round(fit3.board), 'px');
  await ctx3.close();

  // ---------- Gehen während der Sieg-Feier: Sieg bleibt verbucht ----------
  const ctx4 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const p4 = await ctx4.newPage();
  watch(p4);
  await p4.goto(BASE + 'sudoku/');
  await skipTutorial(p4);
  await tapLoc(p4, p4.locator('.newgame .btn.big'));
  await p4.waitForSelector('.screen.play');
  const last = await fillByTaps(p4, 1);
  const g4 = await game(p4);
  await tapCell(p4, last[0]);
  await tapKey(p4, +g4.solution[last[0]]);
  await p4.waitForTimeout(450);
  await tapSel(p4, '.play-top .icon-btn');            // Zurück mitten in der Welle
  await p4.waitForSelector('.screen.menu');
  const st4 = await p4.evaluate(() => JSON.parse(localStorage.getItem('spielpause.sudoku.stats')));
  assert.equal(st4.leicht.won, 1, 'Sieg trotz Verlassen gezählt');
  const sum4 = await p4.evaluate(() => JSON.parse(localStorage.getItem('spielpause.summary.sudoku')));
  assert.match(sum4.text, /1 Rätsel gelöst/);
  // Tagesrätsel: Neuladen 0.3 s nach der letzten Zahl
  await tapLoc(p4, p4.locator('.card.daily'));
  await p4.waitForSelector('.screen.play');
  const lastD = await fillByTaps(p4, 1);
  const gd = await game(p4);
  await tapCell(p4, lastD[0]);
  await tapKey(p4, +gd.solution[lastD[0]]);
  await p4.waitForTimeout(300);
  await p4.reload();
  await p4.waitForSelector('.screen.play.is-done');
  assert.equal(await p4.evaluate((t) => localStorage.getItem('spielpause.daily.sudoku.' + t), today), 'true', 'Tagesrätsel trotz Neuladen gelöst');
  assert.equal(await p4.locator('.done-btns .btn.primary').textContent(), 'Neues Rätsel');
  await tapSel(p4, '.done-btns .btn:not(.primary)');
  await p4.waitForSelector('.card.daily.done');
  log('Sieg während der Feier verlassen: verbucht ✓');
  await ctx4.close();

  await browser.close();
  if (errors.length) {
    console.error('Konsolenfehler:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`\nAlles gut ✓  (Screenshots: ${OUT})`);
}

main().catch((e) => {
  console.error(e);
  if (errors.length) console.error('Konsolenfehler:\n' + errors.join('\n'));
  process.exit(1);
});
