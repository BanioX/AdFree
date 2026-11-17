// Wortsuche – App: Menü, Themenkatalog, Spielansicht, Statistik.
// Routen:  #  (Menü) · #themen · #play/<stufe> · #daily

import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { makeRng } from '../shared/rng.js';
import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, celebrate, setupPage, soundButton, backButton, sleep } from '../shared/ui.js';
import { themes, groups } from './data/themes.js';
import { modes, DAILY_MODE } from './data/modes.js';
import { generatePuzzle, matchSelection, readLine, starsFor, formatTime, dailyThemeIndex, pickHintWord } from './logic.js';
import { Board, CAP_COLORS } from './board.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showTutorial, maybeShowTutorial, tutorialSeen } from '../shared/tutorial.js';
import { tutorialSteps } from './howto.js';

const ID = 'wordsearch';
const ACCENT = '#5a9e3c';
const K = {
  settings: 'wordsearch.settings',
  stats: 'wordsearch.stats',
  progress: 'wordsearch.progress',
  game: (m) => `wordsearch.game.${m}`,
  daily: 'wordsearch.daily',
  coach: 'wordsearch.coachDone',
  rot: 'wordsearch.rotation',
  seq: 'wordsearch.seq',
};

const themeById = (id) => themes.find((t) => t.id === id) || null;
const modeById = (id) => modes.find((m) => m.id === id) || null;
const groupById = (id) => groups.find((g) => g.id === id) || groups[0];
const themeColor = (t) => (t && t.color) || groupById(t && t.group).color;

/** h() setzt style per Object.assign – CSS-Variablen (--g, --c) brauchen setProperty. */
function vars(el, map) {
  for (const [k, v] of Object.entries(map)) el.style.setProperty(k, v);
  return el;
}

// Erstes Rätsel überhaupt: klein, freundlich, schnell gelöst.
const FIRST_THEME = 'tiere';
const FIRST_MODE = { sizes: [7], words: [6] };
// Jedes dritte Rätsel ist ein «Bonusrätsel» mit einem geheimen Zusatzwort (+1 Stern).
const BONUS_EVERY = 3;
const isBonusSeq = (seq) => seq > 1 && seq % BONUS_EVERY === 0;
// Kombo: Wörter kurz hintereinander gefunden (Spielzeit, Pausen zählen nicht).
const COMBO_MS = 10000;
const PRAISE = ['', '', 'Schnell!', 'Super!', 'Fantastisch!', 'Wahnsinn!', 'Unaufhaltsam!'];

// ---------- Lokale Icons ----------
const IC = {
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 4"/><circle cx="12" cy="17.6" r=".4" fill="currentColor"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2.5h4"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
};
const starSvg = (on, size = 30) => `<svg class="st ${on ? 'on' : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" stroke-linejoin="round" stroke-width="1.6"/></svg>`;

// ---------- Gespeicherte Daten ----------

// Neue Spielerinnen starten mit «Leicht» (kurze, sichere erste Runde).
const defaultSettings = { mode: 'leicht', showTimer: true, sortFound: true, listCollapsed: false };
function getSettings() {
  const s = { ...defaultSettings, ...(store.get(K.settings, {}) || {}) };
  if (!modeById(s.mode)) s.mode = defaultSettings.mode;
  return s;
}
function setSettings(patch) {
  const s = { ...getSettings(), ...patch };
  store.set(K.settings, s);
  return s;
}

const defaultStats = () => ({ played: 0, won: 0, words: 0, stars: 0, hints: 0, time: 0, best: {}, wonBy: {}, perfect: 0, bonus: 0, combo: 0 });
function getStats() { return { ...defaultStats(), ...(store.get(K.stats, {}) || {}) }; }
function setStats(s) { store.set(K.stats, s); }
function getProgress() { return store.get(K.progress, {}) || {}; }

function validState(st) {
  return st && st.puzzle && Array.isArray(st.puzzle.grid) && Array.isArray(st.puzzle.words)
    && Array.isArray(st.found) && st.puzzle.words.length > 0;
}

function newState(puzzle, extra = {}) {
  return { puzzle, found: [], elapsed: 0, hints: 0, done: false, stars: 0, created: Date.now() + Math.random(), ...extra };
}

/** Nächstes Thema aus einer gemischten Reihenfolge (alle Themen kommen dran, bevor sich eines wiederholt). */
function nextThemeId(avoid) {
  let rot = store.get(K.rot, null);
  const ids = themes.map((t) => t.id);
  if (!rot || !Array.isArray(rot.order) || rot.order.length !== ids.length || ids.some((id) => !rot.order.includes(id))) {
    rot = { order: makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0).shuffle(ids.slice()), pos: 0 };
  }
  let id = rot.order[rot.pos % rot.order.length];
  rot.pos++;
  if (id === avoid) { id = rot.order[rot.pos % rot.order.length]; rot.pos++; }
  store.set(K.rot, rot);
  return id;
}

/** Ist das nächste Rätsel das allererste? (kleines «Leicht»-Rätsel zum Einstieg) */
const isFirstGame = () => !(Number(store.get(K.seq, 0)) > 0) && !getStats().won;

/** Ein Wort aus der Liste nehmen und als geheimes Bonuswort verstecken. */
function withBonus(pz, seq) {
  const rng = makeRng(`ws-bonus|${pz.theme}|${seq}`);
  const cand = pz.words.map((p, i) => i).filter((i) => [...pz.words[i].w].length >= 4);
  if (pz.words.length < 5 || !cand.length) return pz;
  const i = rng.pick(cand);
  const [bonus] = pz.words.splice(i, 1);
  return { ...pz, bonus };
}

