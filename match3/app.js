// Juwelen – App: Startbildschirm, Levelkarte, Spiel (Level & Entspannt), Statistik.
//
// Routen:  (leer) Menü · #karte Levelkarte · #level/N Level N · #zen Entspannt-Modus

import { store, reportSummary } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, celebrate, setupPage, soundButton, backButton } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, tutorialSeen, markTutorialSeen } from '../shared/tutorial.js';
import { Game, zenLevel } from './engine.js';
import { getLevel, setLevelStore, worldIndex, worldInfo, PER_WORLD, MIN_LEVELS, features } from './levels.js';
import { BoardView } from './board.js';
import { spriteURL, iceURL, GEM_COLORS } from './sprites.js';
import { gemNames, winTitles, loseTitles, loseTitlesMid, loseTitlesFar, firstTips, zenMilestones } from './data/texts.js';
import { tutorialSteps } from './howto.js';

const ID = 'match3';
const ACCENT = '#d0447c';
const CONFETTI = GEM_COLORS.map((c) => c[1]).concat('#ffffff');
const K = {
  prog: `${ID}.progress`, run: `${ID}.run`, zen: `${ID}.zen`, stats: `${ID}.stats`,
  settings: `${ID}.settings`, tips: `${ID}.tips`,
};

setupPage();
document.documentElement.style.setProperty('--accent', ACCENT);
const app = document.getElementById('app');
setLevelStore({
  get: (k) => store.get(`${ID}.lv.${k}`, null),
  set: (k, v) => store.set(`${ID}.lv.${k}`, v),
});

// ---------- Daten ----------

const getProg = () => {
  const p = store.get(K.prog, null);
  return p && typeof p.max === 'number' ? p : { max: 1, stars: {}, best: {} };
};
const setProg = (p) => store.set(K.prog, p);
const getStats = () => ({ played: 0, won: 0, gems: 0, specials: 0, combo: 0, zenBest: 0, ...(store.get(K.stats, {}) || {}) });
const setStats = (s) => store.set(K.stats, s);
const getSettings = () => ({ mode: 'levels', ...(store.get(K.settings, {}) || {}) });
const setSettings = (u) => store.set(K.settings, { ...getSettings(), ...u });

function totalStars(p = getProg()) { return Object.values(p.stars).reduce((a, b) => a + b, 0); }
function threeStars(p = getProg()) { return Object.values(p.stars).filter((s) => s >= 3).length; }
function levelsShown(p = getProg()) { return Math.ceil(Math.max(MIN_LEVELS, p.max + 5) / PER_WORLD) * PER_WORLD; }
function currentLevel() {
  const run = store.get(K.run, null);
  if (run && run.n && !run.won) return run.n;
  return getProg().max;
}

function summary() {
  const p = getProg();
  const st = totalStars(p);
  return `Level ${p.max}${st ? ` · ${st} ★` : ''}`;
}

// ---------- Routing ----------

let teardown = null;
function go(hash) {
  history.replaceState(null, '', location.pathname + location.search + (hash ? '#' + hash : ''));
  route();
}
function route() {
  if (teardown) { try { teardown(); } catch { /* egal */ } teardown = null; }
  document.querySelectorAll('.sp-modal-backdrop').forEach((m) => m.remove());
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  // Ein gewonnenes Level bleibt nur gespeichert, solange sein Gewinn-Blatt offen ist.
  const run = store.get(K.run, null);
  if (run && run.won && !(name === 'level' && Math.floor(+arg) === run.n)) store.remove(K.run);
  if (name === 'level' && +arg >= 1) {
    const n = Math.floor(+arg);
    if (n > getProg().max) return go('karte');
    return playLevel(n);
  }
  if (name === 'zen') return playZen();
  if (name === 'karte') return showMap();
  return showMenu();
}
window.addEventListener('hashchange', route);

let tutorialOpen = null;
function showHowTo() {
  if (tutorialOpen) return tutorialOpen;
  tutorialOpen = showTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT }).finally(() => { tutorialOpen = null; });
  return tutorialOpen;
}
async function ensureTutorial() {
  if (tutorialSeen(ID)) return;
  await showHowTo();
  markTutorialSeen(ID);
}

