// Startbildschirm des Pfeilwürfels (shared/gamemenu.js): drehender Vorschau-Würfel, grosser
// Spielen-Knopf, Modus, Statistik und Levelkarte nach Kapiteln (Papier-Themen aus data/levels.js).

import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { generateLevel, specialFor, themeFor } from './generator.js';
import { makeCube } from './geometry.js';
import { CubeRenderer } from './render.js';
import { qMul, qAxisAngle, qNorm } from './math.js';
import { CHAPTER_SIZE } from './data/levels.js';
import {
  loadProgress, loadCurrent, totalStars, solvedCount, perfectCount, ensureSummary,
  loadStats, loadSettings, saveSettings,
} from './progress.js';
import { showHowto } from './howto.js';
import { num } from '../shared/i18n.js';
import { t, spTitle, themeName } from './i18n.js';

const ACCENT = '#f29a1f';

function fmtTime(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return t('minutes', { m: min });
  const hrs = Math.floor(min / 60);
  return t('hoursMinutes', { h: hrs, m: min % 60 });
}

export function showStats() {
  const p = loadProgress();
  const s = loadStats();
  const rows = [
    [t('rowHighest'), num(p.unlocked)],
    [t('rowSolved'), num(solvedCount(p))],
    [t('rowStars'), num(totalStars(p))],
    [t('rowPerfect'), num(perfectCount(p))],
    [t('rowStreak'), t('streakLevels', { n: s.bestStreak })],
    [t('rowArrows'), num(s.arrows)],
    [t('rowMistakes'), num(s.mistakes)],
    [t('rowHints'), num(s.hints)],
    [t('rowTime'), fmtTime(s.playMs)],
  ];
  const list = h('div.cube-statlist', null, rows.map(([k, v]) => h('div.cube-statrow', null, h('span', null, k), h('b', null, v))));
  return showModal({ title: t('stats'), content: list, buttons: [{ label: t('close'), value: 'ok', primary: true }] });
}

