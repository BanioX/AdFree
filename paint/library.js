// Sammelt alle Bilder: handgezeichnete Bibliothek, Generatoren, eigene Fotos und (mit ?debug=1) Testbilder.
// Fehlende Module (Generatoren, Teams) werden still ausgeblendet.

import { store } from '../shared/storage.js';
import { kv } from '../shared/idb.js';
import { sanitizePuzzle } from './engine/model.js';
import { removeProgress } from './state.js';
import { forgetAnalysis } from './engine/analyze.js';

export const CAT_ORDER = ['Blumen', 'Tiere', 'Landschaften', 'Essen', 'Fantasie', 'Winter', 'Mandalas', 'Muster', 'Glasfenster'];
export const PHOTO_CAT = 'Meine Fotos';
export const TEST_CAT = 'Test';
const DEFAULT_SEEDS = [1, 2, 3, 4, 5, 6];

function catRank(c) {
  const i = CAT_ORDER.indexOf(c);
  return i < 0 ? 100 : i;
}

export async function loadLibrary({ debug = false } = {}) {
  const items = new Map();
  const art = [];
  const genItems = new Map(); // genId -> items
  let gens = [];
  let photoToPuzzle = null;

  const [artMod, genMod, fxMod] = await Promise.allSettled([
    import('./art/index.js'),
    import('./gen/index.js'),
    debug ? import('./engine/fixtures.js') : Promise.resolve(null),
  ]);

  // ---------- Bibliothek ----------
  if (artMod.status === 'fulfilled' && artMod.value) {
    for (const p of artMod.value.pictures || []) {
      const item = {
        id: p.id, title: p.title, category: p.category, kind: 'art',
        load: async () => p.load(),
      };
      items.set(item.id, item);
      art.push(item);
    }
  }

  // ---------- Generatoren ----------
  if (genMod.status === 'fulfilled' && genMod.value) {
    const g = genMod.value;
    if (Array.isArray(g.generators)) {
      gens = g.generators.filter((x) => x && typeof x.id === 'string' && typeof x.make === 'function')
        .map((x) => ({ id: x.id, title: x.title || x.id, category: x.category || 'Muster', make: x.make }));
    }
    if (typeof g.photoToPuzzle === 'function') photoToPuzzle = g.photoToPuzzle;
  }

  const genItem = (gen, seed, n) => ({
    id: `g-${gen.id}-${seed}`,
    title: `${gen.title} ${n}`,
    category: gen.category,
    kind: 'gen',
    gen: gen.id,
    seed,
    load: async () => gen.make(seed),
  });

  function buildGen(gen) {
    const user = store.get('paint.gen.' + gen.id, []);
    const list = [];
    // neueste eigene zuerst
    user.forEach((seed, k) => list.unshift(genItem(gen, seed, DEFAULT_SEEDS.length + k + 1)));
    DEFAULT_SEEDS.forEach((seed, k) => list.push(genItem(gen, seed, k + 1)));
    for (const it of list) items.set(it.id, it);
    genItems.set(gen.id, list);
  }
  gens.forEach(buildGen);

  // ---------- Eigene Fotos ----------
  const photoItem = (meta) => ({
    id: meta.id, title: meta.title, category: PHOTO_CAT, kind: 'photo', t: meta.t || 0,
    load: async () => {
      const pz = await kv.get('paint.photo.' + meta.id, null);
      if (!pz) throw new Error('Foto fehlt');
      return pz;
    },
  });
  let photos = store.get('paint.photos', []);
  if (!Array.isArray(photos)) photos = [];
  for (const m of photos) if (m && m.id) items.set(m.id, photoItem(m));

  // ---------- Testbilder ----------
  const fixtures = [];
  if (fxMod.status === 'fulfilled' && fxMod.value && fxMod.value.fixtures) {
    for (const f of fxMod.value.fixtures) {
      const it = { id: f.id, title: f.title, category: TEST_CAT, kind: 'fixture', load: async () => f.make() };
      items.set(it.id, it);
      fixtures.push(it);
    }
  }

  const lib = {
    debug,
    gens,
    photoToPuzzle,
    get photoEnabled() { return !!photoToPuzzle; },

    /** Kategorien der Bibliothek (sortiert) */
    artCategories() {
      const cats = [...new Set(art.map((a) => a.category))];
      return cats.sort((a, b) => catRank(a) - catRank(b));
    },
    genCategories() {
      const cats = [...new Set(gens.map((g) => g.category))];
      return cats.sort((a, b) => catRank(a) - catRank(b));
    },
    artIn(cat) { return art.filter((a) => a.category === cat); },
    gensIn(cat) { return gens.filter((g) => g.category === cat); },
    genList(genId) { return genItems.get(genId) || []; },
    photos() {
      return photos.map((m) => items.get(m.id)).filter(Boolean).sort((a, b) => (b.t || 0) - (a.t || 0));
    },
    fixtures() { return fixtures; },
    all() { return [...items.values()]; },

    async get(id) {
      if (items.has(id)) return items.get(id);
      const m = /^g-(.+)-(\d+)$/.exec(id);
      if (m) {
        const gen = gens.find((g) => g.id === m[1]);
        if (gen) {
          const it = genItem(gen, +m[2], '');
          it.title = gen.title;
          items.set(id, it);
          return it;
        }
      }
      const pz = await kv.get('paint.photo.' + id, null);
      if (pz) {
        const it = photoItem({ id, title: pz.title || 'Foto', t: pz.createdAt || 0 });
        items.set(id, it);
        return it;
      }
      return null;
    },

    /** Lädt und bereinigt ein Bild. */
    async loadPuzzle(item) {
      const raw = await item.load();
      const pz = sanitizePuzzle(raw, item.id);
      pz.id = item.id;
      pz.title = item.title || pz.title || '';
      pz.category = item.category || pz.category || '';
      return pz;
    },

    addGenSeed(genId) {
      const gen = gens.find((g) => g.id === genId);
      if (!gen) return null;
      const seed = 1000 + Math.floor(Math.random() * 999000);
      store.update('paint.gen.' + gen.id, [], (l) => [...(Array.isArray(l) ? l : []), seed]);
      buildGen(gen);
      return items.get(`g-${gen.id}-${seed}`);
    },

    async addPhoto(puzzle) {
      const id = 'foto-' + Date.now().toString(36);
      const d = new Date();
      const title = `Foto vom ${d.getDate()}.${d.getMonth() + 1}.`;
      const pz = { ...puzzle, id, title, category: PHOTO_CAT, createdAt: Date.now() };
      const ok = await kv.set('paint.photo.' + id, pz);
      if (!ok) throw new Error('Speichern fehlgeschlagen');
      photos = [...photos, { id, title, t: pz.createdAt }];
      store.set('paint.photos', photos);
      const it = photoItem({ id, title, t: pz.createdAt });
      items.set(id, it);
      return it;
    },

    async removePhoto(id) {
      photos = photos.filter((m) => m.id !== id);
      store.set('paint.photos', photos);
      items.delete(id);
      removeProgress(id);
      await Promise.all([kv.remove('paint.photo.' + id), kv.remove('paint.thumb.' + id), forgetAnalysis(id)]);
    },
  };
  return lib;
}
