// Spielansicht von Dreierlei: Brett mit Steinen, Ablage (7 Plätze), Auslage, Hilfen.
// Logik steckt in ./logic/rules.js – hier nur Darstellung, Animation und Eingabe.

import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, celebrate, ease, soundButton } from '../shared/ui.js';
import { makeRng } from '../shared/rng.js';
import { Game, TRAY_SIZE, SHELF_SIZE, HELPER_KEYS } from './logic/rules.js';
import { solve, findHint } from './logic/solver.js';
import { showHelp } from './howto.js';
import { bounds } from './logic/board.js';
import { themeById, themes } from './data/themes.js';
import { formatTime } from './progress.js';

const ASPECT = 1.13;   // Steinhöhe / Steinbreite
const LIFT = 0.05;     // optischer Versatz nach oben pro Ebene (Anteil der Steinhöhe)
const SHIFT = 0.11;    // optischer Seitenversatz für Turm-Ebenen (Anteil der Steinbreite, < 2× Fuge)
const FLY_MS = 290;
const POP_MS = 300;

const STASH_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5h16v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M9 17h6"/><path d="M12 3.5v7M8.8 6.7L12 3.5l3.2 3.2"/></svg>';

const HELPER_INFO = {
  undo: { label: 'Zurück', icon: () => icon('undo') },
  stash: { label: 'Auslagern', icon: () => STASH_ICON },
  shuffle: { label: 'Mischen', icon: () => icon('shuffle') },
  hint: { label: 'Tipp', icon: () => icon('hint') },
};

const PRAISE = ['Super!', 'Toll!', 'Wunderbar!', 'Klasse!', 'Fantastisch!', 'Bravo!'];

/**
 * Knopf-Auslösung über Pointer-Events: robust auch bei schnellen Folgetipps
 * (die Doppeltipp-Sperre von setupPage() verschluckt sonst manchmal den «click»).
 */
function onPress(el, fn) {
  let down = false;
  el.addEventListener('pointerdown', (e) => {
    down = true;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) {
      swallowGhostClick(e.clientX, e.clientY);
      fn(e);
    }
  });
  el.addEventListener('pointercancel', () => { down = false; });
  // Tastatur (Enter/Leertaste) erzeugt einen click ohne Pointer
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

/**
 * Nach einer Auslösung per pointerup folgt der «click» derselben Berührung erst danach –
 * und träfe sonst das Element, das inzwischen an dieser Stelle liegt (z.B. den
 * Zurück-Knopf des Menüs → Startseite). Den nächsten click darum kurz abfangen.
 */
function swallowGhostClick(x, y) {
  const stop = (ev) => {
    if (Math.abs(ev.clientX - x) > 14 || Math.abs(ev.clientY - y) > 14) return; // anderer Tipp
    ev.preventDefault(); ev.stopPropagation(); done();
  };
  const done = () => { window.removeEventListener('click', stop, true); clearTimeout(t); };
  const t = setTimeout(done, 400);
  window.addEventListener('click', stop, true);
}

// ---------- kleine Tween-Maschine (eine Bewegung pro Stein, jederzeit umlenkbar) ----------

class Sprite {
  constructor(el, w, h) {
    this.el = el; this.w = w; this.h = h;
    this.x = 0; this.y = 0; this.s = 1; this.r = 0; this.o = 1;
    this._o = 1;
    this.tw = null;
  }
  apply() {
    this.el.style.transform = `translate3d(${(this.x - this.w / 2).toFixed(2)}px,${(this.y - this.h / 2).toFixed(2)}px,0) rotate(${this.r.toFixed(2)}deg) scale(${this.s.toFixed(4)})`;
    if (this.o !== this._o) { this.el.style.opacity = String(this.o); this._o = this.o; }
  }
}

