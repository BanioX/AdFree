// Farbfluss – App: Menü, Spiel, Blätter (Hilfe, Einstellungen, Statistik, Level-Übersicht).

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen, markTutorialSeen } from '../shared/tutorial.js';
import { liquids, hiddenLiquid } from './data/colors.js';
import { praise, tips, howTo, featureIntro, stuck } from './data/texts.js';
import { chapterOf, parTarget, starsFor, dailyParams } from './logic/levels.js';
import { applyPour, undoPour, pourAmount, isSolved, hasUsefulMove, isComplete, cloneState, validateState } from './logic/rules.js';
import { solve, solveBest } from './logic/solver.js';
import { Board } from './view/board.js';
import { audio } from './view/audio.js';
import { tutorialSteps } from './view/tutorial.js';
import { engine } from './engine.js';

setupPage();

const ID = 'sort';
const ACCENT = '#22a9b7';
const SPEEDS = { gemuetlich: 1.35, normal: 1, flott: 0.62 };
const SYMBOL_OFFER_COLORS = 11; // ab so vielen Farben werden die Farbsymbole einmal angeboten
const K = {
  progress: 'sort.progress', stats: 'sort.stats', settings: 'sort.settings', seen: 'sort.seen',
  run: (mode) => `sort.run.${mode}`,
};

const app = document.getElementById('app');

// ---------- Gespeicherte Daten ----------

const progress = Object.assign({ level: 1, stars: {} }, store.get(K.progress, {}));
const stats = Object.assign({
  started: 0, won: 0, perfect: 0, pours: 0, undos: 0, hints: 0, extra: 0,
  fastest: null, fastestLabel: '', dailyWon: 0, time: 0,
}, store.get(K.stats, {}));
const settings = Object.assign({ symbols: false, speed: 'normal' }, store.get(K.settings, {}));
const seen = Object.assign({}, store.get(K.seen, {}));

const saveProgress = () => store.set(K.progress, progress);
const saveStats = () => store.set(K.stats, stats);
const saveSettings = () => store.set(K.settings, settings);
const saveSeen = () => store.set(K.seen, seen);

function totalStars() {
  let s = 0;
  for (const v of Object.values(progress.stars)) s += v;
  return s;
}

function report() {
  const daily = isDailyDone(ID) ? ' · Tagesrätsel ✓' : '';
  reportSummary(ID, `Level ${progress.level} · ${totalStars()} ★${daily}`);
}

// ---------- Hilfen ----------

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function dayLabel(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d}. ${MONTHS[m - 1]}`;
}

function starsHtml(n, size = 14) {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<span class="st ${i < n ? 'on' : ''}">${icon('star', { size })}</span>`;
  return s;
}

// ---------- Blätter ----------

/** «So geht's»: gemeinsames, animiertes Tutorial (Schritte in data/texts.js → howTo). */
let helpOpen = null;
function openTutorial(show) {
  if (!helpOpen) {
    helpOpen = show({ id: ID, steps: tutorialSteps(howTo), accent: ACCENT })
      .finally(() => { helpOpen = null; });
  }
  return helpOpen;
}
const showHelp = () => openTutorial(showTutorial);

/** Beim allerersten Start (vor dem ersten Spiel) automatisch; wartet, falls es offen ist. */
function firstHelp() {
  if (seen.help && !tutorialSeen(ID)) markTutorialSeen(ID); // altes Hilfeblatt schon gesehen
  if (tutorialSeen(ID)) return helpOpen || Promise.resolve(false);
  return openTutorial(maybeShowTutorial);
}

function switchRow(label, sub, on, onChange) {
  const sw = h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label });
  sw.classList.toggle('on', on);
  sw.addEventListener('click', () => {
    on = !on;
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', String(on));
    sfx.play('click');
    onChange(on);
  });
  return h('div.set-row', null, h('div.set-label', null, h('b', null, label), sub ? h('small', null, sub) : null), sw);
}

