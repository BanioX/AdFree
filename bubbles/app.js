// Blasenzauber – App: Startbildschirm, Levelkarte, Spielansicht, Sieg/Niederlage, Statistik.
// Regeln: core/game.js · Level: core/levels.js · Darstellung: view.js

import { store, reportSummary } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage, soundButton, backButton } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial } from '../shared/tutorial.js';
import { Game } from './core/game.js';
import { getLevel, worldOfLevel, LEVELS_PER_WORLD } from './core/levels.js';
import { bestMove } from './core/solver.js';
import { worldInfo } from './data/worlds.js';
import { COLORS } from './data/colors.js';
import { PlayView } from './view.js';
import { STEPS } from './howto.js';

const ID = 'bubbles';
const ACCENT = '#4fa3e3';
/** So viele Level zeigt die Karte mindestens (es gibt beliebig viele). */
const MIN_WORLDS = 12;
const ENDLESS_SKY = ['#d9e6ff', '#efe9ff', '#fff3e8'];
const CONFETTI = ['#f0475e', '#ff9a2e', '#ffd23a', '#49c463', '#3d8ef0', '#9a62ee', '#ff7cc6'];

setupPage();
const app = document.getElementById('app');

// ---------- Speicher ----------

const K = { progress: `${ID}.progress`, level: `${ID}.level`, endless: `${ID}.endless`, stats: `${ID}.stats`, prefs: `${ID}.prefs` };

function progress() {
  const p = store.get(K.progress, null) || {};
  return { stars: p.stars || {}, best: p.best || {}, top: p.top | 0 };
}
function saveProgress(p) { store.set(K.progress, p); }
/** Höchstes freigeschaltetes Level */
function unlocked(p = progress()) { return p.top + 1; }
function totalStars(p = progress()) { return Object.values(p.stars).reduce((a, b) => a + (b | 0), 0); }

function prefs() { return { mode: 'levels', symbols: true, ...(store.get(K.prefs, null) || {}) }; }
function setPref(k, v) { const p = prefs(); p[k] = v; store.set(K.prefs, p); }

const STATS0 = { levelsWon: 0, played: 0, popped: 0, dropped: 0, freed: 0, bestCombo: 0, shots: 0, endlessBest: 0, endlessRounds: 0, threeStars: 0 };
function stats() { return { ...STATS0, ...(store.get(K.stats, null) || {}) }; }
function bumpStats(fn) { const s = stats(); fn(s); store.set(K.stats, s); return s; }

function loadGame(key) {
  try { return Game.fromJSON(store.get(key, null)); } catch { return null; }
}
function saveGame(g) { store.set(g.mode === 'endless' ? K.endless : K.level, g.toJSON()); }

const fmt = (n) => Math.round(n).toLocaleString('de-CH');

function summaryText() {
  const p = progress();
  const lv = currentLevelNo();
  const st = totalStars(p);
  return p.top ? `Level ${lv} · ${st} ★` : 'Level 1';
}
function report() { reportSummary(ID, summaryText()); }

/** Level, das «Weiterspielen» öffnet. */
function currentLevelNo() {
  const g = store.get(K.level, null);
  if (g && g.status === 'play' && g.levelNo && g.levelNo <= unlocked()) return g.levelNo;
  return unlocked();
}

// ---------- Routing ----------

let screen = null; // { destroy() }

function go(hash) {
  if (location.hash === hash || (!hash && !location.hash)) route();
  else location.hash = hash;
}

function route() {
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  if (screen) { screen.destroy(); screen = null; }
  document.querySelectorAll('.sp-modal-backdrop').forEach((n) => n.remove());
  if (name === 'level') {
    const n = Math.max(1, parseInt(arg, 10) || 1);
    if (n > unlocked()) { location.replace(`#level/${unlocked()}`); return; }
    screen = playScreen(levelGame(n));
  } else if (name === 'endless') {
    screen = playScreen(endlessGame());
  } else if (name === 'map') {
    screen = mapScreen();
  } else {
    screen = menuScreen();
  }
}
window.addEventListener('hashchange', route);

