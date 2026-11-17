// Gemeinsame Hülle der Brettspiel-Familie: Startbildschirm, Kopfzeile, Werkzeuge,
// Statistik, Gewinnblatt. Die Regeln und das Brett baut jedes Spiel selbst.

import { h, icon, showModal, confirmDialog, celebrate, setupPage, backButton } from '../../shared/ui.js';
import { store, reportSummary } from '../../shared/storage.js';
import { sfx } from '../../shared/sfx.js';
import { gameMenu } from '../../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../../shared/tutorial.js';
import { dict, languageButton } from '../../shared/i18n.js';

export const bt = dict({
  de: {
    easy: 'Leicht', medium: 'Mittel', hard: 'Schwer',
    running: 'Partie läuft · {level}',
    ready: 'Bereit für die erste Partie',
    winOne: '{n} Sieg · {level}',
    wins: '{n} Siege · {level}',
    resume: 'Weiterspielen', play: 'Spielen', opponent: 'Gegner',
    newGame: 'Neues Spiel', newAsk: 'Neues Spiel?', newText: 'Die laufende Partie wird beendet.',
    statWins: 'Siege', statStreak: 'Serie', statBest: 'Beste', statPlayed: 'Partien',
    youWin: 'Gewonnen!', close: 'Knapp!', draw: 'Unentschieden',
    streak: '{n} Siege in Folge.',
    again: 'Nochmal', menu: 'Menü',
    undo: 'Zurück', hint: 'Tipp', neu: 'Neu',
    youMove: 'Du bist am Zug', cpuThink: 'Computer überlegt …',
    youWinShort: 'Du gewinnst!', cpuWin: 'Computer gewinnt',
    newMatch: 'Neue Partie?', endMatch: 'Die laufende Partie wird beendet.', restart: 'Neu starten',
  },
  en: {
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    running: 'Game in progress · {level}',
    ready: 'Ready for the first game',
    winOne: '{n} win · {level}',
    wins: '{n} wins · {level}',
    resume: 'Continue', play: 'Play', opponent: 'Opponent',
    newGame: 'New game', newAsk: 'New game?', newText: 'The current game will end.',
    statWins: 'Wins', statStreak: 'Streak', statBest: 'Best', statPlayed: 'Games',
    youWin: 'You win!', close: 'So close!', draw: 'Draw',
    streak: '{n} wins in a row.',
    again: 'Again', menu: 'Menu',
    undo: 'Undo', hint: 'Hint', neu: 'New',
    youMove: 'Your turn', cpuThink: 'Computer is thinking …',
    youWinShort: 'You win!', cpuWin: 'Computer wins',
    newMatch: 'New game?', endMatch: 'The current game will end.', restart: 'Start over',
  },
});

export const LEVELS = [
  { id: 'leicht', label: 'Leicht' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'schwer', label: 'Schwer' },
];

const LEVEL_KEY = { leicht: 'easy', mittel: 'medium', schwer: 'hard' };

export function levelLabel(id) {
  return bt(LEVEL_KEY[id] || 'medium');
}

function levelOptions() {
  return LEVELS.map((l) => ({ id: l.id, label: levelLabel(l.id) }));
}

function textOf(v) {
  return typeof v === 'function' ? v() : v;
}

const emptyBag = () => ({
  played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0,
  by: { leicht: { w: 0, l: 0, d: 0 }, mittel: { w: 0, l: 0, d: 0 }, schwer: { w: 0, l: 0, d: 0 } },
});

export function loadBag(id) {
  return { ...emptyBag(), ...(store.get(id + '.stats', {}) || {}) };
}

export function saveBag(id, bag) {
  store.set(id + '.stats', bag);
}

/**
 * Startet ein Brettspiel.
 * cfg: { id, title, tagline, accent, steps (Array oder Funktion), art?, summary?,
 *        confetti?, start({ app, diff, saved, fresh, save, exit, help, finish }) => { destroy } }
 * Gespeichert wird, was `save(state)` bekommt (JSON). `saved.over` bedeutet: Partie zu Ende.
 */