function createGame(modeId, themeId) {
  const base = modeById(modeId);
  const prev = store.get(K.game(modeId), null);
  const first = isFirstGame() && modeId === 'leicht';
  const theme = themeById(themeId) || (first && themeById(FIRST_THEME))
    || themeById(nextThemeId(prev && prev.puzzle && prev.puzzle.theme));
  const seq = store.update(K.seq, 0, (n) => (Number(n) || 0) + 1);
  const bonus = !first && isBonusSeq(seq);
  let mode = base;
  if (first) mode = { ...base, ...FIRST_MODE };
  else if (bonus) mode = { ...base, words: base.words.map((n) => n + 1) };
  let pz = generatePuzzle(theme, mode, seq);
  if (bonus) pz = withBonus(pz, seq);
  const st = newState(pz);
  store.set(K.game(modeId), st);
  const stats = getStats();
  stats.played++;
  setStats(stats);
  return st;
}

function dailyState() {
  const day = todayKey();
  let st = store.get(K.daily, null);
  if (!validState(st) || st.day !== day) {
    const theme = themes[dailyThemeIndex(day, themes.length)];
    st = newState(generatePuzzle(theme, modeById(DAILY_MODE), `wordsearch-${day}`), { daily: true, day });
    store.set(K.daily, st);
    const stats = getStats();
    stats.played++;
    setStats(stats);
  }
  return st;
}

function todaysDailyTheme() {
  const st = store.get(K.daily, null);
  if (validState(st) && st.day === todayKey()) return themeById(st.puzzle.theme);
  return themes[dailyThemeIndex(todayKey(), themes.length)];
}

function summaryText() {
  const s = getStats();
  const parts = [];
  if (s.won) parts.push(`${s.won} ${s.won === 1 ? 'Rätsel' : 'Rätsel'} gelöst`);
  if (s.stars) parts.push(`${s.stars} ★`);
  return parts.join(' · ') || 'Bereit zum Suchen';
}

/** Tagesrätsel als gelöst markieren – für den Tag, zu dem das Rätsel gehört (nicht den Tag des Lösens). */
function markDailySolved(day) {
  if (!day || day === todayKey()) { markDailyDone(ID); return; }
  // Rätsel von gestern nach Mitternacht beendet: diesen Tag eintragen, Serie korrekt weiterführen.
  store.set(`daily.${ID}.${day}`, true);
  const s = store.get(`dailyStreak.${ID}`, { last: null, count: 0 }) || { last: null, count: 0 };
  if (s.last === day || (s.last && s.last > day)) return;
  const [y, m, d] = day.split('-').map(Number);
  const before = todayKey(new Date(y, m - 1, d - 1));
  store.set(`dailyStreak.${ID}`, { last: day, count: s.last === before ? (s.count || 0) + 1 : 1 });
}

// ---------- App-Gerüst ----------

setupPage();
const app = document.getElementById('app');
let teardown = null;
let modalDepth = 0;

async function modal(opts) {
  modalDepth++;
  try { return await showModal(opts); } finally { modalDepth = Math.max(0, modalDepth - 1); }
}

function go(hash) {
  const url = location.pathname + location.search + (hash ? '#' + hash : '');
  history.replaceState(null, '', url);
  route();
}

function route() {
  if (teardown) { try { teardown(); } catch { /* ignore */ } teardown = null; }
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  if (name === 'play' && modeById(arg)) return showGame('play', arg);
  if (name === 'daily') return showGame('daily', DAILY_MODE);
  if (name === 'themen') return showThemes();
  return showMenu();
}
window.addEventListener('hashchange', route);

function screen(cls, ...children) {
  const el = h('div.screen.' + cls, null, ...children);
  app.replaceChildren(el);
  return el;
}

function helpButton() {
  const b = h('button.icon-btn', { type: 'button', 'aria-label': "So geht's", html: IC.help });
  b.addEventListener('click', () => showHowTo());
  return b;
}

// ---------- «So geht's» ----------

let tutorialOpen = null;
/** first=true: nur beim allerersten Start (maybeShowTutorial). Während es offen ist, steht die Zeit still. */
function showHowTo(first = false) {
  if (tutorialOpen) return tutorialOpen;
  modalDepth++;
  const opts = { id: ID, steps: tutorialSteps(modes), accent: ACCENT };
  tutorialOpen = (first ? maybeShowTutorial(opts) : showTutorial(opts))
    .finally(() => { modalDepth = Math.max(0, modalDepth - 1); tutorialOpen = null; });
  return tutorialOpen;
}

// ---------- Menü ----------

function logo() {
  // Je 9 Buchstaben pro Zeile; die Diagonale (0,0)→(2,2) ergibt «ROT» – jede Kapsel markiert ein echtes Wort.
  const top = 'ROSENDUFT', bottom = 'ENTDECKEN';
  const mid = 'WORTSUCHE';
  const g = h('div.logo', { 'aria-hidden': 'true' });
  const grid = h('div.logo-grid');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const ch = r === 1 ? mid[c] : (r === 0 ? top : bottom)[c];
      grid.append(h('span' + (r === 1 ? '.m' : ''), { style: { animationDelay: (r * 9 + c) * 22 + 'ms' } }, ch));
    }
  }
  g.append(h('div.logo-caps', { html: '<svg viewBox="0 0 9 3" preserveAspectRatio="none"><line class="lc1" x1=".5" y1="1.5" x2="3.5" y2="1.5"/><line class="lc2" x1="4.5" y1="1.5" x2="8.5" y2="1.5"/><line class="lc3" x1="0.5" y1="0.5" x2="2.5" y2="2.5"/></svg>' }), grid);
  return g;
}

