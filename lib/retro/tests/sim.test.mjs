import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, validateBoss, distPointSeg } from '../sim.js';
import { bosses as riesen } from '../../../riesen/data/bosses.js';

const rng = () => 0.5;

function world(extra, def) {
  const w = createWorld({
    mode: 'shoot',
    diff: 'normal',
    rng,
    coach: false,
    bosses: [def],
    labels: { core: 'KERN!', win: 'GLANZ!', phase: 'STUFE', praise: ['STARK!'], down: 'AUTSCH' },
    ...extra,
  });
  w.intro = 0;
  return w;
}

const laserBoss = {
  id: 't', name: 'TEST', hp: 400, x: 90, y: 80, hw: 30, hh: 30, bob: 0, playTop: 120,
  eyes: [{ ox: 0, oy: 0 }],
  core: { ox: 0, oy: 0, r: 8 }, bodyHurt: 1, coreHurt: 3,
  phases: [{ until: 0, steps: [{ kind: 'laser', dur: 3, warn: 0.5, from: 0, to: 0, width: 12, eyes: [0] }] }],
};

test('Strahl warnt, bevor er trifft', () => {
  const w = world({}, laserBoss);
  w.player.x = 90;
  w.player.y = 200;
  step(w, 0.35);
  assert.equal(w.lives, 3);
  step(w, 0.3);
  assert.equal(w.lives, 2);
  assert.ok(w.inv > 0);
});

test('neben dem Strahl bleibt man heil', () => {
  const w = world({}, laserBoss);
  w.player.x = 20;
  w.player.y = 200;
  step(w, 1);
  assert.equal(w.lives, 3);
});

test('Kanone schiesst nach dem Vorzeichen', () => {
  const w = world({}, {
    ...laserBoss,
    phases: [{ until: 0, steps: [{ kind: 'cannon', dur: 2, warn: 0.35, shots: 3, every: 0.3, speed: 80, spread: 0 }] }],
  });
  step(w, 0.2);
  assert.equal(w.bullets.filter((b) => b.team === 'foe').length, 0);
  step(w, 0.25);
  assert.ok(w.bullets.some((b) => b.team === 'foe'));
});

test('Ring lässt eine Lücke zum Spieler', () => {
  const w = world({}, {
    ...laserBoss,
    phases: [{ until: 0, steps: [{ kind: 'ring', dur: 2, warn: 0.2, count: 16, speed: 50, gap: 1.2 }] }],
  });
  w.player.x = 140;
  w.player.y = 240;
  step(w, 0.35);
  const foes = w.bullets.filter((b) => b.team === 'foe');
  assert.ok(foes.length > 0);
  const aim = Math.atan2(140 - w.boss.x, 240 - (w.boss.y + 6));
  for (const b of foes) {
    let d = Math.atan2(b.vx, b.vy) - aim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    assert.ok(Math.abs(d) >= 0.55, `Lücke verletzt ${d}`);
  }
});

test('Lenkschuss dreht zum Spieler', () => {
  const w = world({}, {
    ...laserBoss,
    phases: [{ until: 0, steps: [{ kind: 'home', dur: 2, warn: 0.1, shots: 1, every: 0.5, speed: 40, turn: 3 }] }],
  });
  w.player.x = 150;
  w.player.y = 240;
  step(w, 0.2);
  const b = w.bullets.find((x) => x.team === 'foe');
  assert.ok(b);
  const before = b.vx;
  w.player.x = 20;
  step(w, 0.45);
  assert.ok(b.vx < before);
});

