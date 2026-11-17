// Level-Generator für den Pfeilwürfel (deterministisch pro Levelnummer, unendlich viele Level).
//
// Rückwärts-Konstruktion garantiert Lösbarkeit: Pfeile werden nacheinander platziert.
// Ein neuer Pfeil darf nur dorthin, wo (a) alle seine Zellen frei sind, (b) sein Strahl
// (vom Kopf bis zum Rand der Kopf-Seite) keine belegte Zelle enthält und (c) der Strahl
// nicht durch den eigenen Körper geht. Entfernt man die Pfeile in umgekehrter Reihenfolge,
// hat jeder Pfeil freie Bahn. Da Entfernen nur Platz schafft, kann man sich nie festfahren.

import { makeRng } from '../shared/rng.js';
import { makeCube } from './geometry.js';
import { SIZES, LATE_SIZES, HEARTS, SPECIAL_EVERY, SPECIALS, CHAPTER_SIZE, THEMES } from './data/levels.js';

/** Seiten, die in der Standard-Ansicht (3/4-Ansicht) sichtbar sind: +X, +Y, +Z. */
export const FRONT_FACES = [0, 2, 4];

/** Spezial-Definition für Level L (oder null). */
export function specialFor(level) {
  const L = Math.max(1, Math.floor(level) || 1);
  if (L % SPECIAL_EVERY !== 0) return null;
  return SPECIALS[(L / SPECIAL_EVERY - 1) % SPECIALS.length];
}

/** Kapitel-Thema (Papierfarbe) für Level L. */
export function themeFor(level) {
  const L = Math.max(1, Math.floor(level) || 1);
  const ch = Math.floor((L - 1) / CHAPTER_SIZE);
  return { chapter: ch + 1, ...THEMES[ch % THEMES.length] };
}

/** Parameter eines Levels (Grösse, Dichte, Herzen, Spezial). */
export function levelParams(level) {
  const L = Math.max(1, Math.floor(level) || 1);
  const rng = makeRng(`pfeilwuerfel-param-${L}`);
  const row = SIZES.find((r) => L <= r.to);
  let N = row ? row.N : rng.pick(LATE_SIZES);

  // Kleine Verschnaufpausen: ab und zu eine Nummer kleiner
  if (L > 12 && L % SPECIAL_EVERY !== 0 && L % 7 === 3) N = Math.max(4, N - 1);

  const sp = specialFor(L);
  const special = sp ? sp.id : null;

  let density;
  if (L === 1) density = 0.45;
  else if (L === 2) density = 0.6;
  else density = 0.68 + 0.2 * Math.min(1, (L - 3) / 60);

  let grew = false;
  if (sp && sp.grow && N < 10) { N = Math.min(10, N + sp.grow); grew = true; }
  if (sp && sp.maxN && N > sp.maxN) N = sp.maxN;

  let hearts = (HEARTS.find((r) => N <= r.maxN) || HEARTS[HEARTS.length - 1]).hearts;
  if (sp && sp.hearts) hearts += sp.hearts;
  hearts = Math.max(3, Math.min(5, hearts));
  if (sp && sp.density) density += sp.density;
  if (sp && sp.maxDensity) density = Math.min(density, sp.maxDensity);
  density = Math.min(0.9, density);

  let maxLen = L === 1 ? 3 : L === 2 ? 4 : Math.min(10, N + 2);
  let minLen = 2;
  if (sp && sp.minLen) minLen = sp.minLen;
  if (sp && sp.maxLen) maxLen = Math.min(12, maxLen + sp.maxLen);
  maxLen = Math.max(minLen, maxLen);
  // Höchstzahl freier Pfeile zu Beginn (auf grossen Würfeln knapp halten)
  const cells = 6 * N * N;
  const estArrows = cells * density / (N >= 6 ? 5.5 : 4.2);
  const maxFree = N >= 6 ? Math.max(4, Math.round(estArrows * 0.1))
    : N >= 4 ? Math.max(3, Math.round(estArrows * 0.22)) : 99;
  const minFree = L <= 8 ? 3 : N >= 8 ? 4 : 3;
  // Abbiegefreude: grössere Würfel bekommen verschlungenere Pfeile
  let turn = L <= 2 ? 0.25 : 0.32 + 0.12 * Math.min(1, L / 50);
  if (sp && typeof sp.turn === 'number') turn = sp.turn;
  const mustCross = !!(sp && sp.mustCross);
  // Höchstzahl Kurven pro Pfeil (auf einer Seite; über eine Kante gerade weiter zählt nicht)
  const maxTurns = sp && Number.isInteger(sp.maxTurns) && sp.maxTurns >= 0 ? sp.maxTurns : Infinity;

  return { level: L, N, density, hearts, special, grew, maxLen, minLen, maxFree, minFree, turn, maxTurns, mustCross };
}

