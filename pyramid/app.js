// Pyramide – Paare mit Summe 13 abräumen.
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, icon, toast, showModal, celebrate, setupPage, sleep } from '../shared/ui.js';
import { gameMenu } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { CardTable } from '../lib/cards/table.js';
import { rankOf } from '../lib/cards/deck.js';
import {
  applyCardTheme, clearCardTheme, applyBack, gameTop, toolbar, badge, showSettings, showStatsSheet,
  winContent, fmtTime, Clock,
} from '../lib/cards/shell.js';
import * as R from './logic/rules.js';
import { solve } from './logic/solver.js';
import { findDeal } from './logic/deals.js';
import { ACCENT, MODES, DAILY_MODE, PRAISE, CONFETTI } from './data/config.js';
import { tutorialSteps } from './tutorial.js';

setupPage();

const ID = 'pyramid';
const app = document.getElementById('app');
const K = {
  mode: 'pyramid.mode',
  opts: 'pyramid.opts',
  stats: 'pyramid.stats',
  next: 'pyramid.next',
  save: (slot) => `pyramid.save.${slot}`,
};

const modeById = (id) => MODES.find((m) => m.id === id) || MODES[MODES.length - 1];
let mode = modeById(store.get(K.mode, 'normal')).id;
const opts = { solvable: true, ...store.get(K.opts, {}) };
const saveOpts = () => store.set(K.opts, opts);

const emptyStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTime: null, time: 0 });
const stats = store.get(K.stats, {});
const S = (slot) => (stats[slot] = { ...emptyStats(), ...(stats[slot] || {}) });
const saveStats = () => store.set(K.stats, stats);

const nextNo = (m) => store.get(K.next, {})[m] || 1;
const bumpNo = (m) => store.update(K.next, {}, (o) => ({ ...o, [m]: (o[m] || 1) + 1 }));

let game = null;

// ---------------------------------------------------------------- Spielstände

function loadSave(slot) {
  const s = store.get(K.save(slot), null);
  if (!s || s.v !== 1 || !s.seed) return null;
  if (slot === 'daily' && s.day !== todayKey()) return null;
  try {
    const start = R.newState(R.dealFromSeed(s.seed), s.maxRed);
    const st = R.replay(start, s.moves || []);
    return { ...s, start, st };
  } catch {
    return null;
  }
}

function writeSave(g) {
  store.set(K.save(g.slot), {
    v: 1, slot: g.slot, mode: g.mode, n: g.n, day: g.day, seed: g.seed, maxRed: g.start.maxRed,
    moves: g.moves, ms: Math.round(g.clock ? g.clock.ms : g.ms || 0), counted: g.counted, won: g.won,
  });
}

function makeNew(slot) {
  if (slot === 'daily') {
    const day = todayKey();
    const maxRed = modeById(DAILY_MODE).redeals;
    const d = findDeal({ key: 'daily-' + day, n: 0, maxRed, solvable: true });
    return { v: 1, slot, mode: DAILY_MODE, n: 0, day, seed: d.seed, start: d.state, st: d.state, moves: [], ms: 0, counted: false, won: false, fresh: true };
  }
  const m = modeById(slot);
  const n = nextNo(m.id);
  bumpNo(m.id);
  const d = findDeal({ key: m.id, n, maxRed: m.redeals, solvable: opts.solvable });
  return { v: 1, slot, mode: m.id, n, seed: d.seed, start: d.state, st: d.state, moves: [], ms: 0, counted: false, won: false, fresh: true };
}

function report() {
  const tot = Object.values(stats).reduce((a, s) => a + (s.won || 0), 0);
  const s = loadSave(mode);
  if (s && !s.won && s.moves.length) {
    reportSummary(ID, `Partie ${s.n} läuft · noch ${R.PYR - R.removedCount(s.st)} Karten`);
  } else {
    reportSummary(ID, tot ? `${tot} ${tot === 1 ? 'Pyramide' : 'Pyramiden'} abgeräumt` : 'Noch keine Pyramide abgeräumt');
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

function showTut() {
  return showTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT });
}

// ---------------------------------------------------------------- Menü

