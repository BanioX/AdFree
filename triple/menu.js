// Menü-Bildschirme von Dreierlei: Startbildschirm (shared gameMenu), Freies Spiel, Levelübersicht, Statistik.
// Menü-Knöpfe sind stumm (Klänge nur bei echten Spielereignissen).

import { icon, h, toast, showModal, soundButton, backButton } from '../shared/ui.js';
import { L, fmt } from '../shared/i18n.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { showHelp } from './howto.js';
import { ACCENT, miniTile } from './bits.js';
import { themes, themeById } from './data/themes.js';
import { generateLevel, levelParams, themeForLevel, SIZES } from './logic/generator.js';
import { TRAY_SIZE } from './logic/rules.js';
import { loadProgress, loadStats, loadSave, totalStars, formatTime, getPref, setPref, updateSummary } from './progress.js';

export { showHelp, miniTile };

const SIZE_EN = { klein: 'Small', mittel: 'Medium', gross: 'Large', riesig: 'Huge' };
export const sizeTitle = (id) => L(SIZES[id] ? SIZES[id].title : id, SIZE_EN[id]);
export const tilesText = (n) => fmt(L('{n} Steine', '{n} tiles'), { n });

function savedProgress(save) {
  if (!save || !save.game || typeof save.game.where !== 'string') return 0;
  const w = save.game.where;
  let g = 0;
  for (const ch of w) if (ch === 'g') g++;
  return Math.round((100 * g) / w.length);
}

export function tagLabel(tag) {
  if (tag === 'gross') return L('Grosses Level', 'Big level');
  if (tag === 'pause') return L('Verschnaufpause', 'Breather');
  return '';
}

// ---------- Startbildschirm ----------

export function mountMenu(root, nav) {
  const prog = loadProgress();
  const stats = loadStats();
  updateSummary(prog);
  const L0 = prog.level;
  const level = generateLevel(L0);
  const theme = themeById(level.theme);
  const save = loadSave('play');
  const resume = save && save.levelNo === L0 && save.game && save.game.moves > 0;
  const pct = resume ? savedProgress(save) : 0;
  // verlorene Runde (Ablage voll): ehrlich «Nochmal versuchen» statt «Weiterspielen»
  const lost = resume && Array.isArray(save.game.tray) && save.game.tray.length >= TRAY_SIZE;
  const stars = totalStars(prog);
  const played = stats.played + stats.freePlayed;

  root.className = 'app tr-menu';
  root.style.setProperty('--t-color', theme.color);
  root.style.setProperty('--t-bg', theme.bg);
  root.innerHTML = '';

  // Titelbild: drei gleiche Steine des nächsten Levels – genau das, was man im Spiel sammelt
  const sym = level.symbols[0];
  const art = h('div.tr-hero-art', { 'aria-hidden': 'true' },
    miniTile(sym, 'f1'), miniTile(sym, 'f2'), miniTile(sym, 'f3'),
    h('span.tr-hero-spark.s1', { html: icon('sparkle', { size: 22 }) }),
    h('span.tr-hero-spark.s2', { html: icon('sparkle', { size: 16 }) }));

  const tag = tagLabel(level.tag);
  const freeSave = loadSave('free');
  const freeResume = freeSave && freeSave.game && freeSave.game.moves > 0 && themeById(freeSave.theme) && SIZES[freeSave.size];
  const lv = fmt(L('Level {n}', 'Level {n}'), { n: L0 });

  const menu = gameMenu({
    id: 'triple',
    title: L('Dreierlei', 'Triple Tiles'),
    tagline: L('Drei Gleiche sammeln', 'Collect three of a kind'),
    accent: ACCENT,
    art,
    primary: {
      label: lost ? L('Nochmal versuchen', 'Try again') : resume ? L('Weiterspielen', 'Continue') : L('Spielen', 'Play'),
      sub: lost ? `${lv} · ${L('Ablage war voll', 'tray was full')}`
        : resume ? `${lv} · ${theme.title} · ${pct > 0 ? pct + ' %' : L('angefangen', 'started')}`
          : `${lv} · ${theme.title}${tag ? ' · ' + tag : ''}`,
      icon: lost ? 'refresh' : 'play',
      onClick: () => nav.go('#play'),
    },
    secondary: [
      {
        label: L('Freies Spiel', 'Free play'), icon: 'shuffle',
        sub: freeResume ? L('Angefangen – weiter', 'In progress') : L('Thema & Grösse', 'Theme & size'),
        onClick: () => nav.go('#free'),
      },
      { label: L('Levels', 'Levels'), icon: 'grid', sub: `${L0 - 1} ${L('geschafft', 'done')} · ${stars} ★`, onClick: () => nav.go('#levels') },
    ],
    // Kennzahlen erst, wenn es etwas zu zählen gibt (frischer Start bleibt aufgeräumt)
    stats: played > 0 ? [
      { label: L('Gelöst', 'Solved'), value: stats.won + stats.freeWon },
      { label: L('Sterne', 'Stars'), value: stars },
      { label: L('Serie', 'Streak'), value: stats.streak },
      { label: L('Drillinge', 'Triples'), value: stats.triples },
    ] : null,
    sections: [
      menuSection(L('Levelkarte', 'Level map'), upcoming(L0, prog, nav)),
      played > 0 ? h('button.tr-stat-link', { type: 'button', onclick: () => showStats() },
        h('span', { html: icon('star', { size: 18 }) }), L('Alle Statistiken', 'All statistics')) : null,
    ],
    onHelp: () => showHelp(),
    backHref: '../',
  });
  menu.classList.add('tr-gm');
  root.append(menu);
  return { destroy() { root.style.removeProperty('--t-color'); root.style.removeProperty('--t-bg'); } };
}

