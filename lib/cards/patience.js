// Spalten-Patiencen (Yukon, Skorpion, Bäckerdutzend …): gemeinsamer Rahmen mit Startbildschirm,
// Spielansicht, Speichern/Fortsetzen über Hash-Routing, Statistik, Tipp, Rückgängig,
// «Automatisch beenden», Tagesspiel und Gewinnblatt. Die Regeln liefert das Spiel.
//
//   import { runPatience } from '../lib/cards/patience.js';
//   runPatience({
//     id, title, tagline, accent, confetti: [farben],
//     modes: [{ id, label, sub }], dailyMode,          // Modi als Segment-Schalter
//     rows: [[0, 1, …, 6]],                            // Spalten pro Reihe (mehrere Reihen möglich)
//     foundSlots: [3, 4, 5, 6], stockSlot: 0 | null,   // Rasterplätze in der obersten Reihe
//     foundHTML(i), emptyHTML(c, st), stockHTML,       // Inhalt der Platzhalter
//     game: {                                          // Regeln (rein, siehe /<spiel>/logic/)
//       newGame(key, mode) -> { seed, st }   geprüft lösbare Austeilung
//       fromSeed(seed, mode) -> st
//       isLegal, step, settle, legalMoves, isWon, foundationPiles, downOf(st, c),
//       canPick(st, c, i), stock?(st), hint(st, budget) -> { move, solved },
//       finish?(st) -> [Züge] | null, progress(st) -> 0..1, solve(st) -> [Züge] | null
//     },
//     tutorial: [Schritte], coachText, texts: { noPick, noFit, faceDown },
//     events?: { onRun(before, after) }               // optional: eigene Reaktionen
//   });
//
// Züge: { t: 'f', from } Ablage · { t: 'm', from, idx, to } Spalte · { t: 'd' } Reserve austeilen.
// Karten-IDs auf dem Tisch = Kartencodes (0..51).

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../../shared/storage.js';
import { sfx } from '../../shared/sfx.js';
import { h, icon, toast, showModal, celebrate, setupPage, sleep } from '../../shared/ui.js';
import { gameMenu } from '../../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../../shared/tutorial.js';
import { StackTable } from './stack.js';
import {
  applyCardTheme, clearCardTheme, applyBack, gameTop, toolbar, badge, showSettings, showStatsSheet,
  winContent, floatText, Clock, fmtTime,
} from './shell.js';

