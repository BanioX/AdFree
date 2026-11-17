// Bildquellen für «Puzzle»: gemalte Packs, Zufallsbilder, Bilder aus «Farbenzauber» und eigene Fotos.
//
// Ein Bild wird durch einen Schlüssel beschrieben, z.B. 'berge/alpenglut', 'zufall/123456',
// 'tag/2026-11-17', 'farben/a-rose', 'fgen/mandala/3', 'foto/k3x9a'.
// resolveImage(key) liefert eine Beschreibung mit render(widthPx) → Canvas.

import { packs, randomRecipes, randomNames } from './data/packs.js';
import { palettes } from './data/palettes.js';
import { painterById } from './art/index.js';
import { grain } from './art/kit.js';
import { makeRng, hashString } from '../shared/rng.js';
import { kv } from '../shared/idb.js';

export const ASPECT = 0.75; // Breite : Höhe der gemalten Bilder und Fotos

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ---------- Gemalte Bilder ----------

function paintedDesc({ key, title, packId, painter, palette, seed, opts }) {
  return {
    key, title, packId, kind: 'painted', aspect: ASPECT,
    async render(width) {
      const cv = makeCanvas(width, width / ASPECT);
      const ctx = cv.getContext('2d');
      const p = painterById(painter) || painterById('berge');
      const pal = palettes[palette] || palettes.sommertag;
      ctx.scale(cv.width / 1000, cv.width / 1000);
      p.paint(ctx, { w: 1000, h: 1000 / ASPECT, rng: makeRng(seed >>> 0), pal, opts: opts || {}, makeCanvas });
      return cv;
    },
  };
}

export function packImages(pack) {
  return pack.images.map((img) => paintedDesc({
    key: `${pack.id}/${img.id}`, title: img.title, packId: pack.id,
    painter: img.painter || pack.painter, palette: img.palette, seed: img.seed, opts: img.opts,
  }));
}

export function randomDesc(seed, title = null) {
  const rng = makeRng((seed >>> 0) ^ 0x2545f491);
  const recipe = randomRecipes[rng.int(0, randomRecipes.length - 1)];
  const palette = recipe.palettes[rng.int(0, recipe.palettes.length - 1)];
  const names = randomNames[recipe.painter] || ['Überraschung'];
  return paintedDesc({
    key: `zufall/${seed >>> 0}`, title: title || names[rng.int(0, names.length - 1)], packId: 'zufall',
    painter: recipe.painter, palette, seed: rng.int(1, 2 ** 30), opts: {},
  });
}

export function dailyDesc(day) {
  const d = randomDesc(hashString('jigsaw-tag-' + day), 'Bild des Tages');
  d.key = `tag/${day}`;
  d.packId = 'tag';
  return d;
}