/** Kleine Levelkarte: zwei geschaffte, das aktuelle und die nächsten Level mit Thema und Besonderheit. */
function upcoming(cur, prog, nav) {
  const row = h('div.tr-next-row');
  const from = Math.max(1, cur - 1);
  for (let L1 = from; L1 < from + 5; L1++) {
    const p = levelParams(L1);
    const th = themeForLevel(L1);
    const done = L1 < cur;
    const cls = ['tr-next'];
    if (L1 === cur) cls.push('current');
    if (L1 > cur) cls.push('locked');
    if (p.tag === 'gross') cls.push('big');
    const st = prog.stars[L1] | 0;
    const b = h('button', { class: cls.join(' '), type: 'button', 'aria-label': fmt(L('Level {n}', 'Level {n}'), { n: L1 }) },
      h('span.tr-next-emo', { style: { background: th.bg } }, th.emoji[0]),
      h('b', null, String(L1)),
      done ? h('small.tr-next-st', null, '★'.repeat(st) || '–')
        : h('small', null, L1 === cur ? L('Jetzt', 'Now') : p.tag === 'gross' ? L('Gross', 'Big') : p.tag === 'pause' ? L('Pause', 'Break') : (th.short || th.title)));
    b.addEventListener('click', () => {
      if (L1 === cur) nav.go('#play');
      else if (done) nav.go(`#level/${L1}`);
      else toast(fmt(L('Zuerst Level {n} schaffen', 'Finish level {n} first'), { n: cur }));
    });
    row.append(b);
  }
  return row;
}

// ---------- Freies Spiel ----------

export function mountFree(root, nav) {
  root.className = 'app tr-menu';
  root.innerHTML = '';
  let size = getPref('freeSize', 'mittel');
  if (!SIZES[size]) size = 'mittel';
  const back = backButton('#', () => nav.go(''));
  const top = h('header.topbar', null, back, h('div.title', null, L('Freies Spiel', 'Free play')), soundButton());

  const save = loadSave('free');
  let resumeCard = null;
  if (save && save.game && save.game.moves > 0 && themeById(save.theme) && SIZES[save.size]) {
    const t = themeById(save.theme);
    const btn = h('button.btn.primary', { type: 'button', html: icon('play', { size: 20 }) + L('Weiter', 'Resume') });
    btn.addEventListener('click', () => nav.go(`#free/${save.theme}/${save.size}/${save.seed}`));
    resumeCard = h('section.card.tr-resume', null,
      h('div.tr-resume-ic', { style: { background: t.bg } }, t.emoji[0]),
      h('div.grow', null, h('b', null, `${t.title} · ${sizeTitle(save.size)}`), h('small', null, `${savedProgress(save)} % ${L('geschafft', 'done')}`)),
      btn);
  }

  const chips = h('div.tr-sizes', { role: 'tablist' });
  const renderChips = () => {
    for (const c of chips.children) c.classList.toggle('active', c.dataset.size === size);
  };
  for (const [id, s] of Object.entries(SIZES)) {
    const c = h('button.tr-size', { type: 'button', role: 'tab', 'data-size': id },
      h('b', null, sizeTitle(id)), h('small', null, tilesText(s.tiles)));
    c.addEventListener('click', () => { size = id; setPref('freeSize', id); renderChips(); });
    chips.append(c);
  }
  renderChips();

  const start = (themeId) => {
    const seed = (Date.now() % 1e9).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    nav.go(`#free/${themeId}/${size}/${seed}`);
  };

  const grid = h('div.tr-theme-grid');
  const randomCard = h('button.tr-theme.card', { type: 'button', style: { '--t-bg': '#f1eafc' } },
    h('div.tr-theme-art', null, miniTile('🎲'), miniTile('❓'), miniTile('✨')),
    h('b', null, L('Zufall', 'Surprise me')));
  randomCard.addEventListener('click', () => start(themes[Math.floor(Math.random() * themes.length)].id));
  grid.append(randomCard);
  for (const t of themes) {
    const c = h('button.tr-theme.card', { type: 'button', 'data-theme': t.id },
      h('div.tr-theme-art', null, miniTile(t.emoji[1]), miniTile(t.emoji[0]), miniTile(t.emoji[2])),
      h('b', null, t.title));
    c.style.setProperty('--t-bg', t.bg);
    c.addEventListener('click', () => start(t.id));
    grid.append(c);
  }

  const main = h('main.tr-menu-main', null,
    resumeCard,
    h('h2.tr-section', null, L('Grösse', 'Size')),
    chips,
    h('h2.tr-section', null, L('Thema', 'Theme')),
    grid,
    h('p.tr-foot', null, fmt(L('{n} Themen – jedes Spiel wird neu gemischt.', '{n} themes – every game is freshly shuffled.'), { n: themes.length })));
  root.append(top, h('div.scroll', null, main));
  return { destroy() {} };
}