/** Live-Vorschau des laufenden Rätsels (echtes Spielfeld, verkleinert) – Tipp darauf spielt weiter. */
function livePreview(st, modeId) {
  const pz = st.puzzle;
  const t = themeById(pz.theme) || { title: pz.theme, emoji: '🔤', group: 'natur' };
  const board = new Board(pz, {});
  board.setLocked(true);
  board.resize(Math.min(168, Math.max(132, pz.size * 15)));
  st.found.forEach((idx, ord) => board.addFound(idx, ord, false));
  if (pz.bonus && st.bonusFound) board.addBonus(pz.bonus);
  const n = pz.words.length, f = st.found.length;
  const el = h('button.ws-live', { type: 'button', 'aria-label': `${t.title} weiterspielen`, onclick: () => go('play/' + modeId) },
    board.el,
    h('span.ws-live-badge', null, t.emoji),
    h('span.ws-live-bar', null, vars(h('i'), { '--p': (f / n).toFixed(3) })));
  return vars(el, { '--g': themeColor(t) });
}

function heroArt(modeId) {
  const st = runningGame(modeId);
  return st ? livePreview(st, modeId) : logo();
}

const sizeLabel = (m) => (m.sizes.length > 1 ? `${m.sizes[0]}–${m.sizes[m.sizes.length - 1]}` : `${m.sizes[0]}×${m.sizes[0]}`);

function runningGame(modeId) {
  const st = store.get(K.game(modeId), null);
  return validState(st) && !st.done ? st : null;
}

function primaryFor(modeId) {
  const mode = modeById(modeId);
  const st = runningGame(modeId);
  if (st) {
    const t = themeById(st.puzzle.theme) || { title: st.puzzle.theme, emoji: '🔤' };
    const f = st.found.length, n = st.puzzle.words.length;
    const started = f || st.elapsed > 3000;
    return {
      label: started ? 'Weiterspielen' : 'Spielen',
      sub: started ? `${t.emoji} ${t.title} · ${f}/${n} Wörter · ${formatTime(st.elapsed)}`
        : `${t.emoji} ${t.title} · ${mode.title} · ${n} Wörter${st.puzzle.bonus ? ' · ✨ Bonus' : ''}`,
      onClick: () => go('play/' + modeId),
    };
  }
  const nextSeq = (Number(store.get(K.seq, 0)) || 0) + 1;
  let sub = `${mode.title} · ${mode.info}`;
  if (modeId === 'leicht' && isFirstGame()) {
    const t = themeById(FIRST_THEME);
    sub = `${t ? t.emoji + ' ' + t.title + ' · ' : ''}${mode.title} · ${FIRST_MODE.words[0]} Wörter`;
  } else if (isBonusSeq(nextSeq)) sub = `✨ Bonusrätsel · ${mode.title} · ${sizeLabel(mode)}`;
  return {
    label: 'Spielen',
    sub,
    onClick: () => { createGame(modeId); go('play/' + modeId); },
  };
}

function dailyInfo() {
  const t = todaysDailyTheme();
  const dSt = store.get(K.daily, null);
  const today = validState(dSt) && dSt.day === todayKey();
  const done = isDailyDone(ID);
  let sub = `${t.emoji} ${t.title}`;
  if (today && done && dSt.done) sub += ` · ${formatTime(dSt.elapsed)}`;
  else if (today && dSt.found.length) sub += ` · ${dSt.found.length}/${dSt.puzzle.words.length}`;
  return { done, sub, streak: dailyStreak(ID), onClick: () => go('daily') };
}

function secondaryFor(modeId) {
  return [
    { label: 'Themen', icon: 'grid', onClick: () => go('themen') },
    {
      label: 'Neu', icon: 'refresh',
      onClick: async () => {
        const st = runningGame(modeId);
        if (st && st.found.length && !(await confirmLeave())) return;
        createGame(modeId);
        go('play/' + modeId);
      },
    },
    { label: 'Statistik', icon: 'star', onClick: () => showStats() },
  ];
}

function menuStats() {
  const s = getStats();
  const streak = dailyStreak(ID);
  return [
    { label: 'Gelöst', value: s.won },
    { label: 'Sterne', value: s.stars + ' ★' },
    { label: 'Wörter', value: s.words },
    { label: 'Tagesserie', value: streak ? `🔥 ${streak}` : '0' },
  ];
}

const solvedTheme = (progress, t) => modes.some((m) => progress[t.id] && progress[t.id][m.id] && progress[t.id][m.id].w);
const themeStars = (progress, t) => Math.max(0, ...modes.map((m) => (progress[t.id] && progress[t.id][m.id] && progress[t.id][m.id].s) || 0));

/** Sammelalbum: jedes gelöste Thema leuchtet farbig auf. */
function albumSection() {
  const progress = getProgress();
  const got = themes.filter((t) => solvedTheme(progress, t)).length;
  const cells = themes.map((t) => {
    const ok = solvedTheme(progress, t);
    const el = h('span.al-cell' + (ok ? '.got' : '') + (ok && themeStars(progress, t) >= 3 ? '.gold' : ''), { title: t.title }, t.emoji);
    return vars(el, { '--g': themeColor(t) });
  });
  const card = h('button.card.album', { type: 'button', 'aria-label': 'Alle Themen', onclick: () => go('themen') },
    h('div.al-head', null,
      h('b', null, got ? `${got} von ${themes.length} Themen gesammelt` : `${themes.length} Themen zum Sammeln`),
      h('span.al-more', null, 'Alle', h('span', { html: IC.chevronDown }))),
    h('div.al-bar', null, vars(h('i'), { '--p': (got / themes.length).toFixed(3) })),
    h('div.al-grid', null, cells));
  return menuSection('Sammlung', card);
}