function helpBtn(onClick = showHowTo) {
  const b = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  b.addEventListener('click', () => { sfx.play('click'); onClick(); });
  return b;
}

// ---------- Menü ----------

function heroArt() {
  const row = h('div.m3-hero');
  [0, 1, 2, 3, 4, 5].forEach((c, k) => row.append(h('img', {
    src: spriteURL(String(c), 96), alt: '', draggable: 'false',
    style: css({ animationDelay: k * 0.12 + 's', '--rot': ((k - 2.5) * 7) + 'deg', '--lift': (Math.abs(k - 2.5) * 7) + 'px' }),
  })));
  return row;
}

function primaryFor(mode) {
  if (mode === 'zen') {
    const z = store.get(K.zen, null);
    const best = getStats().zenBest;
    return {
      label: z ? 'Weiterspielen' : 'Spielen', icon: 'play',
      sub: `Entspannt · ohne Zuglimit${best ? ` · Rekord ${fmt(best)}` : ''}`,
      onClick: () => start(() => go('zen')),
    };
  }
  const n = currentLevel();
  const p = getProg();
  return {
    label: p.max > 1 || store.get(K.run, null) ? 'Weiterspielen' : 'Spielen', icon: 'play',
    sub: `Level ${n} · ${worldInfo(worldIndex(n)).title}`,
    onClick: () => start(() => go(`level/${n}`)),
  };
}

async function start(fn) {
  await ensureTutorial();
  fn();
}

function worldCard() {
  const p = getProg();
  const n = Math.min(p.max, levelsShown(p));
  const w = worldInfo(worldIndex(n));
  let done = 0, stars = 0;
  for (let k = w.first; k <= w.last; k++) { if (p.stars[k]) { done++; stars += p.stars[k]; } }
  const card = h('button.m3-worldcard', { type: 'button', style: css({ '--wacc': w.accent, background: `linear-gradient(135deg, ${w.sky[0]}, ${w.sky[1]})` }) },
    h('span.m3-wc-emoji', null, w.emoji),
    h('span.m3-wc-text', null,
      h('b', null, w.title),
      h('small', null, `Level ${w.first}–${w.last} · ${stars} von ${PER_WORLD * 3} ★`),
      h('span.m3-wc-bar', null, h('i', { style: { width: (done / PER_WORLD) * 100 + '%' } }))),
    h('span.m3-wc-go', { html: icon('back', { size: 18 }) }));
  card.addEventListener('click', () => { sfx.play('click'); go('karte'); });
  return card;
}

function menuStats() {
  const p = getProg(), s = getStats();
  return [
    { label: 'Geschafft', value: Object.keys(p.stars).length },
    { label: 'Sterne', value: totalStars(p) },
    { label: '3 Sterne', value: threeStars(p) },
    { label: 'Beste Kette', value: s.combo ? `${s.combo}×` : '–' },
  ];
}

function showMenu() {
  reportSummary(ID, summary());
  const set = getSettings();
  const menu = gameMenu({
    id: ID,
    title: 'Juwelen',
    tagline: 'Drei gleiche in einer Reihe',
    accent: ACCENT,
    art: heroArt(),
    primary: primaryFor(set.mode),
    modes: {
      label: 'Modus', value: set.mode,
      options: [{ id: 'levels', label: 'Abenteuer', sub: `${levelsShown()}+ Level` }, { id: 'zen', label: 'Entspannt', sub: 'ohne Zuglimit' }],
      onChange(id) { setSettings({ mode: id }); menu.update({ primary: primaryFor(id) }); },
    },
    secondary: [
      { label: 'Levelkarte', icon: 'grid', onClick: () => go('karte') },
      { label: 'Statistik', icon: 'star', onClick: showStatsSheet },
    ],
    stats: menuStats(),
    sections: [menuSection('Deine Welt', worldCard())],
    onHelp: showHowTo,
    backHref: '../',
  });
  menu.classList.add('m3-menu');
  app.replaceChildren(menu);
  // erstes Level im Hintergrund vorbereiten (Kalibrierung wird zwischengespeichert)
  const t = setTimeout(() => { try { getLevel(currentLevel()); } catch { /* egal */ } }, 600);
  teardown = () => clearTimeout(t);
  if (!tutorialSeen(ID)) setTimeout(() => { if (!tutorialSeen(ID) && !location.hash) ensureTutorial(); }, 350);
}

