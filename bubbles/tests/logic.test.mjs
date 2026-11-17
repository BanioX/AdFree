// Reine Logik: Geometrie, Flugbahn, Regeln, Level, Inhalte.  node --test bubbles/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, STONE, isColor, petOf } from '../core/board.js';
import { WIDTH, HIT, LAUNCH_X, LAUNCH_Y, ROWS, MIN_ANGLE, hexDistance } from '../core/hex.js';
import { traceShot } from '../core/trace.js';
import { Game, COMBO_STEP, SPECIALS } from '../core/game.js';
import { Rng } from '../core/rng.js';
import { bestMove, autoPlay } from '../core/solver.js';
import { getLevel, parseRows, parseMask, HANDMADE_COUNT } from '../core/levels.js';
import { LEVELS } from '../data/levels.js';
import { PATTERNS } from '../data/patterns.js';
import { COLORS } from '../data/colors.js';
import { WORLDS, LEVELS_PER_WORLD } from '../data/worlds.js';

const LEVEL_COUNT = 240;

function randomBoard(rng, rows = 8, colors = 5, fill = 0.85) {
  const b = new Board([], rng.int(0, 1));
  b.ensureRows(rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < b.rowLen(r); c++) {
      if (r === 0 || rng.next() < fill) b.rows[r][c] = rng.int(1, colors);
    }
  }
  for (const [r, c] of b.floating()) b.rows[r][c] = 0;
  b.trim();
  return b;
}

/** Abstand Punkt–Strecke */
function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L)) : 0;
  return Math.hypot(a.x + dx * t - px, a.y + dy * t - py);
}

// ---------- Geometrie ----------

test('Nachbarschaft ist symmetrisch und Hex-Distanz 1', () => {
  for (const shift of [0, 1]) {
    const b = new Board([], shift);
    b.ensureRows(10);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < b.rowLen(r); c++) {
        const ns = b.neighbors(r, c);
        assert.ok(ns.length >= 2 && ns.length <= 6);
        for (const [nr, nc] of ns) {
          if (nr >= 10) continue;
          assert.ok(b.neighbors(nr, nc).some(([a, d]) => a === r && d === c), `sym ${r}/${c}`);
          assert.equal(hexDistance({ r, c }, { r: nr, c: nc }, shift), 1);
          const d = Math.hypot(b.x(r, c) - b.x(nr, nc), b.y(r) - b.y(nr));
          assert.ok(Math.abs(d - 2) < 1e-9, 'Nachbarn liegen 2 Einheiten auseinander');
        }
      }
    }
  }
});

