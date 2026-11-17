// Galerie von Farbenzauber: Kategorien-Chips, 2-spaltiges Raster mit Vorschaubildern und Fortschritt.

import { icon, h, toast, confirmDialog } from '../shared/ui.js';
import { gameMenu } from '../shared/gamemenu.js';
import { sfx } from '../shared/sfx.js';
import { store } from '../shared/storage.js';
import { allProgress, isStarted, isDone, updateSummary } from './state.js';
import { requestThumb, thumbKey, cachedThumb, setThumbLoader, forgetThumb } from './engine/thumbs.js';
import { percent } from './engine/progress.js';
import { PHOTO_CAT, TEST_CAT } from './library.js';
import { openPhotoSheet } from './photo.js';
import { showHowto } from './tutorial.js';
import { statsSummary } from './stats.js';

const NBSP = ' ';
const ALL = 'Alle', STARTED = 'Begonnen', DONE = 'Fertig';

export function createGallery(lib, { onOpen }) {
  setThumbLoader((item) => lib.loadPuzzle(item));

  const chipsEl = h('div.gv-chips', { role: 'tablist', 'aria-label': 'Kategorien' });
  const content = h('div.gv-content');
  const galSec = h('section.gm-section.gv-gal', null, h('h2.gm-section-title', null, 'Galerie'), chipsEl, content);
  const artImg = h('img', { src: '../icons/games/paint.svg', alt: '', draggable: 'false' });
  const art = h('div.gv-hero-art', null, artImg);
  const menu = gameMenu({
    id: 'paint',
    title: 'Farbenzauber',
    tagline: 'Malen nach Zahlen',
    accent: '#ff6f7d',
    art,
    sections: [galSec],
    onHelp: () => showHowto(),
    backHref: '../',
  });
  const scroll = menu.scroller;
  scroll.classList.add('gv-scroll');
  const el = h('div.view.gv', null, menu);

  let chip = store.get('paint.chip', ALL);
  let progress = new Map();
  let editPhotos = false;
  let heroId = null;
  const broken = new Set();
  const cardInfo = new WeakMap();
  const io = new IntersectionObserver(onIntersect, { root: scroll, rootMargin: '320px 0px' });

  // ---------- Startbildschirm (Hauptknopf, Nebenknöpfe, Kennzahlen) ----------

  function suggestNew() {
    const fresh = (it) => !progress.has(it.id) && !broken.has(it.id);
    for (const cat of lib.artCategories()) {
      const it = lib.artIn(cat).find(fresh);
      if (it) return it;
    }
    for (const cat of lib.genCategories()) {
      for (const g of lib.gensIn(cat)) {
        const it = lib.genList(g.id).filter((x) => x.seed < 1000).find(fresh);
        if (it) return it;
      }
    }
    return null;
  }

  function lastStarted() {
    let best = null, bts = -1;
    for (const it of lib.all()) {
      const r = progress.get(it.id);
      if (isStarted(r) && (r.ts || 0) > bts) { best = it; bts = r.ts || 0; }
    }
    return best;
  }

  function randomGen() {
    const gens = lib.gens;
    if (!gens.length) return;
    const gen = gens[Math.floor(Math.random() * gens.length)];
    const item = lib.addGenSeed(gen.id);
    if (!item) return;
    sfx.play('pop');
    onOpen(item);
  }

  async function openPhoto() {
    const item = await openPhotoSheet(lib);
    if (item) onOpen(item);
  }

  function shortTime(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min}${NBSP}Min.`;
    return `${(min / 60).toFixed(min < 600 ? 1 : 0).replace('.', ',')}${NBSP}Std.`;
  }

  function setHeroArt(item) {
    const id = item ? item.id : null;
    heroId = id;
    if (!item) { artImg.src = '../icons/games/paint.svg'; art.classList.remove('thumb'); return; }
    const rec = progress.get(item.id);
    const key = thumbKey(rec);
    const set = (url) => { if (heroId === id) { artImg.src = url; art.classList.add('thumb'); } };
    const url = cachedThumb(item.id, key);
    if (url) { set(url); return; }
    requestThumb({ item, rec, key, isWanted: () => heroId === id, onReady: set, onError: () => {} });
  }

  function updateMenu() {
    const cont = lastStarted();
    let primary;
    if (cont) {
      const r = progress.get(cont.id);
      primary = { label: 'Weitermalen', sub: `${cont.title} · ${percent(r.n, r.t)}${NBSP}%`, icon: 'play', onClick: () => onOpen(cont) };
      setHeroArt(cont);
    } else {
      const next = suggestNew();
      if (next) primary = { label: 'Spielen', sub: `Neues Bild: ${next.title}`, icon: 'play', onClick: () => onOpen(next) };
      else primary = { label: 'Spielen', sub: 'Ein neues Bild erzeugen', icon: 'sparkle', onClick: randomGen };
      setHeroArt(null);
    }
    const secondary = [];
    if (lib.photoEnabled) secondary.push({ label: 'Eigenes Foto', sub: 'Foto ausmalen', icon: 'camera', onClick: openPhoto });
    if (lib.gens.length) secondary.push({ label: 'Zufallsbild', sub: 'Neu erzeugen', icon: 'shuffle', onClick: randomGen });
    const st = statsSummary();
    const stats = !(st.fills || st.done || st.started) ? null : [
      { label: 'Fertig', value: st.done },
      { label: 'Begonnen', value: st.started },
      { label: 'Felder', value: st.fills.toLocaleString('de-CH') },
      { label: 'Malzeit', value: shortTime(st.ms) },
    ];
    menu.update({ primary, secondary, stats });
  }

  function chipList() {
    const list = [ALL, STARTED, DONE, ...lib.artCategories(), ...lib.genCategories()];
    if (lib.photoEnabled || lib.photos().length) list.push(PHOTO_CAT);
    if (lib.debug && lib.fixtures().length) list.push(TEST_CAT);
    return [...new Set(list)];
  }

  function renderChips() {
    const list = chipList();
    if (!list.includes(chip)) chip = ALL;
    chipsEl.innerHTML = '';
    for (const c of list) {
      const b = h('button.chip' + (c === chip ? '.active' : ''), { type: 'button', role: 'tab', 'aria-selected': c === chip ? 'true' : 'false' }, c);
      b.addEventListener('click', () => {
        if (c === chip) return;
        sfx.play('click');
        chip = c;
        store.set('paint.chip', c);
        renderChips();
        renderContent();
        const y = galSec.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 4;
        if (scroll.scrollTop > y) scroll.scrollTop = y;
        b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      chipsEl.append(b);
    }
  }

  // ---------- Karten ----------

  function badgeFor(rec) {
    if (isDone(rec)) return h('span.gv-done', { 'aria-label': 'Fertig', html: icon('check', { size: 16, stroke: 3 }) });
    if (isStarted(rec)) return h('span.gv-pct', null, percent(rec.n, rec.t) + NBSP + '%');
    return null;
  }

  function card(item, opts = {}) {
    const rec = progress.get(item.id);
    const img = h('img.gv-img', { alt: '', draggable: 'false', decoding: 'async' });
    img.addEventListener('load', () => img.classList.add('ready'));
    const thumb = h('div.gv-thumb', null, img, badgeFor(rec));
    const b = h('button.gv-card', { type: 'button', 'data-id': item.id, 'aria-label': item.title }, thumb, h('div.gv-name', null, item.title));
    if (isStarted(rec)) {
      const p = percent(rec.n, rec.t);
      thumb.append(h('span.gv-progress', null, h('span', { style: { width: p + '%' } })));
    }
    const key = thumbKey(rec);
    const url = cachedThumb(item.id, key);
    if (url) {
      img.src = url;
      b.classList.add('has-img');
    } else {
      cardInfo.set(b, { item, rec, key, img, thumb, visible: false, requested: false });
      io.observe(b);
    }
    let longPressed = false;
    b.addEventListener('click', () => {
      if (longPressed) { longPressed = false; return; }
      if (opts.photo && editPhotos) { askDelete(item); return; }
      sfx.play('tap');
      onOpen(item);
    });
    if (opts.photo) {
      let timer = 0, sx = 0, sy = 0;
      b.addEventListener('pointerdown', (e) => {
        longPressed = false;
        sx = e.clientX; sy = e.clientY;
        timer = setTimeout(() => { longPressed = true; sfx.play('pop'); askDelete(item); }, 560);
      });
      const cancel = () => clearTimeout(timer);
      b.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointercancel', cancel);
      b.addEventListener('pointerleave', cancel);
      if (editPhotos) {
        b.classList.add('editing');
        b.append(h('span.gv-del', { 'aria-hidden': 'true', html: icon('close', { size: 16, stroke: 3 }) }));
      }
    }
    return b;
  }

  function onIntersect(entries) {
    for (const en of entries) {
      const info = cardInfo.get(en.target);
      if (!info) continue;
      info.visible = en.isIntersecting;
      if (info.visible && !info.requested) {
        info.requested = true;
        const b = en.target;
        requestThumb({
          item: info.item, rec: info.rec, key: info.key,
          isWanted: () => info.visible && b.isConnected,
          onSkip: () => { info.requested = false; },
          onReady: (url) => { info.img.src = url; b.classList.add('has-img'); io.unobserve(b); },
          onError: () => {
            info.thumb.classList.add('err');
            io.unobserve(b);
            // Bild lässt sich (noch) nicht laden, z.B. weil es gerade erst entsteht: Karte ausblenden
            if (info.item.kind === 'art') { broken.add(info.item.id); b.classList.add('gone'); }
          },
        });
      }
    }
  }

  function newGenCard(gen) {
    const b = h('button.gv-card.gv-new', { type: 'button', 'aria-label': `Neues ${gen.title} erzeugen` },
      h('div.gv-thumb', null,
        h('span.gv-new-ic', { html: icon('sparkle', { size: 30 }) }),
        h('span.gv-new-t', null, 'Neues erzeugen')),
      h('div.gv-name', null, gen.title));
    b.addEventListener('click', () => {
      const item = lib.addGenSeed(gen.id);
      if (!item) return;
      sfx.play('pop');
      onOpen(item);
    });
    return b;
  }

  function photoAddCard() {
    const b = h('button.gv-card.gv-new', { type: 'button', 'aria-label': 'Eigenes Foto ausmalen' },
      h('div.gv-thumb', null,
        h('span.gv-new-ic', { html: icon('camera', { size: 30 }) }),
        h('span.gv-new-t', null, '+ Eigenes Foto')),
      h('div.gv-name', null, 'Foto ausmalen'));
    b.addEventListener('click', () => { sfx.play('tap'); openPhoto(); });
    return b;
  }

  async function askDelete(item) {
    const ok = await confirmDialog('Foto löschen?', `«${item.title}» und der Malfortschritt werden entfernt.`, 'Löschen', 'Behalten');
    if (!ok) return;
    await lib.removePhoto(item.id);
    forgetThumb(item.id);
    updateSummary();
    toast('Foto gelöscht');
    if (!lib.photos().length) editPhotos = false;
    renderContent(true);
    updateMenu();
  }

  // ---------- Abschnitte ----------

  function section(title, cards, { action = null, note = null } = {}) {
    const head = h('h2.gv-sec-title', null, h('span.grow', null, title), note ? h('span.gv-note', null, note) : null, action);
    return h('section.gv-sec', null, head, h('div.gv-grid', null, cards));
  }

  const doneNote = (items) => {
    const d = items.filter((it) => isDone(progress.get(it.id))).length;
    return d ? `${d}/${items.length} fertig` : null;
  };

  function genSection(cat, flat) {
    const out = [];
    for (const gen of lib.gensIn(cat)) {
      const items = lib.genList(gen.id);
      const cards = [newGenCard(gen), ...items.map((it) => card(it))];
      const title = flat && lib.gensIn(cat).length === 1 ? cat : (lib.gensIn(cat).length > 1 ? gen.title : cat);
      out.push(section(title, cards, { note: doneNote(items) }));
    }
    return out;
  }

  function photoSection() {
    const photos = lib.photos();
    const cards = [];
    if (lib.photoEnabled) cards.push(photoAddCard());
    for (const it of photos) cards.push(card(it, { photo: true }));
    let action = null;
    if (photos.length) {
      action = h('button.gv-edit', { type: 'button' }, editPhotos ? 'Fertig' : 'Bearbeiten');
      action.addEventListener('click', () => { sfx.play('click'); editPhotos = !editPhotos; renderContent(true); });
    }
    return section(PHOTO_CAT, cards, { action });
  }

  function empty(title, text) {
    return h('div.gv-empty', null,
      h('div.gv-empty-ic', { html: icon('image', { size: 34 }) }),
      h('p.gv-empty-t', null, title),
      h('p.gv-empty-x', null, text));
  }

  function renderContent(keepScroll = false) {
    const y = scroll.scrollTop;
    progress = allProgress();
    io.disconnect();
    content.innerHTML = '';
    const all = lib.all();
    const byTs = (a, b) => ((progress.get(b.id) || {}).ts || 0) - ((progress.get(a.id) || {}).ts || 0);

    if (chip === ALL) {
      const started = all.filter((it) => isStarted(progress.get(it.id))).sort(byTs).slice(1, 5);
      if (started.length) content.append(section('Weitermalen', started.map((it) => card(it))));
      for (const cat of lib.artCategories()) {
        const items = lib.artIn(cat);
        content.append(section(cat, items.map((it) => card(it)), { note: doneNote(items) }));
      }
      for (const cat of lib.genCategories()) content.append(...genSection(cat, true));
      if (lib.photoEnabled || lib.photos().length) content.append(photoSection());
      if (lib.debug && lib.fixtures().length) content.append(section(TEST_CAT, lib.fixtures().map((it) => card(it))));
      if (!content.children.length) content.append(empty('Hier entstehen gerade Bilder.', 'Schau bald wieder vorbei.'));
    } else if (chip === STARTED) {
      const items = all.filter((it) => isStarted(progress.get(it.id))).sort(byTs);
      if (items.length) content.append(h('div.gv-grid.gv-flat', null, items.map((it) => card(it))));
      else content.append(empty('Noch kein Bild begonnen.', 'Tippe ein Bild an und leg los – dein Fortschritt wird automatisch gespeichert.'));
    } else if (chip === DONE) {
      const items = all.filter((it) => isDone(progress.get(it.id))).sort(byTs);
      if (items.length) content.append(h('div.gv-grid.gv-flat', null, items.map((it) => card(it))));
      else content.append(empty('Noch kein Bild fertig.', 'Jedes fertig ausgemalte Bild erscheint hier.'));
    } else if (chip === PHOTO_CAT) {
      content.append(photoSection());
      if (!lib.photos().length) content.append(h('p.gv-hint', null, 'Aus deinem Foto wird ein Malbild mit Nummern. Es bleibt nur auf diesem Gerät.'));
    } else if (chip === TEST_CAT) {
      content.append(section(TEST_CAT, lib.fixtures().map((it) => card(it))));
    } else if (lib.genCategories().includes(chip)) {
      content.append(...genSection(chip, true));
    } else {
      const items = lib.artIn(chip);
      content.append(section(chip, items.map((it) => card(it)), { note: doneNote(items) }));
    }
    if (keepScroll) scroll.scrollTop = y;
  }

  function show() {
    el.classList.remove('hidden');
    renderChips();
    renderContent(true);
    updateMenu();
    updateSummary();
  }

  renderChips();
  return { el, show };
}
