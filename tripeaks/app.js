// Gipfel – TriPeaks: Karten eins höher oder tiefer ablegen, Serien sammeln, drei Gipfel abräumen.
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, showModal, celebrate, setupPage, sleep } from '../shared/ui.js';
import { gameMenu } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { CardTable } from '../lib/cards/table.js';
import { rankOf, rankLabel } from '../lib/cards/deck.js';
import {
  applyCardTheme, clearCardTheme, applyBack, gameTop, toolbar, badge, showSettings, showStatsSheet,
  winContent, fmtNum, floatText,
} from '../lib/cards/shell.js';
import * as R from './logic/rules.js';
import { solve } from './logic/solver.js';
import { findDeal } from './logic/deals.js';
import { ACCENT, MODES, DAILY_MODE, PRAISE, CONFETTI, STREAK_WORDS } from './data/config.js';
import { tutorialSteps } from './tutorial.js';

setupPage();

const ID = 'tripeaks';
const app = document.getElementById('app');
const K = {
  mode: 'tripeaks.mode',
  opts: 'tripeaks.opts',
  stats: 'tripeaks.stats',
  next: 'tripeaks.next',
  save: (slot) => `tripeaks.save.${slot}`,
};
const WASTE0 = R.TAB;            // ID der ersten Ablagekarte
const SID = (j) => R.TAB + 1 + j; // ID der Talonkarte j

const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
let mode = modeById(store.get(K.mode, 'leicht')).id;
const opts = { solvable: true, ...store.get(K.opts, {}) };
const saveOpts = () => store.set(K.opts, opts);

const emptyStats = () => ({ played: 0, won: 0, points: 0, bestScore: 0, bestStreak: 0, winStreak: 0 });
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
    const start = R.newState(R.dealFromSeed(s.seed), s.wrap);
    const st = R.replay(start, s.moves || []);
    return { ...s, start, st };
  } catch {
    return null;
  }
}

function writeSave(g) {
  store.set(K.save(g.slot), {
    v: 1, slot: g.slot, mode: g.mode, n: g.n, day: g.day, seed: g.seed, wrap: g.start.wrap,
    moves: g.moves, counted: g.counted, over: g.over, won: g.won,
  });
}

function makeNew(slot) {
  if (slot === 'daily') {
    const day = todayKey();
    const m = modeById(DAILY_MODE);
    const d = findDeal({ key: 'daily-' + day, n: 0, wrap: m.wrap, solvable: true });
    return { slot, mode: m.id, n: 0, day, seed: d.seed, start: d.state, st: d.state, moves: [], counted: false, over: false, won: false, fresh: true };
  }
  const m = modeById(slot);
  const n = nextNo(m.id);
  bumpNo(m.id);
  const d = findDeal({ key: m.id, n, wrap: m.wrap, solvable: opts.solvable });
  return { slot, mode: m.id, n, seed: d.seed, start: d.state, st: d.state, moves: [], counted: false, over: false, won: false, fresh: true };
}

function report() {
  const s = loadSave(mode);
  const tot = Object.values(stats).reduce((a, x) => a + (x.points || 0), 0);
  if (s && !s.over && s.moves.length) reportSummary(ID, `Runde ${s.n} läuft · ${fmtNum(s.st.score)} Punkte`);
  else reportSummary(ID, tot ? `${fmtNum(tot)} Punkte gesammelt` : 'Noch keine Runde gespielt');
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
  const m = modeById(mode);
  if (s && !s.over && s.moves.length) {
    return { label: 'Weiterspielen', sub: `Runde ${s.n} · ${fmtNum(s.st.score)} Punkte`, onClick: () => go('play') };
  }
  const n = s && !s.over ? s.n : nextNo(mode);
  return { label: 'Spielen', sub: `Runde ${n} · ${m.label}`, onClick: () => go('play') };
}

