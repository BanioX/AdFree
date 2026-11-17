// Solitär – Klondike, Spider & FreeCell. Menü, Spielsteuerung, Blätter, Hash-Routing.
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import {
  MODES, LAYOUTS, newDeal, validState, canPick, canDrop, tapTargets, doMove, stockAction,
  revertOps, autoFoundationMove, isWon, kindOf, hiddenCount, foundTotal, makeCode,
} from './logic/rules.js';
import { findHint, isStuck, canAutoFinish, finishActions } from './logic/hints.js';
import * as Stats from './logic/stats.js';
import { Board } from './board.js';
import { installSprite, faceHTML } from './cardface.js';
import { BACKS, DEFAULT_BACK, backDataURL } from './data/backs.js';
import { TABLES, DEFAULT_TABLE, tableBackground } from './data/tables.js';
import { nextDeal, dailyDeal, DAILY_VARIANTS, dayLabel, solve } from './deals.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { tutorialSteps } from './howto.js';

const GAME_ID = 'solitaire';
const app = document.getElementById('app');

setupPage();
installSprite();

// ================================================================ Einstellungen & Speicher

const DEFAULTS = {
  back: DEFAULT_BACK, table: DEFAULT_TABLE, solvable: true, leftHanded: false,
  fourColor: false, labels: 'BDK', autoFound: true,
};
let settings = { ...DEFAULTS, ...store.get('solitaire.settings', {}) };
const saveSettings = () => store.set('solitaire.settings', settings);

const loadStats = () => store.get('solitaire.stats', {});
const saveStats = (s) => store.set('solitaire.stats', s);

const FAMILIES = {
  klondike: { title: 'Klondike', modes: ['klondike1', 'klondike3'], blurb: 'Der Klassiker' },
  spider: { title: 'Spider', modes: ['spider1', 'spider2', 'spider4'], blurb: 'Folgen bauen' },
  freecell: { title: 'FreeCell', modes: ['freecell'], blurb: 'Alles offen' },
};

function selectedMode() {
  const m = store.get('solitaire.mode', 'klondike1');
  return MODES[m] ? m : 'klondike1';
}
function familyOf(mode) { return MODES[mode].game; }
function modeLabel(mode) { const m = MODES[mode]; return m.game === 'freecell' ? m.title : `${m.title} · ${m.sub}`; }

const slotKey = (slot) => `solitaire.game.${slot}`;
function loadSession(slot) {
  const s = store.get(slotKey(slot), null);
  if (!s || s.v !== 2 || !validState(s.st) || !Array.isArray(s.hist)) return null;
  return s;
}
function saveSession(s) { store.set(slotKey(s.slot), s); }

function makeSession({ mode, daily = null, day = null, deal }) {
  return {
    v: 2, slot: daily ? 'daily-' + daily : mode, mode, daily, day,
    seed: deal.seed, label: deal.label, verified: !!deal.verified,
    st: newDeal(mode, deal.seed), hist: [], moves: 0, time: 0, started: false, won: false,
  };
}

function applyTheme() {
  const b = BACKS.find((x) => x.id === settings.back) || BACKS[0];
  document.documentElement.style.setProperty('--back-img', backDataURL(b));
  document.body.classList.toggle('four', !!settings.fourColor);
}

function dailyDone(variant, day = todayKey()) {
  if (variant === 'klondike') return isDailyDone(GAME_ID, day);
  return store.get(`solitaire.daily.${variant}.${day}`, false) === true;
}

function report() {
  const st = Stats.totals(loadStats());
  const daily = dailyDone('klondike') ? 'Tagesrätsel gelöst ✓' : 'Tagesrätsel offen';
  let text = `${st.won} ${st.won === 1 ? 'Sieg' : 'Siege'} · ${daily}`;
  if (game && game.s.started && !game.s.won) {
    const label = game.s.daily ? DAILY_VARIANTS[game.s.daily].title : modeLabel(game.s.mode);
    text = `${label} läuft · ${game.s.moves} Züge`;
  }
  reportSummary(GAME_ID, text);
}

// ================================================================ Mini-Karten (Menü, Blätter)

function miniCard(code, { x = 0, y = 0, rot = 0, up = true } = {}) {
  const el = h('div.mini-card' + (up ? '.up' : ''));
  el.innerHTML = (code >= 0 ? faceHTML(code, settings) : '<div class="face"></div>') + '<div class="back"></div>';
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  return el;
}

// ================================================================ Router

let game = null;
let routeTok = 0; // wird bei jedem Bildschirmwechsel erhöht – veraltete openGame-Fortsetzungen brechen ab

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hash.startsWith('play/')) {
    const m = hash.slice(5);
    if (MODES[m]) return openGame({ mode: m });
  }
  if (hash === 'daily' || hash.startsWith('daily/')) {
    const v = hash.split('/')[1] || 'klondike';
    if (DAILY_VARIANTS[v]) return openGame({ daily: v });
  }
  showMenu();
}

