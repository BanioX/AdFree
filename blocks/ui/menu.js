// Startbildschirm (shared/gamemenu.js): Live-Vorschau des nächsten Levels bzw. Spielstands,
// grosser Spielen/Weiter-Knopf, Modus (Abenteuer / Klassisch 8×8 / 10×10), Nebenknöpfe,
// Kennzahlen, aktuelle Welt und Aussehen.

import { h, icon, confirmDialog } from '../../shared/ui.js';
import { gameMenu, menuSection } from '../../shared/gamemenu.js';
import { getLevel, worldOf, goalTypeOf, goalLabel } from '../core/levels.js';
import { LEVELS_PER_WORLD } from '../data/worlds.js';
import { pictures } from '../data/pictures.js';
import { Board } from '../core/board.js';
import { miniBoard, showStats, showAlbum, skinPicker } from './sheets.js';
import { gemIconUrl } from './sprites.js';
import { showHelp } from './tutorial.js';
import {
  getSettings, saveSettings, currentSkin, loadClassic, saveClassic, loadLevelSave, getAdv, totalStars,
  getStats, recordClassicGame, countedOf, updateSummary,
} from './progress.js';
import { Game } from '../core/game.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-CH');

export const GOAL_EMOJI = { gems: '💎', picture: '🖼️', lines: '🧱', score: '🎯' };

/** Brett als Zeichenzeilen für miniBoard (Steine, Edelsteine, verdeckte Bildfelder). */
function boardRows(b) {
  const rows = [];
  for (let r = 0; r < b.n; r++) {
    let line = '';
    for (let c = 0; c < b.n; c++) {
      const i = r * b.n + c;
      if (b.gems[i]) line += 'rbgyp'[b.gems[i] - 1];
      else if (b.cells[i]) line += String(b.cells[i] - 1);
      else line += b.cover[i] ? ',' : '.';
    }
    rows.push(line);
  }
  return rows;
}

/** Titelbild ohne Spielstand: kleines Brett, ein Teil schwebt darüber. */
function heroArt(skin) {
  const wrap = h('div.hero-art');
  const board = miniBoard(skin, ['.......', '6.....0', '6.5..30', '61...30'], 24);
  const piece = miniBoard(skin, ['222'], 24, { noBg: true });
  piece.classList.add('hero-piece');
  wrap.append(board, piece);
  return wrap;
}

/** Ziel-Abzeichen wie im Spiel (Edelstein-Symbol, Bild, Linien, Punkte) mit Anzahl. */
function goalBadge(status) {
  const badge = h('div.hero-goals');
  for (const g of status.slice(0, 3)) {
    let ic;
    if (g.type === 'gems') ic = h('img', { src: gemIconUrl(g.key, 28), alt: '' });
    else if (g.type === 'picture') ic = h('span.hg-txt', null, '🖼️');
    else if (g.type === 'lines') ic = h('span.hg-txt', null, '🧱');
    else ic = h('span.hg-txt', null, '🎯');
    const n = g.type === 'picture' ? '?' : fmt(g.need - g.have);
    badge.append(h('span.hg', null, ic, h('b', null, n)));
  }
  return badge;
}

/** Live-Titelbild: das Brett des Spielstands bzw. des nächsten Levels, mit Ziel-Abzeichen. */
function boardPreview(skin, boardData, status) {
  try {
    const b = Board.deserialize(boardData);
    const wrap = h('div.hero-art.preview');
    wrap.append(miniBoard(skin, boardRows(b), b.n === 10 ? 13 : 16));
    if (status && status.length) wrap.append(goalBadge(status));
    return wrap;
  } catch {
    return heroArt(skin);
  }
}