function dailyCard() {
  const s = loadSave('daily');
  return {
    label: 'Gipfel des Tages',
    done: isDailyDone(ID),
    streak: dailyStreak(ID),
    sub: s && s.won ? `${fmtNum(s.st.score)} Punkte` : 'Garantiert lösbar',
    onClick: () => go('daily'),
  };
}

function statsFor(slot = mode) {
  const s = S(slot);
  return [
    { label: 'Punkte', value: fmtNum(s.points) },
    { label: 'Beste Runde', value: fmtNum(s.bestScore) },
    { label: 'Gelöst', value: s.won },
    { label: 'Längste Serie', value: s.bestStreak },
  ];
}

function statRows(slot) {
  const s = S(slot);
  return [
    { label: 'Runden', value: s.played },
    { label: 'Gelöst', value: s.won },
    { label: 'Quote', value: s.played ? Math.round((100 * s.won) / s.played) + ' %' : '–' },
    { label: 'Punkte total', value: fmtNum(s.points) },
    { label: 'Beste Runde', value: fmtNum(s.bestScore) },
    { label: 'Längste Serie', value: s.bestStreak },
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
      label: 'Nur lösbare Runden', sub: 'Jede neue Runde lässt sich ganz abräumen.',
      get: () => opts.solvable, set: (v) => { opts.solvable = v; saveOpts(); },
    }],
    onDesign: () => { applyBack(); if (g) g.retheme(); },
  });
}

/** Runde beenden und Punkte gutschreiben (nur einmal) */
function bank(slot, st, won) {
  const s = S(slot);
  s.points += st.score;
  s.bestScore = Math.max(s.bestScore, st.score);
  s.bestStreak = Math.max(s.bestStreak, st.best);
  if (won) { s.won++; s.winStreak++; } else s.winStreak = 0;
  saveStats();
}

