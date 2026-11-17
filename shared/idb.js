// Minimaler Promise-basierter Key-Value-Store auf IndexedDB.
// Für grosse Daten (eigene Foto-Bilder, Thumbnails). Fällt auf einen
// In-Memory-Speicher zurück, falls IndexedDB nicht verfügbar ist.
//
//   import { kv } from '../shared/idb.js';
//   await kv.set('paint.photo.abc', puzzleObject);
//   const p = await kv.get('paint.photo.abc');
//   const keys = await kv.keys('paint.photo.');

const DB_NAME = 'spielpause';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    let result;
    const r = fn(s);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kv = {
  async get(key, fallback = null) {
    const db = await openDb();
    if (!db) return memory.has(key) ? memory.get(key) : fallback;
    try {
      const v = await tx(db, 'readonly', (s) => s.get(key));
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    const db = await openDb();
    if (!db) { memory.set(key, value); return true; }
    try {
      await tx(db, 'readwrite', (s) => s.put(value, key));
      return true;
    } catch {
      return false;
    }
  },
  async remove(key) {
    const db = await openDb();
    if (!db) { memory.delete(key); return; }
    try { await tx(db, 'readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
  },
  async keys(prefix = '') {
    const db = await openDb();
    if (!db) return [...memory.keys()].filter((k) => String(k).startsWith(prefix));
    try {
      const all = await tx(db, 'readonly', (s) => s.getAllKeys());
      return (all || []).map(String).filter((k) => k.startsWith(prefix));
    } catch {
      return [];
    }
  },
};
