// Bilderrätsel – Menü, Pakete, Album, Statistik und Routing.
//
// Routen:  (leer) Menü · #play/<id> Rätsel · #daily Tagesrätsel · #endless/<grösse>
//          #pack/<id> Paket · #album Album · #stats Statistik

import { h, icon, setupPage, soundButton, backButton, showModal, toast } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { todayKey, isDailyDone, dailyStreak } from '../shared/storage.js';
import {
  packs, allPacks, packById, loadBeadsPack, getBeadsPack, lookup, loadPuzzle, indexInPack, libraryCount, ENDLESS_SIZES,
} from './core/library.js';
import { drawThumb } from './board.js';
import { createPlay, openSettings } from './play.js';
import { showHelp } from './help.js';
import * as save from './save.js';

setupPage();

const app = document.getElementById('app');
let current = null;   // { name, el, play? }

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const longDate = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
const SIZE_NAMES = { 5: 'Mini', 10: 'Klein', 15: 'Mittel', 20: 'Gross' };
const svg = (body, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const IC = {
  stats: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  album: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 15l4.5-4 4 3.5 3-2.5 5 4"/><circle cx="15.5" cy="9.3" r="1.4"/>',
  infinity: '<path d="M7.5 15.5c-2 0-3.5-1.6-3.5-3.5S5.5 8.5 7.5 8.5c3.5 0 5.5 7 9 7 2 0 3.5-1.6 3.5-3.5s-1.5-3.5-3.5-3.5c-3.5 0-5.5 7-9 7z"/>',
};

// ---------- Navigation ----------

function go(hash) {
  const target = hash && hash !== '#' ? hash : '';
  if ((location.hash || '') !== target) history.replaceState(null, '', location.pathname + location.search + target);
  route();
}

function setScreen(el, name, play = null) {
  if (current && current.play) current.play.destroy();
  app.replaceChildren(el);
  current = { name, el, play };
  el.classList.add('enter');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
  if (play) play.mount();
}

function updateSummary() { save.updateSummary(libraryCount()); }

/** Weitermachen: laufendes, nicht gelöstes Rätsel (zuletzt gespielt). */
function resumeInfo() {
  const id = save.lastPlayed();
  if (!id || /^daily-/.test(id)) return null;
  const pr = save.loadProgress(id);
  if (!pr || pr.s) return null;
  const hit = lookup(id);
  if (!hit) return null;
  return { id, hit, pr };
}

/** Nächstes ungelöstes Bild (Paket-Reihenfolge), optional ab einem bestimmten Bild. */
function nextUnsolved(packId = null, afterId = null) {
  const solved = save.solvedMap();
  const list = allPacks();
  let start = 0;
  if (packId) start = Math.max(0, list.findIndex((p) => p.id === packId));
  for (let k = 0; k < list.length; k++) {
    const pack = list[(start + k) % list.length];
    let defs = pack.puzzles;
    if (k === 0 && afterId) {
      const i = defs.findIndex((d) => d.id === afterId);
      defs = [...defs.slice(i + 1), ...defs.slice(0, Math.max(0, i))];
    }
    const d = defs.find((x) => !solved[x.id]);
    if (d) return { def: d, pack };
  }
  return null;
}

function labelFor(hit, id) {
  if (hit.kind === 'daily') return 'Tagesrätsel';
  if (hit.kind === 'endless') return `Endlos ${hit.size}×${hit.size} · Nr. ${hit.n}`;
  return `${hit.pack.title} · Nr. ${indexInPack(hit.pack, id)}`;
}

// ---------- Menü ----------

function renderMenu() {
  const top = h('header.topbar', null, backButton('../'), h('div.title.center', null, 'Bilderrätsel'), soundButton());
  const solved = save.solvedMap();
  const total = libraryCount();
  const solvedLib = allPacks().reduce((n, p) => n + p.puzzles.filter((d) => solved[d.id]).length, 0);

  // Held: Weiter oder Spielen
  const res = resumeInfo();
  const nxt = res ? null : nextUnsolved();
  const heroDef = res ? res.hit.def : nxt ? nxt.def : packs[0].puzzles[0];
  const heroId = res ? res.id : heroDef.id;
  const thumb = h('canvas.hero-thumb');
  if (res) drawThumb(thumb, heroDef, { mode: 'progress', cells: res.pr.c, size: 92 });
  else drawThumb(thumb, heroDef, { mode: 'progress', cells: null, size: 92 });
  const heroHit = res ? res.hit : lookup(heroId);
  const pct = res ? progressPct(heroDef, res.pr.c) : 0;
  const playBtn = h('button.btn.primary.block.big#play-btn', { type: 'button' });
  playBtn.innerHTML = icon('play', { size: 22 });
  playBtn.append(res ? 'Weiter' : 'Spielen');
  playBtn.addEventListener('click', () => { sfx.play('tap'); go('#play/' + heroId); });
  const hero = h('section.card.hero', null,
    h('div.hero-row', null,
      h('div.hero-pic', null, thumb, !res ? h('span.hero-q', null, '?') : null),
      h('div.hero-info', null,
        h('div.kicker', null, res ? 'Angefangen' : solvedLib ? 'Nächstes Bild' : 'Willkommen'),
        h('div.hero-title', null, labelFor(heroHit, heroId)),
        h('div.hero-meta', null, res ? `${heroDef.rows[0].length} × ${heroDef.rows.length} · ${save.formatTime(res.pr.t || 0)}` : `${heroDef.rows[0].length} × ${heroDef.rows.length} Felder · welches Bild versteckt sich?`),
        res ? h('div.bar', null, h('i', { style: { width: pct + '%' } })) : null)),
    playBtn);

  // Tagesrätsel
  const day = todayKey();
  const done = isDailyDone('nonogram');
  const streak = dailyStreak('nonogram');
  const dpr = save.loadProgress('daily-' + day);
  const dIc = h('div.daily-ic');
  dIc.innerHTML = `<span class="m">${MONTHS[new Date().getMonth()].slice(0, 3).toUpperCase()}</span><span class="d">${new Date().getDate()}</span>`;
  const dState = h('div.daily-state', { class: done ? 'daily-state ok' : 'daily-state' });
  dState.innerHTML = done ? icon('check', { size: 20, stroke: 3 }) : icon('play', { size: 18 });
  const dSize = lookup('daily-' + day).def.rows.length;
  const daily = h('button.card.daily#daily-card', { type: 'button', class: done ? 'card daily done' : 'card daily' },
    dIc,
    h('div.daily-info', null,
      h('b', null, 'Tagesrätsel'),
      h('span', null, longDate()),
      h('small', null, done ? `Gelöst ✓${streak > 1 ? ` · Serie: ${streak} Tage` : ''}`
        : dpr && !dpr.s ? `Weiter · ${save.formatTime(dpr.t || 0)}`
          : `${dSize} × ${dSize} · für alle gleich${streak ? ` · Serie: ${streak}` : ''}`)),
    dState);
  daily.addEventListener('click', () => { sfx.play('tap'); go('#daily'); });

  // Pakete
  const packList = h('div.packs');
  const secCount = h('span', null, `${solvedLib}/${total}`);
  const packCard = (pack) => {
    const n = pack.puzzles.length;
    const s = pack.puzzles.filter((d) => solved[d.id]).length;
    const b = h('button.card.pack', { type: 'button', 'data-pack': pack.id },
      h('span.pack-emoji', null, pack.emoji || '🧩'),
      h('span.pack-info', null,
        h('b', null, pack.title),
        h('small', null, pack.subtitle || ''),
        h('span.bar', null, h('i', { style: { width: `${n ? (s / n) * 100 : 0}%` } }))),
      h('span.pack-count', null, s === n && n ? '✓' : `${s}/${n}`));
    if (s === n && n) b.classList.add('complete');
    b.addEventListener('click', () => { sfx.play('tap'); go('#pack/' + pack.id); });
    return b;
  };
  for (const p of packs) packList.append(packCard(p));
  if (getBeadsPack()) packList.append(packCard(getBeadsPack()));
  else {
    loadBeadsPack(() => import('../beads/art/index.js')).then((bp) => {
      if (!bp || !packList.isConnected) return;
      packList.append(packCard(bp));
      const sv = save.solvedMap();
      secCount.textContent = `${allPacks().reduce((n, p) => n + p.puzzles.filter((d) => sv[d.id]).length, 0)}/${libraryCount()}`;
      updateSummary();
    });
  }

  // Endlos
  const endless = h('section.card.endless', null,
    h('div.endless-h', null, h('span.endless-ic', { html: svg(IC.infinity, 22) }),
      h('div', null, h('b', null, 'Endlos-Bilder'), h('small', null, 'Immer neue Fantasiewesen und Mosaike'))),
    h('div.size-row', null, ...ENDLESS_SIZES.map((sz) => {
      const b = h('button.size-btn', { type: 'button', 'data-size': sz }, h('b', null, `${sz}×${sz}`), h('small', null, `Nr. ${save.endlessNext(sz)}`));
      b.addEventListener('click', () => { sfx.play('tap'); go('#endless/' + sz); });
      return b;
    })));

  const small = (ic, label, fn, idName) => {
    const b = h('button.card.mini-btn', { type: 'button', id: idName });
    b.innerHTML = `<span class="ic">${ic}</span><span>${label}</span>`;
    b.addEventListener('click', () => { sfx.play('click'); fn(); });
    return b;
  };
  const row = h('div.mini-row', null,
    small(svg(IC.album), 'Album', () => go('#album'), 'album-btn'),
    small(svg(IC.stats), 'Statistik', () => go('#stats'), 'stats-btn'),
    small(svg(IC.help), 'So geht’s', () => showHelp(), 'help-btn'),
    small(icon('settings'), 'Optionen', () => openSettings(), 'settings-btn'));

  const body = h('main.menu-body', null, hero, daily,
    h('h3.sec', null, 'Bildersammlungen', secCount),
    packList, endless, row,
    h('p.foot', null, 'Jedes Bild lässt sich ohne Raten lösen.'));
  setScreen(h('div.screen.menu', null, top, h('div.scroll', null, body)), 'menu');
  updateSummary();
  const st = save.settings.get();
  if (!st.helpSeen) {
    save.settings.set({ helpSeen: true });
    setTimeout(() => { if (current && current.name === 'menu') showHelp(); }, 400);
  }
}

function progressPct(def, cells) {
  if (!cells) return 0;
  let target = 0, ok = 0;
  const w = def.rows[0].length;
  for (let r = 0; r < def.rows.length; r++) for (let c = 0; c < w; c++) {
    if (def.rows[r][c] === '.') continue;
    target++;
    if (cells.charCodeAt(r * w + c) === 49) ok++;
  }
  return target ? Math.round((ok / target) * 100) : 0;
}

// ---------- Paket ----------

function renderPack(packId) {
  const pack = packById(packId);
  if (!pack) { go(''); return; }
  const solved = save.solvedMap();
  const s = pack.puzzles.filter((d) => solved[d.id]).length;
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); go(''); }),
    h('div.title.center', null, `${pack.emoji || ''} ${pack.title}`), h('span.top-count', null, `${s}/${pack.puzzles.length}`));
  const grid = h('div.tiles');
  pack.puzzles.forEach((def, k) => {
    const isSolved = !!solved[def.id];
    const pr = isSolved ? null : save.loadProgress(def.id);
    const cv = h('canvas.tile-cv');
    const tile = h('button.tile', { type: 'button', 'data-id': def.id, class: isSolved ? 'tile solved' : pr ? 'tile started' : 'tile' });
    if (isSolved) drawThumb(cv, def, { mode: 'color', size: 76 });
    else drawThumb(cv, def, { mode: 'progress', cells: pr ? pr.c : null, size: 76 });
    tile.append(...[h('span.tile-pic', null, cv, !isSolved && !pr ? h('span.tile-q', null, '?') : null),
      h('span.tile-lbl', null, isSolved ? def.title : `Nr. ${k + 1}`),
      isSolved && solved[def.id].p ? h('span.tile-star', { html: icon('star', { size: 14 }) }) : null].filter(Boolean));
    tile.addEventListener('click', () => { sfx.play('tap'); go('#play/' + def.id); });
    grid.append(tile);
  });
  const w = pack.puzzles[0] ? pack.puzzles[0].rows[0].length : 0;
  const body = h('main.pack-body', null,
    h('p.pack-sub', null, pack.subtitle || `${w} × ${w}`),
    grid);
  setScreen(h('div.screen.packview', null, top, h('div.scroll', null, body)), 'pack');
}

