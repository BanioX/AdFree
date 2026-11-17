// Verdoppeln – Menü, Etappen-Karte, Album und Info-Blätter.

import { h, icon, soundButton, backButton, showModal, toast } from '../shared/ui.js';
import { gameMenu } from '../shared/gamemenu.js';
import { sfx } from '../shared/sfx.js';
import { valueOf } from './logic.js';
import { tileFace } from './board.js';
import { modes, modeById } from './data/modes.js';
import { skins, skinById } from './data/skins.js';
import { chapters, LEVELS_PER_CHAPTER } from './data/levels.js';
import { makeLevel, chapterOf, chapterTitle } from './levelgen.js';
import * as P from './progress.js';

const fmt = P.formatNumber;

/** Kleines animiertes Bild: zwei gleiche Kacheln verschmelzen. */
function heroArt(skin) {
  const e = skin.numbers ? 5 : 6;
  const strip = h('div.hero-board');
  strip.style.setProperty('--board', skin.board);
  strip.style.setProperty('--slot', skin.slot);
  for (let i = 0; i < 3; i++) strip.append(h('div.hslot', { style: { left: `calc(${i} * (var(--hc) + var(--hg)) + var(--hg))` } }));
  const a = h('div.htile.ha', null, tileFace(skin, e));
  const b = h('div.htile.hb', null, tileFace(skin, e));
  const c = h('div.htile.hc', null, tileFace(skin, e + 1));
  strip.append(a, b, c);
  return strip;
}

// ---------- Menü (gemeinsamer Startbildschirm shared/gamemenu.js) ----------

/** Brett-Auswahl für das freie Spiel (Segment-Schalter im Stil des Startbildschirms). */
function boardPicker(p, onPick) {
  const seg = h('div.gm-seg.mg-boards', { role: 'tablist' });
  for (const m of modes) {
    const b = h('button', { type: 'button', role: 'tab', 'data-id': m.id, class: m.id === p.mode ? 'on' : '' },
      h('span', null, m.sub.replace(/ /g, '')), h('small', null, m.title));
    b.addEventListener('click', () => { if (m.id !== P.getProg().mode) { sfx.play('click'); onPick(m.id); } });
    seg.append(b);
  }
  return h('div.gm-block', null, h('div.gm-label', null, 'Brett'), seg);
}

/** Karte der aktuellen Etappe mit Fortschritt und Knopf zur Karte. */
function levelCard(nav) {
  const p = P.getProg();
  const n = p.levelMax;
  const lv = makeLevel(n);
  const info = chapterOf(n);
  const lskin = skinById(lv.skin);
  const mapBtn = h('button.btn.mg-map-btn', { type: 'button', html: icon('grid', { size: 20 }) }, 'Karte');
  mapBtn.addEventListener('click', () => { sfx.play('click'); nav.map(); });
  return h('div.gm-block', null, h('div.gm-label', null, 'Etappen'),
    h('div.card.mg-level', null,
      h('div.lv-head', null,
        h('div.lv-icon', null, info.chapter.icon),
        h('div.grow', null, h('div.lbl', null, chapterTitle(info.gci)), h('div.mg-lv-n', null, `Etappe ${n}`)),
        h('div.lv-goal', null, tileFace(lskin, lv.goal.e, { value: false }), lv.goal.type === 'count' ? h('b', null, `${lv.goal.n}×`) : null)),
      h('div.progress', null, h('i', { style: { width: `${(info.pos / LEVELS_PER_CHAPTER) * 100}%` } })),
      h('div.mg-level-foot', null, h('span', null, `${info.pos} von ${LEVELS_PER_CHAPTER} geschafft`, h('br'), 'Steine, Lücken, eigene Ziele'), mapBtn)));
}