export function newRandomSeed() {
  return (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0;
}

// ---------- Bilder aus «Farbenzauber» (werden parallel gebaut – alles optional) ----------

let paintCache = null;

async function tryImport(path) {
  try { return await import(path); } catch { return null; }
}

/** Lädt Bilder und Generatoren aus /paint/. Fehlt etwas, wird es still übersprungen. */
export function loadPaintSources() {
  if (paintCache) return paintCache;
  paintCache = (async () => {
    let pictures = [];
    const main = await tryImport('../paint/art/index.js');
    if (main && Array.isArray(main.pictures)) pictures = main.pictures;
    else {
      for (const sub of ['../paint/art/a/index.js', '../paint/art/b/index.js']) {
        const m = await tryImport(sub);
        if (m && Array.isArray(m.pictures)) pictures = pictures.concat(m.pictures);
      }
    }
    pictures = pictures.filter((p) => p && typeof p.id === 'string' && typeof p.load === 'function');
    let generators = [];
    const gen = await tryImport('../paint/gen/index.js');
    if (gen && Array.isArray(gen.generators)) generators = gen.generators.filter((g) => g && typeof g.make === 'function' && g.id);
    return { pictures, generators };
  })();
  return paintCache;
}

function drawPaintPuzzle(ctx, pz, W, H) {
  ctx.fillStyle = pz.background || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const s = Math.max(W / pz.width, H / pz.height);
  ctx.save();
  ctx.translate((W - pz.width * s) / 2, (H - pz.height * s) / 2);
  ctx.scale(s, s);
  for (const sh of pz.shapes || []) {
    try {
      ctx.fillStyle = pz.palette[sh.c] || '#cccccc';
      ctx.fill(new Path2D(sh.d), sh.r === 'evenodd' ? 'evenodd' : 'nonzero');
    } catch { /* fehlerhafte Form überspringen */ }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const ln of pz.lines || []) {
    try {
      ctx.strokeStyle = ln.color || '#2b2420';
      ctx.lineWidth = ln.w || 3;
      ctx.stroke(new Path2D(ln.d));
    } catch { /* ignorieren */ }
  }
  ctx.restore();
}

function puzzleDesc(key, title, packId, loadPuzzle, aspectHint = 1) {
  let pz = null;
  const desc = {
    key, title, packId, kind: 'paint', aspect: aspectHint,
    async prepare() {
      if (!pz) pz = await loadPuzzle();
      if (!pz || !pz.width || !pz.height || !Array.isArray(pz.shapes)) throw new Error('Bild nicht verfügbar');
      // Format leicht begrenzen, damit die Teile schön bleiben
      desc.aspect = Math.max(0.6, Math.min(1.34, pz.width / pz.height));
      if (pz.title && !title) desc.title = pz.title;
      return desc;
    },
    async render(width) {
      await desc.prepare();
      const cv = makeCanvas(width, width / desc.aspect);
      const ctx = cv.getContext('2d');
      drawPaintPuzzle(ctx, pz, cv.width, cv.height);
      ctx.save();
      ctx.scale(cv.width / 1000, cv.width / 1000);
      grain(ctx, makeRng(hashString(key)), { w: 1000, h: 1000 / desc.aspect, makeCanvas }, 0.05);
      ctx.restore();
      return cv;
    },
  };
  return desc;
}

/** Packs aus «Farbenzauber»: nach Kategorie gruppiert, plus je Generator ein Pack. */
export async function paintPacks() {
  const { pictures, generators } = await loadPaintSources();
  const byCat = new Map();
  for (const p of pictures) {
    const cat = p.category || 'Bilder';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(puzzleDesc(`farben/${p.id}`, p.title || 'Bild', `farben-${slug(cat)}`, () => p.load()));
  }
  const out = [];
  for (const [cat, images] of byCat) {
    out.push({ id: `farben-${slug(cat)}`, title: cat, emoji: '🖌️', source: 'Farbenzauber', images });
  }
  for (const g of generators) {
    const images = [];
    for (let s = 1; s <= 8; s++) {
      images.push(puzzleDesc(`fgen/${g.id}/${s}`, `${g.title || 'Muster'} ${s}`, `fgen-${g.id}`, async () => g.make(s * 1009)));
    }
    out.push({ id: `fgen-${g.id}`, title: g.title || g.id, emoji: '✨', source: 'Farbenzauber', images });
  }
  return out;
}

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bilder';
}

// ---------- Eigene Fotos ----------

const PHOTO_LIST = 'jigsaw.photos';

export async function listPhotos() {
  const list = await kv.get(PHOTO_LIST, []);
  return Array.isArray(list) ? list : [];
}

async function blobToImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function canvasToBlob(cv, type, q) {
  return new Promise((resolve) => {
    if (cv.toBlob) cv.toBlob((b) => resolve(b), type, q);
    else resolve(null);
  });
}

