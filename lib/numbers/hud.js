// Zahlen-Familie – gemeinsame Spielansicht: Kopfzeile, Werkzeugknöpfe, Herzen, Uhr,
// Gewinnblatt, Router und kleine Statistik-Helfer. Alles im Spielpause-Stil.

import { h, icon, showModal, celebrate, backButton } from '../../shared/ui.js';
import { store } from '../../shared/storage.js';
import { sfx } from '../../shared/sfx.js';
import { NI } from './icons.js';

export { NI };

export function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Wechselt die Ansicht ohne neuen Verlaufseintrag und ruft route() auf. */
export function makeRouter(route) {
  const go = (hash) => {
    const target = hash ? '#' + hash.replace(/^#/, '') : '';
    if ((location.hash || '') !== target) history.replaceState(null, '', location.pathname + location.search + target);
    route();
  };
  window.addEventListener('hashchange', route);
  window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
  return go;
}

/** Kopfzeile im Spiel: Zurück · Titel/Untertitel · (extra) · «?» */
export function playTopbar({ title, sub, onBack, onHelp, extra = [] }) {
  const t = h('b', null, title || '');
  const s = h('small', null, sub || '');
  const help = h('button.icon-btn.nx-help', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="nx-q">?</span>' });
  help.addEventListener('click', () => onHelp && onHelp());
  const el = h('header.topbar.nx-top', null,
    backButton('#', (e) => { if (e) e.preventDefault(); onBack && onBack(); }),
    h('div.nx-title', null, t, s),
    ...extra,
    onHelp ? help : null);
  return { el, setTitle: (x) => { t.textContent = x; }, setSub: (x) => { s.textContent = x; } };
}

/** Kleine Uhr-Pille. */
export function timerPill() {
  const span = h('span', null, '0:00');
  const el = h('div.nx-pill.nx-timer', { html: NI.clock }, span);
  return { el, set(ms) { span.textContent = formatTime(ms); } };
}

/** Pille mit beliebigem Inhalt (z.B. Punkte). */
export function pill(iconName, text = '') {
  const span = h('span', null, text);
  const el = h('div.nx-pill', { html: iconName ? NI[iconName] || '' : '' }, span);
  return { el, set(x) { span.textContent = String(x); } };
}

/** Herzen (Leben). */
export function heartsBar(max = 3) {
  const el = h('div.nx-hearts', { 'aria-label': 'Leben' });
  const items = [];
  for (let k = 0; k < max; k++) { const s = h('span', { html: NI.heart }); items.push(s); el.append(s); }
  let cur = max;
  return {
    el,
    set(n, animate = false) {
      items.forEach((s, k) => {
        const on = k < n;
        if (!on && k < cur && animate) { s.classList.remove('lose'); void s.offsetWidth; s.classList.add('lose'); }
        s.classList.toggle('off', !on);
      });
      cur = n;
    },
  };
}

/**
 * Knopf, der sofort beim Loslassen reagiert. Grund: setupPage() verhindert Doppeltipps
 * (<320 ms), dann käme nach schnellem Ziehen/Tippen auf dem Brett kein «click» an.
 */
export function onPress(el, fn) {
  let last = 0;
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || el.disabled) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (!hit || !el.contains(hit)) return;
    last = Date.now();
    fn(e);
  });
  el.addEventListener('click', (e) => { if (Date.now() - last < 700) return; fn(e); });
}

/** Werkzeugknopf unten (Icon + Beschriftung, optionales Abzeichen). */
export function toolButton({ icon: ic, label, onClick, badge = null, className = '' }) {
  const b = h('button.nx-tool' + (className ? '.' + className : ''), { type: 'button', 'aria-label': label });
  const bubble = h('span.nx-tool-ic', { html: NI[ic] || icon(ic, { size: 24 }) });
  const badgeEl = h('span.nx-badge');
  bubble.append(badgeEl);
  b.append(bubble, h('span.nx-tool-lbl', null, label));
  onPress(b, () => onClick && onClick());
  const api = {
    el: b,
    setBadge(v) { badgeEl.textContent = v == null ? '' : String(v); badgeEl.style.display = v == null ? 'none' : ''; },
    setDisabled(d) { b.disabled = !!d; },
    setOn(on) { b.classList.toggle('on', !!on); },
    pulse() { b.classList.remove('nx-pulse'); void b.offsetWidth; b.classList.add('nx-pulse'); },
    setLabel(x) { b.querySelector('.nx-tool-lbl').textContent = x; },
  };
  api.setBadge(badge);
  return api;
}