function sampleLen(rng, minLen, maxLen) {
  // Dreiecksähnliche Verteilung mit Schwerpunkt im unteren Mittelfeld
  const span = maxLen - minLen;
  const t = (rng.next() + rng.next() + rng.next() * 0.6) / 2.6;
  return minLen + Math.round(t * span);
}

function buildOnce(geo, p, rng) {
  const { count } = geo;
  const occ = new Int32Array(count).fill(-1);
  const rayCover = Array.from({ length: count }, () => []); // Pfeile, deren Strahl über diese Zelle läuft
  const arrows = [];
  let order = []; // Platzierungsreihenfolge (Pfeil-IDs)
  let rank = []; // rank[id] = Position in order
  const free = []; // zu Beginn frei? (kein späterer Pfeil auf dem Strahl)
  let freeCount = 0;

  // Liste freier Zellen mit O(1)-Entfernen
  const empties = new Int32Array(count);
  const pos = new Int32Array(count);
  let nEmpty = count;
  for (let i = 0; i < count; i++) { empties[i] = i; pos[i] = i; }
  const takeCell = (c) => {
    const i = pos[c];
    const last = empties[--nEmpty];
    empties[i] = last; pos[last] = i;
    empties[nEmpty] = c; pos[c] = nEmpty;
  };

  const target = Math.round(p.density * count);
  let filled = 0;
  const mark = new Int32Array(count); // Markierungen pro Versuch
  let stamp = 0;
  const strict = p.N >= 4;
  const lowRank = (c) => { // frühester Platz, damit c auf keinem Strahl eines SPÄTEREN Pfeils liegt
    let k = 0;
    for (const a of rayCover[c]) if (rank[a] + 1 > k) k = rank[a] + 1;
    return k;
  };

  const makeCandidate = (head) => {
    const dirs = rng.shuffle([0, 1, 2, 3]);
    for (const d of dirs) {
      const ray = geo.ray(head, d);
      // Strahl der Länge 0 (Kopf am Rand, zeigt hinaus) ist immer frei – nur selten zulassen
      if (ray.length === 0 && strict && rng.next() < 0.85) continue;
      // Alle Pfeile auf dem Strahl müssen NACH dem neuen Pfeil kommen
      let kHigh = order.length;
      let blockedSelf = false;
      for (const c of ray) {
        const o = occ[c];
        if (o !== -1) { blockedSelf = true; if (rank[o] < kHigh) kHigh = rank[o]; }
      }
      let kLow = lowRank(head);
      if (kLow > kHigh) continue;
      stamp++;
      for (const c of ray) mark[c] = stamp; // eigener Strahl: Körper darf hier nicht hin
      mark[head] = stamp;
      const want = sampleLen(rng, p.minLen, p.maxLen);
      const cells = [head];
      let cur = head;
      let back = (d + 2) & 3; // Laufrichtung rückwärts (vom Kopf zum Schwanz)
      let turns = 0;
      for (let i = 1; i < want; i++) {
        const straight = back;
        const left = (back + 1) & 3;
        const right = (back + 3) & 3;
        let opts;
        const r = rng.next();
        // Direkt hinter dem Kopf geht es immer gerade weiter (Spitze zeigt in Laufrichtung)
        if (i === 1 || turns >= p.maxTurns) opts = [straight];
        else if (r < p.turn / 2) opts = [left, straight, right];
        else if (r < p.turn) opts = [right, straight, left];
        else opts = rng.next() < 0.5 ? [straight, left, right] : [straight, right, left];
        let moved = false;
        for (const o of opts) {
          const nb = geo.next[cur * 4 + o];
          if (occ[nb] !== -1 || mark[nb] === stamp) continue;
          const kl = lowRank(nb);
          if (kl > kHigh) continue;
          if (kl > kLow) kLow = kl;
          mark[nb] = stamp;
          cells.push(nb);
          back = geo.nextDir[cur * 4 + o];
          if (o !== straight) turns++;
          cur = nb;
          moved = true;
          break;
        }
        if (!moved) break;
      }
      if (cells.length < p.minLen) return null;
      cells.reverse(); // Schwanz ... Kopf
      let crosses = false;
      const f0 = geo.faceOf(cells[0]);
      for (const c of cells) if (geo.faceOf(c) !== f0) { crosses = true; break; }
      if (p.mustCross && !crosses) return null;
      // Welche bisher freien Pfeile würde er blockieren?
      const blocks = new Set();
      for (const c of cells) for (const a of rayCover[c]) if (free[a]) blocks.add(a);
      const net = (blockedSelf ? 0 : 1) - blocks.size; // Änderung der Anzahl freier Pfeile
      let wNet;
      if (freeCount + net > p.maxFree) wNet = 2.4;
      else if (freeCount + net < p.minFree) wNet = -1.2;
      else wNet = 0.4;
      const score = -net * wNet + cells.length * 0.35 + (crosses ? 0.9 : 0)
        + (ray.length === 0 ? -2 : 0) + rng.next() * 1.2;
      return { cells, dir: d, ray, score, blocks, blockedSelf, k: kLow + Math.floor(rng.next() * (kHigh - kLow + 1)) };
    }
    return null;
  };

  const place = (cand) => {
    const id = arrows.length;
    arrows.push({ cells: cand.cells, dir: cand.dir });
    order.splice(cand.k, 0, id);
    rank = new Array(arrows.length);
    order.forEach((a, i) => { rank[a] = i; });
    for (const a of cand.blocks) { free[a] = false; freeCount--; }
    free.push(!cand.blockedSelf);
    if (!cand.blockedSelf) freeCount++;
    for (const c of cand.cells) { occ[c] = id; takeCell(c); }
    for (const c of cand.ray) rayCover[c].push(id);
    filled += cand.cells.length;
  };

  // Nur-gerade-Level (maxTurns): gerade Pfeile blockieren sich selten – freie Pfeile hart begrenzen,
  // sonst wird es zu leicht. Lieber etwas weniger dicht.
  const tightFill = Number.isFinite(p.maxTurns);
  const tooFree = (cand) => tightFill && freeCount >= p.maxFree && (cand.blockedSelf ? 0 : 1) - cand.blocks.size > 0;
  let fails = 0;
  const maxFails = 60 + count / 2;
  const K = p.N >= 6 ? 8 : 5;
  while (filled < target && fails < maxFails && nEmpty > 1) {
    let best = null;
    for (let k = 0; k < K; k++) {
      const head = empties[Math.floor(rng.next() * nEmpty)];
      const cand = makeCandidate(head);
      if (cand && tooFree(cand)) continue;
      if (cand && (!best || cand.score > best.score)) best = cand;
    }
    if (!best) { fails++; continue; }
    place(best);
  }

  // Lücken auffüllen: jede leere Zelle systematisch als Kopf probieren
  if (filled < target) {
    const rest = rng.shuffle(Array.from(empties.subarray(0, nEmpty)));
    for (const head of rest) {
      if (filled >= target) break;
      if (occ[head] !== -1) continue;
      let best = null;
      for (let k = 0; k < 4; k++) {
        const cand = makeCandidate(head);
        if (cand && (!best || cand.score > best.score)) best = cand;
      }
      if (!best) continue;
      // Nur-gerade-Level: beim Auffüllen keine zusätzlichen freien Pfeile mehr (sonst wird es zu leicht)
      if (tooFree(best)) continue;
      place(best);
    }
  }

  // In Platzierungsreihenfolge ausgeben (Lösungsreihenfolge = umgekehrt)
  return { arrows: order.map((id) => arrows[id]), filled, freeCount };
}

