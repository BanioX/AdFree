// Dreierlei – Einstieg und Routing.
//   #            Menü
//   #play        Level-Reihe (aktuelles Level, angefangenes wird fortgesetzt)
//   #level/12    geschafftes Level nochmal spielen
//   #free        Freies Spiel: Thema & Grösse wählen
//   #free/<thema>/<grösse>/<seed>   freies Spiel
//   #levels      Levelübersicht

import { setupPage } from '../shared/ui.js';
import { L as loc, lang, fmt } from '../shared/i18n.js';
import { themeById, themeShort, localizeThemes } from './data/themes.js';
import { generateLevel, generateFree, SIZES } from './logic/generator.js';
import { mountPlay } from './play.js';
import { mountMenu, mountFree, mountLevels, tagLabel, sizeTitle, tilesText } from './menu.js';
import { maybeShowHelp } from './howto.js';
import {
  loadProgress, saveProgress, updateStats, loadSave, writeSave, clearSave, updateSummary,
} from './progress.js';

setupPage();
localizeThemes(lang);
document.title = loc('Dreierlei – Spielpause', 'Triple Tiles – Spielpause');
const root = document.getElementById('app');
let current = null;

const nav = {
  /** Wechselt den Bildschirm, ohne den Browser-Verlauf zu verlängern. */
  go(hash) {
    const url = hash && hash !== '#' ? hash : location.pathname + location.search;
    history.replaceState(null, '', url);
    route();
  },
};

function newSeed() {
  return (Date.now() % 1e9).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function record(game, extra) {
  return updateStats((s) => {
    s.triples += game.triples;
    s.helpers += game.used;
    s.totalTime = (s.totalTime || 0) + game.elapsed;
    if (extra) extra(s);
  });
}

const levelText = (n) => fmt(loc('Level {n}', 'Level {n}'), { n });
const doneTitle = (n) => fmt(loc('Level {n} geschafft!', 'Level {n} complete!'), { n });
/** Lob unter den Sternen: perfekt (ohne Hilfen) oder sanfter Hinweis. */
const starNote = (stars) => (stars >= 3 ? loc('Perfekt – ganz ohne Hilfen!', 'Perfect – no helpers needed!') : loc('Ohne Hilfen gibt es 3 Sterne.', 'Win without helpers for 3 stars.'));

// ---------- Level-Reihe ----------

function startMain() {
  const prog = loadProgress();
  const L = prog.level;
  const level = generateLevel(L);
  const theme = themeById(level.theme);
  const save = loadSave('play');
  const saved = save && save.levelNo === L && save.seed === level.seed ? save.game : null;
  return mountPlay(root, {
    kind: 'play',
    level,
    saved,
    title: levelText(L),
    subtitle: theme.title,
    tag: tagLabel(level.tag) || theme.title,
    coach: L === 1,
    save: (g) => writeSave('play', { levelNo: L, seed: level.seed, game: g }),
    onStart: () => updateStats((s) => { s.played++; }),
    onLoss: () => updateStats((s) => { s.streak = 0; }),
    onWin: (game) => {
      const p = loadProgress();
      const stars = game.stars;
      p.stars[L] = Math.max(p.stars[L] | 0, stars);
      const prevBest = p.times[L];
      const isNewBest = prevBest != null && game.elapsed < prevBest;
      p.times[L] = prevBest != null ? Math.min(prevBest, Math.round(game.elapsed)) : Math.round(game.elapsed);
      if (p.level === L) p.level = L + 1;
      saveProgress(p);
      clearSave('play');
      const st = record(game, (s) => { s.won++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); });
      const next = generateLevel(L + 1);
      return {
        title: doneTitle(L),
        stars,
        isNewBest,
        streak: st.streak,
        note: starNote(stars),
        next: { symbol: next.symbols[0], theme: themeById(next.theme), tag: tagLabel(next.tag) },
        buttons: [
          { label: fmt(loc('Weiter zu Level {n}', 'On to level {n}'), { n: L + 1 }), value: 'next', primary: true },
          { label: loc('Zum Menü', 'Menu'), value: 'menu', ghost: true },
        ],
      };
    },
    onWinChoice: (v) => nav.go(v === 'next' ? '#play' : ''),
    restart: () => { clearSave('play'); nav.go('#play'); },
    menu: () => nav.go(''),
  });
}

// ---------- Geschafftes Level wiederholen ----------

