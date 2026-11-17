// Perlenbild – Einstieg: Bildschirme und Hash-Routing.
//
//   #menu        Startbildschirm
//   #play/5      Level 5 (Neuladen setzt den Spielstand fort)
//   #album       Sammlung fertiger Bilder
//   #photo       Eigenes Foto erstellen + Liste
//   #foto/<id>   eigenes Foto spielen

import { setupPage, h, icon, toast, showModal, soundButton, backButton } from '../shared/ui.js';
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
    else if (name === 'photo') await showPhoto(token);
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

function topbar(backHref, title, ...extra) {
  return h('header.topbar', null, backButton(backHref), h('div.title.center', null, title), ...extra, soundButton());
}

// ---------------------------------------------------------------- So geht's

export function showHowto() {
  const step = (n, html) => {
    const p = h('p');
    p.innerHTML = html;
    return h('div.step', null, h('span.num', null, String(n)), p);
  };
  const content = h('div.bp-howto', null,
    step(1, '<b>Tippe auf eine Spalte</b> – die vordersten Steine gleicher Farbe fliegen ins Bild.'),
    step(2, 'Das Bild entsteht <b>von unten nach oben</b>. Die leuchtende Zone zeigt, welche Farben gerade gebraucht werden.'),
    step(3, 'Passt ein Stein noch nicht, wartet er in der <b>Ablage</b> und springt später von selbst ins Bild.'),
    step(4, 'Ablage voll? <b>Magnet</b>, <b>Mischen</b> und <b>+1 Ablage</b> helfen – gratis und so oft du willst.'),
  );
  return showModal({
    title: 'So geht’s',
    content,
    buttons: [{ label: 'Los geht’s', value: true, primary: true }],
  });
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

  const help = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s' });
  help.innerHTML = icon('hint');
  help.addEventListener('click', () => showHowto());

  const picBox = h('div.bp-hero-pic');
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  picBox.append(canvas);
  const playBtn = h('a.btn.primary.block', { href: '#play/' + n });
  playBtn.innerHTML = icon('play', { size: 22 });
  playBtn.append(document.createTextNode(pct > 0 ? `Weiter – Level ${n}` : `Spielen – Level ${n}`));

  const tile = (cls, href, ic, title, sub) => {
    const a = h('a.bp-tile' + cls, { href });
    a.innerHTML = `<span class="ic">${icon(ic)}</span>`;
    a.append(h('div', null, h('b', null, title), h('span', null, sub)));
    return a;
  };
  const stars = totalStars(p);
  const starEl = h('b.star');
  starEl.innerHTML = `${stars} ${icon('star', { size: 18 })}`;
  const howBtn = h('button', { type: 'button' }, 'So geht’s');
  howBtn.addEventListener('click', () => showHowto());

  app.append(
    topbar('../', 'Perlenbild', help),
    h('div.scroll', null,
      h('main.bp-menu', null,
        h('section.card.bp-hero', null,
          picBox,
          h('div.bp-hero-meta', null,
            h('span.lvl', null, `Level ${n}`),
            h('h2', null, L.title),
            h('p', null, pct > 0 ? `${Math.round(pct * 100)} % gelegt` : `${L.total} Perlen · ${L.K} Farben`)),
          playBtn),
        h('div.bp-tiles', null,
          tile('', '#album', 'grid', 'Sammlung', doneCount === 1 ? '1 Bild' : `${doneCount} Bilder`),
          tile('.photo', '#photo', 'camera', 'Eigenes Foto', 'Aus deinen Bildern')),
        h('section.card.bp-stats', null,
          h('div', null, h('b', null, String(doneCount)), h('span', null, 'Bilder fertig')),
          h('div', null, starEl, h('span', null, 'Sterne')),
          h('div', null, h('b', null, p.beads.toLocaleString('de-CH')), h('span', null, 'Perlen gelegt'))),
        h('p.bp-foot', null, 'Alle Helfer sind gratis. ', howBtn)),
    ),
  );

  const box = picBox.clientWidth || 260;
  const size = L.H > L.W ? box * L.W / L.H : box;
  drawPicture(canvas, L, { filled: filled || new Uint8Array(L.W * L.H), size, pad: 0.04, ghostMix: filled ? 0.58 : 0.32, ghostR: filled ? 0.24 : 0.3 });

  if (!p.tutorial) {
    updateProgress((q) => { q.tutorial = true; });
    setTimeout(() => { if (token === routeToken) showHowto(); }, 350);
  }
}

// ---------------------------------------------------------------- Level spielen

async function showLevel(n, token) {
  const p = getProgress();
  if (!(n >= 1) || n > p.level) { location.replace('#play/' + p.level); return; }
  const L = await levelPattern(n);
  if (token !== routeToken) return;
  const key = 'L' + n;
  const run = loadRun(key);
  let game = run && run.patternId === L.id ? Game.restore(L, run.state) : null;
  if (!game || game.complete) {
    const round = Math.floor((n - 1) / (await loadLibrary()).length);
    game = Game.create(L, { ...levelConfig(L, n, { round }), seed: `beads:${L.id}:${n}` });
  }
  current = new PlayScreen(app, {
    game,
    title: `Level ${n}`,
    subtitle: L.title,
    backHref: '#menu',
    save: (state) => saveRun(key, { patternId: L.id, state, t: Date.now() }),
    onComplete: (g, stars) => {
      clearRun(key);
      const q = updateProgress((pp) => {
        pp.done[L.id] = Math.max(pp.done[L.id] | 0, stars);
        pp.beads += L.total;
        if (n >= pp.level) pp.level = n + 1;
      });
      report(q);
    },
    onNext: () => { location.hash = '#play/' + (n + 1); },
    onAlbum: () => { location.hash = '#album'; },
  });
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
    save: (state) => saveRun(key, { patternId: L.id, state, t: Date.now() }),
    onComplete: (g, stars) => {
      clearRun(key);
      setPhotos(getPhotos().map((x) => (x.id === id ? { ...x, stars: Math.max(x.stars | 0, stars) } : x)));
      updateProgress((pp) => { pp.beads += L.total; });
    },
    nextLabel: 'Fertig',
    onNext: () => { location.hash = '#photo'; },
    onAlbum: () => { location.hash = '#album'; },
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

async function showPhoto() {
  current = new PhotoScreen(app, { topbar });
}

route();
