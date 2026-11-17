// Bilderrätsel – Spielansicht: Eingabe (Tippen, Ziehen, langes Drücken, Zoomen),
// Werkzeugleiste, Tipps, Fehlerprüfung, Speichern und die Enthüllung beim Lösen.

import { h, icon, toast, showModal, confirmDialog, celebrate, sleep } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { markDailyDone, isDailyDone, todayKey } from '../shared/storage.js';
import { Game, OPEN, FILL, CROSS, strokeAction, actionValue, strokeLine } from './core/game.js';
import { BoardView, drawThumb } from './board.js';
import { showHelp } from './help.js';
import * as save from './save.js';

const LONG_MS = 380;
const svg = (body, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const IC_FILL = '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="currentColor" stroke="none"/>';
const IC_CROSS = '<path d="M6 6l12 12M18 6L6 18" stroke-width="3"/>';
const IC_CHECK = '<path d="M4 12.5l4.5 4.5L20 6.5"/><path d="M4 21h16" opacity=".35"/>';

/**
 * Öffnet ein Rätsel.
 * @param {object} o
 *   id, puzzle (parsePuzzle), kind ('library'|'daily'|'endless'|'beads'), label (z.B. «Mini · Nr. 3»),
 *   day, size, n, pack, onBack(), onNext() | null, onAlbum()
 * @returns {{ el: HTMLElement, mount(): void, destroy(): void }}
 */
export function createPlay(o) {
  const { id, puzzle } = o;
  const saved = save.loadProgress(id);
  const game = new Game(puzzle, saved);
  const isNew = !saved;
  let settings = save.settings.get();
  let mode = 'fill';
  let solvedShown = game.solved;
  let counted = !!saved;

  // ---------- DOM ----------
  const back = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zum Menü' });
  back.innerHTML = icon('back');
  const titleEl = h('b.pt-name', null, game.solved ? puzzle.title : o.label);
  const timeEl = h('span.pt-time');
  const subEl = h('span.pt-sub', null, `${puzzle.w} × ${puzzle.h}`);
  const moreBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Mehr' });
  moreBtn.innerHTML = icon('more');
  const helpBtn = h('button.icon-btn.help-btn', { type: 'button', 'aria-label': 'So geht’s' });
  helpBtn.innerHTML = '<span class="gm-q">?</span>';
  const top = h('header.topbar.play-top', null, back, h('div.pt', null, titleEl, h('div.pt-line', null, subEl, timeEl)), helpBtn, moreBtn);
  const bar = h('i');
  const progress = h('div.pbar', null, bar);

  const canvas = h('canvas.board', { 'aria-label': 'Spielfeld' });
  const wrap = h('div.board-wrap', null, canvas);

  const undoBtn = toolBtn('undo', 'Rückgängig', icon('undo', { size: 26 }));
  const segFill = h('button.seg-btn', { type: 'button', 'aria-label': 'Füllen', 'data-mode': 'fill' });
  segFill.innerHTML = svg(IC_FILL, 26);
  const segCross = h('button.seg-btn', { type: 'button', 'aria-label': 'Kreuzchen', 'data-mode': 'cross' });
  segCross.innerHTML = svg(IC_CROSS, 24);
  const seg = h('div.mode-seg', { role: 'group' }, h('i.knob'), segFill, segCross);
  const zoomBtn = toolBtn('zoom', 'Lupe', icon('zoomIn', { size: 26 }));
  const checkBtn = toolBtn('check', 'Prüfen', svg(IC_CHECK, 26));
  const hintBtn = toolBtn('hint', 'Tipp', icon('hint', { size: 26 }));
  const toolbar = h('footer.toolbar', null, undoBtn, zoomBtn, seg, checkBtn, hintBtn);

  const againBtn = h('button.btn', { type: 'button' });
  againBtn.innerHTML = icon('refresh', { size: 20 });
  againBtn.append('Nochmals');
  const nextBtn = h('button.btn.primary', { type: 'button' });
  nextBtn.innerHTML = icon('play', { size: 20 });
  nextBtn.append(o.onNext ? 'Nächstes Bild' : 'Zum Menü');
  const solvedBar = h('footer.solved-bar', null, againBtn, nextBtn);

  const el = h('div.screen.play', null, top, progress, wrap, toolbar, solvedBar);

  function toolBtn(name, label, html) {
    const b = h('button.tool', { type: 'button', 'aria-label': label, 'data-tool': name });
    b.innerHTML = `<span class="ti">${html}</span><span class="tl">${label}</span>`;
    return b;
  }

  // ---------- Brett ----------
  const board = new BoardView(canvas, game);
  let raf = 0;
  const requestDraw = () => {
    board.dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  function frame(now) {
    raf = 0;
    board.draw(now);
    if (board.isAnimating(now)) raf = requestAnimationFrame(frame);
  }

  let W = 0, H = 0;
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    W = Math.floor(r.width); H = Math.floor(r.height);
    board.resize(W, H, Math.min(window.devicePixelRatio || 1, 2.5));
    if (board.reveal) board.reveal.to = board.pictureGeometry(pictureArea());
    placeCoach();
    updateTools();
    requestDraw();
  }
  const ro = new ResizeObserver(resize);

  const pictureArea = () => ({ x: 0, y: 0, w: W, h: H });

  // ---------- Anzeige ----------
  function updateTools() {
    undoBtn.disabled = !game.canUndo() || game.solved;
    zoomBtn.classList.toggle('hidden', !board.zoomable);
    zoomBtn.querySelector('.ti').innerHTML = icon(board.zoomed ? 'zoomOut' : 'zoomIn', { size: 26 });
    zoomBtn.classList.toggle('on', board.zoomed);
    seg.dataset.mode = mode;
    segFill.classList.toggle('active', mode === 'fill');
    segCross.classList.toggle('active', mode === 'cross');
    const pr = game.progress();
    bar.style.width = `${Math.round(pr.ratio * 100)}%`;
    el.classList.toggle('is-solved', game.solved);
    timeEl.textContent = settings.timer ? ` · ${save.formatTime(game.elapsed)}` : '';
  }

  // ---------- Zeit & Speichern ----------
  let tLast = performance.now();
  let running = false;
  let paused = false;
  function tick() {
    const now = performance.now();
    if (running && !paused && !game.solved && document.visibilityState === 'visible') game.elapsed += Math.min(now - tLast, 5000);
    tLast = now;
    if (settings.timer) timeEl.textContent = ` · ${save.formatTime(game.elapsed)}`;
  }
  let timer = 0;
  let tipTimer = 0;
  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    tick();
    // Leeres Brett ganz am Anfang: nichts speichern – und einen eben rückgängig gemachten Stand löschen
    if (game.isEmpty() && !game.canUndo() && game.elapsed < 4000) { save.clearProgress(id); return; }
    const data = { ...game.serialize(), s: game.solved ? 1 : 0 };
    if (board.zoomed && !game.solved) data.z = [Math.round(board.cs * 10) / 10, Math.round(board.sx), Math.round(board.sy)];
    save.saveProgress(id, data);
  }
  const persistSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); };
  const onVis = () => { tick(); if (document.visibilityState === 'hidden') persist(); };
  const onHide = () => persist();

  // ---------- Züge ----------
  let pendingSound = 0;
  function cellSound(kind) {
    const now = performance.now();
    if (now - pendingSound < 35) return;
    pendingSound = now;
    sfx.play(kind === 'fill' ? 'tap' : 'click');
  }

  /** Setzt Zellen direkt (während eines Strichs). */
  function setCell(i, v) {
    const from = game.cells[i];
    if (from === v) return;
    game.cells[i] = v;
    if (board.marks.size) board.marks.delete(i);
    board.animate(i, v === FILL ? 'fill' : v === CROSS ? 'cross' : 'erase');
  }

  /** Nach einem abgeschlossenen Zug: Auto-Kreuze, erledigte Linien, Fehler, Sieg. */
  function afterMove(indices, doneBefore) {
    const lines = game.linesOf(indices);
    if (board.marks.size) board.clearMarks(indices);
    if (coachEl) hideCoach();
    if (settings.instantErrors) {
      const wrong = [];
      for (const i of indices) {
        const v = game.cells[i];
        if (v === FILL && !puzzle.mask[i]) wrong.push([i, CROSS]);
        else if (v === CROSS && puzzle.mask[i]) wrong.push([i, FILL]);
      }
      if (wrong.length) {
        game.mistakes += wrong.length;
        game.applyToLast(wrong);
        for (const [i] of wrong) board.markError(i);
        sfx.play('error');
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }
    if (settings.autoCross) {
      const ch = game.autoCrossChanges(lines);
      if (ch.length) {
        const done = game.applyToLast(ch);
        for (const [i] of done) board.animate(i, 'cross');
      }
    }
    let flashed = 0;
    for (const [axis, k] of lines) {
      const key = axis * 1000 + k;
      if (!doneBefore.has(key) && game.lineStatus(axis, k).done) { board.flashLine(axis, k); flashed++; }
    }
    game.solved = game.checkSolved();
    board.invalidate();
    updateTools();
    persistSoon();
    if (game.solved) { win(); return; }
    if (flashed) setTimeout(() => sfx.play('pop'), 40);
    requestDraw();
  }

  function doneLines(indices) {
    const s = new Set();
    for (const [axis, k] of game.linesOf(indices)) if (game.lineStatus(axis, k).done) s.add(axis * 1000 + k);
    return s;
  }

  // ---------- Eingabe ----------
  const pointers = new Map();
  let stroke = null;
  let gesture = null;

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function beginStroke(r, c, x, y) {
    const i = r * game.w + c;
    stroke = { r, c, x, y, startValue: game.cells[i], action: null, axis: null, changes: new Map(), long: false, timer: 0, before: null, cur: { r, c } };
    stroke.before = doneLines([i]);
    board.hover = { r, c };
    lastCell = { r, c };
    stroke.timer = setTimeout(() => {
      if (!stroke || stroke.action) return;
      stroke.long = true;
      stroke.action = strokeAction(mode === 'fill' ? 'cross' : 'fill', stroke.startValue);
      applyStroke(stroke.r, stroke.c);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_MS);
    requestDraw();
  }

  function applyStroke(r1, c1) {
    const s = stroke;
    const ln = strokeLine(s.r, s.c, r1, c1, s.axis);
    if (s.axis == null && ln.axis != null) s.axis = ln.axis;
    const want = new Set();
    let n = 0;
    for (const [r, c] of ln.cells) {
      if (r < 0 || c < 0 || r >= game.h || c >= game.w) continue;
      const i = r * game.w + c;
      want.add(i);
      n++;
      const orig = s.changes.has(i) ? s.changes.get(i) : game.cells[i];
      const v = actionValue(s.action, s.startValue, orig);
      if (v == null) continue;
      if (!s.changes.has(i)) s.changes.set(i, game.cells[i]);
      if (game.cells[i] !== v) { setCell(i, v); cellSound(s.action === 'fill' ? 'fill' : 'cross'); }
    }
    // zurückgezogene Zellen wiederherstellen
    for (const [i, from] of s.changes) {
      if (!want.has(i)) { game.cells[i] = from; s.changes.delete(i); }
    }
    s.cur = { r: r1, c: c1 };
    board.hover = { r: r1, c: c1 };
    board.bubble = n > 1 ? { ...board.cellCenter(r1, c1), n } : null;
    board.invalidate();
    requestDraw();
  }

  function endStroke(commit = true) {
    const s = stroke;
    if (!s) return;
    clearTimeout(s.timer);
    stroke = null;
    board.hover = null;
    board.bubble = null;
    if (!commit) {
      for (const [i, from] of s.changes) game.cells[i] = from;
      board.invalidate();
      requestDraw();
      return;
    }
    if (!s.action) {
      s.action = strokeAction(mode, s.startValue);
      stroke = s;
      applyStroke(s.r, s.c);
      stroke = null;
      board.hover = null;
      board.bubble = null;
    }
    const done = [];
    for (const [i, from] of s.changes) if (game.cells[i] !== from) done.push([i, from, game.cells[i]]);
    if (!done.length) { requestDraw(); return; }
    game.undoStack.push(done);
    if (game.undoStack.length > 80) game.undoStack.shift();
    if (!counted) { counted = true; save.recordStart(); }
    running = true;
    afterMove(done.map((d) => d[0]), s.before);
  }

  function onDown(e) {
    if (game.solved) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
      if (stroke) endStroke(false);
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const hit = board.hit(p.x, p.y);
    if (hit.zone === 'grid') {
      if (hit.r >= 0 && hit.c >= 0 && hit.r < game.h && hit.c < game.w) beginStroke(hit.r, hit.c, p.x, p.y);
    } else if (hit.zone === 'corner') {
      gesture = { kind: 'corner', x: p.x, y: p.y };
    } else if (board.zoomed) {
      gesture = { kind: 'pan', x: p.x, y: p.y };
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (gesture && gesture.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (gesture.d > 10) board.zoomTo(board.cs * (d / gesture.d), mx, my);
      board.panBy(mx - gesture.mx, my - gesture.my);
      gesture.d = d; gesture.mx = mx; gesture.my = my;
      updateTools();
      requestDraw();
      return;
    }
    if (gesture && gesture.kind === 'pan') {
      board.panBy(p.x - gesture.x, p.y - gesture.y);
      gesture.x = p.x; gesture.y = p.y;
      requestDraw();
      return;
    }
    if (stroke) {
      const cell = board.cellAt(p.x, p.y);
      if (cell.r === stroke.cur.r && cell.c === stroke.cur.c && stroke.action) return;
      if (!stroke.action) {
        if (cell.r === stroke.r && cell.c === stroke.c) return;
        clearTimeout(stroke.timer);
        stroke.action = strokeAction(mode, stroke.startValue);
      }
      applyStroke(cell.r, cell.c);
      autoScroll(p);
    }
  }

  // Beim Ziehen am Rand des gezoomten Bretts mitscrollen
  let scrollRaf = 0;
  function autoScroll(p) {
    if (!board.zoomed || scrollRaf) return;
    const edge = 26;
    const dx = p.x < board.vx + edge ? 1 : p.x > board.vx + board.vw - edge ? -1 : 0;
    const dy = p.y < board.vy + edge ? 1 : p.y > board.vy + board.vh - edge ? -1 : 0;
    if (!dx && !dy) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!stroke) return;
      const pp = [...pointers.values()][0];
      if (!pp) return;
      board.panBy(dx * board.cs * 0.25, dy * board.cs * 0.25);
      const cell = board.cellAt(pp.x, pp.y);
      if (stroke.action) applyStroke(cell.r, cell.c);
      autoScroll(pp);
    });
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.delete(e.pointerId);
    if (gesture) {
      if (gesture.kind === 'corner' && Math.hypot(p.x - gesture.x, p.y - gesture.y) < 12) toggleZoom();
      else if (pointers.size === 0) persistSoon();   // Zoom/Ausschnitt merken
      if (pointers.size === 0) gesture = null;
      else if (gesture.kind === 'pinch') {
        const q = [...pointers.values()][0];
        gesture = board.zoomed ? { kind: 'pan', x: q.x, y: q.y } : null;
      }
      return;
    }
    if (stroke) endStroke(e.type !== 'pointercancel');
  }

  function onWheel(e) {
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      board.zoomTo(board.cs * Math.exp(-e.deltaY * 0.0022), p.x, p.y);
    } else board.panBy(-e.deltaX, 0);
    updateTools();
    persistSoon();
    requestDraw();
  }

  function toggleZoom() {
    if (!board.zoomable) return;
    sfx.play('whoosh');
    if (board.zoomed) board.zoomTo(board.fitCs, W / 2, H / 2);
    else {
      board.zoomTo(board.comfortCs(), W / 2, H / 2);
      const hv = lastCell || { r: Math.floor(game.h / 2), c: Math.floor(game.w / 2) };
      board.centerOn(hv.r, hv.c);
    }
    if (!settings.zoomTip) { settings = save.settings.set({ zoomTip: true }); }
    updateTools();
    persistSoon();
    requestDraw();
  }
  let lastCell = null;

  // ---------- Coach-Mark (allererstes Bild) ----------
  let coachEl = null;
  /** Linie mit dem kleinsten Spielraum (0 = ganz bestimmt), Zeilen zuerst. */
  function coachTarget() {
    let best = null;
    for (const axis of [0, 1]) {
      const clues = axis === 0 ? puzzle.rowClues : puzzle.colClues;
      const len = axis === 0 ? game.w : game.h;
      clues.forEach((cl, k) => {
        if (!cl.length) return;
        const slack = len - (cl.reduce((a, b) => a + b, 0) + cl.length - 1);
        if (!best || slack < best.slack) best = { axis, k, slack, clue: cl, len };
      });
    }
    return best;
  }
  function showCoach() {
    const t = coachTarget();
    if (!t) return;
    board.coach = { axis: t.axis, k: t.k };
    const what = t.axis === 0 ? 'Zeile' : 'Spalte';
    const text = t.slack === 0 && t.clue.length === 1
      ? `Die ${t.clue[0]} heisst: alle ${t.len} Felder dieser ${what} füllen. Einfach darüberziehen!`
      : `Fang hier an – in dieser ${what} ist fast alles klar.`;
    coachEl = h('div.coach', { 'aria-live': 'polite' }, text);
    wrap.append(coachEl);
    placeCoach();
  }
  function placeCoach() {
    if (!coachEl) return;
    const below = board.vy + board.vh + 18;
    coachEl.style.top = Math.max(8, Math.min(below, H - 74)) + 'px';
  }
  function hideCoach() {
    board.coach = null;
    const c = coachEl;
    coachEl = null;
    if (!c) return;
    c.classList.add('gone');
    setTimeout(() => c.remove(), 320);
  }

  async function help() {
    tick();
    paused = true;
    await showHelp();
    tick();
    paused = false;
  }

  // ---------- Werkzeuge ----------
  function undo() {
    if (!game.canUndo() || game.solved) return;
    const idx = game.undo();
    if (board.marks.size) board.clearMarks(idx);
    for (const i of idx) board.animate(i, game.cells[i] === FILL ? 'fill' : game.cells[i] === CROSS ? 'cross' : 'erase');
    sfx.play('click');
    board.invalidate();
    updateTools();
    persistSoon();
    requestDraw();
  }

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    sfx.play('click');
    updateTools();
  }

  function ensureVisible(i) {
    if (!board.zoomed) return;
    const r = Math.floor(i / game.w), c = i % game.w;
    const { x, y } = board.cellCenter(r, c);
    if (x < board.vx || x > board.vx + board.vw || y < board.vy || y > board.vy + board.vh) board.centerOn(r, c);
  }

  function hint() {
    if (game.solved) return;
    const hnt = game.hint();
    if (!hnt) return;
    running = true;
    game.hints++;
    if (hnt.type === 'mistake') {
      const before = doneLines([hnt.index]);
      game.apply([[hnt.index, OPEN]]);
      board.markError(hnt.index);
      ensureVisible(hnt.index);
      sfx.play('error');
      toast('Hier stimmt etwas nicht – ich habe es entfernt.');
      afterMove([hnt.index], before);
      return;
    }
    const before = doneLines([hnt.index]);
    game.apply([[hnt.index, hnt.value]]);
    board.animate(hnt.index, hnt.value === FILL ? 'fill' : 'cross');
    board.markHint(hnt.index, hnt.axis, hnt.line);
    ensureVisible(hnt.index);
    sfx.play('sparkle');
    toast(hnt.axis === 0 ? `Schau dir Zeile ${hnt.line + 1} an.` : `Schau dir Spalte ${hnt.line + 1} an.`, 2200);
    afterMove([hnt.index], before);
  }

  function check() {
    if (game.solved) return;
    game.checks++;
    const wrong = game.mistakesList();
    persistSoon();
    if (!wrong.length) {
      sfx.play('sparkle');
      toast('Bis jetzt alles richtig ✓');
      return;
    }
    for (const i of wrong) board.markError(i);
    board.setMarks(wrong);
    if (wrong.length) ensureVisible(wrong[0]);
    sfx.play('error');
    toast(wrong.length === 1 ? '1 Feld ist falsch (rot markiert).' : `${wrong.length} Felder sind falsch (rot markiert).`, 2400);
    requestDraw();
  }

  async function restart() {
    const ok = await confirmDialog('Neu beginnen?', 'Alle Felder dieses Bildes werden geleert.', 'Neu beginnen', 'Abbrechen');
    if (!ok) return;
    game.reset();
    board.setMarks([]);
    board.reveal = null;
    board.revealDone = false;
    solvedShown = false;
    titleEl.textContent = o.label;
    save.clearProgress(id);
    board.invalidate();
    resize();
    updateTools();
    sfx.play('whoosh');
  }

  async function more() {
    sfx.play('click');
    tick();
    paused = true;
    const v = await showModal({
      title: game.solved ? puzzle.title : o.label,
      text: `${puzzle.w} × ${puzzle.h} Felder${game.hints ? ` · ${game.hints} Tipp${game.hints === 1 ? '' : 's'}` : ''}`,
      dismissible: true,
      buttons: [
        { label: 'Neu beginnen', value: 'restart', icon: 'refresh' },
        { label: 'Einstellungen', value: 'settings', icon: 'settings' },
        { label: 'So geht’s', value: 'help', icon: 'hint' },
        { label: sfx.muted ? 'Ton einschalten' : 'Ton ausschalten', value: 'sound', icon: sfx.muted ? 'soundOn' : 'soundOff' },
        { label: 'Weiterspielen', value: null, primary: true },
      ],
    });
    tick();
    paused = false;
    if (v === 'restart') restart();
    else if (v === 'settings') { await openSettings(); settings = save.settings.get(); updateTools(); }
    else if (v === 'help') help();
    else if (v === 'sound') { sfx.toggle(); sfx.play('click'); }
  }

  // ---------- Sieg ----------
  async function win() {
    tick();
    running = false;
    const perfect = game.hints === 0 && game.checks === 0 && game.mistakes === 0;
    const res = save.markSolved(id, { time: game.elapsed, perfect });
    save.recordWin({ size: game.w === game.h ? game.w : 'andere', time: game.elapsed, hints: game.hints, perfect });
    // Nur das heutige Tagesrätsel zählt für die Serie – ein älteres nochmals spielen setzt sie nicht zurück
    if (o.kind === 'daily' && o.day && o.day === todayKey() && !isDailyDone('nonogram', o.day)) {
      markDailyDone('nonogram', o.day);
      save.logDaily(o.day, { t: Math.round(game.elapsed), s: puzzle.def.sourceId || null });
    }
    if (o.kind === 'endless') save.endlessAdvance(o.size, o.n);
    persist();
    o.onSolved && o.onSolved();
    updateTools();
    titleEl.textContent = puzzle.title;
    sfx.play('complete');
    board.startReveal(pictureArea());
    requestDraw();
    solvedShown = true;
    await sleep(board.reveal.dur * 0.7);
    if (!el.isConnected) return;
    const colors = [...new Set(Object.values(puzzle.def.palette))].slice(0, 6);
    celebrate(colors.length >= 2 ? colors : undefined);
    sfx.play('sparkle');
    await sleep(500);
    if (!el.isConnected) return;
    winSheet(res, perfect);
  }

  async function winSheet(res, perfect) {
    const thumb = h('canvas.win-pic');
    drawThumb(thumb, puzzle.def, { mode: 'color', size: 120 });
    const record = !res.first && res.prevBest != null && game.elapsed < res.prevBest;
    const note = perfect ? '★ Ganz ohne Hilfe – stark!' : record ? 'Neue Bestzeit!' : res.first ? 'Neues Bild für dein Album!' : 'Schön gemalt!';
    const content = h('div.win',
      h('div.win-frame', null, thumb),
      h('div.win-title', null, `«${puzzle.title}»`),
      h('div.win-stats', null,
        stat('Zeit', save.formatTime(game.elapsed)),
        stat('Tipps', String(game.hints)),
        stat('Bestzeit', save.formatTime(res.best))),
      h('p.win-note', null, note));
    const buttons = [];
    if (o.onNext) buttons.push({ label: 'Nächstes Bild', value: 'next', primary: true, icon: 'play' });
    buttons.push({ label: 'Zum Menü', value: 'menu', primary: !o.onNext, icon: 'home' });
    buttons.push({ label: 'Bild ansehen', value: 'view', ghost: true });
    const v = await showModal({ title: o.kind === 'daily' ? 'Tagesrätsel gelöst!' : 'Geschafft!', content, buttons });
    if (!el.isConnected) return;
    if (v === 'next') o.onNext();
    else if (v === 'menu') o.onBack(true);
  }

  function stat(label, value) {
    return h('div.win-stat', null, h('b', null, value), h('span', null, label));
  }

  // ---------- Verdrahtung ----------
  back.addEventListener('click', () => { sfx.play('click'); o.onBack(); });
  moreBtn.addEventListener('click', more);
  helpBtn.addEventListener('click', () => { sfx.play('click'); help(); });
  onTap(undoBtn, undo);
  onTap(segFill, () => setMode('fill'));
  onTap(segCross, () => setMode('cross'));
  onTap(zoomBtn, toggleZoom);
  onTap(checkBtn, check);
  onTap(hintBtn, hint);
  againBtn.addEventListener('click', restart);
  nextBtn.addEventListener('click', () => { sfx.play('tap'); if (o.onNext) o.onNext(); else o.onBack(true); });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', (e) => {
    onMove(e);
    if (stroke) lastCell = stroke.cur;
  });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'x' || e.key === 'X') setMode(mode === 'fill' ? 'cross' : 'fill');
  };

  return {
    el,
    game,
    board,
    mount() {
      ro.observe(wrap);
      resize();
      // Zoom und Ausschnitt vom letzten Mal wiederherstellen
      if (saved && Array.isArray(saved.z) && !game.solved && board.zoomable) {
        const [cs, sx, sy] = saved.z.map(Number);
        if (Number.isFinite(cs) && Number.isFinite(sx) && Number.isFinite(sy)) {
          board.cs = Math.min(Math.max(cs, board.fitCs), board.maxCs);
          board.userZoomed = board.zoomed;
          board.sx = sx; board.sy = sy;
          board.layout();
          updateTools();
          requestDraw();
        }
      }
      if (game.solved) {
        board.showPicture(pictureArea());
        updateTools();
        requestDraw();
      } else {
        running = !isNew;
        if (o.coach && isNew) showCoach();
        if (board.zoomable && !settings.zoomTip) {
          tipTimer = setTimeout(() => {
            if (!el.isConnected || game.solved || board.zoomed || settings.zoomTip) return;
            settings = save.settings.set({ zoomTip: true });
            toast('Tipp: Mit zwei Fingern zoomen – oder die Lupe benutzen.', 3000);
          }, 900);
        }
      }
      timer = setInterval(tick, 1000);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pagehide', onHide);
      window.addEventListener('keydown', onKey);
      void solvedShown;
    },
    destroy() {
      persist();
      clearInterval(timer);
      clearTimeout(tipTimer);
      clearTimeout(saveTimer);
      if (raf) cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('keydown', onKey);
    },
  };
}