function showStatsSheet() {
  const p = getProg(), s = getStats();
  const rows = [
    ['Level geschafft', Object.keys(p.stars).length],
    ['Sterne gesamt', totalStars(p)],
    ['Level mit 3 Sternen', threeStars(p)],
    ['Gespielte Runden', s.played],
    ['Juwelen gesammelt', fmt(s.gems)],
    ['Sonderjuwelen gebaut', fmt(s.specials)],
    ['Längste Kettenreaktion', s.combo ? `${s.combo}×` : '–'],
    ['Rekord «Entspannt»', s.zenBest ? fmt(s.zenBest) : '–'],
  ];
  const table = h('div.m3-statlist', null, ...rows.map(([k, v]) => h('div', null, h('span', null, k), h('b', null, String(v)))));
  showModal({ title: 'Statistik', content: table, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

const fmt = (n) => Math.round(n).toLocaleString('de-CH');
/** Style-Objekt → CSS-Text (h() übernimmt CSS-Variablen wie --wacc sonst nicht). */
function css(o) {
  return Object.entries(o).map(([k, v]) => `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
}

// ---------- Levelkarte ----------

function showMap() {
  reportSummary(ID, summary());
  const p = getProg();
  const total = levelsShown(p);
  const scroll = h('div.scroll.m3-mapscroll');
  const STEP = 78;
  let currentNode = null;
  for (let k = 0; k * PER_WORLD < total; k++) {
    const w = worldInfo(k);
    let stars = 0;
    for (let n = w.first; n <= w.last; n++) stars += p.stars[n] || 0;
    const H = PER_WORLD * STEP + 30;
    const path = h('div.m3-path', { style: { height: H + 'px' } });
    const pts = [];
    for (let j = 0; j < PER_WORLD; j++) {
      const n = w.first + j;
      const x = 50 + 30 * Math.sin(j * 0.85 + k * 1.3);
      const y = 36 + j * STEP;
      pts.push([x, y]);
      const st = p.stars[n] || 0;
      const state = n < p.max || st ? 'done' : n === p.max ? 'cur' : 'locked';
      const node = h(`button.m3-node.${state}`, { type: 'button', style: { left: x + '%', top: y + 'px' }, 'aria-label': `Level ${n}`, 'data-n': n },
        h('span.m3-node-n', null, state === 'locked' ? '' : String(n)),
        state === 'locked' ? h('span.m3-node-lock', { html: icon('lock', { size: 18 }) }) : null,
        state === 'done' ? h('span.m3-node-stars', null, ...[1, 2, 3].map((q) => h('i' + (q <= st ? '.on' : ''), null, '★'))) : null);
      node.addEventListener('click', () => {
        if (state === 'locked') { sfx.play('error'); toast(`Schaffe zuerst Level ${p.max}`); return; }
        sfx.play('tap');
        start(() => go(`level/${n}`));
      });
      if (state === 'cur') currentNode = node;
      path.append(node);
      if (j % 3 === 1) {
        path.append(h('span.m3-deco', { style: { left: (x > 50 ? 12 : 88) + '%', top: y + 'px' } }, w.deco[(j + k) % w.deco.length]));
      }
    }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let j = 1; j < pts.length; j++) {
      const [x0, y0] = pts[j - 1], [x1, y1] = pts[j];
      d += ` C${x0} ${y0 + STEP / 2} ${x1} ${y1 - STEP / 2} ${x1} ${y1}`;
    }
    path.prepend(h('span.m3-pathsvg', {
      html: `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" width="100%" height="${H}"><path d="${d}" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="16" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="${w.accent}" stroke-opacity=".45" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`,
    }));
    scroll.append(h('section.m3-world', { style: css({ '--wacc': w.accent, background: `linear-gradient(180deg, ${w.sky[0]}, ${w.sky[1]})` }) },
      h('header.m3-world-head', null, h('span.m3-world-emoji', null, w.emoji),
        h('span', null, h('b', null, w.title), h('small', null, `Level ${w.first}–${w.last}`)),
        h('span.m3-world-stars', null, `★ ${stars}/${PER_WORLD * 3}`)),
      path));
  }
  scroll.append(h('p.m3-map-foot', null, 'Weitere Welten erscheinen, sobald du weiterkommst – die Level gehen endlos weiter.'));
  const bar = h('div.topbar', null, backButton('#', () => { sfx.play('click'); go(''); }), h('div.title', null, 'Levelkarte'), soundButton());
  app.replaceChildren(h('div.screen.m3-map', null, bar, scroll));
  if (currentNode) requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, currentNode.offsetTop + currentNode.closest('.m3-world').offsetTop - scroll.clientHeight / 2); });
}