function levelGame(n, fresh = false) {
  const saved = fresh ? null : loadGame(K.level);
  if (saved && saved.mode === 'level' && saved.levelNo === n) return saved;
  const g = Game.newLevel(getLevel(n));
  saveGame(g);
  bumpStats((s) => { s.played++; });
  return g;
}

function endlessGame(fresh = false) {
  const saved = fresh ? null : loadGame(K.endless);
  if (saved && saved.mode === 'endless') return saved;
  const g = Game.newEndless((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  saveGame(g);
  return g;
}

function help() { return showTutorial({ id: ID, steps: STEPS, accent: ACCENT }); }

// ---------- Startbildschirm ----------

function menuScreen() {
  const p = progress();
  const pr = prefs();
  const st = stats();
  const lv = currentLevelNo();
  const endlessSaved = store.get(K.endless, null);
  const endlessRunning = endlessSaved && ((endlessSaved.status === 'play' && endlessSaved.shotsUsed > 0) || endlessSaved.status === 'lost');

  const primaryFor = (mode) => {
    if (mode === 'endless') {
      return endlessRunning
        ? { label: 'Weiterspielen', sub: `Entspannt · ${fmt(endlessSaved.score)} Punkte`, onClick: () => start('#endless') }
        : { label: 'Spielen', sub: 'Entspannt · ohne Schusslimit', onClick: () => start('#endless') };
    }
    const w = worldOfLevel(lv);
    return {
      label: p.top || store.get(K.level, null) ? 'Weiterspielen' : 'Spielen',
      sub: `Level ${lv} · ${w.name}`,
      onClick: () => start(`#level/${lv}`),
    };
  };

  async function start(hash) {
    await maybeShowTutorial({ id: ID, steps: STEPS, accent: ACCENT });
    go(hash);
  }

  const symToggle = h('button.bz-toggle' + (pr.symbols ? '.on' : ''), { type: 'button' },
    h('span', null, 'Symbole in den Blasen', h('small', null, 'Hilft, Farben sicher zu unterscheiden')),
    h('i.bz-switch'));
  symToggle.addEventListener('click', () => {
    const on = !prefs().symbols;
    setPref('symbols', on);
    symToggle.classList.toggle('on', on);
    sfx.play('click');
  });

  const menu = gameMenu({
    id: ID,
    title: 'Blasenzauber',
    tagline: 'Zielen, treffen, platzen lassen',
    accent: ACCENT,
    primary: primaryFor(pr.mode),
    modes: {
      label: 'Modus',
      value: pr.mode,
      options: [{ id: 'levels', label: 'Levels' }, { id: 'endless', label: 'Entspannt' }],
      onChange(id) { setPref('mode', id); menu.update({ primary: primaryFor(id) }); },
    },
    secondary: [
      { label: 'Levelkarte', icon: 'grid', onClick: () => go('#map') },
      { label: 'Statistik', icon: 'star', onClick: showStats },
    ],
    stats: [
      { label: 'Level', value: String(p.top) },
      { label: 'Sterne', value: String(totalStars(p)) },
      { label: 'Rekord', value: fmt(st.endlessBest) },
    ],
    sections: [
      menuSection(worldOfLevel(lv).name, worldStrip(lv, p)),
      menuSection('Einstellungen', symToggle),
    ],
    onHelp: help,
    backHref: '../',
  });
  app.className = 'app';
  app.replaceChildren(menu);
  report();
  return { destroy() {} };
}

/** Die 20 Level der aktuellen Welt als kleine Blasen. */
function worldStrip(lv, p) {
  const wi = Math.floor((lv - 1) / LEVELS_PER_WORLD);
  const w = worldInfo(wi);
  const box = h('div.bz-world-strip');
  setSky(box, w.sky);
  for (let i = 0; i < LEVELS_PER_WORLD; i++) box.append(levelButton(wi * LEVELS_PER_WORLD + i + 1, p, w));
  return box;
}

function setSky(el, sky) {
  el.style.setProperty('--sky1', sky[0]);
  el.style.setProperty('--sky2', sky[1]);
  el.style.setProperty('--sky3', sky[2]);
}

const STAR_SVG = (cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>`;

function levelButton(n, p, w) {
  const top = unlocked(p);
  const stars = p.stars[n] | 0;
  const locked = n > top;
  const cur = n === top;
  const cls = 'button.bz-lv' + (stars ? '.done' : '') + (locked ? '.locked' : '') + (cur ? '.cur' : '');
  const b = h(cls, { type: 'button', 'aria-label': `Level ${n}${locked ? ' (gesperrt)' : ''}` });
  const col = COLORS[w.colors[(n - 1) % 3]]?.base || ACCENT;
  b.style.setProperty('--wc', col);
  if (locked) b.innerHTML = icon('lock', { size: 18 });
  else {
    b.append(String(n));
    if (stars) b.append(h('span.bz-lv-stars', { html: [0, 1, 2].map((i) => STAR_SVG(i < stars ? '' : 'off')).join('') }));
  }
  b.addEventListener('click', () => {
    if (locked) { sfx.play('error'); b.classList.remove('sp-shake'); void b.offsetWidth; b.classList.add('sp-shake'); toast('Zuerst die Level davor schaffen'); return; }
    sfx.play('tap');
    go(`#level/${n}`);
  });
  return b;
}