// ---------- Album ----------

function albumEntries() {
  const map = save.solvedMap();
  const groups = new Map();
  const add = (name, entry) => { if (!groups.has(name)) groups.set(name, []); groups.get(name).push(entry); };
  for (const pack of allPacks()) {
    for (const def of pack.puzzles) if (map[def.id]) add(pack.title, { id: def.id, def, info: map[def.id] });
  }
  const ids = Object.keys(map).sort();
  for (const id of ids) {
    if (/^daily-/.test(id)) { const hit = lookup(id); if (hit) add('Tagesrätsel', { id, def: hit.def, info: map[id], day: id.slice(6) }); }
  }
  for (const id of ids) {
    if (/^e\d+-/.test(id)) { const hit = lookup(id); if (hit) add('Endlos-Bilder', { id, def: hit.def, info: map[id] }); }
  }
  return groups;
}

function renderAlbum() {
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); go(''); }),
    h('div.title.center', null, 'Album'), h('span.top-count'));
  const groups = albumEntries();
  const body = h('main.album-body');
  let count = 0;
  for (const [name, list] of groups) {
    count += list.length;
    const grid = h('div.album-grid');
    for (const e of list) {
      const cv = h('canvas');
      drawThumb(cv, e.def, { mode: 'color', size: 96 });
      const b = h('button.album-item', { type: 'button' }, h('span.album-frame', null, cv), h('span.album-t', null, e.def.title));
      b.addEventListener('click', () => viewPicture(e));
      grid.append(b);
    }
    body.append(h('h3.sec', null, name, h('span', null, String(list.length))), grid);
  }
  if (!count) {
    body.append(h('div.card.empty', null,
      h('div.empty-ic', { html: svg(IC.album, 40) }),
      h('b', null, 'Noch keine Bilder'),
      h('p', null, 'Jedes gelöste Rätsel landet hier als farbiges Bild.'),
      (() => { const b = h('button.btn.primary', { type: 'button' }, 'Erstes Bild lösen'); b.addEventListener('click', () => go('')); return b; })()));
  }
  top.lastChild.textContent = count ? String(count) : '';
  setScreen(h('div.screen.album', null, top, h('div.scroll', null, body)), 'album');
}

