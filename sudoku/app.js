// Sudoku – Spielpause. Menü, Routen (#play, #daily, #stats), Statistik, Einstellungen.
import { setupPage, soundButton, backButton, h, showModal, confirmDialog, celebrate, toast, sleep } from '../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon } from './ui/icons.js';
import { Play } from './ui/play.js';
import { Game } from './logic/game.js';
import { parse } from './logic/board.js';
import { difficulties, difficultyById, DAILY_DIFFICULTY } from './data/difficulties.js';
import { themes, themeById } from './data/themes.js';
import { pool } from './data/pool.js';
import { nextPuzzle, nextNumber, dailyPuzzle, topUpFresh, generateFresh } from './puzzles.js';
import {
  KEYS, loadSettings, saveSettings, loadStats, recordStart, recordAbandon, recordWin, resetStats,
  totalWon, statsKey, loadGameJSON, saveGameJSON, formatTime,
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
    parts.push(won ? `${won} ${won === 1 ? 'Rätsel' : 'Rätsel'} gelöst` : 'Bereit für das erste Rätsel');
  }
  if (isDailyDone(ID)) parts.push('Tagesrätsel ✓');
  reportSummary(ID, parts.join(' · '));
}

let lastPct = -1;
function onProgress(game) {
  const pct = Math.round(game.progress() * 100);
  if (pct !== lastPct) { lastPct = pct; updateSummary(); }
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

// ---------- Menü ----------

function renderMenu() {
  const inProgress = regularInProgress();
  let diff = store.get(KEYS.lastDiff, 'leicht');
  if (!difficulties.some((d) => d.id === diff)) diff = difficulties[0].id;
  const stats = loadStats();

  const top = h('header.topbar', null, backButton('../'), h('div.title.center', null, 'Sudoku'), soundButton());

  // Laufendes Spiel
  let cont = null;
  if (inProgress) {
    const g = inProgress;
    const pct = Math.round(g.progress() * 100);
    const btn = h('button.btn.primary.block.big', { type: 'button' });
    btn.innerHTML = icon('play', { size: 22 });
    btn.append('Weiter');
    btn.addEventListener('click', () => { sfx.play('tap'); go('#play'); });
    const bar = h('div.bar', null, h('i', { style: { width: pct + '%' } }));
    cont = h('section.card.hero', null,
      h('div.hero-row', null,
        miniBoard(g),
        h('div.hero-info', null,
          h('div.kicker', null, 'Laufendes Spiel'),
          h('div.hero-title', null, difficultyById(g.meta.diff).title),
          h('div.hero-meta', null, `Rätsel Nr. ${g.meta.number || 1} · ${formatTime(g.elapsed)}`),
          bar,
          h('div.hero-meta.small', null, `${pct} % gelöst`))),
      btn);
  }

  // Neues Spiel
  const seg = h('div.seg', { role: 'tablist' });
  const blurb = h('p.seg-blurb');
  const playBtn = h('button.btn.block.big', { type: 'button', class: inProgress ? 'btn block big' : 'btn primary block big' });
  const renderSeg = () => {
    for (const b of seg.children) b.classList.toggle('active', b.dataset.id === diff);
    const spec = difficultyById(diff);
    const st = stats[diff];
    blurb.replaceChildren(h('span', null, spec.blurb),
      st.best ? h('span.best', null, ' · Bestzeit ' + formatTime(st.best)) : h('span.best', null, ` · Nr. ${nextNumber(diff)}`));
    playBtn.innerHTML = icon(inProgress ? 'plus' : 'play', { size: 22 });
    playBtn.append(inProgress ? `Neues Spiel` : 'Spielen');
  };
  difficulties.forEach((spec, k) => {
    const dots = h('span.dots');
    for (let j = 0; j < difficulties.length; j++) dots.append(h('i', { class: j <= k ? 'on' : '' }));
    const b = h('button', { type: 'button', role: 'tab', 'data-id': spec.id }, h('span.lbl', null, spec.title), dots);
    b.addEventListener('click', () => { diff = spec.id; store.set(KEYS.lastDiff, diff); sfx.play('click'); renderSeg(); });
    seg.append(b);
  });
  playBtn.addEventListener('click', async () => {
    sfx.play('tap');
    if (inProgress && inProgress.moves > 0) {
      const ok = await confirmDialog('Neues Spiel?', 'Dein laufendes Spiel wird dabei beendet.', 'Neues Spiel', 'Abbrechen');
      if (!ok) return;
      recordAbandon(inProgress.meta.diff);
    }
    startNew(diff);
  });
  renderSeg();

  const won = totalWon();
  const greet = inProgress ? null : h('div.hero-row', null,
    miniBoard(null, { sample: pool.leicht[0] }),
    h('div.hero-info', null,
      h('div.kicker', null, won ? 'Schön, dass du da bist' : 'Willkommen'),
      h('div.hero-title', null, 'Lust auf ein Rätsel?'),
      h('div.hero-meta', null, won ? `${won} Rätsel gelöst` : 'Wähle eine Stufe und los geht’s.')));

  const newCard = h('section.card.newgame', { class: inProgress ? 'card newgame' : 'card newgame hero' },
    greet,
    inProgress ? h('div.card-h', null, 'Neues Spiel') : null,
    seg, blurb, playBtn);

  // Tagesrätsel
  const done = isDailyDone(ID);
  const streak = dailyStreak(ID);
  const dg = loadGame('daily');
  const dailyRunning = dg && dg.meta.day === todayKey() && !dg.done;
  const dIc = h('div.daily-ic');
  dIc.innerHTML = `<span class="m">${MONTHS[new Date().getMonth()].slice(0, 3).toUpperCase()}</span><span class="d">${new Date().getDate()}</span>`;
  const dState = h('div.daily-state', { class: done ? 'daily-state ok' : 'daily-state' });
  dState.innerHTML = done ? icon('check', { size: 20, stroke: 3 }) : icon('back', { size: 20 });
  const dailyCard = h('button.card.daily', { type: 'button', class: done ? 'card daily done' : 'card daily' },
    dIc,
    h('div.daily-info', null,
      h('b', null, 'Tagesrätsel'),
      h('span', null, longDate()),
      h('small', null, done ? `Gelöst${streak > 1 ? ` · Serie: ${streak} Tage` : ' ✓'}` : dailyRunning ? `Weiter · ${formatTime(dg.elapsed)}` : `${difficultyById(DAILY_DIFFICULTY).title}${streak ? ` · Serie: ${streak} ${streak === 1 ? 'Tag' : 'Tage'}` : ' · für alle gleich'}`)),
    dState);
  dailyCard.addEventListener('click', () => { sfx.play('tap'); go('#daily'); });

  // Kleine Knöpfe
  const small = (ic, label, fn) => {
    const b = h('button.card.mini-btn', { type: 'button' });
    b.innerHTML = `<span class="ic">${icon(ic, { size: 24 })}</span><span>${label}</span>`;
    b.addEventListener('click', () => { sfx.play('click'); fn(); });
    return b;
  };
  const row = h('div.mini-row', null,
    small('chart', 'Statistik', () => go('#stats')),
    small('help', 'So geht’s', () => showHelp()),
    small('settings', 'Einstellungen', () => openSettings()));

  const body = h('main.menu-body', null, cont, newCard, dailyCard, row,
    h('p.foot', null, `${Object.values(pool).reduce((a, x) => a + x.length, 0)} Rätsel im Vorrat – und unendlich viele neue.`));
  const el = h('div.screen.menu', null, top, h('div.scroll', null, body));
  setScreen(el, 'menu');
  updateSummary();
  if (!store.get(KEYS.helpSeen, false)) setTimeout(() => showHelp(), 350);
  // Im Leerlauf frische Rätsel vorbereiten
  setTimeout(() => topUpFresh(), 1500);
}

function startNew(diffId) {
  leavePlay();
  const p = nextPuzzle(diffId);
  const game = Game.create(p.puzzle, p.solution, { mode: 'classic', diff: diffId, number: p.number, src: p.src });
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
  play = new Play({
    game,
    settings,
    isDaily,
    title: isDaily ? 'Tagesrätsel' : spec.title,
    label: isDaily ? longDate(new Date(game.meta.day + 'T12:00:00')) : `${spec.title} · Rätsel Nr. ${game.meta.number || 1}`,
    onBack: () => go('#'),
    onSave: (g) => saveGameJSON(slot, g.toJSON()),
    onProgress,
    onSettings: () => openSettings(),
    onNext: () => startNew(game.meta.diff),
    onMenu: () => go('#'),
    onGiveUp: () => {
      recordAbandon(statsKey(game));
      if (isDaily) { game.restart(); saveGameJSON('daily', game.toJSON()); go('#daily'); }
      else startNew(game.meta.diff);
    },
    onWin: (g) => winSheet(g, slot),
  });
  setScreen(play.el, 'play');
  lastPct = -1;
  onProgress(game);
  if (!store.get(KEYS.helpSeen, false)) setTimeout(() => showHelp(), 350);
}

const CHEERS = ['Geschafft!', 'Wunderbar!', 'Super gelöst!', 'Bravo!', 'Toll gemacht!'];

async function winSheet(game, slot) {
  const isDaily = slot === 'daily';
  const key = statsKey(game);
  let info = { newBest: false, stats: loadStats()[key] };
  if (!game.counted) {
    info = recordWin(key, { time: game.elapsed, mistakes: game.mistakes, hints: game.hints });
    if (isDaily) markDailyDone(ID, game.meta.day);
    game.counted = true;
    saveGameJSON(slot, game.toJSON());
  }
  updateSummary();
  celebrate(themeColors());

  const starsN = Math.max(1, 3 - (game.mistakes > 0 ? 1 : 0) - (game.hints > 0 ? 1 : 0));
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
    h('p.win-sub', null, sub));

  const buttons = isDaily
    ? [{ label: 'Zum Menü', value: 'menu', primary: true }]
    : [{ label: 'Nächstes Rätsel', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
  const v = await showModal({ title: isDaily ? 'Tagesrätsel gelöst!' : CHEERS[Math.floor(Math.random() * CHEERS.length)], content, buttons, dismissible: true });
  if (v === 'next') startNew(game.meta.diff);
  else if (v === 'menu') go('#');
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
  back.addEventListener('click', () => { sfx.play('click'); go('#'); });
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
      tile('grid', s.played, 'Gespielt'),
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
      tiles.push(tile('play', nextNumber(tab) - 1, 'Rätsel begonnen'));
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
    b.addEventListener('click', () => { tab = t.id; store.set('sudoku.statsTab', tab); sfx.play('click'); render(); });
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

// ---------- So geht's ----------

async function showHelp() {
  store.set(KEYS.helpSeen, true);
  const row = (ic, html) => {
    const r = h('div.help-row');
    r.innerHTML = `<span class="hi">${ic}</span><p>${html}</p>`;
    return r;
  };
  const demo = h('div.help-demo');
  const demoVals = [5, 3, 0, 6, 7, 8, 9, 1, 2];
  demoVals.forEach((v, k) => demo.append(h('span', { class: v ? '' : 'gap' }, v ? String(v) : '4')));
  const content = h('div.help', null,
    demo,
    row('<b class="num">1–9</b>', 'Jede <b>Reihe</b>, jede <b>Spalte</b> und jeder <b>3×3-Block</b> enthält die Zahlen 1 bis 9 genau einmal.'),
    row(icon('grid', { size: 22 }), 'Tippe auf ein Feld und dann unten auf eine Zahl. Unter jeder Zahl siehst du, wie viele noch fehlen.'),
    row(icon('pencil', { size: 22 }), 'Mit <b>Notizen</b> merkst du dir mögliche Zahlen. <b>Alle Notizen</b> füllt sie automatisch aus.'),
    row(icon('hint', { size: 22 }), 'Steckst du fest? Der <b>Tipp</b> erklärt dir den nächsten logischen Schritt.'),
    row(icon('clock', { size: 22 }), 'Die Uhr lässt sich pausieren. Dein Spiel wird automatisch gespeichert.'));
  if (play) play.modalOpen = true;
  await showModal({ title: 'So geht’s', content, buttons: [{ label: 'Los geht’s', value: true, primary: true }] });
  if (play) { play.modalOpen = false; play._lastTick = performance.now(); }
}

// ---------- Einstellungen ----------

async function openSettings() {
  const sw = (key, title, desc) => {
    const input = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
    input.checked = !!settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      saveSettings(settings);
      sfx.play('click');
      if (play) { play.render(); play._updateTimer(); }
    });
    return h('label.set-row', null, h('span.set-txt', null, h('b', null, title), desc ? h('small', null, desc) : null), input);
  };
  const soundIn = h('input', { type: 'checkbox', class: 'switch', role: 'switch' });
  soundIn.checked = !sfx.muted;
  soundIn.addEventListener('change', () => { sfx.setMuted(!soundIn.checked); sfx.play('click'); });

  const dots = h('div.theme-dots');
  for (const t of themes) {
    const b = h('button', { type: 'button', class: t.id === settings.theme ? 'on' : '', 'aria-label': t.title, title: t.title });
    b.style.setProperty('--c', t.accent);
    b.addEventListener('click', () => {
      settings.theme = t.id;
      saveSettings(settings);
      applyTheme();
      sfx.play('pop');
      for (const x of dots.children) x.classList.toggle('on', x === b);
      themeName.textContent = t.title;
      if (play) play.render();
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
  if (play) play.modalOpen = true;
  await showModal({ title: 'Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }] });
  if (play) { play.modalOpen = false; play._lastTick = performance.now(); play.render(); }
}

// ---------- Router ----------

function route() {
  leavePlay();
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