// ---------- Levelkarte ----------

function mapScreen() {
  const p = progress();
  const top = unlocked(p);
  const curWorld = Math.floor((top - 1) / LEVELS_PER_WORLD);
  const worlds = Math.max(MIN_WORLDS, curWorld + 2);
  const inner = h('div.bz-map-inner');
  let curEl = null;
  for (let wi = 0; wi < worlds; wi++) {
    const w = worldInfo(wi);
    let st = 0;
    for (let i = 1; i <= LEVELS_PER_WORLD; i++) st += p.stars[wi * LEVELS_PER_WORLD + i] | 0;
    const grid = h('div.bz-grid');
    for (let i = 1; i <= LEVELS_PER_WORLD; i++) grid.append(levelButton(wi * LEVELS_PER_WORLD + i, p, w));
    const card = h('section.bz-world', null,
      h('div.bz-world-head', null,
        h('span.bz-world-pets', null, w.pets.join('')),
        h('b', null, w.name),
        h('small', { html: `${st}/${LEVELS_PER_WORLD * 3} ${STAR_SVG()}` })),
      grid);
    setSky(card, w.sky);
    if (wi === curWorld) curEl = card;
    inner.append(card);
  }
  inner.append(h('p.bz-more', null, 'Weitere Welten öffnen sich, je weiter du kommst.'));
  const root = h('div.bz-map', { style: { display: 'contents' } },
    h('header.topbar', null, backButton('#', (e) => go('')), h('div.title', null, 'Levelkarte'), soundButton()),
    h('div.scroll', null, inner));
  app.className = 'app';
  app.replaceChildren(root);
  if (curEl && curWorld > 0) requestAnimationFrame(() => curEl.scrollIntoView({ block: 'start' }));
  return { destroy() {} };
}

// ---------- Statistik ----------

function showStats() {
  const s = stats();
  const p = progress();
  const item = (v, l) => h('div', null, h('b', null, v), h('small', null, l));
  showModal({
    title: 'Statistik',
    content: h('div.bz-stats', null,
      item(String(s.levelsWon), 'Level geschafft'),
      item(String(totalStars(p)), 'Sterne'),
      item(String(s.threeStars), 'mit 3 Sternen'),
      item(fmt(s.endlessBest), 'Rekord Entspannt'),
      item(fmt(s.popped), 'Blasen geplatzt'),
      item(fmt(s.dropped), 'Blasen gefallen'),
      item(fmt(s.freed), 'Tierchen befreit'),
      item(String(s.bestCombo), 'Beste Kombo')),
    buttons: [{ label: 'Schliessen', value: true, primary: true }],
  });
}