async function viewPicture(e) {
  sfx.play('tap');
  const cv = h('canvas.big-pic');
  drawThumb(cv, e.def, { mode: 'color', size: 220 });
  const content = h('div.view-pic', null, h('div.win-frame', null, cv),
    h('p.muted', null, `${e.def.rows[0].length} × ${e.def.rows.length} · Bestzeit ${save.formatTime(e.info.t)}${e.info.n > 1 ? ` · ${e.info.n}× gelöst` : ''}${e.info.p ? ' · ★ ohne Hilfe' : ''}`));
  const v = await showModal({
    title: e.def.title, content, dismissible: true,
    buttons: [{ label: 'Nochmals spielen', value: 'again', icon: 'refresh' }, { label: 'Schliessen', value: null, primary: true }],
  });
  if (v === 'again') {
    save.clearProgress(e.id);
    go('#play/' + e.id);
  }
}

// ---------- Statistik ----------

function renderStats() {
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); go(''); }),
    h('div.title.center', null, 'Statistik'), h('span.top-count'));
  const st = save.getStats();
  const map = save.solvedMap();
  const big = (value, label) => h('div.stat', null, h('b', null, value), h('span', null, label));
  const avg = st.solved ? st.time / st.solved : 0;
  const grid = h('div.stat-grid',
    big(String(st.solved), 'Rätsel gelöst'),
    big(String(st.perfect), 'Ohne Hilfe'),
    big(String(dailyStreak('nonogram')), 'Tage in Serie'),
    big(String(Object.keys(map).filter((k) => /^daily-/.test(k)).length), 'Tagesrätsel'),
    big(save.formatTime(st.time), 'Gesamtzeit'),
    big(st.solved ? save.formatTime(avg) : '–', 'Durchschnitt'));
  const sizes = h('div.card.stat-list', null, h('h3', null, 'Bestzeiten'),
    ...[5, 10, 15, 20].map((sz) => {
      const b = st.bySize[String(sz)];
      return h('div.stat-row', null, h('span', null, `${SIZE_NAMES[sz]} · ${sz}×${sz}`),
        h('small', null, b ? `${b.solved}× gelöst` : 'noch keins'), h('b', null, b && b.best != null ? save.formatTime(b.best) : '–'));
    }));
  const packsCard = h('div.card.stat-list', null, h('h3', null, 'Sammlungen'),
    ...allPacks().map((p) => {
      const s = p.puzzles.filter((d) => map[d.id]).length;
      return h('div.stat-row', null, h('span', null, `${p.emoji || ''} ${p.title}`),
        h('span.bar.slim', null, h('i', { style: { width: `${p.puzzles.length ? (s / p.puzzles.length) * 100 : 0}%` } })),
        h('b', null, `${s}/${p.puzzles.length}`));
    }),
    h('div.stat-row', null, h('span', null, '♾️ Endlos-Bilder'), h('small', null, ''), h('b', null, String(Object.keys(map).filter((k) => /^e\d+-/.test(k)).length))));
  const extra = h('p.foot', null, `Tipps benutzt: ${st.hints} · Rätsel begonnen: ${st.started}`);
  setScreen(h('div.screen.stats', null, top, h('div.scroll', null, h('main.stats-body', null, grid, sizes, packsCard, extra))), 'stats');
}