function primaryFor() {
  const s = loadSave(mode);
  const m = modeById(mode);
  if (s && !s.won && s.moves.length) {
    return { label: 'Weiterspielen', sub: `Partie ${s.n} · noch ${R.PYR - R.removedCount(s.st)} Karten`, onClick: () => go('play') };
  }
  const n = s && !s.won ? s.n : nextNo(mode);
  return { label: 'Spielen', sub: `Partie ${n} · ${m.label}`, onClick: () => go('play') };
}

function dailyCard() {
  return {
    label: 'Pyramide des Tages',
    done: isDailyDone(ID),
    streak: dailyStreak(ID),
    sub: 'Garantiert lösbar',
    onClick: () => go('daily'),
  };
}

function statsFor(slot = mode) {
  const s = S(slot);
  return [
    { label: 'Gewonnen', value: s.won },
    { label: 'Quote', value: s.played ? Math.round((100 * s.won) / s.played) + ' %' : '–' },
    { label: 'Serie', value: s.streak },
    { label: 'Bestzeit', value: s.bestTime ? fmtTime(s.bestTime) : '–' },
  ];
}

function statRows(slot) {
  const s = S(slot);
  return [
    { label: 'Gespielt', value: s.played },
    { label: 'Gewonnen', value: s.won },
    { label: 'Quote', value: s.played ? Math.round((100 * s.won) / s.played) + ' %' : '–' },
    { label: 'Serie', value: s.streak },
    { label: 'Beste Serie', value: s.bestStreak },
    { label: 'Bestzeit', value: s.bestTime ? fmtTime(s.bestTime) : '–' },
  ];
}

function openStats(cur = mode) {
  return showStatsSheet({
    modes: [...MODES.map((m) => ({ id: m.id, label: m.label })), { id: 'daily', label: 'Tagesrätsel' }],
    current: cur,
    rows: statRows,
    onReset: (slot) => { stats[slot] = emptyStats(); saveStats(); report(); if (!game) showMenu(); },
  });
}

function openSettings(g) {
  return showSettings({
    title: 'Design & Regeln',
    toggles: [{
      label: 'Nur lösbare Partien', sub: 'Jede neue Partie ist garantiert zu schaffen.',
      get: () => opts.solvable, set: (v) => { opts.solvable = v; saveOpts(); },
    }],
    onDesign: () => { applyBack(); if (g) g.retheme(); },
  });
}

async function newGameFromMenu() {
  const s = loadSave(mode);
  if (s && !s.won && s.moves.length) {
    const ok = await showModal({
      title: 'Neue Partie?', text: `Partie ${s.n} ist noch nicht fertig. Sie zählt dann als nicht gewonnen.`,
      buttons: [{ label: 'Neue Partie', value: true, primary: true, icon: 'plus' }, { label: 'Abbrechen', value: false, ghost: true }],
    });
    if (!ok) return;
  }
  abandon(mode);
  go('play');
}

function abandon(slot) {
  const s = store.get(K.save(slot), null);
  if (s && s.counted && !s.won && slot !== 'daily') { S(slot).streak = 0; saveStats(); }
  if (slot !== 'daily') store.remove(K.save(slot));
}

