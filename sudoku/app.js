// Sudoku – Spielpause. Menü, Routen (#play, #daily, #stats), Statistik, Einstellungen.
import { setupPage, h, showModal, confirmDialog, celebrate, toast, sleep } from '../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { icon } from './ui/icons.js';
import { Play } from './ui/play.js';
import { openTutorial, firstTutorial } from './ui/tutorial.js';
import { Game } from './logic/game.js';
import { parse } from './logic/board.js';
import { difficulties, difficultyById, DAILY_DIFFICULTY } from './data/difficulties.js';
import { themes, themeById, themeUnlocked, nextLockedTheme, newlyUnlocked } from './data/themes.js';
import { pool } from './data/pool.js';
import { nextPuzzle, nextNumber, dailyPuzzle, topUpFresh, generateFresh, gentler } from './puzzles.js';
import {
  KEYS, loadSettings, saveSettings, loadStats, recordStart, recordAbandon, recordWin, resetStats,
  totalWon, statsKey, loadGameJSON, saveGameJSON, formatTime, baseStars, isGoldNumber, loadStars, addStars,
} from './progress.js';

const ID = 'sudoku';
setupPage();

const app = document.getElementById('app');
const settings = loadSettings();
let play = null;      // aktive Spielansicht
let screen = '';

applyTheme();

// ---------- Hilfen ----------

function applyTheme() {
  const t = themeById(settings.theme);
  const r = document.documentElement.style;
  r.setProperty('--accent', t.accent);
  r.setProperty('--accent-2', t.sel);
  r.setProperty('--ink', t.ink);
  r.setProperty('--b-sel', t.sel);
  r.setProperty('--b-same', t.same);
  r.setProperty('--b-peer', t.peer);
  r.setProperty('--b-line', t.line);
  r.setProperty('--b-thick', t.thick);
  r.setProperty('--b-wave', t.wave);
  r.setProperty('--b-cell', t.cell || '#fff');
  r.setProperty('--given', t.given || '#2c2a33');
}

/** Wählt ein Brett-Thema (nur freigeschaltete). */
function setTheme(id) {
  const t = themeById(id);
  if (!themeUnlocked(t, loadStars())) return false;
  settings.theme = t.id;
  saveSettings(settings);
  applyTheme();
  if (play) play.render();
  return true;
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const longDate = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;

/** Wechselt die Ansicht ohne neuen Verlaufseintrag (Neuladen landet wieder hier). */
function go(hash) {
  const target = hash && hash !== '#' ? hash : '';
  if ((location.hash || '') !== target) {
    history.replaceState(null, '', location.pathname + location.search + target);
  }
  route();
}

function loadGame(slot) {
  const g = Game.fromJSON(loadGameJSON(slot));
  return g;
}

function regularInProgress() {
  const g = loadGame('game');
  return g && !g.done ? g : null;
}

function updateSummary() {
  const parts = [];
  const g = regularInProgress();
  if (g) parts.push(`${difficultyById(g.meta.diff).title} · ${Math.round(g.progress() * 100)} %`);
  else {
    const won = totalWon();
    parts.push(won ? `${won} Rätsel gelöst · ${loadStars()} ★` : 'Bereit für das erste Rätsel');
  }
  if (isDailyDone(ID)) parts.push('Tagesrätsel ✓');
  reportSummary(ID, parts.join(' · '));
}

let lastPct = -1;
function onProgress(game) {
  const pct = Math.round(game.progress() * 100);
  if (pct !== lastPct) { lastPct = pct; updateSummary(); }
}

/**
 * Verbucht einen Sieg genau einmal (Statistik, Tagesrätsel-Häkchen) – sofort beim Lösen,
 * nicht erst beim Sieg-Blatt. So geht nichts verloren, wenn man während der Feier geht.
 * @returns {{ newBest: boolean, stats: object } | null}  null, wenn schon verbucht
 */
function countWin(game, slot) {
  if (!game || !game.done || game.counted) return null;
  const info = recordWin(statsKey(game), { time: game.elapsed, mistakes: game.mistakes, hints: game.hints });
  if (slot === 'daily' && game.meta.day) markDailyDone(ID, game.meta.day);
  // Sterne: 1–3 je nach Fehlern/Tipps, Goldrätsel doppelt
  const base = baseStars(game);
  const mult = game.meta.gold ? 2 : 1;
  const { before, after } = addStars(base * mult);
  game.meta.stars = { base, mult, earned: base * mult, before, after };
  game.counted = true;
  saveGameJSON(slot, game.toJSON());
  updateSummary();
  return info;
}

/** Gelöste, aber (z.B. durch Schliessen der App) nicht verbuchte Spiele nachtragen. */
function recoverWins() {
  for (const slot of ['game', 'daily']) {
    const g = loadGame(slot);
    if (g && g.done && !g.counted) countWin(g, slot);
  }
}

/** Beendet die aktive Spielansicht (speichert dabei den Stand). */
function leavePlay() {
  if (play) { play.destroy(); play = null; }
}

function setScreen(el, name) {
  el.classList.add('enter');
  app.replaceChildren(el);
  screen = name;
  el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
}

// ---------- Mini-Brett (Menü) ----------

function miniBoard(game, { sample = null } = {}) {
  const el = h('div.mini');
  const vals = game ? game.values : parse(sample);
  for (let b = 0; b < 9; b++) {
    const box = h('div.mbox');
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const i = (r0 + r) * 9 + c0 + c;
        const v = vals[i];
        const cls = !v ? '' : (game && !game.given[i] ? 'u' : 'g');
        box.append(h('span', { class: cls }, v ? String(v) : ''));
      }
    }
    el.append(box);
  }
  return el;
}

