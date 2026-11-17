// Dialoge: So geht's, Statistik, Aussehen, Album.

import { h, icon, showModal } from '../../shared/ui.js';
import { skins } from '../data/skins.js';
import { pictures } from '../data/pictures.js';
import { blockSprite, gemSprite, coverSprite, roundRect } from './sprites.js';
import { renderPicture } from './picture.js';
import { getStats, getAdv, totalStars, getSettings, saveSettings, currentSkin, SIZES } from './progress.js';
import { GEM_KEYS } from '../data/skins.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-CH');

/**
 * Kleines Brett als Canvas: rows = Zeichen pro Feld:
 *  '.' leer, '0'–'7' Stein, 'r','b',… Edelstein auf Stein, 'w' heller Blitz-Stein, ',' verdeckt (Bild), '_' nichts
 */
export function miniBoard(skin, rows, cs = 16, opts = {}) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const n = rows.length, m = Math.max(...rows.map((r) => r.length));
  const pad = Math.round(cs * 0.2);
  const W = m * cs + pad * 2, H = n * cs + pad * 2;
  const c = h('canvas.mini-board');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  c.style.width = W + 'px';
  c.style.height = H + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!opts.noBg) {
    roundRect(ctx, 0, 0, W, H, pad * 2);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skin.board.bg[0]);
    g.addColorStop(1, skin.board.bg[1]);
    ctx.fillStyle = g;
    ctx.fill();
  }
  const gemColor = { r: 0, b: 5, g: 3, y: 2, p: 6 };
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < m; col++) {
      const ch = rows[r][col] || '_';
      const x = pad + col * cs, y = pad + r * cs;
      if (ch === '_') continue;
      if (ch === '.' || ch === ':') {
        roundRect(ctx, x + cs * 0.06, y + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.18);
        ctx.fillStyle = skin.board.cell;
        ctx.fill();
        if (ch === ':') {
          ctx.globalAlpha = 0.45;
          ctx.drawImage(blockSprite(skin, opts.ghost ?? 3, cs, dpr), x, y, cs, cs);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      if (ch === ',') {
        ctx.drawImage(coverSprite(skin, cs, dpr), x, y, cs, cs);
        continue;
      }
      if (ch === 'w') {
        ctx.drawImage(blockSprite(skin, opts.flash ?? 2, cs, dpr), x, y, cs, cs);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(blockSprite(skin, 'white', cs, dpr), x, y, cs, cs);
        ctx.globalAlpha = 1;
        continue;
      }
      if (GEM_KEYS.includes(ch)) {
        ctx.drawImage(blockSprite(skin, gemColor[ch], cs, dpr), x, y, cs, cs);
        ctx.drawImage(gemSprite(ch, cs, dpr), x, y, cs, cs);
        continue;
      }
      const idx = Math.max(0, Math.min(7, ch.charCodeAt(0) - 48));
      ctx.drawImage(blockSprite(skin, idx, cs, dpr), x, y, cs, cs);
    }
  }
  return c;
}

// ---------- Statistik ----------

export function showStats() {
  const s = getStats();
  const a = getAdv();
  const tile = (label, value) => h('div.stat-tile', null, h('b', null, value), h('span', null, label));
  const sections = [];
  const unplayed = [];
  for (const size of SIZES) {
    const c = s.classic[size];
    // Nie gespielte Grössen nur als kurze Zeile (spart Platz auf kleinen Bildschirmen).
    if (!c.played && !c.best && size !== 8) { unplayed.push(`${size}×${size}`); continue; }
    sections.push(h('div.stat-section', null,
      h('h3', null, `Klassisch ${size}×${size}`),
      h('div.stat-grid', null,
        tile('Rekord', fmt(c.best)),
        tile('Spiele', fmt(c.played)),
        tile('Durchschnitt', c.played ? fmt(Math.round(c.total / c.played)) : '–'),
        tile('Linien', fmt(c.lines)),
        tile('Beste Kombo', c.bestCombo ? `${c.bestCombo} Linien` : '–'),
        tile('Längste Serie', c.bestStreak ? `${c.bestStreak}×` : '–'))));
  }
  const done = Object.keys(a.stars).length;
  sections.unshift(h('div.stat-section', null,
    h('h3', null, 'Abenteuer'),
    h('div.stat-grid', null,
      tile('Level geschafft', fmt(done)),
      tile('Sterne', fmt(totalStars(a))),
      tile('Bilder', `${a.pics.length} / ${pictures.length}`),
      tile('Edelsteine', fmt(a.gems)),
      tile('Siege', fmt(a.wins)),
      tile('Versuche', fmt(a.tries)))));
  if (unplayed.length) sections.push(h('p.stat-note', null, `Klassisch ${unplayed.join(', ')}: noch nicht gespielt`));
  return showModal({ title: 'Statistik', content: h('div.stats', null, ...sections), buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

// ---------- Aussehen ----------

export function skinPicker(onChange) {
  const wrap = h('div.skin-picker');
  const render = () => {
    const cur = getSettings().skin;
    wrap.replaceChildren(...skins.map((sk) => {
      const b = h('button.skin-opt' + (sk.id === cur ? '.active' : ''), { type: 'button', 'aria-label': sk.title },
        miniBoard(sk, ['0125', '3.46', '7r..'], 15),
        h('span', null, sk.title),
        sk.id === cur ? h('i.skin-check', { html: icon('check', { size: 14 }) }) : null);
      b.addEventListener('click', () => {
        if (sk.id === getSettings().skin) return;
        saveSettings({ skin: sk.id });
        render();
        if (onChange) onChange(sk);
      });
      return b;
    }));
  };
  render();
  return wrap;
}

export function showSkins(onChange) {
  return showModal({
    title: 'Aussehen',
    content: h('div', null, h('p.sheet-sub', null, 'Wähle den Stil der Steine.'), skinPicker(onChange)),
    buttons: [{ label: 'Fertig', value: true, primary: true }],
  });
}

// ---------- Album ----------

export function showAlbum() {
  const a = getAdv();
  const have = new Set(a.pics);
  const grid = h('div.album-grid');
  for (const p of pictures) {
    if (have.has(p.id)) {
      const c = renderPicture(p, 64, Math.min(3, window.devicePixelRatio || 1));
      const img = h('img', { src: c.toDataURL(), alt: p.title });
      grid.append(h('figure.album-item', null, img, h('figcaption', null, p.title)));
    } else {
      grid.append(h('figure.album-item.locked', null, h('div.album-q', null, '?'), h('figcaption', null, '???')));
    }
  }
  return showModal({
    title: 'Album',
    content: h('div', null, h('p.sheet-sub', null, `${have.size} von ${pictures.length} Bildern entdeckt. Bild-Level im Abenteuer decken neue auf.`), grid),
    buttons: [{ label: 'Schliessen', value: true, primary: true }],
  });
}
