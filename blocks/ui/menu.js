// Startbildschirm: Modus wählen (Klassisch / Abenteuer), grosser Spielen/Weiter-Knopf, Statistik usw.

import { h, icon, soundButton, backButton, confirmDialog } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';
import { getLevel, worldOf, goalTypeOf, goalLabel } from '../core/levels.js';
import { LEVELS_PER_WORLD } from '../data/worlds.js';
import { Board } from '../core/board.js';
import { miniBoard, showHelp, showStats, showSkins, showAlbum } from './sheets.js';
import {
  getSettings, saveSettings, currentSkin, loadClassic, saveClassic, loadLevelSave, getAdv, totalStars,
  bestScore, recordClassicGame, updateSummary, SIZES,
} from './progress.js';
import { Game } from '../core/game.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-CH');

export const GOAL_EMOJI = { gems: '💎', picture: '🖼️', lines: '🧱', score: '🎯' };

function heroArt(skin) {
  const wrap = h('div.hero-art');
  const board = miniBoard(skin, ['.......', '6.....0', '6.5..30', '61...30'], 26);
  const piece = miniBoard(skin, ['222'], 26, { noBg: true });
  piece.classList.add('hero-piece');
  wrap.append(board, piece);
  return wrap;
}

/** Vorschau eines gespeicherten Bretts. */
function boardPreview(skin, saved) {
  try {
    const b = Board.deserialize(saved.board);
    const rows = [];
    for (let r = 0; r < b.n; r++) {
      let line = '';
      for (let c = 0; c < b.n; c++) {
        const i = r * b.n + c;
        line += b.cells[i] ? String(b.cells[i] - 1) : '.';
      }
      rows.push(line);
    }
    return miniBoard(skin, rows, b.n === 10 ? 6 : 7.5);
  } catch {
    return null;
  }
}

