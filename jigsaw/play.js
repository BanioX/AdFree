// Puzzle – Spielansicht: Tisch mit Brett (Canvas), Teile-Leiste unten, Ziehen, Einrasten,
// Gruppen, Zoomen/Verschieben, Vorlage, Vorschau, Zeit und automatisches Speichern.

import { h, icon, celebrate, sleep, soundButton, backButton, ease } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import * as L from './logic.js';
import { cutPieces, paintPlaced, makeGhost, drawTrayPiece, piecePath2D, cellOrigin } from './pieces.js';
import { makeCanvas } from './images.js';

const TRAY_BOX = 72;
const HALF_PI = Math.PI / 2;

/**
 * opts: { desc, title, slot, tier, rotate, saved, coach, prefs: { ghost, filter },
 *         onBack(), onHelp(), onSave(meta, data), onWin({ time, pieces, moves, src }), onError(err), setPref(name, value) }
 * Gibt { destroy, debug } zurück.
 */
export function createPlay(app, opts) {
  const { desc } = opts;
  let destroyed = false;
  const cleanups = [];
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

  // ---------- DOM ----------
  const titleEl = h('div.pz-title', null, opts.title || desc.title || 'Puzzle');
  const progEl = h('span.pz-prog', null, '');
  const timeEl = h('span.pz-time', null, '0:00');
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  const top = h('header.topbar.pz-top', null,
    backButton('#', () => { sfx.play('click'); leave(); }),
    h('div.pz-head', null, titleEl, h('div.pz-sub', null, progEl, h('span.pz-dot', null, '·'), timeEl)),
    helpBtn, soundButton());

  const board = h('canvas.pz-board');
  const table = h('div.pz-table', null, board);
  const fitBtn = h('button.icon-btn.pz-fit', { type: 'button', 'aria-label': 'Ganzes Brett zeigen', html: icon('zoomOut') });
  table.append(fitBtn);

  const chips = {};
  const filterRow = h('div.pz-filter', { role: 'tablist' });
  for (const [id, label] of [['rand', 'Rand'], ['innen', 'Innen'], ['alle', 'Alle']]) {
    const b = h('button.pz-chip', { type: 'button', 'data-id': id }, h('span', null, label), h('b', null, ''));
    b.addEventListener('click', () => setFilter(id, true));
    chips[id] = b;
    filterRow.append(b);
  }
  const ghostBtn = h('button.icon-btn.pz-tool', { type: 'button', 'aria-label': 'Vorlage auf dem Brett', html: icon('image') });
  const previewBtn = h('button.icon-btn.pz-tool', { type: 'button', 'aria-label': 'Bild ansehen', html: icon('expand') });
  const toolbar = h('div.pz-toolbar', null, filterRow, h('div.spacer'), ghostBtn, previewBtn);
  const trayEl = h('div.pz-tray');
  const trayEmpty = h('div.pz-tray-empty', null, '');
  const dock = h('div.pz-dock', null, toolbar, h('div.pz-tray-wrap', null, trayEl, trayEmpty));
  const over = h('canvas.pz-over');
  const loadBar = h('i');
  const loading = h('div.pz-loading', null, h('div.pz-load-card', null,
    h('div.pz-load-icon', { html: '🧩' }), h('div.pz-load-text', null, 'Teile werden zugeschnitten …'), h('div.pz-load-bar', null, loadBar)));
  const stage = h('div.pz-stage', null, table, dock, over, loading);
  const root = h('div.pz-root', null, top, stage);
  app.replaceChildren(root);

  // ---------- Zustand ----------
  let geo = null, state = null, src = null, cut = null, layer = null, ghost = null, edgeSet = null;
  let Aw = 0, Ah = 0, stageW = 0, stageH = 0, dpr = 1;
  let s0 = 1, fitX = 0, fitY = 0, z = 1, tx = 0, ty = 0, S = 1, zMax = 2;
  let bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  let ghostOn = !opts.prefs || opts.prefs.ghost !== false;
  let filter = (opts.prefs && opts.prefs.filter) || 'rand';
  let running = false;
  let lastTick = performance.now();
  let dirty = true, raf = 0, boardDirty = true;
  const tweens = new Map();     // Teil → { fx, fy, t0, dur }
  const settling = new Map();   // Teil → Zeitpunkt, an dem es in die Brett-Ebene wandert
  const flashes = [];           // { pieces, t0 }
  const sparks = [];            // { x, y, vx, vy, t0, life, c }
  let rotAnim = null;           // { members:Set, px, py, t0 }
  let finish = null;            // { t0 }
  let viewAnim = null;
  let drag = null, pinch = null, pan = null, trayIntent = null;
  const pts = new Map();
  let lastTap = { t: 0, x: 0, y: 0 };
  let coachEl = null;
  let saveTimer = 0;
  let winning = false;
  let isReady = false;

  const bctx = board.getContext('2d');
  const octx = over.getContext('2d');

  // ---------- Laden ----------
  (async () => {
    try {
      if (desc.prepare) await desc.prepare();
      const aspect = desc.aspect || 0.75;
      const saved = opts.saved;
      let cols, rows, seed;
      if (saved && saved.v === 1 && saved.cols && saved.rows) { cols = saved.cols; rows = saved.rows; seed = saved.seed >>> 0; }
      else { ({ cols, rows } = L.gridFor(opts.tier, aspect)); seed = (Math.random() * 2 ** 31) >>> 0; }
      geo = L.makeGeometry({ cols, rows, seed, aspect });
      state = saved ? L.deserialize(saved, geo) : null;
      if (!state) state = L.newGame({ cols, rows, seed, aspect, rotate: opts.rotate });
      edgeSet = new Set();
      for (let i = 0; i < geo.count; i++) if (L.isEdgePiece(i, cols, rows)) edgeSet.add(i);
      zMax = geo.count >= 70 ? 3.2 : geo.count >= 40 ? 2.6 : geo.count >= 20 ? 2 : 1.6;
      layout();
      await sleep(16);
      const dprCap = Math.min(window.devicePixelRatio || 1, 3);
      const want = geo.W * s0 * dprCap * zMax * 0.72;
      const srcW = Math.round(Math.max(720, Math.min(geo.H > geo.W ? 1500 : 1600, want)));
      src = await desc.render(srcW);
      if (destroyed) return;
      cut = await cutPieces(geo, src, { onProgress: (p) => { loadBar.style.width = Math.round(p * 100) + '%'; } });
      if (destroyed) return;
      layer = makeCanvas(src.width, src.height);
      state.pieces.forEach((p, i) => { if (p.s === L.PLACED) paintPlaced(layer, geo, src, i); });
      ghost = makeGhost(src);
      for (const g of new Set(state.order.map((i) => state.pieces[i].g))) L.clampGroup(state, g, bounds);
      buildTray();
      setFilter(filter, false);
      setGhost(ghostOn, false);
      loading.classList.add('gone');
      setTimeout(() => loading.remove(), 400);
      running = !state.done;
      lastTick = performance.now();
      updateHud();
      kick();
      if (opts.coach && state.tray.length === geo.count) showCoach();
      if (state.done || L.isComplete(state)) { state.done = true; finish = { t0: performance.now() - 5000 }; kick(); }
      save();
      isReady = true;
    } catch (err) {
      if (!destroyed && opts.onError) opts.onError(err);
    }
  })();

  // ---------- Layout ----------
  function layout() {
    const sr = stage.getBoundingClientRect();
    const tr = table.getBoundingClientRect();
    stageW = sr.width; stageH = sr.height;
    Aw = tr.width; Ah = tr.height;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (const [cv, w, hh] of [[board, Aw, Ah], [over, stageW, stageH]]) {
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(hh * dpr));
      cv.style.width = w + 'px';
      cv.style.height = hh + 'px';
    }
    if (!geo) return;
    const padX = Math.max(14, Aw * 0.06), padY = Math.max(12, Ah * 0.035);
    s0 = Math.max(0.05, Math.min((Aw - 2 * padX) / geo.W, (Ah - 2 * padY) / geo.H));
    fitX = (Aw - geo.W * s0) / 2;
    fitY = (Ah - geo.H * s0) / 2;
    const hx = geo.pw * 0.32, hy = geo.ph * 0.32;
    bounds = { x0: -fitX / s0 + hx, y0: -fitY / s0 + hy, x1: (Aw - fitX) / s0 - hx, y1: (Ah - fitY) / s0 - hy };
    setView(Math.min(z, zMax), null, null);
    if (state) for (const g of new Set(state.order.map((i) => state.pieces[i].g))) L.clampGroup(state, g, bounds);
    dirty = true;
  }

  function setView(nz, ntx, nty) {
    z = Math.max(1, Math.min(zMax, nz));
    S = s0 * z;
    tx = ntx == null ? fitX * z - (z - 1) * Aw / 2 : ntx;
    ty = nty == null ? fitY * z - (z - 1) * Ah / 2 : nty;
    clampView();
  }

  function clampView() {
    const minX = Aw - (Aw - fitX) * z, maxX = fitX * z;
    const minY = Ah - (Ah - fitY) * z, maxY = fitY * z;
    tx = Math.max(minX, Math.min(maxX, tx));
    ty = Math.max(minY, Math.min(maxY, ty));
    fitBtn.classList.toggle('show', z > 1.02);
  }

  function zoomAt(sx, sy, nz) {
    const wx = (sx - tx) / S, wy = (sy - ty) / S;
    z = Math.max(1, Math.min(zMax, nz));
    S = s0 * z;
    tx = sx - wx * S; ty = sy - wy * S;
    clampView();
    dirty = true; kick();
  }

  function animateView(nz, cx, cy) {
    const from = { z, tx, ty };
    const wx = (cx - tx) / S, wy = (cy - ty) / S;
    const zz = Math.max(1, Math.min(zMax, nz));
    const S1 = s0 * zz;
    let ttx = cx - wx * S1, tty = cy - wy * S1;
    if (zz === 1) { ttx = fitX; tty = fitY; }
    const save = { z, tx, ty, S };
    z = zz; S = S1; tx = ttx; ty = tty; clampView();
    const to = { z, tx, ty };
    z = save.z; S = save.S; tx = save.tx; ty = save.ty;
    viewAnim = { from, to, t0: performance.now(), dur: 260 };
    kick();
  }

  const ro = new ResizeObserver(() => { if (!destroyed) { layout(); kick(); } });
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());

  // ---------- Koordinaten ----------
  function stagePos(e) {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const toWorld = (p) => ({ x: (p.x - tx) / S, y: (p.y - ty) / S });

  function pieceAt(p) {
    if (!state) return -1;
    const w = toWorld(p);
    const slack = Math.max(0.16 * geo.m, 8 / S);
    for (let k = state.order.length - 1; k >= 0; k--) {
      const i = state.order[k];
      const q = state.pieces[i];
      const [lx, ly] = L.rot(w.x - q.x, w.y - q.y, (4 - q.r) % 4);
      if (Math.abs(lx) <= geo.pw / 2 + slack && Math.abs(ly) <= geo.ph / 2 + slack) return i;
    }
    // sehr kleine Teile: nächstgelegenes in Fingerreichweite
    const reach = Math.max(0.7 * geo.m, 22 / S);
    let best = -1, bd = reach * reach;
    for (const i of state.order) {
      const q = state.pieces[i];
      const d = (q.x - w.x) ** 2 + (q.y - w.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- Leiste ----------
  const trayItems = new Map();

  function trayItem(i) {
    let el = trayItems.get(i);
    if (el) return el;
    const cv = h('canvas');
    cv.style.width = TRAY_BOX + 'px';
    cv.style.height = TRAY_BOX + 'px';
    el = h('div.pz-ti', { 'data-i': String(i) }, cv);
    drawTrayPiece(cv, geo, cut, i, state.pieces[i].r, TRAY_BOX, Math.min(dpr, 2));
    on(el, 'pointerdown', (e) => trayDown(e, i, el));
    trayItems.set(i, el);
    return el;
  }

  function buildTray() {
    const keep = new Set(state.tray);
    for (const [i, el] of trayItems) if (!keep.has(i)) { el.remove(); trayItems.delete(i); }
    const els = state.tray.map(trayItem);
    trayEl.replaceChildren(...els);
    applyFilter();
  }

  function counts() {
    let rand = 0, innen = 0;
    for (const i of state.tray) { if (edgeSet.has(i)) rand++; else innen++; }
    return { rand, innen, alle: rand + innen };
  }

  function applyFilter() {
    if (!state) return;
    const c = counts();
    for (const id of Object.keys(chips)) {
      chips[id].classList.toggle('on', id === filter);
      chips[id].querySelector('b').textContent = String(c[id]);
    }
    for (const i of state.tray) {
      const show = filter === 'alle' || (filter === 'rand') === edgeSet.has(i);
      trayItems.get(i).classList.toggle('hide', !show);
    }
    let msg = '';
    if (c.alle === 0) msg = L.isComplete(state) ? '' : 'Alle Teile liegen auf dem Tisch.';
    else if (c[filter] === 0) msg = filter === 'rand' ? 'Alle Randteile sind draussen – weiter mit «Innen».' : 'Keine Innenteile mehr – schau bei «Rand».';
    trayEmpty.textContent = msg;
    trayEmpty.classList.toggle('show', !!msg);
  }

  function setFilter(id, user) {
    if (user && id !== filter) sfx.play('click');
    filter = id;
    if (opts.setPref) opts.setPref('filter', id);
    applyFilter();
    if (user) trayEl.scrollTo({ left: 0, behavior: 'smooth' });
  }

  function setGhost(onOff, user) {
    ghostOn = onOff;
    ghostBtn.classList.toggle('on', ghostOn);
    if (user) { sfx.play('click'); if (opts.setPref) opts.setPref('ghost', ghostOn); }
    dirty = true; kick();
  }
  on(ghostBtn, 'click', () => setGhost(!ghostOn, true));
  on(previewBtn, 'click', () => { sfx.play('click'); showPreview(); });
  on(helpBtn, 'click', () => { sfx.play('click'); if (opts.onHelp) opts.onHelp(); });
  on(fitBtn, 'click', () => { sfx.play('click'); animateView(1, Aw / 2, Ah / 2); });

  function trayIndexAt(x) {
    const visible = state.tray.filter((i) => !trayItems.get(i).classList.contains('hide'));
    const tr = stage.getBoundingClientRect();
    for (let k = 0; k < visible.length; k++) {
      const r = trayItems.get(visible[k]).getBoundingClientRect();
      if (x + tr.left < r.left + r.width / 2) return state.tray.indexOf(visible[k]);
    }
    return state.tray.length;
  }

  // ---------- Eingabe: Leiste ----------
  function trayDown(e, i, el) {
    if (!state || state.done || drag || pinch) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    trayIntent = { pid: e.pointerId, i, el, x0: e.clientX, y0: e.clientY, scroll0: trayEl.scrollLeft, type: e.pointerType };
    if (e.pointerType === 'mouse') e.preventDefault();
  }

  function trayMove(e) {
    const t = trayIntent;
    const dx = e.clientX - t.x0, dy = e.clientY - t.y0;
    if (dy < -9 && Math.abs(dy) > Math.abs(dx) * 0.8) {
      trayIntent = null;
      pickFromTray(t.i, e, t.type);
      return;
    }
    if (t.type === 'mouse' && Math.abs(dx) > 4) trayEl.scrollLeft = t.scroll0 - dx;
  }

  function pickFromTray(i, e, type) {
    const p = stagePos(e);
    const lift = type === 'mouse' ? 0 : Math.min(70, geo.ph * S * 0.5 + 16);
    const w = toWorld({ x: p.x, y: p.y - lift });
    L.takeFromTray(state, i, w.x, w.y);
    const el = trayItems.get(i);
    if (el) { el.remove(); trayItems.delete(i); }
    applyFilter();
    // Randteile alle draussen? Dann automatisch zu den Innenteilen (und umgekehrt)
    const c = counts();
    if (filter !== 'alle' && c[filter] === 0 && c.alle > 0) setFilter(filter === 'rand' ? 'innen' : 'rand', false);
    hideCoach();
    startDrag(i, e.pointerId, p, true);
    sfx.play('tap');
  }

  // Sobald ein Teil aus der Leiste gehoben ist, darf die Leiste nicht mehr seitlich scrollen
  // (sonst bricht der Browser die Geste mit pointercancel ab).
  on(trayEl, 'touchmove', (e) => { if (drag && drag.fromTray && e.cancelable) e.preventDefault(); }, { passive: false });

  // ---------- Eingabe: Tisch ----------
  // Touch-Standardverhalten (Zoom der Seite, Lupe, Scrollen) auf dem Tisch ganz abschalten –
  // alles läuft über Pointer Events.
  on(table, 'touchstart', (e) => { if (e.cancelable && !(e.target.closest && e.target.closest('.pz-fit'))) e.preventDefault(); }, { passive: false });
  on(table, 'touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  on(table, 'pointerdown', (e) => {
    if (!state || e.target === fitBtn || fitBtn.contains(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { table.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const p = stagePos(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2 && !drag) {
      pan = null;
      const [a, b] = [...pts.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: z, w: toWorld(mid) };
      return;
    }
    if (pts.size > 1 || state.done) return;
    const i = pieceAt(p);
    if (i >= 0) { startDrag(i, e.pointerId, p, false); return; }
    pan = { pid: e.pointerId, x: p.x, y: p.y, moved: false };
  });

  on(table, 'wheel', (e) => {
    if (!state) return;
    e.preventDefault();
    const p = stagePos(e);
    zoomAt(p.x, p.y, z * Math.exp(-e.deltaY * 0.0022));
  }, { passive: false });

  on(window, 'pointermove', (e) => {
    if (trayIntent && e.pointerId === trayIntent.pid) { trayMove(e); return; }
    if (!pts.has(e.pointerId) && !(drag && drag.pid === e.pointerId)) return;
    const p = stagePos(e);
    if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      z = Math.max(1, Math.min(zMax, pinch.z0 * d / pinch.d0));
      S = s0 * z;
      tx = mid.x - pinch.w.x * S; ty = mid.y - pinch.w.y * S;
      clampView();
      dirty = true; kick();
      return;
    }
    if (drag && drag.pid === e.pointerId) { moveDrag(p); return; }
    if (pan && pan.pid === e.pointerId) {
      const dx = p.x - pan.x, dy = p.y - pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
      tx += dx; ty += dy; pan.x = p.x; pan.y = p.y;
      clampView();
      dirty = true; kick();
    }
  });

  function pointerEnd(e) {
    if (trayIntent && e.pointerId === trayIntent.pid) { trayIntent = null; return; }
    const had = pts.delete(e.pointerId);
    if (drag && drag.pid === e.pointerId) { endDrag(stagePos(e), e.type === 'pointercancel'); return; }
    if (pinch && pts.size < 2) {
      pinch = null;
      if (pts.size === 1) { const [id, p] = [...pts.entries()][0]; pan = { pid: id, x: p.x, y: p.y, moved: true }; }
      return;
    }
    if (pan && pan.pid === e.pointerId) {
      const p = stagePos(e);
      if (!pan.moved && had && e.type !== 'pointercancel') {
        const now = performance.now();
        if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          animateView(z > 1.05 ? 1 : Math.min(zMax, 2.2), p.x, p.y);
          lastTap.t = 0;
        } else lastTap = { t: now, x: p.x, y: p.y };
      }
      pan = null;
    }
  }
  on(window, 'pointerup', pointerEnd);
  on(window, 'pointercancel', pointerEnd);

  // ---------- Ziehen ----------
  function startDrag(i, pid, p, fromTray) {
    const g = state.pieces[i].g;
    L.bringToTop(state, g);
    const members = L.groupMembers(state, g);
    for (const k of members) tweens.delete(k);
    drag = { i, g, pid, last: toWorld(p), pos: p, fromTray, t0: performance.now(), x0: p.x, y0: p.y, moved: fromTray, members: new Set(members) };
    dirty = true; kick();
  }

  function moveDrag(p) {
    const w = toWorld(p);
    L.moveGroup(state, drag.g, w.x - drag.last.x, w.y - drag.last.y);
    drag.last = w; drag.pos = p;
    if (Math.abs(p.x - drag.x0) + Math.abs(p.y - drag.y0) > 7) drag.moved = true;
    kick(false);
  }

  function endDrag(p, cancelled) {
    const d = drag;
    drag = null;
    const members = L.groupMembers(state, d.g);
    if (!members.length) { dirty = true; kick(); return; }
    const quick = performance.now() - d.t0 < 400;
    if (!d.moved && !cancelled) {
      if (state.rotate && quick) { rotate(d.i); return; }
      dirty = true; kick(); return;
    }
    if (!cancelled && p.y > Ah && members.length === 1) {
      const idx = trayIndexAt(p.x);
      L.returnToTray(state, members[0], idx);
      buildTray();
      const el = trayItems.get(members[0]);
      if (el) { el.classList.add('sp-pop'); if (el.classList.contains('hide')) { filter = 'alle'; applyFilter(); } }
      sfx.play('whoosh');
      state.moves++;
      dirty = true; kick(); saveSoon();
      return;
    }
    drop(d.g);
  }

  function rotate(i) {
    const g = state.pieces[i].g;
    const members = L.groupMembers(state, g);
    const p = state.pieces[i];
    const px = p.x, py = p.y;
    L.rotateGroup(state, g, px, py);
    L.clampGroup(state, g, bounds);
    rotAnim = { members: new Set(members), px: state.pieces[i].x, py: state.pieces[i].y, t0: performance.now(), dur: 170 };
    sfx.play('tap');
    state.moves++;
    setTimeout(() => { if (!destroyed && state.pieces[i].s === L.TABLE) drop(state.pieces[i].g, true); }, 180);
    kick(); saveSoon();
  }

  function drop(g, silent = false) {
    L.clampGroup(state, g, bounds);
    const before = new Map();
    state.pieces.forEach((q, k) => { if (q.s === L.TABLE) before.set(k, [q.x, q.y]); });
    const tol = Math.max(0.3 * geo.m, 16 / S);
    const events = L.dropGroup(state, geo, g, tol);
    const now = performance.now();
    for (const [k, [x, y]] of before) {
      const q = state.pieces[k];
      if (Math.abs(q.x - x) > 0.01 || Math.abs(q.y - y) > 0.01) tweens.set(k, { fx: x, fy: y, t0: now, dur: 150 });
    }
    let placed = false, joined = false;
    for (const ev of events) {
      if (ev.type === 'board') {
        placed = true;
        for (const k of ev.pieces) settling.set(k, now + 150);
        flashes.push({ pieces: ev.pieces, t0: now + 150 });
        burst(ev.pieces, now + 150);
      } else if (ev.type === 'join') {
        joined = true;
        flashes.push({ pieces: L.groupMembers(state, ev.with), t0: now + 150, soft: true });
      }
    }
    if (!silent) state.moves++;
    applyFilter();
    if (placed) setTimeout(() => sfx.play('place'), 120);
    else if (joined) setTimeout(() => sfx.play('click'), 120);
    updateHud();
    dirty = true; kick(); saveSoon();
    if (L.isComplete(state) && !winning) win();
  }

  function burst(pieces, t0) {
    if (sparks.length > 160) return;
    const colors = ['#fff6d8', '#ffd76a', '#ffffff', '#ffe9b0'];
    for (const k of pieces.slice(0, 12)) {
      const [x, y] = L.targetOf(geo, k);
      for (let n = 0; n < 5; n++) {
        const a = Math.random() * Math.PI * 2, sp = (0.25 + Math.random() * 0.55) * geo.m;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0, life: 420 + Math.random() * 220, c: colors[n % colors.length], r: 0.02 * geo.m + Math.random() * 0.025 * geo.m });
      }
    }
  }

  // ---------- Gewonnen ----------
  async function win() {
    winning = true;
    accumulate();
    state.done = true;
    running = false;
    if (opts.onSolved) opts.onSolved({ time: state.time, pieces: geo.count, moves: state.moves });
    await sleep(420);
    if (destroyed) return;
    finish = { t0: performance.now() };
    sfx.play('complete');
    kick();
    await sleep(650);
    if (destroyed) return;
    celebrate();
    sfx.play('sparkle');
    await sleep(1300);
    if (destroyed) return;
    if (opts.onWin) opts.onWin({ time: state.time, pieces: geo.count, moves: state.moves, src });
  }

  // ---------- Vorschau & Hinweise ----------
  function showPreview() {
    if (!src) return;
    const cv = makeCanvas(src.width, src.height);
    cv.getContext('2d').drawImage(src, 0, 0);
    cv.className = 'pz-preview-img';
    const ov = h('div.pz-preview', null, cv, h('div.pz-preview-hint', null, 'Tippen zum Schliessen'));
    const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); };
    ov.addEventListener('click', close);
    stage.append(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  function showCoach() {
    const first = trayEl.querySelector('.pz-ti:not(.hide)');
    if (!first) return;
    const sr = stage.getBoundingClientRect(), r = first.getBoundingClientRect();
    coachEl = h('div.pz-coach', { style: { left: (r.left - sr.left) + 'px', top: (r.top - sr.top) + 'px', width: r.width + 'px', height: r.height + 'px' } },
      h('div.pz-coach-ring'), h('div.pz-coach-text', null, 'Teil nach oben aufs Brett ziehen'));
    stage.append(coachEl);
    const off = () => hideCoach();
    trayEl.addEventListener('scroll', off, { once: true });
  }
  function hideCoach() {
    if (coachEl) { coachEl.remove(); coachEl = null; }
  }

  // ---------- Zeit, Anzeige, Speichern ----------
  function accumulate() {
    const now = performance.now();
    if (running && !document.hidden && state && !state.done) state.time += Math.min(now - lastTick, 5000);
    lastTick = now;
  }

  function updateHud() {
    if (!state) return;
    progEl.textContent = `${L.placedCount(state)}/${geo.count} Teile`;
    timeEl.textContent = L.formatTime(state.time);
  }

  let ticks = 0;
  const timer = setInterval(() => {
    if (!state) return;
    accumulate();
    updateHud();
    if (++ticks % 10 === 0 && running) save();
  }, 1000);
  cleanups.push(() => clearInterval(timer));

  function save() {
    if (!state || !geo || !opts.onSave) return;
    clearTimeout(saveTimer);
    opts.onSave({ key: desc.key, tier: opts.tier, rotate: state.rotate, title: opts.title || desc.title, placed: L.placedCount(state), total: geo.count }, L.serialize(state));
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }
  on(document, 'visibilitychange', () => {
    accumulate();
    if (document.hidden) save();
  });
  on(window, 'pagehide', () => { accumulate(); save(); });

  function leave() {
    accumulate();
    if (state && !state.done) save();
    if (opts.onBack) opts.onBack();
  }

  // ---------- Zeichnen ----------
  function kick(board = true) {
    if (board) boardDirty = true;
    if (!raf && !destroyed) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    if (destroyed || !geo || !cut) return;
    let busy = false;
    if (viewAnim) {
      const t = Math.min(1, (now - viewAnim.t0) / viewAnim.dur), e = ease.outCubic(t);
      z = viewAnim.from.z + (viewAnim.to.z - viewAnim.from.z) * e;
      S = s0 * z;
      tx = viewAnim.from.tx + (viewAnim.to.tx - viewAnim.from.tx) * e;
      ty = viewAnim.from.ty + (viewAnim.to.ty - viewAnim.from.ty) * e;
      fitBtn.classList.toggle('show', viewAnim.to.z > 1.02);
      if (t >= 1) viewAnim = null;
      busy = true;
    }
    if (drag && z > 1.01) busy = edgeScroll() || busy;
    for (const [k, tw] of tweens) if (now - tw.t0 >= tw.dur) tweens.delete(k); else busy = true;
    for (const [k, t] of settling) {
      if (now >= t) { paintPlaced(layer, geo, src, k); settling.delete(k); } else busy = true;
    }
    if (rotAnim && now - rotAnim.t0 >= rotAnim.dur) rotAnim = null;
    if (rotAnim) busy = true;
    for (let n = flashes.length - 1; n >= 0; n--) if (now - flashes[n].t0 > 520) flashes.splice(n, 1); else busy = true;
    for (let n = sparks.length - 1; n >= 0; n--) if (now - sparks[n].t0 > sparks[n].life) sparks.splice(n, 1); else busy = true;
    if (finish && now - finish.t0 < 2600) busy = true;
    if (busy) boardDirty = true;
    const lifting = drag && now - drag.t0 < 160;
    if (boardDirty) drawBoard(now);
    drawOverlay(now);
    dirty = false;
    boardDirty = false;
    if (busy) kick();
    else if (lifting) kick(false);
  }

  function edgeScroll() {
    const p = drag.pos, edge = 34;
    let vx = 0, vy = 0;
    if (p.x < edge) vx = (edge - p.x) / edge;
    else if (p.x > Aw - edge) vx = -(p.x - (Aw - edge)) / edge;
    if (p.y < edge) vy = (edge - p.y) / edge;
    else if (p.y > Ah - edge && p.y < Ah + 6) vy = -(p.y - (Ah - edge)) / edge;
    if (!vx && !vy) return false;
    const otx = tx, oty = ty;
    tx += vx * 7; ty += vy * 7;
    clampView();
    if (tx === otx && ty === oty) return false;
    moveDrag(p);
    return true;
  }

  function posOf(k, now) {
    const q = state.pieces[k];
    const tw = tweens.get(k);
    if (!tw) return [q.x, q.y];
    const e = ease.outCubic(Math.min(1, (now - tw.t0) / tw.dur));
    return [tw.fx + (q.x - tw.fx) * e, tw.fy + (q.y - tw.fy) * e];
  }

  function drawSprite(c, k, x, y, r) {
    const sp = cut.sprites[k];
    const sw = geo.pw + 2 * cut.pad, sh = geo.ph + 2 * cut.pad;
    if (r) {
      c.save(); c.translate(x, y); c.rotate(r * HALF_PI);
      c.drawImage(sp, -sw / 2, -sh / 2, sw, sh);
      c.restore();
    } else c.drawImage(sp, x - sw / 2, y - sh / 2, sw, sh);
  }

  function rrect(c, x, y, w, hh, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + hh, r);
    c.arcTo(x + w, y + hh, x, y + hh, r);
    c.arcTo(x, y + hh, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawBoard(now) {
    const c = bctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, Aw, Ah);
    c.save();
    c.translate(tx, ty);
    c.scale(S, S);
    c.imageSmoothingQuality = 'medium';
    const { W, H } = geo;
    const fr = Math.max(6 / S, 0.035 * geo.m);
    // Brett: Rahmen + vertiefte Fläche
    c.fillStyle = 'rgba(120, 86, 52, 0.10)';
    rrect(c, -fr * 1.6, -fr * 1.2, W + fr * 3.2, H + fr * 3.2, fr * 2.2); c.fill();
    c.fillStyle = '#f7efe3';
    rrect(c, -fr, -fr, W + 2 * fr, H + 2 * fr, fr * 1.4); c.fill();
    c.fillStyle = '#e6d8c4';
    c.fillRect(0, 0, W, H);
    c.lineWidth = 1.5 / S;
    c.strokeStyle = 'rgba(110, 80, 50, 0.22)';
    c.strokeRect(0, 0, W, H);
    if (ghostOn && ghost && !finish) {
      c.globalAlpha = 0.26;
      c.drawImage(ghost, 0, 0, W, H);
      c.globalAlpha = 1;
    }
    c.drawImage(layer, 0, 0, W, H);
    if (finish) drawFinish(c, now);
    // einrastende Teile
    for (const k of settling.keys()) { const [x, y] = posOf(k, now); drawSprite(c, k, x, y, 0); }
    // lose Teile
    const rotT = rotAnim ? ease.outBack(Math.min(1, (now - rotAnim.t0) / rotAnim.dur)) : 1;
    for (const k of state.order) {
      if (drag && drag.members.has(k)) continue;
      const q = state.pieces[k];
      const [x, y] = posOf(k, now);
      if (rotAnim && rotAnim.members.has(k)) {
        c.save();
        c.translate(rotAnim.px, rotAnim.py);
        c.rotate(-(1 - rotT) * HALF_PI);
        c.translate(-rotAnim.px, -rotAnim.py);
        drawSprite(c, k, x, y, q.r);
        c.restore();
      } else drawSprite(c, k, x, y, q.r);
    }
    // Aufleuchten
    for (const f of flashes) {
      const t = (now - f.t0) / 520;
      if (t < 0) continue;
      const a = (f.soft ? 0.32 : 0.55) * (1 - t) * (1 - t);
      c.fillStyle = `rgba(255, 252, 235, ${a})`;
      for (const k of f.pieces) {
        const q = state.pieces[k];
        let x, y;
        if (q.s === L.PLACED) { [x, y] = cellOrigin(geo, k); }
        else {
          if (q.r) continue;
          [x, y] = [q.x - geo.pw / 2, q.y - geo.ph / 2];
        }
        c.save(); c.translate(x, y); c.fill(piecePath2D(geo, k)); c.restore();
      }
    }
    for (const s of sparks) {
      const t = (now - s.t0) / s.life;
      if (t < 0) continue;
      const e = ease.outCubic(t);
      c.globalAlpha = Math.max(0, 1 - t);
      c.fillStyle = s.c;
      c.beginPath();
      c.arc(s.x + s.vx * e, s.y + s.vy * e, s.r * (1 - 0.5 * t), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  // Gezogene Gruppe auf der Deckebene (auch über der Leiste)
  function drawOverlay(now) {
    const o = octx;
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.clearRect(0, 0, stageW, stageH);
    if (drag) {
      const lift = 1 + 0.06 * ease.outBack(Math.min(1, (now - drag.t0) / 160));
      const g = drag.last;
      o.save();
      o.translate(tx, ty);
      o.scale(S, S);
      o.translate(g.x, g.y); o.scale(lift, lift); o.translate(-g.x, -g.y);
      o.imageSmoothingQuality = 'medium';
      for (const k of state.order) {
        if (!drag.members.has(k)) continue;
        const q = state.pieces[k];
        drawSprite(o, k, q.x, q.y, q.r);
      }
      o.restore();
    }
  }

  function drawFinish(c, now) {
    const t = (now - finish.t0) / 1000;
    const { W, H } = geo;
    c.globalAlpha = Math.min(1, t / 0.9);
    c.drawImage(src, 0, 0, W, H);
    c.globalAlpha = 1;
    const sweep = Math.min(1, t / 1.5);
    if (sweep < 1) {
      c.save();
      c.beginPath(); c.rect(0, 0, W, H); c.clip();
      const span = W + H;
      const pos = -0.25 * span + sweep * 1.5 * span;
      const gr = c.createLinearGradient(pos - 0.18 * span, pos - 0.18 * span, pos + 0.18 * span, pos + 0.18 * span);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,250,225,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = gr;
      c.fillRect(0, 0, W, H);
      c.restore();
    }
    // goldener Rahmen glimmt auf
    const ga = Math.min(1, t / 0.6) * (0.55 + 0.25 * Math.sin(t * 3));
    c.lineWidth = Math.max(3 / S, 0.025 * geo.m);
    c.strokeStyle = `rgba(232, 182, 72, ${ga})`;
    c.strokeRect(0, 0, W, H);
  }

  // ---------- Aufräumen ----------
  function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(saveTimer);
    for (const f of cleanups) f();
    // Leinwand-Speicher sofort freigeben (iOS hält ihn sonst lange fest)
    setTimeout(() => {
      const free = (c) => { if (c) { c.width = 0; c.height = 0; } };
      if (cut) cut.sprites.forEach(free);
      for (const el of trayItems.values()) free(el.firstChild);
      [layer, ghost, src, board, over].forEach(free);
    }, 0);
  }

  // Für automatische Tests: Bildschirm-Koordinaten von Teilen und Zielen
  const debug = {
    ready: () => isReady,
    state: () => state,
    geo: () => geo,
    trayPoint(i) {
      const el = trayItems.get(i);
      if (!el) return null;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    targetPoint(i) {
      const [x, y] = L.targetOf(geo, i);
      const r = stage.getBoundingClientRect();
      return { x: r.left + tx + x * S, y: r.top + ty + y * S };
    },
    piecePoint(i) {
      const q = state.pieces[i];
      const r = stage.getBoundingClientRect();
      return { x: r.left + tx + q.x * S, y: r.top + ty + q.y * S };
    },
    lift: () => Math.min(70, geo.ph * S * 0.5 + 16),
    zoom(nz) { zoomAt(Aw / 2, Ah / 2, nz); },
    /** Nur für Ansichts-Tests: Teile direkt legen bzw. lose verteilen. */
    debugPlace(placeIds, looseIds = []) {
      for (const i of placeIds) {
        const [x, y] = L.targetOf(geo, i);
        L.takeFromTray(state, i, x, y);
        L.dropGroup(state, geo, i, 1);
        if (state.pieces[i].s === L.PLACED) paintPlaced(layer, geo, src, i);
      }
      looseIds.forEach((i, n) => {
        const x = bounds.x0 + ((n * 0.37 + 0.1) % 1) * (bounds.x1 - bounds.x0);
        const y = bounds.y0 + ((n * 0.61 + 0.2) % 1) * (bounds.y1 - bounds.y0);
        L.takeFromTray(state, i, x, y);
      });
      buildTray(); updateHud(); hideCoach();
      dirty = true; kick();
    },
  };

  return { destroy, debug, save };
}