// ---------- Spielansicht ----------

function playScreen(game) {
  const isLevel = game.mode === 'level';
  const def = isLevel ? getLevel(game.levelNo) : null;
  const world = isLevel ? worldOfLevel(game.levelNo) : null;
  const sky = isLevel ? world.sky : ENDLESS_SKY;
  let destroyed = false;
  let sheetOpen = false;

  // Topbar
  const titleEl = h('div.bz-title', null,
    h('b', null, isLevel ? `Level ${game.levelNo}` : 'Entspannt'),
    h('small', null, isLevel ? (def.handmade ? def.name : world.name) : 'Die Decke sinkt bei Fehlschüssen'));
  const hintBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Tipp', html: icon('hint') });
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  const top = h('header.topbar', null, backButton('#', () => go('')), titleEl, hintBtn, helpBtn, soundButton());

  // HUD
  const goalIc = h('span.bz-pill-ic');
  const goalTx = h('span');
  const goal = h('div.bz-pill', { 'aria-label': 'Ziel' }, goalIc, goalTx);
  const scoreNum = h('span', null, '0');
  const scoreEl = h('div.bz-score', null, scoreNum, h('small', null, isLevel ? 'Punkte' : `Rekord ${fmt(stats().endlessBest)}`));
  const restartBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Neu starten', html: icon('refresh') });
  const hud = h('div.bz-hud', null, goal, scoreEl, h('div.bz-hud-r', null, restartBtn));

  const stage = h('div.bz-stage');
  const root = h('div', { style: { display: 'contents' } }, top, hud, stage);
  app.className = 'app bz-play';
  setSky(app, sky);
  app.replaceChildren(root);

  let shownScore = game.score;
  let scoreRaf = 0;
  function setScore(target, instant = false) {
    cancelAnimationFrame(scoreRaf);
    if (instant) { shownScore = target; scoreNum.textContent = fmt(target); return; }
    const from = shownScore, t0 = performance.now(), dur = 600;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      shownScore = from + (target - from) * (1 - Math.pow(1 - k, 3));
      scoreNum.textContent = fmt(shownScore);
      if (k < 1) scoreRaf = requestAnimationFrame(step);
    };
    step();
  }

  let lastGoal = '';
  function updateHud(instant = false) {
    if (isLevel && game.goal === 'pets') {
      goalIc.textContent = game.pets[0] || '🐣';
      goalTx.replaceChildren(`${Math.min(game.petsFreed, game.petsTotal)}/${game.petsTotal}`);
      goal.setAttribute('aria-label', 'Tierchen befreit');
    } else if (isLevel) {
      goalIc.replaceChildren(h('i.bz-dot'));
      goalTx.replaceChildren(String(game.board.colorsPresent().length ? game.board.count() : 0));
      goal.setAttribute('aria-label', 'Blasen übrig');
    } else {
      goalIc.textContent = '☁️';
      goalTx.replaceChildren(`${game.rowsAdded}`, h('small', null, ' Reihen'));
      goal.setAttribute('aria-label', 'Neue Reihen');
    }
    const gtxt = goalTx.textContent;
    if (lastGoal && gtxt !== lastGoal && !instant) {
      goal.classList.remove('bump'); void goal.offsetWidth; goal.classList.add('bump');
      setTimeout(() => goal.classList.remove('bump'), 260);
    }
    lastGoal = gtxt;
    setScore(game.score, instant);
  }

  // Coach-Mark beim allerersten Level
  let coach = null;
  if (isLevel && game.levelNo === 1 && game.shotsUsed === 0) {
    coach = h('div.bz-coach', null, 'Ziehen zum Zielen – loslassen schiesst');
    stage.append(coach);
  }
  const dropCoach = () => { if (coach) { const c = coach; coach = null; c.classList.add('gone'); setTimeout(() => c.remove(), 350); } };

  const view = new PlayView(stage, game, {
    symbols: prefs().symbols,
    onShot(ev) {
      dropCoach();
      saveGame(game);
      const pops = ev.removed.filter((o) => o.how !== 'drop' && o.how !== 'finale').length;
      const drops = ev.removed.filter((o) => o.how === 'drop').length;
      bumpStats((s) => {
        s.shots++; s.popped += pops; s.dropped += drops; s.freed += ev.freed.length;
        s.bestCombo = Math.max(s.bestCombo, ev.combo || 0);
      });
      if (ev.status === 'won') recordWin();
      if (!isLevel) recordEndless();
    },
    onSettled() {
      if (destroyed) return;
      updateHud();
      saveGame(game);
      if (game.status === 'won') {
        hintBtn.disabled = true;
        view.startBonus(() => { setScore(game.score); showWin(); });
      } else if (game.status === 'lost') {
        showLose();
      }
    },
    onChange() { saveGame(game); },
  });
  updateHud(true);
  view.syncFromGame({ intro: true });

  if (game.status === 'won') setTimeout(() => !destroyed && showWin(), 400);
  else if (game.status === 'lost') setTimeout(() => !destroyed && showLose(), 400);
  else if (coach) setTimeout(() => { if (!destroyed && coach && view.canShoot()) view.showHint(bestMove(game)); }, 1400);
  if (!isLevel || game.levelNo === 1) maybeShowTutorial({ id: ID, steps: STEPS, accent: ACCENT });

  // ----- Knöpfe -----
  hintBtn.addEventListener('click', () => {
    if (!view.canShoot()) return;
    sfx.play('sparkle');
    const m = bestMove(game, { step: 1, useSpecials: true });
    if (m) view.showHint(m);
  });
  helpBtn.addEventListener('click', () => { sfx.play('click'); help(); });
  restartBtn.addEventListener('click', async () => {
    sfx.play('click');
    if (game.shotsUsed > 0 && game.status === 'play') {
      const ok = await confirmDialog(isLevel ? 'Level neu starten?' : 'Neue Runde?', isLevel ? 'Der aktuelle Versuch geht verloren.' : 'Die aktuelle Runde wird beendet.', 'Neu starten');
      if (!ok) return;
    }
    restart();
  });

  function restart() {
    if (isLevel) {
      const g = levelGame(game.levelNo, true);
      screen.destroy();
      screen = playScreen(g);
    } else {
      const g = endlessGame(true);
      screen.destroy();
      screen = playScreen(g);
    }
  }

  // ----- Ergebnis speichern -----
  let winRecorded = false;
  let earnedStars = 0;
  let newBest = false;
  function recordWin() {
    if (winRecorded) return;
    winRecorded = true;
    earnedStars = game.starsEarned();
    const p = progress();
    const n = game.levelNo;
    const before = p.stars[n] | 0;
    newBest = game.score > (p.best[n] | 0) && before > 0;
    p.stars[n] = Math.max(before, earnedStars);
    p.best[n] = Math.max(p.best[n] | 0, game.score);
    p.top = Math.max(p.top, n);
    saveProgress(p);
    bumpStats((s) => {
      s.levelsWon++;
      if (earnedStars === 3 && before < 3) s.threeStars++;
    });
    report();
  }
  function recordEndless() {
    const s = stats();
    if (game.score > s.endlessBest) {
      bumpStats((x) => { x.endlessBest = game.score; });
    }
  }

  // ----- Blätter -----
  async function showWin() {
    if (sheetOpen || destroyed) return;
    sheetOpen = true;
    if (!winRecorded) { recordWin(); }
    const stars = game.starsEarned() || earnedStars;
    sfx.play('complete');
    celebrate(CONFETTI);
    const p = progress();
    const content = h('div.bz-sheet', null,
      h('div.bz-stars', { html: [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">${STAR_SVG()}</span>`).join('') }),
      h('div.bz-result', null,
        h('div', null, h('b', null, fmt(game.score)), h('small', null, 'Punkte')),
        h('div', null, h('b', null, fmt(p.best[game.levelNo] || game.score)), h('small', null, 'Bestwert'))),
      game.petsTotal ? h('p', null, `${game.petsTotal} Tierchen befreit ${game.pets.slice(0, 3).join('')}`) : null,
      newBest ? h('span.bz-new', null, 'Neuer Bestwert!') : null);
    const next = game.levelNo + 1;
    const v = await showModal({
      title: ['Geschafft!', 'Wunderbar!', 'Perfekt!'][Math.max(0, stars - 1)],
      content,
      dismissible: false,
      buttons: [
        { label: `Weiter zu Level ${next}`, value: 'next', primary: true, icon: 'play' },
        { label: 'Nochmals spielen', value: 'again', icon: 'refresh' },
        { label: 'Levelkarte', value: 'map', ghost: true },
      ],
    });
    sheetOpen = false;
    if (destroyed) return;
    if (v === 'next') go(`#level/${next}`);
    else if (v === 'again') restart();
    else go('#map');
  }

  async function showLose() {
    if (sheetOpen || destroyed) return;
    sheetOpen = true;
    sfx.play('thud');
    let v;
    if (!isLevel) {
      const best = stats().endlessBest;
      bumpStats((s) => { s.endlessRounds++; });
      v = await showModal({
        title: 'Runde vorbei',
        content: h('div.bz-sheet', null,
          h('div.bz-emoji', null, '☁️'),
          h('div.bz-result', null,
            h('div', null, h('b', null, fmt(game.score)), h('small', null, 'Punkte')),
            h('div', null, h('b', null, fmt(best)), h('small', null, 'Rekord'))),
          game.score >= best && game.score > 0 ? h('span.bz-new', null, 'Neuer Rekord!') : null),
        dismissible: false,
        buttons: [
          { label: 'Weiterspielen', value: 'rescue', primary: true, icon: 'sparkle' },
          { label: 'Neue Runde', value: 'again', icon: 'refresh' },
          { label: 'Zum Menü', value: 'menu', ghost: true },
        ],
      });
    } else if (game.lostReason === 'shots') {
      v = await showModal({
        title: 'Keine Schüsse mehr',
        content: h('div.bz-sheet', null, h('div.bz-emoji', null, '🫧'),
          h('p', null, game.goal === 'pets' ? `Noch ${game.petsTotal - game.petsFreed} Tierchen warten. Mit 5 Extraschüssen geht es weiter.` : 'Fast geschafft! Mit 5 Extraschüssen geht es weiter.')),
        dismissible: false,
        buttons: [
          { label: '+5 Schüsse', value: 'more', primary: true, icon: 'plus' },
          { label: 'Neu starten', value: 'again', icon: 'refresh' },
          { label: 'Zum Menü', value: 'menu', ghost: true },
        ],
      });
    } else {
      v = await showModal({
        title: 'Die Blasen sind zu tief',
        content: h('div.bz-sheet', null, h('div.bz-emoji', null, '🫧'),
          h('p', null, 'Ein Zauberwind lässt die untersten Reihen platzen – dann geht es weiter.')),
        dismissible: false,
        buttons: [
          { label: 'Weiterspielen', value: 'rescue', primary: true, icon: 'sparkle' },
          { label: 'Neu starten', value: 'again', icon: 'refresh' },
          { label: 'Zum Menü', value: 'menu', ghost: true },
        ],
      });
    }
    sheetOpen = false;
    if (destroyed) return;
    if (v === 'more') {
      game.continueWithShots();
      saveGame(game);
      view.syncFromGame();
      updateHud();
      sfx.play('sparkle');
    } else if (v === 'rescue') {
      const ev = game.rescue();
      saveGame(game);
      sfx.play('whoosh');
      if (ev) view.animateExternal(ev);
      updateHud();
    } else if (v === 'again') restart();
    else go('');
  }

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(scoreRaf);
      saveGame(game);
      view.destroy();
    },
  };
}

// Beim Verlassen/Verstecken nichts verlieren (der Zustand wird nach jedem Schuss gespeichert).
document.addEventListener('visibilitychange', () => { if (document.hidden) report(); });

route();
