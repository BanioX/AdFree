// Zahlenschlange – Spielpause. Menü, Spielansicht, Routen (#play/<stufe>, #daily).
import { setupPage, h, toast, showModal, confirmDialog, sleep } from '../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { gameMenu } from '../shared/gamemenu.js';
import { showTutorial, tutorialSeen } from '../shared/tutorial.js';
import { bindPointer } from '../lib/numbers/grid.js';
import { numPad, popover, closePopover } from '../lib/numbers/pad.js';
import {
  makeRouter, playTopbar, timerPill, toolButton, toolbar, winSheet, statStore, runClock, coachBubble, formatTime,
  praise, praiseWord,
} from '../lib/numbers/hud.js';
import * as G from './logic/game.js';
import { touching } from './logic/puzzle.js';
import { difficulties, difficultyById } from './data/difficulties.js';
import { buildBoard } from './board.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'hidato';
const ACCENT = '#d9822b';
const COLORS = ['#d9822b', '#f6c27a', '#ffd23f', '#ff8fa3', '#7fd6a8', '#ffffff'];
const K = {
  game: (slot) => `${ID}.game.${slot}`,
  next: `${ID}.next`,
  diff: `${ID}.diff`,
  coach: `${ID}.coachDone`,
};
const stats = statStore(`${ID}.stats`, { won: {}, best: {}, time: 0, daily: 0, noHint: 0 });

setupPage();
const app = document.getElementById('app');
let teardown = null;

const loadSlot = (slot) => { const st = store.get(K.game(slot), null); return G.validState(st) ? st : null; };
const saveSlot = (slot, st) => store.set(K.game(slot), st);
const nextNumber = (diff) => (store.get(K.next, {}) || {})[diff] || 1;
const bumpNumber = (diff, n) => store.update(K.next, {}, (o) => { o[diff] = Math.max(o[diff] || 1, n + 1); return o; });
const curDiff = () => { const d = store.get(K.diff, 'leicht'); return difficulties.some((x) => x.id === d) ? d : 'leicht'; };
const wonTotal = () => Object.values(stats.get().won).reduce((a, b) => a + b, 0) + stats.get().daily;
const running = (diff) => { const st = loadSlot(diff); return st && !st.done ? st : null; };
const sizeOf = (d) => `${d.w}×${d.h}`;

function summaryText() {
  const d = curDiff();
  const st = running(d);
  const parts = [];
  if (st) parts.push(`${difficultyById(d).title} · Nr. ${st.number} · ${Math.round(G.progress(st) * 100)} %`);
  else parts.push(wonTotal() ? `${wonTotal()} Schlangen gelöst` : 'Bereit für die erste Schlange');
  if (isDailyDone(ID)) parts.push('Tagesrätsel ✓');
  return parts.join(' · ');
}

// ---------- Tutorial ----------

let tutorialOpen = null;
function showHowTo() {
  if (tutorialOpen) return tutorialOpen;
  closePopover();
  tutorialOpen = showTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT }).finally(() => { tutorialOpen = null; });
  return tutorialOpen;
}

// ---------- Router ----------

const go = makeRouter(route);

