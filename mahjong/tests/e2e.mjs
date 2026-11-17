// End-to-End-Test für Mahjong (iPhone 13, echte Taps).
//
//   python3 -m http.server 8202 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node mahjong/tests/e2e.mjs
//
// Umgebungsvariablen: BASE (Standard http://127.0.0.1:8202), SHOTS (Ordner für Screenshots).

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8202';
const SHOTS = process.env.SHOTS || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
mkdirSync(SHOTS, { recursive: true });

const errors = [];
let inPinch = false;
let step = 0;
const log = (...a) => console.log(`[${String(++step).padStart(2, '0')}]`, ...a);
function check(cond, msg) {
  if (!cond) { console.error('FEHLER:', msg); process.exitCode = 1; throw new Error(msg); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // Fehlende Dateien anderer Spiele auf der Startseite gehören nicht zu Mahjong
  const url = (m.location() && m.location().url) || '';
  if (/Failed to load resource/.test(m.text()) && !/\/mahjong/.test(url)) return;
  // CDP-Pinch hebt beide Finger gleichzeitig: Chromium meldet dann für den Doppeltipp-Schutz
  // aus shared/ui.js eine «Intervention». Nur während dieser Emulation ignorieren.
  if (inPinch && /Ignored attempt to cancel a touchend/.test(m.text())) return;
  errors.push(`console (Schritt ${step}): ${m.text()} ${url}`);
});
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

  // 2) «So geht's» (animiertes Tutorial) erscheint beim ersten Start
  await page.locator('.tut-backdrop.show').waitFor({ timeout: 4000 });
  check(await page.locator('.tut-title').innerText() === 'Paare antippen', 'Tutorial Schritt 1 fehlt');
  await wait(2200);
  await shot('01-tutorial');
  for (let k = 0; k < 3; k++) { await page.locator('.tut-next').click(); await wait(400); }
  await wait(1800);
  await shot('01b-tutorial-last');
  check((await page.locator('.tut-next').innerText()).includes('Los geht'), 'Letzter Tutorial-Schritt fehlt');
  await page.locator('.tut-next').click();
  await wait(500);
  check(await page.locator('.tut-backdrop').count() === 0, 'Tutorial schliesst nicht');
  await shot('02-menu');
  log('Menü sichtbar');

  // Menü passt ohne horizontales Scrollen
  const overflowX = await mj(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflowX, 'Menü scrollt horizontal');

  // 3) Spielen → Level 1
  await page.locator('.gm-primary').tap();
  await wait(1900);
  check(await mj(() => window.__mahjong.route()) === 'spiel', 'Route #spiel erwartet');
  await shot('03-game-start');
  check(await page.locator('.coach-ring').count() === 2, 'Coach-Mark beim ersten Layout fehlt');
  const coachHit = await mj(() => {
    const b = document.querySelector('.coach-bubble').getBoundingClientRect();
    const s = window.__mahjong.session, w = window.__mahjong.tileWidth();
    for (let i = 0; i < s.n; i++) {
      if (!s.present[i]) continue;
      const c = window.__mahjong.center(i);
      if (Math.abs(c.x - (b.left + b.width / 2)) < w / 2 + b.width / 2 && Math.abs(c.y - (b.top + b.height / 2)) < w * 0.68 + b.height / 2) return i;
    }
    return -1;
  });
  check(coachHit < 0, 'Coach-Sprechblase verdeckt Stein ' + coachHit);
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
  check(await page.locator('.coach').count() === 0, 'Coach-Mark verschwindet nicht nach dem ersten Paar');
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

  // 7b) Schnelle Taps auf die Werkzeugleiste gehen nicht verloren
  const ub = await page.locator('.tool.undo').boundingBox();
  const leftBefore = after.left;
  for (let k = 0; k < 4; k++) { await page.touchscreen.tap(ub.x + ub.width / 2, ub.y + ub.height / 2); await wait(200); }
  await wait(300);
  const leftUndo = await mj(() => window.__mahjong.session.remaining);
  check(leftUndo === leftBefore + 8, `4 schnelle Rückgängig-Taps sollten 8 Steine zurücklegen (${leftUndo - leftBefore})`);
  await playPairs(4);
  await wait(300);
  const tsel = await mj(() => window.__mahjong.nextPair());
  await tapTile(tsel[0]);
  await wait(80);
  await page.locator('.tool.more').tap();
  await wait(350);
  check(await page.locator('.sp-modal h2').count() === 1, '«Mehr» direkt nach einem Stein-Tipp öffnet nichts');
  check(await page.locator('.sp-modal').count() === 1, 'Dialog doppelt geöffnet');
  // «Neue Verteilung» fragt bei begonnenem Spiel nach
  await closeModal('Neue Verteilung');
  check(await page.locator('.sp-modal h2', { hasText: 'Neu verteilen?' }).isVisible(), '«Neue Verteilung» fragt nicht nach');
  await closeModal('Abbrechen');
  check(await mj(() => window.__mahjong.session.remaining) === leftBefore, '«Abbrechen» hat das Spiel trotzdem ersetzt');
  log('Schnelle Taps, «Mehr» und Nachfrage bei «Neue Verteilung» ok');

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
  check((await page.locator('.gm-primary-label').innerText()).includes('Weiter'), 'Menü zeigt kein «Weiter»');
  check((await page.locator('.gm-primary-sub').innerText()).startsWith('Level 2 · Kleine Pyramide'), 'Hauptknopf nennt Level und Name nicht');
  check(await page.locator('.mj-hero.live canvas').count() === 1, 'Live-Vorschau des laufenden Spiels fehlt im Menü');
  check(await page.locator('.tbl').count() === 5 && await page.locator('.tbl.on').count() === 1, 'Abschnitt «Tische» fehlt');
  await page.locator('.gm-sec', { hasText: 'Reise' }).tap();
  await wait(700);
  await shot('12-journey');
  log('Reise sichtbar');
  await page.locator('.topbar a.icon-btn').first().tap();
  await wait(500);

  // 12) Einstellungen: Steinsätze durchprobieren
  await page.locator('.gm-primary').tap();
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
  await page.locator('.gm-sec', { hasText: 'Statistik' }).tap();
  await wait(400);
  await shot('15-stats');
  await closeModal('Schliessen');

  // 13b) Steinsatz im Menü wählen (Segment) und Zufallsspiel starten
  await page.locator('.gm-seg button', { hasText: 'Tiere' }).tap();
  await wait(500);
  check(await mj(() => JSON.parse(localStorage.getItem('spielpause.mahjong.settings')).tileset) === 'tiere', 'Steinsatz-Wahl im Menü wirkt nicht');
  await shot('15b-menu-tiere');
  await page.locator('.gm-seg button', { hasText: 'Klassisch' }).tap();
  await wait(500);

  // 14) Grosses Layout (Schildkröte): Passform + Zoomen
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('spielpause.mahjong.progress'));
    // alle Layouts freischalten (nur für den Test)
    for (const id of ['kleine-pyramide', 'stern', 'mond', 'bruecke', 'pilz', 'herz', 'katze', 'krone', 'blume', 'schmetterling', 'turm', 'spirale', 'haus', 'tannenbaum', 'fisch', 'festung', 'segelschiff', 'drache', 'eule', 'kleeblatt', 'sonne', 'arena', 'tempel', 'pyramide']) {
      p.levels[id] = p.levels[id] || { stars: 1, best: 300, wins: 1, plays: 1 };
    }
    localStorage.setItem('spielpause.mahjong.progress', JSON.stringify(p));
  });
  await page.reload();
  await wait(700);
  await page.locator('.gm-sec', { hasText: 'Reise' }).tap();
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
  inPinch = true;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(40) });
  for (let d = 40; d <= 110; d += 10) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(d) });
    await wait(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(700);
  inPinch = false;
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
  // Sieg wird sofort gespeichert (nicht erst nach der Animation)
  check(await mj(() => Object.keys(localStorage).some((k) => /^spielpause\.daily\.mahjong\./.test(k))), 'Tagesrätsel nicht sofort als gelöst markiert');
  await wait(1500);
  await shot('20-daily-win');
  check(await page.locator('.sp-modal h2', { hasText: 'Tagesrätsel gelöst' }).isVisible(), 'Gewinnblatt Tagesrätsel fehlt');
  await closeModal('Zum Menü');
  await wait(500);
  check(await page.locator('.gm-daily.done').isVisible(), 'Häkchen beim Tagesrätsel fehlt');
  await shot('21-menu-daily-done');
  const summary = await mj(() => JSON.parse(localStorage.getItem('spielpause.summary.mahjong')).text);
  log('Zusammenfassung:', summary);
  check(/Tagesrätsel ✓/.test(summary), 'reportSummary ohne Tagesrätsel-Häkchen');
  // Gelöstes Tagesrätsel erneut öffnen: Dialog über dem Menü (nicht über leerem Bildschirm)
  await page.goto(BASE + '/mahjong/#daily');
  await wait(900);
  check(await page.locator('.sp-modal h2', { hasText: 'Heute schon gelöst' }).isVisible(), 'Hinweis «Heute schon gelöst» fehlt');
  check(await page.locator('.gm-daily.done').count() === 1, 'Hinter «Heute schon gelöst» fehlt das Menü');
  await shot('21b-daily-again');
  await closeModal('Zum Menü');
  await wait(400);
  check(await mj(() => window.__mahjong.route()) === '', 'Nicht zurück im Menü');

  // 16) Zufallsspiel (klein) starten
  await page.locator('.gm-sec', { hasText: 'Zufall' }).tap();
  await wait(400);
  await closeModal('Klein');
  await wait(1700);
  check(await mj(() => window.__mahjong.route() === 'spiel' && window.__mahjong.session.meta.kind === 'endless'), 'Zufallsspiel startet nicht');
  await shot('22-endless');
  log('Zufallsspiel:', await mj(() => window.__mahjong.session.n), 'Steine');

  // 17) Kleines iPhone (375 px): kein Scrollen, Steine gross genug
  await page.setViewportSize({ width: 375, height: 629 });
  await wait(600);
  const small = await mj(() => ({ sx: document.documentElement.scrollWidth > innerWidth, sy: document.scrollingElement.scrollHeight > innerHeight + 1, w: window.__mahjong.tileWidth() }));
  check(!small.sx && !small.sy, '375 px: Seite scrollt');
  check(small.w >= 26, '375 px: Steine zu klein ' + small.w);
  await shot('23-375');
  await page.setViewportSize(devices['iPhone 13'].viewport);
  await wait(400);
  await page.locator('.game .topbar a.icon-btn').first().tap();
  await wait(500);

  // 18) Zurück zur Startseite
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
