// Golf-Patience – sieben Reihen, eins höher oder tiefer, Runden mit neun Löchern und Par.
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, showModal, celebrate, setupPage, sleep } from '../shared/ui.js';
import { gameMenu } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { CardTable } from '../lib/cards/table.js';
import { rankOf, rankLabel } from '../lib/cards/deck.js';
import {
  applyCardTheme, clearCardTheme, applyBack, gameTop, toolbar, badge, showSettings, showStatsSheet,
  winContent, floatText,
} from '../lib/cards/shell.js';
import * as R from './logic/rules.js';
import { clearPath, fairPlay } from './logic/solver.js';
import { findHole } from './logic/deals.js';
import { ACCENT, MODES, HOLES, DAILY_MODE, CONFETTI, roundTitle } from './data/config.js';
import { tutorialSteps } from './tutorial.js';

setupPage();

const ID = 'golf';
const app = document.getElementById('app');
const K = {
  mode: 'golf.mode',
  opts: 'golf.opts',
  stats: 'golf.stats',
  next: 'golf.next',
  save: (slot) => `golf.save.${slot}`,
};
const NT = R.COLS * R.DEPTH;       // 35 Karten in den Reihen
const WASTE0 = NT;                  // ID der ersten Ablagekarte
const SID = (j) => NT + 1 + j;      // ID der Talonkarte j
const CID = (c, k) => c * R.DEPTH + k;

const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
let mode = modeById(store.get(K.mode, 'leicht')).id;
const opts = { solvable: true, ...store.get(K.opts, {}) };
const saveOpts = () => store.set(K.opts, opts);

const emptyStats = () => ({ rounds: 0, holes: 0, cleared: 0, birdies: 0, strokes: 0, parSum: 0, bestRound: null, played: 0 });
const stats = store.get(K.stats, {});
const S = (slot) => (stats[slot] = { ...emptyStats(), ...(stats[slot] || {}) });
const saveStats = () => store.set(K.stats, stats);

const nextNo = (m) => store.get(K.next, {})[m] || 1;
const bumpNo = (m) => store.update(K.next, {}, (o) => ({ ...o, [m]: (o[m] || 1) + 1 }));

const sum = (a) => a.reduce((x, y) => x + y, 0);
let game = null;

// ---------------------------------------------------------------- Spielstände

function loadSave(slot) {
  const s = store.get(K.save(slot), null);
  if (!s || s.v !== 1 || !s.seed) return null;
  if (slot === 'daily' && s.day !== todayKey()) return null;
  try {
    const start = R.newState(R.dealFromSeed(s.seed), s.wrap);
    const st = R.replay(start, s.moves || []);
    return { ...s, start, st };
  } catch {
    return null;
  }
}

function writeSave(g) {
  store.set(K.save(g.slot), {
    v: 1, slot: g.slot, mode: g.mode, round: g.round, hole: g.hole, results: g.results, pars: g.pars,
    day: g.day, seed: g.seed, wrap: g.start.wrap, moves: g.moves, counted: g.counted, over: g.over, done: g.done,
  });
}

/** Neues Loch (oder neue Runde) erzeugen */
function makeHole(slot, prev = null) {
  if (slot === 'daily') {
    const m = modeById(DAILY_MODE);
    const day = todayKey();
    const d = findHole({ key: 'daily-' + day, round: 0, hole: 1, wrap: m.wrap, solvable: true });
    return { slot, mode: m.id, round: 0, hole: 1, results: [], pars: [d.par], day, seed: d.seed, start: d.state, st: d.state, moves: [], counted: false, over: false, done: false, fresh: true };
  }
  const m = modeById(slot);
  let round, hole, results, pars;
  if (prev && !prev.done && prev.hole < HOLES) {
    round = prev.round; hole = prev.hole + 1; results = prev.results.slice(); pars = prev.pars.slice();
  } else {
    round = nextNo(m.id); bumpNo(m.id); hole = 1; results = []; pars = [];
  }
  const d = findHole({ key: m.id, round, hole, wrap: m.wrap, solvable: opts.solvable });
  pars[hole - 1] = d.par;
  return { slot, mode: m.id, round, hole, results, pars, seed: d.seed, start: d.state, st: d.state, moves: [], counted: false, over: false, done: false, fresh: true };
}