function showSettings(onChanged) {
  const speedChips = h('div.seg');
  const speeds = [['gemuetlich', 'Gemütlich'], ['normal', 'Normal'], ['flott', 'Flott']];
  for (const [id, label] of speeds) {
    const b = h('button.chip', { type: 'button', 'data-id': id }, label);
    b.classList.toggle('active', settings.speed === id);
    b.addEventListener('click', () => {
      settings.speed = id;
      saveSettings();
      sfx.play('click');
      for (const c of speedChips.children) c.classList.toggle('active', c.dataset.id === id);
    });
    speedChips.append(b);
  }
  const reset = h('button.btn.ghost.danger', { type: 'button' }, 'Fortschritt zurücksetzen');
  const help = h('button.btn.block', { type: 'button', html: '<span class="gm-q">?</span> So geht’s' });
  const content = h('div.settings',
    null,
    switchRow('Farbsymbole', 'Zeichen auf jeder Farbe – hilfreich bei ähnlichen Tönen', settings.symbols, (v) => {
      settings.symbols = v; saveSettings(); onChanged && onChanged();
    }),
    h('div.set-row.col', null, h('div.set-label', null, h('b', null, 'Giess-Tempo')), speedChips),
    h('div.set-actions', null, help, reset));
  const p = showModal({ title: 'Optionen', content, buttons: [{ label: 'Fertig', value: 'ok', primary: true }] });
  help.addEventListener('click', () => {
    sfx.play('click');
    document.querySelector('.sp-modal-backdrop .sp-modal-buttons .btn')?.click();
    setTimeout(() => showHelp(), 280);
  });
  reset.addEventListener('click', async () => {
    sfx.play('click');
    document.querySelector('.sp-modal-backdrop .sp-modal-buttons .btn')?.click();
    await sleep(280);
    const ok = await confirmDialog('Alles zurücksetzen?', 'Level, Sterne und Statistik werden gelöscht. Das kann nicht rückgängig gemacht werden.', 'Zurücksetzen', 'Abbrechen');
    if (!ok) return;
    for (const k of store.keys('sort.')) store.remove(k);
    location.hash = '';
    location.reload();
  });
  return p.then(() => { onChanged && onChanged(); });
}

function showStats() {
  const streak = dailyStreak(ID);
  const items = [
    [String(progress.level - 1), 'Level geschafft'],
    [`${totalStars()} ★`, 'Sterne'],
    [String(stats.perfect), 'Perfekte Level'],
    [String(stats.won), 'Gewonnen'],
    [String(stats.started), 'Gespielt'],
    [stats.fastest != null ? fmtTime(stats.fastest) : '–', 'Schnellste Lösung' + (stats.fastestLabel ? ` (${stats.fastestLabel})` : '')],
    [String(stats.dailyWon), 'Tagesrätsel gelöst'],
    [streak ? `${streak} 🔥` : '0', 'Tages-Serie'],
    [String(stats.pours), 'Mal gegossen'],
    [fmtDuration(stats.time), 'Spielzeit'],
  ];
  const grid = h('div.stat-grid');
  for (const [v, l] of items) grid.append(h('div.stat', null, h('b', null, v), h('small', null, l)));
  return showModal({ title: 'Statistik', content: grid, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

function showLevelMap() {
  const backdrop = h('div.sheet-backdrop');
  const body = h('div.sheet-body');
  const close = () => {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 300);
  };
  const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Schliessen', html: icon('close') });
  closeBtn.addEventListener('click', () => { sfx.play('click'); close(); });
  const sheet = h('div.sheet', { role: 'dialog', 'aria-modal': 'true' },
    h('div.sheet-head', null, h('h2', null, 'Level-Übersicht'), closeBtn),
    body);
  backdrop.append(sheet);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  const cur = progress.level;
  const lastCh = chapterOf(cur).index;
  let curEl = null;
  for (let ci = 0; ci <= lastCh; ci++) {
    const ch = chapterOf(ci * 15 + 1);
    let got = 0;
    for (let n = ch.first; n <= ch.last; n++) got += progress.stars[n] || 0;
    const grid = h('div.lv-grid');
    for (let n = ch.first; n <= ch.last; n++) {
      const st = progress.stars[n] || 0;
      let b;
      if (n < cur) {
        b = h('button.lv.done', { type: 'button', 'aria-label': `Level ${n} nochmals spielen` }, h('span', null, String(n)), h('span.stars', { html: starsHtml(st, 11) }));
        b.addEventListener('click', () => { sfx.play('tap'); close(); location.hash = `replay/${n}`; });
      } else if (n === cur) {
        b = h('button.lv.cur', { type: 'button', 'aria-label': `Level ${n} spielen` }, h('span', null, String(n)), h('span.play', { html: icon('play', { size: 12 }) }));
        b.addEventListener('click', () => { sfx.play('tap'); close(); location.hash = 'play'; });
        curEl = b;
      } else {
        b = h('div.lv.locked', null, h('span', null, String(n)));
      }
      grid.append(b);
    }
    body.append(
      h('div.chapter-head', { style: { '--c1': ch.bg[0], '--c2': ch.bg[1] } },
        h('span.em', null, ch.emoji),
        h('div', null, h('b', null, `Kapitel ${ci + 1} · ${ch.name}`), h('small', null, `Level ${ch.first}–${ch.last}`)),
        h('span.ch-stars', { html: `${got}/${(ch.last - ch.first + 1) * 3} ${icon('star', { size: 14 })}` })),
      grid);
  }
  document.body.append(backdrop);
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    if (curEl) body.scrollTop = Math.max(0, curEl.offsetTop - body.clientHeight / 2);
  });
}