function go(hash) {
  if (location.hash.replace(/^#/, '') === hash) route();
  else location.hash = hash;
}

function teardown() {
  routeTok++;
  if (game) { game.unmount(); game = null; }
  document.querySelectorAll('.sp-modal-backdrop').forEach((n) => n.remove());
  app.className = 'app';
  app.replaceChildren();
}

// ================================================================ Menü

function showMenu() {
  teardown();
  applyTheme();
  setThemeColor('#fbf6ef');
  app.classList.add('sol-menu');
  const mode = selectedMode();
  const fam = familyOf(mode);
  const stats = loadStats();
  const e = Stats.entry(stats, mode);

  const sess = loadSession(mode);
  const running = sess && sess.started && !sess.won;
  const solvableTxt = settings.solvable && mode !== 'spider4' ? 'lösbar' : (mode === 'spider4' ? 'knifflig' : '');
  const primary = running
    ? { label: 'Weiterspielen', sub: `${modeLabel(mode)} · ${Stats.formatTime(sess.time)} · ${sess.moves} ${sess.moves === 1 ? 'Zug' : 'Züge'}`, onClick: () => go('play/' + mode) }
    : { label: 'Spielen', sub: `${modeLabel(mode)}${solvableTxt ? ' · ' + solvableTxt : ''}`, onClick: () => go('play/' + mode) };

  const kd = dailyDone('klondike');
  const kds = loadSession('daily-klondike');
  const kdRunning = !kd && kds && kds.day === todayKey() && kds.started;
  const daily = {
    label: 'Klondike des Tages', done: kd, streak: dailyStreak(GAME_ID),
    sub: kdRunning ? `Angefangen · ${kds.moves} Züge` : 'Ziehe 1',
    onClick: () => go('daily'),
  };

  const famOptions = Object.entries(FAMILIES).map(([key, f]) => {
    const v = store.get('solitaire.variant.' + key, f.modes[0]);
    const m = f.modes.includes(v) ? v : f.modes[0];
    return { id: key, label: f.title, sub: key === 'freecell' ? 'Alles offen' : MODES[m].sub };
  });

  // Weitere Tagesrätsel (Spider, FreeCell) – gleiche Karte wie das Haupt-Tagesrätsel
  const dl = h('div.daily-list');
  const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  const now = new Date();
  for (const [v, info] of Object.entries(DAILY_VARIANTS)) {
    if (v === 'klondike') continue;
    const done = dailyDone(v);
    const dsess = loadSession('daily-' + v);
    const inProgress = !done && dsess && dsess.day === todayKey() && dsess.started;
    const sub = done ? '✓ Gelöst' : inProgress ? `Angefangen · ${dsess.moves} Züge` : `${v === 'spider' ? '1 Farbe · ' : ''}Heute noch offen`;
    const b = h('button.gm-daily' + (done ? '.done' : ''), { type: 'button', 'data-daily': v },
      h('div.gm-cal', null, h('span.gm-cal-m', null, MONTHS[now.getMonth()]), h('span.gm-cal-d', null, String(now.getDate()))),
      h('span.gm-daily-text', null, h('b', null, info.title), h('small', null, sub)),
      h('span.gm-chev', { html: icon('back', { size: 18 }) }));
    b.addEventListener('click', () => { sfx.play('tap'); go('daily/' + v); });
    dl.append(b);
  }

  const menu = gameMenu({
    id: GAME_ID,
    title: 'Solitär',
    tagline: 'Klondike, Spider & FreeCell',
    accent: '#2f9e6e',
    primary,
    daily,
    modes: {
      label: 'Spielart', value: fam, options: famOptions,
      onChange(key) {
        const f = FAMILIES[key];
        const last = store.get('solitaire.variant.' + key, f.modes[0]);
        store.set('solitaire.mode', f.modes.includes(last) ? last : f.modes[0]);
        const y = menu.scroller.scrollTop;
        showMenu();
        const sc = app.querySelector('.gm-scroll');
        if (sc) sc.scrollTop = y;
      },
    },
    secondary: [
      { label: 'Statistik', icon: 'star', onClick: () => showStats(mode) },
      { label: 'Design', icon: 'settings', onClick: () => showSettings() },
      { label: 'Regeln', icon: 'grid', onClick: () => showHelp(fam) },
    ],
    stats: [
      { label: 'Gewonnen', value: e.won },
      { label: 'Quote', value: e.played ? Stats.winRate(e) + '%' : '–' },
      { label: 'Bestzeit', value: Stats.formatTime(e.bestTime) },
      { label: 'Serie', value: e.streak },
    ],
    sections: [menuSection('Weitere Tagesrätsel', dl)],
    onHelp: () => showTutorialNow(),
  });
  app.append(menu);

  // Variante (Ziehe 1/3, 1/2/4 Farben) direkt unter der Spielart
  const fm = FAMILIES[fam].modes;
  const seg = menu.querySelector('.gm-seg');
  if (fm.length > 1 && seg) {
    const vars = h('div.variants');
    for (const m of fm) {
      const c = h('button.chip' + (m === mode ? '.active' : ''), { type: 'button', 'data-mode': m }, MODES[m].sub);
      c.addEventListener('click', () => {
        if (m === mode) return;
        sfx.play('click');
        store.set('solitaire.mode', m);
        store.set('solitaire.variant.' + fam, m);
        const y = menu.scroller.scrollTop;
        showMenu();
        const sc = app.querySelector('.gm-scroll');
        if (sc) sc.scrollTop = y;
      });
      vars.append(c);
    }
    seg.after(vars);
  }

  report();
  maybeShowTutorial({ id: GAME_ID, steps: tutorialSteps(settings), accent: '#2f9e6e' });
}

function showTutorialNow() {
  return showTutorial({ id: GAME_ID, steps: tutorialSteps(settings), accent: '#2f9e6e' });
}

function setThemeColor(c) {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', c);
}

// ================================================================ Spiel

async function openGame({ mode, daily }) {
  teardown();
  const tok = routeTok;
  applyTheme();
  let sess;
  if (daily) {
    const v = DAILY_VARIANTS[daily];
    sess = loadSession('daily-' + daily);
    if (!sess || sess.day !== todayKey()) {
      const deal = await dailyDeal(daily);
      if (tok !== routeTok) return;
      sess = makeSession({ mode: v.mode, daily, day: todayKey(), deal });
      sess.fresh = true;
    }
  } else {
    store.set('solitaire.mode', mode);
    store.set('solitaire.variant.' + familyOf(mode), mode);
    sess = loadSession(mode);
    if (!sess || sess.won) sess = null;
  }
  const g = new Game(sess, mode || DAILY_VARIANTS[daily].mode);
  game = g;
  g.mount();
  if (!tutorialSeen(GAME_ID)) {
    await maybeShowTutorial({ id: GAME_ID, steps: tutorialSteps(settings), accent: '#2f9e6e' });
    if (g.dead) return;
  }
  if (!sess) await g.deal();
  else g.show(!!sess.fresh);
}

class Game {
  constructor(sess, mode) {
    this.s = sess;
    this.mode = mode;
    this.busy = false;
    this.stuckAt = -1;
    this.finishActs = null;
    this.lastT = performance.now();
    this.saveTick = 0;
  }

  get st() { return this.s.st; }

  mount() {
    const t = TABLES.find((x) => x.id === settings.table) || TABLES[0];
    app.classList.add('sol-game');
    app.classList.toggle('ink-dark', t.ink === 'dark');
    app.style.setProperty('--table-bg', tableBackground(t));
    setThemeColor(t.light);
    this.hudTitle = h('b');
    this.hudTime = h('span');
    this.hudMoves = h('span');
    const back = backButton('#', () => { sfx.play('click'); go(''); });
    back.classList.add('white-btn');
    const snd = soundButton();
    snd.classList.add('white-btn');
    const hud = h('div.hud', null, this.hudTitle, h('small', null, this.hudTime, this.hudMoves));
    const helpB = h('button.icon-btn.white-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
    helpB.addEventListener('click', () => { sfx.play('click'); showTutorialNow(); });
    this.top = h('div.topbar.game-top', null, back, hud, helpB, snd);
    this.boardEl = h('div.sol-board');
    const tb = h('div.toolbar');
    const tool = (ic, label, fn) => {
      const b = h('button.tool', { type: 'button', 'aria-label': label, html: icon(ic, { size: 22 }) });
      b.append(h('span', null, label));
      b.addEventListener('click', () => { if (this.busy) return; fn(); });
      tb.append(b);
      return b;
    };
    this.btnNew = tool('refresh', 'Neu', () => this.askNew());
    this.btnHint = tool('hint', 'Tipp', () => this.hint());
    this.btnUndo = tool('undo', 'Zurück', () => this.undo());
    this.btnSet = tool('settings', 'Design', () => showSettings(this));
    app.append(this.top, this.boardEl, tb);
    this.board = new Board(this.boardEl, {
      onMove: (p, i, t) => this.playerMove(p, i, t, 'drag'),
      onTap: (p, i, id) => this.tap(p, i, id),
      onPick: () => sfx.play('tap'),
      onDropBack: () => sfx.play('place'),
    });
    this.board.setOptions({ leftHanded: settings.leftHanded, labels: settings.labels });
    this.timer = setInterval(() => this.tickTime(), 1000);
    this.onVis = () => { this.tickTime(); if (document.visibilityState !== 'visible') this.save(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.onHide = () => { this.tickTime(); this.save(); };
    window.addEventListener('pagehide', this.onHide);
  }

  unmount() {
    this.tickTime();
    if (this.s) this.save();
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('pagehide', this.onHide);
    if (this.board) this.board.destroy();
    this.dead = true;
  }

  /** Neue Partie austeilen (Modus dieses Spiels). */
  async deal({ sameSeed = false } = {}) {
    const old = this.s;
    if (old && !old.daily && old.started && !old.won) saveStats(Stats.recordLoss(loadStats(), old.mode));
    let deal;
    if (sameSeed && old) deal = { seed: old.seed, label: old.label, verified: old.verified };
    else {
      let busyEl = null;
      const t = setTimeout(() => { busyEl = h('div.busy', null, h('span.spin'), 'Ich mische eine lösbare Partie…'); this.boardEl.append(busyEl); }, 200);
      deal = await nextDeal(this.mode, { solvable: settings.solvable && this.mode !== 'spider4' ? true : settings.solvable });
      clearTimeout(t);
      if (busyEl) busyEl.remove();
      if (this.dead) return;
    }
    this.s = makeSession({ mode: this.mode, daily: old && old.daily, day: old && old.day, deal });
    this.stuckAt = -1;
    this.save();
    this.show(true);
  }

  show(animateDeal) {
    delete this.s.fresh;
    this.board.setState(this.s.st);
    this.lastT = performance.now();
    this.renderHud();
    this.hideFinish();
    report();
    if (animateDeal) {
      this.busy = true;
      this.board.locked = true;
      if (!navigator.userActivation || navigator.userActivation.hasBeenActive) sfx.play('whoosh');
      this.board.dealIn().then(() => {
        this.busy = false;
        this.board.locked = false;
        this.afterTurn(true);
      });
    } else if (this.s.won) {
      this.board.locked = true;
      setTimeout(() => this.showWin(null, true), 300);
    } else {
      this.afterTurn(true);
    }
    this.save();
  }

  save() { if (this.s) saveSession(this.s); }

  tickTime() {
    const now = performance.now();
    const dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (this.s && this.s.started && !this.s.won && document.visibilityState === 'visible' && dt < 5) {
      this.s.time += dt;
      if (++this.saveTick % 5 === 0) this.save();
    }
    this.renderHud();
  }

  renderHud() {
    if (!this.s) return;
    const s = this.s;
    this.hudTitle.textContent = s.daily ? DAILY_VARIANTS[s.daily].title : modeLabel(s.mode);
    this.hudTime.innerHTML = icon('refresh', { size: 14 }).replace('refresh', 'clock') + Stats.formatTime(s.time);
    this.hudTime.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>${Stats.formatTime(s.time)}`;
    this.hudMoves.textContent = `${s.moves} ${s.moves === 1 ? 'Zug' : 'Züge'}`;
    this.btnUndo.disabled = !s.hist.length || s.won;
    this.btnHint.disabled = s.won;
  }

  // ---------------------------------------------------------- Züge

  begin() {
    if (!this.s.started) {
      this.s.started = true;
      if (!this.s.daily) saveStats(Stats.recordStart(loadStats(), this.s.mode));
    }
  }

  tap(p, i, id) {
    if (this.busy || this.s.won) return;
    const st = this.st;
    const kind = kindOf(st, p);
    if (kind === 'stock') return this.stock();
    if (id < 0) return;
    if (!st.up[id]) { this.board.shake([id]); return; }
    if (!canPick(st, p, i)) {
      this.board.shake(st.piles[p].slice(i));
      sfx.play('error');
      if (st.game === 'freecell' && kind === 'tab') toast('Zu viele Karten – mehr freie Zellen nötig');
      return;
    }
    const targets = tapTargets(st, p, i);
    if (!targets.length) {
      this.board.shake(st.piles[p].slice(i));
      sfx.play('error');
      return;
    }
    // Erneutes Antippen derselben Karte: nächstes Ziel versuchen
    let t = targets[0];
    if (this.lastTap && this.lastTap.id === id && this.lastTap.to === p && performance.now() - this.lastTap.t < 4000) {
      const alt = targets.find((x) => x !== this.lastTap.from && kindOf(st, x) !== 'found');
      if (alt != null && kindOf(st, t) !== 'found') t = alt;
    }
    this.lastTap = { id, from: p, to: t, t: performance.now() };
    this.playerMove(p, i, t, 'tap');
  }

  playerMove(p, i, t, how) {
    if (this.busy || this.s.won) return;
    const st = this.st;
    if (!canPick(st, p, i) || !canDrop(st, p, i, t)) { this.board.sync(); sfx.play('error'); return; }
    this.board.clearFlash();
    this.begin();
    const ops = doMove(st, p, i, t);
    const tk = kindOf(st, t);
    const turn = { ops };
    this.s.hist.push(turn);
    this.s.moves++;
    const runDone = ops.some((o) => o.o === 'mv' && o.n === 13 && kindOf(st, o.t) === 'found' && st.game === 'spider');
    sfx.play(tk === 'found' ? 'pop' : 'place');
    if (ops.some((o) => o.o === 'flip')) setTimeout(() => sfx.play('click'), 160);
    const moving = st.piles[t].slice(-ops[0].n);
    this.board.update({ ids: moving, stagger: how === 'drag' ? 0 : 22, dur: how === 'drag' ? 190 : undefined });
    if (runDone) this.celebrateRun();
    this.autoMoves(turn);
    this.afterTurn();
  }

  /** Sichere Karten automatisch auf die Ablage (gehört zum selben Zug). */
  autoMoves(turn) {
    if (!settings.autoFound || this.st.game === 'spider') return;
    let n = 0;
    for (;;) {
      const m = autoFoundationMove(this.st);
      if (!m) break;
      turn.ops.push(...doMove(this.st, m.from, m.index, m.to));
      n++;
    }
    if (n) {
      this.board.update({ delay: 160, stagger: 90 });
      for (let k = 0; k < Math.min(n, 6); k++) setTimeout(() => sfx.play('pop'), 200 + k * 90);
    }
  }

  celebrateRun() {
    setTimeout(() => sfx.play('sparkle'), 250);
    toast('Folge komplett! ✨', 1200);
  }

  stock() {
    if (this.busy || this.s.won) return;
    const st = this.st;
    const L = LAYOUTS[st.game];
    const r = stockAction(st);
    if (r.error) {
      if (r.error === 'gap') { toast('Erst alle leeren Spalten füllen'); this.board.shake(st.piles[L.stock].slice(-10)); }
      else if (st.game === 'klondike') toast('Talon ist leer');
      sfx.play('error');
      return;
    }
    this.board.clearFlash();
    this.begin();
    const turn = { ops: r.ops };
    this.s.hist.push(turn);
    this.s.moves++;
    const op = r.ops[0];
    if (op.o === 'recycle') { sfx.play('whoosh'); this.board.update({ dur: 260, stagger: 6 }); }
    else if (op.o === 'deal') {
      sfx.play('whoosh');
      const ids = L.tab.map((p) => st.piles[p][st.piles[p].length - 1]);
      this.board.update({ ids, stagger: 45, dur: 260 });
      if (r.ops.some((o) => o.o === 'mv' && o.n === 13)) this.celebrateRun();
    } else {
      sfx.play('tap');
      const w = st.piles[L.waste];
      this.board.update({ ids: w.slice(-op.n), stagger: 50, dur: 230 });
    }
    this.autoMoves(turn);
    this.afterTurn();
  }

  undo() {
    if (this.busy || this.s.won || !this.s.hist.length) return;
    const turn = this.s.hist.pop();
    revertOps(this.st, turn.ops);
    this.s.moves = Math.max(0, this.s.moves - (turn.count || 1));
    this.board.clearFlash();
    sfx.play('click');
    this.board.update({ dur: 220, stagger: 12 });
    this.stuckAt = -1;
    this.afterTurn();
  }

  afterTurn(initial = false) {
    this.renderHud();
    this.save();
    report();
    if (this.s.hist.length) this.hideCoach(true);
    else if (initial) this.showCoach();
    if (isWon(this.st)) { if (!this.s.won) this.win(); return; }
    this.updateFinish();
    const key = this.s.hist.length;
    if (!initial && this.stuckAt !== key && isStuck(this.st)) {
      this.stuckAt = key;
      setTimeout(() => { if (!this.dead && this.s.hist.length === key && !this.busy) this.showStuck(); }, 700);
    }
  }

  // ---------------------------------------------------------- Erster Hinweis (Coach-Mark)

  /** Beim allerersten Spiel: pulsierender Ring um den ersten sinnvollen Zug. */
  showCoach() {
    if (this.coachEl || this.s.won || this.s.hist.length || store.get('solitaire.coached', false)) return;
    const st = this.st;
    const hnt = findHint(st);
    if (!hnt) return;
    const g = this.board.geo;
    const L = LAYOUTS[st.game];
    let r;
    if (hnt.kind === 'stock') r = this.board.pileRect(L.stock, true);
    else {
      const ids = st.piles[hnt.from].slice(hnt.index);
      const T = this.board.targets();
      const y0 = T[ids[0]].y, y1 = T[ids[ids.length - 1]].y;
      r = { x: T[ids[0]].x, y: y0, w: g.cw, h: y1 - y0 + g.ch };
    }
    const tipText = hnt.kind === 'stock' ? 'Tippe auf den Talon' : 'Tippe diese Karte an';
    const ring = h('div.coach-ring');
    ring.style.cssText = `left:${r.x - 5}px;top:${r.y - 5}px;width:${r.w + 10}px;height:${r.h + 10}px`;
    const bubble = h('div.coach-bubble', null, tipText);
    const BW = 190, M = 8;
    const topRow = r.y + r.h <= g.tabY;
    const roomL = r.x - 6 - M - BW >= M, roomR = r.x + r.w + 6 + M + BW <= g.W - M;
    if (topRow && (roomL || roomR)) {
      // Obere Reihe: Blase seitlich, damit sie die Spalten nicht verdeckt
      const leftSide = roomL && (!roomR || r.x + r.w / 2 > g.W / 2);
      bubble.classList.add(leftSide ? 'side-l' : 'side-r');
      bubble.style.top = Math.max(4, r.y + r.h / 2 - 18) + 'px';
      bubble.style.left = (leftSide ? r.x - 6 - M - BW : r.x + r.w + 6 + M) + 'px';
    } else {
      const below = r.y + r.h + 46 < g.H;
      bubble.classList.toggle('above', !below);
      bubble.style.top = (below ? r.y + r.h + 12 : r.y - 44) + 'px';
      bubble.style.left = Math.max(M, Math.min(g.W - BW - M, r.x + r.w / 2 - BW / 2)) + 'px';
    }
    this.coachEl = h('div.coach', null, ring, bubble);
    this.boardEl.append(this.coachEl);
  }

  hideCoach(done = false) {
    if (done && !store.get('solitaire.coached', false) && this.s.hist.length) store.set('solitaire.coached', true);
    if (!this.coachEl) return;
    const el = this.coachEl;
    this.coachEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }

  // ---------------------------------------------------------- Tipp / Fertigstellen

  async hint() {
    if (this.busy || this.s.won) return;
    const st = this.st;
    const L = LAYOUTS[st.game];
    let hnt = null;
    if (st.game === 'freecell') {
      const key = this.s.hist.length;
      this.btnHint.disabled = true;
      const r = await solve({ cmd: 'state', state: st, opts: { wantMoves: true, maxNodes: 50000 } }, 1500);
      this.btnHint.disabled = false;
      if (this.dead || key !== this.s.hist.length) return;
      if (r.solved && r.moves && r.moves.length) {
        const a = r.moves[0];
        hnt = { kind: 'move', from: a.from, index: a.index, to: a.to };
      } else if (r.solved === false) {
        // Der Löser hat alles durchsucht: von hier aus geht es nicht mehr auf
        this.showStuck(true, true);
        return;
      }
    }
    if (!hnt) hnt = findHint(st, this.s.hist);
    if (!hnt) { this.showStuck(true); return; }
    sfx.play('sparkle');
    if (hnt.kind === 'stock') {
      const sp = st.piles[L.stock];
      if (sp.length) this.board.flash(st.game === 'spider' ? sp.slice(-10) : [sp[sp.length - 1]], null);
      else this.board.flash([], L.stock);
      toast(st.game === 'spider' ? 'Tipp: neue Karten geben' : sp.length ? 'Tipp: eine Karte ziehen' : 'Tipp: Talon umdrehen');
    } else {
      this.board.flash(st.piles[hnt.from].slice(hnt.index), hnt.to);
    }
  }

  hideFinish() {
    if (this.finishBtn) { this.finishBtn.remove(); this.finishBtn = null; }
    this.finishActs = null;
  }

  async updateFinish() {
    const st = this.st;
    const key = this.s.hist.length;
    let acts = null;
    if (st.game !== 'spider') {
      if (canAutoFinish(st)) acts = finishActions(st);
    } else if (!st.piles[LAYOUTS.spider.stock].length && hiddenCount(st) === 0) {
      const r = await solve({ cmd: 'state', state: st, opts: { wantMoves: true, maxNodes: 20000 } }, 1500);
      if (this.dead || key !== this.s.hist.length) return;
      if (r.solved && r.moves) acts = r.moves;
    }
    if (!acts || !acts.length) { this.hideFinish(); return; }
    this.finishActs = acts;
    if (!this.finishBtn) {
      this.finishBtn = h('button.btn.primary.finish-btn', { type: 'button', html: icon('sparkle', { size: 20 }) });
      this.finishBtn.append('Automatisch beenden');
      this.finishBtn.addEventListener('click', () => this.autoFinish());
      this.boardEl.append(this.finishBtn);
      sfx.play('sparkle');
    }
  }

  async autoFinish() {
    const acts = this.finishActs;
    if (!acts || this.busy) return;
    this.hideFinish();
    this.busy = true;
    this.board.locked = true;
    this.begin();
    const st = this.st;
    const turn = { ops: [], count: 0 };
    this.s.hist.push(turn);
    for (const a of acts) {
      if (this.dead) return;
      if (a.t === 'stock') {
        const r = stockAction(st);
        if (r.error) break;
        turn.ops.push(...r.ops);
        sfx.play('tap');
      } else {
        if (!canDrop(st, a.from, a.index, a.to)) break;
        const ops = doMove(st, a.from, a.index, a.to);
        turn.ops.push(...ops);
        sfx.play(kindOf(st, a.to) === 'found' ? 'pop' : 'place');
        if (ops.some((o) => o.o === 'mv' && o.n === 13)) sfx.play('sparkle');
      }
      turn.count++;
      this.s.moves++;
      this.renderHud();
      this.board.update({ dur: 210 });
      await sleep(st.game === 'spider' ? 150 : 85);
    }
    await this.board.idle();
    this.busy = false;
    this.board.locked = false;
    this.afterTurn();
  }

  // ---------------------------------------------------------- Ende

  async win() {
    const s = this.s;
    s.won = true;
    s.started = true;
    this.busy = true;
    this.board.locked = true;
    this.hideFinish();
    let result = null;
    if (s.daily) {
      if (s.daily === 'klondike') markDailyDone(GAME_ID, s.day);
      store.set(`solitaire.daily.${s.daily}.${s.day}`, true);
      store.update('solitaire.dailyWins', 0, (n) => n + 1);
    } else {
      result = Stats.recordWin(loadStats(), s.mode, { time: Math.round(s.time), moves: s.moves });
      saveStats(result.stats);
    }
    this.save();
    report();
    this.renderHud();
    await this.board.idle();
    if (this.dead) return;
    sfx.play('complete');
    setTimeout(() => celebrate(['#2f9e6e', '#ffd23f', '#ff7a8a', '#5b8def', '#ffffff', '#f2c14e']), 500);
    await this.board.cascade();
    if (this.dead) return;
    this.showWin(result);
  }

  async showWin(result, again = false) {
    const s = this.s;
    const art = h('div.win-art');
    const suitsUsed = s.st.game === 'spider' ? [0, 1, 2, 3].slice(0, MODES[s.mode].suits) : [0, 1, 2, 3];
    const winCodes = s.st.game === 'spider'
      ? [13, 12, 11, 1].map((r, i) => makeCode(suitsUsed[i % suitsUsed.length], r))
      : [0, 1, 2, 3].map((su) => makeCode(su, 1));
    winCodes.forEach((code, i) => art.append(miniCard(code, { x: 18 + i * 34, y: 10 + Math.abs(1.5 - i) * 6, rot: -15 + i * 10 })));
    const e = result ? result.entry : null;
    const stat = (v, l) => h('div.stat', null, h('b', null, v), h('small', null, l));
    const third = s.daily
      ? stat(String(s.daily === 'klondike' ? Math.max(1, dailyStreak(GAME_ID)) : store.get('solitaire.dailyWins', 1)), s.daily === 'klondike' ? 'Tage Serie' : 'Tagessiege')
      : stat(String(e ? e.streak : 0), 'Siege in Folge');
    const badges = h('div.win-badges');
    if (result && result.records.time) badges.append(h('span.badge', { html: icon('star', { size: 15 }) + 'Neue Bestzeit' }));
    if (result && result.records.moves) badges.append(h('span.badge', { html: icon('bolt', { size: 15 }) + 'Wenigste Züge' }));
    if (e && e.won === 1) badges.append(h('span.badge', { html: icon('heart', { size: 15 }) + 'Erster Sieg' }));
    const content = h('div.win', null, art,
      h('p', null, s.daily ? `${DAILY_VARIANTS[s.daily].title} vom ${dayLabel(s.day)} gelöst!` : `${modeLabel(s.mode)} – ${s.label}`),
      h('div.win-stats', null, stat(Stats.formatTime(s.time), 'Zeit'), stat(String(s.moves), 'Züge'), third),
      badges);
    const buttons = s.daily
      ? [{ label: 'Freies Spiel', value: 'free', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }]
      : [{ label: 'Neue Partie', value: 'new', primary: true, icon: 'refresh' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
    const v = await showModal({ title: again ? 'Schon gelöst!' : s.daily ? 'Tagesrätsel gelöst!' : 'Gewonnen!', content, buttons, dismissible: false });
    if (this.dead) return;
    sfx.play('click');
    if (v === 'new') { this.busy = false; this.board.locked = false; this.deal(); }
    else if (v === 'free') go('play/' + s.mode);
    else go('');
  }

  async showStuck(fromHint = false, unsolvable = false) {
    if (this.dead || this.s.won) return;
    const buttons = [];
    if (this.s.hist.length) buttons.push({ label: 'Rückgängig', value: 'undo', primary: true, icon: 'undo' });
    buttons.push({ label: this.s.daily ? 'Neu beginnen' : 'Neue Partie', value: 'new', primary: !this.s.hist.length, icon: 'refresh' });
    buttons.push({ label: 'Weiter ansehen', value: null, ghost: true });
    const v = await showModal({
      title: unsolvable ? 'Sackgasse' : 'Keine Züge mehr',
      text: unsolvable
        ? 'Von hier aus lässt sich die Partie nicht mehr lösen. Mit «Rückgängig» kannst du einen anderen Weg probieren.'
        : fromHint
        ? 'Ich finde keinen sinnvollen Zug mehr. Mit «Rückgängig» kannst du einen anderen Weg probieren.'
        : 'Hier geht es nicht mehr weiter. Mit «Rückgängig» kannst du einen anderen Weg ausprobieren – so oft du willst.',
      buttons,
    });
    if (this.dead) return;
    if (v === 'undo') { this.undo(); }
    else if (v === 'new') { this.s.daily ? this.restart() : this.deal(); }
  }

  async askNew() {
    sfx.play('click');
    const s = this.s;
    const buttons = s.daily
      ? [{ label: 'Neu beginnen', value: 'restart', primary: true, icon: 'rotate' }, { label: 'Freies Spiel', value: 'free', icon: 'play' }, { label: 'Abbrechen', value: null, ghost: true }]
      : [{ label: 'Neue Partie', value: 'new', primary: true, icon: 'refresh' }, { label: 'Diese Partie neu starten', value: 'restart', icon: 'rotate' }, { label: 'Spielart wechseln', value: 'menu', icon: 'grid' }, { label: 'Abbrechen', value: null, ghost: true }];
    const running = s.started && !s.won && !s.daily;
    const v = await showModal({
      title: s.daily ? DAILY_VARIANTS[s.daily].title : 'Neue Partie?',
      text: running ? `${s.label} läuft. Eine neue Partie oder ein Neustart zählt diese als nicht gewonnen.` : (s.daily ? dayLabel(s.day) : `${modeLabel(s.mode)} · ${settings.solvable && s.verified ? 'lösbare Partien' : 'zufällige Partien'}`),
      buttons,
    });
    if (this.dead) return;
    if (v === 'new') this.deal();
    else if (v === 'restart') this.restart();
    else if (v === 'menu') go('');
    else if (v === 'free') go('play/' + s.mode);
  }

  restart() {
    this.deal({ sameSeed: true });
  }

  // ---------------------------------------------------------- Test-Helfer

  async playAction(a) {
    if (a.t === 'stock') { this.stock(); return; }
    this.playerMove(a.from, a.index, a.to, 'tap');
  }
}

// ================================================================ Blätter

function toggleRow(label, sub, get, set) {
  const sw = h('span.switch' + (get() ? '.on' : ''));
  const row = h('div.toggle-row', { role: 'switch', tabindex: '0' }, h('span.txt', null, h('b', null, label), sub ? h('small', null, sub) : null), sw);
  row.addEventListener('click', () => {
    const v = !get();
    set(v);
    sw.classList.toggle('on', v);
    sfx.play('click');
  });
  return row;
}

function showSettings(g = null) {
  const content = h('div.sheet');
  content.append(h('h3', null, 'Kartenrücken'));
  const backs = h('div.pick-grid');
  const renderBacks = () => {
    backs.replaceChildren();
    for (const b of BACKS) {
      const sw = h('span.sw', { style: { backgroundImage: backDataURL(b) } });
      const btn = h('button.pick' + (settings.back === b.id ? '.active' : ''), { type: 'button', 'aria-label': b.name }, sw, h('span', null, b.name));
      btn.addEventListener('click', () => {
        settings.back = b.id; saveSettings(); applyTheme(); sfx.play('tap'); renderBacks();
      });
      backs.append(btn);
    }
  };
  renderBacks();
  content.append(backs);

  content.append(h('h3', null, 'Tisch'));
  const tables = h('div.pick-grid');
  const renderTables = () => {
    tables.replaceChildren();
    for (const t of TABLES) {
      const sw = h('span.sw', { style: { background: tableBackground(t) } });
      const btn = h('button.pick.table' + (settings.table === t.id ? '.active' : ''), { type: 'button', 'aria-label': t.name }, sw, h('span', null, t.name));
      btn.addEventListener('click', () => {
        settings.table = t.id; saveSettings(); sfx.play('tap'); renderTables();
        if (g) {
          app.style.setProperty('--table-bg', tableBackground(t));
          app.classList.toggle('ink-dark', t.ink === 'dark');
          setThemeColor(t.light);
        }
      });
      tables.append(btn);
    }
  };
  renderTables();
  content.append(tables);

  content.append(h('h3', null, 'Spiel'));
  content.append(toggleRow('Lösbare Partien', 'Nur Partien, die nachweislich aufgehen', () => settings.solvable, (v) => { settings.solvable = v; saveSettings(); }));
  content.append(toggleRow('Automatisch ablegen', 'Sichere Karten fliegen von selbst auf die Ablage', () => settings.autoFound, (v) => { settings.autoFound = v; saveSettings(); }));
  content.append(toggleRow('Linkshänder', 'Talon und Zellen auf der anderen Seite', () => settings.leftHanded, (v) => {
    settings.leftHanded = v; saveSettings();
    if (g) { g.board.setOptions({ leftHanded: v }); g.board._force = true; g.board.resize(); g.board._force = false; }
  }));
  content.append(toggleRow('Vierfarbige Karten', 'Kreuz grün, Karo blau – besser unterscheidbar', () => settings.fourColor, (v) => { settings.fourColor = v; saveSettings(); applyTheme(); }));
  const seg = h('div.seg');
  for (const [k, l] of [['BDK', 'B D K'], ['JQK', 'J Q K']]) {
    const b = h('button' + (settings.labels === k ? '.active' : ''), { type: 'button' }, l);
    b.addEventListener('click', () => {
      settings.labels = k; saveSettings(); sfx.play('click');
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      if (g) g.board.setOptions({ labels: k });
    });
    seg.append(b);
  }
  content.append(h('div.toggle-row', null, h('span.txt', null, h('b', null, 'Bildkarten'), h('small', null, 'Bube/Dame/König oder Jack/Queen/King')), seg));
  if (!g) {
    // Klondike-Ziehweise direkt umstellbar
    const seg2 = h('div.seg');
    const kv = store.get('solitaire.variant.klondike', 'klondike1');
    for (const m of ['klondike1', 'klondike3']) {
      const b = h('button' + (kv === m ? '.active' : ''), { type: 'button' }, MODES[m].sub);
      b.addEventListener('click', () => {
        store.set('solitaire.variant.klondike', m);
        if (familyOf(selectedMode()) === 'klondike') store.set('solitaire.mode', m);
        sfx.play('click');
        seg2.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      });
      seg2.append(b);
    }
    content.append(h('div.toggle-row', null, h('span.txt', null, h('b', null, 'Klondike'), h('small', null, 'Karten einzeln oder zu dritt ziehen')), seg2));
  }
  return showModal({ title: 'Design & Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }] }).then(() => {
    if (!g) showMenu();
  });
}

function showStats(mode) {
  const content = h('div.sheet');
  const chips = h('div.chips-row');
  const body = h('div');
  const sub = h('p.stat-mode');
  let current = mode;
  const render = () => {
    chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.m === current));
    sub.textContent = modeLabel(current);
    const e = Stats.entry(loadStats(), current);
    const stat = (v, l) => h('div.stat', null, h('b', null, v), h('small', null, l));
    body.replaceChildren(
      h('div.stat-grid', null,
        stat(String(e.played), 'Gespielt'),
        stat(String(e.won), 'Gewonnen'),
        stat(e.played ? Stats.winRate(e) + '%' : '–', 'Gewinnquote'),
        stat(Stats.formatTime(e.bestTime), 'Bestzeit'),
        stat(e.fewestMoves == null ? '–' : String(e.fewestMoves), 'Wenigste Züge'),
        stat(`${e.streak} / ${e.bestStreak}`, 'Serie / Rekord')),
      h('p.stat-note', null, `Tagesrätsel: ${store.get('solitaire.dailyWins', 0)} gelöst · Klondike-Serie ${dailyStreak(GAME_ID)} ${dailyStreak(GAME_ID) === 1 ? 'Tag' : 'Tage'}`));
  };
  for (const m of Object.keys(MODES)) {
    const c = h('button.chip', { type: 'button', 'data-m': m }, m === 'freecell' ? 'FreeCell' : m.startsWith('klondike') ? `Klondike ${MODES[m].draw}` : `Spider ${MODES[m].suits}♠`);
    c.addEventListener('click', () => { current = m; sfx.play('click'); render(); });
    chips.append(c);
  }
  content.append(chips, sub, body);
  render();
  const v = showModal({
    title: 'Statistik', content,
    buttons: [{ label: 'Schliessen', value: true, primary: true }, { label: 'Diese Statistik zurücksetzen', value: 'reset', ghost: true }],
  });
  return v.then(async (r) => {
    if (r === 'reset') {
      const ok = await showModal({ title: 'Zurücksetzen?', text: `Statistik für ${modeLabel(current)} löschen?`, buttons: [{ label: 'Löschen', value: true, primary: true, icon: 'trash' }, { label: 'Abbrechen', value: false, ghost: true }] });
      if (ok === true) {
        const s = loadStats();
        delete s[current];
        saveStats(s);
        toast('Statistik zurückgesetzt');
      }
      showStats(current);
    }
  });
}

const HELP = {
  klondike: {
    title: 'Klondike',
    cards: [[1, 13], [0, 12], [3, 11]],
    text: [
      'Ziel: Alle Karten nach Farben von <b>Ass bis König</b> auf die vier Ablagen oben legen.',
      'In den Spalten legst du <b>absteigend</b> und <b>abwechselnd Rot auf Schwarz</b>. Verdeckte Karten drehen sich um, sobald sie frei liegen.',
      'In eine leere Spalte passt nur ein <b>König</b>. Tippe auf den Talon, um neue Karten zu ziehen – bei «Ziehe 3» drei auf einmal.',
    ],
  },
  spider: {
    title: 'Spider',
    cards: [[0, 9], [0, 8], [0, 7]],
    text: [
      'Ziel: In den Spalten Folgen von <b>König bis Ass in derselben Farbe</b> bauen – fertige Folgen räumen sich von selbst ab.',
      'Absteigend darfst du auf jede Farbe legen, <b>verschieben</b> lassen sich aber nur gleichfarbige Folgen. Leere Spalten nehmen jede Karte.',
      'Der Talon gibt jeder Spalte eine neue Karte – das geht nur, wenn keine Spalte leer ist. Mit 1 Farbe ist es entspannt, mit 4 Farben eine echte Knobelei.',
    ],
  },
  freecell: {
    title: 'FreeCell',
    cards: [[3, 6], [2, 5], [1, 4]],
    text: [
      'Alle Karten liegen offen – reine Überlegung, fast jede Partie geht auf.',
      'Lege absteigend <b>Rot auf Schwarz</b> und sammle die Farben von Ass bis König auf den Ablagen oben rechts.',
      'Die <b>vier freien Zellen</b> oben links nehmen je eine Karte auf. Ganze Folgen verschiebst du, wenn genug Zellen oder Spalten frei sind.',
    ],
  },
  bedienung: {
    title: 'Bedienung',
    cards: [[1, 1], [0, 2], [3, 3]],
    list: [
      '<b>Antippen:</b> Die Karte springt auf den besten Platz – zuerst auf die Ablage. Nochmals tippen probiert ein anderes Ziel.',
      '<b>Ziehen:</b> Karte oder ganzen Stapel mit dem Finger verschieben.',
      '<b>Tipp</b> zeigt einen guten Zug, <b>Zurück</b> nimmt Züge zurück – so oft du willst.',
      'Liegen alle Karten offen, erscheint <b>«Automatisch beenden»</b>.',
      'Dein Spielstand wird immer gespeichert. Unter <b>Design</b> wählst du Kartenrücken und Tisch.',
    ],
  },
};

function showHelp(fam = 'klondike') {
  const content = h('div.sheet');
  const seg = h('div.seg');
  const body = h('div.help-body');
  let cur = fam;
  const render = () => {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === cur));
    const d = HELP[cur];
    const art = h('div.help-art');
    d.cards.forEach(([s, r], i) => art.append(miniCard(makeCode(s, r), { x: 50 + i * 40, y: i * 5, rot: -8 + i * 8 })));
    body.replaceChildren(art);
    if (d.text) d.text.forEach((t) => body.append(h('p', { html: t })));
    if (d.list) body.append(h('ul', null, d.list.map((t) => h('li', { html: t }))));
  };
  for (const k of ['bedienung', 'klondike', 'spider', 'freecell']) {
    const b = h('button', { type: 'button', 'data-k': k }, HELP[k].title);
    b.addEventListener('click', () => { cur = k; sfx.play('click'); render(); });
    seg.append(b);
  }
  content.append(h('div.help-tabs', null, seg), body);
  render();
  return showModal({ title: 'Regeln', content, buttons: [{ label: 'Alles klar', value: true, primary: true }] });
}

// ================================================================ Start

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
route();

// Test-Zugang (nur für automatisierte Tests / Fehlersuche)
window.__solitaire = {
  get game() { return game; },
  get state() { return game ? game.s.st : null; },
  get session() { return game ? game.s : null; },
  settings: () => ({ ...settings }),
  cardPoint: (id) => game.board.cardPoint(id),
  pilePoint: (p) => game.board.pilePoint(p),
  idle: () => (game ? game.board.idle() : Promise.resolve()),
  isWon: () => !!(game && isWon(game.s.st)),
  foundTotal: () => (game ? foundTotal(game.s.st) : 0),
  async solution(timeLimit = 6000) {
    if (!game) return null;
    return solve({ cmd: 'state', state: game.s.st, opts: { wantMoves: true } }, timeLimit);
  },
  async play(a) { if (game) await game.playAction(a); },
  hint: () => game && game.hint(),
};
