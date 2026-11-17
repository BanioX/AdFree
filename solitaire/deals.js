// Partien austeilen: beweisbar lösbare Nummern aus data/seeds.js, danach Prüfung im Worker.
import { store, todayKey } from '../shared/storage.js';
import { MODES } from './logic/rules.js';
import { solveSeed, solveState } from './logic/solve.js';

let seedsMod = null;
async function seeds() {
  if (!seedsMod) {
    try { seedsMod = await import('./data/seeds.js'); } catch { seedsMod = { SOLVABLE: {}, DAILY: {} }; }
  }
  return seedsMod;
}

// ------------------------------------------------------------ Worker-RPC

let worker = null;
let workerBroken = false;
let rpcId = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (p) { pending.delete(e.data.id); clearTimeout(p.timer); p.resolve(e.data); }
    };
    worker.onerror = () => { resetWorker(true); };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

function resetWorker(broken = false) {
  if (worker) { try { worker.terminate(); } catch { /* ignore */ } }
  worker = null;
  if (broken) workerBroken = true;
  for (const [, p] of pending) { clearTimeout(p.timer); p.resolve({ solved: null, error: 'reset' }); }
  pending.clear();
}

/** Löser-Aufruf im Worker; fällt ohne Worker auf eine kleine synchrone Suche zurück. */
export function solve(msg, timeLimit = 2500) {
  const w = getWorker();
  const opts = { ...(msg.opts || {}), timeLimit };
  if (!w) {
    try {
      const small = { ...opts, maxNodes: 4000 };
      return Promise.resolve(msg.cmd === 'seed' ? solveSeed(msg.mode, msg.seed, small) : solveState(msg.state, small));
    } catch { return Promise.resolve({ solved: null }); }
  }
  return new Promise((resolve) => {
    const id = ++rpcId;
    const timer = setTimeout(() => {
      // Worker hängt? neu starten
      if (pending.has(id)) { pending.delete(id); resetWorker(false); resolve({ solved: null, error: 'timeout' }); }
    }, timeLimit + 3000);
    pending.set(id, { resolve, timer });
    w.postMessage({ ...msg, id, opts });
  });
}

// ------------------------------------------------------------ Austeilen

/**
 * Einstiegspartien: lösbare Nummern, die schon ein einfacher «immer den Tipp nehmen»-Spieler
 * gewinnt (ermittelt mit dem Tipp-Algorithmus aus logic/hints.js, siehe tests/content.test.mjs).
 */
export const FIRST_DEAL = { klondike1: 385, klondike3: 90, spider1: 36, freecell: 144 };

const randomSeed = () => 100000 + Math.floor(Math.random() * 899999);

/**
 * Nächste Partie für einen Modus.
 * Liefert { seed, verified, label }.
 */
export async function nextDeal(modeId, { solvable = true, onWait } = {}) {
  if (!solvable) {
    const seed = randomSeed();
    return { seed, verified: false, label: `Partie ${seed}` };
  }
  // Allererste Partie einer Spielart: eine besonders gutmütige Partie (kurzer Erfolg zum Einstieg)
  const firstKey = `solitaire.first.${modeId}`;
  if (FIRST_DEAL[modeId] && !store.get(firstKey, false)) {
    store.set(firstKey, true);
    const seed = FIRST_DEAL[modeId];
    return { seed, verified: true, label: `Partie ${seed}` };
  }
  const { SOLVABLE } = await seeds();
  const list = SOLVABLE[modeId];
  const idxKey = `solitaire.next.${modeId}`;
  if (list && list.seeds.length) {
    const idx = store.get(idxKey, 0);
    if (idx < list.seeds.length) {
      store.set(idxKey, idx + 1);
      const seed = list.seeds[idx];
      return { seed, verified: true, label: `Partie ${seed}` };
    }
  }
  // Liste aufgebraucht: weitere Nummern im Hintergrund prüfen
  if (modeId === 'spider4') {
    const seed = randomSeed();
    return { seed, verified: false, label: `Partie ${seed}` };
  }
  const candKey = `solitaire.cand.${modeId}`;
  let cand = store.get(candKey, list ? list.to + 1 : 1);
  if (onWait) onWait(true);
  try {
    for (let tries = 0; tries < 8; tries++) {
      const seed = cand++;
      store.set(candKey, cand);
      const r = await solve({ cmd: 'seed', mode: modeId, seed }, 2200);
      if (r.solved) return { seed, verified: true, label: `Partie ${seed}` };
    }
  } finally {
    if (onWait) onWait(false);
  }
  const seed = cand;
  store.set(candKey, cand + 1);
  return { seed, verified: false, label: `Partie ${seed}` };
}

/** Wie viele geprüfte Partien liegen noch bereit? */
export async function remainingVerified(modeId) {
  const { SOLVABLE } = await seeds();
  const list = SOLVABLE[modeId];
  if (!list) return 0;
  return Math.max(0, list.seeds.length - store.get(`solitaire.next.${modeId}`, 0));
}

// ------------------------------------------------------------ Tagesrätsel

export const DAILY_VARIANTS = {
  klondike: { mode: 'klondike1', title: 'Klondike des Tages', short: 'Klondike' },
  spider: { mode: 'spider1', title: 'Spider des Tages', short: 'Spider' },
  freecell: { mode: 'freecell', title: 'FreeCell des Tages', short: 'FreeCell' },
};

export function dayNumber(day = todayKey()) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5);
}

/** Partie des Tages – für alle gleich, beweisbar lösbar. */
export async function dailyDeal(variant, day = todayKey()) {
  const v = DAILY_VARIANTS[variant];
  const { DAILY } = await seeds();
  const list = DAILY[v.mode];
  const n = dayNumber(day);
  let seed;
  if (list && list.seeds.length) {
    const len = list.seeds.length;
    seed = list.seeds[((n % len) + len) % len];
  } else {
    seed = 5000000 + n;
  }
  return { seed, verified: !!list, label: dayLabel(day) };
}

export function dayLabel(day = todayKey()) {
  const [y, m, d] = day.split('-').map(Number);
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${d}. ${months[m - 1]} ${y}`;
}

export { MODES };