/** Allererstes Rätsel überhaupt: etwas mehr Vorgaben, damit die erste Runde kurz bleibt. */
function isFirstEver(diff, n) {
  return diff === 'leicht' && n === 1 && totalWon() === 0;
}

// ---------- Farben sammeln (Fortschritt) ----------

/** Abschnitt im Startbildschirm: Sterne, Fortschrittsbalken bis zur nächsten Farbe, Farbpunkte. */
function colorSection(onThemeChange) {
  const stars = loadStars();
  const next = nextLockedTheme(stars);
  const prevAt = themes.filter((t) => t.unlock && t.unlock <= stars).reduce((a, t) => Math.max(a, t.unlock), 0);
  const pct = next ? Math.round(((stars - prevAt) / (next.unlock - prevAt)) * 100) : 100;
  const head = h('div.sd-prog-head', null,
    h('span.sd-prog-stars', { html: `${icon('star', { size: 22 })}<b>${stars}</b>` }),
    h('span.sd-prog-txt', null,
      h('b', null, next ? `Noch ${next.unlock - stars} ★ bis «${next.title}»` : 'Alle Farben gesammelt!'),
      h('small', null, 'Ohne Fehler und Tipps gibt’s 3 ★')));
  const bar = h('div.sd-prog-bar', null, h('i', { style: { width: Math.max(4, pct) + '%' } }));
  const dots = h('div.sd-swatches');
  for (const t of themes) {
    const open = themeUnlocked(t, stars);
    const b = h('button', {
      type: 'button',
      class: (open ? '' : 'locked') + (t.id === settings.theme ? ' on' : ''),
      'data-theme': t.id,
      'aria-label': open ? t.title : `${t.title} – ab ${t.unlock} Sternen`,
    }, h('span.dot', { html: open ? '' : icon('lock', { size: 14 }) }), h('small', null, open ? t.title : `${t.unlock} ★`));
    b.style.setProperty('--c', t.accent);
    b.addEventListener('click', () => {
      if (!open) { toast(`«${t.title}» gibt’s ab ${t.unlock} ★`); return; }
      if (!setTheme(t.id)) return;
      for (const x of dots.children) x.classList.toggle('on', x === b);
      onThemeChange && onThemeChange();
    });
    dots.append(b);
  }
  return menuSection('Farben sammeln', h('div.card.sd-prog', null, head, bar, dots));
}

// ---------- Menü ----------