export function toolbar(...buttons) {
  return h('div.nx-toolbar', null, ...buttons.map((b) => (b && b.el) || b));
}

/** Sterne-Leiste (0–3) als HTML. */
export function starRow(n, size = 40) {
  const el = h('div.nx-stars');
  for (let k = 0; k < 3; k++) {
    const s = h('span' + (k < n ? '.on' : ''), { html: NI.star });
    s.style.width = s.style.height = size + 'px';
    s.style.animationDelay = 260 + k * 200 + 'ms';
    el.append(s);
  }
  return el;
}

/**
 * Gewinnblatt mit Konfetti. opts: { title, badge (Emoji/Text), stars (0–3|null), tiles: [{value,label}],
 * note, buttons, colors }. Gibt den gewählten Wert zurück.
 */
export async function winSheet(opts) {
  sfx.play('complete');
  celebrate(opts.colors);
  const kids = [];
  if (opts.badge) kids.push(h('div.nx-win-badge', null, opts.badge));
  if (opts.stars != null) {
    kids.push(starRow(opts.stars, 44));
    for (let k = 0; k < opts.stars; k++) setTimeout(() => sfx.play('pop'), 320 + k * 200);
  }
  if (opts.tiles && opts.tiles.length) {
    kids.push(h('div.nx-win-tiles', null, opts.tiles.map((t) => h('div', null, h('b', null, String(t.value)), h('small', null, t.label)))));
  }
  if (opts.note) kids.push(h('p.nx-win-note', null, opts.note));
  return showModal({ title: opts.title, content: h('div.nx-win', null, kids), buttons: opts.buttons, dismissible: false });
}

/** Sanftes «Schade»-Blatt. */
export function softSheet({ title, text, emoji, buttons }) {
  const content = h('div.nx-win', null, emoji ? h('div.nx-win-badge.soft', null, emoji) : null, text ? h('p.nx-win-note', null, text) : null);
  return showModal({ title, content, buttons, dismissible: false });
}

/** Persistente Statistik: { get(), update(fn) } */
export function statStore(key, defaults) {
  return {
    get: () => ({ ...defaults, ...(store.get(key, {}) || {}) }),
    update(fn) {
      const s = this.get();
      const r = fn(s) || s;
      store.set(key, r);
      return r;
    },
  };
}

/**
 * Laufende Uhr, die bei verdeckter Seite pausiert. onTick(ms) jede Sekunde.
 * Gibt { stop(), elapsed } zurück; start = bisherige Zeit.
 */
export function runClock(start, onTick) {
  let base = start || 0;
  let t0 = performance.now();
  let paused = document.hidden;
  const now = () => base + (paused ? 0 : performance.now() - t0);
  const iv = setInterval(() => onTick(now()), 1000);
  const vis = () => {
    if (document.hidden && !paused) { base = now(); paused = true; }
    else if (!document.hidden && paused) { paused = false; t0 = performance.now(); }
  };
  document.addEventListener('visibilitychange', vis);
  onTick(now());
  return {
    get elapsed() { return now(); },
    stop() { clearInterval(iv); document.removeEventListener('visibilitychange', vis); base = now(); paused = true; },
  };
}

/** Ein kleiner Hinweis-Text direkt am Spielfeld (Coach-Mark), verschwindet mit hide(). */
export function coachBubble(text) {
  const el = h('div.nx-coach', null, text);
  return {
    el,
    show(t) { if (t) el.textContent = t; el.classList.add('show'); },
    hide() { el.classList.remove('show'); },
  };
}

/** Lobworte für Serien und besondere Züge (rotierend, damit es nicht eintönig wird). */
export const PRAISE = ['Super!', 'Prima!', 'Klasse!', 'Toll!', 'Fantastisch!', 'Grossartig!', 'Wunderbar!', 'Meisterhaft!'];
export const praiseWord = (n) => PRAISE[Math.abs(n | 0) % PRAISE.length];

/**
 * Kurze Lob-Einblendung («Super!») mitten über dem Spielfeld. host braucht position: relative.
 * Nur eine gleichzeitig; verschwindet von selbst. opts: { y (0–1, Höhe im host), small }
 */
export function praise(host, text, { y = 0.45, small = false } = {}) {
  if (!host) return null;
  const old = host.querySelector(':scope > .nx-praise');
  if (old) old.remove();
  const el = h('div.nx-praise' + (small ? '.small' : ''), null, text);
  el.style.top = Math.round(y * 100) + '%';
  host.append(el);
  setTimeout(() => el.remove(), 1400);
  return el;
}