export function boot(cfg) {
  setupPage();
  const app = document.getElementById('app');
  if (cfg.accent) app.style.setProperty('--accent', cfg.accent);

  const stepsOf = () => (typeof cfg.steps === 'function' ? cfg.steps() : cfg.steps);
  let helpOpen = null;
  function help(force) {
    if (helpOpen) return helpOpen;
    const fn = force || tutorialSeen(cfg.id) ? showTutorial : maybeShowTutorial;
    helpOpen = fn({ id: cfg.id, steps: stepsOf(), accent: cfg.accent }).finally(() => { helpOpen = null; });
    return helpOpen;
  }

  const curDiff = () => {
    const d = store.get(cfg.id + '.diff', 'mittel');
    return LEVELS.some((l) => l.id === d) ? d : 'mittel';
  };
  const setDiff = (d) => store.set(cfg.id + '.diff', d);

  const loadMatch = () => store.get(cfg.id + '.match', null);
  const saveMatch = (state) => store.set(cfg.id + '.match', state);
  const clearMatch = () => store.remove(cfg.id + '.match');

  let cleanup = null;
  let view = '';
  let token = 0;

  function teardown() {
    if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  }

  function summaryText(diff) {
    if (cfg.summary) return cfg.summary({ diff, bag: loadBag(cfg.id), saved: loadMatch() });
    const bag = loadBag(cfg.id);
    const saved = loadMatch();
    if (saved && !saved.over) return bt('running', { level: levelLabel(saved.diff || diff) });
    if (!bag.played) return bt('ready');
    const key = bag.wins === 1 ? 'winOne' : 'wins';
    return bt(key, { n: bag.wins, level: levelLabel(diff) });
  }

  function showMenu() {
    teardown();
    view = 'menu';
    const diff = curDiff();
    reportSummary(cfg.id, summaryText(diff));
    const saved = loadMatch();
    const resumable = !!(saved && !saved.over);
    const bag = loadBag(cfg.id);
    let mode = diff;
    const menu = gameMenu({
      id: cfg.id,
      title: textOf(cfg.title),
      tagline: textOf(cfg.tagline),
      accent: cfg.accent,
      art: cfg.art ? cfg.art() : undefined,
      primary: resumable
        ? { label: bt('resume'), sub: levelLabel(saved.diff || diff), onClick: () => openPlay(false) }
        : { label: bt('play'), sub: levelLabel(mode), onClick: () => openPlay(true) },
      modes: {
        label: bt('opponent'),
        value: mode,
        options: levelOptions(),
        onChange: (id) => { mode = id; setDiff(id); reportSummary(cfg.id, summaryText(id)); menu.update({ primary: primaryNow() }); },
      },
      secondary: resumable ? [{
        label: bt('newGame'), icon: 'plus',
        onClick: async () => {
          if (await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'))) openPlay(true);
        },
      }] : [],
      stats: [
        { label: bt('statWins'), value: bag.wins },
        { label: bt('statStreak'), value: bag.streak },
        { label: bt('statBest'), value: bag.best },
        { label: bt('statPlayed'), value: bag.played },
      ],
      onHelp: () => help(true),
    });

    function primaryNow() {
      const s = loadMatch();
      if (s && !s.over) return { label: bt('resume'), sub: levelLabel(s.diff || mode), onClick: () => openPlay(false) };
      return { label: bt('play'), sub: levelLabel(mode), onClick: () => openPlay(true) };
    }
    app.replaceChildren(menu);
  }

  function openPlay(fresh) {
    if (location.hash !== '#play') {
      history.pushState({ bd: cfg.id }, '', location.pathname + location.search + '#play');
    }
    showPlay(fresh);
  }

  async function showPlay(fresh) {
    const my = ++token;
    teardown();
    view = 'play';
    if (!tutorialSeen(cfg.id)) await help(false);
    if (my !== token) return;
    const diff = curDiff();
    let saved = fresh ? null : loadMatch();
    if (saved && saved.over) saved = null;
    if (fresh) clearMatch();
    const ctx = {
      app,
      diff: (saved && saved.diff) || diff,
      saved,
      fresh: !saved,
      save: (state) => saveMatch(state),
      clear: clearMatch,
      exit: () => {
        if (history.state && history.state.bd === cfg.id) history.back();
        else {
          history.replaceState(null, '', location.pathname + location.search);
          showMenu();
        }
      },
      help: () => help(true),
      finish: (kind, extra) => finishGame(kind, extra, (saved && saved.diff) || diff),
    };
    const handle = cfg.start(ctx);
    if (handle && handle.destroy) cleanup = handle.destroy;
    if (my !== token) teardown();
  }

  async function finishGame(kind, extra = {}, diff) {
    const bag = loadBag(cfg.id);
    bag.played += 1;
    const slot = bag.by[diff] || (bag.by[diff] = { w: 0, l: 0, d: 0 });
    if (kind === 'win') {
      bag.wins += 1; slot.w += 1; bag.streak += 1;
      if (bag.streak > bag.best) bag.best = bag.streak;
    } else if (kind === 'lose') {
      bag.losses += 1; slot.l += 1; bag.streak = 0;
    } else {
      bag.draws += 1; slot.d += 1;
    }
    saveBag(cfg.id, bag);
    reportSummary(cfg.id, summaryText(diff));
    if (kind === 'win') {
      celebrate(cfg.confetti);
      sfx.play('complete');
    } else sfx.play('thud');
    const title = extra.title || (kind === 'win' ? bt('youWin') : kind === 'lose' ? bt('close') : bt('draw'));
    let text = extra.text || '';
    if (kind === 'win' && bag.streak >= 3) text = (text ? text + ' ' : '') + bt('streak', { n: bag.streak });
    const choice = await showModal({
      title,
      text,
      dismissible: false,
      buttons: [
        { label: bt('again'), value: 'again', primary: true },
        { label: bt('menu'), value: 'menu', ghost: true },
      ],
    });
    return choice === 'menu' ? 'menu' : 'again';
  }

  let routing = false;
  function route() {
    if (routing) return;
    routing = true;
    queueMicrotask(() => { routing = false; });
    if ((location.hash || '') === '#play') showPlay(false);
    else showMenu();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
  route();
}

/** Spielfläche: Kopfzeile, Statuszeile, Brett, Werkzeugleiste. */
export function stage({ title, sub, onBack, onHelp }) {
  const t = h('b', null, title || '');
  const s = h('small', null, sub || '');
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  helpBtn.addEventListener('click', () => onHelp && onHelp());
  const top = h('div.topbar', null,
    backButton('#', (e) => { if (e) e.preventDefault(); onBack && onBack(); }),
    h('div.bd-title', null, t, s),
    languageButton(),
    helpBtn);
  const status = h('div.bd-status');
  const board = h('div.bd-stage');
  const tools = h('div.bd-tools');
  const root = h('div.bd-play', null, top, status, board, tools);
  return {
    root, board, tools, status,
    setStatus(text, kind) {
      status.textContent = text || '';
      status.className = 'bd-status' + (kind ? ' ' + kind : '');
    },
    setTitle(text) { t.textContent = text || ''; },
    setSub(text) { s.textContent = text || ''; },
  };
}

/**
 * Tippen auf ein Feld (Maus und Finger).
 * iOS Safari bricht pointerup oft ab – nach einem umgebauten Brett oder nach
 * setPointerCapture kommt nur noch ein click. Beides zählt, aber nur einmal.
 */
export function onPress(root, selector, fn) {
  let fromPointer = 0;
  const hit = (e) => {
    const el = e.target && e.target.closest ? e.target.closest(selector) : null;
    if (!el || !root.contains(el)) return null;
    return el;
  };
  const onPointer = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = hit(e);
    if (!el) return;
    fromPointer = performance.now();
    fn(el, e);
  };
  const onClick = (e) => {
    if (fromPointer && performance.now() - fromPointer < 500) return;
    const el = hit(e);
    if (!el) return;
    fn(el, e);
  };
  root.addEventListener('pointerup', onPointer);
  root.addEventListener('click', onClick);
  return () => {
    root.removeEventListener('pointerup', onPointer);
    root.removeEventListener('click', onClick);
  };
}

/** Werkzeugknöpfe neu zeichnen. items: [{ icon, label, onClick, disabled }] */
export function fillTools(el, items) {
  el.replaceChildren();
  for (const t of items) {
    const b = h('button.bd-tool', { type: 'button', 'aria-label': t.label });
    b.innerHTML = icon(t.icon, { size: 22 });
    b.append(h('span', null, t.label));
    if (t.disabled) b.disabled = true;
    b.addEventListener('click', () => { if (!b.disabled && t.onClick) t.onClick(); });
    el.append(b);
  }
}
