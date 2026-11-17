// Gemeinsame Bausteine der Patience-Familie: Tisch-Design (für alle Kartenspiele gemeinsam
// gespeichert), Spiel-Topbar, Werkzeugleiste, Einstellungsblatt, Gewinnblatt-Inhalt, Statistik,
// Zeitmessung, Mini-Karten für Tutorials.

import { h, icon, showModal, soundButton, backButton } from '../../shared/ui.js';
import { store } from '../../shared/storage.js';
import { sfx } from '../../shared/sfx.js';
import { faceHTML, installSprite } from './face.js';
import { BACKS, DEFAULT_BACK, backDataURL } from './backs.js';
import { TABLES, DEFAULT_TABLE, tableBackground } from './tables.js';

const DESIGN_KEY = 'cards.design';

export function cardDesign() {
  const d = store.get(DESIGN_KEY, null) || {};
  return {
    back: BACKS.some((b) => b.id === d.back) ? d.back : DEFAULT_BACK,
    table: TABLES.some((t) => t.id === d.table) ? d.table : DEFAULT_TABLE,
  };
}

export function saveCardDesign(d) { store.set(DESIGN_KEY, d); }

export function currentTable() {
  const d = cardDesign();
  return TABLES.find((t) => t.id === d.table) || TABLES[0];
}

function setThemeColor(c) {
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.append(m); }
  m.content = c;
}

/** Rücken (als CSS-Variable am Dokument) – auch für Tutorials und Menü-Vorschau. */
export function applyBack() {
  const d = cardDesign();
  const b = BACKS.find((x) => x.id === d.back) || BACKS[0];
  document.documentElement.style.setProperty('--back-img', backDataURL(b));
  const t = currentTable();
  document.documentElement.style.setProperty('--felt', t.base);
  document.documentElement.style.setProperty('--felt-l', t.light);
  document.documentElement.style.setProperty('--felt-d', t.dark);
}

/** Spielfläche einfärben (Tisch + Rücken). */
export function applyCardTheme(app) {
  installSprite();
  applyBack();
  const t = currentTable();
  app.classList.add('cards-game');
  app.classList.toggle('ink-dark', t.ink === 'dark');
  app.style.setProperty('--table-bg', tableBackground(t));
  setThemeColor(t.dark);
  return t;
}

export function clearCardTheme(app) {
  app.classList.remove('cards-game', 'ink-dark');
  app.style.removeProperty('--table-bg');
  setThemeColor('#fbf6ef');
}

// ---------------------------------------------------------------- Leisten

