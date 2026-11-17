// Spielansicht-Baukasten für die Platzier-Sortierspiele (Wabenstapel, Regal-Ordnung, Ausparken,
// Kuchen-Sortierung). Ergänzt /lib/sorting/ – die Stapel-Engine (shell.js usw.) bleibt unberührt.
//
//   import { playScreen, canvasStage, showWin, coachRing, floatText, fmt } from '../lib/sorting/kit.js';
//   (Styles: <link rel="stylesheet" href="../lib/sorting/kit.css">)

import { h, icon, soundButton, showModal } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';

export const fmt = (n) => Number(n || 0).toLocaleString('de-CH');

/** Hash ohne «#», in Teile zerlegt: '#level/12' → ['level', '12'] */
export function hashParts() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  return raw ? raw.split('/') : [];
}

/**
 * Gerüst einer Spielansicht: Topbar (Zurück, Titel/Untertitel, «?», Ton), HUD-Zeile, Bühne, Werkzeugleiste.
 * tools: [{ id, icon, label, onClick }]
 */
export function playScreen({ accent, title, sub = '', onBack, onHelp, tools = [], cls = '' }) {
  const root = h('div.pk' + (cls ? '.' + cls : ''));
  if (accent) root.style.setProperty('--accent', accent);
  const back = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zum Menü', html: icon('back') });
  back.addEventListener('click', () => onBack && onBack());
  const titleEl = h('div.pk-title', null, title);
  const subEl = h('div.pk-sub', null, sub);
  const help = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  help.addEventListener('click', () => { sfx.play('click'); onHelp && onHelp(); });
  const top = h('div.topbar.pk-top', null, back, h('div.pk-titles', null, titleEl, subEl), onHelp ? help : null, soundButton());
  const hud = h('div.pk-hud');
  const stage = h('div.pk-stage');
  const toolbar = h('div.pk-tools');
  const btns = {};
  for (const t of tools) {
    const b = h('button.pk-tool', { type: 'button', 'data-tool': t.id, 'aria-label': t.label },
      h('span.pk-tool-ic', { html: icon(t.icon, { size: 22 }) }),
      h('span.pk-tool-lb', null, t.label),
      h('span.pk-badge'));
    b.addEventListener('click', () => { if (!b.disabled) t.onClick && t.onClick(); });
    btns[t.id] = b;
    toolbar.append(b);
  }
  root.append(top, hud, stage, tools.length ? toolbar : null);
  return {
    root, titleEl, subEl, hud, stage, toolbar,
    tool: (id) => btns[id],
    setTool(id, { disabled, badge, hidden } = {}) {
      const b = btns[id];
      if (!b) return;
      if (disabled !== undefined) b.disabled = !!disabled;
      if (hidden !== undefined) b.hidden = !!hidden;
      if (badge !== undefined) {
        const el = b.querySelector('.pk-badge');
        el.textContent = badge == null || badge === '' ? '' : String(badge);
        el.classList.toggle('on', !(badge == null || badge === ''));
      }
    },
    setTitle(t, s) { if (t != null) titleEl.textContent = t; if (s != null) subEl.textContent = s; },
  };
}

/** Kleine Tween-Maschine (Promise je Tween). */
export function makeTweens(kick) {
  let list = [];
  return {
    add({ dur = 250, delay = 0, ease = (t) => t, update, done } = {}) {
      return new Promise((resolve) => {
        list.push({ t0: performance.now() + delay, dur: Math.max(1, dur), ease, update, done, resolve });
        kick && kick();
      });
    },
    tick(now) {
      if (!list.length) return;
      const keep = [];
      const finished = [];
      for (const tw of list) {
        const t = (now - tw.t0) / tw.dur;
        if (t < 0) { keep.push(tw); continue; }
        const k = Math.min(1, t);
        if (tw.update) tw.update(tw.ease(k), k);
        if (k >= 1) finished.push(tw); else keep.push(tw);
      }
      list = keep;
      for (const tw of finished) { if (tw.done) tw.done(); tw.resolve(); }
    },
    active() { return list.length > 0; },
    /** Bricht alle Tweens ab (springt ans Ende). */
    finish() {
      const l = list; list = [];
      for (const tw of l) { if (tw.update) tw.update(1, 1); if (tw.done) tw.done(); tw.resolve(); }
    },
  };
}

/**
 * Canvas, das seine Fläche füllt, devicePixelRatio beachtet und nur zeichnet, wenn nötig.
 * draw(ctx, now, w, h) wird pro Bild aufgerufen; keepAlive() → true hält die Schleife wach.
 */
