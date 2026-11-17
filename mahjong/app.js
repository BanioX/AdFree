// Mahjong – Oberfläche: Menü, Reise, Spielfläche, Tagesrätsel, Statistik, Einstellungen.

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import { layouts } from './data/layouts.js';
import { tilesets, tilesetById } from './data/tilesets.js';
import { parseLayout, generateLayoutDef, sizeClass, solve, TILE } from './engine.js';
import { Session } from './game.js';
import { BoardView, drawMiniLayout } from './board.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { tutorialSteps } from './tutorial.js';
import { dailyDef as dailyDefFor, dailySeed } from './daily.js';

setupPage();

const ID = 'mahjong';
const K = {
  settings: 'mahjong.settings',
  progress: 'mahjong.progress',
  stats: 'mahjong.stats',
  cur: 'mahjong.cur',
  daily: 'mahjong.daily',
  coached: 'mahjong.coached',
  hints: 'mahjong.tips',
};
const app = document.getElementById('app');
const CONFETTI = ['#c0573e', '#e7a923', '#2f8a73', '#f48fb1', '#ffffff', '#5b8def'];

// ------------------------------------------------------------ Gespeicherte Daten

const settings = Object.assign({ tileset: 'klassisch', highlightFree: false, dimBlocked: true }, store.get(K.settings, {}));
if (!tilesets.some((t) => t.id === settings.tileset)) settings.tileset = 'klassisch';
const saveSettings = () => store.set(K.settings, settings);

const getProgress = () => {
  const p = store.get(K.progress, null);
  return p && typeof p === 'object' && p.levels ? p : { levels: {} };
};
const getStats = () => Object.assign({
  played: 0, won: 0, pairs: 0, hints: 0, shuffles: 0, streak: 0, bestStreak: 0, best: {}, time: 0,
}, store.get(K.stats, {}));

const parsedCache = new Map();
function layoutDef(id) { return layouts.find((l) => l.id === id) || null; }
function parsedLayout(def) {
  if (!parsedCache.has(def.id)) parsedCache.set(def.id, parseLayout(def));
  return parsedCache.get(def.id);
}

function levelState(progress, id) { return progress.levels[id] || null; }
function completedCount(progress) { return layouts.filter((l) => levelState(progress, l.id)?.wins > 0).length; }
function totalStars(progress) { return layouts.reduce((s, l) => s + (levelState(progress, l.id)?.stars || 0), 0); }
function isUnlocked(progress, idx) {
  return idx < completedCount(progress) + 3 || (levelState(progress, layouts[idx].id)?.wins > 0);
}
function nextLevelIndex(progress) {
  const i = layouts.findIndex((l, k) => !(levelState(progress, l.id)?.wins > 0) && isUnlocked(progress, k));
  if (i >= 0) return i;
  const j = layouts.findIndex((l) => (levelState(progress, l.id)?.stars || 0) < 3);
  return j >= 0 ? j : 0;
}

function loadCur() {
  const raw = store.get(K.cur, null);
  if (!raw) return null;
  const s = Session.fromSave(raw);
  if (!s || s.won) return null;
  return s;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateSummary() {
  const p = getProgress();
  const cur = store.get(K.cur, null);
  const stars = totalStars(p);
  let text = `Reise ${completedCount(p)}/${layouts.length} · ${stars} ★`;
  if (cur && !cur.won && Array.isArray(cur.hist) && cur.hist.length) {
    const s = Session.fromSave(cur);
    if (s) text = `${s.layout.name || 'Spiel'}: ${Math.round(s.progress * 100)} % abgeräumt · ${stars} ★`;
  }
  if (isDailyDone(ID)) text += ' · Tagesrätsel ✓';
  reportSummary(ID, text);
}

// ------------------------------------------------------------ Tagesrätsel

function dailyDef(date = todayKey()) { return dailyDefFor(date); }

// ------------------------------------------------------------ Navigation

let screen = null;
let currentRoute = null;
let pendingFresh = false;
let tutorialPending = false;

function mount(el, api = {}) {
  if (screen && screen.destroy) screen.destroy();
  app.replaceChildren(el);
  el.classList.add('enter');
  screen = api;
}

function go(hash, { replace = false, force = false } = {}) {
  const url = location.pathname + location.search + (hash ? '#' + hash : '');
  const d = (history.state && history.state.d) || 0;
  if (replace) history.replaceState({ d }, '', url);
  else history.pushState({ d: d + 1 }, '', url);
  route(force);
}

function goBackToMenu() {
  if (history.state && history.state.d > 0 && currentRoute !== '') history.back();
  else go('', { replace: true });
}

function route(force = false) {
  const r = location.hash.replace(/^#/, '');
  if (!force && r === currentRoute && screen) return;
  currentRoute = r;
  if (r === 'reise') showJourney();
  else if (r === 'spiel') {
    const s = loadCur();
    if (s) showGame(s, 'cur', { fresh: pendingFresh });
    else { currentRoute = ''; history.replaceState(history.state, '', location.pathname + location.search); showMenu(); }
  } else if (r === 'daily') openDaily();
  else showMenu();
  pendingFresh = false;
  if (!tutorialSeen(ID) && !tutorialPending) {
    tutorialPending = true;
    setTimeout(() => maybeShowTutorial({ id: ID, steps: tutorialSteps(settings.tileset), accent: '#c0573e' }), 250);
  }
}

window.addEventListener('popstate', () => route());
window.addEventListener('hashchange', () => route());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && screen && screen.save) screen.save();
});
window.addEventListener('pagehide', () => { if (screen && screen.save) screen.save(); });