/** Topbar im Spiel: Zurück · Titel/Info · ? · Ton */
export function gameTop({ onBack, onHelp }) {
  const back = backButton('#', (e) => { onBack && onBack(e); });
  back.classList.add('white-btn');
  const snd = soundButton();
  snd.classList.add('white-btn');
  const help = h('button.icon-btn.white-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  help.addEventListener('click', () => onHelp && onHelp());
  const title = h('b');
  const info = h('small');
  const el = h('div.topbar.cg-top', null, back, h('div.cg-hud', null, title, info), help, snd);
  return {
    el,
    setTitle(t) { title.textContent = t; },
    /** parts: [{ text, id? }] */
    setInfo(parts) {
      info.replaceChildren(...parts.filter(Boolean).map((p) => h('span', p.id ? { 'data-k': p.id } : null, p.text)));
    },
  };
}

/** Werkzeugleiste unten: [{ id, icon, label, onClick }] */
export function toolbar(list) {
  const el = h('div.cg-bar');
  const btn = {};
  for (const t of list) {
    const b = h('button.cg-tool', { type: 'button', 'aria-label': t.label, 'data-tool': t.id, html: icon(t.icon, { size: 22 }) });
    b.append(h('span', null, t.label));
    b.addEventListener('click', () => t.onClick && t.onClick());
    el.append(b);
    btn[t.id] = b;
  }
  return { el, btn };
}

/** Kleine Plakette (z.B. Zahl der Karten im Talon) */
export function badge() {
  return h('div.pc-badge');
}

/** Schwebender Text über der Spielfläche («+30»). */
export function floatText(table, text, x, y) {
  const el = h('div.pc-float', null, text);
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
  table.add(el);
  setTimeout(() => el.remove(), 1100);
}

// ---------------------------------------------------------------- Blätter

export function toggleRow(label, sub, get, set) {
  const b = h('button.cg-toggle', { type: 'button', role: 'switch' },
    h('span', null, label, sub ? h('small', null, sub) : null), h('i.cg-switch'));
  const paint = () => { b.classList.toggle('on', !!get()); b.setAttribute('aria-checked', get() ? 'true' : 'false'); };
  b.addEventListener('click', () => { set(!get()); paint(); });
  paint();
  return b;
}

/** Auswahl Kartenrücken + Tisch (gemeinsam für alle Kartenspiele). */
export function designSection(onChange) {
  const wrap = h('div');
  const backs = h('div.cg-picks');
  const tables = h('div.cg-picks');
  const render = () => {
    const d = cardDesign();
    backs.replaceChildren(...BACKS.map((b) => {
      const el = h('button.cg-pick' + (d.back === b.id ? '.on' : ''), { type: 'button', 'aria-label': b.name },
        h('span.sw', { style: { backgroundImage: backDataURL(b) } }), b.name);
      el.addEventListener('click', () => { saveCardDesign({ ...cardDesign(), back: b.id }); render(); onChange && onChange(); });
      return el;
    }));
    tables.replaceChildren(...TABLES.map((t) => {
      const el = h('button.cg-pick.table' + (d.table === t.id ? '.on' : ''), { type: 'button', 'aria-label': t.name },
        h('span.sw', { style: { background: tableBackground(t), backgroundSize: 'auto, 100% 100%' } }), t.name);
      el.addEventListener('click', () => { saveCardDesign({ ...cardDesign(), table: t.id }); render(); onChange && onChange(); });
      return el;
    }));
  };
  render();
  wrap.append(h('h3', null, 'Kartenrücken'), backs, h('h3', null, 'Tisch'), tables);
  return wrap;
}

/** Einstellungsblatt: Spielregeln (Schalter) + Design. */
export function showSettings({ title = 'Einstellungen', toggles = [], onDesign } = {}) {
  const content = h('div.cg-sheet');
  if (toggles.length) {
    content.append(h('h3', null, 'Spiel'));
    for (const t of toggles) content.append(toggleRow(t.label, t.sub, t.get, t.set));
  }
  content.append(designSection(onDesign));
  return showModal({ title, content, buttons: [{ label: 'Fertig', value: true, primary: true }] });
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNum(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Gewinnblatt-Inhalt: kleiner Kartenfächer, Untertitel, Kennzahlen, Plaketten, Hinweis. */
export function winContent({ cards = [], sub, stats = [], badges = [], note } = {}) {
  installSprite();
  const content = h('div');
  if (cards.length) {
    const art = h('div.cg-win-art');
    const n = cards.length;
    cards.forEach((code, i) => {
      const a = n === 1 ? 0 : -24 + (48 * i) / (n - 1);
      const el = miniCard(code, { x: 115 - 25 + (i - (n - 1) / 2) * 30, y: 14 + Math.abs(a) * 0.35, rot: a });
      el.firstChild.style.animation = `pc-pop .5s ${(0.1 + i * 0.08).toFixed(2)}s var(--ease-spring) both`;
      art.append(el);
    });
    content.append(art);
  }
  if (sub) content.append(h('p.cg-win-sub', null, sub));
  if (badges.length) content.append(h('div.cg-badge-row', null, badges.map((b) => h('span', null, b))));
  if (stats.length) content.append(h('div.cg-stats', null, stats.map((s) => h('div', null, h('b', null, String(s.value)), h('small', null, s.label)))));
  if (note) content.append(h('p.cg-note', null, note));
  return content;
}

/**
 * Statistik-Blatt mit Modus-Wahl.
 * modes: [{ id, label }], rows(modeId) -> [{ label, value }], onReset(modeId)
 */
export function showStatsSheet({ title = 'Statistik', modes, current, rows, onReset }) {
  let cur = current || modes[0].id;
  const content = h('div.cg-sheet');
  const tabs = h('div.cg-modes');
  const grid = h('div.cg-statgrid');
  const render = () => {
    tabs.replaceChildren(...(modes.length > 1 ? modes.map((m) => {
      const b = h('button' + (m.id === cur ? '.on' : ''), { type: 'button' }, m.label);
      b.addEventListener('click', () => { cur = m.id; render(); });
      return b;
    }) : []));
    grid.replaceChildren(...rows(cur).map((r) => h('div', null, h('b', null, String(r.value)), h('small', null, r.label))));
  };
  render();
  content.append(tabs, grid);
  const buttons = [{ label: 'Schliessen', value: 'ok', primary: true }];
  if (onReset) buttons.push({ label: 'Statistik zurücksetzen', value: 'reset', ghost: true });
  return showModal({ title, content, buttons }).then(async (v) => {
    if (v !== 'reset') return;
    const ok = await showModal({
      title: 'Zurücksetzen?', text: 'Die Statistik für diesen Modus wird gelöscht.',
      buttons: [{ label: 'Löschen', value: true, primary: true, icon: 'trash' }, { label: 'Abbrechen', value: false, ghost: true }],
    });
    if (ok) onReset(cur);
  });
}

// ---------------------------------------------------------------- Zeit

/** Misst die aktive Spielzeit (pausiert, wenn die Seite verborgen ist). */
export class Clock {
  constructor(ms = 0) {
    this.base = ms;
    this.t0 = 0;
    this.onVis = () => { if (document.hidden) this.pause(); else if (this.wanted) this.start(); };
    document.addEventListener('visibilitychange', this.onVis);
  }
  start() { this.wanted = true; if (!this.t0 && !document.hidden) this.t0 = performance.now(); }
  pause() { if (this.t0) { this.base += Math.min(performance.now() - this.t0, 3600e3); this.t0 = 0; } }
  stop() { this.wanted = false; this.pause(); }
  get ms() { return this.base + (this.t0 ? performance.now() - this.t0 : 0); }
  destroy() { this.stop(); document.removeEventListener('visibilitychange', this.onVis); }
}

// ---------------------------------------------------------------- Mini-Karten (Tutorial)

/** Eine einzelne Karte als Element (für Tutorials/Blätter), absolut positioniert. */
export function miniCard(code, { x = 0, y = 0, rot = 0, up = true, cls = '' } = {}) {
  installSprite();
  const el = h('div.pcard' + (up ? '.up' : '') + (cls ? '.' + cls : ''));
  el.innerHTML = `<div class="pin">${faceHTML(code)}<div class="pb"></div></div>`;
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  el._x = x; el._y = y; el._rot = rot;
  return el;
}

export function moveMini(el, x, y, rot = 0) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  el._x = x; el._y = y; el._rot = rot;
}

/** Grüne Mini-Bühne für Tutorial-Demos. size: { w, h } der Szene in px (wird zentriert skaliert). */
export function tutStage(stage, { w = 300, hgt = 190 } = {}) {
  applyBack();
  const box = h('div.pc-stage');
  const scene = h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: w + 'px', height: hgt + 'px' } });
  box.append(scene);
  stage.append(box);
  const fit = () => {
    const r = box.getBoundingClientRect();
    const s = Math.min(1.25, (r.width - 16) / w, (r.height - 16) / hgt) || 1;
    scene.style.transform = `translate(-50%, -50%) scale(${s.toFixed(3)})`;
  };
  fit();
  requestAnimationFrame(fit);
  return { box, scene };
}

export { sfx };