export function mountMenu(app, nav) {
  updateSummary();
  app.className = 'app blocks-menu';
  let menu = null;

  function modeId() {
    const st = getSettings();
    return st.tab === 'adventure' ? 'adventure' : `classic${st.size}`;
  }

  function build() {
    const skin = currentSkin();
    const mode = modeId();
    const adv = getAdv();
    const stats = getStats();
    let primary, art, secondary, kpis;
    const sections = [];

    if (mode !== 'adventure') {
      const size = getSettings().size;
      const raw = loadClassic(size);
      const saved = raw && !raw.over && raw.moves > 0 ? raw : null;
      const c = stats.classic[size];
      art = saved ? boardPreview(skin, saved.board) : heroArt(skin);
      primary = saved
        ? { label: 'Weiterspielen', sub: `${fmt(saved.score)} Punkte · ${size}×${size}`, onClick: () => nav.classic(size) }
        : { label: 'Spielen', sub: `Klassisch ${size}×${size}${c.best ? ` · Rekord ${fmt(c.best)}` : ''}`, onClick: () => nav.classic(size) };
      secondary = [];
      if (saved) {
        secondary.push({
          label: 'Neues Spiel', icon: 'plus',
          onClick: async () => {
            if (!(await confirmDialog('Neues Spiel?', 'Das angefangene Spiel wird beendet.', 'Neues Spiel'))) return;
            const g = Game.deserialize(raw);
            if (g) recordClassicGame(g, countedOf(raw));
            saveClassic(size, null);
            nav.classic(size);
          },
        });
      }
      secondary.push({ label: 'Statistik', icon: 'star', onClick: showStats });
      // Kennzahlen erst, wenn es etwas zu zeigen gibt (keine Reihe voller Striche beim ersten Mal)
      kpis = c.played > 0 ? [
        { label: 'Rekord', value: c.best ? fmt(c.best) : '–' },
        { label: 'Spiele', value: fmt(c.played) },
        { label: 'Beste Kombo', value: c.bestCombo ? `${c.bestCombo}×` : '–' },
        { label: 'Längste Serie', value: c.bestStreak ? `${c.bestStreak}×` : '–' },
      ] : null;
    } else {
      const sv = loadLevelSave();
      const resume = sv && !sv.won && sv.moves > 0 && sv.level <= adv.max ? sv.level : null;
      const n = resume || adv.max;
      const lv = getLevel(n);
      const type = goalTypeOf(n);
      const what = lv.title || goalLabel(type);
      let status = null;
      try {
        const g = resume ? Game.deserialize(sv) : Game.fromLevel(lv);
        status = g ? g.goalStatus() : null;
      } catch { status = null; }
      art = boardPreview(skin, resume ? sv.board : lv.board, status);
      art.classList.add('lv-preview');
      art.style.setProperty('--world', worldOf(n).data.color);
      primary = {
        label: resume ? 'Weiterspielen' : n > 1 ? 'Weiter' : 'Spielen',
        sub: `Level ${n} · ${what}`,
        onClick: () => nav.level(n),
      };
      secondary = [
        { label: 'Karte', icon: 'grid', onClick: () => nav.map() },
        { label: 'Album', icon: 'image', onClick: showAlbum },
        { label: 'Statistik', icon: 'star', onClick: showStats },
      ];
      kpis = adv.wins > 0 ? [
        { label: 'Level', value: fmt(adv.max) },
        { label: 'Sterne', value: fmt(totalStars(adv)) },
        { label: 'Bilder', value: `${adv.pics.length}/${pictures.length}` },
        { label: 'Edelsteine', value: fmt(adv.gems) },
      ] : null;
      // aktuelle Welt
      const w = worldOf(n);
      let doneInWorld = 0, starsInWorld = 0;
      for (let i = w.first; i <= w.last; i++) if (adv.stars[i]) { doneInWorld++; starsInWorld += adv.stars[i]; }
      const card = h('button.menu-world', { type: 'button', style: `--world:${w.data.color};--tint:${w.data.tint}`, 'aria-label': `Welt ${w.index + 1}: ${w.title}` },
        h('span.world-emoji', null, w.data.emoji),
        h('span.world-info', null,
          h('small', null, `Welt ${w.index + 1} · Level ${w.first}–${w.last}`),
          h('b', null, w.title),
          h('span.progress', null, h('i', { style: { width: `${(100 * doneInWorld) / LEVELS_PER_WORLD}%` } }))),
        h('span.star-total', { html: `${icon('star', { size: 15 })}<b>${starsInWorld}</b>` }));
      card.addEventListener('click', () => nav.map());
      sections.push(menuSection('Aktuelle Welt', card));
    }

    sections.push(menuSection('Aussehen', skinPicker(() => rebuild())));

    const m = gameMenu({
      id: 'blocks',
      title: 'Blockpuzzle',
      tagline: 'Teile setzen, Linien füllen, abräumen',
      accent: '#f0a020',
      art,
      primary,
      modes: {
        label: 'Modus',
        value: mode,
        options: [
          { id: 'adventure', label: 'Abenteuer', sub: `Level ${adv.max}` },
          { id: 'classic8', label: 'Klassisch', sub: '8×8' },
          { id: 'classic10', label: 'Klassisch', sub: '10×10' },
        ],
        onChange(id) {
          if (id === 'adventure') saveSettings({ tab: 'adventure' });
          else saveSettings({ tab: 'classic', size: id === 'classic10' ? 10 : 8 });
          rebuild();
        },
      },
      secondary,
      stats: kpis,
      sections,
      onHelp: () => showHelp(),
      backHref: '../',
    });
    return m;
  }

  function rebuild() {
    const y = menu ? menu.scroller.scrollTop : 0;
    menu = build();
    app.replaceChildren(menu);
    menu.scroller.scrollTop = y;
  }

  rebuild();
  return { destroy() {} };
}