function iconBtn(name, onClick, label) {
  const b = h('button.icon-btn', { type: 'button', 'aria-label': label || name, html: icon(name) });
  b.addEventListener('click', () => { sfx.play('click'); onClick(); });
  return b;
}

/**
 * Knopf, der schon beim Loslassen (pointerup) auslöst – gepaart mit pointerdown auf demselben Knopf.
 * So gehen schnelle Taps (z. B. mehrmals Rückgängig) nie verloren, auch wenn der Browser ein
 * click-Ereignis auslässt. Das nachfolgende synthetische click wird unterdrückt (kein Doppel-Auslösen,
 * kein «Geister-Tipp» in einen Dialog, der gerade aufgeht). Tastatur-Klicks (detail 0) gehen weiter.
 */
function onTapUp(btn, fn) {
  let down = null;
  let suppress = false;
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = e.pointerId;
    suppress = false;
  });
  btn.addEventListener('pointercancel', () => { down = null; });
  btn.addEventListener('pointerup', (e) => {
    if (down !== e.pointerId) return;
    down = null;
    const r = btn.getBoundingClientRect();
    const slop = 12;
    if (e.clientX < r.left - slop || e.clientX > r.right + slop || e.clientY < r.top - slop || e.clientY > r.bottom + slop) return;
    suppress = true;
    fn();
  });
  // Das synthetische click nach einem Tipp unterdrücken (touchend kommt nach pointerup).
  btn.addEventListener('touchend', (e) => {
    if (suppress && e.cancelable) e.preventDefault();
    suppress = false;
  }, { passive: false });
  // Nur Tastatur/Bedienungshilfen (detail 0) lösen über click aus – Zeiger-Klicks liefen schon über pointerup.
  btn.addEventListener('click', (e) => { if (e.detail === 0) fn(); });
}

function helpBtn() {
  const b = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  b.addEventListener('click', () => { sfx.play('click'); showHelp(); });
  return b;
}

// ------------------------------------------------------------ Menü

function tileCanvas(setId, face, w) { return BoardView.tileImage(setId, face, w); }

function menuArt(setId) {
  const set = tilesetById(setId);
  const fan = h('div.fan');
  const fanFaces = set.kind === 'drawn' ? [0, 31, 35, 9] : [0, 7, 35, 39];
  const angles = [-16, -5, 6, 17];
  const xs = [-86, -32, 22, 76];
  fanFaces.forEach((f, k) => {
    const c = tileCanvas(set.id, f, 50);
    const m = Number(c.dataset.margin);
    c.style.transform = `translate(${xs[k] - 25 - m}px, ${-40 - m + Math.abs(angles[k]) * 0.9}px) rotate(${angles[k]}deg)`;
    fan.append(c);
  });
  return fan;
}

function levelCard(def, idx, progress, nextIdx, minis) {
  const st = levelState(progress, def.id);
  const unlocked = isUnlocked(progress, idx);
  const L = parsedLayout(def);
  const cv = h('canvas');
  const starsEl = h('div.stars');
  for (let k = 0; k < 3; k++) starsEl.append(h('span', { class: k < (st?.stars || 0) ? 'on' : '', html: icon('star', { size: 15 }) }));
  const btn = h('button.lv', { type: 'button', class: 'lv' + (unlocked ? '' : ' locked') + (idx === nextIdx ? ' current' : ''), 'data-idx': idx },
    h('span.num', null, String(idx + 1)),
    cv,
    unlocked ? null : h('span.lock', { html: icon('lock', { size: 22 }) }),
    h('b', null, def.name),
    h('small', null, st?.best ? `${L.tiles.length} Steine · ${fmtTime(st.best)}` : `${L.tiles.length} Steine`),
    starsEl);
  btn.addEventListener('click', () => {
    if (!unlocked) {
      sfx.play('error');
      btn.classList.remove('sp-shake'); void btn.offsetWidth; btn.classList.add('sp-shake');
      toast('Schliesse zuerst ein anderes Layout ab');
      return;
    }
    sfx.play('tap');
    startLevel(idx);
  });
  minis.push([cv, L, st?.wins > 0, unlocked]);
  return btn;
}

function paintMinis(minis) {
  for (const [cv, L, won, unlocked] of minis) drawMiniLayout(cv, L.tiles, { color: won ? '#2f8a73' : unlocked ? '#c0573e' : '#a89c90', done: won });
}

async function chooseEndless() {
  const v = await showModal({
    title: 'Zufallsspiel',
    text: 'Neue Form, neue Steine – so oft du magst. Wie gross soll das Brett sein?',
    buttons: [
      { label: 'Klein · bis 72 Steine', value: 'klein', primary: true },
      { label: 'Mittel · bis 108 Steine', value: 'mittel', primary: true },
      { label: 'Gross · bis 144 Steine', value: 'gross', primary: true },
      { label: 'Abbrechen', value: null, ghost: true },
    ],
  });
  if (v) startEndless(v);
}

