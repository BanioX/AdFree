// Wortrate – Oberfläche (Menü, Spiel, Tastatur, Blätter). Die Spielregeln stehen in logic.js.

import { store, reportSummary, todayKey, markDailyDone, isDailyDone } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, tutorialSeen } from '../shared/tutorial.js';
import * as L from './logic.js';
import { loadWords } from './words.js';
import { tutorialSteps } from './howto.js';

setupPage();

const ID = 'wordle';
const ACCENT = '#d9a21b';
const app = document.getElementById('app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = ['#3f9f66', '#e6a82a', '#ffd23f', '#ff7a59', '#5b8def', '#ee6fb7'];

// ---------- Gespeicherte Daten ----------

const DEFAULT_SETTINGS = { hard: false, lenient: false, contrast: false };
const getSettings = () => ({ ...DEFAULT_SETTINGS, ...store.get('wordle.settings', {}) });
const setSettings = (s) => { store.set('wordle.settings', s); applyTheme(); };

const getAllStats = () => store.get('wordle.stats', {});
const getStats = (key) => ({ ...L.emptyStats(), ...(getAllStats()[key] || {}) });
const setStats = (key, s) => store.update('wordle.stats', {}, (all) => ({ ...all, [key]: s }));

const gameKey = (mode, len) => (mode === 'daily' ? 'daily' : 'e' + len);
const loadGame = (key) => store.get('wordle.game.' + key, null);
const saveGame = (key, g) => store.set('wordle.game.' + key, g);

const getLen = () => { const n = store.get('wordle.len', 5); return L.LENGTHS.includes(n) ? n : 5; };

function applyTheme() {
  app.classList.toggle('contrast', getSettings().contrast);
}
applyTheme();

function totalWins() {
  const all = getAllStats();
  return Object.values(all).reduce((n, s) => n + (s.won || 0), 0);
}

function report() {
  const today = todayKey();
  const dg = loadGame('daily');
  let d = 'Tageswort offen';
  if (isDailyDone(ID)) d = 'Tageswort ✓';
  else if (dg && dg.day === today && dg.status === 'lost') d = 'Tageswort verpasst';
  else if (dg && dg.day === today && dg.guesses.length) d = `Tageswort: ${dg.guesses.length}/6`;
  const w = totalWins();
  reportSummary(ID, `${d} · ${w} ${w === 1 ? 'Wort' : 'Wörter'} erraten`);
}

// ---------- Navigation ----------

let view = null; // aktuelle Spielansicht (GameView) oder null im Menü
let fromMenu = false; // wurde das laufende Spiel aus dem Menü geöffnet? (dann geht «Zurück» per history.back)

function parseRoute() {
  const hsh = location.hash.replace(/^#/, '');
  if (hsh === 'daily') return { name: 'game', mode: 'daily', len: 5 };
  const m = /^endlos(?:\/(\d))?$/.exec(hsh);
  if (m) {
    const len = Number(m[1]) || getLen();
    return { name: 'game', mode: 'endless', len: L.LENGTHS.includes(len) ? len : 5 };
  }
  return { name: 'menu' };
}

function go(hash) {
  fromMenu = !view;
  location.hash = hash;
}

function goMenu() {
  if (fromMenu) {
    fromMenu = false;
    history.back();
    return;
  }
  history.replaceState(null, '', location.pathname + location.search);
  route();
}

let routeToken = 0;
async function route() {
  const r = parseRoute();
  const token = ++routeToken;
  if (view) { view.destroy(); view = null; }
  if (r.name === 'menu') {
    fromMenu = false;
    renderMenu();
    return;
  }
  renderLoading();
  let words;
  try {
    words = await loadWords(r.len);
  } catch (err) {
    if (token !== routeToken) return;
    renderError();
    return;
  }
  if (token !== routeToken) return;
  view = new GameView(r.mode, r.len, words);
  view.mount();
}

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !view) renderMenu();
});

function renderLoading() {
  app.replaceChildren(h('div.topbar', null, backButton('#', (e) => goMenu()), h('div.title', null, 'Wortrate')),
    h('div.game', null, h('div.board-wrap', null, h('p.muted', null, 'Einen Moment …'))));
}