function diffOf(results, pars) {
  return sum(results) - sum(pars.slice(0, results.length));
}

function report() {
  const s = loadSave(mode);
  if (s && !s.done && (s.moves.length || s.results.length)) {
    reportSummary(ID, `Runde ${s.round} · Loch ${s.hole} von ${HOLES} · ${R.fmtDiff(diffOf(s.results, s.pars))}`);
  } else {
    const st = S(mode);
    reportSummary(ID, st.rounds ? `${st.rounds} ${st.rounds === 1 ? 'Runde' : 'Runden'} · beste ${R.fmtDiff(st.bestRound)}` : 'Noch keine Runde gespielt');
  }
}

// ---------------------------------------------------------------- Routing

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (game) { game.destroy(); game = null; }
  if (hash === 'play') openGame(mode);
  else if (hash === 'daily') openGame('daily');
  else showMenu();
}

function go(hash) {
  if (location.hash.replace(/^#/, '') === hash) route();
  else location.hash = hash;
}

const showTut = () => showTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT });

// ---------------------------------------------------------------- Menü

function primaryFor() {
  const s = loadSave(mode);
  if (s && !s.done && (s.moves.length || s.results.length)) {
    const hole = s.over ? s.hole + 1 : s.hole;
    return { label: 'Weiterspielen', sub: `Runde ${s.round} · Loch ${Math.min(hole, HOLES)} von ${HOLES} · ${R.fmtDiff(diffOf(s.results, s.pars))}`, onClick: () => go('play') };
  }
  const n = s && !s.done ? s.round : nextNo(mode);
  return { label: 'Spielen', sub: `Runde ${n} · ${HOLES} Löcher · ${modeById(mode).label}`, onClick: () => go('play') };
}

function dailyCard() {
  const s = loadSave('daily');
  return {
    label: 'Loch des Tages',
    done: isDailyDone(ID),
    streak: dailyStreak(ID),
    sub: s ? `Par ${s.pars[0]}` : 'Garantiert abräumbar',
    onClick: () => go('daily'),
  };
}

function statsFor(slot = mode) {
  const s = S(slot);
  return [
    { label: 'Runden', value: s.rounds },
    { label: 'Beste Runde', value: s.bestRound == null ? '–' : R.fmtDiff(s.bestRound) },
    { label: 'Abgeräumt', value: s.cleared },
    { label: 'Birdies', value: s.birdies },
  ];
}

function statRows(slot) {
  const s = S(slot);
  return [
    { label: 'Runden', value: s.rounds },
    { label: 'Löcher', value: s.holes },
    { label: 'Abgeräumt', value: s.cleared },
    { label: 'Birdies & besser', value: s.birdies },
    { label: 'Beste Runde', value: s.bestRound == null ? '–' : R.fmtDiff(s.bestRound) },
    { label: 'Ø zum Par', value: s.holes ? R.fmtDiff(Math.round(((s.strokes - s.parSum) / s.holes) * 10) / 10).replace('.', ',') : '–' },
  ];
}

function openStats(cur = mode) {
  return showStatsSheet({
    modes: [...MODES.map((m) => ({ id: m.id, label: m.label })), { id: 'daily', label: 'Tagesloch' }],
    current: cur,
    rows: statRows,
    onReset: (slot) => { stats[slot] = emptyStats(); saveStats(); report(); if (!game) showMenu(); },
  });
}

function openSettings(g) {
  return showSettings({
    title: 'Design & Regeln',
    toggles: [{
      label: 'Nur abräumbare Löcher', sub: 'Jedes neue Loch lässt sich ganz abräumen.',
      get: () => opts.solvable, set: (v) => { opts.solvable = v; saveOpts(); },
    }],
    onDesign: () => { applyBack(); if (g) g.retheme(); },
  });
}