function showMenu() {
  reportSummary(ID, summaryText());
  const s = getSettings();
  const settingsCard = h('div.card.settings', null,
    toggleRow('Zeit anzeigen', 'showTimer'),
    toggleRow('Gefundene Wörter ans Listenende', 'sortFound'));
  const hero = h('div.ws-hero', null, heroArt(s.mode));
  const menu = gameMenu({
    id: ID,
    title: 'Wortsuche',
    tagline: `${themes.length} Themen · immer neue Rätsel`,
    accent: ACCENT,
    art: hero,
    primary: primaryFor(s.mode),
    daily: dailyInfo(),
    modes: {
      label: 'Schwierigkeit',
      value: s.mode,
      options: modes.map((m) => ({ id: m.id, label: m.title, sub: sizeLabel(m) })),
      onChange(id) {
        setSettings({ mode: id });
        hero.replaceChildren(heroArt(id));
        menu.update({ primary: primaryFor(id), secondary: secondaryFor(id) });
      },
    },
    secondary: secondaryFor(s.mode),
    stats: menuStats(),
    sections: [albumSection(), menuSection('Einstellungen', settingsCard)],
    onHelp: () => showHowTo(),
    backHref: '../',
  });
  menu.classList.add('ws-menu');
  app.replaceChildren(menu);
}

function toggleRow(label, key) {
  const input = h('input.switch', { type: 'checkbox', role: 'switch' });
  input.checked = !!getSettings()[key];
  input.addEventListener('change', () => setSettings({ [key]: input.checked }));
  return h('label.toggle-row', null, h('span', null, label), input);
}

function confirmLeave() {
  return modal({
    title: 'Neues Rätsel?',
    text: 'Das angefangene Rätsel dieser Stufe wird verworfen.',
    buttons: [{ label: 'Ja, neues Rätsel', value: true, primary: true }, { label: 'Abbrechen', value: false, ghost: true }],
  }).then((v) => v === true);
}

// ---------- Statistik ----------

async function showStats() {
  const s = getStats();
  const progress = getProgress();
  const solvedThemes = themes.filter((t) => solvedTheme(progress, t)).length;
  const streak = dailyStreak(ID);
  const tiles = [
    [s.won, 'Gelöst'], [s.words, 'Wörter gefunden'], [s.stars + ' ★', 'Sterne'],
    [`${solvedThemes}/${themes.length}`, 'Themen'], [s.perfect || 0, 'Ohne Tipp'], [s.bonus || 0, 'Bonuswörter'],
    [s.combo ? `×${s.combo}` : '–', 'Beste Kombo'], [streak ? `🔥 ${streak}` : '0', 'Tagesserie'], [formatTime(s.time || 0), 'Spielzeit'],
  ];
  const content = h('div.stats',
    null,
    h('div.stats-grid', null, tiles.map(([v, l]) => h('div.st-tile', null, h('b', null, String(v)), h('small', null, l)))),
    h('h3.stats-h', null, 'Bestzeiten'),
    h('div.best-list', null, [...modes, { id: 'daily', title: 'Tagesrätsel' }].map((m) =>
      h('div.best-row', null,
        h('span', null, m.title),
        h('span.wins', null, `${(s.wonBy && s.wonBy[m.id]) || 0}× gelöst`),
        h('b', null, s.best && s.best[m.id] ? formatTime(s.best[m.id]) : '–')))));
  const v = await modal({
    title: 'Statistik', content,
    buttons: [{ label: 'Schliessen', value: 'close', primary: true }, { label: 'Statistik zurücksetzen', value: 'reset', ghost: true }],
  });
  if (v === 'reset') {
    const ok = await modal({
      title: 'Wirklich zurücksetzen?',
      text: 'Alle Zahlen, Bestzeiten und Themen-Häkchen werden gelöscht. Laufende Rätsel bleiben.',
      buttons: [{ label: 'Zurücksetzen', value: true, primary: true }, { label: 'Abbrechen', value: false, ghost: true }],
    });
    if (ok) {
      setStats(defaultStats());
      store.set(K.progress, {});
      toast('Statistik zurückgesetzt');
      reportSummary(ID, summaryText());
      if (!location.hash || location.hash === '#') route();
    }
  }
}

// ---------- Themenkatalog ----------

function showThemes() {
  const back = backButton('#', () => go(''));
  const top = h('header.topbar', null, back, h('div.title', null, 'Themen'), soundButton());
  const body = h('div.scroll.themes');
  screen('themes-screen', top, body);

  const seg = h('div.seg.small');
  const progress = getProgress();
  const lists = [];
  const renderSeg = () => {
    const s = getSettings();
    seg.replaceChildren(...modes.map((m) => {
      const b = h('button.seg-btn' + (m.id === s.mode ? '.active' : ''), { type: 'button', 'data-mode': m.id }, h('b', null, m.title));
      b.addEventListener('click', () => { setSettings({ mode: m.id }); renderSeg(); renderTiles(); });
      return b;
    }));
  };
  const renderTiles = () => {
    const s = getSettings();
    for (const { grid, list } of lists) {
      grid.replaceChildren(...list.map((t) => {
        const p = progress[t.id] || {};
        const mine = p[s.mode];
        const tile = h('button.theme-tile', { type: 'button', 'data-theme': t.id },
          h('span.tt-emoji', null, t.emoji),
          h('span.tt-title', null, t.title),
          h('span.tt-meta', null,
            mine && mine.w ? h('span.tt-stars', { html: [1, 2, 3].map((i) => starSvg(i <= (mine.s || 0), 13)).join('') }) : h('span.tt-count', null, `${String(t.words).split(/\s+/).filter(Boolean).length} Wörter`)));
        vars(tile, { '--g': themeColor(t) });
        if (modes.some((m) => p[m.id] && p[m.id].w)) tile.classList.add('solved');
        tile.addEventListener('click', () => pickTheme(t));
        return tile;
      }));
    }
  };
  body.append(h('p.themes-intro', null, 'Tippe auf ein Thema – das Rätsel wird in der gewählten Stufe erzeugt.'), seg);
  for (const g of groups) {
    const list = themes.filter((t) => t.group === g.id);
    if (!list.length) continue;
    const grid = h('div.theme-grid');
    lists.push({ grid, list });
    body.append(h('h2.section-title', null, h('i.gdot', { style: { background: g.color } }), g.title, h('span.cnt', null, String(list.length))), grid);
  }
  body.append(h('p.foot', null, 'Mehr Themen? Siehe CONTENT.md – ein Eintrag genügt.'));
  renderSeg();
  renderTiles();
  body.scrollTop = store.get('wordsearch.themesScroll', 0) || 0;
  body.addEventListener('scroll', () => store.set('wordsearch.themesScroll', body.scrollTop), { passive: true });

  async function pickTheme(t) {
    const s = getSettings();
    const st = store.get(K.game(s.mode), null);
    if (validState(st) && !st.done && st.found.length && st.puzzle.theme !== t.id && !(await confirmLeave())) return;
    if (validState(st) && !st.done && st.puzzle.theme === t.id) { go('play/' + s.mode); return; }
    createGame(s.mode, t.id);
    go('play/' + s.mode);
  }
}

