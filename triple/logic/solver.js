// Löser für Dreierlei (ohne DOM): sucht eine Gewinn-Reihenfolge per Tiefensuche.
//
// Zustand = welche Steine schon genommen wurden. Die Ablage ergibt sich daraus
// (pro Sorte: Anzahl genommen modulo 3). Fehlgeschlagene Zustände werden per
// Zobrist-Hash gemerkt, Kandidaten werden heuristisch sortiert (Drilling fertig machen,
// Sorten mit genug freien Steinen, Steine, die andere freilegen).
//
// Verwendet für: Prüfung der Lösbarkeit (Tests), «Tipp» und «Mischen».

import { mulberry32 } from '../../shared/rng.js';

export const WHERE = { BOARD: 0, TRAY: 1, SHELF: 2, GONE: 3 };

const ZOB_N = 512;
const zob1 = new Uint32Array(ZOB_N);
const zob2 = new Uint32Array(ZOB_N);
{
  const r = mulberry32(0x7a11e);
  for (let i = 0; i < ZOB_N; i++) {
    zob1[i] = Math.floor(r() * 4294967296) >>> 0;
    zob2[i] = Math.floor(r() * 4294967296) >>> 0;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * pos: { types[], where[] (WHERE.*), block[] (Anzahl verdeckender Steine auf dem Brett),
 *        below[][] , tray: [ids], trayLimit? }
 * opts: { nodeLimit, timeLimit (ms) }
 * → { ok:true, path:[ids] } | { ok:false, reason:'unsolvable'|'limit' }
 */
export function solve(pos, opts = {}) {
  const nodeLimit = opts.nodeLimit ?? 80000;
  const timeLimit = opts.timeLimit ?? Infinity;
  const trayLimit = pos.trayLimit ?? 7;
  const n = pos.types.length;
  const types = pos.types;
  const below = pos.below;
  let K = 0;
  for (let i = 0; i < n; i++) if (types[i] + 1 > K) K = types[i] + 1;

  const onBoard = new Uint8Array(n);
  const onShelf = new Uint8Array(n);
  const block = new Int16Array(n);
  let remaining = 0;
  for (let i = 0; i < n; i++) {
    const w = pos.where[i];
    if (w === WHERE.BOARD) { onBoard[i] = 1; remaining++; }
    else if (w === WHERE.SHELF) { onShelf[i] = 1; remaining++; }
    block[i] = pos.block[i];
  }
  const tray = new Int8Array(K);
  let traySize = 0;
  for (const id of pos.tray) { tray[types[id]]++; traySize++; }
  if (remaining === 0) return { ok: traySize === 0, path: [], nodes: 0, reason: traySize ? 'unsolvable' : undefined };

  const failed = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;
  let h1 = 0, h2 = 0;
  const t0 = now();
  const freeCount = new Int16Array(K);
  const leafSeen = new Uint8Array(K);

  function candidates() {
    freeCount.fill(0);
    const list = [];
    for (let i = 0; i < n; i++) {
      if ((onBoard[i] && block[i] === 0) || onShelf[i]) { freeCount[types[i]]++; list.push(i); }
    }
    leafSeen.fill(0);
    const scored = [];
    for (const c of list) {
      const t = types[c];
      const leaf = onShelf[c] || below[c].length === 0;
      if (leaf) {
        // Blatt-Steine gleicher Sorte sind austauschbar: nur einen betrachten
        if (leafSeen[t]) continue;
        leafSeen[t] = 1;
      }
      const ct = tray[t];
      let s = 0;
      if (ct === 2) s += 10000;
      else {
        if (ct + freeCount[t] >= 3) s += 3000 + ct * 500;
        else s += ct * 400;
        if (ct === 0 && traySize >= 4) s -= 1200 * (traySize - 3);
      }
      if (onBoard[c]) {
        for (const j of below[c]) {
          if (block[j] === 1) s += 60 + (tray[types[j]] > 0 ? 80 : 0) + (types[j] === t ? 40 : 0);
          else s += 6;
        }
      }
      scored.push(s * 1024 + (1023 - (c & 1023)));
      scored.push(c);
    }
    // Paare (Score, id) nach Score absteigend sortieren
    const m = scored.length / 2;
    const idx = Array.from({ length: m }, (_, k) => k);
    idx.sort((a, b) => scored[b * 2] - scored[a * 2]);
    return idx.map((k) => scored[k * 2 + 1]);
  }

  function dfs() {
    if (remaining === 0) return traySize === 0;
    nodes++;
    if (nodes > nodeLimit) { aborted = true; return false; }
    if ((nodes & 511) === 0 && now() - t0 > timeLimit) { aborted = true; return false; }
    const key = (h1 >>> 0) * 1048576 + ((h2 >>> 0) & 0xfffff);
    if (failed.has(key)) return false;
    const cands = candidates();
    for (const c of cands) {
      const t = types[c];
      const before = tray[t];
      let cleared = false;
      if (before === 2) cleared = true;
      else if (traySize + 1 >= trayLimit) continue; // Ablage wäre voll
      // anwenden
      if (cleared) { tray[t] = 0; traySize -= 2; } else { tray[t] = before + 1; traySize++; }
      const wasShelf = onShelf[c] === 1;
      if (wasShelf) onShelf[c] = 0;
      else {
        onBoard[c] = 0;
        for (const j of below[c]) block[j]--;
      }
      remaining--;
      const zi = c % ZOB_N;
      h1 ^= zob1[zi] + c; h2 ^= zob2[zi] ^ (c * 2654435761);
      const ok = dfs();
      if (ok) { path.push(c); return true; }
      // zurücknehmen
      h1 ^= zob1[zi] + c; h2 ^= zob2[zi] ^ (c * 2654435761);
      remaining++;
      if (wasShelf) onShelf[c] = 1;
      else {
        onBoard[c] = 1;
        for (const j of below[c]) block[j]++;
      }
      if (cleared) { tray[t] = 2; traySize += 2; } else { tray[t] = before; traySize--; }
      if (aborted) return false;
    }
    if (!aborted) failed.add(key);
    return false;
  }

  const ok = dfs();
  path.reverse();
  return ok ? { ok: true, path, nodes } : { ok: false, reason: aborted ? 'limit' : 'unsolvable', nodes };
}

/**
 * Tipp: welche Steine soll man als Nächstes nehmen?
 * Liefert { ids:[...], sure } – ids sind alle sofort antippbar und von derselben Sorte.
 */
export function findHint(pos, opts = {}) {
  const n = pos.types.length;
  const types = pos.types;
  const isFree = (i) => (pos.where[i] === WHERE.BOARD && pos.block[i] === 0) || pos.where[i] === WHERE.SHELF;
  const trayCount = (t) => pos.tray.reduce((a, id) => a + (types[id] === t ? 1 : 0), 0);
  const r = solve(pos, opts);
  if (r.ok && r.path.length) {
    const first = r.path[0];
    const t = types[first];
    const need = 3 - trayCount(t);
    const ids = [first];
    for (let k = 1; k < r.path.length && ids.length < need; k++) {
      const c = r.path[k];
      if (types[c] === t && isFree(c)) ids.push(c);
    }
    return { ids, sure: true };
  }
  // Heuristik: Sorte mit den meisten Steinen in Ablage + frei
  const free = [];
  for (let i = 0; i < n; i++) if (isFree(i)) free.push(i);
  if (!free.length) return { ids: [], sure: false };
  let best = null, bestScore = -Infinity;
  const seen = new Set();
  for (const i of free) {
    const t = types[i];
    if (seen.has(t)) continue;
    seen.add(t);
    const inTray = trayCount(t);
    const avail = free.filter((j) => types[j] === t).length;
    const score = (inTray + avail >= 3 ? 100 : 0) + inTray * 10 + avail;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  const need = 3 - trayCount(best);
  return { ids: free.filter((j) => types[j] === best).slice(0, Math.max(1, need)), sure: false };
}
