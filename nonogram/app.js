// Bilderrätsel – Menü, Pakete, Album, Statistik und Routing.
//
// Routen:  (leer) Menü · #play/<id> Rätsel · #daily Tagesrätsel · #endless/<grösse>
//          #pack/<id> Paket · #album Album · #stats Statistik

import { h, icon, setupPage, backButton, showModal, toast } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { todayKey, isDailyDone, dailyStreak } from '../shared/storage.js';
import {
  packs, allPacks, packById, loadBeadsPack, getBeadsPack, lookup, loadPuzzle, indexInPack, libraryCount, ENDLESS_SIZES,
} from './core/library.js';
import { drawThumb } from './board.js';
import { createPlay, openSettings } from './play.js';
import { showHelp, maybeHelp } from './help.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
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
// Tiefer gehen (Menü → Rätsel/Paket/Album) legt einen Verlaufseintrag an, damit die Zurück-Geste
// von Safari im Spiel bleibt. Die Zurück-Knöpfe nehmen – wenn möglich – denselben Eintrag zurück.

function go(hash, push = false) {
  const target = hash && hash !== '#' ? hash : '';
  const cur = location.hash || '';
  if (cur !== target) {
    const url = location.pathname + location.search + target;
    if (push) history.pushState({ from: cur }, '', url);
    else history.replaceState(history.state, '', url);
  }
  route();
}

/** Zurück zu `hash`: per history.back(), wenn wir von dort kamen, sonst ersetzen. */
function goBack(hash) {
  const target = hash && hash !== '#' ? hash : '';
  const st = history.state;
  if (st && st.from === target && (location.hash || '') !== target) { history.back(); return; }
  go(target);
}

/** Von wo wurde das laufende Rätsel geöffnet? (Paket oder Album, sonst Menü) */
function originOf() {
  const from = (history.state && history.state.from) || '';
  return /^#(pack\/[a-z0-9-]+|album)$/.test(from) ? from : '';
}

function setScreen(el, name, play = null) {
  if (current && current.play) current.play.destroy();
  app.replaceChildren(el);
  current = { name, el, play };
  document.body.classList.toggle('nono-play', name === 'play');
  el.classList.add('enter');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
  if (play) play.mount();
}

function updateSummary() { save.updateSummary(libraryCount()); }

const importBeads = () => import('../beads/art/index.js');
/** Perlen-Paket laden (falls nötig) und danach fn ausführen. */
function withBeads(fn) {
  if (getBeadsPack()) { fn(); return; }
  loadBeadsPack(importBeads).then(() => fn(), () => fn());
}

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

// ---------- Menü (gemeinsamer Startbildschirm) ----------

/** Hauptknopf + Titelbild: «Weiter» mit Live-Vorschau oder «Spielen» mit dem nächsten Bild. */
function heroParts() {
  const res = resumeInfo();
  if (res) {
    const def = res.hit.def;
    const cv = h('canvas');
    drawThumb(cv, def, { mode: 'progress', cells: res.pr.c, size: 92 });
    const art = h('div.nono-art', null, cv, h('span.nono-pct', null, progressPct(def, res.pr.c) + ' %'));
    return {
      art,
      primary: {
        label: 'Weiter', icon: 'play',
        sub: `${labelFor(res.hit, res.id)} · ${def.rows[0].length}×${def.rows.length} · ${save.formatTime(res.pr.t || 0)}`,
        onClick: () => go('#play/' + res.id, true),
      },
    };
  }
  const nxt = nextUnsolved();
  const def = nxt ? nxt.def : packs[0].puzzles[0];
  const hit = lookup(def.id);
  return {
    art: null,
    primary: {
      label: 'Spielen', icon: 'play',
      sub: `${labelFor(hit, def.id)} · ${def.rows[0].length}×${def.rows.length}`,
      onClick: () => go('#play/' + def.id, true),
    },
  };
}

function dailyInfo() {
  const day = todayKey();
  const done = isDailyDone('nonogram');
  const dpr = save.loadProgress('daily-' + day);
  const size = lookup('daily-' + day).def.rows.length;
  return {
    done,
    streak: dailyStreak('nonogram'),
    sub: !done && dpr && !dpr.s ? `Weiter · ${save.formatTime(dpr.t || 0)}` : `${size}×${size} · ${longDate()}`,
    onClick: () => go('#daily', true),
  };
}