export function mountMenu(app, nav, { start, onHelp }) {
  const p0 = P.getProg();
  app.className = 'app menu';
  app.textContent = '';

  function primary() {
    const p = P.getProg();
    if (p.tab === 'levels') {
      const n = p.levelMax;
      const save = P.loadSave('etappe');
      const running = save && save.n === n && save.state && save.state.moves > 0 && !save.state.over && !save.state.won;
      return {
        label: running || n > 1 ? 'Weiterspielen' : 'Spielen',
        sub: `Etappe ${n} · ${chapterTitle(chapterOf(n).gci)}`,
        onClick: () => start(() => { P.dropFinished('etappe'); nav.level(n); }),
      };
    }
    const mode = modeById(p.mode);
    const save = P.loadSave(mode.id);
    const running = save && save.state && !save.state.over && save.state.moves > 0;
    return {
      label: running ? 'Weiterspielen' : 'Spielen',
      sub: `${mode.title} ${mode.sub} · ${running ? fmt(save.state.score) + ' Punkte' : 'Ziel ' + fmt(valueOf(mode.target))}`,
      onClick: () => start(() => { P.dropFinished(mode.id); nav.free(mode.id); }),
    };
  }

  function stats() {
    const p = P.getProg();
    if (p.tab === 'levels') {
      let three = 0;
      for (const k in p.levelStars) if ((p.levelStars[k] | 0) >= 3) three++;
      return [
        { label: 'Geschafft', value: fmt(Math.max(0, p.levelMax - 1)) },
        { label: 'Sterne', value: fmt(P.totalStars()) },
        { label: '3 Sterne', value: fmt(three) },
      ];
    }
    const mode = modeById(p.mode);
    const bt = p.bestTile[mode.id] | 0;
    return [
      { label: 'Rekord', value: p.best[mode.id] ? fmt(p.best[mode.id]) : '–' },
      { label: 'Beste Kachel', value: bt ? fmt(valueOf(bt)) : '–' },
      { label: 'Ziel erreicht', value: fmt(p.won[mode.id] | 0) },
    ];
  }

  function sections() {
    const p = P.getProg();
    return [p.tab === 'levels' ? levelCard(nav) : boardPicker(p, (id) => { P.saveProg({ mode: id }); refresh(); })];
  }

  function refresh() {
    menu.update({ primary: primary(), stats: stats(), sections: sections() });
  }

  const menu = gameMenu({
    id: 'merge',
    title: 'Verdoppeln',
    tagline: 'Wischen, verschmelzen, wachsen.',
    accent: '#e2795a',
    art: heroArt(skinById(p0.skin)),
    primary: primary(),
    modes: {
      label: 'Spielart', value: p0.tab === 'levels' ? 'levels' : 'free',
      options: [
        { id: 'free', label: 'Freies Spiel', sub: `${modes.length} Bretter` },
        { id: 'levels', label: 'Etappen', sub: `★ ${P.totalStars()}` },
      ],
      onChange(id) { P.saveProg({ tab: id }); refresh(); },
    },
    secondary: [
      { label: 'Statistik', icon: 'grid', onClick: showStats },
      { label: 'Album', icon: 'star', onClick: () => nav.album() },
      { label: 'Aussehen', icon: 'sparkle', onClick: () => pickSkin(() => {
        const art = menu.querySelector('.gm-art');
        if (art) art.replaceChildren(heroArt(skinById(P.getProg().skin)));
        refresh();
      }) },
    ],
    stats: stats(),
    sections: sections(),
    onHelp,
    backHref: '../',
  });
  menu.classList.add('mg-menu');
  app.append(menu);
  P.report();
  return { destroy() {} };
}

// ---------- Aussehen ----------

