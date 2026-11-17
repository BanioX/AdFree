// Zahlenpaare – Spielpause. Menü, Spielansicht, Routen (#play, #level/N, #endless, #daily).
import { setupPage, h, toast, showModal, confirmDialog, sleep } from '../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, tutorialSeen } from '../shared/tutorial.js';
import { CellGrid, bindPointer } from '../lib/numbers/grid.js';
import {
  makeRouter, playTopbar, pill, toolButton, toolbar, winSheet, softSheet, statStore, runClock, coachBubble, formatTime, NI,
} from '../lib/numbers/hud.js';
import * as G from './logic/game.js';
import { hintPair, findPairs, COLS, openCount } from './logic/rules.js';
import { GOAL_TEXT, levelSpec } from './data/levels.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'numbermatch';
const ACCENT = '#3c8dbc';
const COLORS = ['#3c8dbc', '#7cc4ec', '#ffd23f', '#ff8fa3', '#7fd6a8', '#ffffff'];
const K = {
  game: (slot) => `${ID}.game.${slot}`,
  progress: `${ID}.progress`,
  mode: `${ID}.mode`,
  coach: `${ID}.coachDone`,
};
const stats = statStore(`${ID}.stats`, { won: 0, pairs: 0, rows: 0, best: 0, endless: 0, daily: 0, time: 0, stars: 0 });

setupPage();
const app = document.getElementById('app');
let teardown = null;

const getProgress = () => ({ next: 1, stars: {}, ...(store.get(K.progress, {}) || {}) });
const setProgress = (p) => store.set(K.progress, p);

function loadSlot(slot) {
  const st = store.get(K.game(slot), null);
  return G.validState(st) ? st : null;
}
const saveSlot = (slot, st) => store.set(K.game(slot), st);

function goalLong(goal) {
  const t = GOAL_TEXT[goal.type];
  return typeof t.long === 'function' ? t.long(goal.n) : t.long;
}

function summaryText() {
  const lv = loadSlot('level');
  const p = getProgress();
  const parts = [];
  if (lv && !lv.done) parts.push(`Level ${lv.level} · ${goalLong(lv.goal)}`);
  else parts.push(p.next > 1 ? `Level ${p.next} wartet` : 'Bereit für Level 1');
  const best = stats.get().best;
  if (best) parts.push(`Rekord ${best}`);
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
  if (name === 'play') return showGame('level');
  if (name === 'level') {
    const n = parseInt(arg, 10);
    const p = getProgress();
    if (n >= 1 && n <= p.next) {
      const cur = loadSlot('level');
      if (!cur || cur.level !== n || cur.done) saveSlot('level', G.newGame('level', { level: n }));
    }
    history.replaceState(null, '', location.pathname + location.search + '#play');
    return showGame('level');
  }
  if (name === 'endless') return showGame('endless');
  if (name === 'daily') return showGame('daily');
  return showMenu();
}

// ---------- Menü ----------

function menuArt() {
  // Live-Vorschau: die ersten Reihen des laufenden Levels (oder ein hübsches Beispiel)
  const st = loadSlot('level');
  const cells = st && !st.done && st.cells.length >= 18 ? st.cells.slice(0, 27)
    : '419286537826347195173468291'.split('').map((d, k) => ({ v: +d, x: [2, 3, 9, 13, 14, 22].includes(k), s: k === 16 }));
  const el = h('div.nm-art');
  const grid = h('div.nm-art-grid');
  for (let k = 0; k < 27; k++) {
    const c = cells[k];
    grid.append(c ? h('span' + (c.x ? '.x' : '') + (c.s ? '.s' : ''), null, String(c.v)) : h('span'));
  }
  el.append(grid);
  return el;
}

function primaryFor(mode) {
  if (mode === 'endless') {
    const st = loadSlot('endless');
    if (st && !st.lost) return { label: 'Weiterspielen', sub: `Endlos · Runde ${st.round} · ${st.score} Punkte`, onClick: () => go('endless') };
    const best = stats.get().best;
    return { label: 'Spielen', sub: best ? `Endlos · Rekord ${best} Punkte` : 'Endlos · Punkte sammeln', onClick: () => { saveSlot('endless', G.newGame('endless')); go('endless'); } };
  }
  const st = loadSlot('level');
  const p = getProgress();
  if (st && !st.done && (st.pairs > 0 || st.cells.length !== st.start.length)) {
    return { label: 'Weiterspielen', sub: `Level ${st.level} · ${goalLong(st.goal)}`, onClick: () => go('play') };
  }
  const spec = levelSpec(p.next);
  return { label: 'Spielen', sub: `Level ${p.next} · ${goalLong(spec.goal)}`, onClick: () => go('level/' + p.next) };
}