// ---------- Spielbildschirm ----------

function goalIcon(g) {
  if (g.type === 'color') return spriteURL(String(g.color), 64);
  if (g.type === 'ice') return iceURL(64);
  if (g.type === 'stone') return spriteURL('stone', 64);
  if (g.type === 'item') return spriteURL('acorn', 64);
  return null;
}
function goalLabel(g, n) {
  if (g.type === 'color') return `${n} ${n === 1 ? gemNames[g.color].one : gemNames[g.color].many}`;
  if (g.type === 'ice') return 'alles Eis schmelzen';
  if (g.type === 'stone') return 'alle Steine zerbrechen';
  if (g.type === 'item') return `${n} ${n === 1 ? 'Eichel' : 'Eicheln'} nach unten bringen`;
  return `${fmt(n)} Punkte`;
}

/** Gemeinsamer Aufbau für Level und Entspannt-Modus. */
function playScreen({ title, sub, theme, zen }) {
  const back = backButton('#', () => { sfx.play('click'); go(''); });
  const bar = h('div.topbar.m3-bar', null, back,
    h('div.title.m3-title', null, h('span', null, title), sub ? h('small', null, sub) : null),
    helpBtn(), soundButton());
  const movesEl = h('b.m3-moves-n', null, '0');
  const movesBox = h('div.m3-moves' + (zen ? '.zen' : ''), null, movesEl, h('small', null, zen ? 'Punkte' : 'Züge'));
  const goalsEl = h('div.m3-goals');
  const scoreEl = h('b', null, '0');
  const fill = h('i.m3-fill');
  const starMarks = [h('span.m3-star', null, '★'), h('span.m3-star', null, '★'), h('span.m3-star', null, '★')];
  const scoreBox = h('div.m3-score', null, h('div.m3-score-top', null, h('small', null, zen ? 'Nächstes Ziel' : 'Punkte'), scoreEl),
    h('div.m3-bar-track', null, fill, ...starMarks));
  const hud = h('div.m3-hud', null, movesBox, h('div.m3-hud-mid', null, goalsEl, scoreBox));
  const wrap = h('div.m3-boardwrap');
  const tool = (emoji, label) => {
    const badge = h('span.m3-badge');
    const b = h('button.m3-tool', { type: 'button', 'aria-label': label }, h('span.m3-tool-ic', null, emoji), h('small', null, label), badge);
    b.badge = badge;
    return b;
  };
  const tHammer = tool('🔨', 'Hammer'), tShuffle = tool('🔀', 'Mischen'), tHint = tool('💡', 'Tipp');
  const tools = h('div.m3-tools', null, tHammer, tShuffle, tHint);
  const banner = h('div.m3-hammerbar', null, 'Tippe auf ein Juwel oder einen Stein');
  const el = h('div.screen.m3-play', { style: css({ '--sky1': theme.sky[0], '--sky2': theme.sky[1], '--wacc': theme.accent }) },
    bar, hud, wrap, banner, tools);
  app.replaceChildren(el);
  return { el, wrap, movesEl, movesBox, goalsEl, scoreEl, fill, starMarks, tHammer, tShuffle, tHint, banner, back };
}

