// Perlenbild – Fortschritt und Spielstände (localStorage über shared/storage.js).

import { store, reportSummary } from '../shared/storage.js';

const PKEY = 'beads.progress';
const RUN = 'beads.run.';
const PHOTOS = 'beads.photos';

export function getProgress() {
  const p = store.get(PKEY, null) || {};
  return {
    level: Math.max(1, (p.level | 0) || 1),
    done: p.done && typeof p.done === 'object' ? p.done : {},
    beads: p.beads | 0,
    tutorial: !!p.tutorial,
  };
}

export function updateProgress(fn) {
  const p = getProgress();
  fn(p);
  store.set(PKEY, p);
  return p;
}

export function loadRun(key) { return store.get(RUN + key, null); }
export function saveRun(key, data) { return store.set(RUN + key, data); }
export function clearRun(key) { store.remove(RUN + key); }

/** Liste eigener Fotos: [{ id, title, t, grid, colors, stars }] (Muster selbst liegen in IndexedDB). */
export function getPhotos() {
  const list = store.get(PHOTOS, []);
  return Array.isArray(list) ? list.filter((x) => x && typeof x.id === 'string') : [];
}
export function setPhotos(list) { store.set(PHOTOS, list); }

export function totalStars(p = getProgress()) {
  let s = 0;
  for (const v of Object.values(p.done)) s += v | 0;
  for (const ph of getPhotos()) s += ph.stars | 0;
  return s;
}

export function report(p = getProgress()) {
  reportSummary('beads', `Level ${p.level}`);
}