export function pickSkin(onDone) {
  const p = P.getProg();
  const list = h('div.skin-list');
  let close;
  for (const s of skins) {
    const row = h('button.skin-row' + (s.id === p.skin ? '.active' : ''), { type: 'button' });
    const prev = h('div.skin-prev');
    for (let e = 1; e <= 5; e++) prev.append(tileFace(s, e, { value: false }));
    row.append(h('div.skin-name', null, h('b', null, s.title), h('span', null, `${s.tiles.length} Stufen`)), prev);
    if (s.id === p.skin) row.insertAdjacentHTML('beforeend', `<span class="tick">${icon('check', { size: 20 })}</span>`);
    row.addEventListener('click', () => {
      P.saveProg({ skin: s.id });
      sfx.play('pop');
      close && close();
    });
    list.append(row);
  }
  const pr = showModal({
    title: 'Aussehen',
    content: h('div', null, h('p.small', null, 'Gilt für das freie Spiel. Etappen haben ihren eigenen Stil.'), list),
    buttons: [{ label: 'Fertig', value: 'ok', ghost: true }],
  });
  close = () => { const bd = list.closest('.sp-modal-backdrop'); if (bd) bd.click(); };
  pr.then(() => onDone && onDone());
}

// ---------- Statistik ----------

export function showStats() {
  const p = P.getProg();
  const table = h('table.stats');
  table.append(h('tr', null, h('th', null, 'Modus'), h('th', null, 'Rekord'), h('th', null, 'Kachel'), h('th', null, 'Spiele')));
  for (const m of modes) {
    const bt = p.bestTile[m.id] | 0;
    table.append(h('tr', null,
      h('td', null, h('b', null, m.title), h('span', null, ' ' + m.sub)),
      h('td', null, p.best[m.id] ? fmt(p.best[m.id]) : '–'),
      h('td', null, bt ? fmt(valueOf(bt)) : '–'),
      h('td', null, String(p.played[m.id] | 0))));
  }
  const alb = P.albumCount();
  const won = modes.reduce((a, m) => a + (p.won[m.id] | 0), 0);
  const tiles = h('div.stat-tiles', null,
    statTile('Ziel erreicht', fmt(won)),
    statTile('Höchste Kachel', p.topE ? fmt(valueOf(p.topE)) : '–'),
    statTile('Züge', fmt(p.moves | 0)),
    statTile('Verschmolzen', fmt(p.merges | 0)),
    statTile('Etappen', fmt(Math.max(0, p.levelMax - 1))),
    statTile('Sterne', fmt(P.totalStars())),
    statTile('Album', `${alb.have}/${alb.total}`));
  return showModal({ title: 'Statistik', content: h('div', null, table, tiles), buttons: [{ label: 'Schliessen', value: true, ghost: true }] });
}

function statTile(label, value) {
  return h('div.stile', null, h('b', null, value), h('span', null, label));
}

// ---------- Etappen-Karte ----------

export function mountMap(app, nav) {
  const p = P.getProg();
  app.className = 'app map';
  app.textContent = '';
  const starChip = h('div.chip.star-chip');
  starChip.innerHTML = icon('star', { size: 16 });
  starChip.append(String(P.totalStars()));
  const top = h('header.topbar', null, backButton('#', () => nav.menu()), h('div.title', null, 'Etappen'), starChip);
  const scroll = h('main.scroll.map-scroll');
  app.append(top, scroll);
  const cur = p.levelMax;
  const curInfo = chapterOf(cur);
  const save = P.loadSave('etappe');
  let curBtn = null;
  for (let g = 0; g <= curInfo.gci + 1; g++) {
    const ch = chapters[g % chapters.length];
    const first = g * LEVELS_PER_CHAPTER + 1;
    const locked = first > cur;
    let got = 0;
    for (let k = 0; k < LEVELS_PER_CHAPTER; k++) got += p.levelStars[first + k] | 0;
    const skin = skinById(ch.skin);
    const card = h('section.card.chapter' + (locked ? '.locked' : ''));
    card.style.setProperty('--ch', skin.tiles[4].color);
    card.append(h('div.ch-head', null,
      h('div.lv-icon', null, ch.icon),
      h('div.grow', null, h('b', null, chapterTitle(g)), h('span', null, `Etappe ${first}–${first + LEVELS_PER_CHAPTER - 1}`)),
      h('div.ch-stars', null, `★ ${got}/${LEVELS_PER_CHAPTER * 3}`)));
    const grid = h('div.lv-grid');
    for (let k = 0; k < LEVELS_PER_CHAPTER; k++) {
      const n = first + k;
      const st = p.levelStars[n] | 0;
      const isLocked = n > cur;
      const b = h('button.lv' + (isLocked ? '.locked' : '') + (n === cur ? '.current' : '') + (st ? '.done' : ''), { type: 'button', 'aria-label': `Etappe ${n}` });
      if (isLocked) b.innerHTML = icon('lock', { size: 16 });
      else {
        b.append(h('b', null, String(n)));
        const ss = h('span.mini-stars');
        ss.textContent = st ? '★'.repeat(st) + '☆'.repeat(3 - st) : (save && save.n === n && save.state && save.state.moves > 0 ? '•••' : '');
        b.append(ss);
      }
      b.addEventListener('click', () => {
        if (isLocked) {
          sfx.play('error');
          b.classList.remove('sp-shake'); void b.offsetWidth; b.classList.add('sp-shake');
          toast(`Schaffe zuerst Etappe ${cur}.`);
          return;
        }
        sfx.play('click');
        P.dropFinished('etappe');
        nav.level(n);
      });
      if (n === cur) curBtn = b;
      grid.append(b);
    }
    card.append(grid);
    scroll.append(card);
  }
  if (curBtn) requestAnimationFrame(() => curBtn.scrollIntoView({ block: 'center' }));
  return { destroy() {} };
}

