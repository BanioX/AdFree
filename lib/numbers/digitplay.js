// Zahlen-Familie – Spielansicht für Ziffern-Rätsel: Kopfzeile mit Uhr, Brett, Helfer-Zeile,
// Werkzeuge (Zurück, Löschen, Notizen, Alle Notizen, Tipp) und Zifferntasten.
//
//   const view = digitPlay(app, state, {
//     title, sub, makeBoard(puzzle) → DigitBoard, candidates(st, i) → Maske,
//     helper(st, sel) → Node|null, onHelperTap(st, sel, api), padCounts: true,
//     coach: bool, onCoachDone(), save(st), onWin(st) (async), onBack(), onHelp(),
//   });
//   view.teardown();

import { h, toast, confirmDialog } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';
import { playTopbar, toolButton, onPress, runClock, coachBubble, formatTime, NI, praise, praiseWord } from './hud.js';
import * as D from './digitgame.js';
import { T } from './digits-i18n.js';

export function digitPlay(app, st, cfg) {
  const p = st.puzzle;
  const max = p.max || 9;
  let torn = false;
  let busy = false;
  let clock = null;
  let paused = false;
  let noteMode = false;
  let streak = 0;          // richtige Gruppen in Folge (für Lob)
  let praised = 0;
  let sel = -1;

  // ---------- DOM ----------
  const timeSpan = h('span', null, formatTime(st.elapsed || 0));
  const timer = h('button.nx-pill.nx-timer.dp-timer', { type: 'button', 'aria-label': T('pause'), html: NI.clock }, timeSpan);
  const top = playTopbar({ title: cfg.title, sub: cfg.sub, onBack: () => cfg.onBack && cfg.onBack(), onHelp: () => cfg.onHelp && cfg.onHelp(), extra: [timer] });
  const board = cfg.makeBoard(p);
  const card = h('div.nx-card.dp-card', null, board.el);
  const coach = coachBubble('');
  const pauseCover = h('div.dp-pause', null,
    h('div.dp-pause-in', null, h('b', null, T('paused')), h('button.btn.primary', { type: 'button', onclick: () => setPaused(false) }, T('continue'))));
  const stack = h('div.dp-stack', null, card, pauseCover, coach.el);
  const area = h('div.nx-board-area.dp-area', null, stack);
  const helperEl = h('button.dp-helper', { type: 'button' });
  if (!cfg.helper) helperEl.classList.add('none');

  const undoBtn = toolButton({ icon: 'undo', label: T('undo'), onClick: () => doUndo() });
  const eraseBtn = toolButton({ icon: 'eraser', label: T('erase'), onClick: () => doErase() });
  const noteBtn = toolButton({ icon: 'pencil', label: T('notes'), onClick: () => setNotes(!noteMode) });
  const allBtn = toolButton({ icon: 'wand', label: T('allNotes'), onClick: () => doFillNotes() });
  const hintBtn = toolButton({ icon: 'bulb', label: T('hint'), onClick: () => doHint() });
  const tools = h('div.nx-toolbar.dp-tools', null, undoBtn.el, eraseBtn.el, noteBtn.el, allBtn.el, hintBtn.el);

  const keys = [];
  const pad = h('div.dp-pad');
  pad.style.setProperty('--n', max);
  for (let d = 1; d <= max; d++) {
    const cnt = h('small');
    const b = h('button.dp-key', { type: 'button', 'data-d': d, 'aria-label': String(d) }, h('b', null, String(d)), cnt);
    onPress(b, () => input(d));
    keys.push({ b, cnt });
    pad.append(b);
  }
  const main = h('main.nx-main.dp-main', null, area, helperEl, tools, pad);
  const root = h('div.nx-screen.dp-play.enter', null, top.el, main);
  if (cfg.className) root.classList.add(cfg.className);
  app.replaceChildren(root);

  // ---------- Darstellung ----------
  function render() {
    board.paint(st, sel);
    const notesHere = sel >= 0 && !st.vals[sel] ? st.notes[sel] : 0;
    for (let d = 1; d <= max; d++) {
      const k = keys[d - 1];
      let left = null;
      if (cfg.padCounts) {
        left = D.solCount(p, d) - D.placedCount(st, d);
        k.cnt.textContent = left > 0 ? String(left) : '';
      }
      k.b.classList.toggle('done', left === 0);
      k.b.classList.toggle('marked', noteMode && !!(notesHere & (1 << d)));
    }
    undoBtn.setDisabled(!st.undo.length || st.done);
    if (cfg.helper) {
      const node = sel >= 0 ? cfg.helper(st, sel) : null;
      helperEl.replaceChildren(...(node ? [node] : []));
      helperEl.classList.toggle('empty', !node);
    }
  }

  function layout() {
    const w = area.clientWidth - 8, hh = area.clientHeight - 8;
    if (w > 0 && hh > 0) {
      const pad2 = cfg.cardPad ?? 8;
      board.layout(w - pad2 * 2, hh - pad2 * 2);
      card.style.padding = pad2 + 'px';
    }
  }
  const ro = new ResizeObserver(layout);
  ro.observe(area);
  layout();

  // ---------- Auswahl ----------
  function firstEmpty() {
    for (let i = 0; i < p.sol.length; i++) if (D.editable(p, i) && st.vals[i] !== p.sol[i]) return i;
    for (let i = 0; i < p.sol.length; i++) if (p.sol[i]) return i;
    return -1;
  }
  function select(i) {
    if (i < 0 || !p.sol[i]) return;
    sel = i;
    render();
    updateCoach();
  }
  sel = typeof cfg.initialSel === 'number' && p.sol[cfg.initialSel] ? cfg.initialSel : firstEmpty();

  // ---------- Coach-Mark (erstes Rätsel) ----------
  let coachOn = !!cfg.coach && !st.done && D.progress(st) === 0;
  let coachTarget = -1;
  if (coachOn) {
    coachTarget = D.hintCell(st, -1, cfg.candidates || D.basicCandidates);
    sel = -1;
  }
  function updateCoach() {
    if (!coachOn) { board.coach(-1); coach.hide(); return; }
    if (sel !== coachTarget) { board.coach(coachTarget); coach.show(T('pickCell')); }
    else { board.coach(-1); coach.show(cfg.coachDigitText ? cfg.coachDigitText(st, sel) : T('pickDigit')); }
  }
  function endCoach() {
    if (!coachOn) return;
    coachOn = false;
    updateCoach();
    cfg.onCoachDone && cfg.onCoachDone();
  }

  // ---------- Eingabe ----------
  board.grid.addEventListener('pointerdown', (e) => {
    if (busy || paused) return;
    const i = board.indexAt(e.clientX, e.clientY);
    if (i >= 0 && p.sol[i]) { if (i !== sel) select(i); }
    else if (i >= 0 && cfg.onBlockTap) cfg.onBlockTap(i, api);
  });

  function input(d) {
    if (busy || paused || st.done) return;
    if (sel < 0) { select(coachOn ? coachTarget : firstEmpty()); if (sel < 0) return; }
    if (!D.editable(p, sel)) { board.flash(sel, 'ng-shake', 400); return; }
    if (noteMode) {
      if (st.vals[sel] && st.vals[sel] === p.sol[sel]) { board.flash(sel, 'ng-shake', 400); return; }
      if (D.toggleNote(st, sel, d)) { render(); save(); }
      return;
    }
    const res = D.place(st, sel, d);
    if (!res.changed) return;
    if (res.cleared) { render(); save(); return; }
    if (res.wrong) {
      streak = 0;
      sfx.play('error');
      board.flash(sel, 'ng-shake', 420);
      for (const j of D.peersOf(p, sel)) if (st.vals[j] === d) board.flash(j, 'db-clash', 900);
      if (navigator.vibrate) try { navigator.vibrate(25); } catch { /* ignore */ }
      render(); save(); endCoach();
      cfg.onMistake && cfg.onMistake(st);
      return;
    }
    afterGood(sel, res, false);
  }

  function afterGood(i, res, fromHint) {
    board.flash(i, 'db-pop', 420);
    if (res.groups.length) {
      sfx.play('sparkle');
      res.groups.forEach((gi, k) => board.wave(orderFrom(p.groups[gi].cells, i), k * 120));
      if (!fromHint && !res.won) {
        streak += res.groups.length;
        if (res.groups.length >= 3) praise(stack, T('triple'));
        else if (res.groups.length === 2) praise(stack, T('double'));
        else if (streak % 4 === 0) praise(stack, praiseWord(praised++));
      }
    } else sfx.play(fromHint ? 'pop' : 'place');
    render();
    save();
    endCoach();
    if (res.won) win();
  }

  // Welle startet bei der zuletzt gesetzten Zelle
  function orderFrom(cells, i) {
    const C = p.cols, r0 = Math.floor(i / C), c0 = i % C;
    return [...cells].sort((a, b) => (Math.abs(Math.floor(a / C) - r0) + Math.abs(a % C - c0)) - (Math.abs(Math.floor(b / C) - r0) + Math.abs(b % C - c0)));
  }

  function setNotes(on) {
    noteMode = on;
    noteBtn.setOn(on);
    noteBtn.setBadge(on ? T('on') : null);
    pad.classList.toggle('notes', on);
    render();
  }

  function doUndo() {
    if (busy || paused) return;
    const cells = D.undo(st);
    if (!cells) { toast(T('nothingToUndo')); return; }
    if (cells.length) sel = cells[0];
    cells.forEach((i) => board.flash(i, 'db-undo', 380));
    render(); save();
  }

  function doErase() {
    if (busy || paused || sel < 0) return;
    if (st.vals[sel] && st.vals[sel] === p.sol[sel] && D.editable(p, sel)) { toast(T('keepRight')); return; }
    if (D.erase(st, sel)) { board.flash(sel, 'db-undo', 380); render(); save(); }
  }

  function doFillNotes() {
    if (busy || paused || st.done) return;
    const n = D.fillNotes(st, cfg.candidates || D.basicCandidates);
    if (n) { toast(T('notesFilled')); board.el.classList.remove('db-notes-in'); void board.el.offsetWidth; board.el.classList.add('db-notes-in'); }
    render(); save();
  }

  function doHint() {
    if (busy || paused || st.done) return;
    const i = D.hintCell(st, sel, cfg.candidates || D.basicCandidates);
    if (i < 0) return;
    sel = i;
    const res = D.reveal(st, i);
    if (!res) return;
    board.flash(i, 'db-hinted', 1300);
    afterGood(i, res, true);
  }

  // ---------- Pause & Uhr ----------
  function setPaused(on) {
    if (st.done || paused === on) return;
    paused = on;
    root.classList.toggle('paused', on);
    if (on) { if (clock) { st.elapsed = clock.elapsed; clock.stop(); clock = null; } save(); }
    else startClock();
  }
  onPress(timer, () => setPaused(!paused));
  function startClock() {
    if (clock || st.done) return;
    clock = runClock(st.elapsed || 0, (ms) => { timeSpan.textContent = formatTime(ms); });
  }
  startClock();

  function save() {
    if (clock) st.elapsed = clock.elapsed;
    cfg.save && cfg.save(st);
  }

  async function win() {
    busy = true;
    if (clock) { st.elapsed = clock.elapsed; clock.stop(); clock = null; }
    timeSpan.textContent = formatTime(st.elapsed);
    sel = -1;
    render();
    // Welle über das ganze Brett
    const C = p.cols;
    for (let i = 0; i < p.sol.length; i++) if (p.sol[i]) board.flash(i, 'db-wave', 700, (Math.floor(i / C) + (i % C)) * 40);
    save();
    await new Promise((r) => setTimeout(r, 800));
    if (torn) return;
    await (cfg.onWin && cfg.onWin(st));
  }

  // ---------- Tastatur ----------
  function onKey(e) {
    if (busy || document.querySelector('.sp-modal-backdrop, .tut-backdrop, .np-pop')) return;
    const k = e.key;
    if (/^[1-9]$/.test(k) && +k <= max) { input(+k); e.preventDefault(); }
    else if (k === 'Backspace' || k === 'Delete' || k === '0') { doErase(); e.preventDefault(); }
    else if (k === 'n' || k === 'N') setNotes(!noteMode);
    else if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) { doUndo(); e.preventDefault(); }
    else if (k.startsWith('Arrow')) {
      const C = p.cols, R = p.rows;
      let r = Math.floor(Math.max(sel, 0) / C), c = Math.max(sel, 0) % C;
      for (let step = 0; step < Math.max(R, C); step++) {
        if (k === 'ArrowUp') r = (r + R - 1) % R; else if (k === 'ArrowDown') r = (r + 1) % R;
        else if (k === 'ArrowLeft') c = (c + C - 1) % C; else c = (c + 1) % C;
        if (p.sol[r * C + c]) break;
      }
      select(r * C + c);
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);

  // Helfer-Zeile antippen
  if (cfg.helper && cfg.onHelperTap) onPress(helperEl, () => { if (sel >= 0 && !paused) cfg.onHelperTap(st, sel, api); });

  const onHide = () => save();
  const onVis = () => { if (document.hidden) save(); };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVis);

  const api = {
    get state() { return st; },
    get sel() { return sel; },
    get busy() { return busy; },
    get noteMode() { return noteMode; },
    board, render, select, input, setNotes,
    center: (i) => board.center(i),
    keyCenter: (d) => { const r = keys[d - 1].b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    /** Notizen mehrerer Zellen auf einmal setzen (ein Schritt fürs Rückgängig). */
    setNotesFor(cells, maskFn) {
      const changes = [];
      for (const i of cells) {
        if (!D.editable(p, i) || st.vals[i]) continue;
        const m = maskFn(i);
        if (m !== st.notes[i]) { changes.push([i, st.vals[i], st.notes[i]]); st.notes[i] = m; }
      }
      if (changes.length) { st.undo.push(changes); render(); save(); }
      return changes.length;
    },
    async restart() {
      if (D.progress(st) > 0 && !(await confirmDialog(T('restartQ'), T('restartText'), T('restart')))) return;
      D.restart(st); render(); save();
    },
  };

  render();
  updateCoach();
  if (st.done) setTimeout(() => !torn && win(), 250);

  return {
    api,
    teardown() {
      torn = true;
      save();
      if (clock) clock.stop();
      ro.disconnect();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
