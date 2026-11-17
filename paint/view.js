// Mal-Ansicht von Farbenzauber: Kopfzeile, Bühne, Farbpalette, Fertig-Blatt, Zeitraffer, Export.

import { icon, h, toast, confirmDialog, celebrate, sleep } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { store } from '../shared/storage.js';
import { getAnalysis } from './engine/analyze.js';
import { buildModel } from './engine/model.js';
import { Stage } from './engine/stage.js';
import { renderExport, luminance } from './engine/render.js';
import { encodeBits, decodeBits, encodeOrder, decodeOrder, percent } from './engine/progress.js';
import { loadProgress, saveProgress, removeProgress, updateSummary } from './state.js';
import { onTap as onPress } from './tap.js';
import { addStats, loadStats, formatDuration } from './stats.js';
import { TIPS } from './data/howto.js';
import { showHowto } from './tutorial.js';

const NBSP = ' ';
const RING_C = 2 * Math.PI * 21;

export function createPaintView(lib, { onBack, onChanged, debug = false } = {}) {
  // ---------- DOM ----------
  const backBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zur Galerie', html: icon('back') });
  const titleEl = h('div.pv-title');
  const pctEl = h('span.pv-pct', null, '0' + NBSP + '%');
  const barFill = h('span.pv-bar-fill');
  const mid = h('div.pv-mid', null, titleEl, h('div.pv-progress', null, h('span.pv-bar', null, barFill), pctEl));
  const hintBtn = h('button.icon-btn.pv-hint', { type: 'button', 'aria-label': 'Tipp', html: icon('hint') });
  const moreBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Mehr', html: icon('more') });
  const top = h('header.topbar.pv-top', null, backBtn, mid, hintBtn, moreBtn);
  const stageHost = h('div.pv-stage');
  const badge = h('div.pv-badge.hidden', null, 'Vorlage');
  stageHost.append(badge);
  const palette = h('div.pv-palette', { role: 'listbox', 'aria-label': 'Farben' });
  const doneTitle = h('p.pv-done-sub');
  const tlBtn = h('button.btn.pv-act', { type: 'button', html: icon('play') + '<span>Zeitraffer</span>' });
  const saveBtn = h('button.btn.pv-act', { type: 'button', html: icon('download') + '<span>Bild sichern</span>' });
  const galBtn = h('button.btn.primary.block', { type: 'button' }, 'Zur Galerie');
  const doneSheet = h('div.pv-done', null,
    h('div.pv-done-head', null, h('span.pv-done-star', { html: icon('sparkle', { size: 26 }) }), h('div', null, h('h2', null, 'Fertig!'), doneTitle)),
    h('div.pv-done-row', null, tlBtn, saveBtn),
    galBtn);
  const skipBtn = h('button.btn.pv-skip', { type: 'button' }, 'Überspringen');
  const tlBar = h('div.pv-tl', null, h('span.pv-tl-label', { html: icon('play', { size: 18 }) + 'Zeitraffer' }), skipBtn);
  const dock = h('div.pv-dock', null, palette, doneSheet, tlBar);
  const loaderText = h('p.pv-load-text', null, 'Bild wird vorbereitet …');
  const loaderBar = h('span.pv-load-fill');
  const loader = h('div.pv-loader.hidden', null,
    h('div.pv-load-dots', null, h('span'), h('span'), h('span')),
    loaderText,
    h('div.pv-load-bar', null, loaderBar));
  const el = h('div.view.pv.hidden', null, top, stageHost, dock, loader);

  let S = null;           // aktuelle Sitzung
  let openToken = 0;
  let menuEl = null;

  // ---------- Kopfzeile ----------
  backBtn.addEventListener('click', () => { sfx.play('click'); onBack(); });
  onPress(hintBtn, () => hint());
  onPress(moreBtn, () => toggleMenu());
  tlBtn.addEventListener('click', () => { sfx.play('click'); timelapse(); });
  saveBtn.addEventListener('click', () => { sfx.play('click'); exportImage(); });
  galBtn.addEventListener('click', () => { sfx.play('click'); onBack(); });
  skipBtn.addEventListener('click', () => { if (S) S.skip = true; });

  function setDockMode(mode) {
    dock.dataset.mode = mode; // 'palette' | 'done' | 'timelapse' | 'none'
  }

  function toggleMenu() {
    if (menuEl) { closeMenu(); return; }
    if (!S || !S.stage) return;
    sfx.play('click');
    const item = (ic, label, fn, cls = '') => {
      const b = h('button.pv-menu-item' + cls, { type: 'button', html: icon(ic, { size: 20 }) + `<span>${label}</span>` });
      b.addEventListener('click', () => { closeMenu(); fn(); });
      return b;
    };
    const list = h('div.pv-menu', { role: 'menu' });
    if (!S.done) list.append(item('image', 'Vorlage anzeigen', () => showTemplate()));
    if (S.done) list.append(item('play', 'Zeitraffer', () => timelapse()));
    if (S.done) list.append(item('download', 'Bild sichern', () => exportImage()));
    list.append(item('hint', 'So geht’s', () => showHowto()));
    list.append(item('refresh', 'Neu beginnen', () => restart(), '.danger'));
    const backdrop = h('div.pv-menu-back');
    backdrop.addEventListener('pointerdown', (e) => { e.preventDefault(); closeMenu(); });
    menuEl = h('div.pv-menu-wrap', null, backdrop, list);
    el.append(menuEl);
    requestAnimationFrame(() => menuEl && menuEl.classList.add('show'));
  }

  function closeMenu() {
    if (!menuEl) return;
    const m = menuEl;
    menuEl = null;
    m.classList.remove('show');
    setTimeout(() => m.remove(), 180);
  }

  // ---------- Laden ----------
  let loaderTimer = 0;
  function showLoader(text) {
    loaderText.textContent = text || 'Bild wird vorbereitet …';
    loaderBar.style.width = '0%';
    clearTimeout(loaderTimer);
    loaderTimer = setTimeout(() => loader.classList.remove('hidden'), 140);
  }
  function hideLoader() {
    clearTimeout(loaderTimer);
    loader.classList.add('hidden');
  }

  async function open(id) {
    const token = ++openToken;
    close(true);
    el.classList.remove('hidden');
    titleEl.textContent = '';
    pctEl.textContent = '';
    barFill.style.width = '0%';
    palette.innerHTML = '';
    setDockMode('none');
    hintBtn.disabled = true;
    moreBtn.disabled = true;
    showLoader();
    try {
      const item = await lib.get(id);
      if (!item) throw new Error('Bild nicht gefunden');
      titleEl.textContent = item.title || '';
      const pz = await lib.loadPuzzle(item);
      if (token !== openToken) return;
      const an = await getAnalysis(pz, {
        onProgress: (p) => { if (token === openToken) loaderBar.style.width = Math.round(p * 100) + '%'; },
      });
      if (token !== openToken) return;
      const M = buildModel(pz, an);
      start(id, item, pz, M, an.h);
      hideLoader();
    } catch (err) {
      if (token !== openToken) return;
      hideLoader();
      showError();
      if (debug) console.warn('[paint] Laden fehlgeschlagen', err);
    }
  }

  function showError() {
    const msg = h('div.pv-error', null,
      h('div.pv-error-ic', { html: icon('image', { size: 40 }) }),
      h('p', null, 'Dieses Bild konnte leider nicht geladen werden.'),
      h('button.btn.primary', { type: 'button', onclick: () => onBack() }, 'Zur Galerie'));
    stageHost.append(msg);
  }

  // ---------- Start einer Sitzung ----------
  function start(id, item, pz, M, hash) {
    const n = M.n;
    const rec = loadProgress(id);
    const filled = rec && rec.f ? decodeBits(rec.f, n) : new Uint8Array(n);
    for (let i = 0; i < n; i++) if (M.auto[i]) filled[i] = 1;
    const seen = new Set();
    const order = [];
    for (const i of rec && rec.o ? decodeOrder(rec.o) : []) {
      if (i < n && filled[i] && !M.auto[i] && !seen.has(i)) { seen.add(i); order.push(i); }
    }
    for (let i = 0; i < n; i++) if (filled[i] && !M.auto[i] && !seen.has(i)) order.push(i);
    const remaining = M.colorShapes.map((list) => list.reduce((a, i) => a + (filled[i] ? 0 : 1), 0));
    const left = remaining.reduce((a, b) => a + b, 0);

    S = {
      id, item, pz, M, hash, filled, order, remaining, left,
      total: M.total, done: left === 0, selected: 0, swatches: [],
      stage: null, saveTimer: 0, playing: false, skip: false, exportBlob: null, fills: 0,
      ms: rec && +rec.ms > 0 ? +rec.ms : 0, lastAct: performance.now(), pendFills: 0, pendMs: 0,
      countedDone: left === 0,
    };
    let sel = rec && Number.isInteger(rec.c) && remaining[rec.c] > 0 ? rec.c : remaining.findIndex((r) => r > 0);
    if (sel < 0) sel = 0;
    S.selected = sel;

    const stage = new Stage(stageHost, M, {
      onTap: (sx, sy) => onTap(sx, sy),
      onBrushStart: (sx, sy) => { sfx.play('pop'); brushAt(sx, sy); },
      onBrushMove: (x0, y0, x1, y1) => {
        const d = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(d / 4));
        for (let k = 1; k <= steps; k++) brushAt(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps);
      },
      onGesture: () => { if (menuEl) closeMenu(); },
    });
    S.stage = stage;
    stage.filled.set(filled);
    stage.selected = sel;
    if (rec && rec.cam && !S.done) stage.restoreCamState(rec.cam);
    titleEl.textContent = M.title || item.title || '';
    doneTitle.textContent = M.title || item.title || '';
    buildPalette();
    updateProgress();
    moreBtn.disabled = false;
    if (S.done) {
      enterDoneState(false);
    } else {
      hintBtn.disabled = false;
      setDockMode('palette');
    }
    S.ready = true;
    if (!rec && !S.done && loadStats().fills === 0) showCoach();
    if (rec && !rec.h && hash) scheduleSave();
    if (debug) exposeDebug();
  }

  // ---------- Palette ----------
  function buildPalette() {
    const M = S.M;
    palette.innerHTML = '';
    S.swatches = [];
    M.palette.forEach((col, c) => {
      if (!M.colorShapes[c].length) { S.swatches[c] = null; return; }
      const dark = luminance(col) > 0.5;
      const sw = h('button.sw' + (dark ? '.light' : ''), { type: 'button', role: 'option', 'aria-label': `Farbe ${c + 1}` });
      sw.style.setProperty('--c', col);
      sw.innerHTML = `<svg class="sw-ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="trk" cx="24" cy="24" r="21"/><circle class="bar" cx="24" cy="24" r="21" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"/></svg><span class="sw-dot"><span class="sw-num">${c + 1}</span><span class="sw-chk">${icon('check', { size: 20, stroke: 3 })}</span></span>`;
      onPress(sw, () => select(c, true));
      palette.append(sw);
      S.swatches[c] = sw;
      updateSwatch(c);
    });
    markSelected(false);
  }

  function updateSwatch(c) {
    const sw = S.swatches[c];
    if (!sw) return;
    const total = S.M.colorShapes[c].length;
    const doneCount = total - S.remaining[c];
    const p = total ? doneCount / total : 1;
    const bar = sw.querySelector('.bar');
    bar.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(2));
    sw.classList.toggle('done', S.remaining[c] === 0);
  }

  function markSelected(scroll = true) {
    S.swatches.forEach((sw, c) => {
      if (!sw) return;
      const on = c === S.selected;
      sw.classList.toggle('sel', on);
      sw.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (scroll) scrollSwatch(S.selected);
  }

  function scrollSwatch(c) {
    const sw = S.swatches[c];
    if (!sw) return;
    const pr = palette.getBoundingClientRect(), r = sw.getBoundingClientRect();
    const target = palette.scrollLeft + (r.left + r.width / 2) - (pr.left + pr.width / 2);
    palette.scrollTo({ left: target, behavior: 'smooth' });
  }

  function select(c, user) {
    if (!S || S.done) return;
    if (user) sfx.play('click');
    if (c === S.selected) { if (user) bounce(c); return; }
    clearCoach();
    S.selected = c;
    S.stage.setSelected(c);
    markSelected(true);
    scheduleSave();
  }

  function bounce(c) {
    const sw = S.swatches[c];
    if (!sw) return;
    sw.classList.remove('bounce');
    void sw.offsetWidth;
    sw.classList.add('bounce');
  }

  // ---------- Malen ----------
  function canFill(i) {
    return !S.filled[i] && S.M.col[i] === S.selected;
  }

  function onTap(sx, sy) {
    if (!S || S.done || S.playing) return;
    const st = S.stage;
    const [ux, uy] = st.toUnits(sx, sy);
    const hit = st.hit(ux, uy);
    if (hit >= 0 && canFill(hit)) { fill(hit, ux, uy); return; }
    const near = st.findNear(sx, sy, 12, canFill, S.M.colorShapes[S.selected]);
    if (near) { fill(near.i, near.ux, near.uy); return; }
    if (hit >= 0 && !S.filled[hit]) wrong(hit, ux, uy);
  }

  function brushAt(sx, sy) {
    if (!S || S.done) return;
    const st = S.stage;
    const [ux, uy] = st.toUnits(sx, sy);
    const hit = st.hit(ux, uy);
    if (hit >= 0 && canFill(hit)) fill(hit, ux, uy);
  }

  function wrong(i, ux, uy) {
    S.stage.pulseWrong(i, ux, uy);
    const c = S.M.col[i];
    bounce(c);
    scrollSwatch(c);
    sfx.play('tap');
  }

  /** Malzeit: Zeit seit der letzten Aktion zählt mit (Pausen über 30 s nur als 30 s). */
  function tick() {
    const now = performance.now();
    const d = Math.min(30000, Math.max(0, now - S.lastAct));
    S.lastAct = now;
    S.ms += d;
    S.pendMs += d;
  }

  function fill(i, ux, uy) {
    const M = S.M;
    tick();
    clearCoach();
    S.pendFills++;
    S.filled[i] = 1;
    S.order.push(i);
    S.stage.fillShape(i, ux, uy, ux != null);
    const c = M.col[i];
    S.remaining[c]--;
    S.left--;
    S.fills++;
    sfx.play('fill');
    updateSwatch(c);
    updateProgress();
    scheduleSave();
    if (S.remaining[c] === 0) colorDone(c);
    if (S.left === 0) complete();
    else showTip();
  }

  function showTip() {
    for (const t of TIPS) {
      if (S.fills !== t.after) continue;
      const key = 'paint.tip.' + t.id;
      if (store.get(key, false)) continue;
      store.set(key, true);
      setTimeout(() => toast(t.text, 3800), 400);
      return;
    }
  }

  function colorDone(c) {
    const sw = S.swatches[c];
    if (sw) {
      sw.classList.remove('bounce');
      sw.classList.add('just-done');
      setTimeout(() => sw.classList.remove('just-done'), 700);
    }
    setTimeout(() => sfx.play('sparkle'), 140);
    if (S.left === 0) return;
    const n = S.remaining.length;
    for (let k = 1; k <= n; k++) {
      const next = (c + k) % n;
      if (S.remaining[next] > 0) {
        setTimeout(() => { if (S && !S.done && S.remaining[c] === 0 && S.selected === c) select(next, false); }, 260);
        break;
      }
    }
  }

  function updateProgress() {
    const p = percent(S.total - S.left, S.total);
    pctEl.textContent = p + NBSP + '%';
    barFill.style.width = p + '%';
  }

  // ---------- Coach-Mark (nur beim allerersten Bild) ----------
  function showCoach() {
    const M = S.M, c = S.selected;
    let best = -1, bf = 0;
    for (const i of M.colorShapes[c]) {
      const lb = M.labelOf(i);
      if (lb.f > bf) { bf = lb.f; best = i; }
    }
    if (best < 0) return;
    const lb = M.labelOf(best);
    S.coach = true;
    setTimeout(() => {
      if (S && S.coach) S.stage.coachRing(lb.x, lb.y, Math.max(lb.f * 0.9, 3));
    }, 700);
  }

  function clearCoach() {
    if (!S || !S.coach) return;
    S.coach = false;
    S.stage.clearCoach();
  }

  // ---------- Tipp ----------
  async function hint() {
    if (!S || S.done || S.playing) return;
    const st = S.stage, M = S.M;
    const c = S.selected;
    const open = M.colorShapes[c].filter((i) => !S.filled[i]);
    if (!open.length) return;
    clearCoach();
    sfx.play('whoosh');
    const [cx, cy] = st.toUnits(st.VW / 2, st.VH / 2);
    let best = null, bd = Infinity;
    const L = M.labels;
    const want = new Set(open);
    for (let k = 0; k < L.length; k += 4) {
      const i = L[k];
      if (!want.has(i)) continue;
      const d = (L[k + 1] - cx) ** 2 + (L[k + 2] - cy) ** 2;
      if (d < bd) { bd = d; best = { i, x: L[k + 1], y: L[k + 2], f: L[k + 3] }; }
    }
    if (!best) {
      const i = open[0], b = i * 4;
      best = { i, x: (M.bbox[b] + M.bbox[b + 2]) / 2, y: (M.bbox[b + 1] + M.bbox[b + 3]) / 2, f: 4 };
    }
    const vp = st.vp;
    let s = st.cam.s;
    if (best.f * s < 15) s = Math.min(vp.maxS, Math.max(s, 19 / best.f));
    const [sx, sy] = st.toScreen(best.x, best.y);
    const inside = sx > st.VW * 0.15 && sx < st.VW * 0.85 && sy > st.VH * 0.15 && sy < st.VH * 0.85;
    let ok = true;
    if (s !== st.cam.s || !inside) ok = await st.zoomToPoint(best.x, best.y, s, 700);
    if (ok !== false && S && S.stage === st) {
      st.hintRing(best.x, best.y, Math.max(best.f * 0.85, 2));
      sfx.play('pop');
    }
  }

  // ---------- Vorlage ----------
  async function showTemplate() {
    if (!S) return;
    badge.classList.remove('hidden');
    await S.stage.showPreview(1900);
    badge.classList.add('hidden');
  }

  // ---------- Neu beginnen ----------
  async function restart() {
    if (!S || S.playing) return;
    const ok = await confirmDialog('Neu beginnen?', 'Alle Farben dieses Bildes werden entfernt.', 'Neu beginnen', 'Abbrechen');
    if (!ok || !S) return;
    if (S.playing) return;
    const M = S.M;
    for (let i = 0; i < M.n; i++) S.filled[i] = M.auto[i] ? 1 : 0;
    S.order = [];
    S.remaining = M.colorShapes.map((l) => l.length);
    S.left = S.total;
    S.done = false;
    S.exportBlob = null;
    S.selected = S.remaining.findIndex((r) => r > 0);
    if (S.selected < 0) S.selected = 0;
    const st = S.stage;
    st.outlineAlpha = 1;
    st.labelsOn = true;
    st.highlightOn = true;
    st.tapEnabled = true;
    st.gesturesEnabled = true;
    st.selected = S.selected;
    st.setFilledAll(S.filled);
    st.fit(true);
    hintBtn.disabled = false;
    buildPalette();
    updateProgress();
    setDockMode('palette');
    removeProgress(S.id);
    updateSummary();
    onChanged && onChanged(S.id);
    sfx.play('whoosh');
  }

  // ---------- Fertig ----------
  async function complete() {
    const st = S.stage;
    const sess = S;
    S.done = true;
    st.tapEnabled = false;
    hintBtn.disabled = true;
    save();
    closeMenu();
    await sleep(420);
    if (S !== sess) return;
    st.highlightOn = false;
    if (!st.isAtFit()) await st.fit(true);
    if (S !== sess) return;
    const fade = st.fadeTo({ outlineAlpha: 0, labels: false, highlight: -1 }, 1100);
    setTimeout(() => {
      if (S !== sess) return;
      celebrate(S.M.palette);
      sfx.play('complete');
    }, 350);
    await fade;
    if (S !== sess) return;
    enterDoneState(true);
  }

  function enterDoneState(animated) {
    const st = S.stage;
    st.outlineAlpha = 0;
    st.labelsOn = false;
    st.highlightOn = false;
    st.tapEnabled = false;
    st.invalidate();
    hintBtn.disabled = true;
    setDockMode('done');
    const title = S.M.title || S.item.title || '';
    doneTitle.textContent = S.ms > 30000 ? `${title} · ${formatDuration(S.ms)}` : title;
    doneSheet.classList.toggle('pop', !!animated);
    prepareExport();
  }

  // ---------- Zeitraffer ----------
  async function timelapse() {
    if (!S || !S.done || S.playing) return;
    const sess = S, st = S.stage, M = S.M;
    S.playing = true;
    S.skip = false;
    moreBtn.disabled = true;
    setDockMode('timelapse');
    st.gesturesEnabled = false;
    if (!st.isAtFit()) await st.fit(true);
    const base = new Uint8Array(M.n);
    for (let i = 0; i < M.n; i++) base[i] = M.auto[i] ? 1 : 0;
    st.outlineAlpha = 1;
    st.labelsOn = false;
    st.highlightOn = false;
    st.setFilledAll(base);
    let order = S.order.length ? S.order.slice() : [];
    if (!order.length) for (let i = 0; i < M.n; i++) if (!M.auto[i]) order.push(i);
    const N = order.length;
    const dur = Math.max(3500, Math.min(7000, N * 110));
    await sleep(350);
    const t0 = performance.now();
    let k = 0, lastSound = 0;
    const onSkip = () => { sess.skip = true; };
    st.canvas.addEventListener('pointerdown', onSkip);
    await new Promise((resolve) => {
      const step = () => {
        if (S !== sess) { resolve(); return; }
        const t = Math.min(1, (performance.now() - t0) / dur);
        const target = sess.skip ? N : Math.floor(t * t * (3 - 2 * t) * N);
        if (sess.skip && k < N) {
          const all = new Uint8Array(M.n).fill(1);
          st.setFilledAll(all);
          k = N;
        }
        while (k < target) { st.fillShape(order[k], null, null, false); k++; }
        const now = performance.now();
        if (k < N && now - lastSound > 110 && t > 0) { lastSound = now; sfx.play('place'); }
        if (k >= N) resolve(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    st.canvas.removeEventListener('pointerdown', onSkip);
    if (S !== sess) return;
    await sleep(sess.skip ? 50 : 350);
    await st.fadeTo({ outlineAlpha: 0, labels: false, highlight: -1 }, 800);
    if (S !== sess) return;
    st.outlineAlpha = 0;
    st.gesturesEnabled = true;
    S.playing = false;
    moreBtn.disabled = false;
    setDockMode('done');
    sfx.play('sparkle');
  }

  // ---------- Bild sichern ----------
  function slug(s) {
    return (s || 'bild').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bild';
  }

  function prepareExport() {
    const sess = S;
    if (sess.exportBlob || sess.exportPending) return sess.exportPending;
    sess.exportPending = new Promise((resolve) => {
      setTimeout(() => {
        if (S !== sess) { resolve(null); return; }
        const cv = renderExport(sess.M, 2048);
        cv.toBlob((b) => { cv.width = 0; sess.exportBlob = b; resolve(b); }, 'image/png');
      }, 600);
    });
    return sess.exportPending;
  }

  async function exportImage() {
    if (!S) return;
    const sess = S;
    const blob = sess.exportBlob || await prepareExport();
    if (!blob || S !== sess) { toast('Das hat leider nicht geklappt.'); return; }
    const name = `farbenzauber-${slug(sess.M.title || sess.id)}.png`;
    let file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch { file = null; }
    if (file && navigator.canShare && navigator.share) {
      let can = false;
      try { can = navigator.canShare({ files: [file] }); } catch { can = false; }
      if (can) {
        try {
          await navigator.share({ files: [file], title: sess.M.title || 'Farbenzauber' });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Bild gespeichert');
  }

  // ---------- Speichern ----------
  function save() {
    if (!S || !S.stage) return;
    clearTimeout(S.saveTimer);
    S.saveTimer = 0;
    const M = S.M;
    const user = new Uint8Array(M.n);
    for (let i = 0; i < M.n; i++) if (S.filled[i] && !M.auto[i]) user[i] = 1;
    const rec = {
      v: 1,
      f: encodeBits(user),
      o: encodeOrder(S.order),
      c: S.selected,
      n: S.total - S.left,
      t: S.total,
      done: S.done,
      cam: S.stage.getCamState(),
      h: S.hash,
      ms: Math.round(S.ms),
      ts: Date.now(),
    };
    saveProgress(S.id, rec);
    addStats({ fills: S.pendFills, ms: S.pendMs, pics: S.done && !S.countedDone ? 1 : 0 });
    if (S.done) S.countedDone = true;
    S.pendFills = 0;
    S.pendMs = 0;
    updateSummary();
    onChanged && onChanged(S.id);
  }

  function scheduleSave() {
    if (!S) return;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(save, 500);
  }

  // ---------- Schliessen ----------
  function close(keepVisible = false) {
    closeMenu();
    if (S) {
      if (S.saveTimer || (S.stage && (S.order.length || S.done))) save();
      if (S.stage) S.stage.destroy();
      S = null;
    }
    stageHost.querySelectorAll('.pv-error').forEach((e) => e.remove());
    badge.classList.add('hidden');
    hideLoader();
    if (!keepVisible) {
      openToken++;
      el.classList.add('hidden');
    }
    if (debug) window.__paint = null;
  }

  // Beim Verlassen/Verstecken der Seite sofort speichern
  const flush = () => { if (S && S.stage && S.saveTimer) save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // ---------- Test-Schnittstelle ----------
  function exposeDebug() {
    const api = {
      get ready() { return !!(S && S.ready); },
      state() {
        if (!S) return null;
        const st = S.stage;
        return {
          id: S.id, selected: S.selected, left: S.left, total: S.total, done: S.done, playing: S.playing,
          cam: { ...st.cam }, fit: st.fitCam(), maxZoom: st.maxZoom, renderMs: st.lastRenderMs,
          renderCount: st.renderCount, order: S.order.slice(), remaining: S.remaining.slice(),
          autoCount: S.M.auto.reduce((a, b) => a + b, 0), n: S.M.n, coach: !!S.coach,
        };
      },
      model() { return S && S.M; },
      open(c) { return S ? S.M.colorShapes[c].filter((i) => !S.filled[i]) : []; },
      /** Bildschirmpunkt (Client-Koordinaten) der Nummer einer Form. */
      labelPoint(i) {
        if (!S) return null;
        const lb = S.M.labelOf(i);
        const [sx, sy] = S.stage.toScreen(lb.x, lb.y);
        const r = stageHost.getBoundingClientRect();
        return { x: r.left + sx, y: r.top + sy, font: lb.f * S.stage.cam.s };
      },
      unitsToClient(ux, uy) {
        const [sx, sy] = S.stage.toScreen(ux, uy);
        const r = stageHost.getBoundingClientRect();
        return { x: r.left + sx, y: r.top + sy };
      },
      hitAt(clientX, clientY) {
        const r = stageHost.getBoundingClientRect();
        const [ux, uy] = S.stage.toUnits(clientX - r.left, clientY - r.top);
        return S.stage.hit(ux, uy);
      },
      select(c) { select(c, false); },
      fill(i) { if (S && !S.filled[i]) fill(i, null, null); },
      fillAllBut(k = 1) {
        const list = [];
        S.M.colorShapes.forEach((l) => l.forEach((i) => { if (!S.filled[i]) list.push(i); }));
        list.slice(0, Math.max(0, list.length - k)).forEach((i) => fill(i, null, null));
      },
      stage() { return S && S.stage; },
    };
    window.__paint = api;
  }

  return {
    el,
    open,
    close: () => close(false),
    get currentId() { return S ? S.id : null; },
  };
}
