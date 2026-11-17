// Zahlensummen – Spielpause. Menü, Spielansicht, Routen (#play/<stufe>, #daily).
import { setupPage, h, toast, showModal, confirmDialog, sleep } from '../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { gameMenu } from '../shared/gamemenu.js';
import { showTutorial, tutorialSeen } from '../shared/tutorial.js';
import { bindPointer } from '../lib/numbers/grid.js';
import {
  makeRouter, playTopbar, heartsBar, toolButton, onPress, winSheet, softSheet, statStore, runClock, coachBubble, formatTime, NI, praise, praiseWord,
} from '../lib/numbers/hud.js';
import * as G from './logic/game.js';
import { difficulties, difficultyById } from './data/difficulties.js';
import { buildBoard, paintMarks } from './board.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'numbersums';
const ACCENT = '#7b5ea7';
const COLORS = ['#7b5ea7', '#b9a3dd', '#ffd23f', '#ff8fa3', '#7fd6a8', '#ffffff'];
const K = {
  game: (slot) => `${ID}.game.${slot}`,
  next: `${ID}.next`,
  diff: `${ID}.diff`,
  tool: `${ID}.tool`,
  coach: `${ID}.coachDone`,
};
const stats = statStore(`${ID}.stats`, { won: {}, perfect: 0, best: {}, time: 0, daily: 0, started: 0 });

setupPage();
const app = document.getElementById('app');
let teardown = null;

const loadSlot = (slot) => { const st = store.get(K.game(slot), null); return G.validState(st) ? st : null; };
const saveSlot = (slot, st) => store.set(K.game(slot), st);
const nextNumber = (diff) => (store.get(K.next, {}) || {})[diff] || 1;
const bumpNumber = (diff, n) => store.update(K.next, {}, (o) => { o[diff] = Math.max(o[diff] || 1, n + 1); return o; });
const curDiff = () => { const d = store.get(K.diff, 'leicht'); return difficulties.some((x) => x.id === d) ? d : 'leicht'; };
const wonTotal = () => Object.values(stats.get().won).reduce((a, b) => a + b, 0) + stats.get().daily;

function running(diff) { const st = loadSlot(diff); return st && !st.done ? st : null; }

function summaryText() {
  const d = curDiff();
  const st = running(d);
  const parts = [];
  if (st) parts.push(`${difficultyById(d).title} · Nr. ${st.number} · ${Math.round(G.progress(st) * 100)} %`);
  else parts.push(wonTotal() ? `${wonTotal()} Rätsel gelöst` : 'Bereit für das erste Rätsel');
  if (isDailyDone(ID)) parts.push('Tagesrätsel ✓');
  return parts.join(' · ');
}

// ---------- Tutorial ----------

let tutorialOpen = null;
function showHowTo() {
  if (tutorialOpen) return tutorialOpen;
  tutorialOpen = showTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT }).finally(() => { tutorialOpen = null; });
  return tutorialOpen;
}

// ---------- Router ----------

const go = makeRouter(route);

