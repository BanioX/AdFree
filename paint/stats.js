// Statistik von Farbenzauber: ausgemalte Felder und Malzeit (localStorage), Bilder aus den Fortschritten.

import { store } from '../shared/storage.js';
import { allProgress, isDone, isStarted } from './state.js';

const KEY = 'paint.stats';

export function loadStats() {
  const s = store.get(KEY, null);
  return { fills: (s && s.fills) | 0, ms: (s && +s.ms) || 0, pics: (s && s.pics) | 0 };
}

/** Zählt ausgemalte Felder und Malzeit (ms) dazu; pics = neu fertig gewordene Bilder. */
export function addStats({ fills = 0, ms = 0, pics = 0 } = {}) {
  if (!fills && !ms && !pics) return;
  const s = loadStats();
  store.set(KEY, { fills: s.fills + fills, ms: s.ms + ms, pics: s.pics + pics });
}

export function statsSummary() {
  const s = loadStats();
  let done = 0, started = 0, filledNow = 0;
  for (const r of allProgress().values()) {
    if (isDone(r)) done++;
    else if (isStarted(r)) started++;
    filledNow += r.n | 0;
  }
  return {
    done: Math.max(done, 0),
    started,
    fills: Math.max(s.fills, filledNow),
    ms: s.ms,
    finishedEver: Math.max(s.pics, done),
  };
}

export function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'unter 1 Min.';
  if (min < 60) return `${min} Min.`;
  const hh = Math.floor(min / 60), mm = min % 60;
  return mm ? `${hh} Std. ${mm} Min.` : `${hh} Std.`;
}
