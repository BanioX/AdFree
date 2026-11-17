// Gemeinsame UI-Helfer: Icons, Toast, Modal, Konfetti, iOS-Zoom-Schutz.
//
//   import { icon, toast, showModal, confirmDialog, celebrate, setupPage, soundButton } from '../shared/ui.js';

import { sfx } from './sfx.js';

// ---------- Icons (inline SVG, stroke = currentColor) ----------

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  soundLow: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
  camera: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.3" r="3.4"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  shuffle: '<path d="M4 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6C15.3 16 16.5 17 18.5 17H20"/><path d="M4 17h3.5c1.2 0 2.1-.4 2.9-1.1M14.1 8.1C14.9 7.4 15.8 7 17 7h3"/><path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6.5 7l1 12.5h9l1-12.5M9 7V4.5h6V7"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/>',
  download: '<path d="M12 4v11.5M7.5 11L12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M18 3v4.5h-4.5"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M6 21v-4.5h4.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
};

const FILLED = new Set(['star', 'heart', 'bolt', 'play', 'sparkle', 'more']);

/** Liefert ein SVG-Icon als String. opts: { size, fill, stroke } */
export function icon(name, opts = {}) {
  const body = P[name] || P.more;
  const size = opts.size || 24;
  const filled = opts.fill ?? FILLED.has(name);
  const fill = filled ? 'currentColor' : 'none';
  const sw = opts.stroke || 2.2;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="currentColor" stroke-width="${filled ? 1.2 : sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const iconNames = Object.keys(P);

// ---------- Kleine DOM-Helfer ----------

/** h('div.card#main', {onclick}, child, 'text') */
export function h(tag, attrs, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => {
    if (t === '.') el.classList.add(v); else el.id = v;
    return '';
  });
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  } else if (attrs != null) {
    children.unshift(attrs);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- Toast ----------

let toastEl = null;
let toastTimer = 0;

export function toast(text, ms = 1800) {
  if (!toastEl) {
    toastEl = h('div.sp-toast');
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  // Reflow erzwingen, damit die Animation neu startet
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---------- Modal ----------

/**
 * Zeigt einen Dialog. Gibt ein Promise mit dem `value` des gedrückten Buttons zurück
 * (oder null, wenn ausserhalb getippt wurde und dismissible=true).
 * opts: { title, text, html, content (Node), buttons: [{ label, value, primary, ghost, icon }], dismissible }
 */
export function showModal(opts = {}) {
  return new Promise((resolve) => {
    const buttons = opts.buttons || [{ label: 'OK', value: true, primary: true }];
    const body = h('div.sp-modal-body');
    if (opts.html) body.innerHTML = opts.html;
    else if (opts.text) body.textContent = opts.text;
    if (opts.content) body.append(opts.content);
    const btnRow = h('div.sp-modal-buttons');
    const modal = h('div.sp-modal', { role: 'dialog', 'aria-modal': 'true' },
      opts.title ? h('h2', null, opts.title) : null,
      body,
      btnRow);
    const backdrop = h('div.sp-modal-backdrop', null, modal);
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 260);
      resolve(value);
    };
    for (const b of buttons) {
      const cls = 'btn block' + (b.primary ? ' primary' : '') + (b.ghost ? ' ghost' : '');
      const el = h('button', { class: cls, type: 'button' });
      if (b.icon) el.innerHTML = icon(b.icon, { size: 20 });
      el.append(document.createTextNode(b.label));
      el.addEventListener('click', () => { sfx.play('click'); close(b.value); });
      btnRow.append(el);
    }
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && opts.dismissible !== false) close(null);
    });
    document.body.append(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
  });
}

export function confirmDialog(title, text, okLabel = 'Ja', cancelLabel = 'Abbrechen') {
  return showModal({
    title,
    text,
    buttons: [
      { label: okLabel, value: true, primary: true },
      { label: cancelLabel, value: false, ghost: true },
    ],
  }).then((v) => v === true);
}

// ---------- Konfetti ----------

/** Feiert einen Erfolg mit Konfetti (ca. 2.5 s). colors optional. */
export function celebrate(colors) {
  const palette = colors && colors.length ? colors
    : ['#ff7a59', '#ffd23f', '#3bceac', '#5b8def', '#ee6fb7', '#9b6bff'];
  const cv = h('canvas.sp-confetti');
  document.body.append(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const parts = [];
  const N = 140;
  for (let i = 0; i < N; i++) {
    const fromLeft = i % 2 === 0;
    parts.push({
      x: fromLeft ? -10 : W + 10,
      y: H * (0.55 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7),
      vy: -(9 + Math.random() * 9),
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      col: palette[i % palette.length],
      round: Math.random() < 0.3,
    });
  }
  const t0 = performance.now();
  function frame(t) {
    const el = t - t0;
    c.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - Math.max(0, el - 1800) / 900);
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.fillStyle = p.col;
      if (p.round) { c.beginPath(); c.arc(0, 0, p.w / 2, 0, Math.PI * 2); c.fill(); }
      else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      c.restore();
    }
    if (el < 2700) requestAnimationFrame(frame);
    else cv.remove();
  }
  requestAnimationFrame(frame);
}

// ---------- Seiten-Setup ----------

/**
 * Verhindert Browser-Zoom (Doppeltipp, Pinch auf der Seite) auf iOS,
 * damit Spiele eigene Gesten nutzen können. Einmal pro Seite aufrufen.
 */
export function setupPage() {
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('gestureend', stop, { passive: false });
  // Doppeltipp-Zoom verhindert CSS (touch-action: manipulation in style.css). Früher wurde hier
  // jedes zweite touchend innerhalb von 320 ms abgefangen – das schluckte schnelle Taps in Spielen.
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('input, textarea')) e.preventDefault();
  });
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Lokal (Entwicklung) nur mit ?sw=1 registrieren, damit kein alter Cache stört.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;
  if (!local && location.protocol !== 'https:') return;
  // sw.js liegt im Wurzelverzeichnis der App, eine Ebene über den Spielordnern.
  const swUrl = new URL('../sw.js', import.meta.url);
  navigator.serviceWorker.register(swUrl, { scope: new URL('../', import.meta.url).pathname }).catch(() => {});
}

/** Ton-Knopf (icon-btn): schaltet leise → normal → aus (für alle Spiele gemeinsam). */
export function soundButton() {
  const b = h('button.icon-btn', { type: 'button' });
  const LABEL = { leise: 'Ton: leise', normal: 'Ton: normal', aus: 'Ton aus' };
  const ICON = { leise: 'soundLow', normal: 'soundOn', aus: 'soundOff' };
  const render = () => {
    b.innerHTML = icon(ICON[sfx.level] || 'soundOn');
    b.setAttribute('aria-label', LABEL[sfx.level] + ' – tippen zum Ändern');
  };
  render();
  b.addEventListener('click', () => {
    sfx.cycle();
    render();
    toast(LABEL[sfx.level]);
    sfx.play('tap');
  });
  return b;
}

/** Erzeugt einen Zurück-Button (icon-btn). href Standard: zur Startseite. */
export function backButton(href = '../', onClick) {
  const b = h('a.icon-btn', { href, 'aria-label': 'Zurück' });
  b.innerHTML = icon('back');
  if (onClick) b.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
  return b;
}

/** Kleiner Wartezeit-Helfer */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Easing-Funktionen für Animationen */
export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