function route() {
  if (teardown) { try { teardown(); } catch { /* ignore */ } teardown = null; }
  const [name, arg] = (location.hash || '').replace(/^#/, '').split('/');
  if (name === 'play' && difficulties.some((d) => d.id === arg)) return showGame(arg);
  if (name === 'daily') return showGame('daily');
  return showMenu();
}

function startNew(diff) {
  const n = nextNumber(diff);
  const st = G.newGame({ diff, number: n });
  bumpNumber(diff, n);
  saveSlot(diff, st);
  stats.update((s) => { s.started++; });
  go('play/' + diff);
}

// ---------- Menü ----------

function primaryFor(diff) {
  const spec = difficultyById(diff);
  const st = running(diff);
  if (st) {
    const pct = Math.round(G.progress(st) * 100);
    return { label: 'Weiterspielen', sub: `${spec.title} · Nr. ${st.number} · ${pct} %`, onClick: () => go('play/' + diff) };
  }
  return { label: 'Spielen', sub: `${spec.title} · Rätsel Nr. ${nextNumber(diff)}`, onClick: () => startNew(diff) };
}

function secondaryFor(diff) {
  const list = [];
  if (running(diff)) {
    list.push({
      label: 'Neues Rätsel', icon: 'plus',
      onClick: async () => {
        const st = running(diff);
        if (st && G.progress(st) > 0 && !(await confirmDialog('Neues Rätsel?', 'Das laufende Rätsel wird dabei beendet.', 'Neues Rätsel'))) return;
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
  let sub = '6×6 · Farben';
  if (today && !st.done && G.progress(st) > 0) sub = `${Math.round(G.progress(st) * 100)} % gelöst`;
  return { done: isDailyDone(ID), sub, streak: dailyStreak(ID), onClick: () => go('daily') };
}

function menuStats() {
  const s = stats.get();
  const d = curDiff();
  const streak = dailyStreak(ID);
  return [
    { label: 'Gelöst', value: wonTotal() },
    { label: 'Ohne Fehler', value: s.perfect },
    { label: 'Bestzeit', value: s.best[d] ? formatTime(s.best[d]) : '–' },
    { label: 'Tagesserie', value: streak ? `🔥 ${streak}` : '0' },
  ];
}

function showMenu() {
  reportSummary(ID, summaryText());
  let diff = curDiff();
  const menu = gameMenu({
    id: ID,
    title: 'Zahlensummen',
    tagline: 'Streichen, bis die Summen stimmen',
    accent: ACCENT,
    primary: primaryFor(diff),
    daily: dailyInfo(),
    modes: {
      label: 'Schwierigkeit',
      value: diff,
      options: difficulties.map((d) => ({ id: d.id, label: d.title, sub: `${d.n}×${d.n}${d.regions ? ' ◆' : ''}` })),
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
    h('div.nx-win-tiles', null, tile(s.daily, 'Tagesrätsel'), tile(s.perfect, 'Ohne Fehler'), tile(formatTime(s.time), 'Spielzeit')));
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
    if (!st || st.done) {
      if (st && st.done) { /* fertig: Ergebnis zeigen */ } else {
        const n = nextNumber(slot);
        st = G.newGame({ diff: slot, number: n });
        bumpNumber(slot, n);
        saveSlot(slot, st);
      }
    }
  }
  const p = st.puzzle;
  const spec = difficultyById(isDaily ? 'daily' : slot);
  let torn = false;
  let busy = false;
  let clock = null;
  let tool = store.get(K.tool, 'erase') === 'keep' ? 'keep' : 'erase';
  let lineStreak = 0;   // fertige Summen seit dem letzten Fehler (für Lob)
  let praised = 0;
  const save = () => {
    if (clock) st.elapsed = clock.elapsed;
    // nie ein inzwischen neu begonnenes Rätsel im selben Platz überschreiben
    const cur = store.get(K.game(slot), null);
    if (cur && cur.created && cur.created !== st.created) return;
    saveSlot(slot, st);
  };

  // --- DOM ---
  const hearts = heartsBar(3);
  hearts.set(st.lives);
  const top = playTopbar({
    title: isDaily ? 'Tagesrätsel' : spec.title,
    sub: isDaily ? `${p.n}×${p.n} · für alle gleich` : `Rätsel Nr. ${st.number} · ${p.n}×${p.n}`,
    onBack: () => go(''),
    onHelp: () => showHowTo(),
    extra: [hearts.el],
  });
  const board = buildBoard(p);
  const card = h('div.ns-card.nx-card', null, board.el);
  const coach = coachBubble('');
  const stack = h('div.ns-stack', null, card, coach.el);
  const area = h('div.nx-board-area.ns-area', null, stack);

  const hintBtn = toolButton({ icon: 'bulb', label: 'Tipp', onClick: () => doHint() });
  const eraseBtn = h('button.ns-tool', { type: 'button', 'data-tool': 'erase', html: NI.eraser + '<span>Radieren</span>' });
  const keepBtn = h('button.ns-tool', { type: 'button', 'data-tool': 'keep', html: NI.circle + '<span>Behalten</span>' });
  const toolSeg = h('div.ns-toolseg', null, eraseBtn, keepBtn);
  const restartBtn = toolButton({ icon: 'refresh', label: 'Neustart', onClick: () => doRestart() });
  const bar = h('div.nx-toolbar.ns-toolbar', null, hintBtn.el, toolSeg, restartBtn.el);
  const main = h('main.nx-main', null, area, bar);
  const root = h('div.nx-screen.ns-play.enter', null, top.el, main);
  app.replaceChildren(root);

  function setTool(t, silent) {
    tool = t;
    store.set(K.tool, t);
    eraseBtn.classList.toggle('on', t === 'erase');
    keepBtn.classList.toggle('on', t === 'keep');
    root.dataset.tool = t;
    if (!silent) updateCoach();
  }
  onPress(eraseBtn, () => setTool('erase'));
  onPress(keepBtn, () => setTool('keep'));
  setTool(tool, true);

  const render = () => paintMarks(board, p, st.marks, G.doneLines(st));
  render();

  function layout() {
    const w = area.clientWidth - 24, hh = area.clientHeight - 24;
    if (w > 0 && hh > 0) board.layout(w, hh);
  }
  const ro = new ResizeObserver(layout);
  ro.observe(area);
  layout();

  // --- Coach-Mark beim allerersten Rätsel ---
  let coachOn = !store.get(K.coach, false) && !st.done && G.progress(st) === 0;
  function updateCoach() {
    if (!coachOn) { board.grid.coach(-1); coach.hide(); return; }
    const hnt = G.findHintPrefer(st, tool === 'keep');
    if (!hnt) return;
    board.grid.coach(hnt.i);
    const want = hnt.keep ? 'keep' : 'erase';
    if (want !== tool) coach.show(want === 'keep' ? 'Wähle unten «Behalten»' : 'Wähle unten «Radieren»');
    else coach.show(want === 'keep' ? 'Diese Zahl zählt – tippe sie an' : 'Diese Zahl passt nicht – tippe sie an');
  }
  updateCoach();

  clock = st.done ? null : runClock(st.elapsed, () => {});

  // --- Eingabe: Tippen oder über mehrere Zellen wischen ---
  let dragOk = false;
  let dragCount = 0;
  bindPointer(board.grid.el, board.grid, {
    down: (i) => { dragOk = true; dragCount = 0; if (i >= 0) apply(i); },
    move: (i) => { if (dragOk) apply(i); },
    up: () => { dragOk = false; },
    cancel: () => { dragOk = false; },
  }, { inner: 0.8 });

  function apply(i) {
    if (busy || st.done || st.lives <= 0 || st.marks[i] !== 0) return;
    const res = G.act(st, i, tool);
    if (!res.ok) {
      if (res.wrong) {
        dragOk = false;
        lineStreak = 0;
        sfx.play('error');
        board.grid.flash(i, 'ng-shake', 420);
        board.grid.flash(i, 'wrong', 700);
        hearts.set(st.lives, true);
        if (navigator.vibrate) try { navigator.vibrate(30); } catch { /* ignore */ }
        save();
        if (res.out) outOfLives();
      }
      return;
    }
    if (dragCount++ === 0) sfx.play(tool === 'keep' ? 'place' : 'tap');
    afterResolve([i], res);
  }

  function afterResolve(cells, res, fromHint = false) {
    render();
    for (const i of cells) board.grid.flash(i, 'ng-pop', 420);
    res.auto.forEach((k, n) => setTimeout(() => !torn && board.grid.flash(k, 'ng-pop', 420), 60 + n * 30));
    if (res.lines.length) {
      sfx.play('sparkle');
      for (const key of res.lines) {
        const el = board.lineEl(key);
        if (el) { el.classList.remove('just'); void el.offsetWidth; el.classList.add('just'); }
      }
      lineStreak += res.lines.length;
      if (!res.won && !fromHint) {
        const n = res.lines.length;
        if (n >= 2) praise(stack, n === 2 ? 'Doppelt!' : n === 3 ? 'Dreifach!' : praiseWord(praised++));
        else if (lineStreak % 4 === 0) praise(stack, praiseWord(praised++));
      }
    }
    if (coachOn) { coachOn = false; store.set(K.coach, true); updateCoach(); }
    save();
    report();
    if (res.won) win();
  }

  function doHint() {
    if (busy || st.done) return;
    if (st.lives <= 0) return outOfLives();
    const r = G.applyHint(st);
    if (!r) return;
    const { hint, res } = r;
    sfx.play('sparkle');
    board.grid.flash(hint.i, 'hinted', 1500);
    if (hint.line) {
      const what = hint.line.kind === 'row' ? `Reihe ${hint.line.idx + 1}` : hint.line.kind === 'col' ? `Spalte ${hint.line.idx + 1}` : 'Farbbereich';
      toast(`${what}: Die ${p.digits[hint.i]} ${hint.keep ? 'zählt' : 'muss weg'}`, 2400);
      const el = board.lineEl(`${hint.line.kind}-${hint.line.idx}`);
      if (el) { el.classList.remove('hl'); void el.offsetWidth; el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 1600); }
    }
    afterResolve([hint.i], res, true);
  }

  async function doRestart() {
    if (busy) return;
    if (G.progress(st) > 0 && !(await confirmDialog('Von vorn beginnen?', 'Alle Markierungen werden entfernt.', 'Neu beginnen'))) return;
    if (torn) return;
    G.restart(st);
    hearts.set(st.lives);
    render();
    save();
  }

  async function outOfLives() {
    busy = true;
    await sleep(500);
    if (torn) return;
    const v = await softSheet({
      title: 'Keine Herzen mehr',
      emoji: '💜',
      text: 'Halb so wild! Spiel einfach mit neuen Herzen weiter – oder beginne das Rätsel von vorn.',
      buttons: [
        { label: 'Weiterspielen', value: 'refill', primary: true, icon: 'heart' },
        { label: 'Von vorn', value: 'restart' },
        { label: 'Zum Menü', value: 'menu', ghost: true },
      ],
    });
    busy = false;
    if (torn) return;
    if (v === 'refill') G.refill(st);
    else if (v === 'restart') G.restart(st);
    else { save(); go(''); return; }
    hearts.set(st.lives);
    render();
    save();
  }

  function report() {
    reportSummary(ID, isDaily ? summaryText() : `${spec.title} · Nr. ${st.number} · ${Math.round(G.progress(st) * 100)} %`);
  }

  async function win() {
    busy = true;
    if (clock) { st.elapsed = clock.elapsed; clock.stop(); clock = null; }
    const starsN = G.starsFor(st);
    let newBest = false;
    if (!st.counted) {
      st.counted = true;
      stats.update((s) => {
        s.time += st.elapsed;
        if (st.mistakes === 0 && st.refills === 0) s.perfect++;
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
    // kleine Welle über das Brett
    board.grid.cells.forEach((c, i) => setTimeout(() => !torn && board.grid.flash(i, 'ng-pop', 420), (Math.floor(i / p.n) + (i % p.n)) * 45));
    await sleep(700);
    if (torn) return;
    const v = await winSheet({
      title: isDaily ? 'Tagesrätsel gelöst!' : ['Geschafft!', 'Wunderbar!', 'Super gelöst!'][st.number % 3],
      stars: isDaily ? null : starsN,
      badge: isDaily ? '🗓️' : null,
      tiles: [
        { value: formatTime(st.elapsed), label: 'Zeit' },
        { value: st.mistakes, label: 'Fehler' },
        { value: st.hints, label: st.hints === 1 ? 'Tipp' : 'Tipps' },
      ],
      note: newBest ? '🏆 Neue Bestzeit!' : isDaily ? `Serie: ${dailyStreak(ID)} ${dailyStreak(ID) === 1 ? 'Tag' : 'Tage'} · Morgen gibt’s ein neues.` : `${spec.title} · Rätsel Nr. ${st.number}`,
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
  else if (st.lives <= 0) setTimeout(() => !torn && outOfLives(), 250);

  window.__ns = {
    get state() { return st; },
    slot,
    center: (i) => board.grid.center(i),
    get tool() { return tool; },
    get busy() { return busy; },
  };

  teardown = () => {
    torn = true;
    save();
    if (clock) clock.stop();
    ro.disconnect();
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onHide);
  };
}

route();
if (!tutorialSeen(ID)) showHowTo();