// ---------- Spielen ----------

async function openPuzzle(id) {
  let loaded = loadPuzzle(id);
  if (!loaded && /^p-/.test(id)) {
    await loadBeadsPack(() => import('../beads/art/index.js'));
    loaded = loadPuzzle(id);
  }
  if (!loaded) { toast('Dieses Bild gibt es nicht mehr.'); go(''); return; }
  const { puzzle, kind, pack } = loaded;
  if (kind !== 'daily') save.setLastPlayed(id);
  const label = labelFor(loaded, id);
  let onNext = null;
  if (kind === 'endless') onNext = () => go(`#play/e${loaded.size}-${loaded.n + 1}`);
  else if (kind === 'library' || kind === 'beads') {
    onNext = () => {
      const nx = nextUnsolved(pack.id, id);
      if (nx) go('#play/' + nx.def.id);
      else { toast('Alle Bilder gelöst – wunderbar!'); go('#album'); }
    };
  }
  const play = createPlay({
    id, puzzle, kind, label, pack,
    day: loaded.day, size: loaded.size, n: loaded.n,
    onBack: (fromWin) => {
      if (pack && !fromWin) go('#pack/' + pack.id);
      else go('');
    },
    onNext,
    onSolved: updateSummary,
  });
  setScreen(play.el, 'play', play);
  window.__nono = play;
}

// ---------- Router ----------

function route() {
  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  window.__nono = null;
  let m;
  if ((m = /^play\/([a-z0-9-]+)$/.exec(hash))) openPuzzle(m[1]);
  else if (hash === 'daily') {
    const id = 'daily-' + todayKey();
    openPuzzle(id);
  } else if ((m = /^endless\/(\d+)$/.exec(hash))) {
    const size = Number(m[1]);
    if (!ENDLESS_SIZES.includes(size)) { go(''); return; }
    go(`#play/e${size}-${save.endlessNext(size)}`);
  } else if ((m = /^pack\/([a-z0-9-]+)$/.exec(hash))) {
    if (m[1] === 'perlen' && !getBeadsPack()) loadBeadsPack(() => import('../beads/art/index.js')).then(() => renderPack(m[1]));
    else renderPack(m[1]);
  } else if (hash === 'album') renderAlbum();
  else if (hash === 'stats') renderStats();
  else renderMenu();
}

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
route();