function startReplay(L) {
  const prog = loadProgress();
  if (!(L >= 1 && L < prog.level)) { nav.go('#play'); return null; }
  const level = generateLevel(L);
  const theme = themeById(level.theme);
  const save = loadSave('level');
  const saved = save && save.levelNo === L && save.seed === level.seed ? save.game : null;
  return mountPlay(root, {
    kind: 'level',
    level,
    saved,
    title: levelText(L),
    subtitle: `${themeShort(theme)} · ${loc('Wiederholung', 'Replay')}`,
    tag: theme.title,
    save: (g) => writeSave('level', { levelNo: L, seed: level.seed, game: g }),
    onStart: () => updateStats((s) => { s.played++; }),
    onLoss: () => updateStats((s) => { s.streak = 0; }),
    onWin: (game) => {
      const p = loadProgress();
      const before = p.stars[L] | 0;
      const stars = game.stars;
      p.stars[L] = Math.max(before, stars);
      const prevBest = p.times[L];
      const isNewBest = prevBest != null && game.elapsed < prevBest;
      p.times[L] = prevBest != null ? Math.min(prevBest, Math.round(game.elapsed)) : Math.round(game.elapsed);
      saveProgress(p);
      clearSave('level');
      const st = record(game, (s) => { s.won++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); });
      const nextL = L + 1;
      return {
        title: doneTitle(L),
        stars,
        isNewBest,
        streak: st.streak,
        note: stars > before ? fmt(loc('Neuer Rekord: {n} Sterne!', 'New record: {n} stars!'), { n: stars }) : starNote(stars),
        buttons: [
          { label: nextL < p.level ? fmt(loc('Level {n} spielen', 'Play level {n}'), { n: nextL }) : fmt(loc('Weiter zu Level {n}', 'On to level {n}'), { n: p.level }), value: 'next', primary: true },
          { label: loc('Levelübersicht', 'All levels'), value: 'levels' },
          { label: loc('Zum Menü', 'Menu'), value: 'menu', ghost: true },
        ],
      };
    },
    onWinChoice: (v) => {
      const p = loadProgress();
      if (v === 'next') nav.go(L + 1 < p.level ? `#level/${L + 1}` : '#play');
      else if (v === 'levels') nav.go('#levels');
      else nav.go('');
    },
    restart: () => { clearSave('level'); nav.go(`#level/${L}`); },
    menu: () => nav.go(''),
  });
}

// ---------- Freies Spiel ----------

function startFree(themeId, sizeId, seed) {
  const theme = themeById(themeId);
  if (!theme || !SIZES[sizeId] || !seed) { nav.go('#free'); return null; }
  const level = generateFree(themeId, sizeId, seed);
  const save = loadSave('free');
  const saved = save && save.theme === themeId && save.size === sizeId && save.seed === seed ? save.game : null;
  return mountPlay(root, {
    kind: 'free',
    level,
    saved,
    title: themeShort(theme),
    bannerTitle: theme.title,
    subtitle: `${loc('Freies Spiel', 'Free play')} · ${sizeTitle(sizeId)}`,
    tag: `${sizeTitle(sizeId)} · ${tilesText(level.tiles.length)}`,
    save: (g) => writeSave('free', { theme: themeId, size: sizeId, seed, game: g }),
    onStart: () => updateStats((s) => { s.freePlayed++; }),
    onLoss: () => updateStats((s) => { s.streak = 0; }),
    onWin: (game) => {
      let isNewBest = false;
      clearSave('free');
      const st = record(game, (s) => {
        s.freeWon++;
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        const prev = s.freeBest[sizeId];
        isNewBest = prev != null && game.elapsed < prev;
        s.freeBest[sizeId] = prev != null ? Math.min(prev, Math.round(game.elapsed)) : Math.round(game.elapsed);
      });
      return {
        title: loc('Geschafft!', 'Well done!'),
        stars: game.stars,
        isNewBest,
        streak: st.streak,
        note: game.stars >= 3 ? starNote(3) : null,
        buttons: [
          { label: loc('Neues Spiel', 'New game'), value: 'again', primary: true },
          { label: loc('Anderes Thema', 'Other theme'), value: 'free' },
          { label: loc('Zum Menü', 'Menu'), value: 'menu', ghost: true },
        ],
      };
    },
    onWinChoice: (v) => {
      if (v === 'again') nav.go(`#free/${themeId}/${sizeId}/${newSeed()}`);
      else if (v === 'free') nav.go('#free');
      else nav.go('');
    },
    restart: () => { clearSave('free'); nav.go(`#free/${themeId}/${sizeId}/${seed}`); },
    menu: () => nav.go(''),
  });
}

// ---------- Router ----------

function route() {
  if (current && current.destroy) {
    try { current.destroy(); } catch { /* ignore */ }
  }
  current = null;
  root.removeAttribute('style');
  let parts;
  try { parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); } catch { parts = ['']; }
  let screen = null;
  switch (parts[0]) {
    case 'play': screen = startMain(); break;
    case 'level': screen = startReplay(parseInt(parts[1], 10)); break;
    case 'free':
      screen = parts.length >= 4 ? startFree(parts[1], parts[2], parts[3]) : mountFree(root, nav);
      break;
    case 'levels': screen = mountLevels(root, nav); break;
    case 'daily': // Dreierlei hat kein Tagesrätsel – zur Level-Reihe
      nav.go('#play');
      return;
    default: screen = mountMenu(root, nav);
  }
  // Bei Umleitungen (nav.go innerhalb von start…) hat der innere Aufruf «current» schon gesetzt
  if (screen) current = screen;
}

window.addEventListener('hashchange', route);
updateSummary();
route();
// Beim allerersten Start: «So geht's» (liegt über Menü bzw. Spiel)
maybeShowHelp();
