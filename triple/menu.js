// Menü-Bildschirme von Dreierlei: Startseite, Freies Spiel, Levelübersicht, Statistik, Anleitung.

import { sfx } from '../shared/sfx.js';
import { icon, h, toast, showModal, soundButton, backButton } from '../shared/ui.js';
import { themes, themeById } from './data/themes.js';
import { generateLevel, levelParams, SIZES } from './logic/generator.js';
import { loadProgress, loadStats, loadSave, totalStars, formatTime, getPref, setPref, updateSummary } from './progress.js';

/** Ein dekorativer Stein (wie im Spiel), z.B. für Vorschauen. */
export function miniTile(emoji, cls = '') {
  return h('div.tr-tile.static' + (cls ? '.' + cls : ''), null, h('span.tr-emo', null, emoji));
}

function savedProgress(save) {
  if (!save || !save.game || typeof save.game.where !== 'string') return 0;
  const w = save.game.where;
  let g = 0;
  for (const ch of w) if (ch === 'g') g++;
  return Math.round((100 * g) / w.length);
}

export function tagLabel(tag) {
  if (tag === 'gross') return 'Grosses Level';
  if (tag === 'pause') return 'Verschnaufpause';
  return '';
}

// ---------- Startseite ----------

export function mountMenu(root, nav) {
  const prog = loadProgress();
  const stats = loadStats();
  updateSummary(prog);
  const L = prog.level;
  const level = generateLevel(L);
  const theme = themeById(level.theme);
  const save = loadSave('play');
  const resume = save && save.levelNo === L && save.game && save.game.moves > 0;
  const pct = resume ? savedProgress(save) : 0;
  const stars = totalStars(prog);

  root.className = 'app tr-menu';
  root.style.setProperty('--t-color', theme.color);
  root.style.setProperty('--t-bg', theme.bg);
  root.innerHTML = '';

  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht\'s' });
  helpBtn.innerHTML = '<span class="tr-q">?</span>';
  helpBtn.addEventListener('click', () => { sfx.play('click'); showHelp(); });

  const top = h('header.topbar', null,
    backButton('../'),
    h('div.title', null, 'Dreierlei'),
    helpBtn,
    soundButton());

  // Hero mit drei gefächerten Steinen des nächsten Levels
  const art = h('div.tr-hero-art', { 'aria-hidden': 'true' },
    miniTile(level.symbols[1] || level.symbols[0], 'f1'),
    miniTile(level.symbols[0], 'f2'),
    miniTile(level.symbols[2] || level.symbols[0], 'f3'),
    h('span.tr-hero-spark.s1', { html: icon('sparkle', { size: 22 }) }),
    h('span.tr-hero-spark.s2', { html: icon('sparkle', { size: 16 }) }));
  const playBtn = h('button.btn.primary.block.tr-play-btn', { type: 'button' });
  playBtn.innerHTML = icon('play', { size: 22 });
  playBtn.append(document.createTextNode(resume ? `Weiter – Level ${L}` : `Spielen – Level ${L}`));
  playBtn.addEventListener('click', () => { sfx.play('tap'); nav.go('#play'); });
  const tag = tagLabel(level.tag);
  const hero = h('section.tr-hero.card', null,
    art,
    h('p.tr-kicker', null, resume ? `Angefangen · ${pct} % geschafft` : L === 1 ? 'Willkommen!' : 'Als Nächstes'),
    h('h1.tr-hero-title', null, `Level ${L}`),
    h('p.tr-hero-sub', null,
      h('span', null, theme.title),
      h('span.dot', null, '·'),
      h('span', null, `${level.tiles.length} Steine`),
      tag ? h('span.tr-tag', null, tag) : null),
    playBtn);

  // Zwei Karten: Freies Spiel, Levels
  const freeSave = loadSave('free');
  const freeCard = h('button.tr-card-btn.card', { type: 'button' },
    h('span.tr-card-ic.free', { 'aria-hidden': 'true' }, '🎲'),
    h('b', null, 'Freies Spiel'),
    h('small', null, freeSave && freeSave.game && freeSave.game.moves > 0 ? 'Angefangen – weiter' : 'Thema & Grösse wählen'));
  freeCard.addEventListener('click', () => { sfx.play('tap'); nav.go('#free'); });
  const levelsCard = h('button.tr-card-btn.card', { type: 'button' },
    h('span.tr-card-ic.levels', { 'aria-hidden': 'true' }, '🏅'),
    h('b', null, 'Levels'),
    h('small', null, `${L - 1} geschafft · ${stars} ★`));
  levelsCard.addEventListener('click', () => { sfx.play('tap'); nav.go('#levels'); });

  // Statistik kompakt
  const statBox = (value, label) => h('div.tr-stat', null, h('b', null, String(value)), h('small', null, label));
  const statsCard = h('section.card.tr-stats', null,
    h('div.tr-stats-head', null, h('h2', null, 'Statistik'),
      h('button.tr-link', { type: 'button', onclick: () => { sfx.play('click'); showStats(); } }, 'Alle anzeigen')),
    h('div.tr-stats-grid', null,
      statBox(stats.won + stats.freeWon, 'Gewonnen'),
      statBox(stars, 'Sterne'),
      statBox(stats.streak, 'Serie'),
      statBox(stats.triples, 'Drillinge')));

  const howBtn = h('button.btn.ghost.block.tr-how', { type: 'button', html: icon('hint', { size: 20 }) + 'So geht\'s' });
  howBtn.addEventListener('click', () => { sfx.play('click'); showHelp(); });

  const main = h('main.tr-menu-main', null,
    hero,
    h('div.tr-cards', null, freeCard, levelsCard),
    statsCard,
    howBtn);
  root.append(top, h('div.scroll', null, main));

  if (!getPref('helpSeen', false)) {
    setTimeout(() => { if (root.contains(main)) showHelp(); }, 350);
  }
  return { destroy() { root.style.removeProperty('--t-color'); root.style.removeProperty('--t-bg'); } };
}