let session = 0;

function playLevel(n) {
  const my = ++session;
  const prog = getProg();
  let L;
  try { L = getLevel(n); } catch (e) { console.warn(e); toast('Level konnte nicht geladen werden'); return go(''); }
  const w = worldInfo(worldIndex(n));
  const run = store.get(K.run, null);
  let game = null;
  let fresh = false;
  if (run && run.n === n && run.s) {
    try { game = new Game(L, run.s); } catch { game = null; }
  }
  if (!game) {
    game = new Game(L);
    fresh = true;
    store.set(K.run, { n, s: game.save() });
    const st = getStats(); st.played++; setStats(st);
  }
  reportSummary(ID, `Level ${n} · ${w.title}`);
  const ui = playScreen({ title: `Level ${n}`, sub: w.title, theme: w });

  // Ziele
  const goalEls = L.goals.map((g) => {
    const src = goalIcon(g);
    const num = h('b');
    const chip = h('div.m3-goal' + (g.type === 'score' ? '.score' : ''), { title: goalLabel(g, g.n || 0) },
      src ? h('img', { src, alt: '' }) : h('span.m3-goal-t', null, '🎯'), num);
    ui.goalsEl.append(chip);
    return { chip, num, g, last: null };
  });
  const s3 = Math.max(1, L.stars[2] || 1);
  L.stars.slice(1).forEach((v, k) => { ui.starMarks[k + 1].style.left = Math.min(97, (v / s3) * 100) + '%'; });
  ui.starMarks[0].style.left = '0%';
  ui.starMarks[0].classList.add('first');
  let lastMoves = null;
  function updateHud(hd = game.hud()) {
    ui.movesEl.textContent = String(Math.max(0, hd.moves));
    if (lastMoves !== null && hd.moves !== lastMoves) bump(ui.movesBox);
    ui.movesBox.classList.toggle('low', hd.moves <= 5);
    lastMoves = hd.moves;
    hd.goals.forEach((left, k) => {
      const ge = goalEls[k];
      if (ge.last === left) return;
      ge.num.textContent = left > 0 ? (ge.g.type === 'score' ? fmt(left) : String(left)) : '✓';
      ge.chip.classList.toggle('done', left === 0);
      if (ge.last !== null) bump(ge.chip);
      ge.last = left;
    });
    ui.scoreEl.textContent = fmt(hd.score);
    ui.fill.style.width = Math.min(100, (hd.score / s3) * 100) + '%';
    const won = game.goalsDone();
    ui.starMarks[0].classList.toggle('on', won);
    ui.starMarks[1].classList.toggle('on', won && hd.score >= L.stars[1]);
    ui.starMarks[2].classList.toggle('on', won && hd.score >= L.stars[2]);
    ui.tHammer.badge.textContent = hd.hammers;
    ui.tHammer.disabled = hd.hammers <= 0;
    ui.tShuffle.badge.textContent = hd.shuffles;
    ui.tShuffle.disabled = hd.shuffles <= 0;
    ui.tHint.badge.textContent = '';
  }

  const save = () => { if (my === session) store.set(K.run, { n, s: game.save() }); };
  let ending = false;

  const board = new BoardView(ui.wrap, {
    theme: w,
    idleMs: n <= 2 ? 3500 : 6000,
    getHint: () => (game.status === 'play' ? game.hint() : null),
    onHud: (hd) => updateHud(hd),
    onSwap: (a, b) => act(game.swap(a, b)),
    onTap: (i) => {
      const res = game.hammer(i);
      setHammer(false);
      if (!res) { sfx.play('error'); toast('Dort geht das nicht'); return; }
      act(res);
    },
  });
  board.setGame(game);
  updateHud();
  window.__m3.cur = { game, board, n };

  function setHammer(on) {
    board.mode = on ? 'hammer' : 'swap';
    ui.tHammer.classList.toggle('on', on);
    ui.banner.classList.toggle('show', on);
  }

  async function act(res) {
    if (!res || my !== session) return;
    save();
    await board.play(res.events);
    if (my !== session) return;
    updateHud();
    afterAction();
  }

  function afterAction() {
    if (game.status === 'won') return finishWin();
    if (game.status === 'lost') return showLose();
    return null;
  }

  async function finishWin() {
    if (ending) return;
    ending = true;
    setHammer(false);
    if (!game.finaleDone) {
      await sleepMs(350);
      if (my !== session) return;
      const res = game.finale();
      if (res) { save(); await board.play(res.events); if (my !== session) return; updateHud(); }
    }
    const stars = game.stars();
    // Bis ein Knopf gewählt ist, bleibt der Sieg gespeichert: Neuladen zeigt das Blatt wieder,
    // ohne Fortschritt und Statistik doppelt zu zählen.
    const saved = store.get(K.run, null);
    let prevBest;
    if (saved && saved.n === n && saved.won) {
      prevBest = saved.prevBest || 0;
    } else {
      const p = getProg();
      prevBest = p.best[n] || 0;
      p.stars[n] = Math.max(p.stars[n] || 0, stars);
      p.best[n] = Math.max(prevBest, game.score);
      p.max = Math.max(p.max, n + 1);
      setProg(p);
      const st = getStats();
      st.won++; st.gems += game.gemsCleared; st.specials += game.specialsMade; st.combo = Math.max(st.combo, game.maxCombo);
      setStats(st);
      if (my === session) store.set(K.run, { n, s: game.save(), won: true, prevBest });
    }
    reportSummary(ID, summary());
    sfx.play('complete');
    celebrate(CONFETTI);
    // nächstes Level im Hintergrund vorbereiten
    setTimeout(() => { try { getLevel(n + 1); } catch { /* egal */ } }, 2900);
    const starRow = h('div.m3-winstars', null, ...[1, 2, 3].map((q) => h('span' + (q <= stars ? '.on' : ''), { style: { animationDelay: 0.25 + q * 0.28 + 's' } }, '★')));
    const content = h('div.m3-win', null, starRow,
      h('div.m3-win-score', null, h('small', null, 'Punkte'), h('b', null, fmt(game.score))),
      game.score > prevBest && prevBest > 0 ? h('div.m3-win-rec', null, 'Neuer Rekord!') : null,
      h('p.m3-win-sub', null, stars < 3 ? 'Mit mehr Punkten gibt es mehr Sterne.' : 'Alle drei Sterne – grossartig!'));
    const v = await showModal({
      title: winTitles[n % winTitles.length], content, dismissible: false,
      buttons: [
        { label: `Weiter zu Level ${n + 1}`, value: 'next', primary: true, icon: 'play' },
        { label: 'Nochmal spielen', value: 'again', icon: 'refresh' },
        { label: 'Levelkarte', value: 'map', ghost: true },
      ],
    });
    if (my !== session) return;
    store.remove(K.run);
    if (v === 'next') go(`level/${n + 1}`);
    else if (v === 'again') go(`level/${n}`);
    else go('karte');
  }

  async function showLose() {
    if (ending) return;
    ending = true;
    setHammer(false);
    sfx.play('thud');
    const left = game.goalRemaining();
    // Wie viel fehlt noch (0 … 1, Mittel über alle Ziele)? Danach richtet sich der Titel.
    const startOf = (g) => (g.type === 'ice' ? L.ice.filter((x) => x > 0).length
      : g.type === 'stone' ? L.stone.filter((x) => x > 0).length : g.n || 1);
    const missing = L.goals.reduce((a, g, k) => a + Math.min(1, left[k] / Math.max(1, startOf(g))), 0) / L.goals.length;
    const titles = missing <= 0.25 ? loseTitles : missing <= 0.6 ? loseTitlesMid : loseTitlesFar;
    const list = h('div.m3-lose', null,
      h('p', null, missing <= 0.25 ? 'Dir fehlt nur noch:' : 'Es fehlt noch:'),
      h('div.m3-lose-goals', null, ...L.goals.map((g, k) => (left[k] > 0
        ? h('div.m3-goal', null, goalIcon(g) ? h('img', { src: goalIcon(g), alt: '' }) : h('span.m3-goal-t', null, '🎯'), h('b', null, g.type === 'score' ? fmt(left[k]) : String(left[k])))
        : null)).filter(Boolean)),
      !game.extraUsed ? h('p.m3-lose-hint', null, 'Einmal pro Level gibt es 5 Züge geschenkt.') : null);
    const buttons = [];
    if (!game.extraUsed) buttons.push({ label: '+5 Züge (gratis)', value: 'extra', primary: true, icon: 'plus' });
    buttons.push({ label: 'Nochmal versuchen', value: 'again', primary: game.extraUsed, icon: 'refresh' });
    buttons.push({ label: 'Levelkarte', value: 'map', ghost: true });
    const v = await showModal({ title: titles[n % titles.length], content: list, buttons, dismissible: false });
    if (my !== session) return;
    if (v === 'extra') {
      ending = false;
      const res = game.addMoves(5);
      toast('+5 Züge – du schaffst das!');
      return act(res);
    }
    const st = getStats(); st.gems += game.gemsCleared; st.specials += game.specialsMade; st.combo = Math.max(st.combo, game.maxCombo); setStats(st);
    store.remove(K.run);
    if (v === 'again') {
      // Neuer Versuch mit frisch gemischtem Brett
      const g2 = new Game({ ...L, seed: (L.seed + Date.now()) >>> 0 });
      store.set(K.run, { n, s: g2.save() });
      const s2 = getStats(); s2.played++; setStats(s2);
      return go(`level/${n}`);
    }
    return go('karte');
  }

  ui.tHammer.addEventListener('click', () => {
    if (board.busy || game.status !== 'play') return;
    sfx.play('click');
    setHammer(board.mode !== 'hammer');
  });
  ui.tShuffle.addEventListener('click', () => {
    if (board.busy || game.status !== 'play') return;
    setHammer(false);
    act(game.shuffleBooster());
  });
  ui.tHint.addEventListener('click', () => {
    if (board.busy || game.status !== 'play') return;
    sfx.play('click');
    const m = game.hint();
    if (m) board.showHint(m);
  });

  teardown = () => { board.destroy(); session++; };

  // Start: Ziele zeigen, Hinweise für neue Elemente, Coach-Mark in Level 1
  if (game.status === 'won') { finishWin(); return; }
  if (game.status === 'lost') { showLose(); return; }
  (async () => {
    if (fresh) await levelIntro(ui, L, n);
    if (my !== session) return;
    await newFeatureTips(L);
    if (my !== session) return;
    if (n === 1 && game.movesUsed === 0) {
      const m = game.hint();
      if (m) board.setCoach(m);
    }
  })();
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

function levelIntro(ui, L, n) {
  return new Promise((resolve) => {
    const goals = L.goals.map((g) => h('div.m3-intro-goal', null,
      goalIcon(g) ? h('img', { src: goalIcon(g), alt: '' }) : h('span.m3-goal-t', null, '🎯'),
      h('span', null, goalLabel(g, g.n || 0))));
    const card = h('div.m3-intro', null,
      h('div.m3-intro-card', null,
        h('small', null, `Level ${n}`),
        h('b', null, `${L.moves} Züge`),
        ...goals,
        L.tip ? h('p', null, L.tip) : null));
    ui.wrap.append(card);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      card.classList.add('out');
      setTimeout(() => { card.remove(); resolve(); }, 260);
    };
    card.addEventListener('pointerdown', close);
    setTimeout(close, L.tip ? 3600 : 1900);
  });
}

