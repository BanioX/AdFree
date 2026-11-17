// End-to-End-Test für Mahjong (iPhone 13, echte Taps).
//
//   python3 -m http.server 8202 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node mahjong/tests/e2e.mjs
//
// Umgebungsvariablen: BASE (Standard http://127.0.0.1:8202), SHOTS (Ordner für Screenshots).

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8202';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mahjong-e2e');
mkdirSync(SHOTS, { recursive: true });

const errors = [];
let step = 0;
const log = (...a) => console.log(`[${String(++step).padStart(2, '0')}]`, ...a);
function check(cond, msg) {
  if (!cond) { console.error('FEHLER:', msg); process.exitCode = 1; throw new Error(msg); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const wait = (ms) => page.waitForTimeout(ms);
const mj = (fn, arg) => page.evaluate(fn, arg);

async function tapTile(i) {
  const c = await mj((k) => window.__mahjong.center(k), i);
  await page.touchscreen.tap(c.x, c.y);
}

/** Löst Paare mit echten Taps. max = Anzahl Paare (Infinity = bis zum Ende). */
async function playPairs(max = Infinity, { onPair } = {}) {
  let done = 0;
  while (done < max) {
    const st = await mj(() => ({ won: window.__mahjong.session?.won, left: window.__mahjong.session?.remaining }));
    if (!st.left || st.won) break;
    const pair = await mj(() => window.__mahjong.nextPair());
    check(pair, 'Löser findet kein Paar, obwohl das Spiel lösbar sein müsste');
    await tapTile(pair[0]);
    await wait(90);
    await tapTile(pair[1]);
    done++;
    if (onPair) await onPair(done);
    await wait(420);
  }
  return done;
}

async function closeModal(label) {
  const btn = page.locator('.sp-modal-buttons button', { hasText: label });
  await btn.first().waitFor({ state: 'visible', timeout: 5000 });
  await btn.first().click();
  await wait(350);
}

try {
  // 1) Startseite → Mahjong-Kachel
  await page.goto(BASE + '/');
  await wait(600);
  const tile = page.locator('a.tile[href="mahjong/"]');
  check(await tile.count() === 1, 'Mahjong-Kachel auf der Startseite fehlt');
  await tile.tap();
  await page.waitForURL(/mahjong\/$/);
  await wait(900);
  log('Mahjong geöffnet');

  // 2) «So geht's» erscheint beim ersten Start
  check(await page.locator('.sp-modal h2', { hasText: 'So geht' }).isVisible(), '«So geht’s» fehlt beim ersten Start');
  await shot('01-help');
  await closeModal('Los geht');
  await shot('02-menu');
  log('Menü sichtbar');

  // Menü passt ohne horizontales Scrollen
  const overflowX = await mj(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflowX, 'Menü scrollt horizontal');

  // 3) Spielen → Level 1
  await page.locator('.play-btn').tap();
  await wait(1700);
  check(await mj(() => window.__mahjong.route()) === 'spiel', 'Route #spiel erwartet');
  await shot('03-game-start');
  const n = await mj(() => window.__mahjong.session.n);
  log('Level 1 gestartet,', n, 'Steine, Steinbreite', (await mj(() => window.__mahjong.tileWidth())).toFixed(1), 'px');

  // Spielfläche scrollt nicht
  const scrolls = await mj(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
  check(!scrolls, 'Spielseite scrollt');

  // 4) Blockierten Stein antippen → Wackeln + Hinweis
  const blocked = await mj(() => {
    const s = window.__mahjong.session;
    for (let i = 0; i < s.n; i++) if (s.present[i] && !s.isFree(i)) return i;
    return -1;
  });
  check(blocked >= 0, 'Kein blockierter Stein gefunden');
  await tapTile(blocked);
  await wait(120);
  await shot('04-blocked-tap');
  await wait(900);

  // 5) Erstes Paar: Auswahl sichtbar, dann Treffer mit Animation
  const p1 = await mj(() => window.__mahjong.nextPair());
  await tapTile(p1[0]);
  await wait(150);
  await shot('05-selected');
  await tapTile(p1[1]);
  await wait(260);
  await shot('06-match-flight');
  await wait(500);
  const left1 = await mj(() => window.__mahjong.session.remaining);
  check(left1 === n - 2, `Nach einem Paar sollten ${n - 2} Steine übrig sein (sind ${left1})`);
  log('Paar abgeräumt');

  // 6) Tipp und Rückgängig
  await page.locator('.tool.hint').tap();
  await wait(350);
  await shot('07-hint');
  check(await mj(() => !!window.__mahjong.view.hint), 'Tipp wird nicht angezeigt');
  await page.locator('.tool.undo').tap();
  await wait(400);
  check(await mj(() => window.__mahjong.session.remaining) === n, 'Rückgängig hat das Paar nicht zurückgelegt');
  log('Tipp + Rückgängig ok');

  // 7) Halb spielen, dann neu laden → Spielstand bleibt
  await playPairs(Math.floor(n / 4));
  await shot('08-game-mid');
  const before = await mj(() => ({ left: window.__mahjong.session.remaining, faces: window.__mahjong.session.faces.join(','), t: window.__mahjong.session.elapsed }));
  await page.reload();
  await wait(900);
  const after = await mj(() => ({ route: window.__mahjong.route(), left: window.__mahjong.session?.remaining, faces: window.__mahjong.session?.faces.join(',') }));
  check(after.route === 'spiel', 'Nach dem Neuladen nicht mehr im Spiel');
  check(after.left === before.left && after.faces === before.faces, 'Spielstand nach dem Neuladen verändert');
  log('Neuladen mitten im Spiel: Stand bleibt erhalten (', after.left, 'Steine )');

  // 8) Mischen
  await page.locator('.tool.shuffle').tap();
  await wait(200);
  await shot('09-shuffle-anim');
  await wait(1000);
  const afterShuffle = await mj(() => window.__mahjong.session.faces.join(','));
  check(afterShuffle !== before.faces, 'Mischen hat nichts verändert');
  log('Mischen ok');

  // 9) Zu Ende spielen → Gewinnblatt
  await playPairs();
  await wait(1500);
  await shot('10-win');
  check(await page.locator('.sp-modal h2', { hasText: 'Geschafft' }).isVisible(), 'Gewinnblatt fehlt');
  log('Level 1 gewonnen');

  // 10) Nächstes Level
  await closeModal('Weiter:');
  await wait(1500);
  const lv2 = await mj(() => window.__mahjong.session.layout.name);
  check(lv2 === 'Kleine Pyramide', 'Nächstes Level sollte «Kleine Pyramide» sein, ist ' + lv2);
  log('Weiter zu', lv2);

  // 11) Zurück ins Menü → Reise
  await page.locator('.game .topbar a.icon-btn').first().tap();
  await wait(600);
  check(await mj(() => window.__mahjong.route()) === '', 'Zurück-Button führt nicht ins Menü');
  await shot('11-menu-continue');
  check((await page.locator('.play-btn b').innerText()).includes('Weiter'), 'Menü zeigt kein «Weiter»');
  await page.locator('.mcard', { hasText: 'Reise' }).tap();
  await wait(700);
  await shot('12-journey');
  log('Reise sichtbar');
  await page.locator('.topbar a.icon-btn').first().tap();
  await wait(500);

  // 12) Einstellungen: Steinsätze durchprobieren
  await page.locator('.play-btn').tap();
  await wait(900);
  for (const set of ['Tiere', 'Garten', 'Naschwerk', 'Klassisch']) {
    await page.locator('.game .topbar button.icon-btn[aria-label="Einstellungen"]').tap();
    await wait(400);
    await page.locator('.setopt', { hasText: set }).tap();
    await wait(250);
    if (set === 'Tiere') await shot('13-settings');
    await closeModal('Fertig');
    await wait(300);
    await shot('14-set-' + set.toLowerCase());
  }
  log('Steinsätze ok');

  // 13) Statistik
  await page.locator('.game .topbar a.icon-btn').first().tap();
  await wait(500);
  await page.locator('.menu-row .btn', { hasText: 'Statistik' }).tap();
  await wait(400);
  await shot('15-stats');
  await closeModal('Schliessen');

  // 14) Grosses Layout (Schildkröte): Passform + Zoomen
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('spielpause.mahjong.progress'));
    // alle Layouts freischalten (nur für den Test)
    for (const id of ['kleine-pyramide', 'stern', 'mond', 'bruecke', 'pilz', 'herz', 'katze', 'krone', 'blume', 'schmetterling', 'turm', 'spirale', 'haus', 'tannenbaum', 'fisch', 'festung', 'segelschiff', 'drache', 'eule', 'kleeblatt', 'sonne', 'arena', 'tempel', 'pyramide']) {
      p.levels[id] = p.levels[id] || { stars: 1, best: 300, wins: 1, plays: 1 };
    }
    localStorage.setItem('spielpause.mahjong.progress', JSON.stringify(p));
  });
  await page.locator('.mcard', { hasText: 'Reise' }).tap();
  await wait(600);
  await page.locator('.lv', { hasText: 'Schildkröte' }).tap();
  await wait(400);
  if (await page.locator('.sp-modal h2', { hasText: 'Laufendes Spiel' }).isVisible()) await closeModal('Neues Spiel');
  await wait(2200);
  await shot('16-turtle');
  const tw = await mj(() => window.__mahjong.tileWidth());
  log('Schildkröte: Steinbreite', tw.toFixed(1), 'px');
  check(tw >= 26, 'Steine zu klein: ' + tw);
  // Pinch-Zoom per CDP
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator('.board-wrap').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const tp = (d) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(40) });
  for (let d = 40; d <= 110; d += 10) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(d) });
    await wait(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(400);
  const zw = await mj(() => window.__mahjong.tileWidth());
  check(zw > tw * 1.4, 'Pinch-Zoom hat nicht vergrössert');
  check(await page.locator('.fit-btn.show').isVisible(), 'Einpassen-Knopf fehlt nach dem Zoomen');
  await shot('17-turtle-zoom');
  await page.locator('.fit-btn').tap();
  await wait(500);
  log('Zoom ok:', zw.toFixed(1), 'px');

  // 15) Tagesrätsel: lösen
  await page.goto(BASE + '/mahjong/#daily');
  await wait(1800);
  check(await mj(() => window.__mahjong.route()) === 'daily', 'Route #daily erwartet');
  await shot('18-daily-start');
  const dn = await mj(() => window.__mahjong.session.n);
  log('Tagesrätsel:', dn, 'Steine');
  await playPairs(Infinity, { onPair: async (k) => { if (k === 10) await shot('19-daily-mid'); } });
  await wait(1500);
  await shot('20-daily-win');
  check(await page.locator('.sp-modal h2', { hasText: 'Tagesrätsel gelöst' }).isVisible(), 'Gewinnblatt Tagesrätsel fehlt');
  await closeModal('Zum Menü');
  await wait(500);
  check(await page.locator('.mcard .done-badge').isVisible(), 'Häkchen beim Tagesrätsel fehlt');
  await shot('21-menu-daily-done');
  const summary = await mj(() => JSON.parse(localStorage.getItem('spielpause.summary.mahjong')).text);
  log('Zusammenfassung:', summary);
  check(/Tagesrätsel ✓/.test(summary), 'reportSummary ohne Tagesrätsel-Häkchen');

  // 16) Zurück zur Startseite
  await page.locator('.topbar a.icon-btn').first().tap();
  await page.waitForURL(BASE + '/');
  log('Zurück auf der Startseite');

  check(errors.length === 0, 'Konsolenfehler:\n' + errors.join('\n'));
  log('Alles in Ordnung. Screenshots:', SHOTS);
} catch (e) {
  console.error(e.message);
  console.error('Konsolenfehler:', errors);
  await shot('zz-failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