function showMenu() {
  clearCardTheme(app);
  app.className = 'app';
  applyBack();
  const menu = gameMenu({
    id: ID,
    title: 'Pyramide',
    tagline: 'Paare mit Summe 13 abräumen',
    accent: ACCENT,
    primary: primaryFor(),
    daily: dailyCard(),
    modes: {
      label: 'Schwierigkeit', value: mode,
      options: MODES.map((m) => ({ id: m.id, label: m.label, sub: m.sub })),
      onChange(id) { mode = id; store.set(K.mode, id); menu.update({ primary: primaryFor(), stats: statsFor() }); report(); },
    },
    secondary: [
      { label: 'Neu', icon: 'plus', onClick: newGameFromMenu },
      { label: 'Statistik', icon: 'star', onClick: () => openStats() },
      { label: 'Design', icon: 'settings', onClick: () => openSettings(null) },
    ],
    stats: statsFor(),
    onHelp: showTut,
  });
  app.replaceChildren(menu);
  report();
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
    this.sel = null;
    this.busy = false;
    this.stuckShown = false;
  }

  get daily() { return this.slot === 'daily'; }

  async mount() {
    applyCardTheme(app);
    app.className = 'app cards-game pyr-game' + (app.classList.contains('ink-dark') ? ' ink-dark' : '');
    this.top = gameTop({ onBack: () => go(''), onHelp: () => showTut() });
    this.board = h('div.pyr-board');
    this.coachEl = h('div.cg-coach.hide');
    const tb = toolbar([
      { id: 'new', icon: 'refresh', label: 'Neu', onClick: () => this.askNew() },
      { id: 'hint', icon: 'hint', label: 'Tipp', onClick: () => this.hint() },
      { id: 'undo', icon: 'undo', label: 'Zurück', onClick: () => this.undo() },
      { id: 'set', icon: 'settings', label: 'Design', onClick: () => openSettings(this) },
    ]);
    this.tools = tb.btn;
    app.replaceChildren(this.top.el, this.board, tb.el);
    this.table = new CardTable(this.board, {
      onTap: (id) => this.tapCard(id),
      onSlot: (name) => this.tapSlot(name),
      onBg: () => this.deselect(),
      canDrag: (id) => this.dragRef(id) != null,
      canDrop: (id, t) => this.dropOk(id, t),
      onDrop: (id, t) => this.drop(id, t),
      onResize: () => this.relayout(),
    });
    this.table.slot('stock', { cls: 'pyr-stock' });
    this.table.slot('waste', { cls: 'pyr-waste' });
    this.table.slot('done', { cls: 'pyr-done', html: '<span class="pslot-l">13</span>' });
    this.badge = this.table.add(badge());
    this.table.add(this.coachEl);
    this.exposeTestApi();

    if (!tutorialSeen(ID)) {
      await maybeShowTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT });
      if (this.dead) return;
    }

    let s = loadSave(this.slot);
    if (s && s.won && !this.daily) s = null;
    if (!s) {
      await sleep(30);
      s = makeNew(this.slot);
    }
    Object.assign(this, s);
    this.clock = new Clock(this.ms || 0);
    this.recount();
    this.table.build([...this.start.pyr, ...this.start.stock]);
    this.layout();
    this.updateHud();
    this.updateBadge();
    writeSave(this);
    if (this.fresh) await this.dealAnim();
    else this.table.set(this.targets());
    if (this.dead) return;
    this.timer = setInterval(() => this.updateHud(), 1000);
    this.onHide = () => { if (document.hidden) writeSave(this); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    if (this.won) { this.table.set(this.targets()); this.showWon(true); return; }
    if (this.moves.length) this.clock.start();
    this.updateCoach();
    this.checkStuck();
  }

  destroy() {
    this.dead = true;
    if (this.clock) { this.ms = this.clock.ms; if (this.start) writeSave(this); this.clock.destroy(); }
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    if (this.table) this.table.destroy();
  }

  retheme() {
    applyCardTheme(app);
  }

  // ------------------------------------------------------------ Geometrie

  layout() {
    const t = this.table;
    const W = t.width, H = t.height;
    const pad = Math.max(6, Math.round(W * 0.02));
    const gap = Math.max(3, Math.round(W * 0.011));
    let cw = Math.floor((W - 2 * pad - 6 * gap) / 7);
    const needF = 6 * 0.54 + 1 + 0.35 + 1 + 0.2;
    cw = Math.max(24, Math.min(cw, Math.floor((H - 16) / needF / 1.4), 104));
    const ch = Math.round(cw * 1.4);
    t.setSize(cw, ch);
    const bottomY = H - ch - Math.max(8, Math.round(ch * 0.14));
    const avail = bottomY - Math.max(10, Math.round(ch * 0.3));
    let step = Math.round(ch * 0.54);
    step = Math.min(Math.round(ch * 0.64), Math.max(step, Math.floor((avail - ch - 12) / 6)));
    const pyrH = 6 * step + ch;
    const topY = Math.max(6, Math.round((avail - pyrH) * 0.45));
    const rowW = 7 * cw + 6 * gap;
    const left = Math.round((W - rowW) / 2);
    this.g = { W, H, cw, ch, gap, step, topY, bottomY, left, stockX: left, wasteX: left + cw + 2 * gap + Math.round(cw * 0.25), doneX: left + rowW - cw };
    t.placeSlot('stock', this.g.stockX, bottomY);
    t.placeSlot('waste', this.g.wasteX, bottomY);
    t.placeSlot('done', this.g.doneX, bottomY);
  }

  relayout() {
    if (!this.g || this.dead) return;
    this.layout();
    this.table.set(this.targets());
    this.updateBadge();
    if (this.table.coachTarget) this.table.coach(this.table.coachTarget);
  }

  pyrPos(i) {
    const g = this.g;
    const r = R.rowOf(i), c = R.colOf(i);
    const rowW = (r + 1) * g.cw + r * g.gap;
    return { x: Math.round(g.W / 2 - rowW / 2 + c * (g.cw + g.gap)), y: g.topY + r * g.step };
  }

  /** Reihenfolge der abgeräumten Karten (für den Ablagestapel rechts). */
  recount() {
    const order = [];
    let st = this.start;
    for (const m of this.moves) {
      if (m.t === 'rm') {
        for (const r of m.b == null ? [m.a] : [m.a, m.b]) order.push(r === R.WASTE ? R.PYR + R.wasteTop(st) : r);
      }
      st = R.apply(st, m);
    }
    this.st = st;
    this.done = order;
  }

  targets() {
    const st = this.st, g = this.g;
    const T = new Array(52);
    for (let i = 0; i < R.PYR; i++) {
      if (R.isRemoved(st, i)) continue;
      const p = this.pyrPos(i);
      T[i] = { x: p.x, y: p.y, z: 100 + i, up: true, dim: !R.isFree(st, i) };
    }
    const wt = R.wasteTop(st);
    const waste = [];
    for (let j = 0; j < st.ptr; j++) if (!(st.sm & (1 << j))) waste.push(j);
    waste.forEach((j, k) => {
      const depth = waste.length - 1 - k;
      T[R.PYR + j] = { x: g.wasteX, y: g.bottomY, z: 300 + k, up: true, b: j !== wt, hide: depth > 2 };
    });
    const stock = [];
    for (let j = st.ptr; j < R.STOCK; j++) if (!(st.sm & (1 << j))) stock.push(j);
    stock.forEach((j, k) => {
      const fromTop = k;
      const off = Math.min(3, stock.length - 1 - k) * 0.6;
      T[R.PYR + j] = { x: g.stockX - off, y: g.bottomY - off, z: 260 - k, up: false, b: fromTop > 0, hide: fromTop > 3 };
    });
    this.done.forEach((id, k) => {
      const depth = this.done.length - 1 - k;
      const jr = ((id * 37) % 9) - 4, jx = ((id * 13) % 5) - 2, jy = ((id * 7) % 5) - 2;
      T[id] = { x: g.doneX + jx, y: g.bottomY + jy, z: 400 + k, up: true, rot: jr * 1.4, b: depth > 1, hide: depth > 3 };
    });
    return T;
  }

  updateBadge() {
    const n = R.stockCount(this.st);
    const g = this.g;
    this.badge.textContent = n;
    this.badge.classList.toggle('off', n === 0);
    this.badge.style.transform = `translate(${Math.round(g.stockX + g.cw - 14)}px, ${Math.round(g.bottomY - 9)}px)`;
    const left = this.st.maxRed - this.st.red;
    const stock = this.table.slots.get('stock');
    const html = n > 0 ? '' : left > 0
      ? `<div class="pyr-redeal">${icon('refresh', { size: 22 })}<span>${left}×</span></div>`
      : '<span class="pslot-l">leer</span>';
    if (stock._html !== html) { stock.innerHTML = html; stock._html = html; }
    stock.classList.toggle('can', n === 0 && left > 0);
  }

  updateHud() {
    if (this.dead) return;
    this.top.setTitle(this.daily ? 'Pyramide des Tages' : `Partie ${this.n}`);
    const left = this.st.maxRed - this.st.red;
    this.top.setInfo([
      { text: this.daily ? 'Normal' : modeById(this.mode).label },
      { text: fmtTime(this.clock ? this.clock.ms : 0), id: 'time' },
      { text: `${R.PYR - R.removedCount(this.st)} übrig`, id: 'left' },
      { text: `↻ ${left}×`, id: 'red' },
    ]);
  }

  async dealAnim() {
    const g = this.g;
    const T0 = new Array(52);
    for (let id = 0; id < 52; id++) T0[id] = { x: g.stockX, y: g.bottomY, z: 50 + (51 - id), up: false, hide: id > 31 };
    this.table.set(T0);
    this.table.locked = true;
    await sleep(120);
    const order = [];
    for (let i = 0; i < R.PYR; i++) order.push(i);
    await this.table.move(this.targets(), { stagger: 34, order, dur: 380, arc: 18 });
    this.table.locked = false;
  }

  // ------------------------------------------------------------ Eingabe

  /** Karten-ID -> Referenz (0..27 Pyramide, 28 Ablage) oder null, wenn nicht spielbar */
  refOf(id) {
    if (id < R.PYR) return R.isRemoved(this.st, id) ? null : id;
    const j = id - R.PYR;
    if (this.st.sm & (1 << j)) return null;
    if (j === R.wasteTop(this.st)) return R.WASTE;
    return null;
  }

  idOf(ref) { return ref === R.WASTE ? R.PYR + R.wasteTop(this.st) : ref; }

  isStockCard(id) {
    if (id < R.PYR) return false;
    const j = id - R.PYR;
    return j >= this.st.ptr && !(this.st.sm & (1 << j));
  }

  dragRef(id) {
    if (this.busy || this.won) return null;
    const ref = this.refOf(id);
    if (ref == null || !R.isFreeRef(this.st, ref)) return null;
    if (rankOf(R.codeOf(this.st, ref)) === 13) return null;
    return ref;
  }

  dropOk(id, t) {
    const a = this.dragRef(id);
    if (a == null || !t || t.card == null) return false;
    const b = this.refOf(t.card);
    return b != null && R.canRemove(this.st, a, b);
  }

  drop(id, t) {
    if (!this.dropOk(id, t)) return false;
    const a = this.dragRef(id), b = this.refOf(t.card);
    this.deselect();
    this.play({ t: 'rm', a, b });
    return true;
  }

  deselect() {
    this.sel = null;
    this.table.select(null);
  }

  tapCard(id) {
    if (this.busy || this.won) return;
    if (this.isStockCard(id)) { this.draw(); return; }
    const ref = this.refOf(id);
    if (ref == null) { this.deselect(); return; }
    if (!R.isFreeRef(this.st, ref)) {
      this.table.shake(id);
      if (!this.coveredTold) { this.coveredTold = true; toast('Diese Karte ist noch bedeckt'); }
      return;
    }
    const r = rankOf(R.codeOf(this.st, ref));
    if (r === 13) { this.deselect(); this.play({ t: 'rm', a: ref }); return; }
    if (this.sel == null) { this.sel = ref; this.table.select(id); return; }
    if (this.sel === ref) { this.deselect(); return; }
    if (R.canRemove(this.st, this.sel, ref)) {
      const a = this.sel;
      this.deselect();
      this.play({ t: 'rm', a, b: ref });
      return;
    }
    // passt nicht: Auswahl wechseln
    this.table.shake(this.idOf(this.sel));
    this.sel = ref;
    this.table.select(id);
  }

  tapSlot(name) {
    if (this.busy || this.won) return;
    if (name === 'stock') this.draw();
    else this.deselect();
  }

  draw() {
    this.deselect();
    if (R.canDraw(this.st)) this.play({ t: 'draw' });
    else if (R.canRedeal(this.st)) this.play({ t: 'redeal' });
    else if (R.stockCount(this.st) === 0) toast(this.st.maxRed > 0 ? 'Kein Neuauslegen mehr übrig' : 'Der Talon ist leer');
  }

  async play(m) {
    if (!R.isLegal(this.st, m)) return;
    const before = this.st;
    if (m.t === 'rm') {
      for (const r of m.b == null ? [m.a] : [m.a, m.b]) this.done.push(r === R.WASTE ? R.PYR + R.wasteTop(before) : r);
    }
    this.st = R.apply(before, m);
    this.moves.push(m);
    if (!this.counted) {
      this.counted = true;
      S(this.slot).played++;
      saveStats();
    }
    this.clock.start();
    this.table.coach(null);
    this.coachEl.classList.add('hide');
    this.coachDone = true;
    this.stuckShown = false;
    if (m.t === 'rm') {
      sfx.play('pop');
      const ids = this.done.slice(m.b == null ? -1 : -2);
      this.busy = true;
      const p = this.table.move(this.targets(), { order: ids, stagger: 60, arc: 26, lift: 0.1 });
      this.updateBadge();
      this.updateHud();
      writeSave(this);
      await p;
      this.busy = false;
    } else {
      if (m.t === 'redeal') sfx.play('whoosh');
      this.table.move(this.targets(), m.t === 'redeal' ? { stagger: 14, dur: 300 } : { dur: 260 });
      this.updateBadge();
      this.updateHud();
      writeSave(this);
    }
    if (this.dead) return;
    if (R.isWon(this.st)) { this.onWin(); return; }
    this.checkStuck();
  }

  async undo() {
    if (this.busy || this.won || !this.moves.length) {
      if (!this.moves.length && !this.won) toast('Noch kein Zug gemacht');
      return;
    }
    this.deselect();
    this.moves.pop();
    this.recount();
    this.stuckShown = false;
    this.table.move(this.targets(), { dur: 260 });
    this.updateBadge();
    this.updateHud();
    writeSave(this);
  }

  async askNew() {
    if (this.busy) return;
    if (this.daily) {
      const v = await showModal({
        title: 'Nochmals von vorn?', text: 'Die Pyramide des Tages wird neu ausgelegt.',
        buttons: [{ label: 'Neu beginnen', value: true, primary: true, icon: 'refresh' }, { label: 'Abbrechen', value: false, ghost: true }],
      });
      if (v) this.restart();
      return;
    }
    const v = await showModal({
      title: 'Neu beginnen?',
      text: this.moves.length && !this.won ? 'Diese Partie nochmals von vorn oder eine neue Partie?' : 'Eine neue Partie auslegen?',
      buttons: [
        { label: 'Neue Partie', value: 'new', primary: true, icon: 'plus' },
        ...(this.moves.length ? [{ label: 'Diese Partie neu starten', value: 'restart', icon: 'refresh' }] : []),
        { label: 'Abbrechen', value: null, ghost: true },
      ],
    });
    if (v === 'new') { abandon(this.slot); this.replaceWith(); }
    else if (v === 'restart') this.restart();
  }

  replaceWith() {
    this.destroy();
    game = null;
    openGame(this.slot);
  }

  async restart() {
    this.deselect();
    this.moves = [];
    this.recount();
    this.won = false;
    this.stuckShown = false;
    this.busy = true;
    await this.table.move(this.targets(), { stagger: 10, dur: 360 });
    this.busy = false;
    this.updateBadge();
    this.updateHud();
    writeSave(this);
  }

  async hint() {
    if (this.busy || this.won) return;
    this.deselect();
    const r = solve(this.st, { maxNodes: 60000 });
    let m = r.solved ? r.moves[0] : null;
    if (!m) {
      if (!r.aborted) toast('So geht es nicht mehr auf – «Zurück» hilft.');
      const legal = R.legalMoves(this.st);
      m = legal.find((x) => x.t === 'rm') || legal[0];
    }
    if (!m) { this.showStuck(); return; }
    if (m.t === 'rm') this.table.hint([m.a, m.b].filter((x) => x != null).map((x) => this.idOf(x)));
    else {
      const ids = [];
      for (let j = this.st.ptr; j < R.STOCK; j++) if (!(this.st.sm & (1 << j))) { ids.push(R.PYR + j); break; }
      this.table.hint(ids.length ? ids : [{ slot: 'stock' }]);
    }
  }

  // ------------------------------------------------------------ Coach, Ende

  updateCoach() {
    if (this.coachDone || this.moves.length || Object.values(stats).some((x) => x.played > 0) || this.daily) return;
    const legal = R.legalMoves(this.st);
    const m = legal.find((x) => x.t === 'rm' && x.b != null && x.b !== R.WASTE) || legal.find((x) => x.t === 'rm');
    const g = this.g;
    const below = g.topY + 6 * g.step + g.ch;
    this.coachEl.style.top = (g.bottomY - below > 64 ? Math.round((below + g.bottomY) / 2 - 24) : 4) + 'px';
    if (m) {
      this.table.coach({ card: this.idOf(m.a) });
      const a = rankOf(R.codeOf(this.st, m.a));
      this.coachEl.textContent = m.b == null ? 'Ein König geht allein – tippe ihn an.' : `Tippe zwei freie Karten mit Summe 13 an – z.B. diese ${a === 1 ? 'Ass' : a > 10 ? ['Bube', 'Dame'][a - 11] : a}.`;
    } else {
      this.table.coach({ slot: 'stock' });
      this.coachEl.textContent = 'Kein Paar frei? Tippe auf den Talon.';
    }
    this.coachEl.classList.remove('hide');
  }

  checkStuck() {
    if (this.won || this.stuckShown) return;
    if (R.legalMoves(this.st).length) return;
    this.stuckShown = true;
    setTimeout(() => { if (!this.dead && !this.won && !R.legalMoves(this.st).length) this.showStuck(); }, 700);
  }

  async showStuck() {
    const left = R.PYR - R.removedCount(this.st);
    const v = await showModal({
      title: 'Keine Züge mehr',
      text: `Noch ${left} ${left === 1 ? 'Karte' : 'Karten'} in der Pyramide. Ein paar Züge zurück – oder neu beginnen?`,
      buttons: [
        { label: 'Zug zurück', value: 'undo', primary: true, icon: 'undo' },
        { label: 'Nochmals von vorn', value: 'restart', icon: 'refresh' },
        ...(this.daily ? [] : [{ label: 'Neue Partie', value: 'new', icon: 'plus' }]),
      ],
    });
    if (this.dead) return;
    if (v === 'undo') this.undo();
    else if (v === 'restart') this.restart();
    else if (v === 'new') { abandon(this.slot); this.replaceWith(); }
  }

  async onWin() {
    this.won = true;
    this.clock.stop();
    this.ms = this.clock.ms;
    const s = S(this.slot);
    s.won++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const newBest = !s.bestTime || this.ms < s.bestTime;
    if (newBest) s.bestTime = Math.round(this.ms);
    s.time += Math.round(this.ms);
    saveStats();
    if (this.daily) markDailyDone(ID, this.day);
    writeSave(this);
    report();
    this.newBest = newBest && s.won > 1;
    this.busy = true;
    await this.table.idle();
    await sleep(250);
    if (this.dead) return;
    sfx.play('complete');
    this.table.fan(this.done.slice(-26));
    await sleep(700);
    celebrate(CONFETTI);
    await sleep(900);
    if (this.dead) return;
    this.busy = false;
    this.showWon(false);
  }

  async showWon(again) {
    const st = this.st;
    const badges = [];
    if (st.red === 0) badges.push('Ohne Neuauslegen');
    if (this.newBest) badges.push('Neue Bestzeit');
    const lastK = this.done.slice(-5).map((id) => (id < R.PYR ? this.start.pyr[id] : this.start.stock[id - R.PYR]));
    const content = winContent({
      cards: lastK,
      sub: this.daily ? 'Pyramide des Tages geschafft' : `Partie ${this.n} · ${modeById(this.mode).label}`,
      badges,
      stats: [
        { label: 'Zeit', value: fmtTime(this.ms) },
        { label: 'Züge', value: this.moves.length },
        this.daily ? { label: 'Tage in Folge', value: dailyStreak(ID) } : { label: 'Serie', value: S(this.slot).streak },
      ],
    });
    const buttons = this.daily
      ? [{ label: 'Zum Menü', value: 'menu', primary: true, icon: 'home' }, { label: 'Normale Partie spielen', value: 'play', ghost: true }]
      : [{ label: 'Nächste Partie', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
    const v = await showModal({ title: again ? 'Schon geschafft!' : PRAISE[Math.floor(Math.random() * PRAISE.length)], content, buttons, dismissible: false });
    if (this.dead) return;
    if (v === 'next') { store.remove(K.save(this.slot)); this.replaceWith(); }
    else if (v === 'play') go('play');
    else go('');
  }

  // ------------------------------------------------------------ Test-Zugang

  exposeTestApi() {
    window.__pyramid = {
      get game() { return game; },
      get state() { return game && game.st; },
      isWon: () => !!(game && R.isWon(game.st)),
      idle: () => (game ? game.table.idle() : Promise.resolve()),
      solution: () => solve(game.st, { maxNodes: 400000 }),
      play: (m) => game.play(m),
      rect: (id) => {
        const c = game.table.cards[id];
        const r = c.el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 16), w: r.width, h: r.height };
      },
      idOf: (ref) => game.idOf(ref),
    };
  }
}

window.addEventListener('hashchange', route);
route();