function route() {
  closePopover();
  if (teardown) { try { teardown(); } catch { /* ignore */ } teardown = null; }
  const [name, arg] = (location.hash || '').replace(/^#/, '').split('/');
  if (name === 'play' && difficulties.some((d) => d.id === arg)) return showGame(arg);
  if (name === 'daily') return showGame('daily');
  return showMenu();
}

function startNew(diff) {
  const n = nextNumber(diff);
  saveSlot(diff, G.newGame({ diff, number: n }));
  bumpNumber(diff, n);
  go('play/' + diff);
}

// ---------- Menü ----------

function menuArt() {
  // Kleine Schlange als Titelbild: 4×4 mit Verbindungslinie
  const sol = [1, 2, 3, 4, 8, 7, 6, 5, 9, 10, 11, 12, 16, 15, 14, 13];
  const given = sol.map((v) => [1, 4, 6, 10, 13, 16].includes(v));
  const st = running(curDiff());
  const wrap = h('div.hd-art');
  const board = buildBoard({ w: 4, h: 4 }, { gap: 4 });
  board.layout(140, 140);
  wrap.append(board.el);
  const pos = []; sol.forEach((v, i) => { pos[v] = i; });
  const lnk = [];
  for (let k = 1; k < 16; k++) lnk.push([pos[k], pos[k + 1], k]);
  requestAnimationFrame(() => board.render(sol, given, lnk, { ends: [pos[1], pos[16]] }));
  if (st) wrap.classList.add('running');
  return wrap;
}

function primaryFor(diff) {
  const spec = difficultyById(diff);
  const st = running(diff);
  if (st) return { label: 'Weiterspielen', sub: `${spec.title} · Nr. ${st.number} · ${Math.round(G.progress(st) * 100)} %`, onClick: () => go('play/' + diff) };
  return { label: 'Spielen', sub: `${spec.title} · ${sizeOf(spec)} · Rätsel Nr. ${nextNumber(diff)}`, onClick: () => startNew(diff) };
}

function secondaryFor(diff) {
  const list = [];
  if (running(diff)) {
    list.push({
      label: 'Neues Rätsel', icon: 'plus',
      onClick: async () => {
        const st = running(diff);
        if (st && st.undo.length && !(await confirmDialog('Neues Rätsel?', 'Das laufende Rätsel wird dabei beendet.', 'Neues Rätsel'))) return;
        startNew(diff);
      },
    });
  }
  list.push({ label: 'Statistik', icon: 'star', onClick: () => showStats() });
  return list;
}

function dailyInfo() {
  const st = loadSlot('daily');
  const today = st && st.day === todayKey();
  let sub = '6×6 · mit Löchern';
  if (today && !st.done && st.undo.length) sub = `${Math.round(G.progress(st) * 100)} % gelöst`;
  return { done: isDailyDone(ID), sub, streak: dailyStreak(ID), onClick: () => go('daily') };
}

function menuStats() {
  const s = stats.get();
  const d = curDiff();
  const streak = dailyStreak(ID);
  return [
    { label: 'Gelöst', value: wonTotal() },
    { label: 'Ohne Tipp', value: s.noHint },
    { label: 'Bestzeit', value: s.best[d] ? formatTime(s.best[d]) : '–' },
    { label: 'Tagesserie', value: streak ? `🔥 ${streak}` : '0' },
  ];
}

function showMenu() {
  reportSummary(ID, summaryText());
  let diff = curDiff();
  const menu = gameMenu({
    id: ID,
    title: 'Zahlenschlange',
    tagline: 'Zahlen der Reihe nach verbinden',
    accent: ACCENT,
    art: menuArt(),
    primary: primaryFor(diff),
    daily: dailyInfo(),
    modes: {
      label: 'Schwierigkeit',
      value: diff,
      options: difficulties.map((d) => ({ id: d.id, label: d.title, sub: sizeOf(d) })),
      onChange(id) {
        diff = id;
        store.set(K.diff, id);
        menu.update({ primary: primaryFor(id), secondary: secondaryFor(id), stats: menuStats() });
      },
    },
    secondary: secondaryFor(diff),
    stats: menuStats(),
    onHelp: () => showHowTo(),
    backHref: '../',
  });
  app.replaceChildren(menu);
}

async function showStats() {
  const s = stats.get();
  const tile = (v, l) => h('div', null, h('b', null, String(v)), h('small', null, l));
  const rows = difficulties.map((d) => h('div.nx-win-tiles', null,
    tile(s.won[d.id] || 0, `${d.title} gelöst`), tile(s.best[d.id] ? formatTime(s.best[d.id]) : '–', 'Bestzeit')));
  const content = h('div.nx-win', null, ...rows,
    h('div.nx-win-tiles', null, tile(s.daily, 'Tagesrätsel'), tile(s.noHint, 'Ohne Tipp'), tile(formatTime(s.time), 'Spielzeit')));
  await showModal({ title: 'Statistik', content, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

// ---------- Spiel ----------

function showGame(slot) {
  const isDaily = slot === 'daily';
  let st = loadSlot(slot);
  if (isDaily) {
    const day = todayKey();
    if (!st || st.day !== day) { st = G.newGame({ day }); saveSlot('daily', st); }
  } else {
    store.set(K.diff, slot);
    if (!st) {
      const n = nextNumber(slot);
      st = G.newGame({ diff: slot, number: n });
      bumpNumber(slot, n);
      saveSlot(slot, st);
    }
  }
  const p = st.puzzle;
  const spec = difficultyById(isDaily ? 'daily' : slot);
  let torn = false;
  let busy = false;
  let clock = null;
  let active = -1;
  const save = () => {
    if (clock) st.elapsed = clock.elapsed;
    const cur = store.get(K.game(slot), null);
    if (cur && cur.created && cur.created !== st.created) return;
    saveSlot(slot, st);
  };
  const solPos = []; p.sol.forEach((v, i) => { if (v > 0) solPos[v] = i; });
  // Lücken zwischen gegebenen Zahlen, die schon einmal geschlossen wurden (Lob nur beim ersten Mal)
  const cheered = new Set(G.closedSegments(st).map((g) => g.key));
  let praised = 0;
  const ends = [solPos[1], solPos[p.N]];

  // --- DOM ---
  const timer = timerPill();
  const top = playTopbar({
    title: isDaily ? 'Tagesrätsel' : spec.title,
    sub: isDaily ? `${sizeOf(p)} · 1 bis ${p.N}` : `Rätsel Nr. ${st.number} · 1 bis ${p.N}`,
    onBack: () => go(''),
    onHelp: () => showHowTo(),
    extra: [timer.el],
  });
  const nextEl = h('b.hd-next');
  const progEl = h('span.hd-prog');
  const bar = h('i');
  const info = h('div.hd-info.nx-card', null, h('div.hd-info-mid', null, nextEl, h('div.nm-bar.hd-bar', null, bar)), progEl);
  const board = buildBoard(p);
  const card = h('div.hd-card.nx-card', null, board.el);
  const coach = coachBubble('');
  const stack = h('div.hd-stack', null, card, coach.el);
  const area = h('div.nx-board-area', null, stack);

  const undoBtn = toolButton({ icon: 'undo', label: 'Zurück', onClick: () => doUndo() });
  const hintBtn = toolButton({ icon: 'bulb', label: 'Tipp', onClick: () => doHint() });
  const eraseBtn = toolButton({ icon: 'eraser', label: 'Löschen', onClick: () => doErase() });
  const main = h('main.nx-main', null, info, area, toolbar(undoBtn, hintBtn, eraseBtn));
  const root = h('div.nx-screen.hd-play.enter', null, top.el, main);
  app.replaceChildren(root);

  function render() {
    board.render(st.vals, p.given, G.links(st), { active, bad: G.conflicts(st), notes: st.notes, ends });
    const placed = st.vals.filter((v) => v > 0).length;
    progEl.textContent = `${placed} / ${p.N}`;
    bar.style.width = Math.round((placed / p.N) * 100) + '%';
    const k = active >= 0 ? st.vals[active] : 0;
    if (st.done) nextEl.textContent = 'Geschafft – alles verbunden!';
    else if (k > 0 && k < p.N) {
      const pos = G.positions(st);
      nextEl.textContent = pos[k + 1] >= 0 ? `${k} → ${k + 1} steht schon` : `Weiter mit ${k + 1}`;
    } else nextEl.textContent = 'Zieh von einer Zahl aus';
    undoBtn.setDisabled(!st.undo.length || st.done);
    eraseBtn.setDisabled(st.done || !(active >= 0 && st.vals[active] > 0 && !p.given[active]));
    hintBtn.setDisabled(st.done);
  }

  function layout() {
    const w = area.clientWidth - 24, hh = area.clientHeight - 24;
    if (w > 0 && hh > 0) { board.layout(w, hh); render(); }
  }
  const ro = new ResizeObserver(layout);
  ro.observe(area);
  layout();

  // --- Coach-Mark beim ersten Rätsel ---
  let coachOn = !store.get(K.coach, false) && !st.done && !st.undo.length;
  function coachTarget() {
    const pos = G.positions(st);
    for (let k = 1; k < p.N; k++) {
      if (pos[k] >= 0 && pos[k + 1] < 0) return pos[k];
    }
    return -1;
  }
  function updateCoach() {
    if (!coachOn) { board.grid.coach(-1); coach.hide(); return; }
    const t = coachTarget();
    board.grid.coach(t);
    coach.show(t >= 0 ? `Zieh von der ${st.vals[t]} zum Nachbarfeld` : '');
  }
  updateCoach();
  const coachDone = () => { if (coachOn) { coachOn = false; store.set(K.coach, true); updateCoach(); } };

  clock = st.done ? null : runClock(st.elapsed, (ms) => timer.set(ms));
  if (st.done) timer.set(st.elapsed);

  // --- Eingabe ---
  let drag = null;
  let dragBefore = null;
  bindPointer(board.grid.el, board.grid, {
    down: (i) => {
      if (busy || st.done || i < 0) return;
      closePopover();
      if (st.vals[i] > 0) { drag = { cells: [i], placed: [] }; dragBefore = st.vals.slice(); }
    },
    move: (i) => {
      if (!drag) return;
      const r = G.dragStep(st, drag, i);
      if (!r) return;
      active = drag.cells[drag.cells.length - 1];
      if (r === 'place') coachDone();
      if (r === 'advance' && p.given[i]) { board.grid.flash(i, 'ng-pop', 420); sfx.play('pop'); }
      render();
      if (st.done) endDrag();
    },
    up: () => endDrag(),
    cancel: () => endDrag(),
    tap: (i) => onTap(i),
  }, { inner: 0.7 });

  function endDrag() {
    if (!drag) return;
    const changed = dragBefore && dragBefore.some((v, k) => v !== st.vals[k]);
    if (changed) {
      st.undo.push(dragBefore);
      if (st.undo.length > 60) st.undo.shift();
      if (drag.placed.length) sfx.play('place');
    }
    drag = null; dragBefore = null;
    afterChange();
  }

  function onTap(i) {
    if (busy || st.done || i < 0 || G.isHole(st, i)) return;
    const v = st.vals[i];
    if (v > 0) { active = active === i ? -1 : i; render(); return; }
    // leeres Feld: direkt die nächste Zahl setzen, wenn es passt
    if (active >= 0 && st.vals[active] > 0 && st.vals[active] < p.N && touching(p.w, active, i)) {
      const nk = st.vals[active] + 1;
      const pos = G.positions(st);
      if (!(pos[nk] >= 0 && p.given[pos[nk]])) {
        G.snapshot(st);
        G.place(st, i, nk);
        active = i;
        sfx.play('place');
        board.grid.flash(i, 'ng-pop', 420);
        coachDone();
        afterChange();
        return;
      }
    }
    openPad(i);
  }

  function openPad(i) {
    const cands = G.candidates(st, i);
    if (!cands.length && !(st.notes[i] && st.notes[i].length)) {
      toast('Hier passt noch keine Zahl – zieh von einer Zahl aus', 2200);
      board.grid.flash(i, 'ng-shake', 400);
      return;
    }
    active = i;
    render();
    const marked = new Set(st.notes[i] || []);
    const values = [...new Set([...cands, ...marked])].sort((a, b) => a - b);
    const pad = numPad({
      values,
      marked,
      cols: Math.min(4, Math.max(2, values.length)),
      notes: { on: false },
      onPick: (k, noteMode) => {
        if (noteMode) {
          G.toggleNote(st, i, k);
          pad.setMarked(new Set(st.notes[i] || []));
          render();
          save();
          return;
        }
        pop.close();
        G.snapshot(st);
        G.place(st, i, k);
        active = i;
        sfx.play('place');
        board.grid.flash(i, 'ng-pop', 420);
        coachDone();
        afterChange();
      },
    });
    const pop = popover(board.cell(i), pad.el, { onClose: () => { if (!torn) render(); } });
  }

  function doUndo() {
    if (busy || !G.undo(st)) return;
    if (active >= 0 && st.vals[active] <= 0) active = -1;
    afterChange();
  }

  function doErase() {
    if (busy || st.done || active < 0 || p.given[active] || st.vals[active] <= 0) {
      if (!st.done) toast('Tippe zuerst eine eigene Zahl an');
      return;
    }
    G.snapshot(st);
    G.clearCell(st, active);
    board.grid.flash(active, 'ng-pop', 300);
    afterChange();
  }

  function doHint() {
    if (busy || st.done) return;
    closePopover();
    const hnt = G.applyHint(st);
    if (!hnt) return;
    sfx.play('sparkle');
    board.grid.flash(hnt.cell, 'hinted', 1500);
    if (hnt.type === 'wrong') toast(`Die ${hnt.k} gehört woanders hin`, 2000);
    else { active = hnt.cell; toast(`Die ${hnt.k} kommt hierhin`, 1600); }
    coachDone();
    afterChange({ quiet: true });
  }

  /** Neu geschlossene Lücke: Abschnitt leuchtet auf, dazu ein kurzes Lob. */
  function cheerSegments(quiet) {
    if (st.done) return;
    const fresh = G.closedSegments(st).filter((g) => !cheered.has(g.key));
    if (!fresh.length) return;
    fresh.forEach((g) => cheered.add(g.key));
    let n = 0;
    for (const g of fresh) for (const c of g.cells) { const d = 40 * n++; setTimeout(() => !torn && board.grid.flash(c, 'glow', 700), d); }
    if (quiet) return;
    setTimeout(() => !torn && sfx.play('sparkle'), 170);
    const len = fresh.reduce((m, g) => Math.max(m, g.b - g.a), 0);
    praise(stack, fresh.length > 1 ? 'Doppelt verbunden!' : len >= 5 ? praiseWord(praised++) : 'Verbunden!', { y: 0.42, small: fresh.length > 1 });
  }

  function afterChange(opts = {}) {
    render();
    cheerSegments(opts.quiet);
    save();
    reportSummary(ID, isDaily ? summaryText() : `${spec.title} · Nr. ${st.number} · ${Math.round(G.progress(st) * 100)} %`);
    if (st.done) win();
  }

  async function win() {
    if (busy) return;
    busy = true;
    closePopover();
    if (clock) { st.elapsed = clock.elapsed; clock.stop(); clock = null; timer.set(st.elapsed); }
    active = -1;
    render();
    let newBest = false;
    if (!st.counted) {
      st.counted = true;
      stats.update((s) => {
        s.time += st.elapsed;
        if (!st.hints) s.noHint++;
        if (isDaily) s.daily++;
        else {
          s.won[slot] = (s.won[slot] || 0) + 1;
          if (!s.best[slot] || st.elapsed < s.best[slot]) { newBest = !!s.best[slot]; s.best[slot] = Math.round(st.elapsed); }
        }
      });
      if (isDaily) markDailyDone(ID, st.day);
    }
    saveSlot(slot, st);
    reportSummary(ID, summaryText());
    // Die Schlange leuchtet von 1 bis N auf
    const step = Math.max(14, Math.min(40, 1200 / p.N));
    for (let k = 1; k <= p.N; k++) setTimeout(() => !torn && board.grid.flash(solPos[k], 'glow', 700), k * step);
    root.classList.add('won');
    await sleep(p.N * step + 300);
    if (torn) return;
    const v = await winSheet({
      title: isDaily ? 'Tagesrätsel gelöst!' : ['Geschafft!', 'Wunderbar!', 'Super gelöst!'][st.number % 3],
      stars: isDaily ? null : G.starsFor(st),
      badge: isDaily ? '🗓️' : null,
      tiles: [
        { value: formatTime(st.elapsed), label: 'Zeit' },
        { value: p.N, label: 'Zahlen' },
        { value: st.hints, label: st.hints === 1 ? 'Tipp' : 'Tipps' },
      ],
      note: newBest ? '🏆 Neue Bestzeit!' : isDaily ? `Serie: ${dailyStreak(ID)} ${dailyStreak(ID) === 1 ? 'Tag' : 'Tage'} · Morgen wartet eine neue Schlange.` : `${spec.title} · Rätsel Nr. ${st.number}`,
      colors: COLORS,
      buttons: isDaily
        ? [{ label: 'Zum Menü', value: 'menu', primary: true }]
        : [{ label: 'Nächstes Rätsel', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }],
    });
    if (torn) return;
    if (v === 'next') startNew(slot);
    else go('');
  }

  const onHide = () => save();
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);
  if (st.done) setTimeout(() => !torn && win(), 250);

  window.__hd = {
    get state() { return st; },
    slot,
    center: (i) => board.grid.center(i),
    get busy() { return busy; },
    get active() { return active; },
  };

  teardown = () => {
    torn = true;
    closePopover();
    save();
    if (clock) clock.stop();
    ro.disconnect();
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onHide);
  };
}

route();
if (!tutorialSeen(ID)) showHowTo();