async function newRoundFromMenu() {
  const s = loadSave(mode);
  if (s && !s.done && (s.moves.length || s.results.length)) {
    const ok = await showModal({
      title: 'Neue Runde?', text: `Runde ${s.round} ist erst bei Loch ${s.hole} – sie wird abgebrochen.`,
      buttons: [{ label: 'Neue Runde', value: true, primary: true, icon: 'plus' }, { label: 'Abbrechen', value: false, ghost: true }],
    });
    if (!ok) return;
  }
  store.remove(K.save(mode));
  go('play');
}

function showMenu() {
  clearCardTheme(app);
  app.className = 'app';
  applyBack();
  const menu = gameMenu({
    id: ID,
    title: 'Golf-Patience',
    tagline: 'Sieben Reihen, eins höher oder tiefer',
    accent: ACCENT,
    primary: primaryFor(),
    daily: dailyCard(),
    modes: {
      label: 'Modus', value: mode,
      options: MODES.map((m) => ({ id: m.id, label: m.label, sub: m.sub })),
      onChange(id) { mode = id; store.set(K.mode, id); menu.update({ primary: primaryFor(), stats: statsFor() }); report(); },
    },
    secondary: [
      { label: 'Neu', icon: 'plus', onClick: newRoundFromMenu },
      { label: 'Statistik', icon: 'star', onClick: () => openStats() },
      { label: 'Design', icon: 'settings', onClick: () => openSettings(null) },
    ],
    stats: statsFor(),
    onHelp: showTut,
  });
  app.replaceChildren(menu);
  report();
}

// ---------------------------------------------------------------- Scorekarte

function scorecard(results, pars, current) {
  const el = h('div.golf-card');
  for (let i = 0; i < HOLES; i++) {
    const done = i < results.length;
    const d = done ? results[i] - pars[i] : 0;
    const cls = done ? (d < 0 ? '.u' : d === 0 ? '.p' : '.o') : i === current - 1 ? '.cur' : '';
    el.append(h('div.golf-cell' + cls, null, h('small', null, String(i + 1)),
      h('b', null, done ? String(results[i]).replace('-', '−') : i === current - 1 ? '⛳' : '')));
  }
  return el;
}

// ---------------------------------------------------------------- Spiel

async function openGame(slot) {
  const g = new Game(slot);
  game = g;
  await g.mount();
}

class Game {
  constructor(slot) {
    this.slot = slot;
    this.dead = false;
    this.busy = false;
    this.stuckShown = false;
  }

  get daily() { return this.slot === 'daily'; }
  get par() { return this.pars[this.hole - 1]; }