export function runPatience(cfg) {
  setupPage();
  const ID = cfg.id;
  const G = cfg.game;
  const N = cfg.rows.reduce((a, r) => a + r.length, 0);
  const app = document.getElementById('app');
  const texts = {
    noPick: 'Diese Karte kann gerade nicht bewegt werden',
    noFit: 'Passt gerade nirgends',
    faceDown: 'Verdeckte Karten drehen sich um, sobald sie frei liegen',
    dailyLabel: 'Tagesspiel',
    winTitle: 'Geschafft!',
    ...(cfg.texts || {}),
  };
  const K = {
    mode: `${ID}.mode`,
    stats: `${ID}.stats`,
    next: `${ID}.next`,
    save: (slot) => `${ID}.save.${slot}`,
  };

  const modeById = (id) => cfg.modes.find((m) => m.id === id) || cfg.modes[0];
  let mode = modeById(store.get(K.mode, cfg.modes[0].id)).id;

  const emptyStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTime: null, bestMoves: null, timeSum: 0 });
  const stats = store.get(K.stats, {});
  const S = (slot) => (stats[slot] = { ...emptyStats(), ...(stats[slot] || {}) });
  const saveStats = () => store.set(K.stats, stats);
  const nextNo = (m) => store.get(K.next, {})[m] || 1;
  const bumpNo = (m) => store.update(K.next, {}, (o) => ({ ...o, [m]: (o[m] || 1) + 1 }));
  const anyPlayed = () => Object.values(stats).some((x) => x && x.played > 0);
  const pct = (st) => Math.round(G.progress(st) * 100);

  let game = null;

  // -------------------------------------------------------------- Spielstände

  function loadSave(slot) {
    const s = store.get(K.save(slot), null);
    if (!s || s.v !== 1 || !s.seed) return null;
    if (slot === 'daily' && s.day !== todayKey()) return null;
    try {
      const start = G.fromSeed(s.seed, s.mode);
      const states = [start];
      let st = start;
      for (const m of s.moves || []) {
        if (!G.isLegal(st, m)) throw new Error('ungültiger Zug');
        st = G.settle(G.step(st, m));
        states.push(st);
      }
      return { ...s, moves: (s.moves || []).slice(), states };
    } catch {
      return null;
    }
  }

  function writeSave(g) {
    store.set(K.save(g.slot), {
      v: 1, slot: g.slot, mode: g.mode, no: g.no, day: g.day, seed: g.seed, moves: g.moves,
      ms: g.clock ? Math.round(g.clock.ms) : g.ms || 0, counted: g.counted, won: g.won, hints: g.hints || 0,
    });
  }

  function makeGame(slot) {
    if (slot === 'daily') {
      const day = todayKey();
      const m = cfg.dailyMode || cfg.modes[0].id;
      const d = G.newGame('daily|' + day, m);
      return { slot, mode: m, no: 0, day, seed: d.seed, moves: [], states: [d.st], ms: 0, counted: false, won: false, hints: 0, fresh: true };
    }
    const no = nextNo(slot);
    bumpNo(slot);
    const d = G.newGame(`${slot}|${no}`, slot);
    return { slot, mode: slot, no, seed: d.seed, moves: [], states: [d.st], ms: 0, counted: false, won: false, hints: 0, fresh: true };
  }

  const unfinished = (s) => s && !s.won && s.moves.length > 0;

  function report() {
    const s = loadSave(mode);
    if (unfinished(s)) {
      reportSummary(ID, `Spiel ${s.no} · ${pct(s.states[s.states.length - 1])} % geschafft`);
    } else {
      const st = S(mode);
      reportSummary(ID, st.played ? `${st.won} von ${st.played} gewonnen · ${modeById(mode).label}` : 'Noch kein Spiel gespielt');
    }
  }

  // -------------------------------------------------------------- Routing

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

  const showTut = () => showTutorial({ id: ID, steps: cfg.tutorial, accent: cfg.accent });

  // -------------------------------------------------------------- Menü

  function primaryFor() {
    const s = loadSave(mode);
    if (unfinished(s)) {
      const st = s.states[s.states.length - 1];
      return { label: 'Weiterspielen', sub: `Spiel ${s.no} · ${s.moves.length} Züge · ${pct(st)} % geschafft`, onClick: () => go('play') };
    }
    const n = s && !s.won ? s.no : nextNo(mode);
    return { label: 'Spielen', sub: `Spiel ${n} · ${modeById(mode).label} · garantiert lösbar`, onClick: () => go('play') };
  }

  function dailyCard() {
    const s = loadSave('daily');
    return {
      label: texts.dailyLabel,
      done: isDailyDone(ID),
      streak: dailyStreak(ID),
      sub: unfinished(s) ? `${pct(s.states[s.states.length - 1])} % geschafft` : modeById(cfg.dailyMode).label,
      onClick: () => go('daily'),
    };
  }

  function statsFor(slot = mode) {
    const s = S(slot);
    return [
      { label: 'Gespielt', value: s.played },
      { label: 'Gewonnen', value: s.won },
      { label: 'Serie', value: s.streak },
      { label: 'Bestzeit', value: s.bestTime == null ? '–' : fmtTime(s.bestTime) },
    ];
  }

  function statRows(slot) {
    const s = S(slot);
    return [
      { label: 'Gespielt', value: s.played },
      { label: 'Gewonnen', value: s.won },
      { label: 'Quote', value: s.played ? Math.round((s.won / s.played) * 100) + ' %' : '–' },
      { label: 'Serie', value: s.streak },
      { label: 'Beste Serie', value: s.bestStreak },
      { label: 'Bestzeit', value: s.bestTime == null ? '–' : fmtTime(s.bestTime) },
      { label: 'Wenigste Züge', value: s.bestMoves == null ? '–' : s.bestMoves },
      { label: 'Ø Zeit', value: s.won ? fmtTime(s.timeSum / s.won) : '–' },
    ];
  }

  function openStats(cur = mode) {
    return showStatsSheet({
      modes: [...cfg.modes.map((m) => ({ id: m.id, label: m.label })), { id: 'daily', label: texts.dailyLabel }],
      current: cur,
      rows: statRows,
      onReset: (slot) => { stats[slot] = emptyStats(); saveStats(); report(); if (!game) showMenu(); },
    });
  }

  function openSettings(g) {
    return showSettings({ title: 'Design', toggles: [], onDesign: () => { applyBack(); if (g) g.retheme(); } });
  }

  function abandon(slot) {
    const s = loadSave(slot);
    if (unfinished(s) && slot !== 'daily') { S(slot).streak = 0; saveStats(); }
    store.remove(K.save(slot));
  }

  async function newGameFromMenu() {
    const s = loadSave(mode);
    if (unfinished(s)) {
      const ok = await showModal({
        title: 'Neues Spiel?', text: `Spiel ${s.no} ist noch nicht fertig – es wird aufgegeben.`,
        buttons: [{ label: 'Neues Spiel', value: true, primary: true, icon: 'plus' }, { label: 'Abbrechen', value: false, ghost: true }],
      });
      if (!ok) return;
    }
    abandon(mode);
    go('play');
  }

  function showMenu() {
    clearCardTheme(app);
    app.className = 'app';
    applyBack();
    const menu = gameMenu({
      id: ID,
      title: cfg.title,
      tagline: cfg.tagline,
      accent: cfg.accent,
      primary: primaryFor(),
      daily: dailyCard(),
      modes: {
        label: cfg.modesLabel || 'Variante', value: mode,
        options: cfg.modes.map((m) => ({ id: m.id, label: m.label, sub: m.sub })),
        onChange(id) { mode = id; store.set(K.mode, id); menu.update({ primary: primaryFor(), stats: statsFor() }); report(); },
      },
      secondary: [
        { label: 'Neues Spiel', icon: 'plus', onClick: newGameFromMenu },
        { label: 'Statistik', icon: 'star', onClick: () => openStats() },
        { label: 'Design', icon: 'settings', onClick: () => openSettings(null) },
      ],
      stats: statsFor(),
      onHelp: showTut,
    });
    app.replaceChildren(menu);
    report();
  }

  // -------------------------------------------------------------- Spiel

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
      this.over = false;
      this.toldOnce = {};
    }

    get daily() { return this.slot === 'daily'; }
    get st() { return this.states[this.states.length - 1]; }

    async mount() {
      applyCardTheme(app);
      app.classList.add('pt-game', `${ID}-game`);
      this.top = gameTop({ onBack: () => go(''), onHelp: () => showTut() });
      this.board = h('div.pt-board');
      this.coachEl = h('div.cg-coach.pt-coach.hide');
      this.finishBtn = h('button.pt-finish.hide', { type: 'button', html: icon('check', { size: 20 }) + '<span>Automatisch beenden</span>' });
      this.finishBtn.addEventListener('click', () => this.autoFinish());
      this.lostEl = h('div.pt-lost.hide', null, h('span', null, 'So geht es nicht mehr auf.'));
      const lostUndo = h('button', { type: 'button', html: icon('undo', { size: 18 }) + '<span>Zurück</span>' });
      lostUndo.addEventListener('click', () => this.undo());
      this.lostEl.append(lostUndo);
      const tb = toolbar([
        { id: 'new', icon: 'refresh', label: 'Neu', onClick: () => this.askNew() },
        { id: 'hint', icon: 'hint', label: 'Tipp', onClick: () => this.hint() },
        { id: 'undo', icon: 'undo', label: 'Zurück', onClick: () => this.undo() },
        { id: 'set', icon: 'settings', label: 'Design', onClick: () => openSettings(this) },
      ]);
      app.replaceChildren(this.top.el, this.board, tb.el);
      this.table = new StackTable(this.board, {
        onTap: (id) => this.tapCard(id),
        onSlot: (name) => { if (name === 's') this.deal(); },
        dragGroup: (id) => this.dragGroup(id),
        dropTarget: (ids, p) => this.dropTarget(ids, p),
        onDrop: (ids, t) => this.onDrop(ids, t),
        onDragStart: () => this.hideCoach(),
        onResize: () => this.relayout(),
      });
      for (let c = 0; c < N; c++) this.table.slot('c' + c, { cls: 'pt-col' });
      for (let i = 0; i < 4; i++) this.table.slot('f' + i, { cls: 'pt-found', html: cfg.foundHTML ? cfg.foundHTML(i) : '' });
      if (cfg.stockSlot != null) this.table.slot('s', { cls: 'pt-stock', html: cfg.stockHTML || '' });
      this.badge = this.table.add(badge());
      this.table.add(this.coachEl);
      this.table.add(this.finishBtn);
      this.table.add(this.lostEl);
      exposeTestApi();

      if (!tutorialSeen(ID)) {
        await maybeShowTutorial({ id: ID, steps: cfg.tutorial, accent: cfg.accent });
        if (this.dead) return;
      }

      let s = loadSave(this.slot);
      if (!s || (!this.daily && s.won)) { await sleep(30); s = makeGame(this.slot); }
      if (this.dead) return;
      this.load(s);
      writeSave(this);
      if (s.fresh) await this.dealAnim();
      else this.table.set(this.targets());
      if (this.dead) return;
      this.onHide = () => { if (document.hidden) writeSave(this); };
      document.addEventListener('visibilitychange', this.onHide);
      window.addEventListener('pagehide', this.onHide);
      this.timer = setInterval(() => this.updateTime(), 1000);
      if (this.won) { this.over = true; this.showWin(true); return; }
      this.clock.start();
      this.updateCoach();
      this.afterMove(null, true);
    }

    load(s) {
      Object.assign(this, {
        mode: s.mode, no: s.no, day: s.day, seed: s.seed, moves: s.moves, states: s.states,
        counted: s.counted, won: s.won, hints: s.hints || 0,
      });
      if (this.clock) this.clock.destroy();
      this.clock = new Clock(s.ms || 0);
      this.table.build(Array.from({ length: 52 }, (_, i) => i));
      this.layout();
      this.updateHud();
    }

    destroy() {
      this.dead = true;
      if (this.states) writeSave(this);
      clearInterval(this.timer);
      clearTimeout(this.lostTimer);
      if (this.clock) this.clock.destroy();
      document.removeEventListener('visibilitychange', this.onHide);
      window.removeEventListener('pagehide', this.onHide);
      if (this.table) this.table.destroy();
    }

    retheme() { applyCardTheme(app); }

    // ------------------------------------------------------------ Geometrie

    layout() {
      const t = this.table;
      const W = t.width, H = t.height;
      const rows = cfg.rows;
      const n = Math.max(...rows.map((r) => r.length));
      const pad = Math.max(5, Math.round(W * 0.018));
      const gap = Math.max(3, Math.round(W * 0.011));
      const fan = cfg.fanUp || 0.3;
      let cw = Math.min(96, Math.floor((W - 2 * pad - (n - 1) * gap) / n));
      const need = (w) => {
        const ch = w * 1.4;
        return ch * 1.32 + rows.length * (ch + ch * fan * (cfg.minFan || 3)) + (rows.length - 1) * 8 + 10;
      };
      while (cw > 26 && need(cw) > H) cw--;
      const ch = Math.round(cw * 1.4);
      t.setSize(cw, ch);
      const gridW = n * cw + (n - 1) * gap;
      const left = Math.round((W - gridW) / 2);
      const topY = Math.max(6, Math.round(ch * 0.1));
      const xAt = (k) => left + k * (cw + gap);
      const found = cfg.foundSlots.map((k) => ({ x: xAt(k), y: topY }));
      const stock = cfg.stockSlot != null ? { x: xAt(cfg.stockSlot), y: topY } : null;
      const y0 = topY + ch + Math.max(10, Math.round(ch * 0.2));
      const rowGap = 8;
      const rowH = (H - y0 - 8 - (rows.length - 1) * rowGap) / rows.length;
      const col = [];
      rows.forEach((r, ri) => {
        const off = ((n - r.length) * (cw + gap)) / 2;
        r.forEach((c, k) => {
          col[c] = { x: Math.round(left + off + k * (cw + gap)), y: Math.round(y0 + ri * (rowH + rowGap)), maxH: rowH, row: ri };
        });
      });
      this.g = { W, H, cw, ch, gap, left, found, stock, col, rowH, y0, topY, multi: rows.length > 1 };
      col.forEach((L, c) => t.placeSlot('c' + c, L.x, L.y));
      found.forEach((p, i) => t.placeSlot('f' + i, p.x, p.y));
      if (stock) t.placeSlot('s', stock.x, stock.y);
      this.paintSlots();
    }

    relayout() {
      if (!this.g || this.dead || !this.states) return;
      this.layout();
      this.table.set(this.targets());
      this.updateBadge();
      if (this.table.coachTarget) this.table.coach(this.table.coachTarget);
    }

    paintSlots() {
      if (!this.states || !cfg.emptyHTML) return;
      const st = this.st;
      for (let c = 0; c < N; c++) {
        const html = st.cols[c].length ? '' : cfg.emptyHTML(c, st);
        const s = this.table.slots.get('c' + c);
        if (s && s._html !== html) { s.innerHTML = html; s._html = html; }
      }
    }

    steps(n, d, maxH) {
      const ch = this.g.ch;
      let fd = ch * 0.13;
      let fu = ch * (cfg.fanUp || 0.3);
      const ups = Math.max(0, n - d - 1);
      if (n && d * fd + ups * fu + ch > maxH) {
        if (ups) fu = Math.max(ch * 0.15, (maxH - ch - d * fd) / ups);
        if (d && d * fd + ups * fu + ch > maxH) fd = Math.max(ch * 0.05, (maxH - ch - ups * fu) / d);
      }
      return { fd, fu };
    }

    targets(st = this.st) {
      const g = this.g;
      const T = new Array(52);
      for (let c = 0; c < N; c++) {
        const col = st.cols[c];
        const d = G.downOf(st, c);
        const L = g.col[c];
        const { fd, fu } = this.steps(col.length, d, L.maxH);
        let y = L.y;
        for (let k = 0; k < col.length; k++) {
          T[col[k]] = { x: L.x, y: Math.round(y), z: 100 + k, up: k >= d };
          y += k < d ? fd : fu;
        }
      }
      G.foundationPiles(st).forEach((p, i) => {
        const pos = g.found[i];
        p.forEach((code, k) => {
          const depth = p.length - 1 - k;
          T[code] = { x: pos.x, y: pos.y, z: 300 + k, up: true, b: depth > 0, hide: depth > 1 };
        });
      });
      const stock = G.stock ? G.stock(st) : [];
      stock.forEach((code, k) => {
        T[code] = { x: g.stock.x + k * 3, y: g.stock.y - k, z: 400 + k, up: false, b: k < stock.length - 1 };
      });
      return T;
    }

    updateBadge() {
      const n = G.stock ? G.stock(this.st).length : 0;
      const g = this.g;
      this.badge.textContent = n;
      this.badge.classList.toggle('off', n === 0 || !g.stock);
      if (g.stock) this.badge.style.transform = `translate(${Math.round(g.stock.x + g.cw - 12)}px, ${Math.round(g.stock.y - 8)}px)`;
    }

    updateHud() {
      if (this.dead) return;
      this.top.setTitle(this.daily ? texts.dailyLabel : `Spiel ${this.no}`);
      const n = this.moves.length;
      this.top.setInfo([
        { text: modeById(this.mode).label },
        { text: `${n} ${n === 1 ? 'Zug' : 'Züge'}`, id: 'moves' },
        { text: fmtTime(this.clock ? this.clock.ms : 0), id: 'time' },
      ]);
    }

    updateTime() {
      if (this.dead || !this.clock) return;
      const el = this.top.el.querySelector('[data-k="time"]');
      if (el) el.textContent = fmtTime(this.clock.ms);
    }

    async dealAnim() {
      const g = this.g;
      const T0 = new Array(52);
      const sx = g.stock ? g.stock.x : Math.round(g.W / 2 - g.cw / 2);
      const sy = g.stock ? g.stock.y : -g.ch - 10;
      for (let id = 0; id < 52; id++) T0[id] = { x: sx, y: sy, z: 50 + id, up: false };
      this.table.set(T0);
      this.table.locked = true;
      this.busy = true;
      await sleep(80);
      const st = this.st;
      const order = [];
      const maxLen = Math.max(...st.cols.map((c) => c.length));
      for (let k = 0; k < maxLen; k++) for (let c = 0; c < N; c++) if (k < st.cols[c].length) order.push(st.cols[c][k]);
      if (G.stock) order.push(...G.stock(st));
      sfx.play('whoosh');
      await this.table.move(this.targets(), { stagger: Math.max(8, Math.round(560 / order.length)), order, dur: 330, arc: 12 });
      this.table.locked = false;
      this.busy = false;
      this.updateBadge();
    }

    // ------------------------------------------------------------ Karten finden

    locate(id) {
      const st = this.st;
      if (this.locSt !== st) {
        const map = new Map();
        st.cols.forEach((col, c) => col.forEach((code, i) => map.set(code, { where: 'col', c, i })));
        G.foundationPiles(st).forEach((p, f) => p.forEach((code) => map.set(code, { where: 'found', f })));
        if (G.stock) G.stock(st).forEach((code) => map.set(code, { where: 'stock' }));
        this.locSt = st;
        this.locMap = map;
      }
      return this.locMap.get(id) || null;
    }

    movedIds(st, m) {
      if (m.t === 'f') { const col = st.cols[m.from]; return [col[col.length - 1]]; }
      if (m.t === 'm') return st.cols[m.from].slice(m.idx);
      if (m.t === 'd') return G.stock(st).slice();
      return [];
    }

    /** Ziel eines Zugs für das Leuchten (Karte oder Platzhalter). */
    targetOf(st, m) {
      if (m.t === 'm') {
        const col = st.cols[m.to];
        return col.length ? col[col.length - 1] : { slot: 'c' + m.to };
      }
      if (m.t === 'f') {
        const id = this.movedIds(st, m)[0];
        const after = G.step(st, m);
        const f = G.foundationPiles(after).findIndex((p) => p.includes(id));
        const pile = G.foundationPiles(st)[f] || [];
        return pile.length ? pile[pile.length - 1] : { slot: 'f' + f };
      }
      return { slot: 's' };
    }

    // ------------------------------------------------------------ Eingabe

    dragGroup(id) {
      if (this.busy || this.over) return null;
      const loc = this.locate(id);
      if (!loc || loc.where !== 'col') return null;
      if (!G.canPick(this.st, loc.c, loc.i)) return null;
      return this.st.cols[loc.c].slice(loc.i);
    }

    dropTarget(ids, p) {
      const loc = this.locate(ids[0]);
      if (!loc || loc.where !== 'col') return null;
      const g = this.g;
      const st = this.st;
      // Ablage (oberste Reihe)
      if (ids.length === 1 && p.y < g.y0 + g.ch * 0.1) {
        const lo = Math.min(...g.found.map((f) => f.x)) - g.gap - g.cw * 0.3;
        const hi = Math.max(...g.found.map((f) => f.x)) + g.cw + g.gap + g.cw * 0.3;
        if (p.x > lo && p.x < hi) {
          const m = { t: 'f', from: loc.c };
          if (G.isLegal(st, m)) {
            const t = this.targetOf(st, m);
            return { ...(typeof t === 'number' ? { card: t } : t), m, ok: true };
          }
          return { m, ok: false, found: true };
        }
      }
      let best = -1;
      let bd = 1e9;
      for (let c = 0; c < N; c++) {
        if (c === loc.c) continue;
        const L = g.col[c];
        const dx = Math.abs(p.x - (L.x + g.cw / 2));
        if (dx > g.cw * 0.75 + g.gap) continue;
        if (g.multi) {
          if (p.y < L.y - g.ch * 0.55 || p.y > L.y + L.maxH + 4) continue;
        } else if (p.y < L.y - g.ch * 0.6) continue;
        const dy = g.multi ? Math.abs(p.y - (L.y + g.ch / 2)) * 0.1 : 0;
        if (dx + dy < bd) { bd = dx + dy; best = c; }
      }
      if (best < 0) return null;
      const m = { t: 'm', from: loc.c, idx: loc.i, to: best };
      const ok = G.isLegal(st, m);
      const col = st.cols[best];
      return col.length ? { card: col[col.length - 1], m, ok } : { slot: 'c' + best, m, ok };
    }

    onDrop(ids, t) {
      if (this.busy || this.over || !t) return false;
      if (!t.ok) {
        this.table.shake(ids[0]);
        this.tellOnce('nofit', texts.noFit);
        return false;
      }
      this.play(t.m);
      return true;
    }

    tellOnce(k, text) {
      if (this.toldOnce[k]) return;
      this.toldOnce[k] = true;
      toast(text);
    }

    tapCard(id) {
      if (this.busy || this.over) return;
      const loc = this.locate(id);
      if (!loc) return;
      if (loc.where === 'stock') { this.deal(); return; }
      if (loc.where !== 'col') return;
      const st = this.st;
      if (loc.i < G.downOf(st, loc.c)) { this.table.shake(id); this.tellOnce('down', texts.faceDown); return; }
      if (!G.canPick(st, loc.c, loc.i)) { this.table.shake(id); this.tellOnce('pick', texts.noPick); return; }
      const m = this.bestMove(loc.c, loc.i);
      if (!m) {
        this.table.shake(id);
        sfx.play('error');
        this.tellOnce('nofit', texts.noFit);
        return;
      }
      this.play(m);
    }

    /** Bester Zug für eine angetippte Karte: Ablage > passende Karte > leere Spalte. */
    bestMove(c, i) {
      const st = this.st;
      const col = st.cols[c];
      const cands = [];
      if (i === col.length - 1) {
        const m = { t: 'f', from: c };
        if (G.isLegal(st, m)) cands.push([100, m]);
      }
      for (let to = 0; to < N; to++) {
        if (to === c) continue;
        const m = { t: 'm', from: c, idx: i, to };
        if (!G.isLegal(st, m)) continue;
        const empty = !st.cols[to].length;
        if (empty && i === 0 && G.downOf(st, c) === 0) continue;
        let sc = empty ? 20 : 50;
        // nicht gleich wieder dorthin zurück, woher die Karte eben kam
        const last = this.moves[this.moves.length - 1];
        if (last && last.t === 'm' && last.to === c && last.from === to) sc -= 30;
        sc -= Math.abs(to - c) * 0.3;
        cands.push([sc, m]);
      }
      cands.sort((a, b) => b[0] - a[0]);
      return cands.length ? cands[0][1] : null;
    }

    deal() {
      if (this.busy || this.over) return;
      const m = { t: 'd' };
      if (!G.isLegal(this.st, m)) { toast('Die Reserve ist schon ausgeteilt'); return; }
      this.play(m);
    }

    // ------------------------------------------------------------ Züge

    play(m, { quiet = false } = {}) {
      if (this.over || !G.isLegal(this.st, m)) return false;
      const before = this.st;
      const ids = this.movedIds(before, m);
      const mid = G.step(before, m);
      const after = G.settle(mid);
      this.states.push(after);
      this.moves.push(m);
      if (!this.counted) { this.counted = true; S(this.slot).played++; saveStats(); }
      this.clock.start();
      this.hideCoach();
      this.table.hint(null);
      this.table.select(null);
      if (!quiet) sfx.play(m.t === 'f' ? 'pop' : m.t === 'd' ? 'whoosh' : 'place');
      const far = m.t === 'f' || m.t === 'd';
      this.table.move(this.targets(mid), { order: ids, stagger: m.t === 'd' ? 90 : 12, arc: far ? 22 : 10, lift: 0.06 });
      if (after !== mid) {
        const run = cfg.events && cfg.events.onSettle ? cfg.events.onSettle(this, mid, after) : 0;
        setTimeout(() => {
          if (!this.dead && this.st === after) this.table.move(this.targets(after), { stagger: 24, arc: 20, order: run || undefined });
        }, run ? 380 : 170);
      }
      this.updateBadge();
      this.updateHud();
      this.paintSlots();
      writeSave(this);
      this.afterMove(m);
      return true;
    }

    afterMove(m, initial = false) {
      this.lostEl.classList.add('hide');
      clearTimeout(this.lostTimer);
      const st = this.st;
      if (G.isWon(st)) { this.win(); return; }
      const fin = G.finish ? G.finish(st) : null;
      this.finishMoves = fin;
      this.finishBtn.classList.toggle('hide', !fin || this.autoRunning);
      if (fin || this.autoRunning) return;
      if (!G.legalMoves(st).length) {
        if (!initial) setTimeout(() => this.stuck(), 450);
        return;
      }
      // Leise prüfen, ob die Stellung noch aufgeht (nur wenn bewiesen unlösbar → Hinweis)
      if (!initial && G.hint) {
        this.lostTimer = setTimeout(() => {
          if (this.dead || this.over || this.st !== st) return;
          const r = G.hint(st, cfg.lostBudget || 1500);
          if (r.solved === false && this.st === st && !this.over) this.lostEl.classList.remove('hide');
        }, 700);
      }
    }

    async stuck() {
      if (this.dead || this.over || G.legalMoves(this.st).length) return;
      const v = await showModal({
        title: 'Keine Züge mehr',
        text: 'Nimm ein paar Züge zurück oder versuche ein neues Spiel.',
        buttons: [
          { label: 'Zug zurück', value: 'undo', primary: true, icon: 'undo' },
          { label: 'Neues Spiel', value: 'new', icon: 'plus' },
          { label: 'Schliessen', value: null, ghost: true },
        ],
      });
      if (this.dead) return;
      if (v === 'undo') this.undo();
      else if (v === 'new') this.newGame();
    }

    undo() {
      if (this.busy || this.over || this.autoRunning) return;
      if (!this.moves.length) { toast('Noch kein Zug gemacht'); return; }
      this.moves.pop();
      this.states.pop();
      this.table.hint(null);
      this.table.move(this.targets(), { dur: 260 });
      this.updateBadge();
      this.updateHud();
      this.paintSlots();
      writeSave(this);
      this.afterMove(null);
    }

    hint() {
      if (this.busy || this.over || this.autoRunning) return;
      const st = this.st;
      const r = G.hint(st, cfg.hintBudget || 6000);
      this.hints++;
      writeSave(this);
      if (!r.move) { toast('Keine sinnvollen Züge mehr – nimm Züge zurück'); return; }
      if (r.solved === false) this.lostEl.classList.remove('hide');
      const ids = this.movedIds(st, r.move);
      const tgt = this.targetOf(st, r.move);
      this.table.hint([ids[0], tgt], 1900);
    }

    async autoFinish() {
      if (this.busy || this.over || !this.finishMoves) return;
      this.autoRunning = true;
      this.finishBtn.classList.add('hide');
      for (const m of this.finishMoves) {
        if (this.dead || this.over) break;
        if (!this.play(m, { quiet: true })) break;
        await sleep(85);
      }
      this.autoRunning = false;
      if (!this.dead && !this.over) this.afterMove(null);
    }

    async askNew() {
      if (this.busy) return;
      const v = await showModal({
        title: 'Neu beginnen?',
        text: this.daily ? 'Das Tagesspiel wird neu ausgeteilt.' : 'Diese Austeilung nochmals von vorn – oder ein ganz neues Spiel?',
        buttons: [
          ...(this.daily ? [] : [{ label: 'Neues Spiel', value: 'new', primary: true, icon: 'plus' }]),
          { label: 'Nochmals von vorn', value: 'restart', primary: this.daily, icon: 'refresh' },
          { label: 'Abbrechen', value: null, ghost: true },
        ],
      });
      if (v === 'restart') this.restart();
      else if (v === 'new') this.newGame();
    }

    newGame() {
      this.destroy();
      if (this.won) store.remove(K.save(this.slot));
      else abandon(this.slot);
      game = null;
      openGame(this.slot);
    }

    async restart() {
      this.states = [this.states[0]];
      this.moves = [];
      this.over = false;
      this.busy = true;
      this.table.hint(null);
      await this.table.move(this.targets(), { stagger: 6, dur: 360 });
      this.busy = false;
      this.updateBadge();
      this.updateHud();
      this.paintSlots();
      writeSave(this);
      this.afterMove(null, true);
    }

    // ------------------------------------------------------------ Coach

    updateCoach() {
      if (this.coachDone || this.moves.length || anyPlayed() || this.daily) return;
      const r = G.hint(this.st, 4000);
      if (!r.move) return;
      const ids = this.movedIds(this.st, r.move);
      this.table.coach({ card: ids[0] });
      this.coachEl.textContent = cfg.coachText || 'Tippe eine Karte an – sie springt an den passenden Platz.';
      this.coachEl.classList.remove('hide');
    }

    hideCoach() {
      if (this.coachDone) return;
      this.coachDone = true;
      this.table.coach(null);
      this.coachEl.classList.add('hide');
    }

    // ------------------------------------------------------------ Gewinn

    async win() {
      if (this.over) return;
      this.over = true;
      this.won = true;
      this.finishBtn.classList.add('hide');
      this.clock.stop();
      const ms = Math.round(this.clock.ms);
      const s = S(this.slot);
      s.won++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      this.newBest = s.bestTime == null || ms < s.bestTime;
      if (this.newBest) s.bestTime = ms;
      if (s.bestMoves == null || this.moves.length < s.bestMoves) s.bestMoves = this.moves.length;
      s.timeSum += ms;
      saveStats();
      if (this.daily) markDailyDone(ID, this.day);
      writeSave(this);
      report();
      this.busy = true;
      await sleep(260);
      await this.table.idle();
      if (this.dead) return;
      await sleep(200);
      sfx.play('complete');
      const fanIds = Array.from({ length: 13 }, (_, r) => ((r + 1) % 4) * 13 + r);
      this.table.fan(fanIds, { spread: 130 });
      await sleep(700);
      if (this.dead) return;
      celebrate(cfg.confetti);
      await sleep(1000);
      if (this.dead) return;
      this.busy = false;
      this.showWin(false);
    }

    async showWin(again) {
      if (again) this.table.set(this.targets());
      const s = S(this.slot);
      const ms = Math.round(this.clock.ms);
      const badges = [];
      if (!again && this.newBest && s.won > 1) badges.push('Neue Bestzeit');
      if (!this.hints) badges.push('Ohne Tipp');
      if (this.daily) badges.push(`${texts.dailyLabel} gelöst`);
      const content = winContent({
        cards: [12, 25, 38, 51],
        sub: this.daily ? `${texts.dailyLabel} · ${modeById(this.mode).label}` : `Spiel ${this.no} · ${modeById(this.mode).label}`,
        badges,
        stats: [
          { label: 'Zeit', value: fmtTime(ms) },
          { label: 'Züge', value: this.moves.length },
          this.daily ? { label: 'Tage in Folge', value: dailyStreak(ID) } : { label: 'Serie', value: s.streak },
        ],
      });
      const buttons = this.daily
        ? [{ label: 'Zum Menü', value: 'menu', primary: true, icon: 'home' }, { label: 'Neues Spiel', value: 'play', ghost: true }]
        : [{ label: 'Neues Spiel', value: 'new', primary: true, icon: 'plus' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
      const v = await showModal({ title: texts.winTitle, content, buttons, dismissible: false });
      if (this.dead) return;
      if (v === 'new') this.newGame();
      else if (v === 'play') go('play');
      else go('');
    }
  }

  // -------------------------------------------------------------- Test-Zugang

  function exposeTestApi() {
    window.__pat = {
      get game() { return game; },
      get state() { return game && game.st; },
      idle: () => (game ? game.table.idle() : Promise.resolve()),
      solve: () => G.solve(game.st),
      legal: () => G.legalMoves(game.st),
      play: (m) => game.play(m),
      moved: (m) => game.movedIds(game.st, m),
      target: (m) => game.targetOf(game.st, m),
      rect: (id) => {
        const r = game.table.cards[id].el.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + Math.min(r.height * 0.25, 14), w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      },
      slotRect: (name) => {
        const r = game.table.slots.get(name).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      },
    };
  }

  window.addEventListener('hashchange', route);
  route();
}