/**
 * Schneller Tipp-Handler für Werkzeug-Knöpfe: reagiert schon auf pointerup, damit auch rasch
 * hintereinander getippte Knöpfe (z.B. mehrmals Rückgängig) jeden Tipp zählen – der Doppeltipp-
 * Schutz der Seite verschluckt sonst den zweiten «click». Tastatur-Klicks funktionieren weiter.
 */
function onTap(el, fn) {
  let down = null;
  let last = 0;
  el.addEventListener('pointerdown', (e) => { down = { id: e.pointerId }; });
  el.addEventListener('pointerleave', () => { down = null; });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId || el.disabled) return;
    down = null;
    last = performance.now();
    fn();
  });
  el.addEventListener('click', () => {
    if (performance.now() - last < 600) return;
    fn();
  });
}

// ---------- Einstellungen (auch vom Menü aus) ----------

export async function openSettings() {
  const s = save.settings.get();
  const row = (key, title, text) => {
    const input = h('input', { type: 'checkbox', 'data-key': key });
    input.checked = !!s[key];
    input.addEventListener('change', () => { save.settings.set({ [key]: input.checked }); sfx.play('click'); });
    return h('label.set-row', null, h('span.set-txt', null, h('b', null, title), h('small', null, text)), input, h('i.switch'));
  };
  const content = h('div.settings',
    row('autoCross', 'Auto-Kreuze', 'Fertige Zeilen und Spalten werden automatisch mit ✕ aufgefüllt.'),
    row('instantErrors', 'Fehler sofort zeigen', 'Falsche Felder werden gleich rot markiert und korrigiert.'),
    row('timer', 'Zeit anzeigen', 'Die Uhr läuft trotzdem mit – für die Statistik.'));
  await showModal({ title: 'Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }] });
}