test('Gruppen und lose Blasen', () => {
  const b = new Board([
    [1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  ]);
  assert.equal(b.group(0, 0).length, 3);
  assert.equal(b.group(0, 2).length, 2);
  assert.equal(b.floating().length, 0);
  b.rows[1][2] = 0; // (2,2) hängt jetzt nur noch an (1,1)? nein – leer → fällt
  assert.deepEqual(b.floating(), [[2, 2]]);
});

// ---------- Flugbahn ----------

test('Flugbahn: Wände exakt, keine Durchdringung, gültige Zielzelle (tausende Schüsse)', () => {
  const rng = new Rng('trace');
  let shots = 0, bounces = 0;
  for (let k = 0; k < 120; k++) {
    const b = randomBoard(rng, rng.int(1, 12), 6, 0.5 + rng.next() * 0.45);
    const occ = b.occupied();
    for (let i = 0; i < 40; i++) {
      const a = MIN_ANGLE + rng.next() * (180 - 2 * MIN_ANGLE);
      const tr = traceShot(b, a);
      shots++;
      const pts = tr.points;
      assert.ok(pts.length >= 2);
      assert.equal(pts[0].x, LAUNCH_X);
      assert.equal(pts[0].y, LAUNCH_Y);
      for (let j = 1; j < pts.length; j++) {
        const p = pts[j];
        assert.ok(p.x >= 1 - 1e-9 && p.x <= WIDTH - 1 + 1e-9, 'in den Wänden');
        assert.ok(p.y <= pts[j - 1].y + 1e-9, 'fliegt immer nach oben');
        // Reflexion: Steigungsbetrag bleibt gleich
        if (j >= 2) {
          const s1 = Math.abs((p.y - pts[j - 1].y) / (p.x - pts[j - 1].x || 1e-12));
          const s0 = Math.abs((pts[j - 1].y - pts[j - 2].y) / (pts[j - 1].x - pts[j - 2].x || 1e-12));
          if (Number.isFinite(s0) && Number.isFinite(s1) && s0 < 1e6 && s1 < 1e6) assert.ok(Math.abs(s0 - s1) < 1e-6 * Math.max(1, s0), 'Einfallswinkel = Ausfallswinkel');
        }
        // Keine Blase wird unterwegs durchflogen
        for (const o of occ) assert.ok(segDist(o.x, o.y, pts[j - 1], p) >= HIT - 1e-6, 'keine Durchdringung');
      }
      bounces += pts.length - 2;
      const t = tr.target;
      assert.ok(t, 'Zielzelle vorhanden');
      assert.ok(b.inRange(t.r, t.c), 'Ziel im Raster');
      assert.equal(b.get(t.r, t.c), 0, 'Ziel ist frei');
      const attached = t.r === 0 || b.neighbors(t.r, t.c).some(([r, c]) => b.get(r, c));
      assert.ok(attached, 'Ziel hängt an Decke oder Blase');
      if (tr.hit) {
        const end = pts[pts.length - 1];
        // Andockpunkt liegt nahe an der Zielzelle
        assert.ok(Math.hypot(b.x(t.r, t.c) - end.x, b.y(t.r) - end.y) < 2.2, 'Einrasten in der Nähe');
      }
    }
  }
  assert.ok(shots >= 4000);
  assert.ok(bounces > 200, 'auch Wand-Abpraller getestet');
});

test('Flugbahn: gerade nach oben trifft die Blase direkt darüber', () => {
  const b = new Board([[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]]);
  const tr = traceShot(b, 90);
  assert.deepEqual(tr.hit, { r: 0, c: 5 });
  assert.equal(tr.target.r, 1);
  assert.ok([4, 5].includes(tr.target.c));
});

test('Feuerkugel durchschlägt alles auf dem Weg', () => {
  const b = randomBoard(new Rng('fire'), 8, 4, 1);
  const tr = traceShot(b, 90, { pierce: true });
  assert.equal(tr.target, null);
  assert.ok(tr.pierced.length >= 8);
  for (let i = 1; i < tr.pierced.length; i++) assert.ok(tr.pierced[i].s >= tr.pierced[i - 1].s);
});

// ---------- Regeln ----------

function checkInvariants(g) {
  const b = g.board;
  assert.equal(b.floating().length, 0, 'keine schwebenden Blasen');
  if (b.rows.length) assert.ok(b.rows[b.rows.length - 1].some((v) => v), 'getrimmt');
  if (g.status === 'play') {
    const present = b.colorsPresent();
    if (present.length) {
      assert.ok(present.includes(g.current), 'Werfer bietet nur vorhandene Farben');
      assert.ok(present.includes(g.next), 'nächste Kugel nur vorhandene Farben');
    }
  }
  for (const row of b.rows) for (const v of row) assert.ok(v === 0 || isColor(v) || (v & 15) === STONE, 'nur Farben/Steine');
}

test('Viele Zufallsschüsse: Regeln bleiben stimmig, Speichern/Laden verlustfrei', () => {
  const rng = new Rng('rules');
  let pops = 0, drops = 0, specials = 0, games = 0;
  for (let n = 1; n <= 40; n++) {
    const g = Game.newLevel({ ...getLevel(n), shots: 60 });
    games++;
    for (let i = 0; i < 60 && g.status === 'play'; i++) {
      if (g.specials.length && rng.chance(0.4)) { g.arm(rng.int(0, g.specials.length - 1)); specials++; }
      if (rng.chance(0.2)) g.swap();
      const before = g.board.count();
      const cur = g.armedType ? null : g.current;
      const ev = g.shoot(MIN_ANGLE + rng.next() * (180 - 2 * MIN_ANGLE));
      assert.ok(ev);
      const added = ev.target && (ev.kind === 'normal' || ev.kind === 'rainbow') ? 1 : 0;
      assert.equal(g.board.count(), before + added - ev.removed.length, 'Blasen-Bilanz');
      if (ev.kind === 'normal' && !ev.placed && ev.target) {
        // eine 3er-Gruppe inkl. der geschossenen Blase ist geplatzt
        const popped = ev.removed.filter((o) => o.how === 'pop');
        assert.ok(popped.length >= 3);
        assert.ok(popped.every((o) => (o.v & 15) === cur), 'nur gleiche Farbe platzt');
      }
      pops += ev.removed.filter((o) => o.how === 'pop').length;
      drops += ev.removed.filter((o) => o.how === 'drop').length;
      checkInvariants(g);
      const copy = Game.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
      assert.deepEqual(copy.toJSON(), g.toJSON());
    }
  }
  assert.ok(games === 40 && pops > 500 && drops > 50 && specials > 0, `pops ${pops} drops ${drops} specials ${specials}`);
});

test('Kombo schenkt Spezialkugeln (Bombe, Regenbogen, Feuer)', () => {
  const g = Game.newLevel({ ...getLevel(25), shots: 200 });
  autoPlay(g, { maxShots: 200, useSpecials: false });
  // Spezialkugeln wurden verdient (Treffer in Folge oder grosse Abwürfe)
  assert.ok(g.earnedCount >= 1 || g.bestCombo < COMBO_STEP);
  for (const s of g.specials) assert.ok(SPECIALS.includes(s));
});

test('Bombe räumt einen Umkreis ab, Regenbogen passt zu jeder Farbe', () => {
  const rows = [];
  for (let r = 0; r < 6; r++) rows.push(new Array(r % 2 ? 10 : 11).fill(0).map((_, c) => 1 + ((r + c) % 4)));
  const g = Game.newLevel({ n: 99, goal: 'clear', rows, colors: [1, 2, 3, 4], pets: [], shots: 30, stars: [5, 10] });
  g.specials = ['bomb', 'rainbow'];
  g.arm(0);
  const before = g.board.count();
  const ev = g.shoot(90);
  assert.equal(ev.kind, 'bomb');
  assert.ok(ev.removed.length >= 7, 'Bombe trifft mehrere Blasen');
  assert.ok(g.board.count() < before);
  assert.equal(g.shotsLeft, 30, 'Spezialkugeln kosten keinen Schuss');
  checkInvariants(g);
  g.arm(0);
  const ev2 = g.shoot(60);
  assert.equal(ev2.kind, 'rainbow');
  checkInvariants(g);
});

test('Tierchen befreien: Sieg, sobald alle frei sind', () => {
  const def = getLevel(4);
  assert.equal(def.goal, 'pets');
  const g = Game.newLevel(def);
  assert.ok(g.petsTotal > 0);
  autoPlay(g, { maxShots: 200 });
  assert.equal(g.status, 'won');
  assert.equal(g.petsFreed, g.petsTotal);
  assert.equal(g.board.count(), 0, 'beim Sieg fällt der Rest als Bonus');
});

test('Niederlage: +5 Schüsse und Rettung führen immer weiter', () => {
  const g = Game.newLevel({ ...getLevel(30), shots: 2 });
  g.shoot(30); g.shoot(150);
  if (g.status === 'won') return;
  assert.equal(g.status, 'lost');
  assert.equal(g.lostReason, 'shots');
  assert.ok(g.continueWithShots());
  assert.equal(g.status, 'play');
  assert.equal(g.shotsLeft, 5);
  assert.equal(g.starsNow, 1, 'nach Extraschüssen höchstens 1 Stern');
  // Überlauf: viele Fehlschüsse ins Leere
  const e = Game.newEndless(42);
  let k = 0;
  while (e.status === 'play' && k++ < 400) e.shoot(k % 2 ? 9 : 171);
  assert.equal(e.status, 'lost');
  assert.equal(e.lostReason, 'overflow');
  const ev = e.rescue();
  assert.ok(ev && ev.removed.length > 0);
  assert.equal(e.status, 'play');
  assert.ok(e.board.maxRow() < ROWS - 4);
  checkInvariants(e);
});

test('Entspannt: endlos spielbar, Decke sinkt nach Fehlschüssen, Feld füllt sich nach', () => {
  const g = Game.newEndless(7);
  let descended = 0, refilled = 0;
  for (let i = 0; i < 250 && g.status === 'play'; i++) {
    const m = bestMove(g, { step: 2 });
    if (m.swap) g.swap();
    if (m.arm >= 0) g.arm(m.arm);
    const ev = g.shoot(m.angle);
    if (ev.descended) descended++;
    if (ev.refilled) refilled++;
    checkInvariants(g);
    assert.ok(g.board.count() > 0);
  }
  assert.ok(g.score > 3000, `Punkte ${g.score}`);
  assert.ok(refilled > 0, 'neue Blasen kommen nach');
  const miss = Game.newEndless(8);
  let streak = 0, sank = 0;
  for (let i = 0; i < 40 && miss.status === 'play'; i++) {
    const limit = miss.missLimit;
    const before = miss.misses;
    const ev = miss.shoot(i % 2 ? 9 : 171);
    if (!ev.removed.length && before + 1 >= limit) { assert.ok(ev.descended, 'nach zu vielen Fehlschüssen sinkt die Decke'); sank++; }
    streak = miss.misses;
  }
  assert.ok(sank + descended >= 1, 'Decke sinkt');
});

// ---------- Level & Inhalte ----------

test('Farben: eindeutige Buchstaben und Symbole', () => {
  const list = COLORS.filter(Boolean);
  assert.equal(new Set(list.map((c) => c.key)).size, list.length);
  assert.equal(new Set(list.map((c) => c.symbol)).size, list.length);
  list.forEach((c, i) => assert.equal(c.id, i + 1));
});

test('Welten: Himmel, Farben und Tierchen vollständig', () => {
  for (const w of WORLDS) {
    assert.equal(w.sky.length, 3);
    for (const s of w.sky) assert.match(s, /^#[0-9a-f]{6}$/i);
    assert.ok(w.colors.length >= 6 && w.colors.every((k) => COLORS[k]));
    assert.ok(w.pets.length >= 1);
    assert.ok(!/ß/.test(w.name));
  }
});

function assertConnected(rows, label) {
  const b = new Board(rows);
  assert.ok(b.rows[0].some((v) => v), `${label}: oberste Zeile belegt`);
  assert.equal(b.floating().length, 0, `${label}: alles hängt an der Decke`);
}

test('Handgezeichnete Level: Format gültig, alles hängt, keine Steine oben', () => {
  assert.ok(LEVELS.length >= 20);
  LEVELS.forEach((L, i) => {
    assert.ok(L.name && !/ß/.test(L.name), `Level ${i + 1} Name`);
    const rows = parseRows(L.rows, 3);
    assertConnected(rows, `Level ${i + 1}`);
    assert.ok(rows.length <= ROWS - 3, `Level ${i + 1} nicht zu hoch`);
    assert.ok(!rows[0].some((v) => (v & 15) === STONE), `Level ${i + 1}: kein Stein in Zeile 1`);
    if (L.goal === 'pets') assert.ok(rows.flat().some((v) => petOf(v)), `Level ${i + 1}: Tierchen fehlen`);
  });
});

test('Form-Vorlagen: gültig und zusammenhängend', () => {
  assert.ok(PATTERNS.length >= 8);
  for (const p of PATTERNS) {
    const mask = parseMask(p.rows);
    assertConnected(mask.map((row) => row.map((v) => (v ? 1 : 0))), p.name);
  }
});

test(`${LEVEL_COUNT} Level: deterministisch, gültig und vom Computer lösbar`, () => {
  const goals = { clear: 0, pets: 0 };
  let stones = 0;
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const d = getLevel(n);
    assert.equal(d.n, n);
    assert.deepEqual(getLevel(n).rows, d.rows, 'deterministisch');
    const b = new Board(d.rows, d.shift);
    assertConnected(d.rows, `Level ${n}`);
    assert.ok(b.maxRow() <= ROWS - 4, `Level ${n} zu hoch`);
    assert.ok(d.colors.length >= 2 && d.colors.length <= 7, `Level ${n} Farben`);
    assert.ok(d.shots >= 12 && d.shots <= 60, `Level ${n} Schüsse ${d.shots}`);
    assert.ok(d.stars[0] >= 1 && d.stars[1] > d.stars[0] && d.stars[1] < d.shots, `Level ${n} Sterne`);
    assert.ok(d.par < d.shots, `Level ${n}: Schüsse reichen`);
    goals[d.goal]++;
    if (b.occupied().some((o) => (o.v & 15) === STONE)) stones++;
    if (d.goal === 'pets') assert.ok(b.petCount() >= 1);
    if (n <= HANDMADE_COUNT) assert.ok(d.handmade);
    // Lösbarkeit mit dem tatsächlichen Schussbudget
    const g = Game.newLevel(d);
    autoPlay(g, { step: 1, maxShots: d.shots + 5 });
    assert.equal(g.status, 'won', `Level ${n} vom Computer nicht gelöst`);
  }
  assert.ok(goals.pets >= 40, `genug Tierchen-Level (${goals.pets})`);
  assert.ok(stones >= 30, `Steine kommen vor (${stones})`);
  assert.equal(LEVELS_PER_WORLD, 20);
});
