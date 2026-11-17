// Inhalte prüfen: Packs, Paletten, Maler (mit einer Attrappe für Canvas 2D) und Spielstand-Plätze.
// Start: node --test jigsaw/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { packs, randomRecipes, randomNames } from '../data/packs.js';
import { palettes, paletteIds } from '../data/palettes.js';
import { painters, painterById } from '../art/index.js';
import { makeRng } from '../../shared/rng.js';
import { slotFor, parseSlot } from '../saves.js';
import { gridFor, TIERS } from '../logic.js';

// ---------- Canvas-Attrappe: zählt Aufrufe und meldet ungültige Zahlen ----------
globalThis.Path2D = globalThis.Path2D || class Path2D { constructor() {} addPath() {} moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} arc() {} ellipse() {} rect() {} closePath() {} };

function mockCanvas(w, h) {
  const stats = { calls: 0, bad: [] };
  const grad = { addColorStop(o, c) { if (!(o >= 0 && o <= 1)) stats.bad.push('addColorStop ' + o); if (typeof c !== 'string') stats.bad.push('color ' + c); } };
  const target = {
    canvas: null,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createConicGradient: () => grad,
    createPattern: () => ({}),
    getImageData: (x, y, ww, hh) => ({ width: ww, height: hh, data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)) }),
    createImageData: (ww, hh) => ({ width: ww, height: hh, data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)) }),
    measureText: (t) => ({ width: String(t).length * 8 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        stats.calls++;
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) { stats.bad.push(`${String(k)}(${args.join(',')})`); break; }
      };
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) stats.bad.push(`${String(k)} = ${v}`);
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string' && /undefined|NaN/.test(v)) stats.bad.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  });
  const cv = { width: w, height: h, getContext: () => ctx, stats };
  target.canvas = cv;
  return cv;
}

function paint(painterId, palette, seed, opts = {}) {
  const cv = mockCanvas(300, 400);
  const p = painterById(painterId);
  const sub = [];
  p.paint(cv.getContext('2d'), {
    w: 1000, h: 1000 / 0.75, rng: makeRng(seed >>> 0), pal: palettes[palette], opts,
    makeCanvas: (w, h) => { const c = mockCanvas(w, h); sub.push(c); return c; },
  });
  const bad = cv.stats.bad.concat(...sub.map((c) => c.stats.bad));
  return { calls: cv.stats.calls, bad };
}

// ---------- Tests ----------

test('Packs: eindeutige IDs, gültige Maler und Paletten, deutsche Titel ohne ß', () => {
  const packIds = new Set();
  const seeds = new Set();
  for (const pack of packs) {
    assert.match(pack.id, /^[a-z0-9-]+$/, pack.id);
    assert.ok(!packIds.has(pack.id), 'doppelte Pack-ID ' + pack.id);
    packIds.add(pack.id);
    assert.ok(pack.title && !/ß/.test(pack.title), pack.id);
    assert.ok(pack.images.length >= 6, `${pack.id}: mindestens 6 Bilder`);
    const ids = new Set();
    for (const img of pack.images) {
      assert.match(img.id, /^[a-z0-9-]+$/, img.id);
      assert.ok(!ids.has(img.id), `${pack.id}: doppelte Bild-ID ${img.id}`);
      ids.add(img.id);
      assert.ok(img.title && !/ß/.test(img.title), `${pack.id}/${img.id}: Titel`);
      assert.ok(painterById(img.painter || pack.painter), `${pack.id}/${img.id}: Maler fehlt`);
      assert.ok(palettes[img.palette], `${pack.id}/${img.id}: Palette «${img.palette}» fehlt`);
      assert.ok(Number.isInteger(img.seed) && img.seed > 0, `${pack.id}/${img.id}: Seed`);
      const sk = `${img.painter || pack.painter}:${img.palette}:${img.seed}:${JSON.stringify(img.opts || {})}`;
      assert.ok(!seeds.has(sk), `${pack.id}/${img.id}: gleiches Bild wie ein anderes`);
      seeds.add(sk);
    }
  }
  assert.ok(packs.reduce((n, p) => n + p.images.length, 0) >= 60, 'genug Bilder');
});

test('Paletten: alle Rollen vorhanden und gültige Farben', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const id of paletteIds) {
    const p = palettes[id];
    assert.ok(p.title && !/ß/.test(p.title), id);
    assert.ok(Array.isArray(p.sky) && p.sky.length >= 2 && p.sky.every((c) => hex.test(c)), `${id}: sky`);
    for (const k of ['sun', 'far', 'near']) assert.match(p[k], hex, `${id}: ${k}`);
    for (const k of ['haze', 'ground']) if (p[k] != null) assert.match(p[k], hex, `${id}: ${k}`);
    assert.ok(Array.isArray(p.accents) && p.accents.length >= 3 && p.accents.every((c) => hex.test(c)), `${id}: accents`);
  }
});

test('Zufallsbilder: Rezepte verweisen auf vorhandene Maler und Paletten', () => {
  for (const r of randomRecipes) {
    assert.ok(painterById(r.painter), r.painter);
    for (const p of r.palettes) assert.ok(palettes[p], `${r.painter}: ${p}`);
    assert.ok((randomNames[r.painter] || []).length >= 2, `${r.painter}: Namen`);
  }
});

test('Maler: jedes Pack-Bild malt ohne Fehler und ohne ungültige Zahlen', () => {
  for (const pack of packs) {
    for (const img of pack.images) {
      const { calls, bad } = paint(img.painter || pack.painter, img.palette, img.seed, img.opts || {});
      assert.ok(calls > 50, `${pack.id}/${img.id}: zu wenig gemalt (${calls})`);
      assert.deepEqual(bad.slice(0, 3), [], `${pack.id}/${img.id}`);
    }
  }
});

test('Maler: jede Palette mit jedem Maler und vielen Seeds (Zufallsbilder)', () => {
  for (const painter of painters) {
    for (const pal of paletteIds) {
      for (const seed of [1, 77, 4242]) {
        const { bad } = paint(painter.id, pal, seed);
        assert.deepEqual(bad.slice(0, 3), [], `${painter.id}/${pal}/${seed}`);
      }
    }
  }
});

test('Spielstand-Plätze: hin und zurück', () => {
  for (const key of ['berge/alpenglut', 'zufall/123456', 'farben/a-rose', 'fgen/mandala/3', 'foto/k3x9a']) {
    for (const tier of TIERS) {
      for (const rotate of [false, true]) {
        assert.deepEqual(parseSlot(slotFor(key, tier, rotate)), { key, tier, rotate });
      }
    }
  }
  assert.equal(parseSlot('kaputt'), null);
  assert.equal(parseSlot('a@b'), null);
  assert.equal(parseSlot('@12'), null);
});

test('Teilezahlen: Hochformat 3:4 trifft die Stufen genau, Quadrat liegt nahe dran', () => {
  for (const t of TIERS) {
    const g = gridFor(t, 0.75);
    assert.equal(g.cols * g.rows, t);
    const q = gridFor(t, 1);
    assert.ok(Math.abs(q.cols * q.rows - t) / t <= 0.1, `Quadrat ${t}: ${q.cols}×${q.rows}`);
  }
});