function dailyInfo() {
  const st = loadSlot('daily');
  const today = st && st.day === todayKey();
  let sub = 'Feld leeren';
  if (today && !st.done && st.pairs) sub = `Noch ${openCount(st.cells)} Zahlen`;
  return { done: isDailyDone(ID), sub, streak: dailyStreak(ID), onClick: () => go('daily') };
}

function menuStats() {
  const s = stats.get();
  const p = getProgress();
  const starSum = Object.values(p.stars).reduce((a, b) => a + b, 0);
  const streak = dailyStreak(ID);
  return [
    { label: 'Level', value: p.next },
    { label: 'Sterne', value: `${starSum} ★` },
    { label: 'Rekord', value: s.best || '–' },
    { label: 'Tagesserie', value: streak ? `🔥 ${streak}` : '0' },
  ];
}

function levelMap() {
  const p = getProgress();
  const from = Math.max(1, p.next - 14);
  const wrap = h('div.card');
  const grid = h('div.nx-levels');
  for (let n = from; n < from + 20; n++) {
    const won = p.stars[n] != null;
    const cls = n === p.next ? '.cur' : won ? '.won' : n > p.next ? '.locked' : '';
    const b = h('button.nx-lv' + cls, { type: 'button', 'aria-label': 'Level ' + n, disabled: n > p.next ? true : null },
      h('span', null, String(n)), h('small', null, won ? '★'.repeat(p.stars[n]) : ''));
    if (n <= p.next) b.addEventListener('click', () => { sfx.play('tap'); go('level/' + n); });
    grid.append(b);
  }
  wrap.append(grid, h('p.nx-more', null, 'Die Level gehen immer weiter – jedes Feld ist sicher lösbar.'));
  return wrap;
}

function showMenu() {
  reportSummary(ID, summaryText());
  let mode = store.get(K.mode, 'level');
  if (mode !== 'level' && mode !== 'endless') mode = 'level';
  const secondaryFor = (m) => {
    const list = [{ label: 'Statistik', icon: 'star', onClick: () => showStats() }];
    const st = loadSlot(m === 'endless' ? 'endless' : 'level');
    if (st && !st.done && !st.lost && st.pairs > 0) {
      list.unshift({
        label: m === 'endless' ? 'Neues Spiel' : 'Neu starten', icon: 'refresh',
        onClick: async () => {
          if (!(await confirmDialog(m === 'endless' ? 'Neues Spiel?' : 'Level neu starten?', 'Der aktuelle Stand geht dabei verloren.', 'Ja, neu'))) return;
          if (m === 'endless') { recordEndless(st); saveSlot('endless', G.newGame('endless')); go('endless'); }
          else { saveSlot('level', G.restart(st)); go('play'); }
        },
      });
    }
    return list;
  };
  const menu = gameMenu({
    id: ID,
    title: 'Zahlenpaare',
    tagline: 'Gleiche oder Summe 10 streichen',
    accent: ACCENT,
    art: menuArt(),
    primary: primaryFor(mode),
    daily: dailyInfo(),
    modes: {
      label: 'Spielart',
      value: mode,
      options: [
        { id: 'level', label: 'Level', sub: `Level ${getProgress().next}` },
        { id: 'endless', label: 'Endlos', sub: stats.get().best ? `Rekord ${stats.get().best}` : 'Punkte jagen' },
      ],
      onChange(id) {
        mode = id;
        store.set(K.mode, id);
        menu.update({ primary: primaryFor(id), secondary: secondaryFor(id) });
      },
    },
    secondary: secondaryFor(mode),
    stats: menuStats(),
    sections: [menuSection('Levels', levelMap())],
    onHelp: () => showHowTo(),
    backHref: '../',
  });
  app.replaceChildren(menu);
}