function showMenu() {
  const progress = getProgress();
  const cur = loadCur();
  const stats = getStats();

  const nextIdx = nextLevelIndex(progress);
  const primary = cur
    ? { label: 'Weiter', sub: `${cur.meta.kind === 'daily' ? 'Tagesrätsel' : (cur.layout.name || 'Spiel')} · ${Math.round(cur.progress * 100)} % abgeräumt`, onClick: () => go('spiel') }
    : { label: 'Spielen', sub: `Level ${nextIdx + 1}: ${layouts[nextIdx].name}`, onClick: () => startLevel(nextIdx) };

  const dDef = dailyDef();
  const daily = {
    done: isDailyDone(ID),
    sub: `${dDef.name} · ${parseLayout(dDef).tiles.length} Steine`,
    streak: dailyStreak(ID),
    onClick: () => go('daily'),
  };

  const done = completedCount(progress);
  const stars = totalStars(progress);
  const minis = [];
  const strip = h('div.jstrip', null, layouts.map((def, idx) => levelCard(def, idx, progress, nextIdx, minis)));
  const allBtn = h('button.jall', { type: 'button' }, `Alle ${layouts.length} Layouts`, h('span', { html: icon('back', { size: 16 }) }));
  allBtn.addEventListener('click', () => { sfx.play('click'); go('reise'); });
  const journeyHead = h('div.journey-head', null,
    h('span', null, `${done}/${layouts.length}`),
    h('div.bar', null, h('i', { style: { width: Math.round((done / layouts.length) * 100) + '%' } })),
    h('span', null, `★ ${stars}`));

  const best = stats.best || {};
  const bestAny = [best.klein, best.mittel, best.gross].filter(Boolean);
  const menu = gameMenu({
    id: ID,
    title: 'Mahjong',
    tagline: 'Gleiche Steine paarweise abräumen',
    accent: '#c0573e',
    art: menuArt(settings.tileset),
    primary,
    daily,
    modes: {
      label: 'Steine',
      value: settings.tileset,
      options: tilesets.map((t) => ({ id: t.id, label: t.name })),
      onChange(id) {
        settings.tileset = id;
        saveSettings();
        const art = menu.querySelector('.gm-art');
        if (art) art.replaceChildren(menuArt(id));
      },
    },
    secondary: [
      { label: 'Reise', sub: `${done}/${layouts.length}`, icon: 'grid', onClick: () => go('reise') },
      { label: 'Zufall', sub: 'Endlos', icon: 'shuffle', onClick: () => chooseEndless() },
      { label: 'Statistik', sub: `${stats.won} ${stats.won === 1 ? 'Sieg' : 'Siege'}`, icon: 'star', onClick: () => showStats() },
    ],
    stats: [
      { label: 'Gewonnen', value: stats.won },
      { label: 'Sterne', value: `${stars}★` },
      { label: 'Bestzeit', value: bestAny.length ? fmtTime(Math.min(...bestAny)) : '–' },
      { label: 'Tage-Serie', value: dailyStreak(ID) },
    ],
    sections: [menuSection('Reise', journeyHead, strip, allBtn)],
    onHelp: () => showHelp(),
    backHref: '../',
  });
  menu.classList.add('screen', 'menu-screen');
  mount(menu, {});
  requestAnimationFrame(() => {
    paintMinis(minis);
    const c = strip.querySelector('.lv.current');
    if (c) strip.scrollLeft = Math.max(0, c.offsetLeft - (strip.clientWidth - c.offsetWidth) / 2);
  });
  updateSummary();
}

function showMenuRefresh() { if (currentRoute === '') showMenu(); }

// ------------------------------------------------------------ Reise