export function mountMenu(root, nav) {
  const prog = loadProgress();
  ensureSummary();
  const next = prog.unlocked;
  const cur = loadCurrent(next);
  const resume = cur && Array.isArray(cur.removed) && cur.removed.length > 0;
  const nextLevel = generateLevel(next);
  const sp = specialFor(next);
  const settings = loadSettings();

  root.className = 'app cube-menu';
  root.innerHTML = '';

  // ---------- Titelbild: drehender Würfel des nächsten Levels ----------
  const heroCanvas = h('canvas.hero-cube', { 'aria-hidden': 'true' });
  const art = h('div.hero-stage', null, heroCanvas,
    sp ? h('span.hero-badge', null, h('span', { html: icon('sparkle', { size: 14 }) }), spTitle(sp)) : null);

  // ---------- Levelkarte ----------
  const curChapter = Math.ceil(next / CHAPTER_SIZE);
  const map = h('div.level-map');
  let currentTile = null;
  for (let ch = 1; ch <= curChapter + 1; ch++) {
    const th = themeFor((ch - 1) * CHAPTER_SIZE + 1);
    let chStars = 0;
    const grid = h('div.level-grid');
    for (let L = (ch - 1) * CHAPTER_SIZE + 1; L <= ch * CHAPTER_SIZE; L++) {
      const st = prog.stars[L] | 0;
      chStars += st;
      const locked = L > next;
      const current = L === next;
      const lsp = specialFor(L);
      const cls = ['level-tile'];
      if (locked) cls.push('locked');
      if (current) cls.push('current');
      if (st > 0) cls.push('done');
      if (lsp) cls.push('special');
      const tile = h('button', { class: cls.join(' '), type: 'button', 'data-level': L,
        'aria-label': t('level', { n: L }) + (lsp ? t('tileSpecial', { name: spTitle(lsp) }) : '') + (locked ? t('tileLocked') : '') });
      if (lsp) tile.append(h('span.tile-badge', { html: icon('sparkle', { size: 12 }) }));
      if (locked) {
        tile.append(h('span.num', null, String(L)), h('span.tile-lock', { html: icon('lock', { size: 13 }) }));
      } else {
        const row = h('span.tile-stars');
        for (let i = 0; i < 3; i++) row.append(h('span' + (i < st ? '.on' : ''), { html: icon('star', { size: 12 }) }));
        tile.append(h('span.num', null, String(L)), row);
      }
      tile.addEventListener('click', () => {
        if (locked) { sfx.play('tap'); toast(t('solveFirst', { n: next })); return; }
        nav.play(L);
      });
      if (current) currentTile = tile;
      grid.append(tile);
    }
    const sw = h('span.ch-swatch', { style: `--l:${th.light};--d:${th.dark};--i:${th.ink}` });
    const head = h('div.ch-head', null, sw,
      h('span.ch-name', null, h('b', null, t('chapter', { n: ch })), h('small', null, themeName(th))),
      h('span.ch-stars', { html: `${icon('star', { size: 14 })}<span>${chStars}/${CHAPTER_SIZE * 3}</span>` }));
    map.append(h('div.chapter' + (ch > curChapter ? '.locked' : ''), null, head, grid));
  }
  const legend = h('p.map-legend', null, h('span.legend-badge', { html: icon('sparkle', { size: 11 }) }), t('mapLegend'));

  const scrollToMap = () => {
    if (!currentTile) return;
    currentTile.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const solved = solvedCount(prog);
  const stats = loadStats();
  const subParts = [t('level', { n: next })];
  if (sp) subParts.push(t('special', { name: spTitle(sp) }));
  if (resume) {
    const left = nextLevel.arrows.length - cur.removed.length;
    subParts.push(left === 1 ? t('arrowsLeftOne') : t('arrowsLeftMany', { n: left }));
  }

  const menu = gameMenu({
    id: 'cube',
    title: t('gameTitle'),
    tagline: t('tagline'),
    accent: ACCENT,
    art,
    primary: { label: resume ? t('resume') : t('play'), sub: subParts.join(' · '), onClick: () => nav.play(next) },
    modes: {
      label: t('mode'),
      value: settings.mode,
      options: [
        { id: 'classic', label: t('classic'), sub: t('classicSub') },
        { id: 'relax', label: t('relax'), sub: t('relaxSub') },
      ],
      onChange(id) { saveSettings({ mode: id }); toast(id === 'relax' ? t('toastRelax') : t('toastClassic')); },
    },
    secondary: [
      { label: t('levelMap'), icon: 'grid', onClick: scrollToMap },
      { label: t('stats'), icon: 'star', onClick: () => showStats() },
    ],
    stats: [
      { label: t('statSolved'), value: num(solved) },
      { label: t('statStars'), value: num(totalStars(prog)) },
      { label: t('statPerfect'), value: num(perfectCount(prog)) },
      { label: t('statArrows'), value: num(stats.arrows) },
    ],
    sections: [menuSection(t('levelMap'), map, legend)],
    onHelp: () => showHowto(),
    backHref: '../',
  });
  root.append(menu);

  // ---------- Drehender Vorschau-Würfel ----------
  const renderer = new CubeRenderer(heroCanvas, { mini: true });
  const geo = makeCube(nextLevel.N);
  renderer.setLevel(geo, nextLevel.arrows);
  renderer.setTheme(themeFor(next));
  const removed = new Uint8Array(nextLevel.arrows.length);
  if (resume) for (const id of cur.removed) if (id >= 0 && id < removed.length) removed[id] = 1;
  let raf = 0;
  let destroyed = false;
  const t0 = performance.now();
  const tilt = qAxisAngle([1, 0, 0], 0.5);
  function frame(t) {
    raf = 0;
    if (destroyed) return;
    const a = -0.68 + (t - t0) * 0.00028;
    const q = qNorm(qMul(tilt, qAxisAngle([0, 1, 0], a)));
    renderer.draw({ q, zoom: 1, panX: 0, panY: 0 }, { removed, traces: true });
    if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
  }
  const resize = () => {
    const r = heroCanvas.getBoundingClientRect();
    renderer.resize(r.width, r.height, Math.min(2.5, window.devicePixelRatio || 1));
    if (!raf && !destroyed) raf = requestAnimationFrame(frame);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(heroCanvas);
  resize();
  const onVis = () => { if (document.visibilityState === 'visible' && !raf && !destroyed) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
