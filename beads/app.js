// Perlenbild – Einstieg: Bildschirme und Hash-Routing.
//
//   #menu        Startbildschirm
//   #play/5      Level 5 (Neuladen setzt den Spielstand fort)
//   #album       Sammlung fertiger Bilder
//   #photo       Eigenes Foto erstellen + Liste (#photo/list: gleich zur Liste scrollen)
//   #foto/<id>   eigenes Foto spielen

import { setupPage, h, icon, toast, showModal, soundButton, backButton } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { tutorialSeen } from '../shared/tutorial.js';
import { showHowto, maybeShowHowto } from './howto.js';
import { tagline } from './data/texts.js';
import { kv } from '../shared/idb.js';
import { parsePattern, isValidPattern, levelConfig, Game } from './level.js';
import { fixtures } from './engine-fixtures.js';
import { drawPicture } from './gems.js';
import { PlayScreen } from './play.js';
import { PhotoScreen } from './photo-screen.js';
import {
  getProgress, updateProgress, loadRun, saveRun, clearRun, getPhotos, setPhotos, totalStars, report,
} from './progress.js';

setupPage();
const app = document.getElementById('app');
let current = null;
let routeToken = 0;

// ---------------------------------------------------------------- Muster-Bibliothek

let libPromise = null;

/** Lädt die Bibliothek (parallel von einem anderen Team gebaut) – mit Ersatz-Mustern als Rückfall. */
export function loadLibrary() {
  if (!libPromise) {
    libPromise = (async () => {
      let list = [];
      try {
        const m = await import('./art/index.js');
        const raw = m.patterns || m.default || [];
        if (Array.isArray(raw)) {
          for (const e of raw) {
            if (!e || typeof e !== 'object' || typeof e.id !== 'string') continue;
            if (isValidPattern(e) || typeof e.load === 'function') list.push(e);
          }
        }
      } catch { /* Bibliothek nicht vorhanden – Ersatz-Muster verwenden */ }
      if (!list.length) list = fixtures.slice();
      return list;
    })();
  }
  return libPromise;
}

const resolved = new Map();
async function resolveEntry(e) {
  if (isValidPattern(e)) return e;
  if (resolved.has(e.id)) return resolved.get(e.id);
  const data = await e.load();
  const p = { id: e.id, title: e.title, category: e.category, ...(data && data.default ? data.default : data) };
  if (!isValidPattern(p)) throw new Error('Muster ungültig: ' + e.id);
  resolved.set(e.id, p);
  return p;
}

async function levelPattern(n) {
  const lib = await loadLibrary();
  const entry = lib[(n - 1) % lib.length];
  try {
    return parsePattern(await resolveEntry(entry));
  } catch {
    return parsePattern(fixtures[(n - 1) % fixtures.length]);
  }
}

// ---------------------------------------------------------------- Router

function clearScreen() {
  if (current && current.destroy) current.destroy();
  current = null;
  for (const m of document.querySelectorAll('.sp-modal-backdrop')) m.remove();
  app.replaceChildren();
}

async function route() {
  const token = ++routeToken;
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  clearScreen();
  try {
    if (name === 'play') await showLevel(parseInt(arg, 10), token);
    else if (name === 'foto') await showPhotoLevel(arg, token);
    else if (name === 'album') await showAlbum(token);
    else if (name === 'photo') await showPhoto(token, arg);
    else await showMenu(token);
  } catch (err) {
    console.warn(err);
    if (token === routeToken && name) {
      toast('Das hat nicht geklappt');
      location.replace('#menu');
    }
  }
}

window.addEventListener('hashchange', route);

/** Navigiert zu href – auch wenn der Hash schon stimmt (z. B. nach replaceState beim Gewinn). */
function go(href) {
  if (location.hash === href) route();
  else location.hash = href;
}

/** Ändert den Hash ohne Neuaufbau: ein Neuladen landet dann gleich am richtigen Ort. */
function markHash(href) {
  try { history.replaceState(history.state, '', href); } catch { /* egal */ }
}