// ---------- Spiel ----------

function showGame(kind, modeId) {
  const settings = getSettings();
  let torn = false;
  let st;
  if (kind === 'daily') st = dailyState();
  else {
    st = store.get(K.game(modeId), null);
    if (!validState(st)) st = createGame(modeId);
  }
  const pz = st.puzzle;
  const mode = modeById(pz.mode) || modeById(modeId);
  const theme = themeById(pz.theme) || { id: pz.theme, title: pz.theme, emoji: '🔤', group: 'natur' };
  const total = pz.words.length;
  const foundSet = new Set(st.found);
  const storeKey = kind === 'daily' ? K.daily : K.game(modeId);
  const save = () => {
    // Nicht über ein inzwischen neu erzeugtes Rätsel derselben Stufe schreiben (z.B. «Nächstes Rätsel»).
    const cur = store.get(storeKey, null);
    if (cur && cur.created && st.created && cur.created !== st.created) return;
    store.set(storeKey, st);
  };

  // --- DOM ---
  const back = backButton('#', () => go(''));
  // Die Zeit steht klein unter dem Thema – so bleibt die ganze Breite für den Themennamen.
  const timerEl = h('span.timer' + (settings.showTimer ? '' : '.hidden'), { html: IC.clock + '<span>0:00</span>' });
  const timerTxt = timerEl.querySelector('span');
  const sub = kind === 'daily' ? (settings.showTimer ? 'Tagesrätsel' : `Tagesrätsel · ${mode.title}`) : mode.title;
  const titleB = h('b', null, theme.title);
  const title = h('div.g-title', null,
    vars(h('span.g-emoji', null, theme.emoji), { '--g': themeColor(theme) }),
    h('span.g-text', null, titleB, h('small', null, h('span.g-sub', null, sub), timerEl)));
  const top = h('header.topbar', null, back, title, helpButton());
  /** Sehr lange Themennamen: erst etwas kleiner, notfalls zweizeilig – nie abgeschnitten. */
  const fitTitle = () => {
    titleB.classList.remove('fit1', 'fit2');
    if (titleB.scrollWidth <= titleB.clientWidth + 1) return;
    titleB.classList.add('fit1');
    if (titleB.scrollWidth <= titleB.clientWidth + 1) return;
    titleB.classList.replace('fit1', 'fit2');
  };
  const pill = h('div.sel-pill');
  const praiseEl = h('div.praise', { 'aria-live': 'polite' });
  const boardWrap = h('div.board-wrap');
  const countEl = h('span.count');
  const chevron = h('span.wh-chev', { html: IC.chevronDown });
  const toggle = h('button.wh-toggle', { type: 'button', 'aria-label': 'Wortliste ein-/ausklappen' }, h('b', null, 'Wörter'), countEl, chevron);
  const hintBtn = h('button.btn.hint-btn', { type: 'button', html: IC.bulb + '<span>Tipp</span>' });
  const list = h('div.words-list');
  // «+N»-Hinweis, falls die Liste auf sehr kleinen Bildschirmen doch scrollen muss
  const cue = h('button.more-cue', { type: 'button', 'aria-label': 'Weitere Wörter zeigen' });
  cue.addEventListener('click', () => { list.scrollBy({ top: Math.max(40, list.clientHeight - 24), behavior: 'smooth' }); });
  const words = h('section.card.words' + (settings.listCollapsed ? '.collapsed' : ''), null,
    h('div.words-head', null, toggle, hintBtn), list, cue);
  const main = h('main.play-main', null, boardWrap, words);
  const root = screen('play-screen', top, main);
  root.style.setProperty('--accent-theme', themeColor(theme));

  // --- Brett ---
  const board = new Board(pz, {
    onSelect: (a, b) => onSelect(a, b),
    onStep: (cells) => {
      if (!cells.length || cells.length < 2) { pill.classList.remove('show'); return; }
      // Vorschau sitzt über dem Brett; bei Wörtern in den obersten Zeilen rutscht sie nicht ins Raster.
      pill.textContent = cells.map(({ r, c }) => [...pz.grid[r]][c]).join('');
      pill.classList.add('show');
      praiseEl.classList.remove('show');
      sfx.play('place');
    },
  });
  boardWrap.append(board.el, pill, praiseEl);
  st.found.forEach((idx, order) => board.addFound(idx, order, false));
  if (pz.bonus && st.bonusFound) board.addBonus(pz.bonus);

  // --- Wortliste ---
  const chips = pz.words.map((p, i) => {
    const el = h('span.wchip', { 'data-i': i }, p.label);
    return el;
  });
  // Bonusrätsel: geheimes Zusatzwort als «?»-Chip am Listenende
  let bonusChip = null;
  if (pz.bonus) {
    bonusChip = h('button.wchip.bonus', { type: 'button', 'aria-label': 'Bonuswort' });
    bonusChip.addEventListener('click', () => {
      if (st.bonusFound || st.done) return;
      toast('Ein geheimes Wort zum Thema versteckt sich im Raster – es bringt einen Extrastern.');
    });
  }
  const paintBonusChip = () => {
    if (!bonusChip) return;
    bonusChip.classList.toggle('found', !!st.bonusFound);
    bonusChip.classList.toggle('missed', !st.bonusFound && st.done);
    bonusChip.textContent = st.bonusFound || st.done ? '✨ ' + pz.bonus.label : '✨ Bonuswort ?';
  };
  const renderList = () => {
    const sortFound = getSettings().sortFound;
    const order = pz.words.map((_, i) => i);
    if (sortFound) order.sort((a, b) => (foundSet.has(a) - foundSet.has(b)) || a - b);
    st.found.forEach((idx, ord) => {
      chips[idx].classList.add('found');
      chips[idx].style.setProperty('--c', CAP_COLORS[ord % CAP_COLORS.length]);
    });
    list.replaceChildren(...order.map((i) => chips[i]));
    if (bonusChip) { paintBonusChip(); list.append(bonusChip); }
    countEl.textContent = `${st.found.length}/${total}`;
    updateCue();
  };
  let cueRaf = 0;
  function updateCue() {
    const open = !words.classList.contains('collapsed') && !words.classList.contains('done') && list.isConnected;
    const below = open ? list.scrollHeight - list.scrollTop - list.clientHeight : 0;
    let k = 0;
    if (below > 3) {
      const limit = list.scrollTop + list.clientHeight;
      for (const c of list.children) if (c.offsetTop + c.offsetHeight > limit + 1) k++;
    }
    list.classList.toggle('more', k > 0);
    cue.classList.toggle('show', k > 0);
    if (k > 0) cue.innerHTML = `<b>+${k}</b>${IC.chevronDown}`;
  }
  list.addEventListener('scroll', () => {
    if (!cueRaf) cueRaf = requestAnimationFrame(() => { cueRaf = 0; updateCue(); });
  }, { passive: true });
  renderList();

  toggle.addEventListener('click', () => {
    const c = !words.classList.contains('collapsed');
    words.classList.toggle('collapsed', c);
    setSettings({ listCollapsed: c });
    layout();
  });

  // --- Layout ---
  // Ziel: ganze Wortliste sichtbar, Brett so gross wie möglich. Reihenfolge:
  // 1) volle Breite mit normalen Wort-Chips, 2) kompaktere Chips, 3) Brett verkleinern
  // (bis ~24 px pro Feld), 4) erst dann scrollt die Liste (mit Verlauf und «+N»-Hinweis).
  const MIN_CELL = 24;
  const layout = () => {
    const cs = getComputedStyle(main);
    const W = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (W <= 0 || H <= 0) return;
    const gap = parseFloat(cs.rowGap) || 12;
    const maxS = Math.floor(Math.max(160, Math.min(W, 640, H - gap - 56)));
    const minS = Math.min(maxS, Math.ceil(pz.size * MIN_CELL + 18));
    words.style.flex = 'none';
    const fits = (S) => { words.style.width = S + 'px'; return S + gap + words.offsetHeight <= H; };
    let S = maxS;
    words.classList.remove('dense');
    if (!fits(S)) {
      words.classList.add('dense');
      if (!fits(S)) {
        if (!fits(minS)) S = minS;
        else {
          let lo = minS, hi = S;
          while (hi - lo > 2) { const mid = (lo + hi) >> 1; if (fits(mid)) lo = mid; else hi = mid; }
          S = lo;
        }
      }
    }
    words.style.flex = '';
    words.style.width = S + 'px';
    board.resize(S);
    fitTitle();
    updateCue();
  };
  const ro = new ResizeObserver(() => layout());
  ro.observe(main);
  layout();

  // --- Zeit ---
  let last = performance.now();
  let shownSec = -1;
  let saveCounter = 0;
  const tick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (!st.done && !document.hidden && modalDepth === 0 && dt < 5000) {
      st.elapsed += dt;
      if (++saveCounter >= 10) { saveCounter = 0; save(); }
    }
    const sec = Math.floor(st.elapsed / 1000);
    if (sec !== shownSec) { shownSec = sec; timerTxt.textContent = formatTime(st.elapsed); }
  };
  tick();
  const timer = setInterval(tick, 250);
  const onVis = () => {
    if (document.hidden) { tick(); save(); return; }
    last = performance.now();
    // Über Mitternacht offen gelassen: das angefangene Tagesrätsel von gestern durch das heutige ersetzen.
    if (kind === 'daily' && !st.done && st.day && st.day !== todayKey() && modalDepth === 0) {
      toast('Neuer Tag – neues Tagesrätsel!');
      route();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const onHide = () => { tick(); save(); };
  window.addEventListener('pagehide', onHide);

  const report = () => {
    if (st.done) reportSummary(ID, summaryText());
    else reportSummary(ID, `${kind === 'daily' ? 'Tagesrätsel' : theme.title}: ${st.found.length} von ${total} Wörtern`);
  };
  report();

  // --- Coach-Mark (nur beim allerersten Rätsel) ---
  let coachIdx = -1;
  if (!store.get(K.coach, false) && !st.found.length && !st.done) {
    const order = pz.words.map((p, i) => i)
      .sort((x, y) => (['E', 'S'].includes(pz.words[y].d) - ['E', 'S'].includes(pz.words[x].d)) || pz.words[x].w.length - pz.words[y].w.length);
    coachIdx = order[0];
    board.coach(coachIdx);
    chips[coachIdx].classList.add('coach');
  }
  const endCoach = () => {
    if (coachIdx < 0) return;
    board.clearCoach();
    chips[coachIdx].classList.remove('coach');
    coachIdx = -1;
    store.set(K.coach, true);
  };

  // --- Lob & Kombos ---
  let praiseTimer = 0;
  function praise(text, cls = '') {
    praiseEl.textContent = text;
    praiseEl.className = 'praise' + (cls ? ' ' + cls : '');
    void praiseEl.offsetWidth;
    praiseEl.classList.add('show');
    clearTimeout(praiseTimer);
    praiseTimer = setTimeout(() => praiseEl.classList.remove('show'), 1250);
  }
  let combo = 0;
  let lastFindAt = -Infinity;
  /** Nach jedem neuen Wort: Kombo zählen und passend loben (höchstens ein Lob pro Wort). */
  function cheer(p) {
    combo = st.elapsed - lastFindAt <= COMBO_MS ? combo + 1 : 1;
    lastFindAt = st.elapsed;
    if (combo > (st.combo || 0)) st.combo = combo;
    if (st.found.length === total) return;
    if (combo >= 2) praise(`${PRAISE[Math.min(combo, PRAISE.length - 1)]} ×${combo}`, combo >= 4 ? 'hot' : '');
    else if ([...p.w].length >= 8) praise('Starkes Wort!');
    else if (st.found.length === 1 && !getStats().won) praise('Sehr gut!');
    else if (st.found.length === Math.ceil(total / 2) && total >= 8) praise('Halbzeit!');
  }

  const rev = (x) => [...x].reverse().join('');
  function isBonus(a, b) {
    if (!pz.bonus || st.bonusFound) return false;
    const str = readLine(pz, a, b);
    return !!str && (str === pz.bonus.w || rev(str) === pz.bonus.w);
  }
  function foundBonus() {
    st.bonusFound = true;
    save();
    board.addBonus(pz.bonus, true);
    paintBonusChip();
    if (bonusChip) { bonusChip.classList.remove('just'); void bonusChip.offsetWidth; bonusChip.classList.add('just'); }
    praise('Bonuswort! +1 ★', 'gold');
    sfx.play('fill');
    setTimeout(() => sfx.play('sparkle'), 120);
  }

  // --- Auswahl ---
  function onSelect(a, b) {
    if (st.done) return false;
    endCoach();
    const m = matchSelection(pz, a, b, foundSet);
    if (!m) {
      if (isBonus(a, b)) { foundBonus(); return true; }
      sfx.play('tap');
      return false;
    }
    if (m.already) {
      board.flashFound(m.index);
      bounceChip(m.index);
      return true;
    }
    foundSet.add(m.index);
    st.found.push(m.index);
    if (st.hint && st.hint.word === m.index) { st.hint = null; board.clearHint(); chips[m.index].classList.remove('hinted'); }
    save();
    board.addFound(m.index, st.found.length - 1, true);
    sfx.play('fill');
    setTimeout(() => sfx.play('sparkle'), 110);
    const chip = chips[m.index];
    chip.style.setProperty('--c', CAP_COLORS[(st.found.length - 1) % CAP_COLORS.length]);
    chip.classList.add('found', 'just');
    countEl.textContent = `${st.found.length}/${total}`;
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    cheer(pz.words[m.index]);
    report();
    if (st.found.length === total) win();
    else if (getSettings().sortFound) setTimeout(() => { if (!torn) renderList(); }, 900);
    return true;
  }

  function bounceChip(i) {
    const c = chips[i];
    c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge');
  }

  // --- Tipp ---
  // Stufe 1: erster Buchstabe · Stufe 2: die ersten zwei · Stufe 3: ganzes Wort umrandet.
  // Die Markierung bleibt stehen, bis das Wort gefunden ist (auch nach dem Neuladen).
  const showHintUi = (wi, level, fresh) => {
    board.showHint(wi, level, fresh);
    chips.forEach((c, i) => c.classList.toggle('hinted', i === wi));
    if (fresh) bounceChip(wi);
  };
  hintBtn.addEventListener('click', () => {
    if (st.done) return;
    let wi, level;
    if (st.hint && !foundSet.has(st.hint.word)) {
      wi = st.hint.word;
      if ((st.hint.level || 1) >= 3) {
        // Ganzes Wort ist schon markiert: nochmals zeigen, kostet nichts.
        showHintUi(wi, 3, true);
        sfx.play('tap');
        return;
      }
      level = (st.hint.level || 1) + 1;
    } else {
      wi = pickHintWord(pz, foundSet);
      level = 1;
    }
    if (wi < 0) return;
    st.hint = { word: wi, level };
    st.hints++;
    save();
    showHintUi(wi, level, true);
    sfx.play('sparkle');
    hintBtn.classList.remove('used'); void hintBtn.offsetWidth; hintBtn.classList.add('used');
  });
  if (st.hint && !st.done && !foundSet.has(st.hint.word) && pz.words[st.hint.word]) showHintUi(st.hint.word, st.hint.level || 1, false);

  // --- Gewonnen ---
  async function win() {
    st.done = true;
    st.stars = Math.min(3, starsFor(mode, total, st.elapsed, st.hints) + (st.bonusFound ? 1 : 0));
    tick();
    save();
    const stats = getStats();
    const bestKey = kind === 'daily' ? 'daily' : mode.id;
    const prevBest = stats.best[bestKey];
    const isBest = !prevBest || st.elapsed < prevBest;
    stats.won++;
    stats.words += total;
    stats.stars += st.stars;
    stats.hints += st.hints;
    stats.time = (stats.time || 0) + st.elapsed;
    if (!st.hints) stats.perfect = (stats.perfect || 0) + 1;
    if (st.bonusFound) stats.bonus = (stats.bonus || 0) + 1;
    stats.combo = Math.max(stats.combo || 0, st.combo || 0);
    if (isBest) stats.best[bestKey] = Math.round(st.elapsed);
    stats.wonBy[bestKey] = (stats.wonBy[bestKey] || 0) + 1;
    setStats(stats);
    store.update(K.progress, {}, (p) => {
      const t = (p[theme.id] = p[theme.id] || {});
      const cur = t[mode.id] || { w: 0, s: 0 };
      t[mode.id] = { w: cur.w + 1, s: Math.max(cur.s || 0, st.stars) };
      return p;
    });
    if (kind === 'daily') markDailySolved(st.day);
    st.isBest = isBest && !!prevBest;
    save();
    report();
    board.setLocked(true);
    hintBtn.disabled = true;
    if (pz.bonus && !st.bonusFound) board.addBonus(pz.bonus, false, true);
    await sleep(350);
    if (torn) return;
    board.winWave();
    sfx.play('complete');
    celebrate(['#5a9e3c', '#9bd36a', '#ffd95a', '#ff8fa3', '#6db7ff', '#ffb35c']);
    await sleep(1150);
    if (torn) return;
    showResultPanel();
    winSheet();
  }

  function resultActions(primaryOnly) {
    const acts = [];
    if (kind === 'daily') {
      acts.push({ label: 'Zum Menü', value: 'menu', primary: true });
      acts.push({ label: 'Freies Spiel', value: 'free' });
    } else {
      acts.push({ label: 'Nächstes Rätsel', value: 'next', primary: true });
      if (!primaryOnly) acts.push({ label: 'Thema wählen', value: 'themes' });
      acts.push({ label: 'Zum Menü', value: 'menu', ghost: true });
    }
    return acts;
  }

  function doAction(v) {
    if (v === 'next') { createGame(mode.id); go('play/' + mode.id); }
    else if (v === 'themes') go('themen');
    else if (v === 'free') go('play/' + getSettings().mode);
    else if (v === 'menu') go('');
  }

  async function winSheet() {
    const titles = { 3: 'Perfekt!', 2: 'Super gemacht!', 1: 'Geschafft!' };
    const stars = h('div.win-stars', { html: [1, 2, 3].map((i) => starSvg(i <= st.stars, 44)).join('') });
    const stats = getStats();
    const bestKey = kind === 'daily' ? 'daily' : mode.id;
    const content = h('div.win', null,
      vars(h('div.win-badge', null, theme.emoji), { '--g': themeColor(theme) }),
      stars,
      h('div.win-grid', null,
        h('div', null, h('b', null, formatTime(st.elapsed)), h('small', null, 'Zeit')),
        h('div', null, h('b', null, String(st.hints)), h('small', null, st.hints === 1 ? 'Tipp' : 'Tipps')),
        h('div', null, h('b', null, formatTime(stats.best[bestKey] || st.elapsed)), h('small', null, 'Bestzeit'))),
      h('p.win-note', null, st.isBest ? '🏆 Neue Bestzeit!' : kind === 'daily' ? `Alle ${total} Wörter gefunden – morgen wartet ein neues Rätsel.` : `Alle ${total} Wörter zum Thema «${theme.title}» gefunden.`),
      pz.bonus ? h('p.win-bonus' + (st.bonusFound ? '.got' : ''), null,
        st.bonusFound ? `✨ Bonuswort «${pz.bonus.label}» gefunden – Extrastern!` : `Das Bonuswort war «${pz.bonus.label}».`) : null,
      st.combo >= 3 ? h('p.win-combo', null, `🔥 Beste Kombo: ${st.combo} Wörter in Serie`) : null);
    // Sterne nacheinander aufleuchten lassen
    [...stars.children].forEach((s, i) => {
      s.style.animationDelay = 250 + i * 220 + 'ms';
      if (i < st.stars) setTimeout(() => { if (!torn) sfx.play('pop'); }, 300 + i * 220);
    });
    const v = await modal({
      title: kind === 'daily' ? 'Tagesrätsel gelöst!' : titles[st.stars] || 'Geschafft!',
      content,
      buttons: resultActions(false),
      dismissible: false,
    });
    if (torn) return;
    doAction(v);
  }

  function showResultPanel() {
    words.classList.remove('collapsed');
    words.classList.add('done');
    const acts = resultActions(true).map((a) => {
      const b = h('button.btn' + (a.primary ? '.primary' : '') + (a.ghost ? '.ghost' : ''), { type: 'button' }, a.label);
      b.addEventListener('click', () => doAction(a.value));
      return b;
    });
    const res = h('div.result', null,
      h('div.res-line', null,
        h('span.res-stars', { html: [1, 2, 3].map((i) => starSvg(i <= st.stars, 22)).join('') }),
        h('b', null, kind === 'daily' ? 'Tagesrätsel gelöst' : 'Geschafft!'),
        h('span.res-time', null, formatTime(st.elapsed))),
      h('div.res-actions', null, acts));
    words.replaceChildren(res);
    layout();
  }

  if (st.done) {
    board.setLocked(true);
    hintBtn.disabled = true;
    if (pz.bonus && !st.bonusFound) board.addBonus(pz.bonus, false, true);
    showResultPanel();
  }

  // --- Test-Haken ---
  window.__wordsearch = {
    get state() { return st; },
    get puzzle() { return pz; },
    route: kind,
    cellCenter: (r, c) => board.cellCenterClient(r, c),
    select: (a, b) => onSelect(a, b),
    fitTitle: () => fitTitle(),
    layout: () => layout(),
    solveWord(i) { const p = pz.words[i]; const e = { r: p.r + (p.w.length - 1) * dirOf(p).dr, c: p.c + (p.w.length - 1) * dirOf(p).dc }; return onSelect({ r: p.r, c: p.c }, e); },
    solveAll() { pz.words.forEach((_, i) => { if (!foundSet.has(i)) this.solveWord(i); }); },
    solveBonus() { const p = pz.bonus; if (!p) return false; const d = dirOf(p); return onSelect({ r: p.r, c: p.c }, { r: p.r + ([...p.w].length - 1) * d.dr, c: p.c + ([...p.w].length - 1) * d.dc }); },
  };

  teardown = () => {
    torn = true;
    tick();
    save();
    clearInterval(timer);
    clearTimeout(praiseTimer);
    ro.disconnect();
    board.setLocked(true);
    board.clearHint();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onHide);
  };

}

function dirOf(p) {
  const m = { E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1], N: [-1, 0], NE: [-1, 1] }[p.d];
  return { dr: m[0], dc: m[1] };
}

route();
if (!tutorialSeen(ID)) showHowTo(true);