export function canvasStage(parent, { draw, resize, keepAlive } = {}) {
  const cv = h('canvas.pk-canvas');
  parent.append(cv);
  const ctx = cv.getContext('2d');
  let w = 0, hh = 0, dpr = 1, raf = 0, dead = false;
  const tweens = makeTweens(() => kick());
  function measure() {
    const r = parent.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; hh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    cv.style.width = w + 'px'; cv.style.height = hh + 'px';
    if (resize) resize(w, hh);
    kick();
  }
  function frame(now) {
    raf = 0;
    if (dead) return;
    tweens.tick(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    if (w && hh && draw) draw(ctx, now, w, hh);
    if (tweens.active() || (api.keepAlive && api.keepAlive())) kick();
  }
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  const ro = new ResizeObserver(() => measure());
  ro.observe(parent);
  const api = {
    cv, ctx, tweens, keepAlive,
    get w() { return w; }, get h() { return hh; },
    invalidate: kick,
    measure,
    /** Punkt (clientX/Y) in Canvas-Koordinaten (CSS-px). */
    local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
    destroy() { dead = true; ro.disconnect(); if (raf) cancelAnimationFrame(raf); cv.remove(); },
  };
  measure();
  return api;
}

/** Sterne als HTML (gefüllt / leer). */
export function starsHtml(n, max = 3, size = 34) {
  let s = '';
  for (let i = 0; i < max; i++) {
    s += `<span class="pk-star${i < n ? ' on' : ''}" style="--i:${i}">${icon('star', { size })}</span>`;
  }
  return s;
}

/**
 * Gewinnblatt. rows: [{ label, value }], buttons wie showModal.
 * Gibt den value des gedrückten Knopfs zurück.
 */
export function showWin({ title, text, stars = null, max = 3, rows = [], buttons, extra = null }) {
  const content = h('div.pk-win');
  if (stars != null) content.append(h('div.pk-stars', { html: starsHtml(stars, max) }));
  if (text) content.append(h('p.pk-win-text', null, text));
  if (rows.length) {
    content.append(h('div.pk-win-rows', null, rows.map((r) =>
      h('div.pk-win-row', null, h('b', null, String(r.value)), h('small', null, r.label)))));
  }
  if (extra) content.append(extra);
  return showModal({ title, content, buttons });
}

/** Statistik-Blatt: rows [{ label, value }] */
export function showStatsSheet(title, rows, buttons) {
  const content = h('div.pk-stats', null, rows.map((r) =>
    h('div.pk-stats-row', null, h('span', null, r.label), h('b', null, String(r.value)))));
  return showModal({ title, content, buttons: buttons || [{ label: 'Schliessen', value: true, primary: true }] });
}

/** Pulsierender Hinweis-Ring (Coach-Mark) an Position x/y (px) in parent. */
export function coachRing(parent, x, y, size = 64, { label } = {}) {
  const el = h('div.pk-coach', { style: { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' } },
    h('i'), label ? h('span.pk-coach-lb', null, label) : null);
  parent.append(el);
  return {
    el,
    move(nx, ny, ns = size) { Object.assign(el.style, { left: nx + 'px', top: ny + 'px', width: ns + 'px', height: ns + 'px' }); },
    remove() { el.classList.add('out'); setTimeout(() => el.remove(), 300); },
  };
}

/** Aufsteigender Text («+10», «Super!») an x/y in parent. */
export function floatText(parent, x, y, text, { cls = '', color } = {}) {
  const el = h('div.pk-float' + (cls ? '.' + cls : ''), { style: { left: x + 'px', top: y + 'px' } }, text);
  if (color) el.style.color = color;
  parent.append(el);
  setTimeout(() => el.remove(), 1300);
  return el;
}

/** Lob-Texte für Kombos. */
export const PRAISE = ['Schön!', 'Super!', 'Toll!', 'Fantastisch!', 'Grossartig!', 'Wunderbar!'];
export function praise(n) { return PRAISE[Math.min(PRAISE.length - 1, Math.max(0, n))]; }

/** Fortschrittsbalken im HUD. */
export function progressBar(label) {
  const fill = h('i');
  const txt = h('span.pk-prog-txt');
  const el = h('div.pk-prog', null, label ? h('span.pk-prog-lb', null, label) : null, h('div.pk-prog-bar', null, fill), txt);
  return {
    el,
    set(value, max, text) {
      const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
      fill.style.width = (p * 100).toFixed(1) + '%';
      txt.textContent = text != null ? text : `${fmt(value)} / ${fmt(max)}`;
    },
  };
}