export function mountMenu(app, nav) {
  const st = getSettings();
  let tab = st.tab;
  let size = st.size;
  const skin = currentSkin();
  updateSummary();

  app.className = 'app blocks-menu';
  app.innerHTML = '';
  const top = h('header.topbar', null,
    backButton('../'),
    h('div.title', null, 'Blockpuzzle'),
    soundButton());

  const seg = h('div.segmented', { role: 'tablist' });
  const tabs = [['classic', 'Klassisch'], ['adventure', 'Abenteuer']].map(([id, label]) => {
    const b = h('button', { type: 'button', role: 'tab', 'data-tab': id }, label);
    b.addEventListener('click', () => {
      if (tab === id) return;
      sfx.play('click');
      tab = id;
      saveSettings({ tab });
      render();
    });
    seg.append(b);
    return b;
  });

  const panel = h('div.mode-panel');
  const playBtn = h('button.btn.primary.block.play-btn', { type: 'button' });
  const secondRow = h('div.second-row');

  const tile = (ic, label, fn) => {
    const b = h('button.menu-tile', { type: 'button' }, h('span.mt-ic', { html: icon(ic, { size: 24 }) }), h('span', null, label));
    b.addEventListener('click', () => { sfx.play('click'); fn(); });
    return b;
  };
  const tiles = h('div.menu-tiles', null,
    tile('grid', 'Statistik', showStats),
    tile('image', 'Album', showAlbum),
    tile('sparkle', 'Aussehen', () => showSkins(() => nav.reload())),
    tile('hint', 'So geht\'s', showHelp));

  const main = h('main.menu', null,
    h('section.hero', null, heroArt(skin), h('p.hero-sub', null, 'Teile setzen, Linien füllen, abräumen.')),
    seg, panel, playBtn, secondRow, tiles);
  app.append(top, h('div.scroll', null, main));

  function render() {
    for (const b of tabs) b.classList.toggle('active', b.dataset.tab === tab);
    seg.classList.toggle('right', tab === 'adventure');
    panel.innerHTML = '';
    secondRow.innerHTML = '';
    if (tab === 'classic') renderClassic();
    else renderAdventure();
  }

  function renderClassic() {
    const raw = loadClassic(size);
    const saved = raw && !raw.over && raw.moves > 0 ? raw : null;
    const chips = h('div.size-chips', null, ...SIZES.map((sz) => {
      const b = h('button.chip' + (sz === size ? '.active' : ''), { type: 'button' }, `${sz}×${sz}`);
      b.addEventListener('click', () => {
        if (sz === size) return;
        sfx.play('click');
        size = sz;
        saveSettings({ size });
        render();
      });
      return b;
    }));
    const best = bestScore(size);
    const card = h('div.mode-card', null,
      h('div.mode-row', null,
        h('div.kv', null, h('small', null, 'Rekord'), h('b', null, best ? fmt(best) : '–')),
        h('div.kv', null, h('small', null, 'Brett'), chips)));
    if (saved) {
      const prev = boardPreview(skin, saved);
      card.append(h('div.saved', null, prev, h('div.saved-text', null, h('small', null, 'Angefangenes Spiel'), h('b', null, `${fmt(saved.score)} Punkte`))));
    } else {
      card.append(h('p.mode-desc', null, 'Endlos spielen und Punkte sammeln. Mehrere Linien auf einmal geben Kombo-Punkte, Abräumen Zug um Zug eine Serie.'));
    }
    panel.append(card);
    playBtn.innerHTML = icon('play', { size: 22 });
    playBtn.append(document.createTextNode(saved ? 'Weiter' : 'Spielen'));
    playBtn.onclick = () => { sfx.play('click'); nav.classic(size); };
    if (saved) {
      const nb = h('button.btn.ghost', { type: 'button' }, 'Neues Spiel');
      nb.addEventListener('click', async () => {
        if (!(await confirmDialog('Neues Spiel?', 'Das angefangene Spiel wird beendet.', 'Neues Spiel'))) return;
        const g = Game.deserialize(raw);
        if (g && !raw.counted) recordClassicGame(g);
        saveClassic(size, null);
        nav.classic(size);
      });
      secondRow.append(nb);
    }
  }

  function renderAdventure() {
    const a = getAdv();
    const sv = loadLevelSave();
    const resume = sv && !sv.won && sv.moves > 0 && sv.level <= a.max ? sv.level : null;
    const n = resume || a.max;
    const w = worldOf(n);
    let doneInWorld = 0;
    for (let i = w.first; i <= w.last; i++) if (a.stars[i]) doneInWorld++;
    const type = goalTypeOf(n);
    const lv = getLevel(n);
    const card = h('div.mode-card.adv', { style: { '--world': w.data.color, '--tint': w.data.tint } },
      h('div.world-row', null,
        h('span.world-emoji', null, w.data.emoji),
        h('div.kv', null, h('small', null, `Welt ${w.index + 1}`), h('b', null, w.title)),
        h('span.star-total', { html: `${icon('star', { size: 16 })}<b>${totalStars(a)}</b>` })),
      h('div.progress', null, h('i', { style: { width: `${(100 * doneInWorld) / LEVELS_PER_WORLD}%` } })),
      h('p.next-level', null,
        h('span.goal-emoji', null, GOAL_EMOJI[type]),
        h('span', null, h('b', null, `Level ${n}`), ` · ${lv.title || goalLabel(type)}`)));
    panel.append(card);
    playBtn.innerHTML = icon('play', { size: 22 });
    playBtn.append(document.createTextNode(resume ? 'Weiter' : 'Spielen'));
    playBtn.onclick = () => { sfx.play('click'); nav.level(n); };
    const mb = h('button.btn.ghost', { type: 'button' });
    mb.innerHTML = icon('grid', { size: 18 });
    mb.append(document.createTextNode('Levelkarte'));
    mb.addEventListener('click', () => { sfx.play('click'); nav.map(); });
    secondRow.append(mb);
  }

  render();
  return { destroy() {} };
}