function renderMenu() {
  const inProgress = regularInProgress();
  let diff = store.get(KEYS.lastDiff, 'leicht');
  if (!difficulties.some((d) => d.id === diff)) diff = difficulties[0].id;
  const stats = loadStats();

  // Titelbild: Live-Vorschau des laufenden Spiels (sonst ein Beispiel-Rätsel)
  const art = h('div.menu-art', null, miniBoard(inProgress, { sample: pool.leicht[0] }));
  if (inProgress) art.append(h('span.menu-art-badge', null, `${Math.round(inProgress.progress() * 100)} %`));

  const newGame = async () => {
    if (inProgress && inProgress.moves > 0) {
      const ok = await confirmDialog('Neues Spiel?', 'Dein laufendes Spiel wird dabei beendet.', 'Neues Spiel', 'Abbrechen');
      if (!ok) return;
      recordAbandon(inProgress.meta.diff);
    }
    startNew(diff);
  };

  const primary = () => {
    if (inProgress) {
      const g = inProgress;
      return {
        label: 'Weiterspielen',
        sub: `${difficultyById(g.meta.diff).title}${g.meta.gold ? ' · Gold' : ''} · ${Math.round(g.progress() * 100)} % · ${formatTime(g.elapsed)}`,
        onClick: () => go('#play'),
      };
    }
    const spec = difficultyById(diff);
    const n = nextNumber(diff);
    const extra = isFirstEver(diff, n) ? ' · extra sanft' : isGoldNumber(n) ? ' · Gold ×2 ★' : '';
    return { label: 'Spielen', sub: `${spec.title} · Rätsel Nr. ${n}${extra}`, onClick: () => startNew(diff) };
  };
  const secondary = () => [
    inProgress ? { label: 'Neues Spiel', sub: difficultyById(diff).title, icon: 'plus', onClick: newGame } : null,
    { label: 'Statistik', sub: totalWon() ? `${totalWon()} gelöst` : 'Zeiten & Serien', icon: 'star', onClick: () => go('#stats') },
    { label: 'Einstellungen', sub: 'Farben, Hilfen', icon: 'settings', onClick: () => openSettings() },
  ].filter(Boolean);
  const statTiles = () => {
    const s = stats[diff];
    return [
      { label: 'Gelöst', value: totalWon() },
      { label: 'Sterne', value: `${loadStars()} ★` },
      { label: 'Bestzeit', value: s.best ? formatTime(s.best) : '–' },
      { label: 'Tagesserie', value: dailyStreak(ID) },
    ];
  };

  // Tagesrätsel
  const dg = loadGame('daily');
  const dailyRunning = dg && dg.meta.day === todayKey() && !dg.done;
  const dailyTitle = difficultyById(DAILY_DIFFICULTY).title;

  const el = gameMenu({
    id: ID,
    title: 'Sudoku',
    tagline: 'Zahlen 1–9 logisch einsetzen',
    accent: themeById(settings.theme).accent,
    art,
    primary: primary(),
    daily: {
      done: isDailyDone(ID),
      streak: dailyStreak(ID),
      sub: dailyRunning ? `${dailyTitle} · ${formatTime(dg.elapsed)}` : dailyTitle,
      onClick: () => go('#daily'),
    },
    modes: {
      label: inProgress ? 'Stufe für ein neues Spiel' : 'Schwierigkeit',
      value: diff,
      options: difficulties.map((d, k) => ({ id: d.id, label: d.title, sub: '•'.repeat(k + 1) })),
      onChange(id) {
        diff = id;
        store.set(KEYS.lastDiff, id);
        el.update({ primary: primary(), secondary: secondary(), stats: totalWon() ? statTiles() : null });
        markSecondary();
      },
    },
    secondary: secondary(),
    stats: totalWon() ? statTiles() : null,   // ganz am Anfang keine Reihe voller Nullen
    sections: [colorSection(() => { el.style.setProperty('--accent', themeById(settings.theme).accent); })],
    onHelp: () => openTutorial(),
    backHref: '../',
  });
  el.classList.add('screen', 'menu');
  // Drei Nebenknöpfe brauchen ein schmaleres Layout (Symbol über dem Text)
  const markSecondary = () => {
    const row = el.querySelector('.gm-secondary');
    if (row) row.classList.toggle('three', row.children.length >= 3);
  };
  markSecondary();
  setScreen(el, 'menu');
  updateSummary();
  setTimeout(() => { if (screen === 'menu') firstTutorial(); }, 350);
  // Im Leerlauf frische Rätsel vorbereiten
  setTimeout(() => topUpFresh(), 1500);
}

