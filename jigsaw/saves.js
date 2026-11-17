// Puzzle – Spielstände, erledigte Bilder und Statistik (localStorage über shared/storage.js).
//
// Ein «Platz» (slot) ist ein Bild in einer bestimmten Teilezahl, z.B. 'berge/alpenglut@48'
// (mit Drehen: 'berge/alpenglut@48r'). Pro Platz gibt es höchstens einen Spielstand.

import { store } from '../shared/storage.js';
import { emptyStats } from './logic.js';

const MAX_SAVES = 16;
const K_INDEX = 'jigsaw.saves';
const K_CURRENT = 'jigsaw.current';
const K_DONE = 'jigsaw.done';
const K_STATS = 'jigsaw.stats';
const saveKey = (slot) => 'jigsaw.save.' + slot;

export function slotFor(key, tier, rotate = false) {
  return `${key}@${tier}${rotate ? 'r' : ''}`;
}

/** 'berge/alpenglut@48r' → { key, tier, rotate } oder null. */
export function parseSlot(slot) {
  if (typeof slot !== 'string') return null;
  const at = slot.lastIndexOf('@');
  if (at <= 0) return null;
  const m = /^(\d+)(r?)$/.exec(slot.slice(at + 1));
  if (!m) return null;
  return { key: slot.slice(0, at), tier: Number(m[1]), rotate: m[2] === 'r' };
}

/** Liste der angefangenen Puzzles, neueste zuerst: [{ slot, key, tier, rotate, title, placed, total, updated }]. */
export function listSaves() {
  const list = store.get(K_INDEX, []);
  return Array.isArray(list) ? list.filter((e) => e && typeof e.slot === 'string') : [];
}

export function loadSave(slot) {
  return store.get(saveKey(slot), null);
}

export function writeSave(slot, meta, data) {
  store.set(saveKey(slot), data);
  let list = listSaves().filter((e) => e.slot !== slot);
  list.unshift({ ...meta, slot, updated: Date.now() });
  for (const old of list.slice(MAX_SAVES)) store.remove(saveKey(old.slot));
  list = list.slice(0, MAX_SAVES);
  store.set(K_INDEX, list);
  store.set(K_CURRENT, slot);
}

export function dropSave(slot) {
  store.remove(saveKey(slot));
  store.set(K_INDEX, listSaves().filter((e) => e.slot !== slot));
  if (store.get(K_CURRENT, null) === slot) store.remove(K_CURRENT);
}

/** Zuletzt gespielter, noch nicht fertiger Platz (oder null). */
export function currentSave() {
  const slot = store.get(K_CURRENT, null);
  const list = listSaves();
  return list.find((e) => e.slot === slot) || list[0] || null;
}

// ---------- Erledigt ----------

export function doneMap() {
  const d = store.get(K_DONE, {});
  return d && typeof d === 'object' ? d : {};
}

export function doneTiers(key) {
  const t = doneMap()[key];
  return Array.isArray(t) ? t : [];
}

export function markDone(key, tier) {
  const d = doneMap();
  const t = new Set(Array.isArray(d[key]) ? d[key] : []);
  t.add(tier);
  d[key] = [...t].sort((a, b) => a - b);
  store.set(K_DONE, d);
}

// ---------- Statistik & Einstellungen ----------

export function getStats() {
  return { ...emptyStats(), ...(store.get(K_STATS, null) || {}) };
}

export function setStats(s) {
  store.set(K_STATS, s);
}

export function getPref(name, fallback) {
  return store.get('jigsaw.pref.' + name, fallback);
}

export function setPref(name, value) {
  store.set('jigsaw.pref.' + name, value);
}