// ---------- Levelübersicht ----------

export function mountLevels(root, nav) {
  root.className = 'app tr-menu';
  root.innerHTML = '';
  const prog = loadProgress();
  const back = backButton('#', () => nav.go(''));
  const top = h('header.topbar', null, back, h('div.title', null, L('Levels', 'Levels')), soundButton());
  const cur = prog.level;
  const maxShow = Math.ceil((cur + 12) / 5) * 5;
  const grid = h('div.tr-level-grid');
  for (let L1 = 1; L1 <= maxShow; L1++) {
    const st = prog.stars[L1] | 0;
    const locked = L1 > cur;
    const current = L1 === cur;
    const tag = levelParams(L1).tag;
    const cls = ['tr-level'];
    if (locked) cls.push('locked');
    if (current) cls.push('current');
    if (tag === 'gross') cls.push('big');
    const btn = h('button', { class: cls.join(' '), type: 'button', 'aria-label': fmt(L('Level {n}', 'Level {n}'), { n: L1 }) },
      h('span.num', null, String(L1)));
    if (locked) btn.append(h('span.lock', { html: icon('lock', { size: 13 }) }));
    else if (!current) {
      const row = h('span.st');
      for (let i = 0; i < 3; i++) row.append(h('span' + (i < st ? '.on' : ''), { html: icon('star', { size: 11 }) }));
      btn.append(row);
    } else btn.append(h('span.go', { html: icon('play', { size: 12 }) }));
    btn.addEventListener('click', () => {
      if (locked) { toast(fmt(L('Zuerst Level {n} schaffen', 'Finish level {n} first'), { n: cur })); return; }
      nav.go(current ? '#play' : `#level/${L1}`);
    });
    grid.append(btn);
  }
  const main = h('main.tr-menu-main', null,
    h('p.tr-levels-intro', null, fmt(L('{d} Level geschafft · {s} Sterne. Tippe ein geschafftes Level an, um mehr Sterne zu holen.',
      '{d} levels done · {s} stars. Tap a finished level to play it again for more stars.'), { d: cur - 1, s: totalStars(prog) })),
    grid,
    h('p.tr-foot', null, L('Die Level gehen nie aus – nach jedem kommt ein neues.', 'Levels never run out – there is always a next one.')));
  root.append(top, h('div.scroll', null, main));
  // aktuelles Level in Sicht scrollen
  requestAnimationFrame(() => {
    const c = grid.querySelector('.current');
    if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center' });
  });
  return { destroy() {} };
}

// ---------- Statistik ----------

export function showStats() {
  const prog = loadProgress();
  const s = loadStats();
  const played = s.played + s.freePlayed;
  const won = s.won + s.freeWon;
  const rate = played ? Math.round((100 * won) / played) : 0;
  const row = (label, value) => h('div.tr-srow', null, h('span', null, label), h('b', null, value));
  const bestTimes = Object.keys(SIZES)
    .filter((id) => s.freeBest[id])
    .map((id) => row(fmt(L('Bestzeit {s}', 'Best time {s}'), { s: sizeTitle(id) }), formatTime(s.freeBest[id])));
  const content = h('div.tr-statlist', null,
    row(L('Gespielt', 'Played'), String(played)),
    row(L('Gewonnen', 'Won'), `${won} (${rate} %)`),
    row(L('Erreichtes Level', 'Level reached'), String(prog.level)),
    row(L('Sterne', 'Stars'), String(totalStars(prog))),
    row(L('Siegesserie', 'Win streak'), fmt(L('{a} (beste: {b})', '{a} (best: {b})'), { a: s.streak, b: s.bestStreak })),
    row(L('Drillinge gesamt', 'Triples total'), String(s.triples)),
    row(L('Spielzeit gesamt', 'Total play time'), formatTime(s.totalTime || 0)),
    ...bestTimes);
  return showModal({ title: L('Statistik', 'Statistics'), content, buttons: [{ label: L('Schliessen', 'Close'), value: true, primary: true }] });
}