function renderError() {
  app.replaceChildren(h('div.topbar', null, backButton('#', () => goMenu()), h('div.title', null, 'Wortrate')),
    h('div.menu', null, h('p.tagline', null, 'Die Wortliste konnte nicht geladen werden.'),
      h('button.btn.primary.block', { type: 'button', onclick: () => route() }, 'Nochmals versuchen')));
}

// ---------- Kleine Bausteine ----------

function tileEl(letter = '', state = 'empty') {
  const t = h('div.tile', { 'data-state': state });
  t.textContent = letter;
  return t;
}

function wordTiles(word, state = 'correct', cls = 'mini-row') {
  return h('div.' + cls, null, [...word].map((ch) => tileEl(ch, state)));
}

function iconButton(name, label, onclick, extra = '') {
  const b = h('button.icon-btn' + extra, { type: 'button', 'aria-label': label });
  b.innerHTML = icon(name);
  b.addEventListener('click', (e) => { onclick(e); });
  return b;
}

function helpButton() {
  const b = h('button.icon-btn', { type: 'button', 'aria-label': "So geht's" });
  b.innerHTML = '<span class="gm-q">?</span>';
  b.addEventListener('click', () => { openHelp(); });
  return b;
}

function msUntilMidnight() {
  const now = new Date();
  const t = new Date(now);
  t.setHours(24, 0, 0, 0);
  return t - now;
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
function countdownEl() {
  const b = h('b');
  const el = h('div.countdown', null, 'Nächstes Tageswort in', b);
  const tick = () => {
    if (!el.isConnected && el.dataset.started) { clearInterval(timer); return; }
    el.dataset.started = '1';
    b.textContent = fmtCountdown(msUntilMidnight());
  };
  const timer = setInterval(tick, 1000);
  tick();
  return el;
}

// ---------- Menü ----------

let logoPlayed = false;
let menuEl = null;

function dailyInfo() {
  const today = todayKey();
  const dg = loadGame('daily');
  const dToday = dg && dg.day === today ? dg : null;
  const done = isDailyDone(ID) || !!(dToday && dToday.status === 'won');
  const lost = !done && dToday && dToday.status === 'lost';
  let sub = L.formatDay(today);
  if (done && dToday) sub = `${dToday.guesses.length} ${dToday.guesses.length === 1 ? 'Versuch' : 'Versuche'}`;
  else if (lost) sub = 'Heute nicht erraten';
  else if (dToday && dToday.guesses.length) sub = `${dToday.guesses.length} von 6 Versuchen`;
  return {
    label: 'Tageswort',
    done,
    sub,
    streak: L.currentStreak(getStats('daily'), today),
    onClick: () => go('daily'),
  };
}

function menuStats(len) {
  const st = getStats('e' + len);
  return [
    { label: 'Gespielt', value: st.played },
    { label: 'Gewonnen', value: L.winRate(st) + '%' },
    { label: 'Serie', value: st.streak || 0 },
    { label: 'Rekord', value: st.maxStreak || 0 },
  ];
}

function primaryFor(len) {
  const eg = loadGame('e' + len);
  const resume = eg && eg.status === 'playing' && eg.guesses.length > 0;
  return {
    label: resume ? 'Weiter' : 'Spielen',
    sub: resume ? `Endlos · ${eg.guesses.length} von 6 Versuchen` : `Endlos · ${len} Buchstaben`,
    icon: 'play',
    onClick: () => go('endlos/' + len),
  };
}

function settingsCard(gameView = null) {
  const s = getSettings();
  const items = [
    ['hard', 'Schwerer Modus', 'Gefundene Hinweise müssen weiter verwendet werden.'],
    ['lenient', 'Alle Wörter erlauben', 'Auch Wörter ausserhalb der Wortliste annehmen.'],
    ['contrast', 'Kontrastfarben', 'Orange und Blau statt Grün und Gelb.'],
  ];
  const box = h('div.settings-card');
  for (const [k, title, sub] of items) {
    const sw = h('button.switch' + (s[k] ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': String(!!s[k]), 'aria-label': title, 'data-setting': k });
    const row = h('div.setting', null, h('div.txt', null, h('b', null, title), h('small', null, sub)), sw);
    const toggle = () => {
      const cur = getSettings();
      cur[k] = !cur[k];
      setSettings(cur);
      sw.classList.toggle('on', cur[k]);
      sw.setAttribute('aria-checked', String(cur[k]));
      sfx.play('click');
      if (gameView && gameView.alive) gameView.settingsChanged(cur, k);
    };
    sw.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    row.addEventListener('click', toggle);
    box.append(row);
  }
  return box;
}

const LEN_NAMES = { 4: 'Kurz', 5: 'Klassisch', 6: 'Lang' };

function renderMenu() {
  const len = getLen();
  const eg = loadGame('e' + len);
  const resume = eg && eg.status === 'playing' && eg.guesses.length > 0;
  const logo = buildLogo();
  const secondary = [{ label: 'Statistik', icon: 'grid', onClick: () => openStats('e' + len) }];
  if (resume) secondary.push({ label: 'Neues Wort', icon: 'refresh', onClick: () => menuNewWord(len) });
  menuEl = gameMenu({
    id: ID,
    title: 'Wortrate',
    tagline: 'Finde das Wort in sechs Versuchen',
    accent: ACCENT,
    art: logo,
    primary: primaryFor(len),
    daily: dailyInfo(),
    modes: {
      label: 'Endlos · Wortlänge',
      value: String(len),
      options: L.LENGTHS.map((n) => ({ id: String(n), label: LEN_NAMES[n], sub: `${n} Buchstaben` })),
      onChange(id) {
        store.set('wordle.len', Number(id));
        renderMenu();
      },
    },
    secondary,
    stats: menuStats(len),
    sections: [menuSection('Einstellungen', settingsCard())],
    onHelp: () => openHelp(),
    backHref: '../',
  });
  menuEl.classList.add('wr-menu');
  const keepScroll = app.querySelector('.gm-scroll');
  const top = keepScroll ? keepScroll.scrollTop : 0;
  app.replaceChildren(menuEl);
  if (top) menuEl.scroller.scrollTop = top;
  if (!logoPlayed) { logoPlayed = true; animateLogo(logo); }
  report();
}

async function menuNewWord(len) {
  const ok = await confirmDialog('Neues Wort?', 'Das angefangene Wort wird aufgedeckt und zählt als nicht erraten.', 'Neues Wort', 'Abbrechen');
  if (!ok) return;
  const key = 'e' + len;
  const g = loadGame(key);
  if (g && g.status === 'playing' && g.guesses.length) {
    setStats(key, L.recordResult(getStats(key), { won: false, guesses: g.guesses.length }));
    toast(`Das Wort war «${g.answer}»`, 2400);
  }
  store.remove('wordle.game.' + key);
  go('endlos/' + len);
}

const LOGO = [['W', 'correct'], ['O', 'present'], ['R', 'absent'], ['T', 'correct']];
const LOGO2 = [['R', 'correct'], ['A', 'correct'], ['T', 'correct'], ['E', 'correct']];
function buildLogo() {
  const mk = (arr) => h('div.lrow', null, arr.map(([c, s]) => tileEl(c, s)));
  return h('div.logo', { 'aria-label': 'Wortrate' }, mk(LOGO), mk(LOGO2));
}
function animateLogo(logo) {
  if (reduced) return;
  const tiles = [...logo.querySelectorAll('.tile')];
  tiles.forEach((t, i) => {
    const state = t.dataset.state;
    t.dataset.state = 'tbd';
    setTimeout(() => flip(t, state), 120 + i * 90);
  });
}

// ---------- Animationen ----------

function anim(el, frames, opts) {
  if (!el.animate) return Promise.resolve();
  try {
    return el.animate(frames, opts).finished.catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/** Kachel umdrehen und in der Mitte die Farbe setzen. */
async function flip(tile, state, sound) {
  if (reduced || !tile.animate) {
    tile.dataset.state = state;
    if (sound) sfx.play(sound);
    return;
  }
  const d = 170;
  const a1 = tile.animate([{ transform: 'perspective(240px) rotateX(0deg)' }, { transform: 'perspective(240px) rotateX(90deg)' }],
    { duration: d, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
  await a1.finished.catch(() => {});
  tile.dataset.state = state;
  if (sound) sfx.play(sound);
  const a2 = tile.animate([{ transform: 'perspective(240px) rotateX(-90deg)' }, { transform: 'perspective(240px) rotateX(0deg)' }],
    { duration: d + 40, easing: 'cubic-bezier(.2,.6,.3,1)' });
  a1.cancel();
  await a2.finished.catch(() => {});
}

function pop(tile) {
  if (reduced) return;
  anim(tile, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 150, easing: 'ease-out' });
}

function shake(el) {
  return anim(el, [
    { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
    { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' },
  ], { duration: reduced ? 1 : 420, easing: 'ease-out' });
}

function bounce(tiles) {
  if (reduced) return Promise.resolve();
  return Promise.all(tiles.map((t, i) => anim(t, [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-34%) scale(1.04)', offset: 0.35 },
    { transform: 'translateY(5%) scale(.98)', offset: 0.7 },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: 560, delay: i * 95, easing: 'ease-out' })));
}

// ---------- Spielansicht ----------

const KEY_ROWS = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '>YXCVBNM<'];
const ENTER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5v6a3 3 0 0 1-3 3H5"/><path d="M9 10l-4 4 4 4"/></svg>';
const DEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 5H20a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H8.5L2.5 12z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/></svg>';

class GameView {
  constructor(mode, len, words) {
    this.mode = mode;
    this.len = len;
    this.words = words;
    this.key = gameKey(mode, len);
    this.busy = false;
    this.alive = true;
    this.game = this.loadOrCreate();
    if (mode === 'endless') store.set('wordle.len', len);
  }

  loadOrCreate() {
    const today = todayKey();
    const saved = loadGame(this.key);
    const ok = saved && saved.v === 1 && L.isWordShape(saved.answer, this.len) && Array.isArray(saved.guesses);
    if (this.mode === 'daily') {
      if (ok && saved.day === today) return saved;
      const g = L.newGame({ answer: L.dailyWord(this.words.answers, today), mode: 'daily', day: today, hard: getSettings().hard });
      saveGame(this.key, g);
      return g;
    }
    if (ok) return saved;
    return this.freshEndless();
  }

  freshEndless() {
    const usedKey = 'wordle.used.' + this.len;
    let used = store.get(usedKey, []);
    const exclude = this.len === 5 ? [L.dailyWord(this.words.answers, todayKey())] : [];
    const { word, resetUsed } = L.pickEndless(this.words.answers, used, Math.random, exclude);
    if (resetUsed) used = [];
    used.push(word);
    store.set(usedKey, used);
    const g = L.newGame({ answer: word, mode: 'endless', hard: getSettings().hard });
    saveGame(this.key, g);
    return g;
  }

  save() { saveGame(this.key, this.game); }

  // ----- Aufbau -----
  mount() {
    const isDaily = this.mode === 'daily';
    const title = h('div.title.center', null,
      isDaily ? 'Tageswort' : 'Endlos',
      h('small', null, isDaily ? L.formatDay(this.game.day) : `${this.len} Buchstaben`));
    const btns = h('div.btns');
    if (!isDaily) btns.append(iconButton('refresh', 'Neues Wort', () => this.newWordRequest(), '#newword'));
    else btns.append(iconButton('grid', 'Statistik', () => openStats('daily')));
    btns.append(iconButton('settings', 'Einstellungen', () => openSettings(this)));
    const back = backButton('#', () => { goMenu(); });
    const top = h('div.topbar.game-top', null, h('div.btns', null, back, helpButton()), title, btns);

    this.board = h('div.board', { role: 'grid', 'aria-label': 'Spielfeld' });
    this.rows = [];
    for (let r = 0; r < L.MAX_GUESSES; r++) {
      const row = h('div.row', { role: 'row' });
      for (let c = 0; c < this.len; c++) row.append(tileEl());
      this.rows.push(row);
      this.board.append(row);
    }
    this.banner = h('div.reveal-banner', { 'aria-live': 'polite' });
    this.wrap = h('div.board-wrap', null, this.board, this.banner);
    this.bottom = h('div.bottom');
    this.el = h('div.game', null, this.wrap, this.bottom);
    app.replaceChildren(top, this.el);

    this.renderBoard();
    if (this.game.status === 'playing') this.buildKeyboard();
    else this.buildEndbar(false);
    // Erstes Spiel überhaupt: dezenter Hinweis am Spielfeld, verschwindet beim ersten Tippen.
    if (this.game.status === 'playing' && !this.game.guesses.length && !this.game.input && !store.get('wordle.coached', false)) {
      this.coach = h('div.coach', { 'aria-hidden': 'true' }, h('span', null, '⌨️'), `Tippe ein Wort mit ${this.len} Buchstaben`);
      this.wrap.append(this.coach);
    }
    this.fit();
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.wrap);
    this.onKeyDown = (e) => this.handlePhysical(e);
    window.addEventListener('keydown', this.onKeyDown);
    if (isDaily && this.game.status !== 'playing' && !this.game.counted) this.finish(false);
  }

  destroy() {
    this.alive = false;
    if (this.ro) this.ro.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
  }

  fit() {
    const W = this.wrap.clientWidth - 24;
    const H = this.wrap.clientHeight - 12;
    if (W <= 0 || H <= 0) return;
    const gap = this.len >= 6 ? 5 : 6;
    const max = this.len === 4 ? 68 : this.len === 5 ? 64 : 56;
    const t = Math.max(28, Math.floor(Math.min((W - gap * (this.len - 1)) / this.len, (H - gap * 5) / 6, max)));
    this.board.style.setProperty('--tile', t + 'px');
    this.board.style.setProperty('--gap', gap + 'px');
  }

  renderBoard() {
    const g = this.game;
    this.rows.forEach((row, r) => {
      const tiles = [...row.children];
      row.classList.toggle('current', g.status === 'playing' && r === g.guesses.length);
      if (r < g.guesses.length) {
        const w = [...g.guesses[r]];
        const sc = L.scoreGuess(g.guesses[r], g.answer);
        tiles.forEach((t, i) => { t.textContent = w[i]; t.dataset.state = sc[i]; t.classList.remove('cursor'); });
      } else if (r === g.guesses.length && g.status === 'playing') {
        const w = [...g.input];
        tiles.forEach((t, i) => {
          t.textContent = w[i] || '';
          t.dataset.state = w[i] ? 'tbd' : 'empty';
          t.classList.toggle('cursor', i === w.length);
        });
      } else {
        tiles.forEach((t) => { t.textContent = ''; t.dataset.state = 'empty'; t.classList.remove('cursor'); });
      }
    });
  }

  updateCurrentRow(changedIndex = -1) {
    const g = this.game;
    const row = this.rows[g.guesses.length];
    if (!row) return;
    const w = [...g.input];
    [...row.children].forEach((t, i) => {
      t.textContent = w[i] || '';
      t.dataset.state = w[i] ? 'tbd' : 'empty';
      t.classList.toggle('cursor', i === w.length);
    });
    if (changedIndex >= 0 && w[changedIndex]) pop(row.children[changedIndex]);
    if (this.enterKey) this.enterKey.classList.toggle('ready', w.length === this.len);
  }

  // ----- Tastatur -----
  buildKeyboard() {
    const kbd = h('div.kbd', { role: 'group', 'aria-label': 'Tastatur' });
    this.keys = new Map();
    for (const rowStr of KEY_ROWS) {
      const row = h('div.krow');
      for (const ch of rowStr) {
        let k = ch;
        let b;
        if (ch === '>') {
          k = 'ENTER';
          b = h('button.key.wide.enter', { type: 'button', 'aria-label': 'Bestätigen', 'data-k': k, html: ENTER_SVG });
          this.enterKey = b;
        } else if (ch === '<') {
          k = 'DEL';
          b = h('button.key.wide', { type: 'button', 'aria-label': 'Löschen', 'data-k': k, html: DEL_SVG });
        } else {
          b = h('button.key', { type: 'button', 'data-k': k, 'aria-label': k }, k, h('span.bubble', { 'aria-hidden': 'true' }, k));
          this.keys.set(k, b);
        }
        this.bindKey(b, k);
        row.append(b);
      }
      kbd.append(row);
    }
    this.bottom.replaceChildren(kbd);
    this.updateKeys();
    this.updateCurrentRow();
  }

  bindKey(b, k) {
    let upTimer = 0;
    const release = () => {
      clearTimeout(upTimer);
      upTimer = setTimeout(() => b.classList.remove('down', 'pop'), 70);
    };
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      clearTimeout(upTimer);
      b.classList.add('down');
      if (e.pointerType !== 'mouse' && k.length === 1) b.classList.add('pop');
      this.press(k);
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
    // Tastatur-Bedienung (Tab + Leertaste/Enter) erzeugt click mit detail 0
    b.addEventListener('click', (e) => { if (e.detail === 0) this.press(k); });
  }

  updateKeys() {
    if (!this.keys) return;
    const st = L.keyboardStates(this.game.guesses, this.game.answer);
    for (const [k, b] of this.keys) {
      if (st[k]) b.dataset.state = st[k];
      else delete b.dataset.state;
    }
  }

  handlePhysical(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('.sp-modal-backdrop, .tut-backdrop')) return;
    let k = null;
    if (e.key === 'Enter') k = 'ENTER';
    else if (e.key === 'Backspace' || e.key === 'Delete') k = 'DEL';
    else if (e.key && e.key.length === 1) {
      const up = L.normalizeWord(e.key);
      if (up.length === 1 && L.ALPHABET.includes(up)) k = up;
    }
    if (!k) return;
    e.preventDefault();
    if (this.game.status !== 'playing') {
      if (k === 'ENTER') this.showResult();
      return;
    }
    const b = k === 'ENTER' ? this.enterKey : this.keys && this.keys.get(k);
    if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 90); }
    this.press(k);
  }

  dismissCoach() {
    if (!this.coach) return;
    store.set('wordle.coached', true);
    const c = this.coach;
    this.coach = null;
    c.classList.add('gone');
    setTimeout(() => c.remove(), 300);
  }

  press(k) {
    if (this.busy || this.game.status !== 'playing') return;
    this.dismissCoach();
    if (k === 'ENTER') { this.submit(); return; }
    if (k === 'DEL') {
      const g = L.deleteLetter(this.game);
      if (g !== this.game) { this.game = g; this.save(); this.updateCurrentRow(); sfx.play('click'); }
      return;
    }
    const g = L.typeLetter(this.game, k);
    if (g === this.game) return;
    this.game = g;
    this.save();
    this.updateCurrentRow(L.wordLength(g.input) - 1);
    sfx.play('tap');
  }

  async submit() {
    const settings = getSettings();
    const res = L.submitGuess(this.game, { isAllowed: (w) => settings.lenient || this.words.allowed.has(w) });
    const rowIndex = this.game.guesses.length;
    if (!res.ok) {
      if (res.reason === 'over') return;
      sfx.play('error');
      toast(res.message);
      shake(this.rows[rowIndex]);
      return;
    }
    this.busy = true;
    this.game = res.game;
    this.save();
    if (this.enterKey) this.enterKey.classList.remove('ready');
    const row = this.rows[rowIndex];
    row.classList.remove('current');
    const tiles = [...row.children];
    tiles.forEach((t) => t.classList.remove('cursor'));
    const sounds = { correct: 'fill', present: 'place', absent: 'tap' };
    await Promise.all(tiles.map((t, i) => sleep(reduced ? 0 : i * 250).then(() => flip(t, res.score[i], sounds[res.score[i]]))));
    if (!this.alive) return;
    this.updateKeys();
    if (res.won) {
      sfx.play('complete');
      await bounce(tiles);
      if (!this.alive) return;
      celebrate(CONFETTI);
      sfx.play('sparkle');
      this.finish(true);
    } else if (res.lost) {
      sfx.play('thud');
      await this.showBanner();
      if (!this.alive) return;
      this.finish(true);
    } else {
      this.busy = false;
      const next = this.rows[this.game.guesses.length];
      if (next) next.classList.add('current');
      this.updateCurrentRow();
    }
  }

  async showBanner() {
    this.banner.replaceChildren('Das gesuchte Wort war', h('b', null, this.game.answer));
    this.banner.classList.add('show');
    await sleep(reduced ? 600 : 1700);
  }

  /** Spielende verbuchen (einmal), Leiste zeigen, Ergebnis öffnen. */
  finish(animated) {
    const g = this.game;
    if (!g.counted) {
      const won = g.status === 'won';
      const key = this.key;
      setStats(key, L.recordResult(getStats(key), { won, guesses: g.guesses.length, day: g.mode === 'daily' ? g.day : null }));
      if (won && g.mode === 'daily') markDailyDone(ID, g.day);
      this.game = { ...g, counted: true };
      this.save();
      report();
    }
    this.busy = false;
    this.buildEndbar(animated);
    setTimeout(() => { if (this.alive) this.showResult(); }, animated ? 650 : 250);
  }

  buildEndbar(animated) {
    const g = this.game;
    this.keys = null;
    this.enterKey = null;
    const won = g.status === 'won';
    const msg = h('div.msg', null,
      won ? `${L.praise(g.guesses.length)} «${g.answer}»` : `Das Wort war «${g.answer}»`,
      h('small', null, won ? `Erraten in ${g.guesses.length} ${g.guesses.length === 1 ? 'Versuch' : 'Versuchen'}` : 'Beim nächsten Wort klappt es bestimmt!'));
    const result = h('button.btn', { type: 'button', id: 'show-result' });
    result.innerHTML = icon('star', { size: 18 });
    result.append('Ergebnis');
    result.addEventListener('click', () => { this.showResult(); });
    const next = h('button.btn.primary', { type: 'button', id: 'next-word' });
    next.innerHTML = icon('play', { size: 18 });
    next.append(this.mode === 'daily' ? 'Endlos spielen' : 'Nächstes Wort');
    next.addEventListener('click', () => { sfx.play('tap'); this.nextAction(); });
    const bar = h('div.endbar', null, msg, h('div.row2', null, result, next));
    if (this.mode === 'daily') bar.append(countdownEl());
    this.bottom.replaceChildren(bar);
    if (animated && !reduced) anim(bar, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    this.renderBoard();
  }

  nextAction() {
    if (this.mode === 'daily') {
      location.replace('#endlos/' + getLen());
      return;
    }
    this.startNewWord();
  }

  startNewWord() {
    this.game = this.freshEndless();
    this.banner.classList.remove('show');
    sfx.play('whoosh');
    this.buildKeyboard();
    this.renderBoard();
    if (!reduced) {
      this.rows.forEach((row, r) => anim(row, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, delay: r * 40, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    }
    this.busy = false;
  }

  async newWordRequest() {
    if (this.busy) return;
    const g = this.game;
    if (g.status !== 'playing' || (g.guesses.length === 0)) {
      this.startNewWord();
      if (g.status === 'playing') toast('Neues Wort');
      return;
    }
    const ok = await confirmDialog('Wort aufgeben?', 'Das Wort wird aufgedeckt und zählt als nicht erraten.', 'Aufgeben', 'Weiterspielen');
    if (!ok || !this.alive || this.game !== g) return;
    this.busy = true;
    this.game = { ...g, input: '', status: 'lost', finished: Date.now() };
    this.save();
    this.renderBoard();
    sfx.play('thud');
    await this.showBanner();
    if (!this.alive) return;
    this.finish(true);
  }

  async showResult() {
    const g = this.game;
    if (g.status === 'playing') return;
    const v = await openResult(g, this.key);
    if (!this.alive) return;
    if (v === 'next') this.nextAction();
    else if (v === 'menu') goMenu();
  }

  /** Einstellungen haben sich geändert (schwerer Modus). */
  settingsChanged(s, changed) {
    if (changed !== 'hard' || this.game.status !== 'playing') return;
    if (!s.hard || this.game.guesses.length === 0) {
      this.game = { ...this.game, hard: s.hard };
      this.save();
    } else {
      toast('Gilt ab dem nächsten Wort');
    }
  }
}

// ---------- Blätter ----------

function statBlock(st, key) {
  const streak = key === 'daily' ? L.currentStreak(st, todayKey()) : st.streak || 0;
  return h('div.stat-grid', null,
    h('div', null, h('b', null, st.played), h('span', null, 'Gespielt')),
    h('div', null, h('b', null, L.winRate(st) + '%'), h('span', null, 'Gewonnen')),
    h('div', null, h('b', null, streak), h('span', null, 'Aktuelle Serie')),
    h('div', null, h('b', null, st.maxStreak || 0), h('span', null, 'Beste Serie')));
}

function distBlock(st, highlight = 0) {
  const max = Math.max(1, ...st.dist);
  const box = h('div.dist');
  st.dist.forEach((n, i) => {
    const bar = h('div.bar', { style: { width: `${Math.max(8, (n / max) * 100)}%` } }, n);
    box.append(h('div.dl' + (highlight === i + 1 ? '.hi' : ''), null, h('span', null, i + 1), bar));
  });
  return h('div', null, h('div.dist-title', null, 'Verteilung der Versuche'), box);
}

async function shareResult(g) {
  const text = L.shareText(g, { contrast: getSettings().contrast });
  if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Ergebnis kopiert – zum Einfügen bereit');
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* egal */ }
    ta.remove();
    toast(ok ? 'Ergebnis kopiert' : 'Teilen ist hier nicht möglich');
  }
}

function openResult(g, key) {
  const won = g.status === 'won';
  const st = getStats(key);
  const n = g.guesses.length;
  const shareBtn = h('button.btn', { type: 'button', id: 'share' });
  shareBtn.innerHTML = icon('share', { size: 19 });
  shareBtn.append('Teilen');
  shareBtn.addEventListener('click', () => { shareResult(g); });
  const content = h('div.sheet', null,
    h('p.center', null, won ? `Erraten in ${n} ${n === 1 ? 'Versuch' : 'Versuchen'}${g.hard ? ' · schwerer Modus' : ''}` : 'Diesmal hat es nicht gereicht. Das Wort war:'),
    wordTiles(g.answer, won ? 'correct' : 'present', 'mini-row.res-word'),
    statBlock(st, key),
    distBlock(st, won ? n : 0),
    h('div.share-row', null, shareBtn, g.mode === 'daily' ? countdownEl() : null));
  const buttons = g.mode === 'daily'
    ? [{ label: 'Endlos spielen', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }]
    : [{ label: 'Nächstes Wort', value: 'next', primary: true, icon: 'play' }, { label: 'Zum Menü', value: 'menu', ghost: true }];
  return showModal({ title: won ? L.praise(n) : 'Schade!', content, buttons });
}

function openStats(initial = 'e5') {
  const tabs = [['daily', 'Tageswort'], ['e4', '4 Buchst.'], ['e5', '5 Buchst.'], ['e6', '6 Buchst.']];
  let cur = initial;
  const body = h('div');
  const tabBar = h('div.tabs', { role: 'tablist' });
  const render = () => {
    const st = getStats(cur);
    for (const b of tabBar.children) b.classList.toggle('active', b.dataset.key === cur);
    body.replaceChildren(statBlock(st, cur), distBlock(st),
      cur === 'daily' ? h('p.center', { style: { fontSize: '14px', margin: '10px 0 0' } }, 'Jeden Tag ein neues Wort – für alle gleich.') : null);
  };
  for (const [k, label] of tabs) {
    const b = h('button.chip', { type: 'button', role: 'tab', 'data-key': k }, label);
    b.addEventListener('click', () => { cur = k; render(); });
    tabBar.append(b);
  }
  render();
  return showModal({ title: 'Statistik', content: h('div.sheet', null, tabBar, body), buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

function openSettings(gameView = null) {
  const box = h('div.sheet', null, settingsCard(gameView));
  const help = h('button.btn', { type: 'button' }, "So geht's");
  help.addEventListener('click', () => { closeTopModal(); setTimeout(() => openHelp(), 280); });
  const reset = h('button.btn.ghost', { type: 'button' }, 'Statistik löschen');
  reset.addEventListener('click', async () => {
    closeTopModal();
    await sleep(280);
    if (await confirmDialog('Statistik löschen?', 'Alle Zahlen und Serien von Wortrate werden auf null gesetzt.', 'Löschen', 'Abbrechen')) {
      store.set('wordle.stats', {});
      toast('Statistik gelöscht');
      report();
      if (!view) renderMenu();
    }
  });
  box.append(h('div.link-row', null, help, reset));
  return showModal({ title: 'Einstellungen', content: box, buttons: [{ label: 'Fertig', value: true, primary: true }] }).then(() => {
    if (!view) renderMenu();
  });
}

function closeTopModal() {
  const bds = document.querySelectorAll('.sp-modal-backdrop');
  const bd = bds[bds.length - 1];
  if (bd) bd.click();
}

let tutorialOpen = null;
function openHelp() {
  if (tutorialOpen) return tutorialOpen;
  tutorialOpen = showTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT }).finally(() => { tutorialOpen = null; });
  return tutorialOpen;
}

// ---------- Start ----------

window.__wordle = {
  get view() { return view ? view.mode : 'menu'; },
  get game() { return view ? JSON.parse(JSON.stringify(view.game)) : null; },
  get answer() { return view ? view.game.answer : null; },
  get busy() { return view ? view.busy : false; },
  get len() { return view ? view.len : getLen(); },
  words: (len) => loadWords(len).then((w) => ({ answers: w.answers.length, allowed: w.allowed.size })),
  isAllowed: (word, len = 5) => loadWords(len).then((w) => w.allowed.has(L.normalizeWord(word))),
};

// Beim allerersten Start: zuerst die Anleitung, dann das Spiel.
if (!tutorialSeen(ID)) {
  route();
  setTimeout(() => openHelp(), 300);
} else {
  route();
}