/** Pfeile, die im Ausgangszustand frei sind (Hilfsfunktion, auch für Tests). */
export function freeArrowIds(geo, arrows, removed = null) {
  const occ = new Int32Array(geo.count).fill(-1);
  arrows.forEach((a, i) => { if (!removed || !removed[i]) for (const c of a.cells) occ[c] = i; });
  const out = [];
  arrows.forEach((a, i) => {
    if (removed && removed[i]) return;
    const head = a.cells[a.cells.length - 1];
    if (geo.ray(head, a.dir).every((c) => occ[c] === -1)) out.push(i);
  });
  return out;
}

/** Simuliert das Lösen: entfernt wiederholt freie Pfeile. Gibt die Reihenfolge zurück oder null. */
export function solve(geo, arrows) {
  const removed = new Uint8Array(arrows.length);
  const occ = new Int32Array(geo.count).fill(-1);
  arrows.forEach((a, i) => { for (const c of a.cells) occ[c] = i; });
  const rays = arrows.map((a) => geo.ray(a.cells[a.cells.length - 1], a.dir));
  const order = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < arrows.length; i++) {
      if (removed[i]) continue;
      if (rays[i].every((c) => occ[c] === -1)) {
        removed[i] = 1;
        for (const c of arrows[i].cells) occ[c] = -1;
        order.push(i);
        progress = true;
      }
    }
  }
  return order.length === arrows.length ? order : null;
}