/**
 * Schnelles Antippen: Werkzeug-Knöpfe reagieren schon beim Loslassen des Fingers.
 * (Der Doppeltipp-Schutz der Seite würde sonst einen zweiten schnellen Tipp – z.B. zweimal
 * «Zurück» – verschlucken.) Maus/Tastatur laufen weiter über «click».
 */
function onPress(el, fn) {
  let touchT = -1e9;
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || el.disabled) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (!hit || !el.contains(hit)) return;
    touchT = performance.now();
    fn();
  });
  el.addEventListener('click', () => {
    if (performance.now() - touchT < 700) return;
    fn();
  });
}

// ---------- Bildschirme ----------

let screen = null;

function route() {
  if (screen) { screen.destroy(); screen = null; }
  document.querySelectorAll('.sheet-backdrop').forEach((el) => el.remove());
  const hs = location.hash.replace(/^#/, '');
  let m;
  if (hs === 'play') screen = gameScreen({ mode: 'level' });
  else if (hs === 'daily') screen = gameScreen({ mode: 'daily' });
  else if ((m = /^replay\/(\d+)$/.exec(hs)) && +m[1] >= 1 && +m[1] < progress.level) screen = gameScreen({ mode: 'replay', n: +m[1] });
  else screen = menuScreen();
}

function applyChapterBg(n) {
  const ch = chapterOf(n);
  app.style.setProperty('--bg-top', ch.bg[0]);
  app.style.setProperty('--bg-bottom', ch.bg[1]);
  return ch;
}

// ---------- Menü ----------

function menuScreen() {
  const ch = applyChapterBg(progress.level);
  app.className = 'app sort menu-screen';
  const hasRun = !!store.get(K.run('level'), null);
  const first = progress.level === 1 && !hasRun;
  const today = todayKey();
  const dp = dailyParams(today);
  const inCh = progress.level - ch.first;
  const chLen = ch.last - ch.first + 1;

  // Titelbild: kleines, selbst spielendes Regal
  const heroCanvas = h('canvas', { 'aria-hidden': 'true' });
  const art = h('div.hero', null, h('div.hero-board', null, heroCanvas));

  // Fortschritt im Kapitel
  const dots = h('div.ch-dots');
  for (let n = ch.first; n <= ch.last; n++) {
    const d = h('span.dot');
    if (n < progress.level) d.classList.add('done');
    if (n === progress.level) d.classList.add('cur');
    dots.append(d);
  }
  let chStars = 0;
  for (let n = ch.first; n <= ch.last; n++) chStars += progress.stars[n] || 0;
  const chLine = h('div.ch-line', null, dots, h('span.ch-stars', { html: `${chStars}/${chLen * 3} ${icon('star', { size: 15 })}` }));
  const tip = h('p.tip', null, '💡 ', tips[Math.floor(Math.random() * tips.length)]);

  const play = async () => {
    await firstHelp(); // Anleitung immer vor dem allerersten Spiel
    if (screen && screen.kind === 'menu') location.hash = 'play';
  };
  const menu = gameMenu({
    id: ID,
    title: 'Farbfluss',
    tagline: `${ch.emoji} Kapitel ${ch.index + 1} · ${ch.name}`,
    accent: ACCENT,
    art,
    primary: {
      label: first ? 'Spielen' : 'Weiterspielen',
      sub: `Level ${progress.level}${inCh >= 0 ? ` · ${inCh + 1}/${chLen} im Kapitel` : ''}`,
      onClick: play,
    },
    daily: {
      done: isDailyDone(ID),
      streak: dailyStreak(ID),
      sub: dp.name,
      onClick: async () => { await firstHelp(); if (screen && screen.kind === 'menu') location.hash = 'daily'; },
    },
    secondary: [
      { label: 'Levels', icon: 'grid', onClick: showLevelMap },
      { label: 'Statistik', icon: 'star', onClick: showStats },
      { label: 'Optionen', icon: 'settings', onClick: () => showSettings() },
    ],
    stats: [
      { label: 'Geschafft', value: progress.level - 1 },
      { label: 'Sterne', value: totalStars() },
      { label: 'Perfekt', value: stats.perfect },
      { label: 'Serie', value: dailyStreak(ID) },
    ],
    sections: [menuSection('Dieses Kapitel', chLine), tip],
    onHelp: showHelp,
    backHref: '../',
  });
  app.replaceChildren(menu);

  const demo = startDemo(heroCanvas, ch);
  report();
  firstHelp();

  return { kind: 'menu', destroy() { demo.stop(); } };
}

function startDemo(canvas, ch) {
  const cols = [liquids[0], liquids[2], liquids[1], liquids[7]];
  const start = {
    per: 4,
    tubes: [
      { cap: 4, l: [0, 1, 2, 3], h: 0 },
      { cap: 4, l: [2, 3, 0, 1], h: 0 },
      { cap: 4, l: [3, 0, 1, 2], h: 0 },
      { cap: 4, l: [1, 2, 3, 0], h: 0 },
      { cap: 4, l: [], h: 0 },
      { cap: 4, l: [], h: 0 },
    ],
  };
  const sol = solve(start, { maxNodes: 20000, weight: 1.5 }).moves || [];
  const board = new Board(canvas, {
    interactive: false, maxW: 27, shelf: true, padY: 6, topRoom: 2, vAlign: 1,
    shelfColor: ch.shelf, colorOf: (c) => cols[c], hiddenColor: hiddenLiquid.color,
    symbols: () => settings.symbols, speed: () => 1.15,
  });
  let state = cloneState(start);
  board.setState(state, { intro: true });
  let i = 0, timer = 0, stopped = false;
  const step = () => {
    if (stopped) return;
    if (document.hidden) { timer = setTimeout(step, 1000); return; }
    if (i >= sol.length) {
      timer = setTimeout(() => {
        if (stopped) return;
        state = cloneState(start); i = 0;
        board.setState(state, { intro: true });
        timer = setTimeout(step, 1400);
      }, 2400);
      return;
    }
    const m = sol[i++];
    const mv = applyPour(state, m.from, m.to);
    board.select(m.from);
    timer = setTimeout(() => {
      if (stopped) return;
      board.select(-1);
      board.pour(mv, state.tubes[mv.from].h);
      timer = setTimeout(step, 1500);
    }, 380);
  };
  timer = setTimeout(step, 1200);
  return { stop() { stopped = true; clearTimeout(timer); board.destroy(); } };
}

// ---------- Spiel ----------

function newRun(level, mode) {
  return {
    v: 1,
    mode,
    id: level.id,
    n: level.n || 0,
    day: level.day || null,
    name: level.name || '',
    colors: level.colors,
    par: level.par,
    geheimnis: !!level.geheimnis,
    gross: level.gross || null,
    tutorial: !!level.tutorial,
    initial: cloneState(level.state),
    state: cloneState(level.state),
    history: [],
    moves: 0,
    extraUsed: false,
    elapsed: 0,
    won: false,
  };
}

function validRun(run, id) {
  return run && run.v === 1 && run.id === id && run.state && !validateState(run.state) && Array.isArray(run.history);
}

function gameScreen({ mode, n }) {
  const today = todayKey();
  let levelNo = mode === 'level' ? progress.level : mode === 'replay' ? n : 0;
  const expectId = mode === 'daily' ? 'D' + today : 'L' + levelNo;
  const ch = applyChapterBg(mode === 'daily' ? progress.level : levelNo);
  app.className = 'app sort game-screen';

  let destroyed = false;
  let run = null;
  let board = null;
  let sel = -1;
  let tStart = 0;
  let stuckShown = false;
  let solving = false;
  let coachStep = 0;
  let paused = false;

  // --- DOM ---
  const back = backButton('#', () => { sfx.play('click'); location.hash = ''; });
  const titleMain = h('b', null, mode === 'daily' ? 'Tagesrätsel' : `Level ${levelNo}`);
  const titleSub = h('small', null, '');
  const chips = h('div.feat');
  const helpBtn = h('button.icon-btn', { type: 'button', id: 'game-help', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  const top = h('header.topbar.game-top', null, back, h('div.title-block', null, h('div.tb-row', null, titleMain, chips), titleSub), helpBtn, soundButton());
  const canvas = h('canvas', { 'aria-label': 'Spielfeld' });
  const coach = h('div.coach.hidden');
  const loading = h('div.loading', null, h('div.spinner'), h('span', null, 'Gläser werden gefüllt …'));
  const wrap = h('div.board-wrap', null, canvas, coach, loading);

  const tool = (ic, label, id) => {
    const b = h('button.tool', { type: 'button', id }, h('span.ic', { html: icon(ic) }), h('span.lbl', null, label));
    return b;
  };
  const bUndo = tool('undo', 'Zurück', 'tool-undo');
  const bHint = tool('hint', 'Tipp', 'tool-hint');
  const bExtra = tool('plus', '+1 Glas', 'tool-extra');
  const bRestart = tool('refresh', 'Neustart', 'tool-restart');
  const toolbar = h('nav.toolbar', null, bUndo, bHint, bExtra, bRestart);
  app.replaceChildren(top, wrap, toolbar);

  const showLoad = setTimeout(() => loading.classList.add('show'), 160);

  // --- Zeit ---
  const flushTime = () => {
    if (!run || run.won || !tStart) return;
    const now = performance.now();
    const d = Math.min(now - tStart, 60000);
    run.elapsed += d;
    stats.time += d;
    tStart = now;
  };
  const save = () => {
    if (!run) return;
    flushTime();
    if (run.mode === 'level' && run.won) store.remove(K.run('level'));
    else store.set(K.run(run.mode), run);
    saveStats();
  };
  const onVis = () => {
    if (document.hidden) { save(); tStart = 0; }
    else if (run && !run.won && !paused) tStart = performance.now();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', save);
  const autosave = setInterval(() => { if (run && !run.won && !document.hidden) save(); }, 5000);

  // --- HUD ---
  function updateHud() {
    if (!run) return;
    const target = parTarget(run.par);
    titleSub.textContent = `${run.mode === 'replay' ? 'Wiederholung · ' : ''}Züge ${run.moves} · Ziel ${target}`;
    bUndo.disabled = !run.history.length || run.won;
    bExtra.disabled = run.extraUsed || run.won;
    bExtra.classList.toggle('used', run.extraUsed);
    bHint.disabled = run.won;
    bRestart.disabled = run.won || (!run.history.length && !run.extraUsed);
  }

  function setChips() {
    chips.replaceChildren();
    if (run.geheimnis) chips.append(h('span.fchip.secret', { title: 'Geheimnis-Level' }, run.gross ? '?' : '? Geheimnis'));
    if (run.gross) chips.append(h('span.fchip.tall', { title: 'Grosse Gläser' }, run.geheimnis ? 'Gross' : 'Grosse Gläser'));
  }

  // --- Coach (Anleitung im ersten Level) ---
  function setCoach(text) {
    if (!text) { coach.classList.add('hidden'); return; }
    coach.textContent = text;
    coach.classList.remove('hidden');
  }

  async function tutorialStep() {
    if (!run || !run.tutorial || run.won) { setCoach(null); return; }
    if (sel >= 0) {
      const r = await engine.hint(run.state);
      if (destroyed || !run || run.won) return;
      const mv = r && r.move;
      if (mv && mv.from === sel) {
        board.setHint({ from: mv.from, to: mv.to });
        setCoach('Und jetzt das Glas, in das es fliessen soll.');
      } else {
        board.setHint(null);
        setCoach('Tippe ein Glas an, um es wieder abzustellen.');
      }
      return;
    }
    const r = await engine.hint(run.state);
    if (destroyed || !run || run.won) return;
    if (r && r.move) {
      board.setHint({ from: r.move.from, to: -1 });
      setCoach(coachStep === 0 ? 'Tippe auf das Glas mit dem Pfeil.' : 'Super! Weiter so – Glas antippen …');
    }
  }

  // --- Spielzüge ---
  function tap(i) {
    if (!run || run.won) return;
    const st = run.state;
    if (!run.tutorial && board.hint && !(sel < 0 && board.hint.from === i)) board.setHint(null);
    if (i < 0) {
      if (sel >= 0) { sel = -1; board.select(-1); }
      if (run.tutorial) tutorialStep();
      return;
    }
    const t = st.tubes[i];
    if (sel < 0) {
      if (!t.l.length || isComplete(t, st.per)) {
        board.shake(i);
        sfx.play('click');
        return;
      }
      sel = i;
      board.select(i);
      sfx.play('tap');
      if (run.tutorial) tutorialStep();
      return;
    }
    if (sel === i) {
      sel = -1;
      board.select(-1);
      sfx.play('click');
      if (run.tutorial) tutorialStep();
      return;
    }
    const amount = pourAmount(st, sel, i);
    if (amount) {
      const mv = applyPour(st, sel, i);
      run.history.push([mv.from, mv.to, mv.n]);
      run.moves++;
      stats.pours++;
      board.select(-1);
      board.pour(mv, st.tubes[mv.from].h, st.tubes[mv.to].h);
      sel = -1;
      coachStep++;
      save();
      updateHud();
      if (isSolved(st)) { onSolved(); return; }
      if (run.tutorial) { board.setHint(null); setCoach(null); board.whenIdle().then(() => tutorialStep()); }
      return;
    }
    // Ziel passt nicht: anderes Glas wählen (oder schütteln, wenn es nicht wählbar ist)
    if (t.l.length && !isComplete(t, st.per)) {
      board.shake(sel);
      sel = i;
      board.select(i);
      sfx.play('tap');
    } else {
      board.shake(i);
      sfx.play('error');
      sel = -1;
      board.select(-1);
    }
    if (run.tutorial) tutorialStep();
  }

  function onIdle() {
    if (!run || run.won || destroyed) return;
    if (!stuckShown && !hasUsefulMove(run.state)) {
      stuckShown = true;
      showStuck();
    }
  }

  async function showStuck() {
    const buttons = [{ label: 'Rückgängig', value: 'undo', primary: true, icon: 'undo' }];
    if (!run.extraUsed) buttons.push({ label: '+1 Glas', value: 'extra', icon: 'plus' });
    buttons.push({ label: 'Neu beginnen', value: 'restart', icon: 'refresh' });
    const v = await showModal({ title: stuck.title, text: stuck.text, buttons });
    if (destroyed) return;
    if (v === 'undo') undo();
    else if (v === 'extra') addGlass();
    else if (v === 'restart') restart(true);
    else stuckShown = false;
  }

  function undo() {
    if (!run || run.won || !run.history.length) return;
    board.finishAll();
    const [from, to, nUnits] = run.history.pop();
    undoPour(run.state, { from, to, n: nUnits });
    run.moves = Math.max(0, run.moves - 1);
    stats.undos++;
    sel = -1;
    board.select(-1);
    board.setHint(null);
    board.sync(run.state);
    board.shake(from);
    sfx.play('whoosh');
    stuckShown = false;
    save();
    updateHud();
    if (run.tutorial) tutorialStep();
  }

  async function restart(force) {
    if (!run || run.won) return;
    if (!force && run.history.length > 3) {
      const ok = await confirmDialog('Neu beginnen?', 'Das Level startet wieder von vorne.', 'Neu beginnen', 'Abbrechen');
      if (!ok || destroyed) return;
    }
    board.finishAll();
    run.state = cloneState(run.initial);
    run.history = [];
    run.moves = 0;
    run.extraUsed = false;
    sel = -1;
    stuckShown = false;
    coachStep = 0;
    board.setState(run.state, { intro: true });
    sfx.play('whoosh');
    save();
    updateHud();
    if (run.tutorial) tutorialStep();
  }

  function addGlass() {
    if (!run || run.won || run.extraUsed) return;
    board.finishAll();
    run.extraUsed = true;
    const tube = { cap: run.state.per, l: [], h: 0 };
    run.state.tubes.push(tube);
    // Für Neustart merken, damit die Gläser-Zahl stimmt, wird das Extra-Glas nur im aktuellen Stand geführt
    stats.extra++;
    board.addTube(tube);
    sfx.play('pop');
    stuckShown = false;
    toast('Ein leeres Glas mehr – höchstens zwei Sterne');
    save();
    updateHud();
  }

  async function giveHint() {
    if (!run || run.won || solving) return;
    solving = true;
    bHint.classList.add('busy');
    try {
      const r = await engine.hint(run.state);
      if (destroyed || !run || run.won) return;
      stats.hints++;
      if (r && r.move) {
        sel = -1;
        board.select(-1);
        board.setHint({ from: r.move.from, to: r.move.to });
        sfx.play('sparkle');
      } else if (r && r.exhausted) {
        sfx.play('error');
        if (!stuckShown) { stuckShown = true; await board.whenIdle(); if (!destroyed && run && !run.won) showStuck(); }
        else toast(run.extraUsed ? 'Sackgasse – mach ein paar Züge rückgängig.' : 'Sackgasse – Rückgängig oder «+1 Glas» hilft.');
      } else {
        toast('Hm, schwierig! Versuch es mit Rückgängig.');
      }
    } catch {
      toast('Tipp gerade nicht verfügbar.');
    } finally {
      solving = false;
      bHint.classList.remove('busy');
    }
  }

  onPress(bUndo, () => { sfx.play('click'); undo(); });
  onPress(bRestart, () => { sfx.play('click'); restart(false); });
  onPress(bExtra, () => { addGlass(); });
  onPress(bHint, () => { sfx.play('click'); giveHint(); });

  /** «So geht's» mitten im Spiel – die Zeit läuft solange nicht weiter. */
  async function openHelp() {
    if (paused) return;
    flushTime();
    paused = true;
    tStart = 0;
    try { await showHelp(); } finally {
      paused = false;
      if (!destroyed && run && !run.won && !document.hidden) tStart = performance.now();
    }
  }
  onPress(helpBtn, () => { sfx.play('click'); openHelp(); });

  // --- Gewonnen ---
  async function onSolved() {
    flushTime();
    run.won = true;
    tStart = 0;
    setCoach(null);
    board.setHint(null);
    const stars = starsFor({ moves: run.moves, par: run.par, extraUsed: run.extraUsed });
    stats.won++;
    if (stars === 3) stats.perfect++;
    if (stats.fastest == null || run.elapsed < stats.fastest) {
      stats.fastest = run.elapsed;
      stats.fastestLabel = run.mode === 'daily' ? 'Tagesrätsel' : `Level ${run.n}`;
    }
    let newChapter = null;
    let wasDailyDone = false;
    if (run.mode === 'level') {
      const before = chapterOf(run.n).index;
      progress.stars[run.n] = Math.max(progress.stars[run.n] || 0, stars);
      progress.level = Math.max(progress.level, run.n + 1);
      if (chapterOf(progress.level).index !== before) newChapter = chapterOf(progress.level);
      store.remove(K.run('level'));
      // Nächstes Level schon vorbereiten
      engine.level(progress.level).catch(() => {});
    } else if (run.mode === 'replay') {
      progress.stars[run.n] = Math.max(progress.stars[run.n] || 0, stars);
      store.remove(K.run('replay'));
    } else if (run.mode === 'daily') {
      wasDailyDone = isDailyDone(ID, run.day);
      if (!wasDailyDone && run.day === todayKey()) {
        markDailyDone(ID, run.day);
        stats.dailyWon++;
      }
      store.set(K.run('daily'), run);
    }
    saveProgress();
    saveStats();
    report();
    updateHud();

    await board.whenIdle();
    await sleep(520);
    if (destroyed) return;
    board.celebrate();
    sfx.play('complete');
    celebrate(run.colors.slice(0, 6).map((c) => liquids[c].color));
    await sleep(650);
    if (destroyed) return;
    showWin(stars, newChapter);
  }

  async function showWin(stars, newChapter) {
    const content = h('div.win');
    content.append(h('div.win-stars', { html: [0, 1, 2].map((i) => `<span class="ws ${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.18}s">${icon('star', { size: 54 })}</span>`).join('') }));
    const target = parTarget(run.par);
    content.append(h('p.win-sub', null,
      run.mode === 'daily' ? `Tagesrätsel vom ${dayLabel(run.day)}` : `Level ${run.n} geschafft`));
    content.append(h('div.win-stats', null,
      h('div', null, h('b', null, String(run.moves)), h('small', null, `Züge (Ziel ${target})`)),
      h('div', null, h('b', null, fmtTime(run.elapsed)), h('small', null, 'Zeit')),
      run.mode === 'daily'
        ? h('div', null, h('b', null, `${dailyStreak(ID)} 🔥`), h('small', null, 'Tage in Folge'))
        : h('div', null, h('b', null, `${totalStars()}`), h('small', null, 'Sterne total'))));
    if (run.extraUsed) content.append(h('p.win-note', null, 'Mit Extra-Glas gelöst – ohne gibt’s drei Sterne.'));
    else if (stars < 3) content.append(h('p.win-note', null, `Mit höchstens ${target} Zügen gibt’s drei Sterne.`));
    if (newChapter) {
      content.append(h('div.win-chapter', null, h('span', null, newChapter.emoji), h('div', null, h('small', null, 'Neues Kapitel'), h('b', null, newChapter.name))));
    }
    // Sterne-Klänge
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.play('sparkle'), 350 + i * 180);

    let buttons;
    if (run.mode === 'level') {
      buttons = [
        { label: `Weiter zu Level ${progress.level}`, value: 'next', primary: true, icon: 'play' },
        { label: 'Menü', value: 'menu', ghost: true },
      ];
    } else if (run.mode === 'replay') {
      buttons = [
        { label: 'Level-Übersicht', value: 'map', primary: true, icon: 'grid' },
        { label: `Weiter mit Level ${progress.level}`, value: 'play', ghost: true },
      ];
    } else {
      buttons = [
        { label: 'Zum Menü', value: 'menu', primary: true, icon: 'home' },
        { label: `Weiter mit Level ${progress.level}`, value: 'play', ghost: true },
      ];
    }
    const v = await showModal({ title: praise[Math.floor(Math.random() * praise.length)], content, buttons, dismissible: false });
    if (destroyed) return;
    if (v === 'next') nextLevel();
    else if (v === 'map') { location.hash = ''; setTimeout(showLevelMap, 120); }
    else if (v === 'play') location.hash = 'play';
    else location.hash = '';
  }

  function nextLevel() {
    // gleicher Bildschirm, neues Level
    destroy();
    screen = gameScreen({ mode: 'level' });
  }

  // --- Laden ---
  async function load() {
    let saved = store.get(K.run(mode), null);
    if (mode === 'daily' && saved && saved.id !== expectId) saved = null;
    if (validRun(saved, expectId)) {
      run = saved;
      if (run.won && mode === 'daily') {
        // schon gelöst: neu anfangen (zum Üben) oder zurück
        const v = await showModal({
          title: 'Heute schon gelöst ✓',
          text: 'Morgen wartet ein neues Tagesrätsel. Möchtest du es nochmals spielen?',
          buttons: [{ label: 'Nochmals spielen', value: 'again', primary: true }, { label: 'Zum Menü', value: 'menu', ghost: true }],
        });
        if (destroyed) return;
        if (v !== 'again') { location.hash = ''; return; }
        const lvl = await engine.daily(today);
        run = newRun(lvl, 'daily');
      } else if (run.won) {
        run = null;
      }
    }
    if (!run) {
      let lvl;
      try {
        lvl = mode === 'daily' ? await engine.daily(today) : await engine.level(levelNo);
      } catch (err) {
        loading.querySelector('span').textContent = 'Level konnte nicht erzeugt werden.';
        return;
      }
      if (destroyed) return;
      run = newRun(lvl, mode);
      stats.started++;
      save();
    }
    // Allererster Start (z.B. direkt über #play): erst die Anleitung
    if (!tutorialSeen(ID)) {
      clearTimeout(showLoad);
      await firstHelp();
      if (destroyed) return;
    }
    clearTimeout(showLoad);
    loading.remove();
    if (mode === 'daily') titleMain.textContent = 'Tagesrätsel';
    setChips();
    board = new Board(canvas, {
      colorOf: (c) => liquids[run.colors[c]] || liquids[0],
      hiddenColor: hiddenLiquid.color,
      symbols: () => settings.symbols,
      speed: () => SPEEDS[settings.speed] || 1,
      onTap: tap,
      onIdle,
      onCork: (i, count) => audio.cork(count - 1),
      onReveal: () => audio.reveal(),
      sound: audio,
      shelfColor: ch.shelf,
      accent: ACCENT,
      maxW: 64,
      vAlign: 0.5,
    });
    board.setState(run.state, { intro: true });
    tStart = performance.now();
    updateHud();
    report();
    if (mode === 'level') engine.level(levelNo + 1).catch(() => {});
    // Einführungen
    const intro = run.geheimnis && !seen.geheimnis ? 'geheimnis' : run.gross && !seen.gross ? 'gross' : null;
    if (intro) {
      seen[intro] = true;
      saveSeen();
      await sleep(500);
      if (!destroyed) await showModal({ title: featureIntro[intro].title, text: featureIntro[intro].text, buttons: [{ label: 'Verstanden', value: true, primary: true }] });
    }
    // Viele Farben: einmal die Farbsymbole anbieten
    if (!intro && !settings.symbols && !seen.symbols && run.colors.length >= SYMBOL_OFFER_COLORS && !run.won) {
      seen.symbols = true;
      saveSeen();
      await sleep(500);
      if (destroyed) return;
      const v = await showModal({
        title: featureIntro.symbols.title,
        text: featureIntro.symbols.text,
        buttons: [{ label: 'Farbsymbole an', value: 'on', primary: true }, { label: 'Nein, danke', value: 'off', ghost: true }],
      });
      if (v === 'on') { settings.symbols = true; saveSettings(); if (board) board.wake(); toast('Farbsymbole an – änderbar unter «Optionen»'); }
    }
    if (run.tutorial) setTimeout(() => tutorialStep(), 700);
    if (!hasUsefulMove(run.state) && !run.won) onIdle();
  }

  function destroy() {
    if (destroyed) return;
    save();
    destroyed = true;
    clearTimeout(showLoad);
    clearInterval(autosave);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', save);
    if (board) board.destroy();
    if (window.__sort && window.__sort._game === api) window.__sort._game = null;
  }

  const api = {
    get run() { return run; },
    get board() { return board; },
    tap,
    undo, restart: () => restart(true), addGlass, hint: giveHint,
    /** Gespielte Zeit (ms) – für Tests. */
    get elapsed() { flushTime(); return run ? run.elapsed : 0; },
  };
  if (window.__sort) window.__sort._game = api;

  load();
  return { kind: 'game', destroy };
}

// ---------- Test-Zugang (für automatische Tests) ----------

window.__sort = {
  _game: null,
  get game() { return this._game; },
  progress, stats, settings,
  /** Liefert die Lösung ab dem aktuellen Stand (Liste von {from,to}). */
  solution() {
    const g = this._game;
    if (!g || !g.run) return null;
    const r = solveBest(g.run.state, { budget: 200000 });
    return r && r.moves ? r.moves.map((m) => ({ from: m.from, to: m.to })) : null;
  },
  /** Bildschirm-Mittelpunkt eines Glases (Client-Koordinaten). */
  center(i) {
    const g = this._game;
    return g && g.board ? g.board.tubeCenter(i) : null;
  },
  idle() {
    const g = this._game;
    return g && g.board ? g.board.whenIdle() : Promise.resolve();
  },
};

window.addEventListener('hashchange', route);
route();
