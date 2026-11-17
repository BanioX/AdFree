// Stapel-Sortieren – gemeinsame App-Hülle: Startbildschirm, Spielansicht, Speichern/Fortsetzen,
// Hash-Routing, Statistik, Gewinnblatt, Tipp, Rückgängig, Extra-Stapel, Coach-Mark.
// Jedes Spiel liefert nur Regeln, Inhalte (Level-Parameter, Kapitel), Aussehen (view) und Tutorial.
//
//   runSortGame({ id, title, tagline, accent, rules, names, view, level, zen, hard, daily,
//                 chapters, chapterSize, tutorial, confetti, sounds, showcase, sections, onWin, winExtra })
//
// Routen: ''  Startbildschirm · '#play' gewählter Modus · '#level/N' Level N · '#zen' · '#hard' · '#daily'

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../../shared/storage.js';
import { sfx } from '../../shared/sfx.js';
import { icon, h, toast, showModal, celebrate, setupPage, soundButton, backButton, sleep } from '../../shared/ui.js';
import { gameMenu, menuSection } from '../../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../../shared/tutorial.js';
import * as E from './engine.js';
import { solve } from './solver.js';
import { generateLevel } from './generator.js';
import { createBoard, miniBoard } from './board.js';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const PRAISE = ['Super!', 'Klasse!', 'Wunderbar!', 'Fantastisch!', 'Meisterhaft!'];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function dayLabel(day) {
  const [y, mo, d] = day.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d}. ${MONTHS[mo - 1]}`;
}

/** Sterne für einen gelösten Durchgang (Hilfen kosten höchstens einen Stern). */
export function starsFor(moves, par, helped) {
  let s = 3;
  if (moves > par) s--;
  if (moves > Math.ceil(par * 1.5) + 2) s--;
  if (helped) s = Math.min(s, 2);
  return Math.max(1, s);
}

function starsHtml(n, max = 3, size = 14) {
  let out = '';
  for (let i = 0; i < max; i++) out += `<span class="sg-star${i < n ? ' on' : ''}" style="width:${size}px;height:${size}px">${icon('star', { size })}</span>`;
  return out;
}

export function runSortGame(cfg) {
  setupPage();
  const ID = cfg.id;
  const rules = cfg.rules;
  const N = Object.assign({ stack: 'Stapel', stacks: 'Stapel', piece: 'Teil', pieces: 'Teile', extra: '+1 Stapel', extraLong: 'Ein leerer Stapel dazu' }, cfg.names);
  const CH = cfg.chapterSize || 15;
  const MAX_EXTRA = cfg.maxExtra || 1;
  const snd = Object.assign({
    lift: () => sfx.play('tap'),
    land: () => sfx.play('place'),
    complete: () => sfx.play('sparkle'),
    error: () => sfx.play('error'),
    hint: () => sfx.play('pop'),
    win: () => sfx.play('complete'),
  }, cfg.sounds || {});
  const MODES = cfg.modes || [
    { id: 'kapitel', label: 'Kapitel', slot: 'main' },
    { id: 'entspannt', label: 'Entspannt', slot: 'zen' },
    { id: 'knifflig', label: 'Knifflig', slot: 'hard' },
  ];

  const K = {
    progress: `${ID}.progress`, stats: `${ID}.stats`, settings: `${ID}.settings`, coach: `${ID}.coached`,
    run: (slot) => `${ID}.run.${slot}`,
  };
  const progress = Object.assign({ level: 1, stars: {}, zen: 1, hard: 1 }, store.get(K.progress, {}));
  const stats = Object.assign({ won: 0, perfect: 0, moves: 0, ms: 0, daily: 0, zen: 0, hard: 0, hints: 0, best: 0 }, store.get(K.stats, {}));
  const settings = Object.assign({ mode: MODES[0].id }, store.get(K.settings, {}));
  if (!MODES.some((m) => m.id === settings.mode)) settings.mode = MODES[0].id;
  const saveProgress = () => store.set(K.progress, progress);
  const saveStats = () => store.set(K.stats, stats);
  const saveSettings = () => store.set(K.settings, settings);

  const app = document.getElementById('app');
  app.style.setProperty('--accent', cfg.accent);
  document.documentElement.style.setProperty('--accent', cfg.accent);

  function totalStars() { return Object.values(progress.stars).reduce((a, b) => a + b, 0); }
  function report() { reportSummary(ID, `Level ${progress.level} · ${totalStars()} ★`); }

  function chapterOf(n) {
    const idx = Math.floor((n - 1) / CH);
    const list = cfg.chapters;
    const base = list[idx % list.length];
    const round = Math.floor(idx / list.length);
    return { idx, start: idx * CH + 1, end: idx * CH + CH, name: base.name + (round === 0 ? '' : (ROMAN[round] || ` ${round + 1}`)), emoji: base.emoji, bg: base.bg };
  }

  function applyTheme(el, bg) {
    if (!bg) return;
    el.style.setProperty('--sg-bg1', bg[0]);
    el.style.setProperty('--sg-bg2', bg[1]);
  }

  // ---------- Tutorial ----------
  let helpOpen = null;
  let overlay = 0;
  function openHelp(fn = showTutorial) {
    if (helpOpen) return helpOpen;
    overlay++;
    helpOpen = fn({ id: ID, steps: cfg.tutorial(), accent: cfg.accent }).finally(() => { helpOpen = null; overlay--; });
    return helpOpen;
  }

  // ---------- Durchgänge ----------
  function slotOfMode(mode) { return (MODES.find((m) => m.id === mode) || MODES[0]).slot; }

  function paramsFor(slot, n, day) {
    if (slot === 'zen') return cfg.zen(n);
    if (slot === 'hard') return cfg.hard(n);
    if (slot === 'daily') return cfg.daily(day);
    return cfg.level(n);
  }

  function seedFor(slot, n, day) {
    if (slot === 'zen') return `${ID}-Z${n}`;
    if (slot === 'hard') return `${ID}-H${n}`;
    if (slot === 'daily') return `${ID}-D${day}`;
    return `${ID}-L${n}`;
  }

  function newRun(slot, n, day) {
    const p = paramsFor(slot, n, day);
    const g = generateLevel({ seed: seedFor(slot, n, day), colors: p.colors, cap: p.cap, empties: p.empties, fill: p.fill, rules, minMoves: p.minMoves || 0, maxMoves: p.maxMoves, maxTries: p.maxTries });
    const hidden = p.hidden ? g.stacks.map((col) => col.map((_, j) => (j < col.length - 1 ? 1 : 0))) : null;
    return {
      v: 1, slot, n, day: day || null, cap: g.cap, start: g.stacks.map((s) => s.slice()), stacks: g.stacks.map((s) => s.slice()),
      hist: [], extra: 0, hints: 0, ms: 0, par: g.par, hidden, startHidden: hidden ? hidden.map((c) => c.slice()) : null,
      tag: p.tag || '', colors: p.colors, won: false,
    };
  }

  function validRun(r) {
    if (!r || r.v !== 1 || !Array.isArray(r.stacks) || !Array.isArray(r.hist) || !Array.isArray(r.start)) return false;
    if (E.validateState({ cap: r.cap, stacks: r.stacks })) return false;
    if (r.hidden && (!Array.isArray(r.hidden) || r.hidden.length !== r.stacks.length || r.hidden.some((c, i) => !Array.isArray(c) || c.length !== r.stacks[i].length))) return false;
    return true;
  }

  function loadRun(slot) {
    const r = store.get(K.run(slot), null);
    return validRun(r) ? r : null;
  }
  const saveRun = (r) => store.set(K.run(r.slot), r);
  const dropRun = (slot) => store.remove(K.run(slot));

  // ---------- Router ----------
  let screen = null;
  function go(hs) {
    if (location.hash.replace(/^#/, '') === hs) route();
    else location.hash = hs;
  }

  function route() {
    if (screen && screen.destroy) screen.destroy();
    screen = null;
    document.querySelectorAll('.sp-modal-backdrop').forEach((m) => m.remove());
    const hs = location.hash.replace(/^#/, '');
    let m;
    if (hs === 'play') return startSlot(slotOfMode(settings.mode));
    if (hs === 'zen') return startSlot('zen');
    if (hs === 'hard') return startSlot('hard');
    if (hs === 'daily') return startSlot('daily');
    if ((m = /^level\/(\d+)$/.exec(hs))) {
      const n = +m[1];
      if (n >= 1 && n <= progress.level) return startSlot(n === progress.level ? 'main' : 'replay', n);
    }
    menuScreen();
  }

  function startSlot(slot, n) {
    let run = loadRun(slot);
    if (slot === 'main') { if (!run || run.n !== progress.level || run.won) run = newRun('main', progress.level); }
    else if (slot === 'replay') { if (!run || run.n !== n || run.won) run = newRun('replay', n); }
    else if (slot === 'zen') { if (!run || run.n !== progress.zen || run.won) run = newRun('zen', progress.zen); }
    else if (slot === 'hard') { if (!run || run.n !== progress.hard || run.won) run = newRun('hard', progress.hard); }
    else if (slot === 'daily') { const day = todayKey(); if (!run || run.day !== day) run = newRun('daily', 0, day); }
    saveRun(run);
    gameScreen(run);
  }

  // ---------- Startbildschirm ----------
  function previewRun() {
    const run = loadRun(slotOfMode(settings.mode));
    if (run && !run.won && run.hist.length) return run;
    return null;
  }

  function menuArt() {
    const run = previewRun();
    const box = h('div.sg-art');
    const ch = chapterOf(progress.level);
    applyTheme(box, ch.bg);
    const state = run ? { cap: run.cap, stacks: run.stacks } : cfg.showcase;
    box.append(miniBoard(state, cfg.view, { width: 300, height: 128, hidden: run ? run.hidden : null }));
    return box;
  }

  function primaryFor() {
    const slot = slotOfMode(settings.mode);
    const run = loadRun(slot);
    const going = run && !run.won && run.hist.length > 0;
    if (slot === 'zen') return { label: going ? 'Weiterspielen' : 'Spielen', sub: `Entspannt · Runde ${progress.zen} · ohne Sterne` };
    if (slot === 'hard') return { label: going ? 'Weiterspielen' : 'Spielen', sub: `Knifflig · Rätsel ${progress.hard} · nur eine freie ${N.stack}` };
    const ch = chapterOf(progress.level);
    return { label: going ? 'Weiterspielen' : 'Spielen', sub: `Level ${progress.level} · ${ch.emoji} ${ch.name}` };
  }

  function menuScreen() {
    report();
    const menu = gameMenu({
      id: ID, title: cfg.title, tagline: cfg.tagline, accent: cfg.accent,
      art: menuArt(),
      primary: { ...primaryFor(), onClick: () => go('play') },
      daily: cfg.daily ? { done: isDailyDone(ID), streak: dailyStreak(ID), sub: cfg.dailyLabel || 'Rätsel des Tages', onClick: () => go('daily') } : null,
      modes: {
        label: 'Modus', value: settings.mode,
        options: MODES.map((m) => ({ id: m.id, label: m.label })),
        onChange(id) {
          settings.mode = id; saveSettings();
          menu.update({ primary: { ...primaryFor(), onClick: () => go('play') } });
          const art = menu.querySelector('.gm-art');
          if (art) art.replaceChildren(menuArt());
        },
      },
      secondary: [
        { label: 'Levels', icon: 'grid', sub: `${Math.max(0, progress.level - 1)} geschafft`, onClick: () => levelGrid(chapterOf(progress.level).idx) },
        { label: 'Statistik', icon: 'star', onClick: showStats },
      ],
      stats: [
        { label: 'Level', value: progress.level },
        { label: 'Sterne', value: totalStars() },
        { label: 'Perfekt', value: stats.perfect },
        { label: 'Tagesserie', value: dailyStreak(ID) },
      ],
      sections: [chapterStrip(), ...(cfg.sections ? cfg.sections() : [])],
      onHelp: () => openHelp(),
    });
    app.replaceChildren(menu);
    app.className = 'app sg-app';
    screen = { kind: 'menu' };
  }

  function chapterStrip() {
    const cur = chapterOf(progress.level).idx;
    const row = h('div.sg-chapters');
    for (let i = 0; i <= cur + 1; i++) {
      const c = chapterOf(i * CH + 1);
      let done = 0, st = 0;
      for (let n = c.start; n <= c.end; n++) { if (progress.stars[n]) { done++; st += progress.stars[n]; } }
      const locked = i > cur;
      const card = h('button.sg-chapter' + (i === cur ? '.cur' : '') + (locked ? '.locked' : ''), { type: 'button' },
        h('span.sg-ch-emoji', null, locked ? '🔒' : c.emoji),
        h('b', null, c.name),
        h('small', null, locked ? `ab Level ${c.start}` : `${done}/${CH} · ${st} ★`),
        h('span.sg-ch-bar', null, h('i', { style: { width: `${(done / CH) * 100}%` } })));
      applyTheme(card, c.bg);
      if (!locked) card.addEventListener('click', () => levelGrid(i));
      row.append(card);
    }
    requestAnimationFrame(() => {
      const curEl = row.querySelector('.cur');
      if (curEl) row.scrollLeft = Math.max(0, curEl.offsetLeft - 18);
    });
    return menuSection('Kapitel', row);
  }

  function levelGrid(idx) {
    const c = chapterOf(idx * CH + 1);
    const grid = h('div.sg-grid');
    for (let n = c.start; n <= c.end; n++) {
      const locked = n > progress.level;
      const s = progress.stars[n] || 0;
      const p = cfg.level(n);
      const b = h('button.sg-lvl' + (n === progress.level ? '.cur' : '') + (locked ? '.locked' : '') + (p.tag ? '.special' : ''), { type: 'button', disabled: locked },
        h('b', null, locked ? '' : String(n)),
        locked ? h('span', { html: icon('lock', { size: 16 }) }) : h('span.sg-lvl-stars', { html: s ? starsHtml(s, 3, 10) : (n === progress.level ? '<small>neu</small>' : '') }));
      if (!locked) b.addEventListener('click', () => { grid.closest('.sp-modal-backdrop')?.click(); go(`level/${n}`); });
      grid.append(b);
    }
    showModal({ title: `${c.emoji} ${c.name}`, content: grid, buttons: [{ label: 'Schliessen', value: null, ghost: true }] });
  }

  function showStats() {
    const rows = [
      ['Levels geschafft', progress.level - 1],
      ['Sterne', totalStars()],
      ['Perfekt (3 ★ ohne Hilfe)', stats.perfect],
      ['Entspannt-Runden', stats.zen],
      ['Knifflige Rätsel', stats.hard],
      ['Tagesrätsel gelöst', stats.daily],
      ['Tagesserie', dailyStreak(ID)],
      ['Züge insgesamt', stats.moves],
      ['Spielzeit', fmtTime(stats.ms)],
    ];
    const list = h('div.sg-statlist', null, rows.map(([k, v]) => h('div', null, h('span', null, k), h('b', null, String(v)))));
    showModal({ title: 'Statistik', content: list, buttons: [{ label: 'Schliessen', value: null, primary: true }] });
  }

  // ---------- Spielansicht ----------
  function gameScreen(run) {
    const state = { cap: run.cap, stacks: run.stacks };
    const isLevel = run.slot === 'main' || run.slot === 'replay';
    const ch = isLevel ? chapterOf(run.n) : chapterOf(progress.level);
    let busy = false;
    let chain = 0;
    let coachMove = null;
    let dead = false;

    const root = h('div.sg-game');
    applyTheme(app, ch.bg);
    const titleEl = h('b');
    const subEl = h('small');
    const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
    helpBtn.addEventListener('click', () => { openHelp(); });
    const topbar = h('div.topbar.sg-topbar', null,
      backButton('#', () => go('')),
      h('div.sg-title', null, titleEl, subEl),
      helpBtn, soundButton());
    const boardHost = h('div.sg-board');
    const praiseEl = h('div.sg-praise');
    const stage = h('div.sg-stage', null, boardHost, praiseEl);

    const tool = (ic, label) => {
      const b = h('button.sg-tool', { type: 'button' }, h('span.sg-tool-ic', { html: icon(ic, { size: 24 }) }), h('span.sg-tool-label', null, label));
      return b;
    };
    const bUndo = tool('undo', 'Zurück');
    const bHint = tool('hint', 'Tipp');
    const bExtra = tool('plus', N.extra);
    const bRestart = tool('refresh', 'Neustart');
    const tools = h('div.sg-tools', null, bUndo, bHint, bExtra, bRestart);
    root.append(topbar, stage, tools);
    if (cfg.decorate) cfg.decorate(root, run);
    app.replaceChildren(root);
    app.className = 'app sg-app sg-playing';

    const board = createBoard(boardHost, cfg.view, {
      lockComplete: rules.complete === 'lock',
      onTap,
      onLand: () => snd.land(),
    });
    board.set(state, { hidden: run.hidden });

    function hud() {
      if (run.slot === 'daily') { titleEl.textContent = 'Tagesrätsel'; subEl.textContent = `${dayLabel(run.day)} · Züge ${run.hist.length}`; }
      else if (run.slot === 'zen') { titleEl.textContent = `Entspannt ${run.n}`; subEl.textContent = `Züge ${run.hist.length}`; }
      else if (run.slot === 'hard') { titleEl.textContent = `Knifflig ${run.n}`; subEl.textContent = `Züge ${run.hist.length}`; }
      else {
        titleEl.textContent = `Level ${run.n}`;
        subEl.textContent = `${run.tag ? run.tag + ' · ' : ''}Züge ${run.hist.length} · Ziel ${run.par}`;
      }
      bUndo.disabled = !run.hist.length || busy;
      bRestart.disabled = !run.hist.length || busy;
      bExtra.disabled = run.extra >= MAX_EXTRA || busy;
      bHint.disabled = busy;
    }
    hud();

    const save = () => saveRun(run);

    // Zeit
    const timer = setInterval(() => {
      if (document.hidden || busy || overlay > 0 || document.querySelector('.sp-modal-backdrop')) return;
      run.ms += 1000;
      if (run.ms % 5000 === 0) save();
    }, 1000);
    const onVis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', save);

    // Coach-Mark im allerersten Level
    if (run.slot === 'main' && run.n === 1 && !run.hist.length && !store.get(K.coach, false)) {
      const sol = solve(state, rules, { maxNodes: 20000 });
      if (sol && sol.moves.length) { coachMove = sol.moves[0]; board.coach(coachMove.from); }
    }
    function coachStep(phase) {
      if (!coachMove) return;
      if (phase === 'lift-ok') board.coach(coachMove.to);
      else if (phase === 'drop') board.coach(coachMove.from);
      else { board.coach(null); coachMove = null; store.set(K.coach, true); }
    }

    // ---------- Verdeckte Teile ----------
    function revealTop(i, k = 1) {
      if (!run.hidden) return;
      const col = run.hidden[i];
      for (let j = Math.max(0, col.length - k); j < col.length; j++) {
        if (col[j]) { col[j] = 0; board.reveal(i, j); }
      }
    }
    function hiddenAfterMove(rec) {
      if (!run.hidden) return;
      run.hidden[rec.from].length -= rec.count;
      if (rec.cleared) run.hidden[rec.to] = [];
      else for (let k = 0; k < rec.count; k++) run.hidden[rec.to].push(0);
      revealTop(rec.from);
    }
    function hiddenAfterUndo(rec) {
      if (!run.hidden) return;
      if (rec.cleared) run.hidden[rec.to] = new Array(state.cap).fill(0);
      run.hidden[rec.to].length -= rec.count;
      for (let k = 0; k < rec.count; k++) run.hidden[rec.from].push(0);
    }

    // ---------- Eingabe ----------
    function onTap(i) {
      if (busy || run.won || overlay > 0) return;
      const sel = board.lifted.i;
      if (i < 0) { if (sel >= 0) { board.drop(); coachStep('drop'); } return; }
      if (sel < 0) {
        if (!E.canPick(state, i, rules)) { board.shake(i); snd.error(); return; }
        const k = E.pickCount(state, i, rules);
        revealTop(i, k);
        board.lift(i, k);
        snd.lift();
        if (coachMove) coachStep(i === coachMove.from ? 'lift-ok' : 'drop');
        return;
      }
      if (i === sel) { board.drop(); coachStep('drop'); return; }
      const rec = E.applyMove(state, sel, i, rules);
      if (!rec) {
        if (E.canPick(state, i, rules) && state.stacks[i].length) {
          const k = E.pickCount(state, i, rules);
          revealTop(i, k);
          board.lift(i, k);
          snd.lift();
          if (coachMove) coachStep(i === coachMove.from ? 'lift-ok' : 'drop');
        } else { board.shake(i); snd.error(); }
        return;
      }
      afterMove(rec);
    }

    function afterMove(rec) {
      run.hist.push(rec);
      stats.moves++;
      hiddenAfterMove(rec);
      if (coachMove) coachStep('done');
      const completed = rec.cleared || (rules.complete === 'lock' && E.isComplete(state.stacks[rec.to], state.cap));
      chain = completed ? chain + 1 : 0;
      const solved = E.isSolved(state, rules);
      if (solved) { run.won = true; busy = true; }
      save();
      hud();
      board.move(rec).then(() => {
        if (!screen || screen.board !== board) return;
        if (completed) {
          board.refreshDone(state);
          snd.complete(rec);
          if (chain >= 2 && !solved) praise(PRAISE[Math.min(chain - 2, PRAISE.length - 1)]);
        }
        if (solved) win();
        else checkStuck();
      });
      if (!solved) saveStats();
    }

    function praise(text) {
      praiseEl.textContent = text;
      praiseEl.classList.remove('go');
      void praiseEl.offsetWidth;
      praiseEl.classList.add('go');
    }

    function checkStuck() {
      if (dead || run.won) return;
      if (E.hasUsefulMove(state, rules)) return;
      dead = true;
      setTimeout(async () => {
        if (!screen || screen.board !== board || run.won) return;
        overlay++;
        const btns = [{ label: 'Zug zurücknehmen', value: 'undo', primary: true, icon: 'undo' }];
        if (run.extra < MAX_EXTRA) btns.push({ label: N.extra, value: 'extra', icon: 'plus' });
        btns.push({ label: 'Neu beginnen', value: 'restart', ghost: true });
        const v = await showModal({ title: 'Keine Züge mehr', text: `Kein Problem – nimm einen Zug zurück${run.extra < MAX_EXTRA ? ` oder hol dir eine leere ${N.stack}` : ''}.`, buttons: btns });
        overlay--;
        dead = false;
        if (v === 'undo') undo();
        else if (v === 'extra') addExtra();
        else if (v === 'restart') restart();
      }, 450);
    }

    function undo() {
      if (busy || !run.hist.length) return;
      const rec = run.hist.pop();
      E.undoMove(state, rec);
      hiddenAfterUndo(rec);
      chain = 0;
      board.refreshDone(state, false);
      board.undo(rec);
      save(); hud();
    }

    function addExtra() {
      if (busy || run.extra >= MAX_EXTRA) return;
      board.drop();
      run.extra++;
      state.stacks.push([]);
      if (run.hidden) run.hidden.push([]);
      board.addStack();
      sfx.play('pop');
      save(); hud();
      toast(N.extraLong);
    }

    async function restart() {
      if (busy || !run.hist.length) return;
      run.stacks = run.start.map((s) => s.slice());
      state.stacks = run.stacks;
      run.hist = []; run.extra = 0;
      run.hidden = run.startHidden ? run.startHidden.map((c) => c.slice()) : null;
      chain = 0;
      board.set(state, { hidden: run.hidden });
      sfx.play('whoosh');
      save(); hud();
    }

    function giveHint() {
      if (busy || run.won) return;
      board.drop();
      const r = solve(state, rules, { maxNodes: 30000 });
      if (!r || !r.moves.length) {
        toast(run.extra < MAX_EXTRA ? `Hier geht es nicht mehr weiter – nimm Züge zurück oder nimm eine leere ${N.stack}.` : 'Hier geht es nicht mehr weiter – nimm ein paar Züge zurück.', 3200);
        return;
      }
      const m = r.moves[0];
      run.hints++; stats.hints++;
      board.flash(m.from, 'hint-src', 2400);
      board.flash(m.to, 'hint-dst', 2400);
      snd.hint();
      save(); saveStats();
    }

    bUndo.addEventListener('click', undo);
    bRestart.addEventListener('click', restart);
    bExtra.addEventListener('click', addExtra);
    bHint.addEventListener('click', giveHint);

    // ---------- Gewonnen ----------
    async function win() {
      hud();
      const moves = run.hist.length;
      const helped = run.extra > 0 || run.hints > 0;
      const stars = isLevel || run.slot === 'daily' ? starsFor(moves, run.par, helped) : 0;
      stats.won++;
      stats.ms += run.ms;
      if (stars === 3 && !helped) stats.perfect++;
      let next = null;
      if (run.slot === 'main' || run.slot === 'replay') {
        progress.stars[run.n] = Math.max(progress.stars[run.n] || 0, stars);
        if (run.slot === 'main') progress.level = run.n + 1;
        next = progress.level;
      } else if (run.slot === 'zen') { progress.zen++; stats.zen++; }
      else if (run.slot === 'hard') { progress.hard++; stats.hard++; }
      else if (run.slot === 'daily') { if (!isDailyDone(ID, run.day)) stats.daily++; markDailyDone(ID, run.day); }
      if (cfg.onWin) cfg.onWin(run);
      saveProgress(); saveStats(); save(); report();
      await sleep(260);
      if (!screen || screen.board !== board) return;
      celebrate(cfg.confetti ? cfg.confetti(run) : null);
      snd.win();
      await sleep(420);
      if (!screen || screen.board !== board) return;
      const body = h('div.sg-win');
      if (stars) {
        const st = h('div.sg-win-stars', { html: starsHtml(stars, 3, 40) });
        body.append(st);
      } else body.append(h('div.sg-win-emoji', null, cfg.winEmoji || '🎉'));
      body.append(h('p.sg-win-line', null, `${moves} Züge · ${fmtTime(run.ms)}`));
      if (isLevel) body.append(h('p.sg-win-sub', null, stars === 3 ? (helped ? 'Toll gemacht!' : 'Perfekt – in Bestform!') : `Ziel für 3 Sterne: ${run.par} Züge${helped ? ' ohne Hilfe' : ''}`));
      if (run.slot === 'daily') body.append(h('p.sg-win-sub', null, `Tagesserie: ${dailyStreak(ID)} ${dailyStreak(ID) === 1 ? 'Tag' : 'Tage'} – morgen gibt es ein neues Rätsel.`));
      if (cfg.winExtra) { const x = cfg.winExtra(run); if (x) body.append(x); }
      const titles = { main: `Level ${run.n} geschafft!`, replay: `Level ${run.n} geschafft!`, zen: 'Schön sortiert!', hard: 'Knifflig gelöst!', daily: 'Tagesrätsel gelöst!' };
      const btns = [];
      if (run.slot === 'main') btns.push({ label: `Weiter zu Level ${next}`, value: 'next', primary: true, icon: 'play' });
      else if (run.slot === 'replay') btns.push({ label: `Weiter mit Level ${progress.level}`, value: 'main', primary: true, icon: 'play' });
      else if (run.slot === 'zen' || run.slot === 'hard') btns.push({ label: 'Nächste Runde', value: 'again-mode', primary: true, icon: 'play' });
      else btns.push({ label: `Weiter mit Level ${progress.level}`, value: 'main', primary: true, icon: 'play' });
      if (isLevel) btns.push({ label: 'Nochmal spielen', value: 'replay', icon: 'refresh' });
      btns.push({ label: 'Zum Menü', value: 'menu', ghost: true });
      overlay++;
      const v = await showModal({ title: titles[run.slot], content: body, buttons: btns, dismissible: false });
      overlay--;
      if (v === 'next' || v === 'main') { dropRun(run.slot); go(`level/${progress.level}`); }
      else if (v === 'again-mode') { go(run.slot); }
      else if (v === 'replay') { store.set(K.run('replay'), newRun('replay', run.n)); go(`level/${run.n}`); }
      else go('');
    }

    const scr = {
      kind: 'game', board, run, state,
      destroy() {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', save);
        save();
        board.destroy();
        if (window.__sg && window.__sg.board === board) window.__sg = null;
      },
    };
    screen = scr;
    window.__sg = {
      get run() { return run; }, state, board, rules,
      solution: () => { const r = solve(state, rules, { maxNodes: 60000 }); return r ? r.moves : null; },
      center: (i) => board.center(i),
      idle: () => board.idle(),
    };

    // Erster Start: Anleitung vor dem ersten Spiel
    if (!tutorialSeen(ID)) openHelp(maybeShowTutorial);
    return scr;
  }

  window.addEventListener('hashchange', route);
  report();
  route();
  return { go };
}