function startNew(diffId) {
  leavePlay();
  const first = isFirstEver(diffId, nextNumber(diffId));
  const p = nextPuzzle(diffId);
  const meta = { mode: 'classic', diff: diffId, number: p.number, src: p.src };
  if (first) { p.puzzle = gentler(p.puzzle, p.solution); meta.first = true; }
  else if (isGoldNumber(p.number)) meta.gold = true;
  const game = Game.create(p.puzzle, p.solution, meta);
  saveGameJSON('game', game.toJSON());
  recordStart(diffId);
  store.set(KEYS.lastDiff, diffId);
  lastPct = -1;
  updateSummary();
  go('#play');
}

// ---------- Spiel ----------

function openGame(slot) {
  leavePlay();
  let game;
  if (slot === 'daily') {
    const day = todayKey();
    game = loadGame('daily');
    if (!game || game.meta.day !== day) {
      if (isDailyDone(ID, day)) {
        go('#');
        setTimeout(() => showModal({
          title: 'Schon gelöst!',
          text: 'Das heutige Tagesrätsel hast du schon geschafft. Morgen wartet ein neues.',
          buttons: [{ label: 'OK', value: true, primary: true }],
        }), 300);
        return;
      }
      const p = dailyPuzzle(day);
      game = Game.create(p.puzzle, p.solution, { mode: 'daily', diff: DAILY_DIFFICULTY, day, src: p.src });
      saveGameJSON('daily', game.toJSON());
      recordStart('daily');
    }
  } else {
    game = loadGame('game');
    if (!game) { go('#'); return; }
  }
  const isDaily = slot === 'daily';
  const spec = difficultyById(game.meta.diff);
  if (game.done && !game.counted) countWin(game, slot);
  const lastDiff = () => (difficulties.some((d) => d.id === store.get(KEYS.lastDiff)) ? store.get(KEYS.lastDiff) : 'leicht');
  play = new Play({
    game,
    settings,
    isDaily,
    title: isDaily ? 'Tagesrätsel' : spec.title,
    label: isDaily ? longDate(new Date(game.meta.day + 'T12:00:00'))
      : game.meta.gold ? `Goldrätsel Nr. ${game.meta.number} · doppelte Sterne`
        : `${spec.title} · Rätsel Nr. ${game.meta.number || 1}${game.meta.first ? ' · extra sanft' : ''}`,
    onBack: () => go('#'),
    onSave: (g) => saveGameJSON(slot, g.toJSON()),
    onProgress,
    onSettings: () => openSettings(),
    // Tagesrätsel gelöst: weiter mit dem freien Spiel (laufendes Spiel oder neues Rätsel)
    onNext: isDaily ? () => (regularInProgress() ? go('#play') : startNew(lastDiff())) : () => startNew(game.meta.diff),
    nextLabel: isDaily ? () => (regularInProgress() ? 'Weiterspielen' : 'Neues Rätsel') : null,
    onMenu: () => go('#'),
    onHelp: () => openTutorial(),
    coach: !store.get(KEYS.coachDone, false),
    onCoachDone: () => store.set(KEYS.coachDone, true),
    onSolved: (g) => countWin(g, slot),
    onGiveUp: () => {
      recordAbandon(statsKey(game));
      if (isDaily) { game.restart(); saveGameJSON('daily', game.toJSON()); go('#daily'); }
      else startNew(game.meta.diff);
    },
    onWin: (g, info) => winSheet(g, slot, info),
  });
  setScreen(play.el, 'play');
  lastPct = -1;
  onProgress(game);
  // Allererster Start direkt im Spiel (z.B. Tagesrätsel von der Startseite): erst das Tutorial
  const p = play;
  setTimeout(() => { if (play === p && !p.destroyed) p.openModal(() => firstTutorial()); }, 350);
}

const CHEERS = ['Geschafft!', 'Wunderbar!', 'Super gelöst!', 'Bravo!', 'Toll gemacht!'];