const farben = (k) => `${k} ${k === 1 ? 'Farbe' : 'Farben'}`;

function topbar(backHref, title, ...extra) {
  return h('header.topbar', null, backButton(backHref), h('div.title.center', null, title), ...extra, soundButton());
}

// ---------------------------------------------------------------- Startbildschirm

async function showMenu(token) {
  const p = getProgress();
  report(p);
  const n = p.level;
  const L = await levelPattern(n);
  if (token !== routeToken) return;

  let filled = null;
  let pct = 0;
  const run = loadRun('L' + n);
  if (run && run.patternId === L.id) {
    const g = Game.restore(L, run.state);
    if (g && !g.complete) { filled = g.filledMask(); pct = g.progress; }
  }

  const lib = await loadLibrary();
  if (token !== routeToken) return;
  const doneCount = lib.filter((e) => p.done[e.id]).length;
  const perfect = lib.filter((e) => (p.done[e.id] | 0) >= 3).length;

  // Titelbild: Live-Vorschau des aktuellen Levels (Geister + schon gelegte Steine)
  const art = h('div.bp-menu-art');
  const cv = h('canvas', { 'aria-hidden': 'true' });
  art.append(cv);
  if (pct > 0) art.append(h('span.pct', null, `${Math.round(pct * 100)} %`));
  const box = 158;
  drawPicture(cv, L, {
    filled: filled || new Uint8Array(L.W * L.H),
    size: L.H > L.W ? box * L.W / L.H : box, pad: 0.02,
    ghostMix: Math.max(L.W, L.H) > 20 ? 0.36 : 0.5, ghostR: Math.max(L.W, L.H) > 20 ? 0.4 : 0.34,
  });

  const go = (href) => () => { location.hash = href; };
  const sections = [];
  const recent = (p.recent || []).map((id) => lib.find((e) => e.id === id)).filter(Boolean).slice(0, 4);
  if (recent.length) {
    const row = h('div.bp-recent');
    for (const e of recent) {
      const a = h('a', { href: '#album', 'aria-label': e.title || 'Bild' });
      row.append(a);
      resolveEntry(e).then((pat) => {
        if (token !== routeToken) return;
        const PL = parsePattern(pat);
        const c = h('canvas');
        a.append(c);
        const w = (a.clientWidth || 70) - 10;
        drawPicture(c, PL, { size: PL.H > PL.W ? w * PL.W / PL.H : w, pad: 0.04 });
      }).catch(() => {});
    }
    sections.push(menuSection('Zuletzt gelegt', row));
  }

  app.append(gameMenu({
    id: 'beads',
    title: 'Perlenbild',
    tagline,
    accent: '#3f8ef0',
    art,
    primary: {
      label: `${pct > 0 ? 'Weiter' : 'Spielen'} – Level ${n}`,
      sub: pct > 0 ? `${L.title} · ${Math.round(pct * 100)} % gelegt`
        : L.title.length > 11 ? `${L.title} · ${farben(L.K)}` : `${L.title} · ${L.total} Perlen · ${farben(L.K)}`,
      onClick: go('#play/' + n),
    },
    secondary: [
      { label: 'Sammlung', icon: 'grid', sub: `${doneCount} von ${lib.length}`, onClick: go('#album') },
      { label: 'Eigenes Foto', icon: 'camera', sub: 'Aus deinen Bildern', onClick: go('#photo') },
    ],
    stats: [
      { label: 'Bilder', value: doneCount },
      { label: 'Sterne', value: totalStars(p) },
      { label: 'Perfekt', value: perfect },
      { label: 'Perlen', value: p.beads.toLocaleString('de-CH') },
    ],
    sections,
    onHelp: () => showHowto(),
    backHref: '../',
  }));

  if (!tutorialSeen('beads')) setTimeout(() => { if (token === routeToken) maybeShowHowto(); }, 350);
}