async function showStats() {
  const s = stats.get();
  const p = getProgress();
  const tile = (v, l) => h('div', null, h('b', null, String(v)), h('small', null, l));
  const content = h('div.nx-win', null,
    h('div.nx-win-tiles', null, tile(s.won, 'Level gewonnen'), tile(s.pairs, 'Paare')),
    h('div.nx-win-tiles', null, tile(s.rows, 'Reihen'), tile(Object.values(p.stars).reduce((a, b) => a + b, 0), 'Sterne')),
    h('div.nx-win-tiles', null, tile(s.best || '–', 'Endlos-Rekord'), tile(s.endless, 'Endlos-Spiele')),
    h('div.nx-win-tiles', null, tile(s.daily, 'Tagesrätsel'), tile(formatTime(s.time), 'Spielzeit')));
  await showModal({ title: 'Statistik', content, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

function recordEndless(st) {
  if (st.counted) return;
  st.counted = true;
  stats.update((s) => { s.endless++; s.best = Math.max(s.best, st.score); s.time += st.elapsed; });
}

// ---------- Spiel ----------

function showGame(slot) {
  let st = loadSlot(slot);
  if (slot === 'daily') {
    const day = todayKey();
    if (!st || st.day !== day) { st = G.newGame('daily', { day }); saveSlot('daily', st); }
  } else if (slot === 'endless') {
    if (!st || st.lost) { st = G.newGame('endless'); saveSlot('endless', st); }
  } else if (!st) {
    st = G.newGame('level', { level: getProgress().next });
    saveSlot('level', st);
  }
  if (slot !== 'daily') store.set(K.mode, slot);

  let torn = false;
  let clock = null;
  let busy = false;
  let sel = -1;
  let hint = null;
  const save = () => {
    st.elapsed = clock ? clock.elapsed : st.elapsed;
    // nie ein inzwischen neu begonnenes Spiel im selben Platz überschreiben
    const cur = store.get(K.game(slot), null);
    if (cur && cur.created && cur.created !== st.created) return;
    saveSlot(slot, st);
  };

  // --- DOM ---
  const title = slot === 'daily' ? 'Tagesrätsel' : slot === 'endless' ? 'Endlos' : `Level ${st.level}`;
  const scorePill = pill('star', st.score);
  scorePill.el.classList.add('nm-score');
  const top = playTopbar({ title, sub: goalLong(st.goal), onBack: () => leave(), onHelp: () => showHowTo(), extra: [scorePill.el] });

  const goalIcon = h('span.nm-goal-ic');
  const goalText = h('b.nm-goal-txt');
  const goalBar = h('i');
  const goalSide = h('span.nm-goal-side');
  const goalEl = h('div.nm-goal.nx-card', null, goalIcon, h('div.nm-goal-mid', null, goalText, h('div.nm-bar', null, goalBar)), goalSide);

  const grid = new CellGrid({ cols: COLS, count: 0, className: 'nm-grid', gap: 0 });
  const scroller = h('div.nm-scroll', null, grid.el);
  const card = h('div.nm-board.nx-card', null, scroller);
  const coach = coachBubble('');
  const stack = h('div.nm-stack', null, card, coach.el);
  const area = h('div.nx-board-area.nm-area', null, stack);

  const hintBtn = toolButton({ icon: 'bulb', label: 'Tipp', onClick: () => doHint() });
  const addBtn = toolButton({ icon: 'plusRows', label: 'Hinzufügen', onClick: () => doAdd(), className: 'nm-add' });
  const restartBtn = toolButton({ icon: 'refresh', label: slot === 'endless' ? 'Neu' : 'Neustart', onClick: () => doRestart() });
  const bar = toolbar(hintBtn, addBtn, restartBtn);

  const main = h('main.nx-main', null, goalEl, area, bar);
  const root = h('div.nx-screen.nm-play.enter', null, top.el, main);
  app.replaceChildren(root);

  // --- Darstellung ---
  function renderCell(i) {
    const c = grid.cell(i), d = st.cells[i];
    if (!c) return;
    let span = c.firstChild;
    if (!span) { span = h('span'); c.append(span); }
    span.textContent = String(d.v);
    c.className = 'ng-cell nm-cell' + (d.x ? ' x' : '') + (d.s ? ' star' : '') + (i === sel ? ' sel' : '')
      + (hint && hint.includes(i) ? ' hint' : '');
  }
  function render() {
    grid.build(st.cells.length);
    for (let i = 0; i < st.cells.length; i++) renderCell(i);
    // leere Plätze bis zum Reihenende als Platzhalter
    grid.el.style.setProperty('--rows', Math.max(1, grid.rows));
    renderHud();
  }
  function renderHud() {
    scorePill.set(st.score);
    addBtn.setBadge(st.addsLeft);
    addBtn.setDisabled(!G.canAdd(st));
    hintBtn.setDisabled(st.done);
    const g = st.goal;
    const gp = G.goalProgress(st);
    let pct = 0;
    if (g.type === 'stars') {
      goalIcon.innerHTML = NI.star; goalIcon.className = 'nm-goal-ic star';
      goalText.textContent = `Sterne ${gp.have} / ${gp.need}`;
      pct = gp.have / gp.need;
    } else if (g.type === 'rows') {
      goalIcon.innerHTML = NI.grid; goalIcon.className = 'nm-goal-ic rows';
      goalText.textContent = `Reihen ${gp.have} / ${gp.need}`;
      pct = gp.have / gp.need;
    } else if (g.type === 'clear') {
      goalIcon.innerHTML = NI.flag; goalIcon.className = 'nm-goal-ic clear';
      goalText.textContent = gp.left ? `Noch ${gp.left} Zahlen` : 'Feld leer!';
      pct = gp.need ? gp.have / gp.need : 1;
    } else {
      goalIcon.innerHTML = NI.trophy; goalIcon.className = 'nm-goal-ic score';
      const best = stats.get().best;
      goalText.textContent = `Runde ${st.round}`;
      pct = best ? Math.min(1, st.score / best) : 0;
      goalSide.textContent = best ? `Rekord ${Math.max(best, st.score)}` : '';
    }
    if (g.type !== 'score') goalSide.textContent = `${openCount(st.cells)} offen`;
    goalBar.style.width = Math.round(pct * 100) + '%';
  }

  // --- Grösse ---
  function layout() {
    const w = area.clientWidth - 16;
    if (w <= 0) return;
    grid.fit(w, 0, { min: 30, max: 54 });
    stack.style.maxHeight = area.clientHeight + 'px';
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(area);

  render();
  layout();

  // --- Coach-Mark (Level 1) ---
  let coachOn = slot === 'level' && st.level === 1 && !store.get(K.coach, false) && st.pairs === 0;
  function updateCoach() {
    if (!coachOn) { grid.coach(-1); coach.hide(); return; }
    const p = hintPair(st.cells);
    if (!p) return;
    const target = sel === p[0] ? p[1] : p[0];
    grid.coach(target);
    coach.show(sel < 0 ? 'Tippe zwei passende Zahlen an' : 'Gleich oder zusammen 10 ✓');
  }
  updateCoach();

  // --- Uhr ---
  clock = st.done || st.lost ? null : runClock(st.elapsed, () => {});

  // --- Eingabe ---
  bindPointer(grid.el, grid, { tap: (i) => onTap(i) }, { threshold: 10 });

  function clearHint() {
    if (!hint) return;
    const old = hint; hint = null;
    old.forEach((k) => renderCell(k));
  }

  function onTap(i) {
    if (busy || st.done || st.lost || i < 0 || i >= st.cells.length) return;
    const d = st.cells[i];
    if (d.x) return;
    clearHint();
    if (sel < 0) { sel = i; renderCell(i); updateCoach(); return; }
    if (sel === i) { sel = -1; renderCell(i); updateCoach(); return; }
    const a = sel;
    sel = -1;
    const before = st.cells.length;
    const res = G.play(st, a, i);
    if (!res.ok) {
      // passt nicht: kurz schütteln, neue Zahl auswählen
      sfx.play('error');
      grid.flash(a, 'ng-shake', 400);
      grid.flash(i, 'ng-shake', 400);
      renderCell(a);
      sel = i; renderCell(i);
      updateCoach();
      return;
    }
    afterPair(a, i, res, before);
  }

  async function afterPair(a, b, res, beforeLen) {
    busy = true;
    // Zuerst nur die beiden streichen (alte Anordnung)
    for (const k of [a, b]) {
      const c = grid.cell(k);
      c.classList.remove('sel', 'hint');
      c.classList.add('x', 'ng-pop');
      if (c.classList.contains('star')) c.classList.add('got');
    }
    sfx.play(res.stars ? 'sparkle' : 'pop');
    floatPoints(b, res.points);
    if (coachOn) { coachOn = false; store.set(K.coach, true); grid.coach(-1); coach.hide(); }
    if (res.rows.length) {
      await sleep(260);
      for (const r of res.rows) {
        for (let k = r * COLS; k < Math.min(beforeLen, (r + 1) * COLS); k++) grid.cell(k) && grid.cell(k).classList.add('nm-gone');
      }
      sfx.play('whoosh');
      await sleep(340);
    }
    if (torn) return;
    if (res.roundClear && st.mode === 'endless') {
      toast(`Runde geschafft! +${res.points}`);
      sfx.play('sparkle');
    }
    render();
    if (res.roundClear && st.mode === 'endless') {
      grid.cells.forEach((c, k) => { c.classList.add('nm-new'); c.style.animationDelay = k * 12 + 'ms'; });
      scroller.scrollTop = 0;
    }
    stats.update((s) => { s.pairs++; s.rows += res.rows.length; });
    save();
    report();
    busy = false;
    if (st.done) return win();
    checkStuck();
  }

  function floatPoints(i, pts) {
    const r = grid.rectOf(i);
    const cr = card.getBoundingClientRect();
    if (!r) return;
    const f = h('div.nm-float', null, '+' + pts);
    f.style.left = (r.left - cr.left + r.width / 2) + 'px';
    f.style.top = (r.top - cr.top) + 'px';
    card.append(f);
    setTimeout(() => f.remove(), 900);
  }

  function checkStuck() {
    if (st.lost) return lost();
    if (!findPairs(st.cells).length) {
      addBtn.pulse();
      toast('Keine Paare mehr – füge Zahlen hinzu', 2400);
    }
  }

  async function doAdd() {
    if (busy || !G.canAdd(st)) return;
    clearHint();
    if (sel >= 0) { const s0 = sel; sel = -1; renderCell(s0); }
    const before = st.cells.length;
    const n = G.addNumbers(st);
    if (!n) return;
    sfx.play('whoosh');
    render();
    for (let k = before; k < st.cells.length; k++) {
      const c = grid.cell(k);
      c.classList.add('nm-new');
      c.style.animationDelay = Math.min(900, (k - before) * 18) + 'ms';
    }
    coach.hide();
    save();
    report();
    // zum Anfang der neuen Zahlen scrollen
    const first = grid.cell(before);
    if (first) {
      const target = first.offsetTop - 12;
      scroller.scrollTo({ top: Math.max(0, target - scroller.clientHeight / 3), behavior: 'smooth' });
    }
    checkStuck();
  }

  function doHint() {
    if (busy || st.done) return;
    const p = hintPair(st.cells);
    if (!p) {
      if (G.canAdd(st)) { addBtn.pulse(); toast('Kein Paar mehr – füge Zahlen hinzu'); }
      return;
    }
    clearHint();
    if (sel >= 0) { const s0 = sel; sel = -1; renderCell(s0); }
    hint = p;
    st.hints++;
    p.forEach((k) => renderCell(k));
    sfx.play('sparkle');
    const c = grid.cell(p[0]);
    if (c) {
      const top = c.offsetTop, bottom = grid.cell(p[1]).offsetTop + grid.cs;
      if (top < scroller.scrollTop || bottom > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' });
      }
    }
    save();
  }

  async function doRestart() {
    if (busy) return;
    if (slot === 'endless') {
      if (st.pairs > 0 && !(await confirmDialog('Neues Spiel?', `Deine ${st.score} Punkte werden gewertet.`, 'Neues Spiel'))) return;
      recordEndless(st);
      st = G.newGame('endless');
    } else {
      if (st.pairs > 0 && !(await confirmDialog('Neu starten?', 'Das Feld beginnt wieder von vorn.', 'Neu starten'))) return;
      G.restart(st);
    }
    if (torn) return;
    sel = -1; hint = null;
    saveSlot(slot, st);
    route();
  }

  function report() {
    if (slot === 'level') reportSummary(ID, `Level ${st.level} · ${goalLong(st.goal)}`);
    else if (slot === 'endless') reportSummary(ID, `Endlos · ${st.score} Punkte`);
    else reportSummary(ID, summaryText());
  }

  async function win() {
    if (clock) clock.stop();
    st.elapsed = clock ? clock.elapsed : st.elapsed;
    const starsN = G.starsFor(st);
    if (!st.counted) {
      st.counted = true;
      stats.update((s) => { s.time += st.elapsed; if (slot === 'daily') s.daily++; else s.won++; });
      if (slot === 'level') {
        const p = getProgress();
        p.stars[st.level] = Math.max(p.stars[st.level] || 0, starsN);
        p.next = Math.max(p.next, st.level + 1);
        setProgress(p);
      }
      if (slot === 'daily') markDailyDone(ID, st.day);
    }
    saveSlot(slot, st);
    reportSummary(ID, summaryText());
    await sleep(450);
    if (torn) return;
    const tiles = [
      { value: st.score, label: 'Punkte' },
      { value: st.pairs, label: 'Paare' },
      { value: formatTime(st.elapsed), label: 'Zeit' },
    ];
    const isDaily = slot === 'daily';
    const v = await winSheet({
      title: isDaily ? 'Tagesrätsel gelöst!' : ['Geschafft!', 'Super!', 'Wunderbar!'][st.level % 3],
      stars: isDaily ? null : starsN,
      badge: isDaily ? '🗓️' : null,
      tiles,
      note: isDaily ? `Serie: ${dailyStreak(ID)} ${dailyStreak(ID) === 1 ? 'Tag' : 'Tage'} · Morgen wartet ein neues Feld.` : `Level ${st.level}: ${goalLong(st.goal)} ✓`,
      colors: COLORS,
      buttons: isDaily
        ? [{ label: 'Zum Menü', value: 'menu', primary: true }]
        : [{ label: 'Nächstes Level', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }],
    });
    if (torn) return;
    if (v === 'next') go('level/' + (st.level + 1));
    else go('');
  }

  async function lost() {
    if (clock) clock.stop();
    st.elapsed = clock ? clock.elapsed : st.elapsed;
    save();
    await sleep(500);
    if (torn) return;
    if (slot === 'endless') {
      const prevBest = stats.get().best;
      recordEndless(st);
      saveSlot(slot, st);
      const v = await winSheet({
        title: st.score > prevBest ? 'Neuer Rekord!' : 'Spiel vorbei',
        badge: st.score > prevBest ? '🏆' : '✨',
        tiles: [{ value: st.score, label: 'Punkte' }, { value: st.round, label: 'Runde' }, { value: Math.max(prevBest, st.score), label: 'Rekord' }],
        note: 'Keine Paare und kein «Hinzufügen» mehr.',
        colors: COLORS,
        buttons: [{ label: 'Neues Spiel', value: 'new', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }],
      });
      if (torn) return;
      if (v === 'new') { saveSlot('endless', G.newGame('endless')); route(); } else go('');
      return;
    }
    const v = await softSheet({
      title: 'Keine Paare mehr',
      emoji: '🌱',
      text: 'Kein Problem – dasselbe Feld ist sicher lösbar. Versuch es gleich nochmal!',
      buttons: [{ label: 'Nochmal versuchen', value: 'retry', primary: true, icon: 'refresh' }, { label: 'Zum Menü', value: 'menu', ghost: true }],
    });
    if (torn) return;
    if (v === 'retry') { G.restart(st); saveSlot(slot, st); route(); } else go('');
  }

  function leave() { go(''); }

  const onHide = () => save();
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);

  if (st.done) setTimeout(() => { if (!torn) win(); }, 200);
  else if (st.lost) setTimeout(() => { if (!torn) lost(); }, 200);

  // Test-Haken
  window.__nm = {
    get state() { return st; },
    slot,
    center: (i) => grid.center(i),
    hint: () => hintPair(st.cells),
    tap: (i) => onTap(i),
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