async function newFeatureTips(L) {
  const f = features(L);
  const seen = store.get(K.tips, {}) || {};
  for (const key of ['ice', 'stone', 'item']) {
    if (!f[key] || seen[key]) continue;
    seen[key] = true;
    store.set(K.tips, seen);
    const t = firstTips[key];
    const src = key === 'ice' ? iceURL(96) : key === 'stone' ? spriteURL('stone', 96) : spriteURL('acorn', 96);
    await showModal({ title: t.title, content: h('div.m3-tip', null, h('img', { src, alt: '' }), h('p', null, t.text)), buttons: [{ label: 'Verstanden', value: true, primary: true }] });
  }
}

// ---------- Entspannt-Modus ----------

function playZen() {
  const my = ++session;
  const saved = store.get(K.zen, null);
  let game = null;
  if (saved && saved.s) { try { game = new Game(zenLevel(saved.seed), saved.s); } catch { game = null; } }
  if (!game) {
    const seed = (Date.now() % 1e9) >>> 0;
    game = new Game(zenLevel(seed));
    store.set(K.zen, { seed, s: game.save() });
  }
  const seed = (store.get(K.zen, {}) || {}).seed;
  const theme = worldInfo(2);
  const ui = playScreen({ title: 'Entspannt', sub: 'ohne Zuglimit', theme, zen: true });
  ui.goalsEl.append(h('div.m3-zenmsg', null, 'Einfach geniessen – ohne Eile ✨'));
  ui.starMarks.forEach((s) => { s.style.display = 'none'; });
  ui.tHammer.badge.textContent = '∞';
  ui.tShuffle.badge.textContent = '∞';
  ui.tShuffle.querySelector('small').textContent = 'Mischen';
  const nextMilestone = (sc) => zenMilestones.find((m) => m > sc) || Math.ceil((sc + 1) / 100000) * 100000;
  let lastScore = game.score;
  function updateHud(hd = game.hud()) {
    ui.movesEl.textContent = fmt(hd.score);
    const nm = nextMilestone(hd.score);
    const prev = zenMilestones.filter((m) => m <= hd.score).pop() || 0;
    ui.scoreEl.textContent = fmt(nm);
    ui.fill.style.width = Math.min(100, ((hd.score - prev) / (nm - prev)) * 100) + '%';
    for (const m of zenMilestones) {
      if (lastScore < m && hd.score >= m) { toast(`${fmt(m)} Punkte erreicht!`); sfx.play('complete'); celebrate(CONFETTI); }
    }
    lastScore = hd.score;
  }
  const save = () => {
    if (my !== session) return;
    store.set(K.zen, { seed, s: game.save() });
    const st = getStats();
    if (game.score > st.zenBest) { st.zenBest = game.score; setStats(st); }
  };
  const board = new BoardView(ui.wrap, {
    theme, idleMs: 7000,
    getHint: () => game.hint(),
    onHud: (hd) => updateHud(hd),
    onSwap: (a, b) => act(game.swap(a, b)),
    onTap: (i) => { const res = game.hammer(i); setHammer(false); if (!res) { sfx.play('error'); return; } act(res); },
  });
  board.setGame(game);
  updateHud();
  window.__m3.cur = { game, board, n: 0 };
  reportSummary(ID, `Entspannt · ${fmt(game.score)} Punkte`);
  function setHammer(on) { board.mode = on ? 'hammer' : 'swap'; ui.tHammer.classList.toggle('on', on); ui.banner.classList.toggle('show', on); }
  async function act(res) {
    if (!res || my !== session) return;
    save();
    await board.play(res.events);
    if (my !== session) return;
    updateHud();
    const st = getStats();
    if (game.maxCombo > st.combo) { st.combo = game.maxCombo; setStats(st); }
    reportSummary(ID, `Entspannt · ${fmt(game.score)} Punkte`);
  }
  ui.tHammer.addEventListener('click', () => { if (board.busy) return; sfx.play('click'); setHammer(board.mode !== 'hammer'); });
  ui.tShuffle.addEventListener('click', () => { if (board.busy) return; setHammer(false); act(game.shuffleBooster()); });
  ui.tHint.addEventListener('click', () => { if (board.busy) return; sfx.play('click'); const m = game.hint(); if (m) board.showHint(m); });
  teardown = () => { board.destroy(); session++; };
}

// ---------- Start ----------

// Für Tests: aktuellen Zustand abfragen (keine Auswirkung im Spiel)
window.__m3 = { getLevel, store, K, cur: null };
route();