  async mount() {
    applyCardTheme(app);
    app.classList.add('golf-game');
    this.top = gameTop({ onBack: () => go(''), onHelp: () => showTut() });
    this.board = h('div.golf-board');
    this.coachEl = h('div.cg-coach.hide');
    this.restEl = h('div.golf-rest', null, h('b', null, '35'), h('small', null, 'übrig'));
    this.cardEl = h('div.golf-strip');
    const tb = toolbar([
      { id: 'new', icon: 'refresh', label: 'Neu', onClick: () => this.askNew() },
      { id: 'hint', icon: 'hint', label: 'Tipp', onClick: () => this.hint() },
      { id: 'undo', icon: 'undo', label: 'Zurück', onClick: () => this.undo() },
      { id: 'set', icon: 'settings', label: 'Design', onClick: () => openSettings(this) },
    ]);
    app.replaceChildren(this.top.el, this.board, tb.el);
    this.table = new CardTable(this.board, {
      onTap: (id) => this.tapCard(id),
      onSlot: (name) => { if (name === 'stock') this.draw(); },
      canDrag: (id) => this.colOf(id) != null && !this.busy && !this.over,
      canDrop: (id, t) => this.isWasteTarget(t) && R.canPlay(this.st, this.colOf(id)),
      onDrop: (id, t) => {
        const c = this.colOf(id);
        if (c == null || !this.isWasteTarget(t) || !R.canPlay(this.st, c)) return false;
        this.play({ t: 'play', c });
        return true;
      },
      onResize: () => this.relayout(),
    });
    this.table.slot('stock', { cls: 'golf-stock', html: '<span class="pslot-l">leer</span>' });
    this.table.slot('waste');
    this.badge = this.table.add(badge());
    this.table.add(this.restEl);
    this.table.add(this.cardEl);
    this.table.add(this.coachEl);
    this.exposeTestApi();

    if (!tutorialSeen(ID)) {
      await maybeShowTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT });
      if (this.dead) return;
    }

    let s = loadSave(this.slot);
    if (!s) { await sleep(30); s = makeHole(this.slot); }
    else if (!this.daily && s.done) { await sleep(30); s = makeHole(this.slot); }
    else if (!this.daily && s.over) { await sleep(30); s = makeHole(this.slot, s); }
    this.load(s);
    writeSave(this);
    if (this.fresh) await this.dealAnim();
    else this.table.set(this.targets());
    if (this.dead) return;
    this.onHide = () => { if (document.hidden) writeSave(this); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    if (this.over) { this.showHoleEnd(true); return; }
    this.updateCoach();
    this.checkEnd();
  }

  load(s) {
    Object.assign(this, s);
    this.recount();
    this.table.build([...this.start.cols.flat(), this.start.start, ...this.start.stock]);
    this.layout();
    this.updateHud();
  }

  destroy() {
    this.dead = true;
    if (this.start) writeSave(this);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    if (this.table) this.table.destroy();
  }

  retheme() { applyCardTheme(app); }

  colOf(id) {
    if (id >= NT) return null;
    const c = Math.floor(id / R.DEPTH), k = id % R.DEPTH;
    return k === this.st.h[c] - 1 ? c : null;
  }

  isWasteTarget(t) {
    if (!t) return false;
    if (t.slot === 'waste') return true;
    return t.card != null && t.card === this.pile[this.pile.length - 1];
  }

  // ------------------------------------------------------------ Geometrie

  layout() {
    const t = this.table;
    const W = t.width, H = t.height;
    const pad = Math.max(6, Math.round(W * 0.02));
    const gap = Math.max(3, Math.round(W * 0.012));
    let cw = Math.floor((W - 2 * pad - 6 * gap) / 7);
    const stripH = this.daily ? 0 : 46;
    cw = Math.max(24, Math.min(cw, Math.floor((H - stripH - 40) / 4.9 / 1.4), 100));
    const ch = Math.round(cw * 1.4);
    t.setSize(cw, ch);
    const rowW = 7 * cw + 6 * gap;
    const left = Math.round((W - rowW) / 2);
    const bottomY = H - ch - Math.max(10, Math.round(ch * 0.2));
    const y0 = stripH + Math.max(8, Math.round(ch * 0.12));
    const avail = bottomY - Math.round(ch * 0.45) - y0;
    const step = Math.round(Math.max(ch * 0.34, Math.min(ch * 0.56, (avail - ch) / 4)));
    const colsH = 4 * step + ch;
    const top = y0 + Math.max(0, Math.round((avail - colsH) * 0.45));
    const wasteX = Math.round(W / 2 - cw / 2 + cw * 0.15);
    const stockRight = wasteX - Math.round(cw * 0.45) - cw;
    const dx = Math.max(2, Math.min(cw * 0.18, (stockRight - pad) / 15));
    this.g = { W, H, cw, ch, gap, left, bottomY, step, top, wasteX, stockRight, dx, stripH };
    t.placeSlot('waste', wasteX, bottomY);
    t.placeSlot('stock', stockRight, bottomY);
    this.restEl.style.left = Math.round(wasteX + cw + (W - wasteX - cw) / 2) + 'px';
    this.restEl.style.top = Math.round(bottomY + ch / 2) + 'px';
    this.cardEl.style.display = this.daily ? 'none' : '';
  }

  relayout() {
    if (!this.g || this.dead) return;
    this.layout();
    this.table.set(this.targets());
    this.updateBadge();
    if (this.table.coachTarget) this.table.coach(this.table.coachTarget);
  }

  recount() {
    const pile = [WASTE0];
    let st = this.start;
    for (const m of this.moves) {
      pile.push(m.t === 'play' ? CID(m.c, st.h[m.c] - 1) : SID(st.ptr));
      st = R.apply(st, m);
    }
    this.st = st;
    this.pile = pile;
  }

  targets() {
    const st = this.st, g = this.g;
    const T = new Array(52);
    for (let c = 0; c < R.COLS; c++) {
      for (let k = 0; k < st.h[c]; k++) {
        T[CID(c, k)] = { x: g.left + c * (g.cw + g.gap), y: g.top + k * g.step, z: 100 + k, up: true, dim: k < st.h[c] - 1 };
      }
    }
    this.pile.forEach((id, k) => {
      const depth = this.pile.length - 1 - k;
      T[id] = { x: g.wasteX, y: g.bottomY, z: 300 + k, up: true, b: depth > 0, hide: depth > 2 };
    });
    for (let j = st.ptr; j < R.STOCK; j++) {
      const k = j - st.ptr;
      T[SID(j)] = { x: Math.round(g.stockRight - k * g.dx), y: g.bottomY, z: 260 - k, up: false, b: k > 0 };
    }
    return T;
  }

  updateBadge() {
    const n = R.stockCount(this.st);
    const g = this.g;
    this.badge.textContent = n;
    this.badge.classList.toggle('off', n === 0);
    this.badge.style.transform = `translate(${Math.round(g.stockRight + g.cw - 14)}px, ${Math.round(g.bottomY - 9)}px)`;
  }

  updateHud() {
    if (this.dead) return;
    const st = this.st;
    this.top.setTitle(this.daily ? 'Loch des Tages' : `Loch ${this.hole} von ${HOLES}`);
    const parts = [{ text: `Par ${this.par}`, id: 'par' }];
    if (!this.daily) {
      parts.push({ text: `Runde ${this.round}` });
      if (this.results.length) parts.push({ text: `Gesamt ${R.fmtDiff(diffOf(this.results, this.pars))}`, id: 'total' });
    } else parts.push({ text: modeById(this.mode).label });
    this.top.setInfo(parts);
    const left = R.tableauCount(st);
    this.restEl.firstChild.textContent = R.isCleared(st) ? String(-R.stockCount(st)).replace('-', '−') : left;
    this.restEl.lastChild.textContent = R.isCleared(st) ? 'Schläge' : 'übrig';
    this.restEl.classList.toggle('under', R.holeScore(st) <= this.par);
    if (!this.daily) this.cardEl.replaceChildren(scorecard(this.results, this.pars, this.hole));
  }

  async dealAnim() {
    const g = this.g;
    const T0 = new Array(52);
    for (let id = 0; id < 52; id++) T0[id] = { x: g.stockRight, y: g.bottomY, z: 50 + (51 - id), up: false, hide: id > 38 && id !== WASTE0 };
    this.table.set(T0);
    this.table.locked = true;
    await sleep(100);
    const order = [];
    for (let k = 0; k < R.DEPTH; k++) for (let c = 0; c < R.COLS; c++) order.push(CID(c, k));
    order.push(WASTE0);
    await this.table.move(this.targets(), { stagger: 22, order, dur: 340, arc: 14 });
    this.table.locked = false;
    this.updateBadge();
  }

  // ------------------------------------------------------------ Züge

  tapCard(id) {
    if (this.busy || this.over) return;
    if (id > WASTE0) { if (id - NT - 1 >= this.st.ptr) this.draw(); return; }
    if (id === WASTE0) return;
    const c = this.colOf(id);
    if (c == null) {
      const cc = Math.floor(id / R.DEPTH);
      if (id % R.DEPTH < this.st.h[cc]) { this.table.shake(id); if (!this.coveredTold) { this.coveredTold = true; toast('Nur die unterste Karte einer Reihe ist frei'); } }
      return;
    }
    if (!R.canPlay(this.st, c)) {
      this.table.shake(id);
      if (!this.noFitTold) { this.noFitTold = true; toast(`Passt nicht – gesucht: ${this.neighbours(rankOf(this.st.top))}`); }
      return;
    }
    this.play({ t: 'play', c });
  }

  neighbours(r) {
    const w = this.st.wrap;
    const lo = r === 1 ? (w ? 13 : null) : r - 1;
    const hi = r === 13 ? (w ? 1 : null) : r + 1;
    return [lo, hi].filter((x) => x != null).map(rankLabel).join(' oder ');
  }

  draw() {
    if (this.busy || this.over) return;
    if (!R.canDraw(this.st)) { toast('Der Talon ist leer'); return; }
    this.play({ t: 'draw' });
  }

  async play(m) {
    if (this.over || !R.isLegal(this.st, m)) return;
    const before = this.st;
    const id = m.t === 'play' ? CID(m.c, before.h[m.c] - 1) : SID(before.ptr);
    this.pile.push(id);
    this.st = R.apply(before, m);
    this.moves.push(m);
    if (!this.counted) { this.counted = true; S(this.slot).played++; saveStats(); }
    this.table.coach(null);
    this.coachEl.classList.add('hide');
    this.coachDone = true;
    this.stuckShown = false;
    this.table.hint(null);
    if (m.t === 'play') {
      sfx.play('place');
      if (this.st.h[m.c] === 0) {
        const g = this.g;
        floatText(this.table, 'Reihe frei!', g.left + m.c * (g.cw + g.gap) + g.cw / 2, g.top + g.ch * 0.4);
      }
    }
    this.busy = m.t === 'play';
    const p = this.table.move(this.targets(), m.t === 'play' ? { order: [id], arc: 26, lift: 0.08 } : { dur: 280 });
    this.updateBadge();
    this.updateHud();
    writeSave(this);
    await p;
    this.busy = false;
    if (this.dead) return;
    this.checkEnd();
  }

  undo() {
    if (this.busy || this.over) return;
    if (!this.moves.length) { toast('Noch kein Zug gemacht'); return; }
    this.moves.pop();
    this.recount();
    this.stuckShown = false;
    this.table.hint(null);
    this.table.move(this.targets(), { dur: 260 });
    this.updateBadge();
    this.updateHud();
    writeSave(this);
  }

  async askNew() {
    if (this.busy) return;
    const v = await showModal({
      title: 'Neu beginnen?',
      text: this.daily ? 'Das Loch des Tages wird neu ausgeteilt.' : `Loch ${this.hole} nochmals von vorn – oder eine ganz neue Runde?`,
      buttons: [
        { label: 'Dieses Loch neu starten', value: 'restart', primary: true, icon: 'refresh' },
        ...(this.daily ? [] : [{ label: 'Neue Runde', value: 'round', icon: 'plus' }]),
        { label: 'Abbrechen', value: null, ghost: true },
      ],
    });
    if (v === 'restart') this.restart();
    else if (v === 'round') { store.remove(K.save(this.slot)); this.reopen(); }
  }

  reopen() {
    this.destroy();
    game = null;
    openGame(this.slot);
  }

  async restart() {
    this.moves = [];
    this.recount();
    this.over = false;
    this.stuckShown = false;
    this.busy = true;
    await this.table.move(this.targets(), { stagger: 8, dur: 360 });
    this.busy = false;
    this.updateBadge();
    this.updateHud();
    writeSave(this);
  }

  hint() {
    if (this.busy || this.over) return;
    const r = clearPath(this.st, { maxNodes: 60000 });
    let m = r.cleared ? r.moves[0] : fairPlay(this.st).moves[0];
    if (!m) m = R.legalMoves(this.st)[0];
    if (!m) return;
    if (m.t === 'play') this.table.hint([CID(m.c, this.st.h[m.c] - 1)]);
    else this.table.hint([SID(this.st.ptr)]);
  }

  // ------------------------------------------------------------ Coach, Lochende

  updateCoach() {
    if (this.coachDone || this.moves.length || Object.values(stats).some((x) => x.played > 0) || this.daily) return;
    const pl = R.playable(this.st);
    const g = this.g;
    const colsBottom = g.top + 4 * g.step + g.ch;
    this.coachEl.style.top = Math.round(Math.max(4, (colsBottom + g.bottomY) / 2 - 34)) + 'px';
    const top = rankLabel(rankOf(this.st.top));
    if (pl.length) {
      this.table.coach({ card: CID(pl[0], this.st.h[pl[0]] - 1) });
      this.coachEl.textContent = `Auf die ${top} passt ${this.neighbours(rankOf(this.st.top))} – tippe die unterste Karte an.`;
    } else {
      this.table.coach({ card: SID(this.st.ptr) });
      this.coachEl.textContent = `Nichts passt auf die ${top}? Tippe auf den Talon.`;
    }
    this.coachEl.classList.remove('hide');
  }

  checkEnd() {
    if (this.over) return;
    if (R.isCleared(this.st)) { this.endHole(); return; }
    if (R.legalMoves(this.st).length || this.stuckShown) return;
    this.stuckShown = true;
    setTimeout(async () => {
      if (this.dead || this.over || R.legalMoves(this.st).length) return;
      const n = R.tableauCount(this.st);
      const v = await showModal({
        title: 'Keine Züge mehr',
        text: `${n} ${n === 1 ? 'Karte bleibt' : 'Karten bleiben'} liegen – das sind ${n} Schläge (Par ${this.par}).`,
        buttons: [
          { label: 'Loch beenden', value: 'end', primary: true, icon: 'check' },
          { label: 'Zug zurück', value: 'undo', icon: 'undo' },
        ],
      });
      if (this.dead) return;
      if (v === 'undo') this.undo();
      else if (v === 'end') this.endHole();
      else this.stuckShown = false;
    }, 600);
  }

  async endHole() {
    if (this.over) return;
    this.over = true;
    const st = this.st;
    const score = R.holeScore(st);
    const cleared = R.isCleared(st);
    this.results[this.hole - 1] = score;
    const s = S(this.slot);
    s.holes++;
    s.strokes += score;
    s.parSum += this.par;
    if (cleared) s.cleared++;
    if (score - this.par <= -1) s.birdies++;
    if (!this.daily && this.hole === HOLES) {
      this.done = true;
      s.rounds++;
      const d = diffOf(this.results, this.pars);
      this.newBest = s.bestRound == null || d < s.bestRound;
      if (this.newBest) s.bestRound = d;
    }
    saveStats();
    if (this.daily && cleared) markDailyDone(ID, this.day);
    writeSave(this);
    report();
    this.updateHud();
    this.busy = true;
    await this.table.idle();
    if (this.dead) return;
    if (cleared) {
      await sleep(250);
      sfx.play('complete');
      this.table.fan(this.pile.slice(-24));
      await sleep(650);
      celebrate(CONFETTI);
      await sleep(900);
    } else {
      await sleep(300);
    }
    if (this.dead) return;
    this.busy = false;
    this.showHoleEnd(false);
  }

  async showHoleEnd(again) {
    const st = this.st;
    const score = this.results[this.hole - 1] ?? R.holeScore(st);
    const diff = score - this.par;
    const cleared = R.isCleared(st);
    const name = R.scoreName(diff);
    const badges = [];
    if (cleared) badges.push(R.stockCount(st) ? `Abgeräumt · ${R.stockCount(st)} im Talon` : 'Abgeräumt');
    const content = winContent({
      cards: cleared ? this.pile.slice(-5).map((id) => this.table.cards[id].code) : [],
      sub: this.daily ? `Loch des Tages · ${modeById(this.mode).label}` : `Runde ${this.round} · Loch ${this.hole} von ${HOLES}`,
      badges,
      stats: [
        { label: 'Schläge', value: String(score).replace('-', '−') },
        { label: 'Par', value: this.par },
        this.daily ? { label: 'Tage in Folge', value: dailyStreak(ID) } : { label: 'Gesamt', value: R.fmtDiff(diffOf(this.results, this.pars)) },
      ],
      note: this.daily && !cleared ? 'Räume alle Karten ab, um das Loch des Tages zu schaffen.' : null,
    });
    if (!this.daily) content.append(scorecard(this.results, this.pars, 0));
    let buttons;
    if (this.daily) {
      buttons = cleared
        ? [{ label: 'Zum Menü', value: 'menu', primary: true, icon: 'home' }, { label: 'Runde spielen', value: 'play', ghost: true }]
        : [{ label: 'Nochmals versuchen', value: 'restart', primary: true, icon: 'refresh' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
    } else if (this.hole < HOLES) {
      buttons = [{ label: `Weiter zu Loch ${this.hole + 1}`, value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
    } else {
      buttons = [{ label: 'Runde auswerten', value: 'summary', primary: true, icon: 'star' }];
    }
    const title = diff <= 0 ? `${name}!` : name;
    const v = await showModal({ title, content, buttons, dismissible: false });
    if (this.dead) return;
    if (v === 'next') this.nextHole();
    else if (v === 'summary') this.showRound();
    else if (v === 'restart') { this.over = false; this.restart(); }
    else if (v === 'play') go('play');
    else go('');
  }

  async nextHole() {
    const prev = { round: this.round, hole: this.hole, results: this.results, pars: this.pars, done: this.done };
    this.busy = true;
    await sleep(20);
    const s = makeHole(this.slot, prev);
    if (this.dead) return;
    this.table.coach(null);
    this.load(s);
    writeSave(this);
    this.busy = false;
    await this.dealAnim();
  }

  async showRound() {
    const d = diffOf(this.results, this.pars);
    if (d <= 0) { sfx.play('sparkle'); celebrate(CONFETTI); }
    const content = winContent({
      sub: `Runde ${this.round} · ${modeById(this.mode).label}`,
      badges: this.newBest && S(this.slot).rounds > 1 ? ['Neue Bestleistung'] : [],
      stats: [
        { label: 'Schläge', value: String(sum(this.results)).replace('-', '−') },
        { label: 'Par', value: sum(this.pars) },
        { label: 'Ergebnis', value: R.fmtDiff(d) },
      ],
    });
    content.append(scorecard(this.results, this.pars, 0));
    const v = await showModal({
      title: roundTitle(d), content, dismissible: false,
      buttons: [{ label: 'Neue Runde', value: 'new', primary: true, icon: 'plus' }, { label: 'Zum Menü', value: 'menu', ghost: true }],
    });
    if (this.dead) return;
    store.remove(K.save(this.slot));
    if (v === 'new') this.reopen();
    else go('');
  }

  // ------------------------------------------------------------ Test-Zugang

  exposeTestApi() {
    window.__golf = {
      get game() { return game; },
      get state() { return game && game.st; },
      idle: () => (game ? game.table.idle() : Promise.resolve()),
      solution: () => clearPath(game.st, { maxNodes: 2e6 }),
      fair: () => fairPlay(game.st),
      legal: () => R.legalMoves(game.st),
      play: (m) => game.play(m),
      stockId: () => SID(game.st.ptr),
      bottomId: (c) => CID(c, game.st.h[c] - 1),
      finishHole: () => game.endHole(),
      rect: (id) => {
        const r = game.table.cards[id].el.getBoundingClientRect();
        return { x: r.left + r.width * 0.4, y: r.top + Math.min(r.height * 0.3, 20), w: r.width, h: r.height };
      },
    };
  }
}

window.addEventListener('hashchange', route);
route();