test('Kern trifft härter als der Panzer', () => {
  const def = {
    ...laserBoss,
    phases: [{ until: 0.5, steps: [{ kind: 'wait', dur: 3 }] }, { until: 0, steps: [{ kind: 'wait', dur: 3 }] }],
  };
  const core = world({}, def);
  core.fireCd = 10;
  const c = { x: core.boss.x, y: core.boss.y, vx: 0, vy: 0, r: 2, team: 'ally', dmg: 1, life: 1 };
  core.bullets.push({ ...c });
  const hp0 = core.boss.hp;
  step(core, 0.05);
  const coreDmg = hp0 - core.boss.hp;
  const body = world({}, def);
  body.fireCd = 10;
  body.bullets.push({ x: body.boss.x + 20, y: body.boss.y, vx: 0, vy: 0, r: 2, team: 'ally', dmg: 1, life: 1 });
  const hp1 = body.boss.hp;
  step(body, 0.05);
  const bodyDmg = hp1 - body.boss.hp;
  assert.ok(coreDmg > bodyDmg, `${coreDmg} > ${bodyDmg}`);
  assert.equal(body.boss.phase, 0);
  body.boss.hp = body.boss.maxHp * 0.2;
  step(body, 0.05);
  assert.equal(body.boss.phase, 1);
});

test('Streifschuss gibt Punkte und kostet kein Leben', () => {
  const w = world({}, { ...laserBoss, phases: [{ until: 0, steps: [{ kind: 'wait', dur: 3 }] }] });
  w.fireCd = 10;
  w.player.x = 90;
  w.player.y = 200;
  w.bullets.push({ x: 100, y: 200, vx: 0, vy: 0, r: 3, team: 'foe', life: 1, grazed: false });
  step(w, 0.05);
  assert.equal(w.lives, 3);
  assert.ok(w.events.includes('graze'));
});

test('kein Leben beendet den Lauf', () => {
  const w = world({ lives: 1 }, laserBoss);
  w.player.x = 90;
  w.player.y = 200;
  step(w, 0.7);
  assert.equal(w.over, 'dead');
});

test('Ausweichen: der Riese wird müde und der Lauf ist gewonnen', () => {
  const w = world({ mode: 'dodge', diff: 'sanft' }, {
    ...laserBoss,
    fatigueTime: 0.4,
    phases: [{ until: 0, steps: [{ kind: 'wait', dur: 2 }] }],
  });
  w.player.x = 20;
  step(w, 0.6);
  assert.equal(w.over, 'down');
  step(w, 1.5);
  assert.equal(w.over, 'clear');
});

test('Plattform: Sprung und Stosswelle nur am Boden', () => {
  const def = {
    ...laserBoss,
    x: 150, y: 200, hw: 20, hh: 40,
    platforms: [{ x: 0, y: 300, w: 120, h: 20, floor: true }],
    phases: [{ until: 0, steps: [{ kind: 'shock', dur: 2, warn: 0.2, y: 300, band: 16, reach: 100 }] }],
  };
  const w = createWorld({
    mode: 'plat', diff: 'normal', rng, bosses: [def], coach: false,
    labels: { praise: ['STARK!'], win: 'GLANZ!', phase: 'STUFE', core: 'KERN!' },
  });
  w.intro = 0;
  w.wantJump = 0.2;
  const y0 = w.player.y;
  step(w, 0.08);
  assert.ok(w.player.y < y0);
  const ground = createWorld({
    mode: 'plat', diff: 'normal', rng, bosses: [def], coach: false,
    labels: { praise: ['STARK!'], win: 'GLANZ!', phase: 'STUFE', core: 'KERN!' },
  });
  ground.intro = 0;
  step(ground, 0.4);
  assert.ok(ground.lives < 3);
  const air = createWorld({
    mode: 'plat', diff: 'normal', rng, bosses: [def], coach: false,
    labels: { praise: ['STARK!'], win: 'GLANZ!', phase: 'STUFE', core: 'KERN!' },
  });
  air.intro = 0;
  air.player.y = 240;
  air.player.vy = -10;
  air.player.onGround = false;
  const lives = air.lives;
  step(air, 0.05);
  assert.equal(air.lives, lives);
});

test('Bossdaten der Riesenjagd sind gültig', () => {
  for (const b of riesen('de')) {
    assert.deepEqual(validateBoss(b), []);
  }
  for (const b of riesen('en')) assert.ok(b.name);
});

test('Abstand zum Strahl', () => {
  assert.ok(distPointSeg(0, 5, 0, 0, 0, 10) < 0.01);
  assert.ok(distPointSeg(5, 5, 0, 0, 0, 10) > 4);
});
