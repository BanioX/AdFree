// Startbildschirm (shared/gamemenu.js): Modus (Klassisch 8×8 / 10×10 / Abenteuer), grosser
// Spielen/Weiter-Knopf, Nebenknöpfe, Kennzahlen, aktuelle Welt und Aussehen.

import { h, icon, confirmDialog } from '../../shared/ui.js';
import { gameMenu, menuSection } from '../../shared/gamemenu.js';
import { getLevel, worldOf, goalTypeOf, goalLabel } from '../core/levels.js';
import { LEVELS_PER_WORLD } from '../data/worlds.js';
import { pictures } from '../data/pictures.js';
import { Board } from '../core/board.js';
import { miniBoard, showStats, showAlbum, skinPicker } from './sheets.js';
import { showHelp } from './tutorial.js';
import {
  getSettings, saveSettings, currentSkin, loadClassic, saveClassic, loadLevelSave, getAdv, totalStars,
  getStats, recordClassicGame, updateSummary,
} from './progress.js';
import { Game } from '../core/game.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-CH');

export const GOAL_EMOJI = { gems: '💎', picture: '🖼️', lines: '🧱', score: '🎯' };

function heroArt(skin) {
  const wrap = h('div.hero-art');
  const board = miniBoard(skin, ['.......', '6.....0', '6.5..30', '61...30'], 24);
  const piece = miniBoard(skin, ['222'], 24, { noBg: true });
  piece.classList.add('hero-piece');
  wrap.append(board, piece);
  return wrap;
}

/** Vorschau eines gespeicherten Bretts (Live-Titelbild). */
function boardPreview(skin, saved) {
  try {
    const b = Board.deserialize(saved.board);
    const rows = [];
    for (let r = 0; r < b.n; r++) {
      let line = '';
      for (let c = 0; c < b.n; c++) {
        const i = r * b.n + c;
        const g = b.gems[i] ? 'rbgyp'[b.gems[i] - 1] : null;
        line += g || (b.cells[i] ? String(b.cells[i] - 1) : '.');
      }
      rows.push(line);
    }
    const wrap = h('div.hero-art.preview');
    wrap.append(miniBoard(skin, rows, b.n === 10 ? 13 : 16));
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
      art = saved ? boardPreview(skin, saved) : heroArt(skin);
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
            if (g && !raw.counted) recordClassicGame(g);
            saveClassic(size, null);
            nav.classic(size);
          },
        });
      }
      secondary.push({ label: 'Statistik', icon: 'star', onClick: showStats });
      kpis = [
        { label: 'Rekord', value: c.best ? fmt(c.best) : '–' },
        { label: 'Spiele', value: fmt(c.played) },
        { label: 'Beste Kombo', value: c.bestCombo ? `${c.bestCombo}×` : '–' },
        { label: 'Längste Serie', value: c.bestStreak ? `${c.bestStreak}×` : '–' },
      ];
    } else {
      const sv = loadLevelSave();
      const resume = sv && !sv.won && sv.moves > 0 && sv.level <= adv.max ? sv.level : null;
      const n = resume || adv.max;
      const lv = getLevel(n);
      const type = goalTypeOf(n);
      const what = lv.title || goalLabel(type);
      art = resume ? boardPreview(skin, sv) : heroArt(skin);
      primary = resume
        ? { label: 'Weiterspielen', sub: `Level ${n} · ${what}`, onClick: () => nav.level(n) }
        : { label: n > 1 ? `Weiter – Level ${n}` : 'Spielen', sub: `${GOAL_EMOJI[type]} ${what}`, onClick: () => nav.level(n) };
      secondary = [
        { label: 'Levelkarte', icon: 'grid', onClick: () => nav.map() },
        { label: 'Album', icon: 'image', onClick: showAlbum },
        { label: 'Statistik', icon: 'star', onClick: showStats },
      ];
      kpis = [
        { label: 'Level', value: fmt(adv.max) },
        { label: 'Sterne', value: fmt(totalStars(adv)) },
        { label: 'Bilder', value: `${adv.pics.length}/${pictures.length}` },
        { label: 'Edelsteine', value: fmt(adv.gems) },
      ];
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
          { id: 'classic8', label: 'Klassisch', sub: '8×8' },
          { id: 'classic10', label: 'Klassisch', sub: '10×10' },
          { id: 'adventure', label: 'Abenteuer', sub: `Level ${adv.max}` },
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