function renderMenu() {
  const solved = save.solvedMap();
  const solvedLib = () => allPacks().reduce((n, p) => n + p.puzzles.filter((d) => solved[d.id]).length, 0);
  const st = save.getStats();

  // Pakete
  const packList = h('div.packs');
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
    b.addEventListener('click', () => { sfx.play('tap'); go('#pack/' + pack.id, true); });
    return b;
  };
  for (const p of packs) packList.append(packCard(p));
  if (getBeadsPack()) packList.append(packCard(getBeadsPack()));

  // Endlos
  const endless = h('div.card.endless', null,
    h('div.endless-h', null, h('span.endless-ic', { html: svg(IC.infinity, 22) }),
      h('div', null, h('b', null, 'Endlos-Bilder'), h('small', null, 'Immer neue Fantasiewesen und Mosaike'))),
    h('div.size-row', null, ...ENDLESS_SIZES.map((sz) => {
      const b = h('button.size-btn', { type: 'button', 'data-size': sz }, h('b', null, `${sz}×${sz}`), h('small', null, `Nr. ${save.endlessNext(sz)}`));
      b.addEventListener('click', () => { sfx.play('tap'); go('#endless/' + sz, true); });
      return b;
    })));

  const statsList = () => [
    { label: 'Bilder', value: `${solvedLib()}/${libraryCount()}` },
    { label: 'Ohne Hilfe', value: st.perfect },
    { label: 'Tage-Serie', value: dailyStreak('nonogram') },
    { label: 'Gesamtzeit', value: save.formatTime(st.time) },
  ];

  const hero = heroParts();
  const menu = gameMenu({
    id: 'nonogram',
    title: 'Bilderrätsel',
    tagline: 'Zahlen lösen, Bild entdecken',
    accent: '#e0699a',
    art: hero.art,
    primary: hero.primary,
    daily: dailyInfo(),
    secondary: [
      { label: 'Album', sub: `${Object.keys(solved).length} Bilder`, icon: 'image', onClick: () => go('#album', true) },
      { label: 'Statistik', icon: 'star', onClick: () => go('#stats', true) },
      { label: 'Optionen', icon: 'settings', onClick: () => openSettings() },
    ],
    stats: statsList(),
    sections: [
      menuSection('Bildersammlungen', packList),
      menuSection('Endlos', endless),
      h('p.foot', null, 'Jedes Bild lässt sich ohne Raten lösen.'),
    ],
    onHelp: () => showHelp(),
    backHref: '../',
  });
  menu.classList.add('screen', 'menu');
  setScreen(menu, 'menu');
  updateSummary();

  // Perlen-Paket nachladen: Karte ergänzen, Zähler und ggf. «Weiter» (p-…) aktualisieren
  if (!getBeadsPack()) {
    loadBeadsPack(importBeads).then((bp) => {
      if (!bp || !menu.isConnected) return;
      packList.append(packCard(bp));
      const hp = heroParts();
      const art = menu.querySelector('.gm-art');
      if (art && hp.art) { art.replaceChildren(hp.art); art.classList.add('custom'); }
      menu.update({ primary: hp.primary, stats: statsList() });
      updateSummary();
    });
  }
  maybeHelp();
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
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); goBack(''); }),
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
    tile.addEventListener('click', () => { sfx.play('tap'); go('#play/' + def.id, true); });
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
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); goBack(''); }),
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
    go('#play/' + e.id, true);
  }
}

// ---------- Statistik ----------

function renderStats() {
  const top = h('header.topbar', null, backButton('#', () => { sfx.play('click'); goBack(''); }),
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
    await loadBeadsPack(importBeads);
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
  // Coach-Mark nur beim allerersten Bild, solange es noch nie angefangen wurde
  const coach = id === packs[0].puzzles[0].id && !save.loadProgress(id) && !save.isSolved(id);
  const play = createPlay({
    id, puzzle, kind, label, pack, coach,
    day: loaded.day, size: loaded.size, n: loaded.n,
    // Zurück dorthin, wo das Rätsel geöffnet wurde (Paket/Album), sonst ins Menü
    onBack: (fromWin) => goBack(fromWin ? '' : originOf()),
    onNext,
    onSolved: updateSummary,
  });
  setScreen(play.el, 'play', play);
  window.__nono = play;
  maybeHelp();
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
    if (m[1] === 'perlen') withBeads(() => renderPack(m[1]));
    else renderPack(m[1]);
  } else if (hash === 'album') withBeads(renderAlbum);
  else if (hash === 'stats') withBeads(renderStats);
  else renderMenu();
}

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', (e) => { if (e.persisted) route(); });
route();