// ---------- Freies Spiel ----------

export function mountFree(root, nav) {
  root.className = 'app tr-menu';
  root.innerHTML = '';
  let size = getPref('freeSize', 'mittel');
  if (!SIZES[size]) size = 'mittel';
  const back = backButton('#', () => { sfx.play('click'); nav.go(''); });
  const top = h('header.topbar', null, back, h('div.title', null, 'Freies Spiel'), soundButton());

  const save = loadSave('free');
  let resumeCard = null;
  if (save && save.game && save.game.moves > 0 && themeById(save.theme) && SIZES[save.size]) {
    const t = themeById(save.theme);
    const btn = h('button.btn.primary', { type: 'button', html: icon('play', { size: 20 }) + 'Weiter' });
    btn.addEventListener('click', () => { sfx.play('tap'); nav.go(`#free/${save.theme}/${save.size}/${save.seed}`); });
    resumeCard = h('section.card.tr-resume', null,
      h('div.tr-resume-ic', { style: { background: t.bg } }, t.emoji[0]),
      h('div.grow', null, h('b', null, `${t.title} · ${SIZES[save.size].title}`), h('small', null, `${savedProgress(save)} % geschafft`)),
      btn);
  }

  const chips = h('div.tr-sizes', { role: 'tablist' });
  const renderChips = () => {
    for (const c of chips.children) c.classList.toggle('active', c.dataset.size === size);
  };
  for (const [id, s] of Object.entries(SIZES)) {
    const c = h('button.tr-size', { type: 'button', role: 'tab', 'data-size': id },
      h('b', null, s.title), h('small', null, `${s.tiles} Steine`));
    c.addEventListener('click', () => { size = id; setPref('freeSize', id); sfx.play('click'); renderChips(); });
    chips.append(c);
  }
  renderChips();

  const start = (themeId) => {
    sfx.play('tap');
    const seed = (Date.now() % 1e9).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    nav.go(`#free/${themeId}/${size}/${seed}`);
  };

  const grid = h('div.tr-theme-grid');
  const randomCard = h('button.tr-theme.card', { type: 'button', style: { '--t-bg': '#f1eafc' } },
    h('div.tr-theme-art', null, miniTile('🎲'), miniTile('❓'), miniTile('✨')),
    h('b', null, 'Zufall'));
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
    h('h2.tr-section', null, 'Grösse'),
    chips,
    h('h2.tr-section', null, 'Thema'),
    grid,
    h('p.tr-foot', null, `${themes.length} Themen – jedes Spiel wird neu gemischt.`));
  root.append(top, h('div.scroll', null, main));
  return { destroy() {} };
}

// ---------- Levelübersicht ----------