const levelCache = new Map();

/**
 * Erzeugt Level `level`:
 * { level, N, hearts, special, grew, arrows: [{ cells:[Schwanz..Kopf], dir }] }
 */
export function generateLevel(level) {
  const p = levelParams(level);
  const key = p.level;
  if (levelCache.has(key)) return levelCache.get(key);
  const geo = makeCube(p.N);
  let best = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = makeRng(`pfeilwuerfel-${p.level}-${attempt}`);
    const res = buildOnce(geo, p, rng);
    if (res.arrows.length < 2) continue;
    const free = freeArrowIds(geo, res.arrows);
    const dens = res.filled / geo.count;
    let score = -Math.abs(dens - p.density) * 40;
    if (free.length > p.maxFree) score -= (free.length - p.maxFree) * 1.5;
    if (p.level <= 2) {
      // Tutorial: mindestens zwei freie Pfeile auf den Seiten, die man zuerst sieht
      const visibleFree = free.filter((i) => {
        const a = res.arrows[i];
        return FRONT_FACES.includes(geo.faceOf(a.cells[a.cells.length - 1]));
      }).length;
      if (visibleFree < 2) score -= 50;
      if (p.level === 1 && free.length > 6) score -= 5;
    }
    if (score > bestScore) { bestScore = score; best = res; }
    if (score > -2) break;
  }
  const out = {
    level: p.level,
    N: p.N,
    hearts: p.hearts,
    special: p.special,
    grew: p.grew,
    arrows: best.arrows,
  };
  if (levelCache.size > 12) levelCache.delete(levelCache.keys().next().value);
  levelCache.set(key, out);
  return out;
}
