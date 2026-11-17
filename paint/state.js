// Spielstand von Farbenzauber (localStorage via shared/storage.js).
//
// Pro Bild: store 'paint.prog.<id>' = { v, f (Bits der gefüllten Formen, base64), o (Füllreihenfolge),
//   c (gewählte Farbe), n (gefüllt), t (gesamt), done, cam, h (Inhalts-Hash), ts }

import { store, reportSummary } from '../shared/storage.js';

const PREFIX = 'paint.prog.';

export function loadProgress(id) {
  const r = store.get(PREFIX + id, null);
  return r && typeof r === 'object' ? r : null;
}

export function saveProgress(id, rec) {
  store.set(PREFIX + id, rec);
}

export function removeProgress(id) {
  store.remove(PREFIX + id);
}

/** Alle Fortschritte: Map id -> Datensatz. */
export function allProgress() {
  const out = new Map();
  for (const k of store.keys(PREFIX)) {
    const r = store.get(k, null);
    if (r && typeof r === 'object') out.set(k.slice(PREFIX.length), r);
  }
  return out;
}

export const isStarted = (r) => !!r && !r.done && (r.n | 0) > 0;
export const isDone = (r) => !!r && !!r.done;

/** Kurzstatus für die Startseite. */
export function updateSummary() {
  let done = 0, started = 0;
  for (const r of allProgress().values()) {
    if (isDone(r)) done++;
    else if (isStarted(r)) started++;
  }
  const bild = (k) => (k === 1 ? 'Bild' : 'Bilder');
  let text = null;
  if (done) text = `${done} ${bild(done)} fertig` + (started ? ` · ${started} begonnen` : '');
  else if (started) text = `${started} ${bild(started)} begonnen`;
  if (text) reportSummary('paint', text);
  return text;
}
