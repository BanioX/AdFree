// Mahjong – Oberfläche: Menü, Reise, Spielfläche, Tagesrätsel, Statistik, Einstellungen.

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { makeRng } from '../shared/rng.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import { layouts } from './data/layouts.js';
import { tilesets, tilesetById } from './data/tilesets.js';
import { parseLayout, generateLayoutDef, sizeClass, solve } from './engine.js';
import { Session } from './game.js';
import { BoardView, drawMiniLayout } from './board.js';

setupPage();

const ID = 'mahjong';
const K = {
  settings: 'mahjong.settings',
  progress: 'mahjong.progress',
  stats: 'mahjong.stats',
  cur: 'mahjong.cur',
  daily: 'mahjong.daily',
  seen: 'mahjong.seenHelp',
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

function dailyDef(date = todayKey()) {
  const rng = makeRng('mahjong-tag-' + date);
  if (rng.next() < 0.3) {
    const def = generateLayoutDef('tag-' + date, rng.chance(0.5) ? 'mittel' : 'gross');
    return { ...def, name: 'Tagesform' };
  }
  const pool = layouts.filter((l) => parsedLayout(l).tiles.length >= 64);
  return rng.pick(pool);
}

// ------------------------------------------------------------ Navigation

let screen = null;
let currentRoute = null;
let pendingFresh = false;

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
  if (!store.get(K.seen, false)) {
    store.set(K.seen, true);
    setTimeout(() => showHelp(), 350);
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

// ------------------------------------------------------------ Menü

function tileCanvas(setId, face, w) { return BoardView.tileImage(setId, face, w); }

function showMenu() {
  const progress = getProgress();
  const cur = loadCur();
  const set = tilesetById(settings.tileset);

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

  const nextIdx = nextLevelIndex(progress);
  let playLabel, playSub;
  if (cur) {
    playLabel = 'Weiter';
    playSub = `${cur.layout.name || 'Spiel'} · ${Math.round(cur.progress * 100)} % abgeräumt`;
  } else {
    playLabel = 'Spielen';
    playSub = `Level ${nextIdx + 1}: ${layouts[nextIdx].name}`;
  }
  const playBtn = h('button.play-btn', { type: 'button' },
    h('b', { html: icon('play', { size: 22 }) + playLabel }),
    h('small', null, playSub));
  playBtn.addEventListener('click', () => {
    sfx.play('tap');
    if (cur) go('spiel');
    else startLevel(nextIdx);
  });

  const hero = h('div.hero', null, fan, playBtn);

  const done = completedCount(progress);
  const stars = totalStars(progress);
  const journeyCard = h('button.mcard', { type: 'button' },
    h('div.ic', { style: { background: '#fde9e1' } }, '🗺️'),
    h('div.tx', null, h('b', null, 'Reise'), h('span', null, `${done} von ${layouts.length} Layouts · ★ ${stars}/${layouts.length * 3}`)),
    h('div.chev', { html: icon('back', { size: 20 }).replace('<svg', '<svg style="transform:scaleX(-1)"') }));
  journeyCard.addEventListener('click', () => { sfx.play('tap'); go('reise'); });

  const dDone = isDailyDone(ID);
  const streak = dailyStreak(ID);
  const dDef = dailyDef();
  const dailyCard = h('button.mcard', { type: 'button' },
    calendarIcon(),
    h('div.tx', null,
      h('b', null, 'Tagesrätsel', dDone ? h('span.done-badge', { html: icon('check', { size: 14, stroke: 3 }) }) : null),
      h('span', null, dDone
        ? `Heute gelöst${streak > 1 ? ` · ${streak} Tage in Folge` : ''}`
        : `Heute: ${dDef.name} · ${parseLayout(dDef).tiles.length} Steine${streak > 0 ? ` · Serie ${streak}` : ''}`)),
    h('div.chev', { html: icon('back', { size: 20 }).replace('<svg', '<svg style="transform:scaleX(-1)"') }));
  dailyCard.addEventListener('click', () => { sfx.play('tap'); go('daily'); });

  const chips = h('div.size-chips');
  for (const [size, label] of [['klein', 'Klein'], ['mittel', 'Mittel'], ['gross', 'Gross']]) {
    const c = h('button.chip', { type: 'button' }, label);
    c.addEventListener('click', (e) => { e.stopPropagation(); sfx.play('tap'); startEndless(size); });
    chips.append(c);
  }
  const endlessCard = h('div.mcard.endless', null,
    h('div.ic', { style: { background: '#e3f3ee' } }, '🎲'),
    h('div.tx', null, h('b', null, 'Zufallsspiel'), h('span', null, 'Neue Form, neue Steine – endlos')),
    chips);

  const statsBtn = h('button.btn', { type: 'button', html: icon('star', { size: 20 }) + 'Statistik' });
  statsBtn.addEventListener('click', () => { sfx.play('click'); showStats(); });
  const helpBtn = h('button.btn', { type: 'button', html: icon('hint', { size: 20 }) + 'So geht’s' });
  helpBtn.addEventListener('click', () => { sfx.play('click'); showHelp(); });

  const el = h('div.screen.menu-screen', null,
    h('div.topbar', null,
      backButton('../'),
      h('div.title', null, 'Mahjong'),
      h('div.right', null, iconBtn('settings', () => showSettings(() => showMenuRefresh()), 'Einstellungen'), soundButton())),
    h('div.scroll', null,
      h('div.menu', null, hero,
        h('div.cards', null, journeyCard, dailyCard, endlessCard),
        h('div.menu-row', null, statsBtn, helpBtn))));
  mount(el, {});
  updateSummary();
}

function showMenuRefresh() { if (currentRoute === '') showMenu(); }

function calendarIcon() {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return h('div.ic.cal', null, h('i', null, months[d.getMonth()]), h('b', null, String(d.getDate())));
}

// ------------------------------------------------------------ Reise

function showJourney() {
  const progress = getProgress();
  const done = completedCount(progress);
  const stars = totalStars(progress);
  const nextIdx = nextLevelIndex(progress);
  const grid = h('div.levels');
  const minis = [];
  layouts.forEach((def, idx) => {
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
    grid.append(btn);
  });
  const pct = Math.round((done / layouts.length) * 100);
  const el = h('div.screen', null,
    h('div.topbar', null,
      backButton('./', () => { sfx.play('click'); goBackToMenu(); }),
      h('div.title', null, 'Reise'),
      h('span.chip', { html: icon('star', { size: 16 }) + `<span>${stars}/${layouts.length * 3}</span>`, style: { color: '#b77905' } })),
    h('div.scroll', null,
      h('div.journey', null,
        h('div.journey-head', null, h('span', null, `${done}/${layouts.length}`), h('div.bar', null, h('i', { style: { width: pct + '%' } })), h('span', null, `${pct} %`)),
        grid)));
  mount(el, {});
  requestAnimationFrame(() => {
    for (const [cv, L, won, unlocked] of minis) drawMiniLayout(cv, L.tiles, { color: won ? '#2f8a73' : unlocked ? '#c0573e' : '#a89c90', done: won });
    const cur = grid.querySelector('.lv.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

// ------------------------------------------------------------ Spiele starten

async function confirmReplace() {
  const cur = loadCur();
  if (!cur || cur.history.length === 0) return true;
  const ok = await confirmDialog('Laufendes Spiel beenden?',
    `«${cur.layout.name}» ist zu ${Math.round(cur.progress * 100)} % abgeräumt. Ein neues Spiel ersetzt es.`,
    'Neues Spiel', 'Abbrechen');
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
    const ses = Session.create(parseLayout(def), { kind: 'daily', ref: def.id, seed: 'mahjong-' + date, name: 'Tagesrätsel', date, form: def.name });
    store.set(K.daily, { date, save: ses.serialize() });
    countStart();
    return ses;
  };
  if (!s) { s = create(); fresh = true; }
  if (s.won) {
    // Schon gelöst: hübsche Ansicht + Wahl
    mount(h('div.screen'), {});
    const v = await showModal({
      title: 'Heute schon gelöst ✓',
      html: `<p>Das Tagesrätsel von heute hast du geschafft${dailyStreak(ID) > 1 ? ` – ${dailyStreak(ID)} Tage in Folge` : ''}. Morgen gibt's ein neues!</p>`,
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
  let tipCount = store.get(K.hints, 0);

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
    const b = h('button.tool', { type: 'button', class: 'tool ' + cls }, h('span.ib', { html: icon(ic) }), h('span', null, label));
    b.addEventListener('click', () => { if (!busy) fn(); });
    return b;
  };
  const undoBtn = tool('undo', 'undo', 'Zurück', doUndo);
  const hintBtn = tool('hint', 'hint', 'Tipp', doHint);
  const shuffleBtn = tool('shuffle', 'shuffle', 'Mischen', () => doShuffle());
  const moreBtn = tool('more', 'more', 'Mehr', showMore);

  const el = h('div.screen.game', null,
    h('div.topbar', null,
      backButton('./', () => { sfx.play('click'); leave(); }),
      h('div.title', null, nameEl, subEl),
      iconBtn('settings', () => showSettings(() => { view.setOptions(settings); }), 'Einstellungen')),
    h('div.progress', null, progI),
    wrap,
    h('div.toolbar', null, undoBtn, hintBtn, shuffleBtn, moreBtn));

  let timer = 0;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    if (!session.won && !busy && document.visibilityState === 'visible') session.elapsed += Math.min(5, (now - last) / 1000);
    last = now;
    renderHud();
  };
  let saveCounter = 0;

  mount(el, {
    destroy() {
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
    onZoomChange: (z) => fitBtn.classList.toggle('show', z),
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
    view.animateEntry().then(() => { busy = false; });
  }
  if (!session.won && !session.hasMoves()) setTimeout(() => showNoMoves(), 500);

  function leave() {
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
      await anim;
      handleWin();
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
    if (session.won || deadWarned || session.remaining > 60) return;
    const r = solve(session.board, session.faces, session.present, { maxNodes: 2500 });
    if (r.result === 'unsolvable') {
      deadWarned = true;
      shuffleBtn.classList.add('pulse');
      toast('So geht es nicht mehr ganz auf – Mischen oder Zurück hilft');
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
          { label: 'Zurück', value: 'undo', primary: true, icon: 'undo' },
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
    if (session.won) return;
    shuffleBtn.classList.add('pulse');
    const v = await showModal({
      title: 'Keine Paare mehr frei',
      text: 'Gerade passt kein freies Paar zusammen. Mischen verteilt die übrigen Steine neu – garantiert lösbar und gratis.',
      buttons: [
        { label: 'Mischen', value: 'shuffle', primary: true, icon: 'shuffle' },
        { label: 'Zurück', value: 'undo', icon: 'undo' },
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

  async function handleWin() {
    tick();
    clearInterval(timer);
    const res = recordWin(session);
    persist();
    if (slot === 'cur') store.remove(K.cur);
    updateSummary();
    view.winBurst();
    sfx.play('complete');
    celebrate(CONFETTI);
    await sleep(1100);
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
  const set = tilesetById(settings.tileset);
  const demo = h('div.demo');
  const faces = set.kind === 'drawn' ? [4, 13, 4] : [3, 12, 3];
  faces.forEach((f, k) => {
    const c = tileCanvas(set.id, f, 44);
    if (k === 1) c.style.filter = 'brightness(.78)';
    demo.append(c);
  });
  const groups = h('div.groups');
  set.bonusNames.forEach((name, g) => {
    const row = h('div.row');
    for (let k = 0; k < 4; k++) row.append(tileCanvas(set.id, 34 + g * 4 + k, 26));
    groups.append(h('div', null, row, name));
  });
  const content = h('div.help', null,
    h('p', null, 'Tippe zwei gleiche Steine an – sie verschwinden. Räume so das ganze Brett ab.'),
    demo,
    h('div.demo-cap', null, 'Aussen frei · in der Mitte blockiert'),
    h('ul', null,
      h('li', null, h('b', null, 'Frei'), ' ist ein Stein, wenn nichts auf ihm liegt und links ', h('i', null, 'oder'), ' rechts Platz ist.'),
      h('li', null, 'Die Steine mit farbigem Rand bilden Gruppen: Jeder passt zu jedem aus seiner Gruppe.'),
      h('li', null, 'Hilfe ist gratis: ', h('b', null, 'Tipp'), ', ', h('b', null, 'Mischen'), ' und ', h('b', null, 'Zurück'), '. Grosse Bretter mit zwei Fingern zoomen.'),
      h('li', null, '★★★ gibt es ohne Tipp und Mischen.')),
    groups);
  return showModal({ title: 'So geht’s', content, buttons: [{ label: 'Los geht’s', value: true, primary: true }] });
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
    const r = solve(s.board, s.faces, s.present, { maxNodes: 400000 });
    return r.moves.length ? r.moves[0] : null;
  },
  tileWidth: () => (active ? active.view.cam.w : 0),
};

route(true);
