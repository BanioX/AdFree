// Perlenbild – Bildschirm «Eigenes Foto»: Foto wählen, Raster + Farben einstellen,
// Vorschau als Perlenbild, als eigenes Level spielen. Muster liegen in IndexedDB.

import { h, icon, toast, confirmDialog } from '../shared/ui.js';
import { kv } from '../shared/idb.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { loadImage, sampleImage, quantize, GRID_SIZES, MIN_COLORS, MAX_COLORS } from './photo.js';
import { parsePattern, isValidPattern } from './level.js';
import { drawPicture } from './gems.js';
import { getPhotos, setPhotos, clearRun } from './progress.js';

const SIZE_LABEL = { 16: 'Klein', 24: 'Mittel', 32: 'Gross' };

export class PhotoScreen {
  constructor(root, { topbar }) {
    this.destroyed = false;
    this.img = null;
    this.samples = new Map();
    this.pattern = null;
    this.grid = GRID_SIZES.includes(store.get('beads.photoGrid')) ? store.get('beads.photoGrid') : 24;
    this.colors = Math.min(MAX_COLORS, Math.max(MIN_COLORS, store.get('beads.photoColors', 8) | 0));
    this.seed = 'p' + Date.now().toString(36);

    // Vorschau
    const ph = h('div.placeholder');
    ph.innerHTML = `<div class="ic">${icon('camera')}</div>`;
    ph.append(h('div', null, 'Wähle ein Foto – daraus wird dein eigenes Perlenbild.'));
    this.placeholder = ph;
    this.previewCanvas = h('canvas.hidden', { 'aria-label': 'Vorschau' });
    this.busy = h('div.busy.hidden', null, 'Einen Moment …');
    this.preview = h('div.bp-preview', null, ph, this.previewCanvas, this.busy);
    this.swatches = h('div.bp-swatches');

    this.input = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Foto wählen' });
    this.input.addEventListener('change', () => {
      const f = this.input.files && this.input.files[0];
      if (f) this.onFile(f);
      this.input.value = '';
    });
    this.fileBtn = h('label.btn.block.bp-file');
    this.fileBtnLabel = h('span', null, 'Foto wählen');
    this.fileBtn.innerHTML = icon('image', { size: 20 });
    this.fileBtn.append(this.fileBtnLabel, this.input);

    // Einstellungen
    this.sizeChips = GRID_SIZES.map((n) => {
      const b = h('button.chip', { type: 'button' }, `${SIZE_LABEL[n]} ${n}`);
      b.addEventListener('click', () => { sfx.play('click'); this.setGrid(n); });
      b.dataset.n = n;
      return b;
    });
    this.range = h('input', { type: 'range', min: MIN_COLORS, max: MAX_COLORS, step: 1, value: this.colors, 'aria-label': 'Anzahl Farben' });
    this.rangeOut = h('output', null, String(this.colors));
    this.range.addEventListener('input', () => {
      this.colors = this.range.value | 0;
      this.rangeOut.textContent = String(this.colors);
      store.set('beads.photoColors', this.colors);
      this.schedule();
    });
    this.playBtn = h('button.btn.primary.block', { type: 'button', disabled: true });
    this.playBtn.innerHTML = icon('play', { size: 20 });
    this.playBtn.append(document.createTextNode('Spielen'));
    this.playBtn.addEventListener('click', () => this.play());
    this.info = h('p.bp-hint', null, 'Grösse und Farben kannst du nach dem Wählen anpassen.');

    this.list = h('div.bp-grid');
    this.listHead = h('h3', null, 'Meine Fotos');

    root.append(
      topbar('#menu', 'Eigenes Foto'),
      h('div.scroll', null,
        h('main.bp-photo', null,
          h('section.card.bp-photo-card', null, this.preview, this.swatches, this.fileBtn),
          h('section.card.bp-photo-card', null,
            h('div.bp-row', null, h('label', null, 'Grösse'), h('div.bp-seg', null, ...this.sizeChips)),
            h('div.bp-row', null, h('label', null, 'Farben'), h('div.bp-range', null, this.range, this.rangeOut)),
            this.playBtn,
            this.info),
          h('div.bp-album', { style: { padding: 0 } }, this.listHead, this.list),
        )),
    );
    this.updateChips();
    this.renderList();
  }