// ---------------------------------------------------------------- Level spielen

async function showLevel(n, token) {
  const p = getProgress();
  if (!(n >= 1) || n > p.level) { location.replace('#play/' + p.level); return; }
  if (!tutorialSeen('beads')) maybeShowHowto();
  const L = await levelPattern(n);
  if (token !== routeToken) return;
  const key = 'L' + n;
  const run = loadRun(key);
  let game = run && run.patternId === L.id ? Game.restore(L, run.state) : null;
  if (!game || game.complete) {
    const round = Math.floor((n - 1) / (await loadLibrary()).length);
    game = Game.create(L, { ...levelConfig(L, n, { round }), seed: `beads:${L.id}:${n}` });
  }
  const opts = {
    game,
    title: `Level ${n}`,
    subtitle: L.title,
    backHref: '#menu',
    onHelp: () => showHowto(),
    coach: n === 1 && game.st.placed === 0,
    save: (state) => saveRun(key, { patternId: L.id, state, t: Date.now() }),
    onComplete: (g, stars) => {
      clearRun(key);
      const q = updateProgress((pp) => {
        pp.done[L.id] = Math.max(pp.done[L.id] | 0, stars);
        pp.beads += L.total;
        pp.recent = [L.id, ...(pp.recent || []).filter((x) => x !== L.id)].slice(0, 8);
        if (n >= pp.level) pp.level = n + 1;
      });
      report(q);
      // «Weiter» führt zum aktuellen Level (nach einem Nochmals-Legen aus der Sammlung
      // also zurück dorthin, wo man stand) – und ein Neuladen auf dem Gewinn-Blatt auch.
      nextHref = '#play/' + q.level;
      if (q.level !== n + 1) opts.nextLabel = `Zu Level ${q.level}`;
      markHash(nextHref);
    },
    onNext: () => go(nextHref),
    onReplay: () => go('#play/' + n),
    onAlbum: () => go('#album'),
  };
  let nextHref = '#play/' + (n + 1);
  current = new PlayScreen(app, opts);
}

async function showPhotoLevel(id, token) {
  const meta = getPhotos().find((x) => x.id === id);
  const pat = meta ? await kv.get('beads.photo.' + id) : null;
  if (token !== routeToken) return;
  if (!meta || !pat || !isValidPattern(pat)) {
    toast('Foto nicht gefunden');
    location.replace('#photo');
    return;
  }
  const L = parsePattern(pat);
  const key = 'P' + id;
  const run = loadRun(key);
  let game = run && run.patternId === L.id ? Game.restore(L, run.state) : null;
  if (!game || game.complete) game = Game.create(L, { ...levelConfig(L, 1, { custom: true }), seed: 'photo:' + id });
  current = new PlayScreen(app, {
    game,
    title: meta.title || 'Mein Foto',
    backHref: '#photo',
    onHelp: () => showHowto(),
    save: (state) => saveRun(key, { patternId: L.id, state, t: Date.now() }),
    onComplete: (g, stars) => {
      clearRun(key);
      setPhotos(getPhotos().map((x) => (x.id === id ? { ...x, stars: Math.max(x.stars | 0, stars) } : x)));
      updateProgress((pp) => { pp.beads += L.total; });
      markHash('#photo/list');
    },
    nextLabel: 'Fertig',
    onNext: () => go('#photo/list'),
    onReplay: () => go('#foto/' + id),
    onAlbum: () => go('#album'),
  });
}

// ---------------------------------------------------------------- Sammlung

function miniStars(n) {
  const el = h('div.mini-stars', { 'aria-label': `${n} von 3 Sternen` });
  for (let i = 0; i < 3; i++) {
    const s = h('span' + (i < n ? '.on' : ''));
    s.innerHTML = icon('star', { size: 15 });
    el.append(s);
  }
  return el;
}