// ---------- Album ----------

export function mountAlbum(app, nav, skinId) {
  const p = P.getProg();
  app.className = 'app album';
  app.textContent = '';
  const alb = P.albumCount();
  const top = h('header.topbar', null, backButton('#', () => nav.menu()),
    h('div.title-wrap', null, h('div.title', null, 'Album'), h('div.subtitle', null, `${alb.have} von ${alb.total} entdeckt`)),
    soundButton());
  const chips = h('div.chip-row');
  const body = h('main.scroll.album-scroll');
  app.append(top, chips, body);
  let sel = skinById(skinId || p.skin).id;

  function render() {
    chips.textContent = '';
    for (const s of skins) {
      const have = Math.min(s.tiles.length, p.album[s.id] || 0);
      const c = h('button.chip' + (s.id === sel ? '.active' : ''), { type: 'button' }, `${s.icon} ${s.title}`, h('small', null, ` ${have}/${s.tiles.length}`));
      c.addEventListener('click', () => { sfx.play('click'); sel = s.id; render(); });
      chips.append(c);
    }
    const skin = skinById(sel);
    const have = p.album[skin.id] || 0;
    body.textContent = '';
    const grid = h('div.album-grid');
    skin.tiles.forEach((t, i) => {
      const e = i + 1;
      const known = e <= have;
      const cell = h('div.album-cell' + (known ? '' : '.unknown'));
      if (known) cell.append(h('div.at', null, tileFace(skin, e)));
      else cell.append(h('div.at', null, h('div.face.mystery', null, h('span', null, '?'))));
      cell.append(h('b', null, known ? (t.name || fmt(valueOf(e))) : '???'), h('span', null, fmt(valueOf(e))));
      grid.append(cell);
    });
    body.append(grid);
    const note = have >= skin.tiles.length
      ? 'Alles entdeckt – grossartig!'
      : 'Neue Kacheln entdeckst du, indem du sie im Spiel baust.';
    body.append(h('p.album-note', null, note));
    if (p.skin !== skin.id) {
      const use = h('button.btn.primary.block', { type: 'button' }, `Stil «${skin.title}» verwenden`);
      use.addEventListener('click', () => { P.saveProg({ skin: skin.id }); sfx.play('pop'); toast(`Stil «${skin.title}» aktiv`); render(); });
      body.append(use);
    } else {
      body.append(h('p.album-note.active-note', null, '✓ Dieser Stil ist im freien Spiel aktiv.'));
    }
    const active = chips.querySelector('.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  render();
  return { destroy() {} };
}