  destroy() { this.destroyed = true; }

  updateChips() {
    for (const b of this.sizeChips) b.classList.toggle('active', Number(b.dataset.n) === this.grid);
  }

  setGrid(n) {
    this.grid = n;
    store.set('beads.photoGrid', n);
    this.updateChips();
    this.schedule();
  }

  async onFile(file) {
    this.busy.classList.remove('hidden');
    try {
      this.img = await loadImage(file);
      this.samples.clear();
      this.seed = 'p' + Date.now().toString(36);
      this.fileBtnLabel.textContent = 'Anderes Foto wählen';
      this.update();
    } catch {
      toast('Dieses Bild kann ich leider nicht öffnen');
    } finally {
      this.busy.classList.add('hidden');
    }
  }

  schedule() {
    if (!this.img || this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.update(); });
  }

  update() {
    if (!this.img || this.destroyed) return;
    let sample = this.samples.get(this.grid);
    if (!sample) { sample = sampleImage(this.img, this.grid); this.samples.set(this.grid, sample); }
    this.pattern = quantize(sample, this.colors, this.seed);
    const L = parsePattern({ id: 'vorschau', title: 'Vorschau', ...this.pattern });
    this.placeholder.classList.add('hidden');
    this.previewCanvas.classList.remove('hidden');
    const w = this.preview.clientWidth || 300;
    drawPicture(this.previewCanvas, L, { size: w, pad: 0.035 });
    this.swatches.replaceChildren(...L.colors.map((c) => h('i', { style: { background: c } })));
    this.playBtn.disabled = false;
    this.info.textContent = `${L.total} Perlen · ${L.K} Farben`;
  }

  async play() {
    if (!this.pattern) return;
    sfx.play('click');
    const id = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const d = new Date();
    const title = `Foto vom ${d.getDate()}.${d.getMonth() + 1}.`;
    const pattern = { id: 'foto-' + id, title, category: 'Meine Fotos', ...this.pattern };
    const ok = await kv.set('beads.photo.' + id, pattern);
    if (!ok) { toast('Speichern hat nicht geklappt'); return; }
    setPhotos([{ id, title, t: Date.now(), grid: this.grid, colors: this.colors, stars: 0 }, ...getPhotos()]);
    location.hash = '#foto/' + id;
  }

  async renderList() {
    const photos = getPhotos();
    this.listHead.classList.toggle('hidden', !photos.length);
    this.list.replaceChildren();
    for (const ph of photos) {
      const pat = await kv.get('beads.photo.' + ph.id);
      if (this.destroyed) return;
      if (!pat || !isValidPattern(pat)) continue;
      const L = parsePattern(pat);
      const box = h('div.pic');
      const cv = h('canvas');
      box.append(cv);
      const del = h('button.del', { type: 'button', 'aria-label': 'Foto löschen' });
      del.innerHTML = icon('trash', { size: 17 });
      const stars = h('div.mini-stars');
      for (let i = 0; i < 3; i++) {
        const s = h('span' + (i < (ph.stars | 0) ? '.on' : ''));
        s.innerHTML = icon('star', { size: 15 });
        stars.append(s);
      }
      const card = h('div.bp-card', { role: 'button', tabindex: '0' }, box, h('b', null, ph.title || 'Mein Foto'), stars, del);
      card.addEventListener('click', (e) => {
        if (e.target.closest('.del')) return;
        location.hash = '#foto/' + ph.id;
      });
      del.addEventListener('click', async () => {
        const yes = await confirmDialog('Foto löschen?', 'Das Perlenbild und sein Spielstand werden entfernt.', 'Löschen', 'Behalten');
        if (!yes) return;
        await kv.remove('beads.photo.' + ph.id);
        clearRun('P' + ph.id);
        setPhotos(getPhotos().filter((x) => x.id !== ph.id));
        this.renderList();
      });
      this.list.append(card);
      requestAnimationFrame(() => {
        const w = box.clientWidth || 140;
        drawPicture(cv, L, { size: w, pad: 0.05 });
      });
    }
  }
}