function thumb(box, L) {
  const cv = h('canvas');
  box.append(cv);
  requestAnimationFrame(() => {
    const w = box.clientWidth || 140;
    drawPicture(cv, L, { size: L.H > L.W ? w * L.W / L.H : w, pad: 0.05 });
  });
}

function showPictureSheet(L, stars, playHref, playLabel) {
  const cv = h('canvas');
  drawPicture(cv, L, { size: Math.min(250, window.innerWidth - 110), pad: 0.06 });
  const content = h('div.bp-win', null, miniStars(stars), cv);
  return showModal({
    title: L.title,
    content,
    buttons: [
      { label: playLabel, value: 'play', primary: true, icon: 'refresh' },
      { label: 'Schliessen', value: 'close', ghost: true },
    ],
  }).then((v) => { if (v === 'play') location.hash = playHref; });
}

async function showAlbum(token) {
  const lib = await loadLibrary();
  if (token !== routeToken) return;
  const p = getProgress();
  const doneCount = lib.filter((e) => p.done[e.id]).length;
  const grid = h('div.bp-grid');
  const main = h('main.bp-album', null,
    h('p.sub', null, `${doneCount} von ${lib.length} Bildern fertig`));
  if (!doneCount) {
    const btn = h('a.btn.primary', { href: '#play/' + p.level }, `Spielen – Level ${p.level}`);
    const ic = h('div.ic');
    ic.innerHTML = icon('grid');
    main.append(h('div.card.bp-empty', null, ic,
      h('p', null, 'Hier sammeln sich deine fertigen Perlenbilder.'), btn));
  }
  main.append(grid);
  app.append(topbar('#menu', 'Sammlung'), h('div.scroll', null, main));

  const locked = h('div.bp-locked');
  let lockedCount = 0;
  for (let i = 0; i < lib.length; i++) {
    const e = lib[i];
    const stars = p.done[e.id] | 0;
    if (!stars) {
      lockedCount++;
      const isNext = i + 1 === p.level;
      const tile = h(isNext ? 'a.next' : 'div', isNext ? { href: '#play/' + (i + 1), 'aria-label': `Level ${i + 1} spielen` } : { 'aria-label': 'Noch nicht gelegt' });
      tile.innerHTML = icon(isNext ? 'play' : 'lock', { size: 20 });
      tile.append(h('b', null, String(i + 1)));
      locked.append(tile);
      continue;
    }
    const box = h('div.pic');
    const card = h('button.bp-card', { type: 'button' }, box, h('b', null, e.title || 'Bild'), miniStars(stars));
    grid.append(card);
    let L = null;
    try { L = parsePattern(await resolveEntry(e)); } catch { continue; }
    if (token !== routeToken) return;
    thumb(box, L);
    card.addEventListener('click', () => showPictureSheet(L, stars, '#play/' + (i + 1), 'Nochmals legen'));
  }
  if (lockedCount) main.append(h('h3', null, 'Noch zu entdecken'), locked);

  const photos = getPhotos().filter((x) => x.stars > 0);
  if (photos.length) {
    const pg = h('div.bp-grid');
    main.append(h('h3', null, 'Meine Fotos'), pg);
    for (const ph of photos) {
      const pat = await kv.get('beads.photo.' + ph.id);
      if (token !== routeToken) return;
      if (!pat || !isValidPattern(pat)) continue;
      const L = parsePattern(pat);
      const box = h('div.pic');
      const card = h('button.bp-card', { type: 'button' }, box, h('b', null, ph.title || 'Mein Foto'), miniStars(ph.stars));
      pg.append(card);
      thumb(box, L);
      card.addEventListener('click', () => showPictureSheet(L, ph.stars, '#foto/' + ph.id, 'Nochmals legen'));
    }
  }
}

// ---------------------------------------------------------------- Eigenes Foto

async function showPhoto(token, arg) {
  current = new PhotoScreen(app, { topbar, focusList: arg === 'list' });
}

route();