async function winSheet(game, slot, counted = null) {
  const isDaily = slot === 'daily';
  const key = statsKey(game);
  const info = counted || countWin(game, slot) || { newBest: false, stats: loadStats()[key] };
  updateSummary();
  celebrate(themeColors());

  const ms = game.meta.stars || null;
  const starsN = ms ? ms.base : baseStars(game);
  const stars = h('div.stars');
  for (let k = 0; k < 3; k++) {
    const s = h('span', { class: k < starsN ? 'on' : '' });
    s.innerHTML = icon('star', { size: 44 });
    s.style.animationDelay = `${250 + k * 180}ms`;
    stars.append(s);
  }
  for (let k = 0; k < starsN; k++) setTimeout(() => sfx.play('pop'), 300 + k * 180);

  const tile = (val, label, ic) => {
    const t = h('div.ws');
    t.innerHTML = `<span class="wi">${icon(ic, { size: 18 })}</span><b>${val}</b><small>${label}</small>`;
    return t;
  };
  const st = info.stats;
  const sub = isDaily
    ? `Serie: ${dailyStreak(ID)} ${dailyStreak(ID) === 1 ? 'Tag' : 'Tage'} · Morgen gibt’s ein neues Rätsel.`
    : `${difficultyById(game.meta.diff).title} · ${st.won} gelöst${st.streak > 1 ? ` · ${st.streak} in Folge` : ''}`;
  const content = h('div.win', null,
    stars,
    h('div.win-stats', null,
      tile(formatTime(game.elapsed), 'Zeit', 'clock'),
      tile(String(game.mistakes), game.mistakes === 1 ? 'Fehler' : 'Fehler', 'close'),
      tile(String(game.hints), game.hints === 1 ? 'Tipp' : 'Tipps', 'hint')),
    info.newBest ? h('div.win-badge', null, '🏆 Neue Bestzeit!') : null,
    ms ? starReward(ms) : null,
    h('p.win-sub', null, sub));

  const buttons = isDaily
    ? [{ label: 'Zum Menü', value: 'menu', primary: true }]
    : [{ label: 'Nächstes Rätsel', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
  const v = await showModal({ title: isDaily ? 'Tagesrätsel gelöst!' : CHEERS[Math.floor(Math.random() * CHEERS.length)], content, buttons, dismissible: true });
  if (v === 'next') startNew(game.meta.diff);
  else if (v === 'menu') go('#');
}

/** «+3 ★», Fortschritt bis zur nächsten Farbe oder «Neue Farbe freigeschaltet». */
function starReward(ms) {
  const box = h('div.win-reward');
  box.append(h('div.win-plus', null, `+${ms.earned} ★`, ms.mult > 1 ? h('small', null, 'Goldrätsel ×2') : null));
  const fresh = newlyUnlocked(ms.before, ms.after);
  if (fresh.length) {
    const t = fresh[fresh.length - 1];
    const use = h('button.btn.primary.win-use', { type: 'button' }, 'Verwenden');
    use.addEventListener('click', () => {
      if (setTheme(t.id)) { use.textContent = 'Aktiv ✓'; use.disabled = true; sfx.play('pop'); }
    });
    const sw = h('span.win-swatch');
    sw.style.background = t.accent;
    box.append(h('div.win-unlock', null, sw,
      h('span', null, h('small', null, 'Neue Farbe freigeschaltet'), h('b', null, t.title)), use));
    setTimeout(() => sfx.play('sparkle'), 900);
  } else {
    const next = nextLockedTheme(ms.after);
    if (next) {
      const prevAt = themes.filter((t) => t.unlock && t.unlock <= ms.after).reduce((a, t) => Math.max(a, t.unlock), 0);
      const span = next.unlock - prevAt;
      const from = Math.max(0, ms.before - prevAt) / span * 100;
      const to = (ms.after - prevAt) / span * 100;
      const fill = h('i', { style: { width: from + '%' } });
      setTimeout(() => { fill.style.width = Math.max(4, to) + '%'; }, 700);
      box.append(h('div.win-next', null,
        h('small', null, `Noch ${next.unlock - ms.after} ★ bis «${next.title}»`),
        h('div.sd-prog-bar', null, fill)));
    }
  }
  return box;
}

function themeColors() {
  const t = themeById(settings.theme);
  return [t.accent, t.wave, '#ffd23f', '#ff8fa3', '#7fd6a8', '#ffffff'];
}

// ---------- Statistik ----------

function renderStats() {
  const stats = loadStats();
  const regG = regularInProgress();
  const dailyG = loadGame('daily');
  let tab = store.get('sudoku.statsTab', 'leicht');
  const tabs = [...difficulties.map((d) => ({ id: d.id, title: d.title })), { id: 'daily', title: 'Täglich' }];
  if (!tabs.some((t) => t.id === tab)) tab = 'leicht';

  const back = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück' });
  back.innerHTML = icon('back');
  back.addEventListener('click', () => go('#'));
  const top = h('header.topbar', null, back, h('div.title.center', null, 'Statistik'), h('span.icon-spacer'));

  const seg = h('div.seg.seg5', { role: 'tablist' });
  const panel = h('div.stats-panel');
  const render = () => {
    for (const b of seg.children) b.classList.toggle('active', b.dataset.id === tab);
    const s = stats[tab];
    // Laufende (noch nicht beendete) Partie zählt für die Quote nicht als verloren
    const running = tab === 'daily' ? (dailyG && !dailyG.done && dailyG.meta.day === todayKey() ? 1 : 0) : (regG && regG.meta.diff === tab ? 1 : 0);
    const finished = Math.max(s.won, s.played - running);
    const rate = finished ? Math.round((s.won / finished) * 100) : 0;
    const tile = (ic, val, label, cls = '') => {
      const t = h('div.stat', { class: 'stat ' + cls });
      t.innerHTML = `<span class="si">${icon(ic, { size: 20 })}</span><b>${val}</b><small>${label}</small>`;
      return t;
    };
    const tiles = [
      tile('grid', s.played, 'Begonnen'),
      tile('check', s.won, `Gelöst${finished ? ` · ${rate} %` : ''}`),
      tile('trophy', s.best ? formatTime(s.best) : '–', 'Bestzeit', 'accent'),
      tile('clock', s.won ? formatTime(s.total / s.won) : '–', 'Ø Zeit'),
    ];
    if (tab === 'daily') {
      tiles.push(tile('flame', dailyStreak(ID), 'Serie (Tage)', 'warm'));
      tiles.push(tile('star', s.perfect, 'Ohne Fehler & Tipps'));
    } else {
      tiles.push(tile('flame', s.streak, 'Siege in Folge', 'warm'));
      tiles.push(tile('star', s.bestStreak, 'Beste Serie'));
      tiles.push(tile('target', s.perfect, 'Ohne Fehler & Tipps'));
      tiles.push(tile('heartbreak', s.won ? (s.mistakes / s.won).toFixed(1).replace(/\.0$/, '').replace('.', ',') : '–', 'Ø Fehler'));
    }
    const kids = [h('div.stat-grid', null, tiles)];
    if (tab === 'daily') {
      // Kalender der letzten 4 Wochen
      const cal = h('div.cal');
      const today = new Date();
      for (let k = 27; k >= 0; k--) {
        const d = new Date(today);
        d.setDate(d.getDate() - k);
        const ok = isDailyDone(ID, todayKey(d));
        const c = h('span', { class: (ok ? 'ok' : '') + (k === 0 ? ' today' : ''), title: todayKey(d) });
        c.innerHTML = ok ? icon('check', { size: 14, stroke: 3.2 }) : `<em>${d.getDate()}</em>`;
        cal.append(c);
      }
      kids.push(h('section.card.cal-card', null, h('div.card-h', null, 'Letzte 4 Wochen'), cal));
    }
    panel.replaceChildren(...kids);
  };
  for (const t of tabs) {
    const b = h('button', { type: 'button', role: 'tab', 'data-id': t.id }, t.title);
    b.addEventListener('click', () => { tab = t.id; store.set('sudoku.statsTab', tab); render(); });
    seg.append(b);
  }
  render();
  const reset = h('button.btn.ghost.block', { type: 'button' }, 'Statistik zurücksetzen');
  reset.addEventListener('click', async () => {
    if (await confirmDialog('Statistik zurücksetzen?', 'Alle Zahlen werden auf null gestellt. Deine laufenden Spiele bleiben.', 'Zurücksetzen')) {
      resetStats();
      toast('Statistik zurückgesetzt');
      renderStats();
    }
  });
  const total = totalWon();
  const body = h('main.menu-body', null,
    h('div.total', null, h('b', null, String(total)), h('span', null, total === 1 ? 'Rätsel gelöst – insgesamt' : 'Rätsel gelöst – insgesamt')),
    seg, panel, reset);
  setScreen(h('div.screen.stats', null, top, h('div.scroll', null, body)), 'stats');
}

// ---------- Einstellungen ----------

async function openSettings() {
  const sw = (key, title, desc) => {
    const input = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
    input.checked = !!settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      saveSettings(settings);
      if (play) { play.render(); play._updateTimer(); }
    });
    return h('label.set-row', null, h('span.set-txt', null, h('b', null, title), desc ? h('small', null, desc) : null), input);
  };
  const soundIn = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
  soundIn.checked = !sfx.muted;
  soundIn.addEventListener('change', () => { sfx.setMuted(!soundIn.checked); if (soundIn.checked) sfx.play('pop'); });

  const dots = h('div.theme-dots');
  const stars = loadStars();
  for (const t of themes) {
    const open = themeUnlocked(t, stars);
    const b = h('button', { type: 'button', class: (t.id === settings.theme ? 'on' : '') + (open ? '' : ' locked'), 'aria-label': t.title, title: t.title });
    b.style.setProperty('--c', t.accent);
    if (!open) b.innerHTML = icon('lock', { size: 14 });
    b.addEventListener('click', () => {
      if (!open) { themeName.textContent = `${t.title} – ab ${t.unlock} ★`; return; }
      setTheme(t.id);
      for (const x of dots.children) x.classList.toggle('on', x === b);
      themeName.textContent = t.title;
    });
    dots.append(b);
  }
  const themeName = h('small', null, themeById(settings.theme).title);

  const content = h('div.settings', null,
    h('div.set-group', null,
      h('div.set-row.col', null, h('span.set-txt', null, h('b', null, 'Farbe'), themeName), dots)),
    h('div.set-group', null,
      sw('showMistakes', 'Fehler sofort zeigen', 'Aus: Nur doppelte Zahlen werden rot.'),
      sw('threeStrikes', '«3 Fehler»-Modus', 'Nach drei Fehlern ist Schluss.')),
    h('div.set-group', null,
      sw('autoClean', 'Notizen aufräumen', 'Eingetragene Zahl aus den Notizen ringsum entfernen.'),
      sw('hlUnits', 'Reihe, Spalte & Block zeigen'),
      sw('hlSame', 'Gleiche Zahlen zeigen'),
      sw('hideDone', 'Fertige Zahlen ausblenden'),
      sw('showTimer', 'Uhr anzeigen'),
      h('label.set-row', null, h('span.set-txt', null, h('b', null, 'Ton')), soundIn)));
  const themeBefore = settings.theme;
  if (play) play.modalOpen = true;
  await showModal({ title: 'Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }] });
  if (play) { play.modalOpen = false; play._lastTick = performance.now(); play.render(); }
  else if (screen === 'menu' && settings.theme !== themeBefore) renderMenu();
}

// ---------- Router ----------

function route() {
  leavePlay();
  recoverWins();
  const hash = (location.hash || '').replace(/^#/, '');
  if (hash === 'play') openGame('game');
  else if (hash === 'daily') openGame('daily');
  else if (hash === 'stats') renderStats();
  else renderMenu();
}

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
route();

// ---------- Test-Zugang (für automatische Tests, ändert nichts am Spiel) ----------

window.__sudoku = {
  get screen() { return screen; },
  game: () => (play ? play.game.toJSON() : null),
  solution: () => (play ? play.game.solution : null),
  selected: () => (play ? play.sel : null),
  cellRect: (i) => (play ? play.board.cellEl(i).getBoundingClientRect().toJSON() : null),
  generateFresh: (diff) => generateFresh(diff, 'test-' + diff),
  pool: () => Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v.length])),
};
