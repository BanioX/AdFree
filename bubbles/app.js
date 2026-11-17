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
import { worldInfo, WORLDS } from './data/worlds.js';
import { COLORS } from './data/colors.js';
import { LEVELS } from './data/levels.js';
import { PlayView } from './view.js';
import { STEPS } from './howto.js';
import { drawPreview } from './art.js';

const ID = 'bubbles';
const ACCENT = '#4fa3e3';
/** So viele Level zeigt die Karte mindestens (es gibt beliebig viele). */
const MIN_WORLDS = 12;
const ENDLESS_SKY = ['#d9e6ff', '#efe9ff', '#fff3e8'];
const CONFETTI = ['#f0475e', '#ff9a2e', '#ffd23a', '#49c463', '#3d8ef0', '#9a62ee', '#ff7cc6'];

setupPage();
const app = document.getElementById('app');

// ---------- Speicher ----------

const K = { progress: `${ID}.progress`, level: `${ID}.level`, endless: `${ID}.endless`, stats: `${ID}.stats`, prefs: `${ID}.prefs`, album: `${ID}.album` };
const WORLD_COUNT = WORLDS.length;

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

/** Befreite Tierchen: { emoji: Anzahl } */
function album() { return store.get(K.album, null) || {}; }
function addToAlbum(emojis) {
  if (!emojis.length) return;
  const a = album();
  for (const e of emojis) a[e] = (a[e] | 0) + 1;
  store.set(K.album, a);
}

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

/** Name des Levels für Anzeigen (handgezeichnet: eigener Name, sonst Welt). */
function levelName(n) {
  return n <= LEVELS.length ? LEVELS[n - 1].name : worldOfLevel(n).name;
}