class Tweens {
  constructor() {
    this.active = new Set();
    this.raf = 0;
    this.frame = this.frame.bind(this);
  }
  to(sp, props, opts = {}) {
    const now = performance.now();
    sp.tw = {
      from: { x: sp.x, y: sp.y, s: sp.s, r: sp.r, o: sp.o },
      to: { x: sp.x, y: sp.y, s: sp.s, r: sp.r, o: sp.o, ...props },
      t0: now + (opts.delay || 0),
      dur: Math.max(1, opts.dur ?? 250),
      ease: opts.ease || ease.outCubic,
      arc: opts.arc || 0,
      onDone: opts.onDone || null,
      started: !(opts.delay > 0),
    };
    this.active.add(sp);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }
  stop(sp) { sp.tw = null; this.active.delete(sp); }
  frame(now) {
    for (const sp of this.active) {
      const tw = sp.tw;
      if (!tw) { this.active.delete(sp); continue; }
      if (now < tw.t0) continue;
      if (!tw.started) {
        // Startwerte erst beim tatsächlichen Start übernehmen (verzögerte Bewegungen)
        tw.started = true;
        tw.from = { x: sp.x, y: sp.y, s: sp.s, r: sp.r, o: sp.o };
      }
      const t = Math.min(1, (now - tw.t0) / tw.dur);
      const e = tw.ease(t);
      const f = tw.from, to = tw.to;
      sp.x = f.x + (to.x - f.x) * e;
      sp.y = f.y + (to.y - f.y) * e - tw.arc * Math.sin(Math.PI * t);
      sp.s = f.s + (to.s - f.s) * e;
      sp.r = f.r + (to.r - f.r) * e;
      sp.o = f.o + (to.o - f.o) * Math.min(1, t * 1.2);
      if (t >= 1) { sp.x = to.x; sp.y = to.y; sp.s = to.s; sp.r = to.r; sp.o = to.o; }
      sp.apply();
      if (t >= 1) {
        sp.tw = null;
        this.active.delete(sp);
        if (tw.onDone) tw.onDone();
      }
    }
    this.raf = this.active.size ? requestAnimationFrame(this.frame) : 0;
  }
  clear() {
    this.active.clear();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

/**
 * ctx: {
 *   kind, level, saved, title, subtitle, tag,
 *   save(json), onStart(fresh), onWin(game) → { stars, isNewBest, best, buttons:[{label,value,primary,ghost}] },
 *   onWinChoice(value), onLoss(), restart(), menu()
 * }
 */
/**
 * Türme: Liegt eine Ebene (grösstenteils) exakt auf der darunter, wird sie abwechselnd leicht seitlich
 * versetzt gezeichnet. Nur Optik – die Regeln (wer wen bedeckt) bleiben unverändert. So sind Stapel als
 * Stapel lesbar (der dunklere Stein darunter blitzt seitlich hervor). → Versatz-Faktor 0/1 pro Ebene
 */
function layerShifts(tiles, maxZ) {
  const at = [];
  for (const t of tiles) (at[t.z] || (at[t.z] = new Set())).add(t.x + ',' + t.y);
  const shift = [0];
  for (let z = 1; z <= maxZ; z++) {
    const cur = at[z], below = at[z - 1];
    let same = 0;
    if (cur && below) for (const k of cur) if (below.has(k)) same++;
    shift[z] = cur && same * 2 >= cur.size ? 1 - shift[z - 1] : shift[z - 1];
  }
  return shift;
}

/** Hat der Nutzer schon getippt? (Klänge vorher nicht abspielen – Autoplay-Regeln der Browser) */
function gestured() {
  try { return !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch { return true; }
}

export function mountPlay(root, ctx) {
  const level = ctx.level;
  const theme = themeById(level.theme) || themes[0];
  let game;
  let fresh = !ctx.saved;
  try { game = new Game(level, ctx.saved || null); } catch { game = new Game(level); fresh = true; }
  if (fresh) ctx.onStart && ctx.onStart();
  const rng = makeRng(`${level.seed}-mix-${Date.now()}`);
  const tw = new Tweens();
  let alive = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };

  // ---------- DOM ----------
  root.className = 'app tr-play';
  root.style.setProperty('--t-color', theme.color);
  root.style.setProperty('--t-bg', theme.bg);
  root.innerHTML = '';

  const backBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zum Menü' });
  backBtn.innerHTML = icon('back');
  onPress(backBtn, () => { sfx.play('click'); ctx.menu(); });
  const restartBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Neu beginnen' });
  restartBtn.innerHTML = icon('refresh');
  onPress(restartBtn, onRestartClick);
  const soundBtn = soundButton();
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s' });
  helpBtn.innerHTML = '<span class="tr-q">?</span>';
  onPress(helpBtn, () => { sfx.play('click'); showHelp(); });

  const titleB = h('b', null, ctx.title);
  const top = h('header.topbar.tr-top', null,
    backBtn,
    h('div.tr-title', null,
      titleB,
      h('small', null, ctx.subtitle)),
    helpBtn,
    restartBtn,
    soundBtn);

  const progFill = h('i');
  const progText = h('span.tr-prog-text');
  const starsEl = h('div.tr-stars', { 'aria-label': 'Sterne' });
  for (let i = 0; i < 3; i++) starsEl.append(h('span', { html: icon('star', { size: 18 }) }));
  const hud = h('div.tr-hud', null,
    h('div.tr-prog', null, h('div.tr-prog-bar', null, progFill), progText),
    starsEl);

  const trayBg = h('div.tr-tray');
  const shelfBg = h('div.tr-shelf');
  const sprites = h('div.tr-sprites');
  const fx = h('div.tr-fx');
  const stage = h('div.tr-stage', null, shelfBg, trayBg, sprites, fx);

  const helperBtns = {};
  const helpers = h('nav.tr-helpers');
  for (const k of HELPER_KEYS) {
    const info = HELPER_INFO[k];
    const badge = h('span.tr-badge');
    const b = h('button.tr-helper', { type: 'button', 'data-helper': k, 'aria-label': info.label },
      h('span.tr-helper-ic', { html: info.icon() }, badge),
      h('span.tr-helper-label', null, info.label));
    onPress(b, () => onHelper(k));
    helperBtns[k] = { b, badge };
    helpers.append(b);
  }

  root.append(top, hud, stage, helpers);

  /** Langer Titel: Schrift stufenweise verkleinern, zuletzt mit «…» kürzen (CSS). */
  function fitTitle() {
    titleB.classList.remove('fit-1', 'fit-2');
    if (titleB.scrollWidth <= titleB.clientWidth + 1) return;
    titleB.classList.add('fit-1');
    if (titleB.scrollWidth > titleB.clientWidth + 1) titleB.classList.replace('fit-1', 'fit-2');
  }

  // ---------- Sprites ----------
  const sp = new Array(game.n).fill(null);
  let L = null; // Layout
  let vTray = []; // { id, pending }
  const b = bounds(level.tiles);
  const lshift = layerShifts(level.tiles, b.maxZ);
  const shiftW = lshift.some(Boolean) ? SHIFT : 0;
  const symbol = (i) => level.symbols[game.types[i]] || '❓';

  function makeSprite(i) {
    const el = h('div.tr-tile', { 'data-id': String(i) }, h('span.tr-emo', null, symbol(i)));
    sprites.append(el);
    const s = new Sprite(el, 10, 10);
    sp[i] = s;
    return s;
  }

  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const padX = 12;
    const trayW = Math.min(W - 2 * padX, 470);
    const slotW = trayW / TRAY_SIZE;
    const trayTileW = Math.min(slotW - 5, 64);
    const trayTileH = trayTileW * ASPECT;
    const trayH = Math.round(trayTileH + 18);
    const trayY = H - trayH - 4;
    const trayX = (W - trayW) / 2;
    const shelfH = Math.round(trayTileH + 8);
    const shelfY = trayY - shelfH - 6;
    const boardTop = 4;
    const boardW = W - 2 * padX;
    const unitByW = boardW / (b.w + shiftW);
    const hUnits = b.h * ASPECT + b.maxZ * LIFT * ASPECT;
    const fitU = (bottom) => Math.max(16, Math.min(unitByW, Math.max(60, bottom - boardTop) / hUnits, 72));
    // Solange die Auslage leer ist, darf die Spielfläche deren Platz mitbenutzen – aber nur, wenn die
    // Steine dadurch spürbar grösser werden (sonst bliebe das Brett unnötig in Bewegung).
    const uShelf = fitU(shelfY - 4), uFull = fitU(trayY - 10);
    const reclaim = uFull > uShelf + 0.5;
    const shelfOn = !reclaim || game.shelf.length > 0;
    const boardBottom = shelfOn ? shelfY - 4 : trayY - 10;
    const boardH = Math.max(60, boardBottom - boardTop);
    const u = shelfOn ? uShelf : uFull;
    const gap = Math.max(2, u * 0.065);
    const tileW = u - gap;
    const tileH = u * ASPECT - gap;
    const pxW = (b.w + shiftW) * u;
    const pxH = b.h * u * ASPECT + b.maxZ * LIFT * u * ASPECT;
    const ox = (W - pxW) / 2;
    const bTop = boardTop + (boardH - pxH) / 2;
    const oy = bTop + b.maxZ * LIFT * u * ASPECT;
    L = {
      W, H, u, tileW, tileH, ox, oy, trayX, trayY, trayW, trayH, slotW, trayTileW, shelfY, shelfH,
      trayScale: trayTileW / tileW, reclaim, shelfOn, boardBottom, bTop, bBot: bTop + pxH,
    };
    const edge = Math.max(3, Math.round(tileW * 0.075));
    stage.style.setProperty('--tw', tileW.toFixed(2) + 'px');
    stage.style.setProperty('--th', tileH.toFixed(2) + 'px');
    stage.style.setProperty('--edge', edge + 'px');
    stage.style.setProperty('--emo', (tileW * 0.6).toFixed(2) + 'px');
    Object.assign(trayBg.style, { left: trayX - 6 + 'px', top: trayY + 'px', width: trayW + 12 + 'px', height: trayH + 'px' });
    Object.assign(shelfBg.style, { left: trayX - 6 + 'px', top: shelfY + 'px', width: trayW + 12 + 'px', height: shelfH + 'px' });
    if (!trayBg.children.length) for (let k = 0; k < TRAY_SIZE; k++) trayBg.append(h('i'));
    [...trayBg.children].forEach((w, k) => {
      Object.assign(w.style, {
        left: 6 + slotW * k + (slotW - trayTileW - 2) / 2 + 'px', width: trayTileW + 2 + 'px',
        top: (trayH - trayTileH - 4) / 2 + 'px', height: trayTileH + 4 + 'px',
      });
    });
    for (const s of sp) if (s) { s.w = tileW; s.h = tileH; }
  }

  function boardPos(i) {
    const t = level.tiles[i];
    return {
      x: L.ox + (t.x - b.minX + lshift[t.z] * SHIFT) * L.u + L.u / 2,
      y: L.oy + (t.y - b.minY) * L.u * ASPECT + (L.u * ASPECT) / 2 - t.z * LIFT * L.u * ASPECT,
    };
  }
  function traySlot(k, count) {
    const n = Math.max(TRAY_SIZE, count);
    const slot = L.trayW / n;
    return { x: L.trayX + slot * (k + 0.5), y: L.trayY + L.trayH / 2 - 1 };
  }
  function shelfSlot(k) {
    return { x: L.trayX + L.slotW * (k + 0.5), y: L.shelfY + L.shelfH / 2 };
  }
  function zBoard(i) { return 10 + level.tiles[i].z * 10; }

  function placeAll() {
    for (let i = 0; i < game.n; i++) {
      const s = sp[i];
      if (!s) continue;
      tw.stop(s);
      const w = game.where[i];
      if (w === 0) { const p = boardPos(i); s.x = p.x; s.y = p.y; s.s = 1; s.el.style.zIndex = zBoard(i); }
      s.r = 0; s.o = 1;
      s.apply();
    }
    vTray.forEach((e, k) => { const s = sp[e.id]; if (!s) return; const p = traySlot(k, vTray.length); s.x = p.x; s.y = p.y; s.s = L.trayScale; s.el.style.zIndex = 500; s.apply(); });
    game.shelf.forEach((id, k) => { const s = sp[id]; const p = shelfSlot(k); s.x = p.x; s.y = p.y; s.s = L.trayScale; s.el.style.zIndex = 400; s.apply(); });
  }

  function refreshCovered() {
    for (let i = 0; i < game.n; i++) {
      const s = sp[i];
      if (!s) continue;
      const covered = game.where[i] === 0 && game.block[i] > 0;
      s.el.classList.toggle('covered', covered);
    }
  }

  function layoutTray(flyId = -1) {
    vTray.forEach((e, k) => {
      const s = sp[e.id];
      if (!s || e.popping) return;
      const p = traySlot(k, vTray.length);
      if (e.id === flyId) {
        s.el.style.zIndex = 600;
        tw.to(s, { x: p.x, y: p.y, s: L.trayScale, r: 0 }, {
          dur: FLY_MS, ease: ease.outCubic, arc: Math.min(60, Math.abs(s.y - p.y) * 0.18),
          onDone: () => { s.el.style.zIndex = 500; },
        });
      } else if (Math.abs(s.x - p.x) > 0.5 || Math.abs(s.y - p.y) > 0.5 || (s.tw && s.tw.to.x !== p.x)) {
        tw.to(s, { x: p.x, y: p.y, s: L.trayScale, r: 0 }, { dur: 180, ease: ease.outCubic });
      }
    });
    updateTrayMood();
  }

  function layoutShelf() {
    shelfBg.classList.toggle('show', game.shelf.length > 0);
    game.shelf.forEach((id, k) => {
      const s = sp[id];
      const p = shelfSlot(k);
      s.el.style.zIndex = 400;
      tw.to(s, { x: p.x, y: p.y, s: L.trayScale, r: 0 }, { dur: 260, ease: ease.outCubic, arc: 10 });
    });
  }

  /**
   * Auslage erscheint/verschwindet: Brett sanft neu einpassen (nur wenn layout() dafür Platz freigibt).
   * Grössen sind relativ zur Steinbreite → alle Skalen mit k umrechnen, damit nichts springt.
   */
  function syncShelfSpace() {
    if (!L || !alive) return;
    const want = !L.reclaim || game.shelf.length > 0;
    if (want === L.shelfOn) return;
    const old = { u: L.u, ox: L.ox, oy: L.oy, tileW: L.tileW };
    layout();
    const k = old.tileW / L.tileW;
    const m = L.u / old.u;
    for (let i = 0; i < game.n; i++) {
      const s = sp[i];
      if (!s) continue;
      s.s *= k;
      if (game.where[i] === 0) {
        if (s.tw) {
          s.tw.from.s *= k;
          s.tw.to.x = L.ox + (s.tw.to.x - old.ox) * m;
          s.tw.to.y = L.oy + (s.tw.to.y - old.oy) * m;
        } else {
          const p = boardPos(i);
          tw.to(s, { x: p.x, y: p.y, s: 1 }, { dur: 320, ease: ease.inOutCubic });
        }
      } else if (s.tw) {
        s.tw.from.s *= k;
        s.tw.to.s *= k;
      }
      s.apply();
    }
    placeCoach();
  }

  function updateTrayMood() {
    const count = vTray.filter((e) => !e.pending && !e.popping).length;
    trayBg.classList.toggle('warn', count === TRAY_SIZE - 2);
    trayBg.classList.toggle('danger', count >= TRAY_SIZE - 1);
  }

  function updateHud() {
    const done = game.cleared;
    progFill.style.width = (100 * done / game.n).toFixed(1) + '%';
    progText.textContent = `${game.remaining}`;
    progText.setAttribute('aria-label', `Noch ${game.remaining} Steine`);
    const st = game.stars;
    [...starsEl.children].forEach((e, k) => e.classList.toggle('on', k < st));
    for (const k of HELPER_KEYS) {
      const { b: btn, badge } = helperBtns[k];
      const left = game.helpers[k];
      badge.textContent = String(left);
      btn.classList.toggle('used', left <= 0);
      let possible = left > 0 && game.status !== 'won';
      if (k === 'undo') possible = game.canUndo();
      if (k === 'stash') possible = game.canStash();
      if (k === 'shuffle') possible = game.canShuffle();
      if (k === 'hint') possible = game.canHint();
      btn.classList.toggle('idle', !possible);
    }
  }

  // ---------- Speichern & Zeit ----------
  let tickAt = performance.now();
  function tick() {
    const now = performance.now();
    const overlay = document.querySelector('.sp-modal-backdrop, .tut-backdrop'); // Dialog/Anleitung offen → Pause
    if (game.status === 'play' && document.visibilityState === 'visible' && !overlay) game.elapsed += Math.min(now - tickAt, 5000);
    tickAt = now;
  }
  const tickTimer = setInterval(tick, 1000);
  let discarded = false;
  function persist() {
    tick();
    if (game.status === 'won' || discarded) return;
    ctx.save(game.toJSON());
  }
  const onVis = () => { if (document.visibilityState === 'hidden') persist(); else tickAt = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', persist);

  // ---------- Effekte ----------
  function burst(x, y, colors) {
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = 34 + Math.random() * 30;
      const star = k % 3 === 0;
      const el = h('span.tr-spark' + (star ? '.star' : ''));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.background = star ? 'none' : colors[k % colors.length];
      if (star) { el.innerHTML = icon('sparkle', { size: 16 }); el.style.color = colors[k % colors.length]; }
      fx.append(el);
      const anim = el.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.25}px), calc(-50% + ${Math.sin(a) * d * 1.25 + 10}px)) scale(.6)`, opacity: 0 },
      ], { duration: 620 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' });
      anim.onfinish = () => el.remove();
    }
    const ring = h('span.tr-ring');
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.borderColor = colors[0];
    fx.append(ring);
    ring.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 },
    ], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => ring.remove();
  }

  function floatText(text, x, y, big = false) {
    const el = h('div.tr-float' + (big ? '.big' : ''), null, text);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    fx.append(el);
    el.animate([
      { transform: 'translate(-50%,-20%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1.08)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-140%) scale(.96)', opacity: 0 },
    ], { duration: big ? 1500 : 1000, easing: 'ease-out' }).onfinish = () => el.remove();
  }

  let combo = 0;
  let lastPopAt = 0;

  function popTriple(ids) {
    const entries = vTray.filter((e) => ids.includes(e.id));
    entries.forEach((e) => { e.popping = true; });
    const mid = sp[ids[1]] || sp[ids[0]];
    const cx = traySlot(vTray.indexOf(entries[1] || entries[0]), vTray.length).x;
    const cy = mid.y;
    entries.forEach((e, k) => {
      const s = sp[e.id];
      s.el.style.zIndex = 700;
      s.el.classList.add('glow');
      tw.to(s, { s: L.trayScale * 1.18, y: cy - 4 }, {
        dur: 110, ease: ease.outCubic, delay: k * 30,
        onDone: () => tw.to(s, { x: cx, s: 0.15, o: 0 }, {
          dur: 190, ease: ease.inOutCubic,
          onDone: () => { s.el.remove(); sp[e.id] = null; },
        }),
      });
    });
    later(() => {
      sfx.play('pop');
      burst(cx, cy, [theme.color, '#ffd23f', '#ffffff', '#ff8fb1']);
      const now = performance.now();
      combo = now - lastPopAt < 2600 ? combo + 1 : 0;
      lastPopAt = now;
      if (combo >= 1) {
        sfx.play('sparkle');
        floatText(PRAISE[Math.min(PRAISE.length - 1, combo - 1)], cx, cy - L.trayTileW * 0.9);
      }
    }, 230);
    later(() => {
      vTray = vTray.filter((e) => !entries.includes(e));
      layoutTray();
      updateHud();
      if (game.status === 'won' && !vTray.length) onWin();
    }, POP_MS + 40);
  }

  // ---------- Eingabe ----------
  let hintIds = [];
  let hintTimer = 0;
  function clearHint() {
    for (const id of hintIds) if (sp[id]) sp[id].el.classList.remove('hint');
    hintIds = [];
    clearTimeout(hintTimer);
  }

  function wiggle(i) {
    const s = sp[i];
    if (!s || s.tw) return;
    const r0 = s.r;
    tw.to(s, { r: r0 - 7 }, { dur: 60, onDone: () => tw.to(s, { r: r0 + 6 }, { dur: 80, onDone: () => tw.to(s, { r: r0 }, { dur: 90 }) }) });
  }

  let coveredTips = 0;
  function onPointerDown(e) {
    const el = e.target.closest && e.target.closest('.tr-tile');
    if (!el || !alive) return;
    e.preventDefault();
    const id = +el.dataset.id;
    tap(id);
  }
  sprites.addEventListener('pointerdown', onPointerDown);

  function tap(id) {
    if (!sp[id] || busy) return false;
    if (game.status !== 'play') return false;
    if (!game.isFree(id)) {
      if (game.where[id] === 0) {
        wiggle(id);
        sfx.play('thud');
        if (coveredTips < 1 && game.moves < 12) { coveredTips++; toast('Dieser Stein ist noch verdeckt'); }
      }
      return false;
    }
    const ev = game.pick(id);
    if (!ev) return false;
    sfx.play('tap');
    removeCoach();
    clearHint();
    const t = game.types[id];
    let lastSame = -1;
    vTray.forEach((e, k) => { if (!e.pending && !e.popping && game.types[e.id] === t) lastSame = k; });
    const entry = { id, pending: false, popping: false };
    vTray.splice(lastSame >= 0 ? lastSame + 1 : vTray.length, 0, entry);
    if (ev.matched) vTray.forEach((e) => { if (ev.matched.includes(e.id)) e.pending = true; });
    layoutTray(id);
    if (ev.from === 's') {
      layoutShelf();
      if (!game.shelf.length) later(syncShelfSpace, FLY_MS);
    }
    refreshCovered();
    for (const f of ev.freed) {
      const s = sp[f];
      if (s && !s.tw) tw.to(s, { s: 1.06 }, { dur: 90, onDone: () => tw.to(s, { s: 1 }, { dur: 140 }) });
    }
    later(() => sfx.play('place'), FLY_MS - 40);
    if (ev.matched) later(() => popTriple(ev.matched), FLY_MS - 10);
    updateHud();
    // Gewonnen: sofort verbuchen (Fortschritt, Statistik, Spielstand löschen) – das Blatt kommt erst nach
    // der Animation. So geht der Sieg nicht verloren, wenn die App gleich danach verlassen wird.
    if (ev.status === 'won') settleWin();
    persist();
    if (ev.status === 'lost') later(onLoss, FLY_MS + 120);
    return true;
  }

  let busy = false;

  // ---------- Hilfen ----------
  function onHelper(k) {
    if (!alive || busy) return;
    sfx.play('click');
    if (game.status === 'won') return;
    if (game.helpers[k] <= 0) {
      toast(ctx.kind === 'free' ? 'Schon benutzt – im nächsten Spiel wieder da' : 'Schon benutzt – im nächsten Level wieder da');
      return;
    }
    if (k === 'undo') doUndo();
    else if (k === 'stash') doStash(false);
    else if (k === 'shuffle') doShuffle();
    else if (k === 'hint') doHint();
  }

  function doUndo() {
    if (!game.canUndo()) { toast(game.last ? 'Geht gerade nicht' : 'Nichts zum Zurücknehmen'); return false; }
    const ev = game.undo();
    if (!ev) return false;
    clearHint();
    sfx.play('whoosh');
    vTray = vTray.filter((e) => e.id !== ev.id);
    const s = sp[ev.id];
    if (ev.to === 'b') {
      const p = boardPos(ev.id);
      s.el.style.zIndex = 600;
      tw.to(s, { x: p.x, y: p.y, s: 1, r: 0 }, { dur: 320, arc: 30, onDone: () => { s.el.style.zIndex = zBoard(ev.id); } });
    } else {
      syncShelfSpace();
      layoutShelf();
    }
    layoutTray();
    refreshCovered();
    updateHud();
    persist();
    return true;
  }

  function doStash(extra) {
    if (!game.canStash(extra)) {
      toast(game.tray.length ? 'Die Auslage ist voll' : 'Die Ablage ist leer');
      return false;
    }
    const ev = game.stash(extra);
    if (!ev) return false;
    clearHint();
    sfx.play('whoosh');
    vTray = vTray.filter((e) => !ev.moved.includes(e.id));
    syncShelfSpace();
    layoutShelf();
    layoutTray();
    updateHud();
    persist();
    return true;
  }

  function doShuffle() {
    if (!game.canShuffle()) { toast('Hier gibt es nichts zu mischen'); return false; }
    busy = true;
    const ev = game.shuffle(rng);
    if (!ev) { busy = false; return false; }
    clearHint();
    sfx.play('whoosh');
    const ids = game.boardIds();
    const cx = L.W / 2, cy = (L.bTop + L.bBot) / 2;
    ids.forEach((id, k) => {
      const s = sp[id];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * L.u * 0.9;
      tw.to(s, { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: (Math.random() - 0.5) * 50, s: 0.8 }, {
        dur: 260, delay: k * 3, ease: ease.inOutCubic,
      });
    });
    later(() => {
      for (const id of ids) sp[id].el.firstChild.textContent = symbol(id);
      sfx.play('sparkle');
      ids.forEach((id, k) => {
        const s = sp[id];
        const p = boardPos(id);
        tw.to(s, { x: p.x, y: p.y, r: 0, s: 1 }, { dur: 380, delay: k * 4, ease: ease.outBack });
      });
      later(() => { busy = false; }, 380 + ids.length * 4);
    }, 300 + ids.length * 3);
    refreshCovered();
    updateHud();
    persist();
    return true;
  }

  function doHint() {
    if (!game.canHint()) return false;
    const r = game.hint();
    if (!r) { toast('Gerade kein Tipp möglich'); return false; }
    sfx.play('sparkle');
    showHint(r.ids);
    updateHud();
    persist();
    return true;
  }

  function showHint(ids) {
    clearHint();
    hintIds = ids.slice();
    for (const id of hintIds) if (sp[id]) sp[id].el.classList.add('hint');
    hintTimer = setTimeout(clearHint, 7000);
  }

  // ---------- Ende ----------
  async function onWin() {
    if (!alive || winShown) return;
    winShown = true;
    const res = settleWin();
    sfx.play('complete');
    celebrate([theme.color, '#ffd23f', '#ff8fb1', '#7bd389', '#8a63d2']);
    await new Promise((r) => later(r, 650));
    const starRow = h('div.tr-win-stars');
    for (let k = 0; k < 3; k++) {
      const st = h('span' + (k < res.stars ? '.on' : ''), { html: icon('star', { size: 46 }) });
      st.style.animationDelay = (0.15 + k * 0.22) + 's';
      starRow.append(st);
    }
    for (let k = 0; k < res.stars; k++) later(() => sfx.play('sparkle'), 300 + k * 220);
    const facts = h('div.tr-win-facts', null,
      h('div', null, h('b', null, formatTime(game.elapsed)), h('small', null, 'Zeit')),
      h('div', null, h('b', null, String(game.triples)), h('small', null, 'Drillinge')),
      h('div', null, h('b', null, String(game.used)), h('small', null, game.used === 1 ? 'Hilfe' : 'Hilfen')));
    const content = h('div.tr-win', null,
      starRow,
      res.isNewBest ? h('p.tr-win-best', null, 'Neue Bestzeit!') : null,
      facts,
      res.note ? h('p.tr-win-note', null, res.note) : null);
    const v = await showModal({ title: res.title || 'Geschafft!', content, buttons: res.buttons, dismissible: false });
    if (alive) ctx.onWinChoice(v);
  }
  let winShown = false;
  let winRes = null;
  function settleWin() {
    if (!winRes) { tick(); winRes = ctx.onWin(game); }
    return winRes;
  }

  async function onLoss() {
    if (!alive || game.status !== 'lost') return;
    if (gestured()) sfx.play('error');
    trayBg.classList.remove('sp-shake');
    void trayBg.offsetWidth;
    trayBg.classList.add('sp-shake');
    ctx.onLoss && ctx.onLoss();
    await new Promise((r) => later(r, 520));
    const buttons = [];
    if (game.canStash()) buttons.push({ label: 'Auslagern (3 Steine)', value: 'stash', primary: true });
    if (game.canUndo()) buttons.push({ label: 'Letzten Stein zurück', value: 'undo', primary: !buttons.length });
    if (!buttons.length && game.canStash(true)) buttons.push({ label: 'Zweite Chance', value: 'extra', primary: true });
    buttons.push({ label: 'Nochmal', value: 'restart', primary: !buttons.length });
    buttons.push({ label: 'Zum Menü', value: 'menu', ghost: true });
    const v = await showModal({
      title: 'Ablage voll!',
      html: `<p>Kein Problem${buttons.length > 2 ? ' – eine Hilfe rettet die Runde' : ''}.</p>`,
      buttons,
      dismissible: false,
    });
    if (!alive) return;
    if (v === 'stash') doStash(false);
    else if (v === 'undo') doUndo();
    else if (v === 'extra') doStash(true);
    else if (v === 'restart') restart();
    else ctx.menu();
  }

  /** Neu beginnen: Spielstand verwerfen (destroy() darf ihn nicht wieder speichern). */
  function restart() {
    discarded = true;
    ctx.restart();
  }

  async function onRestartClick() {
    sfx.play('click');
    if (game.moves === 0) return;
    const ok = await showModal({
      title: 'Neu beginnen?',
      text: 'Dieses Level startet nochmal von vorn.',
      buttons: [{ label: 'Neu beginnen', value: true, primary: true }, { label: 'Weiterspielen', value: false, ghost: true }],
    });
    if (ok && alive) restart();
  }

  // ---------- Start ----------
  function build() {
    fitTitle();
    layout();
    for (let i = 0; i < game.n; i++) if (game.where[i] !== 3) makeSprite(i);
    for (const s of sp) if (s) { s.w = L.tileW; s.h = L.tileH; }
    vTray = game.tray.map((id) => ({ id, pending: false, popping: false }));
    placeAll();
    refreshCovered();
    shelfBg.classList.toggle('show', game.shelf.length > 0);
    updateHud();
    updateTrayMood();
  }
  build();

  if (fresh || game.moves === 0) dealIn();
  else if (game.status === 'lost') later(onLoss, 300);

  function dealIn() {
    busy = true;
    const order = [];
    for (let i = 0; i < game.n; i++) if (game.where[i] === 0) order.push(i);
    order.sort((a, c) => level.tiles[a].z - level.tiles[c].z || level.tiles[a].y - level.tiles[c].y || level.tiles[a].x - level.tiles[c].x);
    const step = Math.min(9, 700 / Math.max(1, order.length));
    order.forEach((i, k) => {
      const s = sp[i];
      const p = boardPos(i);
      s.x = p.x; s.y = p.y - 26 - level.tiles[i].z * 4; s.s = 0.6; s.o = 0; s.apply();
      tw.to(s, { y: p.y, s: 1, o: 1 }, { dur: 360, delay: 120 + k * step + level.tiles[i].z * 40, ease: ease.outBack });
    });
    later(() => { if (gestured()) sfx.play('whoosh'); }, 80);
    const banner = h('div.tr-banner', null,
      h('b', null, ctx.bannerTitle || ctx.title),
      h('span', null, ctx.tag || theme.title));
    fx.append(banner);
    banner.animate([
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.04)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%,-50%) scale(.96)', opacity: 0 },
    ], { duration: 1500, easing: 'ease-out' }).onfinish = () => banner.remove();
    banner.style.left = L.W / 2 + 'px';
    banner.style.top = (L.bTop + L.bBot) / 2 + 'px';
    later(() => { busy = false; }, 200 + order.length * step + 360 + 9 * 40);
  }

  // ---------- Coach-Mark (nur Level 1, bis zum ersten Zug) ----------
  let coach = null;
  let coachId = -1;
  function showCoach() {
    if (!alive || coach || game.moves > 0 || game.status !== 'play') return;
    const r = findHint(game.position(), { nodeLimit: 20000, timeLimit: 150 });
    coachId = r.ids.length ? r.ids[0] : (game.freeTiles()[0] ?? -1);
    if (coachId < 0 || !sp[coachId]) return;
    coach = h('div.tr-coach', { 'aria-hidden': 'true' }, h('i'), h('span', null, 'Tippe einen hellen Stein an'));
    fx.append(coach);
    placeCoach();
  }
  function placeCoach() {
    if (!coach || !sp[coachId]) return;
    const p = boardPos(coachId);
    coach.style.left = p.x + 'px';
    coach.style.top = p.y + 'px';
    coach.style.setProperty('--cw', L.tileW + 'px');
    coach.style.setProperty('--ch', L.tileH + 'px');
    // Hinweis nicht über die Nachbarsteine legen: in den freien Raum unter (oder über) dem Brett
    const label = coach.lastChild;
    const freeBelow = L.boardBottom - (L.bBot + 6);
    const freeAbove = L.bTop - 2;
    let cy = null;
    if (freeBelow >= 40) cy = L.bBot + 6 + freeBelow / 2;
    else if (freeAbove >= 40) cy = freeAbove / 2;
    label.classList.toggle('free', cy != null);
    label.classList.toggle('below', cy == null && p.y < L.H * 0.3);
    label.style.left = cy != null ? (L.W / 2 - p.x) + 'px' : '';
    label.style.top = cy != null ? (cy - p.y) + 'px' : '';
  }
  function removeCoach() {
    if (!coach) return;
    const c = coach;
    coach = null;
    c.classList.add('gone');
    setTimeout(() => c.remove(), 300);
  }
  if (ctx.coach && game.moves === 0) later(showCoach, fresh ? 1500 : 500);

  // ---------- Grössenänderung ----------
  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (!alive) return; fitTitle(); layout(); placeAll(); placeCoach(); }, 60);
  };
  window.addEventListener('resize', onResize);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(stage);

  // ---------- Test-/Debug-Zugriff ----------
  const debug = {
    get game() { return game; },
    level,
    tileCenter(id) {
      const s = sp[id];
      if (!s) return null;
      const r = stage.getBoundingClientRect();
      return { x: r.left + s.x, y: r.top + s.y };
    },
    /** Nächster Zug einer Gewinn-Reihenfolge ab dem aktuellen Zustand (Löser). */
    nextMove() {
      const r = solve(game.position(), { nodeLimit: 60000, timeLimit: 1500 });
      return r.ok && r.path.length ? r.path[0] : (game.freeTiles()[0] ?? game.shelf[0] ?? -1);
    },
    freeTiles() { return game.freeTiles(); },
    isBusy() { return busy || tw.active.size > 0; },
    tap,
  };
  window.__triple = debug;

  return {
    destroy() {
      persist();
      alive = false;
      tw.clear();
      for (const t of timers) clearTimeout(t);
      clearInterval(tickTimer);
      clearTimeout(hintTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      if (window.__triple === debug) window.__triple = null;
      root.style.removeProperty('--t-color');
      root.style.removeProperty('--t-bg');
    },
  };
}