async function newGameFromMenu() {
  const s = loadSave(mode);
  if (s && !s.over && s.moves.length) {
    const ok = await showModal({
      title: 'Neue Runde?', text: `Runde ${s.n} wird beendet – die ${fmtNum(s.st.score)} Punkte werden gutgeschrieben.`,
      buttons: [{ label: 'Neue Runde', value: true, primary: true, icon: 'plus' }, { label: 'Abbrechen', value: false, ghost: true }],
    });
    if (!ok) return;
    if (s.counted) bank(mode, s.st, false);
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
    title: 'Gipfel',
    tagline: 'Karten eins höher oder tiefer',
    accent: ACCENT,
    primary: primaryFor(),
    daily: dailyCard(),
    modes: {
      label: 'Modus', value: mode,
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
    this.busy = false;
    this.stuckShown = false;
  }

  get daily() { return this.slot === 'daily'; }

  async mount() {
    applyCardTheme(app);
    app.classList.add('tp-game');
    this.top = gameTop({ onBack: () => go(''), onHelp: () => showTut() });
    this.board = h('div.tp-board');
    this.coachEl = h('div.cg-coach.hide');
    this.streakEl = h('div.tp-streak', null, h('b', null, '0'), h('small', null, 'Serie'));
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
      canDrag: (id) => id < R.TAB && R.isFree(this.st, id) && !this.busy && !this.over,
      canDrop: (id, t) => this.isWasteTarget(t) && R.canPlay(this.st, id),
      onDrop: (id, t) => {
        if (!this.isWasteTarget(t) || !R.canPlay(this.st, id)) return false;
        this.play({ t: 'play', i: id });
        return true;
      },
      onResize: () => this.relayout(),
    });
    this.table.slot('stock', { cls: 'tp-stock', html: '<span class="pslot-l">leer</span>' });
    this.table.slot('waste');
    this.badge = this.table.add(badge());
    this.table.add(this.streakEl);
    this.table.add(this.coachEl);
    this.exposeTestApi();

    if (!tutorialSeen(ID)) {
      await maybeShowTutorial({ id: ID, steps: tutorialSteps, accent: ACCENT });
      if (this.dead) return;
    }

    let s = loadSave(this.slot);
    if (s && s.over && !this.daily) s = null;
    if (!s) { await sleep(30); s = makeNew(this.slot); }
    Object.assign(this, s);
    this.recount();
    this.table.build([...this.start.tab, this.start.start, ...this.start.stock]);
    this.layout();
    this.updateHud(false);
    writeSave(this);
    if (this.fresh) await this.dealAnim();
    else this.table.set(this.targets());
    if (this.dead) return;
    this.onHide = () => { if (document.hidden) writeSave(this); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    if (this.over) { this.showEnd(true); return; }
    this.updateCoach();
    this.checkStuck();
  }

  destroy() {
    this.dead = true;
    if (this.start) writeSave(this);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    if (this.table) this.table.destroy();
  }

  retheme() { applyCardTheme(app); }

  isWasteTarget(t) {
    if (!t) return false;
    if (t.slot === 'waste') return true;
    return t.card != null && t.card === this.pile[this.pile.length - 1];
  }

  // ------------------------------------------------------------ Geometrie

  layout() {
    const t = this.table;
    const W = t.width, H = t.height;
    const pad = Math.max(5, Math.round(W * 0.015));
    const f = 0.8; // horizontaler Abstand in Kartenbreiten (leichte Überlappung)
    let cw = Math.floor((W - 2 * pad) / (9 * f + 1));
    cw = Math.max(24, Math.min(cw, Math.floor((H - 30) / 5.4 / 1.4), 92));
    const ch = Math.round(cw * 1.4);
    t.setSize(cw, ch);
    const stepX = cw * f;
    const left = Math.round((W - (9 * stepX + cw)) / 2);
    const bottomY = H - ch - Math.max(10, Math.round(ch * 0.2));
    const v = Math.round(ch * 0.5);
    const peaksH = 3 * v + ch;
    const topY = Math.max(10, Math.round((bottomY - ch * 0.9 - peaksH) * 0.5));
    const wasteX = Math.round(W / 2 - cw / 2 + cw * 0.15);
    const stockRight = wasteX - Math.round(cw * 0.45) - cw;
    const dx = Math.max(2, Math.min(cw * 0.16, (stockRight - pad) / 22));
    this.g = { W, H, cw, ch, stepX, left, bottomY, v, topY, wasteX, stockRight, dx, pad };
    t.placeSlot('waste', wasteX, bottomY);
    t.placeSlot('stock', stockRight, bottomY);
    const se = this.streakEl;
    se.style.left = Math.round(wasteX + cw + (W - wasteX - cw) / 2) + 'px';
    se.style.top = Math.round(bottomY + ch / 2) + 'px';
  }

  relayout() {
    if (!this.g || this.dead) return;
    this.layout();
    this.table.set(this.targets());
    this.updateBadge();
    if (this.table.coachTarget) this.table.coach(this.table.coachTarget);
  }

  /** Ablagestapel (IDs in Reihenfolge) aus den Zügen ableiten */
  recount() {
    const pile = [WASTE0];
    let st = this.start;
    for (const m of this.moves) {
      pile.push(m.t === 'play' ? m.i : SID(st.ptr));
      st = R.apply(st, m);
    }
    this.st = st;
    this.pile = pile;
  }

  targets() {
    const st = this.st, g = this.g;
    const T = new Array(52);
    for (let i = 0; i < R.TAB; i++) {
      if (R.isRemoved(st, i)) continue;
      T[i] = { x: Math.round(g.left + R.XPOS[i] * g.stepX), y: g.topY + R.ROW[i] * g.v, z: 100 + i, up: R.isFree(st, i) };
    }
    this.pile.forEach((id, k) => {
      const depth = this.pile.length - 1 - k;
      T[id] = { x: g.wasteX, y: g.bottomY, z: 300 + k, up: true, b: depth > 0, hide: depth > 2 };
    });
    for (let j = st.ptr; j < R.STOCK; j++) {
      const k = j - st.ptr; // 0 = nächste Karte (rechts oben)
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

  updateHud(animate = true) {
    if (this.dead) return;
    const st = this.st;
    this.top.setTitle(this.daily ? 'Gipfel des Tages' : `Runde ${this.n}`);
    this.top.setInfo([
      { text: modeById(this.mode).label },
      { text: `${fmtNum(st.score)} Punkte`, id: 'score' },
      { text: `${R.TAB - R.removedCount(st)} übrig`, id: 'left' },
    ]);
    const b = this.streakEl.firstChild;
    const was = +b.textContent;
    b.textContent = st.streak;
    this.streakEl.classList.toggle('hot', st.streak >= 5);
    this.streakEl.classList.toggle('zero', st.streak === 0);
    if (animate && st.streak > was) {
      this.streakEl.classList.remove('bump');
      void this.streakEl.offsetWidth;
      this.streakEl.classList.add('bump');
    }
  }

  async dealAnim() {
    const g = this.g;
    const T0 = new Array(52);
    for (let id = 0; id < 52; id++) T0[id] = { x: g.stockRight, y: g.bottomY, z: 50 + (51 - id), up: false, hide: id > 31 && id !== WASTE0 };
    this.table.set(T0);
    this.table.locked = true;
    await sleep(120);
    const order = [];
    for (let i = 0; i < R.TAB; i++) order.push(i);
    order.push(WASTE0);
    await this.table.move(this.targets(), { stagger: 28, order, dur: 360, arc: 16 });
    this.table.locked = false;
    this.updateBadge();
  }

  // ------------------------------------------------------------ Züge

  tapCard(id) {
    if (this.busy || this.over) return;
    if (id > WASTE0) { if (id - R.TAB - 1 >= this.st.ptr) this.draw(); return; }
    if (id === WASTE0 || id >= R.TAB) return;
    if (R.isRemoved(this.st, id)) return;
    if (!R.isFree(this.st, id)) { this.table.shake(id); return; }
    if (!R.canPlay(this.st, id)) {
      this.table.shake(id);
      if (!this.noFitTold) {
        this.noFitTold = true;
        const top = rankOf(this.st.top);
        toast(`Passt nicht – gesucht: ${this.neighbours(top)}`);
      }
      return;
    }
    this.play({ t: 'play', i: id });
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
    if (!R.isLegal(this.st, m)) return;
    const before = this.st;
    this.pile.push(m.t === 'play' ? m.i : SID(before.ptr));
    this.st = R.apply(before, m);
    this.moves.push(m);
    if (!this.counted) { this.counted = true; S(this.slot).played++; saveStats(); }
    this.table.coach(null);
    this.coachEl.classList.add('hide');
    this.coachDone = true;
    this.stuckShown = false;
    this.table.hint(null);
    const g = this.g;
    if (m.t === 'play') {
      const pts = this.st.score - before.score;
      const peak = m.i < 3;
      sfx.play(peak ? 'sparkle' : 'place');
      const x = Math.round(g.left + R.XPOS[m.i] * g.stepX + g.cw / 2);
      const y = g.topY + R.ROW[m.i] * g.v;
      floatText(this.table, `+${pts}`, x, y);
      if (peak) {
        const won = R.isWon(this.st);
        setTimeout(() => floatText(this.table, won ? 'Alle Gipfel!' : 'Gipfel!', x, y + 26), 180);
      }
      const word = STREAK_WORDS[this.st.streak];
      if (word) setTimeout(() => floatText(this.table, word, g.W / 2, g.bottomY - g.ch * 0.55), 120);
    }
    this.busy = m.t === 'play';
    const p = this.table.move(this.targets(), m.t === 'play' ? { order: [m.i], arc: 30, lift: 0.08 } : { dur: 280 });
    this.updateBadge();
    this.updateHud();
    writeSave(this);
    await p;
    this.busy = false;
    if (this.dead) return;
    if (R.isWon(this.st)) { this.onWin(); return; }
    this.checkStuck();
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
    this.updateHud(false);
    writeSave(this);
  }

  async askNew() {
    if (this.busy) return;
    const v = await showModal({
      title: 'Neu beginnen?',
      text: this.daily ? 'Der Gipfel des Tages wird neu ausgeteilt.' : this.moves.length && !this.over
        ? `Diese Runde nochmals von vorn – oder eine neue Runde (${fmtNum(this.st.score)} Punkte werden gutgeschrieben)?`
        : 'Eine neue Runde austeilen?',
      buttons: [
        ...(this.daily ? [] : [{ label: 'Neue Runde', value: 'new', primary: true, icon: 'plus' }]),
        ...(this.moves.length || this.daily ? [{ label: 'Diese Runde neu starten', value: 'restart', primary: this.daily, icon: 'refresh' }] : []),
        { label: 'Abbrechen', value: null, ghost: true },
      ],
    });
    if (v === 'new') this.finishAndNext();
    else if (v === 'restart') this.restart();
  }

  finishAndNext() {
    if (!this.over && this.counted) bank(this.slot, this.st, false);
    store.remove(K.save(this.slot));
    this.destroy();
    game = null;
    openGame(this.slot);
  }

  async restart() {
    this.moves = [];
    this.recount();
    this.over = false;
    this.won = false;
    this.stuckShown = false;
    this.busy = true;
    await this.table.move(this.targets(), { stagger: 8, dur: 360 });
    this.busy = false;
    this.updateBadge();
    this.updateHud(false);
    writeSave(this);
  }

  hint() {
    if (this.busy || this.over) return;
    const r = solve(this.st, { maxNodes: 40000 });
    let m = r.solved ? r.moves[0] : (r.bestMoves && r.bestMoves[0]);
    if (!m) m = R.legalMoves(this.st)[0];
    if (!m) { this.showStuck(); return; }
    if (!r.solved && !r.aborted && !this.lostTold) { this.lostTold = true; toast('Ganz abräumen geht so nicht mehr – «Zurück» hilft.'); }
    if (m.t === 'play') this.table.hint([m.i]);
    else this.table.hint([SID(this.st.ptr)]);
  }

  // ------------------------------------------------------------ Coach, Ende

  updateCoach() {
    if (this.coachDone || this.moves.length || Object.values(stats).some((x) => x.played > 0) || this.daily) return;
    const pl = R.playable(this.st);
    const g = this.g;
    const peaksBottom = g.topY + 3 * g.v + g.ch;
    this.coachEl.style.top = Math.round(Math.max(4, (peaksBottom + g.bottomY) / 2 - 34)) + 'px';
    const top = rankLabel(rankOf(this.st.top));
    if (pl.length) {
      this.table.coach({ card: pl[0] });
      this.coachEl.textContent = `Auf die ${top} passt ${this.neighbours(rankOf(this.st.top))} – tippe die Karte an.`;
    } else {
      this.table.coach({ card: SID(this.st.ptr) });
      this.coachEl.textContent = `Nichts passt auf die ${top}? Tippe auf den Talon.`;
    }
    this.coachEl.classList.remove('hide');
  }

  checkStuck() {
    if (this.over || this.stuckShown) return;
    if (R.legalMoves(this.st).length) return;
    this.stuckShown = true;
    setTimeout(() => { if (!this.dead && !this.over && !R.legalMoves(this.st).length) this.showStuck(); }, 650);
  }

  async showStuck() {
    const left = R.TAB - R.removedCount(this.st);
    const v = await showModal({
      title: 'Talon leer',
      text: `Noch ${left} ${left === 1 ? 'Karte' : 'Karten'} auf den Gipfeln. Zurücknehmen und anders probieren – oder die Runde mit ${fmtNum(this.st.score)} Punkten abschliessen?`,
      buttons: [
        { label: 'Zug zurück', value: 'undo', icon: 'undo' },
        { label: this.daily ? 'Nochmals von vorn' : 'Runde abschliessen', value: this.daily ? 'restart' : 'end', primary: true, icon: this.daily ? 'refresh' : 'check' },
      ],
    });
    if (this.dead) return;
    if (v === 'undo') this.undo();
    else if (v === 'restart') this.restart();
    else if (v === 'end') {
      this.over = true;
      bank(this.slot, this.st, false);
      writeSave(this);
      report();
      this.showEnd(false);
    }
  }

  async onWin() {
    this.over = true;
    this.won = true;
    bank(this.slot, this.st, true);
    if (this.daily) markDailyDone(ID, this.day);
    writeSave(this);
    report();
    this.busy = true;
    await this.table.idle();
    await sleep(300);
    if (this.dead) return;
    sfx.play('complete');
    const left = R.stockCount(this.st);
    if (left) floatText(this.table, `Talon-Bonus +${left * R.SCORE.stockBonus}`, this.g.W / 2, this.g.bottomY - this.g.ch * 0.4);
    this.table.fan(this.pile.slice(-24));
    await sleep(700);
    celebrate(CONFETTI);
    await sleep(900);
    if (this.dead) return;
    this.busy = false;
    this.showEnd(false);
  }

  async showEnd(again) {
    const st = this.st;
    const won = R.isWon(st);
    const left = R.stockCount(st);
    const s = S(this.slot);
    const badges = [];
    if (won && st.score >= s.bestScore && s.won > 1 && !again) badges.push('Neue Bestleistung');
    if (st.best >= 10) badges.push(`Serie von ${st.best}`);
    const content = winContent({
      cards: won ? this.pile.slice(-5).map((id) => this.table.cards[id].code) : [],
      sub: this.daily ? (won ? 'Gipfel des Tages geschafft' : 'Gipfel des Tages') : `Runde ${this.n} · ${modeById(this.mode).label}`,
      badges,
      stats: [
        { label: 'Punkte', value: fmtNum(st.score) },
        { label: 'Längste Serie', value: st.best },
        won ? { label: 'Talon übrig', value: left } : { label: 'Karten übrig', value: R.TAB - R.removedCount(st) },
      ],
      note: won ? null : 'Alle Punkte zählen trotzdem für deine Statistik.',
    });
    const title = again ? (won ? 'Schon geschafft!' : 'Runde beendet') : won ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Runde beendet';
    const buttons = this.daily
      ? [{ label: 'Zum Menü', value: 'menu', primary: true, icon: 'home' }, { label: 'Normale Runde spielen', value: 'play', ghost: true }]
      : [{ label: 'Nächste Runde', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
    const v = await showModal({ title, content, buttons, dismissible: false });
    if (this.dead) return;
    if (v === 'next') { store.remove(K.save(this.slot)); this.destroy(); game = null; openGame(this.slot); }
    else if (v === 'play') go('play');
    else go('');
  }

  // ------------------------------------------------------------ Test-Zugang

  exposeTestApi() {
    window.__tripeaks = {
      get game() { return game; },
      get state() { return game && game.st; },
      isWon: () => !!(game && R.isWon(game.st)),
      idle: () => (game ? game.table.idle() : Promise.resolve()),
      solution: () => solve(game.st, { maxNodes: 400000 }),
      play: (m) => game.play(m),
      stockId: () => SID(game.st.ptr),
      legal: () => R.legalMoves(game.st),
      rect: (id) => {
        const r = game.table.cards[id].el.getBoundingClientRect();
        return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.3, w: r.width, h: r.height };
      },
    };
  }
}

window.addEventListener('hashchange', route);
route();