function menuScreen() {
  const p = progress();
  const pr = prefs();
  const st = stats();
  const lv = currentLevelNo();
  const savedLevel = loadGame(K.level);
  const levelRunning = savedLevel && savedLevel.mode === 'level' && savedLevel.levelNo === lv && savedLevel.status === 'play' && savedLevel.shotsUsed > 0;
  const endlessSaved = loadGame(K.endless);
  const endlessRunning = endlessSaved && endlessSaved.mode === 'endless' && ((endlessSaved.status === 'play' && endlessSaved.shotsUsed > 0) || endlessSaved.status === 'lost');
  const fresh = !p.top && !st.shots;

  // Titelbild: Live-Vorschau des Spielfelds, das «Spielen» öffnet
  const artCanvas = h('canvas.bz-hero-canvas', { 'aria-hidden': 'true' });
  const art = h('div.bz-hero-art', null, artCanvas, h('span.bz-hero-badge'));
  let artMode = null;
  function paintArt(mode) {
    if (artMode === mode) return;
    artMode = mode;
    const badge = art.lastChild;
    if (mode === 'endless') {
      badge.textContent = '∞';
      drawPreview(artCanvas, endlessSaved && endlessSaved.status === 'play' ? endlessSaved : Game.newEndless(7), ENDLESS_SKY);
    } else {
      badge.textContent = String(lv);
      const sky = worldOfLevel(lv).sky;
      if (savedLevel && savedLevel.mode === 'level' && savedLevel.levelNo === lv && savedLevel.status === 'play') drawPreview(artCanvas, savedLevel, sky);
      else {
        drawPreview(artCanvas, null, sky);
        // Level erzeugen kostet ein paar Millisekunden – erst nach dem ersten Bild
        setTimeout(() => { if (artMode === 'levels' && art.isConnected) drawPreview(artCanvas, Game.newLevel(getLevel(lv)), sky); }, 30);
      }
    }
  }

  const primaryFor = (mode) => {
    if (mode === 'endless') {
      return endlessRunning
        ? { label: 'Weiterspielen', sub: `Entspannt · ${fmt(endlessSaved.score)} Punkte`, onClick: () => start('#endless') }
        : { label: 'Spielen', sub: st.endlessBest ? `Entspannt · Rekord ${fmt(st.endlessBest)}` : 'Entspannt · ohne Schusslimit', onClick: () => start('#endless') };
    }
    let sub = `Level ${lv} · ${levelName(lv)}`;
    if (levelRunning) sub += ` · ${savedLevel.shotsLeft} Schüsse`;
    return {
      label: fresh ? 'Spielen' : 'Weiterspielen',
      sub,
      onClick: () => start(`#level/${lv}`),
    };
  };

  async function start(hash) {
    await maybeShowTutorial({ id: ID, steps: STEPS, accent: ACCENT });
    go(hash);
  }

  const symToggle = h('button.bz-toggle' + (pr.symbols ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': String(pr.symbols) },
    h('span', null, 'Symbole in den Blasen', h('small', null, 'Hilft, Farben sicher zu unterscheiden')),
    h('i.bz-switch'));
  symToggle.addEventListener('click', () => {
    const on = !prefs().symbols;
    setPref('symbols', on);
    symToggle.classList.toggle('on', on);
    symToggle.setAttribute('aria-checked', String(on));
  });

  const levelSection = () => {
    const first = Math.floor((lv - 1) / 10) * 10 + 1;
    return menuSection(`${worldOfLevel(lv).name} · Level ${first}–${first + 9}`, worldStrip(lv, p));
  };

  const menu = gameMenu({
    id: ID,
    title: 'Blasenzauber',
    tagline: 'Zielen, treffen, platzen lassen',
    accent: ACCENT,
    art,
    primary: primaryFor(pr.mode),
    modes: {
      label: 'Spielart',
      value: pr.mode,
      options: [{ id: 'levels', label: 'Levels', sub: 'mit Sternen' }, { id: 'endless', label: 'Entspannt', sub: 'ohne Limit' }],
      onChange(id) { setPref('mode', id); paintArt(id); menu.update({ primary: primaryFor(id) }); },
    },
    secondary: [
      { label: 'Levelkarte', icon: 'grid', sub: fresh ? `${WORLD_COUNT} Welten` : `${totalStars(p)} von ${unlocked(p) * 3} ★`, onClick: () => go('#map') },
      { label: 'Statistik', icon: 'star', sub: st.bestCombo ? `Kombo-Rekord ×${st.bestCombo}` : 'Deine Erfolge', onClick: showStats },
    ],
    // Beim allerersten Start keine Nullen zeigen
    stats: fresh ? null : [
      { label: 'Geschafft', value: String(p.top) },
      { label: 'Sterne', value: String(totalStars(p)) },
      { label: 'Tierchen', value: fmt(st.freed) },
      { label: 'Rekord', value: fmt(st.endlessBest) },
    ],
    sections: [
      levelSection(),
      albumSection(),
      menuSection('Einstellungen', symToggle),
    ],
    onHelp: help,
    backHref: '../',
  });
  paintArt(pr.mode);
  app.className = 'app';
  app.replaceChildren(menu);
  report();
  return { destroy() {} };
}

// ---------- Tierchen-Album ----------

/** Alle verschiedenen Tierchen der Welten 0..n-1 in Reihenfolge des Auftauchens. */
function albumPets(worlds) {
  const seen = new Set();
  const out = [];
  for (let wi = 0; wi < worlds; wi++) {
    for (const pet of worldInfo(wi).pets) if (!seen.has(pet)) { seen.add(pet); out.push({ pet, world: wi }); }
  }
  return out;
}
const ALL_PETS = () => albumPets(WORLD_COUNT).length;

function albumSection() {
  const al = album();
  const reached = Math.floor((unlocked() - 1) / LEVELS_PER_WORLD) + 1;
  const list = albumPets(Math.min(WORLD_COUNT, reached + 1));
  const found = Object.keys(al).length;
  const grid = h('div.bz-album-grid');
  for (const { pet, world } of list) {
    const n = al[pet] | 0;
    const cell = h('div.bz-pet' + (n ? '.got' : ''), { title: n ? `${n}× befreit` : 'Noch nicht befreit' },
      h('span', null, pet), n > 1 ? h('small', null, `×${n}`) : null);
    if (n) cell.style.setProperty('--wc', COLORS[worldInfo(world).colors[0]].base);
    grid.append(cell);
  }
  const note = found
    ? `${found} von ${ALL_PETS()} Tierchen befreit`
    : 'Befreie Tierchen aus den Blasen – das erste wartet in Level 4.';
  return menuSection('Tierchen-Album', h('div.bz-album', null, grid, h('p.bz-album-note', null, note)));
}

/** Zehn Level rund um das aktuelle Level als Blasen (Rest auf der Levelkarte). */
function worldStrip(lv, p) {
  const first = Math.floor((lv - 1) / 10) * 10 + 1;
  const w = worldOfLevel(first);
  const grid = h('div.bz-grid');
  for (let n = first; n < first + 10; n++) grid.append(levelButton(n, p, w));
  const box = h('div.bz-world-strip', null, grid);
  setSky(box, w.sky);
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
    if (locked) { b.classList.remove('sp-shake'); void b.offsetWidth; b.classList.add('sp-shake'); toast('Zuerst die Level davor schaffen'); return; }
    // Beim allerersten Mal zuerst die kurze Anleitung, dann das Level
    maybeShowTutorial({ id: ID, steps: STEPS, accent: ACCENT }).then(() => go(`#level/${n}`));
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
    h('small', null, isLevel ? (def.handmade ? def.name : world.name) : 'Ohne Schusslimit'));
  const hintBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Tipp', html: icon('hint') });
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  const top = h('header.topbar', null, backButton('#', () => go('')), titleEl, hintBtn, helpBtn, soundButton());

  // HUD
  const goalIc = h('span.bz-pill-ic');
  const goalTx = h('span');
  const goal = h('div.bz-pill', { 'aria-label': 'Ziel' }, goalIc, goalTx);
  const scoreNum = h('span', null, '0');
  const scoreSub = h('small', null, 'Punkte');
  const scoreEl = h('div.bz-score', null, scoreNum, scoreSub);
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
      goalTx.replaceChildren(String(game.board.colorCounts().reduce((a, b) => a + b, 0)));
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
    if (!isLevel) scoreSub.textContent = `Rekord ${fmt(Math.max(stats().endlessBest, game.score))}`;
  }

  // Coach-Mark beim allerersten Level: Zielhilfe, pulsierender Ring am Ziel, wischender Finger
  const wantCoach = isLevel && game.levelNo === 1 && game.shotsUsed === 0 && game.status === 'play';

  const view = new PlayView(stage, game, {
    symbols: prefs().symbols,
    onShot(ev) {
      saveGame(game);
      if (ev.freed.length) addToAlbum(ev.freed.map((f) => game.pets[f.pet - 1] || '🐣'));
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
  else if (wantCoach) setTimeout(() => { if (!destroyed && game.shotsUsed === 0 && view.canShoot() && !view.pointer) view.setCoach(bestMove(game)); }, 1300);
  maybeShowTutorial({ id: ID, steps: STEPS, accent: ACCENT });

  // ----- Knöpfe -----
  hintBtn.addEventListener('click', () => {
    if (!view.canShoot()) return;
    sfx.play('sparkle');
    const m = bestMove(game, { step: 1, useSpecials: true });
    if (m) view.showHint(m);
  });
  helpBtn.addEventListener('click', () => help());
  restartBtn.addEventListener('click', async () => {
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
  let winRecorded = game.status === 'won'; // nach Neuladen nicht doppelt zählen
  let earnedStars = game.starsEarned();
  let lossCounted = game.status === 'lost';
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
      game.petsTotal ? h('p.bz-freed', null, `${game.petsTotal} Tierchen befreit `, h('span', null, game.pets.slice(0, 3).join(''))) : null,
      newBest ? h('span.bz-new', null, 'Neuer Bestwert!') : null);
    const next = game.levelNo + 1;
    if ((next - 1) % LEVELS_PER_WORLD === 0) {
      const nw = worldOfLevel(next);
      content.append(h('div.bz-newworld', null,
        h('span.bz-newworld-pets', null, nw.pets.join('')),
        h('span', null, h('small', null, 'Neue Welt entdeckt'), h('b', null, nw.name))));
    }
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
      const best = Math.max(stats().endlessBest, game.score);
      if (!lossCounted) bumpStats((s) => { s.endlessRounds++; });
      lossCounted = true;
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
      lossCounted = false;
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
