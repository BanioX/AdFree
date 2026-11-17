// Galerie von Farbenzauber: Kategorien-Chips, 2-spaltiges Raster mit Vorschaubildern und Fortschritt.

import { icon, h, toast, confirmDialog, soundButton, backButton } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { store } from '../shared/storage.js';
import { allProgress, isStarted, isDone, updateSummary } from './state.js';
import { requestThumb, thumbKey, cachedThumb, setThumbLoader, forgetThumb } from './engine/thumbs.js';
import { percent } from './engine/progress.js';
import { PHOTO_CAT, TEST_CAT } from './library.js';
import { openPhotoSheet } from './photo.js';

const NBSP = ' ';
const ALL = 'Alle', STARTED = 'Begonnen', DONE = 'Fertig';

export function createGallery(lib, { onOpen }) {
  setThumbLoader((item) => lib.loadPuzzle(item));

  const chipsEl = h('div.gv-chips', { role: 'tablist', 'aria-label': 'Kategorien' });
  const content = h('div.gv-content');
  const scroll = h('div.scroll.gv-scroll', null, chipsEl, content);
  const top = h('header.topbar.gv-top', null,
    backButton('../'),
    h('div.title', null, 'Farbenzauber'),
    soundButton());
  const el = h('div.view.gv', null, top, scroll);

  let chip = store.get('paint.chip', ALL);
  let progress = new Map();
  let editPhotos = false;
  const cardInfo = new WeakMap();
  const io = new IntersectionObserver(onIntersect, { root: scroll, rootMargin: '320px 0px' });

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
        scroll.scrollTo({ top: 0 });
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
          onError: () => { info.thumb.classList.add('err'); io.unobserve(b); },
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
    b.addEventListener('click', async () => {
      sfx.play('tap');
      const item = await openPhotoSheet(lib);
      if (item) onOpen(item);
    });
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
      const started = all.filter((it) => isStarted(progress.get(it.id))).sort(byTs).slice(0, 4);
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
    updateSummary();
  }

  renderChips();
  return { el, show };
}