function showJourney() {
  const progress = getProgress();
  const done = completedCount(progress);
  const stars = totalStars(progress);
  const nextIdx = nextLevelIndex(progress);
  const minis = [];
  const grid = h('div.levels', null, layouts.map((def, idx) => levelCard(def, idx, progress, nextIdx, minis)));
  const pct = Math.round((done / layouts.length) * 100);
  const el = h('div.screen', null,
    h('div.topbar', null,
      backButton('./', () => { sfx.play('click'); goBackToMenu(); }),
      h('div.title', null, 'Reise'),
      h('span.chip.star-chip', { html: icon('star', { size: 16 }) + `<span>${stars}/${layouts.length * 3}</span>` })),
    h('div.scroll', null,
      h('div.journey', null,
        h('div.journey-head', null, h('span', null, `${done}/${layouts.length}`), h('div.bar', null, h('i', { style: { width: pct + '%' } })), h('span', null, `${pct} %`)),
        grid)));
  mount(el, {});
  requestAnimationFrame(() => {
    paintMinis(minis);
    const cur = grid.querySelector('.lv.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

// ------------------------------------------------------------ Spiele starten

async function confirmReplace({ title = 'Laufendes Spiel beenden?', what = 'Ein neues Spiel ersetzt es.', ok: okLabel = 'Neues Spiel' } = {}) {
  const cur = loadCur();
  if (!cur || cur.history.length === 0) return true;
  const ok = await confirmDialog(title,
    `«${cur.layout.name}» ist zu ${Math.round(cur.progress * 100)} % abgeräumt. ${what}`,
    okLabel, 'Abbrechen');
  if (ok) store.update(K.stats, {}, (s) => ({ ...s, streak: 0 }));
  return ok;
}

function countStart() {
  store.update(K.stats, {}, (s) => ({ ...s, played: (s.played || 0) + 1 }));
}

async function startLevel(idx, { skipConfirm = false } = {}) {
  if (!skipConfirm && !(await confirmReplace())) return;
  const def = layouts[idx];
  const progress = getProgress();
  const st = progress.levels[def.id] || { stars: 0, best: 0, wins: 0, plays: 0 };
  st.plays = (st.plays || 0) + 1;
  progress.levels[def.id] = st;
  store.set(K.progress, progress);
  const s = Session.create(parsedLayout(def), { kind: 'level', ref: def.id, seed: `${def.id}-${st.plays}`, name: def.name });
  store.set(K.cur, s.serialize());
  countStart();
  pendingFresh = true;
  go('spiel', { replace: currentRoute === 'spiel' || currentRoute === 'reise', force: true });
}

async function startEndless(size, { skipConfirm = false } = {}) {
  if (!skipConfirm && !(await confirmReplace())) return;
  const rnd = Math.floor(Math.random() * 1e9);
  const pool = layouts.filter((l) => sizeClass(parsedLayout(l).tiles.length) === size);
  let def;
  if (pool.length && rnd % 5 < 2) def = pool[rnd % pool.length];
  else def = generateLayoutDef(rnd, size);
  const s = Session.create(parseLayout(def), { kind: 'endless', ref: def.id, seed: `endlos-${rnd}`, name: def.name, size });
  store.set(K.cur, s.serialize());
  countStart();
  pendingFresh = true;
  go('spiel', { replace: currentRoute === 'spiel', force: true });
}

async function openDaily() {
  const date = todayKey();
  const saved = store.get(K.daily, null);
  let s = saved && saved.date === date ? Session.fromSave(saved.save) : null;
  let fresh = false;
  const create = () => {
    const def = dailyDef(date);
    const ses = Session.create(parseLayout(def), { kind: 'daily', ref: def.id, seed: dailySeed(date), name: 'Tagesrätsel', date, form: def.name });
    store.set(K.daily, { date, save: ses.serialize() });
    countStart();
    return ses;
  };
  if (!s) { s = create(); fresh = true; }
  if (s.won) {
    // Schon gelöst: Menü im Hintergrund + Wahl
    showMenu();
    const v = await showModal({
      title: 'Heute schon gelöst ✓',
      html: `<p>Das Tagesrätsel von heute hast du geschafft${dailyStreak(ID) > 1 ? ` – ${dailyStreak(ID)} Tage in Folge` : ''}. Morgen gibt’s ein neues!</p>`,
      buttons: [
        { label: 'Nochmal spielen', value: 'again', primary: true, icon: 'refresh' },
        { label: 'Zum Menü', value: 'menu', ghost: true },
      ],
      dismissible: false,
    });
    if (v === 'again') {
      s = create();
      fresh = true;
    } else { go('', { replace: true }); return; }
  }
  showGame(s, 'daily', { fresh });
}

// ------------------------------------------------------------ Spielfläche

let active = null; // { session, view } für Test-Zugriff

function showGame(session, slot, { fresh = false } = {}) {
  let sel = -1;
  let busy = false;
  let lastMatch = 0;
  let combo = 0;
  let deadWarned = false;
  let coachEl = null;
  let tipCount = store.get(K.hints, 0);
  let alive = true;
  let winning = false;

  const persist = () => {
    if (slot === 'daily') store.set(K.daily, { date: session.meta.date, save: session.serialize() });
    else if (!session.won) store.set(K.cur, session.serialize());
  };

  const nameEl = h('span', null, session.meta.kind === 'daily' ? 'Tagesrätsel' : (session.layout.name || 'Mahjong'));
  const subEl = h('small');
  const progI = h('i');
  const wrap = h('div.board-wrap');
  const fitBtn = h('button.icon-btn.fit-btn', { type: 'button', 'aria-label': 'Einpassen', html: icon('expand') });
  const comboEl = h('div.combo');
  wrap.append(fitBtn, comboEl);

  const tool = (cls, ic, label, fn) => {
    const b = h('button.tool', { type: 'button', class: 'tool ' + cls, 'aria-label': label }, h('span.ib', { html: icon(ic) }), h('span', null, label));
    onTapUp(b, () => { if (!busy && !b.disabled) fn(); });
    return b;
  };
  const undoBtn = tool('undo', 'undo', 'Rückgängig', doUndo);
  const hintBtn = tool('hint', 'hint', 'Tipp', doHint);
  const shuffleBtn = tool('shuffle', 'shuffle', 'Mischen', () => doShuffle());
  const moreBtn = tool('more', 'more', 'Mehr', showMore);

  const el = h('div.screen.game', null,
    h('div.topbar', null,
      backButton('./', () => { sfx.play('click'); leave(); }),
      h('div.title', null, nameEl, subEl),
      h('div.right', null,
        helpBtn(),
        iconBtn('settings', () => showSettings(() => { view.setOptions(settings); }), 'Einstellungen')),
      h('div.progress', null, progI)),
    wrap,
    h('div.toolbar', null, undoBtn, hintBtn, shuffleBtn, moreBtn));

  let timer = 0;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    // Zeit läuft nur, wenn wirklich gespielt wird (kein Dialog, keine Anleitung offen)
    const paused = busy || document.visibilityState !== 'visible' || document.querySelector('.sp-modal-backdrop, .tut-backdrop');
    if (!session.won && !paused) session.elapsed += Math.min(5, (now - last) / 1000);
    last = now;
    renderHud();
  };
  let saveCounter = 0;

  mount(el, {
    destroy() {
      alive = false;
      clearInterval(timer);
      tick();
      persist();
      view.destroy();
      if (active && active.view === view) active = null;
      updateSummary();
    },
    save() { tick(); persist(); },
  });

  const view = new BoardView(wrap, {
    onTap,
    onZoomChange: (z) => { fitBtn.classList.toggle('show', z); if (z) hideCoach(); },
    onBurst: () => sfx.play('sparkle'),
  });
  fitBtn.addEventListener('click', () => { sfx.play('click'); view.fit(true); });
  view.setOptions(settings);
  view.setBoard(session.board, session.faces, session.present);
  active = { session, view, slot };

  function renderHud() {
    subEl.textContent = `${fmtTime(session.elapsed)} · ${session.pairsLeft} ${session.pairsLeft === 1 ? 'Paar' : 'Paare'}`;
    progI.style.width = `${Math.round(session.progress * 100)}%`;
    undoBtn.disabled = session.history.length === 0;
  }
  renderHud();
  timer = setInterval(() => {
    tick();
    if (++saveCounter % 5 === 0) persist();
  }, 1000);

  if (fresh) {
    sfx.play('whoosh');
    busy = true;
    view.animateEntry().then(() => { busy = false; showCoach(); });
  } else setTimeout(showCoach, 300);

  // Coach-Mark beim allerersten Layout: Ring um das erste sinnvolle Paar
  function showCoach() {
    if (coachEl || session.won || session.history.length || store.get(K.coached, false)) return;
    if (session.meta.kind !== 'level' || session.meta.ref !== layouts[0].id || !view.board) return;
    const r = session.hint();
    if (!r) return;
    const W = view.cam.w, H = W * TILE.ratio;
    coachEl = h('div.coach');
    let top = Infinity, bottom = 0;
    for (const i of r.pair) {
      const c = view.tileCenter(i);
      coachEl.append(h('div.coach-ring', { style: { left: c.x + 'px', top: c.y + 'px', width: W + 10 + 'px', height: H + 10 + 'px' } }));
      top = Math.min(top, c.y - H / 2); bottom = Math.max(bottom, c.y + H / 2);
    }
    // Sprechblase ausserhalb des Bretts (unter oder über allen Steinen), damit sie nichts verdeckt
    const boardTop = view.cam.oy - 4;
    const boardBottom = view.cam.oy + view.ext.h * W + 4;
    let below = true, y;
    if (boardBottom + 48 <= view.viewH) y = boardBottom + 8;
    else if (boardTop >= 48) { below = false; y = boardTop - 8; }
    else { below = bottom + 60 < view.viewH; y = below ? bottom + 12 : top - 12; }
    const bubble = h('div.coach-bubble', { class: 'coach-bubble ' + (below ? 'below' : 'above') }, 'Tippe die zwei gleichen Steine an');
    bubble.style.left = '50%';
    bubble.style.top = y + 'px';
    coachEl.append(bubble);
    wrap.append(coachEl);
  }
  function hideCoach() {
    if (!coachEl) return;
    const el = coachEl;
    coachEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }
  if (!session.won && !session.hasMoves()) setTimeout(() => showNoMoves(), 500);

  function leave() {
    if (winning) return; // Sieg ist schon gespeichert – gleich kommt das Ergebnis
    tick();
    persist();
    goBackToMenu();
  }

  function select(i) {
    sel = i;
    view.setSelected(i);
  }

  function onTap(i) {
    if (busy || session.won) return;
    view.clearHint();
    hintBtn.classList.remove('pulse');
    if (i < 0) { if (sel >= 0) { select(-1); sfx.play('click'); } return; }
    if (!session.isFree(i)) {
      sfx.play('thud');
      view.shake(i);
      const b = session.blockers(i);
      view.flashWarn([...b.above, ...b.sides]);
      if (tipCount < 3) {
        tipCount++;
        store.set(K.hints, tipCount);
        toast(b.above.length ? 'Da liegt noch ein Stein darauf' : 'Links oder rechts muss frei sein');
      }
      return;
    }
    if (sel === -1) { select(i); sfx.play('tap'); return; }
    if (sel === i) { select(-1); sfx.play('click'); return; }
    if (session.canMatch(sel, i)) doMatch(sel, i);
    else { select(i); sfx.play('tap'); }
  }

  async function doMatch(a, b) {
    const fa = session.faces[a], fb = session.faces[b];
    session.match(a, b);
    if (!store.get(K.coached, false)) store.set(K.coached, true);
    hideCoach();
    select(-1);
    view.update();
    sfx.play('pop');
    const now = performance.now();
    combo = now - lastMatch < 3200 ? combo + 1 : 1;
    lastMatch = now;
    if (combo >= 3) showCombo(combo);
    store.update(K.stats, {}, (s) => ({ ...s, pairs: (s.pairs || 0) + 1 }));
    persist();
    renderHud();
    const anim = view.animateMatch(a, b, fa, fb);
    if (session.won) {
      busy = true;
      winning = true;
      // Sofort (synchron) festhalten: Statistik, Sterne, Tagesrätsel-Häkchen – auch wenn die App gleich zugeht
      const res = saveWin();
      await anim;
      handleWin(res);
      return;
    }
    if (!session.hasMoves()) {
      await anim;
      if (!session.won && !session.hasMoves()) showNoMoves();
      return;
    }
    // Leise prüfen, ob die Stellung noch aufgeht
    setTimeout(checkDeadEnd, 650);
  }

  function checkDeadEnd() {
    if (!alive || session.won || deadWarned || session.cert || session.remaining > 60) return;
    if (!session.hasMoves() || document.querySelector('.sp-modal-backdrop')) return;
    const r = solve(session.board, session.faces, session.present, { maxNodes: 2500 });
    if (r.result === 'unsolvable') {
      deadWarned = true;
      shuffleBtn.classList.add('pulse');
      toast('So geht es nicht mehr ganz auf – Mischen oder Rückgängig hilft');
    }
  }

  function showCombo(n) {
    comboEl.textContent = `Serie ×${n}`;
    comboEl.classList.remove('show');
    void comboEl.offsetWidth;
    comboEl.classList.add('show');
  }

  function doUndo() {
    const prevFaces = session.faces.slice();
    const hEntry = session.undo();
    if (!hEntry) { toast('Noch nichts zum Zurücknehmen'); return; }
    select(-1);
    view.clearHint();
    deadWarned = false;
    shuffleBtn.classList.remove('pulse');
    if (hEntry.t === 'm') {
      view.update();
      view.animateAppear([hEntry.a, hEntry.b]);
      sfx.play('place');
    } else {
      view.faces = session.faces;
      view.update();
      view.animateShuffle(prevFaces, session.faces);
      sfx.play('whoosh');
    }
    persist();
    renderHud();
  }

  function doHint() {
    select(-1);
    const r = session.hint();
    if (!r) { showNoMoves(); return; }
    session.hints++;
    store.update(K.stats, {}, (s) => ({ ...s, hints: (s.hints || 0) + 1 }));
    if (view.zoomed) view.fit(true);
    view.showHint(r.pair);
    sfx.play('sparkle');
    if (r.unsolvable) {
      shuffleBtn.classList.add('pulse');
      toast('Achtung: So geht es nicht mehr ganz auf – lieber mischen');
    }
    persist();
  }

  async function doShuffle(fromSheet = false) {
    select(-1);
    view.clearHint();
    const r = session.shuffle();
    if (!r) {
      showModal({
        title: 'Mischen hilft hier nicht',
        text: 'Die übrigen Steine liegen so, dass sie sich nicht mehr abräumen lassen. Nimm ein paar Züge zurück oder beginne von vorne.',
        buttons: [
          { label: 'Rückgängig', value: 'undo', primary: true, icon: 'undo' },
          { label: 'Von vorne', value: 'restart' },
          { label: 'Schliessen', value: null, ghost: true },
        ],
      }).then((v) => { if (v === 'undo') doUndo(); else if (v === 'restart') doRestart(); });
      return;
    }
    store.update(K.stats, {}, (s) => ({ ...s, shuffles: (s.shuffles || 0) + 1 }));
    shuffleBtn.classList.remove('pulse');
    deadWarned = false;
    view.faces = session.faces;
    busy = true;
    sfx.play('whoosh');
    await view.animateShuffle(r.prev, r.next);
    busy = false;
    view.update();
    persist();
    if (!fromSheet && !session.hasMoves()) showNoMoves();
  }

  function doRestart() {
    session.restart();
    select(-1);
    view.faces = session.faces;
    view.setBoard(session.board, session.faces, session.present);
    view.setOptions(settings);
    busy = true;
    sfx.play('whoosh');
    view.animateEntry().then(() => { busy = false; });
    persist();
    renderHud();
  }

  async function showNoMoves() {
    if (session.won || !alive) return;
    shuffleBtn.classList.add('pulse');
    deadWarned = true;
    const t = document.querySelector('.sp-toast.show');
    if (t) t.classList.remove('show');
    const v = await showModal({
      title: 'Keine Paare mehr frei',
      text: 'Gerade passt kein freies Paar zusammen. Mischen verteilt die übrigen Steine neu – garantiert lösbar und gratis.',
      buttons: [
        { label: 'Mischen', value: 'shuffle', primary: true, icon: 'shuffle' },
        { label: 'Rückgängig', value: 'undo', icon: 'undo' },
        { label: 'Später', value: null, ghost: true },
      ],
    });
    if (v === 'shuffle') doShuffle();
    else if (v === 'undo') doUndo();
  }

  async function showMore() {
    sfx.play('click');
    const v = await showModal({
      title: session.meta.kind === 'daily' ? 'Tagesrätsel' : (session.layout.name || 'Mahjong'),
      html: `<p>${session.n} Steine · ${Math.round(session.progress * 100)} % abgeräumt · ${fmtTime(session.elapsed)}</p>`,
      buttons: [
        { label: 'Von vorne beginnen', value: 'restart', icon: 'refresh' },
        ...(session.meta.kind !== 'daily' ? [{ label: 'Neue Verteilung', value: 'redeal', icon: 'shuffle' }] : []),
        { label: 'So geht’s', value: 'help', icon: 'hint' },
        { label: 'Einstellungen', value: 'settings', icon: 'settings' },
        { label: 'Weiterspielen', value: null, ghost: true },
      ],
    });
    if (v === 'restart') {
      if (await confirmDialog('Von vorne beginnen?', 'Alle Steine kommen zurück aufs Brett – gleiche Verteilung.', 'Von vorne', 'Abbrechen')) doRestart();
    } else if (v === 'redeal') {
      tick();
      persist();
      if (!(await confirmReplace({ title: 'Neu verteilen?', what: 'Neue Verteilung beginnt dieses Layout mit anderen Steinen von vorne.', ok: 'Neu verteilen' }))) return;
      if (session.meta.kind === 'level') {
        const idx = layouts.findIndex((l) => l.id === session.meta.ref);
        if (idx >= 0) startLevel(idx, { skipConfirm: true });
      } else {
        const def = { id: session.meta.ref, name: session.layout.name };
        const seed = `endlos-${Math.floor(Math.random() * 1e9)}`;
        const s = Session.create(session.layout, { ...session.meta, seed, ref: def.id });
        store.set(K.cur, s.serialize());
        countStart();
        pendingFresh = true;
        go('spiel', { replace: true, force: true });
      }
    } else if (v === 'help') showHelp();
    else if (v === 'settings') showSettings(() => view.setOptions(settings));
  }

  function saveWin() {
    tick();
    clearInterval(timer);
    const res = recordWin(session);
    persist();
    if (slot === 'cur') store.remove(K.cur);
    updateSummary();
    return res;
  }

  async function handleWin(res) {
    if (!alive) return;
    view.winBurst();
    sfx.play('complete');
    celebrate(CONFETTI);
    await sleep(1100);
    if (!alive) return; // Bildschirm inzwischen verlassen – Menü zeigt den Sieg schon
    showWinSheet(session, res);
  }
}

function recordWin(session) {
  const time = Math.max(1, Math.round(session.elapsed));
  const size = sizeClass(session.n);
  const stars = session.stars;
  const res = { time, stars, newBest: false, prevBest: 0 };
  store.update(K.stats, {}, (s) => {
    s = Object.assign({ played: 0, won: 0, streak: 0, bestStreak: 0, best: {}, time: 0 }, s);
    s.won++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.time = (s.time || 0) + time;
    s.best = s.best || {};
    if (!s.best[size] || time < s.best[size]) s.best[size] = time;
    return s;
  });
  if (session.meta.kind === 'level') {
    const p = getProgress();
    const st = p.levels[session.meta.ref] || { stars: 0, best: 0, wins: 0, plays: 1 };
    res.prevBest = st.best || 0;
    res.newBest = !!st.best && time < st.best;
    res.firstClear = !(st.wins > 0);
    st.stars = Math.max(st.stars || 0, stars);
    st.best = st.best ? Math.min(st.best, time) : time;
    st.wins = (st.wins || 0) + 1;
    p.levels[session.meta.ref] = st;
    store.set(K.progress, p);
  }
  if (session.meta.kind === 'daily') {
    markDailyDone(ID, session.meta.date || todayKey());
  }
  return res;
}

async function showWinSheet(session, res) {
  const kind = session.meta.kind;
  const starsEl = h('div.sheet-stars');
  for (let k = 0; k < 3; k++) starsEl.append(h('span', { class: k < res.stars ? 'on' : '', html: icon('star', { size: 44 }) }));
  const facts = h('div.win-facts', null,
    h('div', null, h('b', null, fmtTime(res.time)), h('span', null, 'Zeit')),
    h('div', null, h('b', null, String(session.hints + session.shuffles)), h('span', null, 'Hilfen')));
  const extra = [];
  if (res.newBest) extra.push(h('div.badge-new', null, '🏆 Neue Bestzeit!'));
  else if (res.firstClear && kind === 'level') extra.push(h('div.badge-new', null, '✨ Neues Layout geschafft'));
  if (kind === 'daily') {
    const st = dailyStreak(ID);
    extra.push(h('div.badge-new', null, st > 1 ? `🔥 ${st} Tage in Folge` : '📅 Tagesrätsel gelöst'));
  }
  const hint = res.stars < 3 ? h('p', { style: { margin: '10px 0 0', fontSize: '13.5px' } }, '★★★ gibt es ohne Tipp und Mischen.') : null;
  const content = h('div', null, starsEl, facts, ...extra, hint);
  const buttons = [];
  let nextIdx = -1;
  if (kind === 'level') {
    const p = getProgress();
    const idx = layouts.findIndex((l) => l.id === session.meta.ref);
    nextIdx = idx + 1 < layouts.length && isUnlocked(p, idx + 1) ? idx + 1 : -1;
    if (nextIdx < 0) nextIdx = nextLevelIndex(p) !== idx ? nextLevelIndex(p) : -1;
    if (nextIdx >= 0) buttons.push({ label: `Weiter: ${layouts[nextIdx].name}`, value: 'next', primary: true, icon: 'play' });
    buttons.push({ label: 'Nochmal (neue Steine)', value: 'again', primary: nextIdx < 0, icon: 'refresh' });
  } else if (kind === 'endless') {
    buttons.push({ label: 'Neues Zufallsspiel', value: 'endless', primary: true, icon: 'shuffle' });
  } else {
    buttons.push({ label: 'Zur Reise', value: 'reise', primary: true, icon: 'play' });
  }
  buttons.push({ label: 'Zum Menü', value: 'menu', ghost: true });
  const title = kind === 'daily' ? 'Tagesrätsel gelöst!' : 'Geschafft!';
  const v = await showModal({ title, content, buttons, dismissible: false });
  if (v === 'next') startLevel(nextIdx, { skipConfirm: true });
  else if (v === 'again') {
    const idx = layouts.findIndex((l) => l.id === session.meta.ref);
    startLevel(idx, { skipConfirm: true });
  } else if (v === 'endless') startEndless(session.meta.size || sizeClass(session.n), { skipConfirm: true });
  else if (v === 'reise') go('reise', { replace: true });
  else go('', { replace: true });
}

// ------------------------------------------------------------ Blätter

function showHelp() {
  return showTutorial({ id: ID, steps: tutorialSteps(settings.tileset), accent: '#c0573e' });
}

function showSettings(onChange) {
  const setsEl = h('div.sets');
  const renderSets = () => {
    setsEl.replaceChildren();
    for (const t of tilesets) {
      const mini = h('div.mini');
      const faces = t.kind === 'drawn' ? [0, 31, 35] : [0, 5, 35];
      for (const f of faces) mini.append(tileCanvas(t.id, f, 30));
      const b = h('button.setopt', { type: 'button', class: 'setopt' + (settings.tileset === t.id ? ' on' : '') }, mini, t.name);
      b.addEventListener('click', () => {
        sfx.play('tap');
        settings.tileset = t.id;
        saveSettings();
        renderSets();
        if (onChange) onChange();
      });
      setsEl.append(b);
    }
  };
  renderSets();
  const toggle = (key, label, sub) => {
    const sw = h('button.switch', { type: 'button', class: 'switch' + (settings[key] ? ' on' : ''), 'aria-label': label });
    sw.addEventListener('click', () => {
      settings[key] = !settings[key];
      sw.classList.toggle('on', settings[key]);
      saveSettings();
      sfx.play('click');
      if (onChange) onChange();
    });
    return h('div.toggle-row', null, h('span', null, label, sub ? h('small', null, sub) : null), sw);
  };
  const soundSw = h('button.switch', { type: 'button', class: 'switch' + (sfx.muted ? '' : ' on'), 'aria-label': 'Ton' });
  soundSw.addEventListener('click', () => { sfx.toggle(); soundSw.classList.toggle('on', !sfx.muted); sfx.play('click'); });
  const content = h('div', null,
    h('div.stats-sub', { style: { marginTop: 0 } }, 'Steine'),
    setsEl,
    toggle('highlightFree', 'Freie Steine hervorheben', 'Grüner Rand um alle Steine, die man nehmen kann'),
    toggle('dimBlocked', 'Blockierte Steine abdunkeln', 'So sieht man sofort, was frei ist'),
    h('div.toggle-row', null, h('span', null, 'Ton'), soundSw));
  return showModal({ title: 'Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }] });
}

function showStats() {
  const s = getStats();
  const p = getProgress();
  const rate = s.played ? Math.round((s.won / s.played) * 100) : 0;
  const cell = (v, l) => h('div', null, h('b', null, String(v)), h('span', null, l));
  const content = h('div', null,
    h('div.stats-grid', null,
      cell(s.played, 'Gespielt'), cell(s.won, 'Gewonnen'), cell(rate + ' %', 'Quote'),
      cell(s.streak, 'Siegesserie'), cell(s.bestStreak, 'Beste Serie'), cell(s.pairs, 'Paare')),
    h('div.stats-sub', null, 'Bestzeiten'),
    h('div.stats-grid', null,
      cell(s.best.klein ? fmtTime(s.best.klein) : '–', 'Klein'),
      cell(s.best.mittel ? fmtTime(s.best.mittel) : '–', 'Mittel'),
      cell(s.best.gross ? fmtTime(s.best.gross) : '–', 'Gross')),
    h('div.stats-sub', null, 'Reise & Tagesrätsel'),
    h('div.stats-grid', null,
      cell(`${completedCount(p)}/${layouts.length}`, 'Layouts'),
      cell(`${totalStars(p)}`, 'Sterne ★'),
      cell(dailyStreak(ID), 'Tage-Serie')),
    h('p', { style: { margin: '12px 0 0', fontSize: '13px' } }, `Gesamte Spielzeit: ${fmtTime(s.time)} · Tipps: ${s.hints} · Mischen: ${s.shuffles}`));
  return showModal({ title: 'Statistik', content, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

// ------------------------------------------------------------ Test-Zugriff

window.__mahjong = {
  get session() { return active ? active.session : null; },
  get view() { return active ? active.view : null; },
  route: () => currentRoute,
  /** Bildschirmkoordinaten (Client) der Mitte von Stein i */
  center(i) {
    const v = active.view;
    const c = v.tileCenter(i);
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + c.x, y: r.top + c.y };
  },
  /** Nächstes Paar einer Lösung ab der aktuellen Stellung */
  nextPair() {
    const s = active.session;
    if (s.cert && s.cert.length) return s.cert[0].slice();
    const r = solve(s.board, s.faces, s.present, { maxNodes: 400000 });
    return r.moves.length ? r.moves[0] : null;
  },
  tileWidth: () => (active ? active.view.cam.w : 0),
};

route(true);