/** Foto importieren: mittig auf 3:4 zuschneiden, verkleinern, speichern. Gibt die Beschreibung zurück. */
export async function importPhoto(file) {
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = new Image();
    img.src = url;
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    img = await blobToImage(file);
  }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('Bild konnte nicht gelesen werden');
  let sw = iw, sh = iw / ASPECT;
  if (sh > ih) { sh = ih; sw = ih * ASPECT; }
  const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  const outW = Math.min(1200, Math.round(sw));
  const cv = makeCanvas(outW, outW / ASPECT);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  const blob = await canvasToBlob(cv, 'image/jpeg', 0.9);
  const th = makeCanvas(180, 240);
  th.getContext('2d').drawImage(cv, 0, 0, th.width, th.height);
  const thumb = th.toDataURL('image/jpeg', 0.82);
  const id = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  await kv.set(`jigsaw.photo.${id}`, blob || cv.toDataURL('image/jpeg', 0.9));
  const list = await listPhotos();
  const n = list.length + 1;
  const entry = { id, title: `Mein Foto ${n}`, created: Date.now(), thumb };
  await kv.set(PHOTO_LIST, [entry, ...list]);
  return photoDesc(entry);
}

export async function deletePhoto(id) {
  const list = await listPhotos();
  await kv.set(PHOTO_LIST, list.filter((p) => p.id !== id));
  await kv.remove(`jigsaw.photo.${id}`);
}

export function photoDesc(entry) {
  return {
    key: `foto/${entry.id}`, title: entry.title, packId: 'fotos', kind: 'photo', aspect: ASPECT, thumb: entry.thumb,
    async render(width) {
      const data = await kv.get(`jigsaw.photo.${entry.id}`, null);
      if (!data) throw new Error('Foto nicht gefunden');
      const img = typeof data === 'string' ? await loadDataUrl(data) : await blobToImage(data);
      const cv = makeCanvas(width, width / ASPECT);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      return cv;
    },
  };
}

async function loadDataUrl(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// ---------- Auflösen eines Schlüssels ----------

export function builtinPacks() {
  return packs.map((p) => ({ id: p.id, title: p.title, emoji: p.emoji, images: packImages(p) }));
}

export async function resolveImage(key) {
  if (typeof key !== 'string') return null;
  const [head, ...rest] = key.split('/');
  const tail = rest.join('/');
  if (head === 'zufall') return randomDesc(Number(tail) >>> 0);
  if (head === 'tag' && /^\d{4}-\d{2}-\d{2}$/.test(tail)) return dailyDesc(tail);
  if (head === 'foto') {
    const entry = (await listPhotos()).find((p) => p.id === tail);
    return entry ? photoDesc(entry) : null;
  }
  if (head === 'farben' || head === 'fgen') {
    for (const pack of await paintPacks()) {
      const d = pack.images.find((x) => x.key === key);
      if (d) { try { await d.prepare(); return d; } catch { return null; } }
    }
    return null;
  }
  const pack = packs.find((p) => p.id === head);
  if (!pack) return null;
  return packImages(pack).find((d) => d.key === key) || null;
}

// ---------- Vorschaubilder (mit Zwischenspeicher) ----------

const thumbMem = new Map();
const THUMB_VER = 'v3';

/** Liefert eine Daten-URL des Vorschaubilds (Breite px). */
export async function thumbFor(desc, width = 240) {
  if (desc.thumb) return desc.thumb;
  const id = `${desc.key}@${width}`;
  if (thumbMem.has(id)) return thumbMem.get(id);
  const cacheKey = `jigsaw.thumb.${THUMB_VER}.${id}`;
  const p = (async () => {
    const cached = await kv.get(cacheKey, null);
    if (typeof cached === 'string') return cached;
    if (desc.prepare) await desc.prepare();
    const cv = await desc.render(width);
    const url = cv.toDataURL('image/jpeg', 0.84);
    if (desc.kind !== 'photo') kv.set(cacheKey, url);
    return url;
  })();
  thumbMem.set(id, p);
  p.catch(() => thumbMem.delete(id));
  return p;
}