export function mountLevels(root, nav) {
  root.className = 'app tr-menu';
  root.innerHTML = '';
  const prog = loadProgress();
  const back = backButton('#', () => { sfx.play('click'); nav.go(''); });
  const top = h('header.topbar', null, back, h('div.title', null, 'Levels'), soundButton());
  const cur = prog.level;
  const maxShow = Math.ceil((cur + 12) / 5) * 5;
  const grid = h('div.tr-level-grid');
  for (let L = 1; L <= maxShow; L++) {
    const st = prog.stars[L] | 0;
    const locked = L > cur;
    const current = L === cur;
    const tag = levelParams(L).tag;
    const cls = ['tr-level'];
    if (locked) cls.push('locked');
    if (current) cls.push('current');
    if (tag === 'gross') cls.push('big');
    const btn = h('button', { class: cls.join(' '), type: 'button', 'aria-label': `Level ${L}` },
      h('span.num', null, String(L)));
    if (locked) btn.append(h('span.lock', { html: icon('lock', { size: 13 }) }));
    else if (!current) {
      const row = h('span.st');
      for (let i = 0; i < 3; i++) row.append(h('span' + (i < st ? '.on' : ''), { html: icon('star', { size: 11 }) }));
      btn.append(row);
    } else btn.append(h('span.go', { html: icon('play', { size: 12 }) }));
    btn.addEventListener('click', () => {
      if (locked) { sfx.play('tap'); toast(`Zuerst Level ${cur} schaffen`); return; }
      sfx.play('tap');
      nav.go(current ? '#play' : `#level/${L}`);
    });
    grid.append(btn);
  }
  const main = h('main.tr-menu-main', null,
    h('p.tr-levels-intro', null, `${cur - 1} Level geschafft · ${totalStars(prog)} Sterne. Tippe ein geschafftes Level an, um es nochmal zu spielen und mehr Sterne zu holen.`),
    grid,
    h('p.tr-foot', null, 'Die Level gehen nie aus – nach jedem kommt ein neues.'));
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
  const bestTimes = Object.entries(SIZES)
    .filter(([id]) => s.freeBest[id])
    .map(([id, sz]) => row(`Bestzeit ${sz.title}`, formatTime(s.freeBest[id])));
  const content = h('div.tr-statlist', null,
    row('Gespielt', String(played)),
    row('Gewonnen', `${won} (${rate} %)`),
    row('Erreichtes Level', String(prog.level)),
    row('Sterne', String(totalStars(prog))),
    row('Siegesserie', `${s.streak} (beste: ${s.bestStreak})`),
    row('Drillinge gesamt', String(s.triples)),
    row('Spielzeit gesamt', formatTime(s.totalTime || 0)),
    ...bestTimes);
  return showModal({ title: 'Statistik', content, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

// ---------- Anleitung ----------

export function showHelp() {
  setPref('helpSeen', true);
  const step = (art, title, text) => h('div.tr-step', null,
    h('div.tr-step-art', { 'aria-hidden': 'true' }, ...art),
    h('div', null, h('b', null, title), h('p', null, text)));
  const content = h('div.tr-help', null,
    step([miniTile('🍓'), miniTile('🍒', 'dim')], 'Freie Steine antippen',
      'Nur helle Steine lassen sich nehmen. Dunkle liegen noch unter anderen.'),
    step([miniTile('🍓', 'sm'), miniTile('🍓', 'sm'), miniTile('🍓', 'sm')], 'Drei gleiche verschwinden',
      'Angetippte Steine wandern in die Ablage. Drei gleiche lösen sich auf.'),
    step([h('div.tr-help-tray', null, ...Array.from({ length: 7 }, () => h('i')))], 'Ablage hat 7 Plätze',
      'Ist sie voll ohne Dreier, ist die Runde vorbei – einfach nochmal!'),
    step([h('span.tr-help-ic', { html: icon('undo', { size: 20 }) }), h('span.tr-help-ic', { html: icon('shuffle', { size: 20 }) }), h('span.tr-help-ic', { html: icon('hint', { size: 20 }) })],
      'Hilfen gratis', 'Zurück, Auslagern, Mischen und Tipp: je einmal pro Level. Ohne Hilfe gibt es 3 Sterne.'));
  return showModal({ title: 'So geht\'s', content, buttons: [{ label: 'Los geht\'s', value: true, primary: true }] });
}
