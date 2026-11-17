// Reine Spielsimulation für die Retro-Bosskämpfe (ohne DOM).
// Koordinaten: 180×320, y nach unten. Winkel 0 zeigt nach unten (atan2(vx, vy)).

export const VW = 180;
export const VH = 320;

export const DIFF = {
  sanft: { id: 'sanft', hp: 0.72, gap: 1.34, lives: 5, fire: 0.15, fatigue: 1.3 },
  normal: { id: 'normal', hp: 1, gap: 1, lives: 3, fire: 0.17, fatigue: 1 },
  wild: { id: 'wild', hp: 1.32, gap: 0.8, lives: 3, fire: 0.16, fatigue: 0.78 },
};

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function distPointSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function angOf(vx, vy) { return Math.atan2(vx, vy); }

function wrapPi(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rngStar(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: rng() * VW, y: rng() * VH, s: rng() < 0.18 ? 2 : 1, sp: 4 + rng() * 14, tw: rng() * 6 });
  }
  return out;
}

export function createWorld(opts) {
  const diff = DIFF[opts.diff] || DIFF.normal;
  const rng = opts.rng || Math.random;
  const world = {
    mode: opts.mode || 'shoot',
    diff,
    diffId: diff.id,
    bosses: opts.bosses,
    bossIndex: 0,
    w: VW,
    h: VH,
    t: 0,
    score: opts.score || 0,
    lives: opts.lives ?? diff.lives,
    maxLives: Math.max(diff.lives, 5),
    inv: 0,
    player: null,
    cat: { x: 70, y: 260 },
    bullets: [],
    particles: [],
    floaters: [],
    boss: null,
    intro: 0.85,
    over: null,
    banner: null,
    shake: 0,
    flash: 0,
    hitstop: 0,
    fireCd: 0.25,
    combo: 0,
    comboT: 0,
    aim: null,
    pad: { x: 0, y: 0, jump: false },
    keys: { x: 0, y: 0 },
    wantJump: 0,
    jumpHeld: false,
    events: [],
    rng,
    stars: rngStar(rng, 42),
    clouds: Array.from({ length: 5 }, () => ({
      x: rng() * VW, y: 30 + rng() * 220, w: 16 + rng() * 30, sp: 6 + rng() * 12,
    })),
    platforms: [],
    labels: opts.labels || { core: 'KERN!', win: 'GLANZ!', phase: 'STUFE' },
    coach: opts.coach !== false,
    reduced: !!opts.reduced,
    muzzle: 0,
    praiseI: 0,
  };
  beginBoss(world, opts.bossIndex || 0, true);
  if (opts.score) world.score = opts.score;
  if (opts.lives != null) world.lives = opts.lives;
  return world;
}

export function beginBoss(world, index, silent) {
  const def = world.bosses[index];
  world.bossIndex = index;
  const hp = Math.round(def.hp * world.diff.hp);
  world.boss = {
    def,
    hp,
    maxHp: hp,
    x: def.x,
    y: def.y,
    phase: 0,
    step: 0,
    stepT: 0,
    fired: 0,
    lock: null,
    laserOn: false,
    beams: [],
    flash: 0,
    fatigue: 0,
    timeF: 0,
    grazeF: 0,
    grazeCd: 0,
    alive: true,
  };
  world.bullets.length = 0;
  world.intro = silent ? world.intro : 0.75;
  world.over = null;
  world.banner = { text: def.name, t: 1.2 };
  world.platforms = (def.platforms || []).map((p) => ({ ...p }));
  if (world.mode === 'plat' && !world.platforms.length) {
    world.platforms.push({ x: 0, y: 300, w: 180, h: 20, floor: true });
  }
  placePlayer(world);
  world.fireCd = 0.3;
}

function placePlayer(world) {
  if (world.mode === 'plat') {
    const floor = world.platforms.find((p) => p.floor) || world.platforms[0];
    world.player = {
      x: 28, y: floor ? floor.y : 300, vx: 0, vy: 0,
      onGround: true, coyote: 0.12, facing: 1, w: 10, h: 14,
    };
  } else {
    world.player = { x: 90, y: 246, r: 3.15 };
  }
  const p = world.player;
  world.cat.x = p.x - 12;
  world.cat.y = p.y;
}

function playTop(world) {
  return world.boss?.def.playTop || (world.mode === 'dodge' ? 150 : 162);
}

function placeBoss(world) {
  const d = world.boss.def;
  const bob = d.bob === 0 ? 0 : 1;
  world.boss.x = d.x + Math.sin(world.t * 0.85) * 4 * bob;
  world.boss.y = d.y + Math.cos(world.t * 1.35) * 2 * bob;
}

function corePos(boss) {
  const phase = boss.phase;
  const shift = (boss.def.coreByPhase && boss.def.coreByPhase[phase]) || {};
  const c = boss.def.core;
  return {
    x: boss.x + (shift.ox ?? c.ox),
    y: boss.y + (shift.oy ?? c.oy),
    r: shift.r ?? c.r,
  };
}

export function coreOf(world) { return corePos(world.boss); }

function phaseIndex(world) {
  const boss = world.boss;
  const n = boss.def.phases.length;
  if (world.mode === 'dodge') {
    const f = boss.fatigue;
    const i = f < 0.34 ? 0 : f < 0.67 ? 1 : 2;
    return Math.min(i, n - 1);
  }
  const r = boss.hp / boss.maxHp;
  for (let i = 0; i < n - 1; i++) {
    if (r > boss.def.phases[i].until) return i;
  }
  return n - 1;
}

function pace(world) {
  let p = world.diff.gap;
  if (world.mode === 'dodge') {
    const f = world.boss.fatigue;
    if (f > 0.62) p *= 1 + (f - 0.62) * 1.35;
  }
  return p;
}

function burst(world, x, y, color, n, sp) {
  for (let i = 0; i < n && world.particles.length < 150; i++) {
    const a = world.rng() * Math.PI * 2;
    const v = sp * (0.35 + world.rng());
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.28 + world.rng() * 0.35, max: 0.6, color, s: world.rng() < 0.5 ? 2 : 3,
    });
  }
}

function floater(world, x, y, text) {
  if (world.floaters.length > 6) world.floaters.shift();
  world.floaters.push({ x, y, text, life: 0.7 });
}

function hurtPlayer(world) {
  if (world.inv > 0 || world.over) return;
  world.lives -= 1;
  world.inv = 1.35;
  world.combo = 0;
  world.shake = world.reduced ? 0 : 6;
  world.flash = world.reduced ? 0.08 : 0.35;
  world.hitstop = world.reduced ? 0 : 0.07;
  world.events.push('hurt');
  burst(world, world.player.x, world.player.y, '#fff4ea', 14, 50);
  if (world.lives <= 0) {
    world.lives = 0;
    world.over = 'dead';
    world.events.push('dead');
    world.banner = { text: world.labels.down || 'AUTSCH', t: 1.4 };
  }
}

function hurtBoss(world, dmg, core) {
  const boss = world.boss;
  if (!boss.alive || world.over) return;
  boss.hp -= dmg;
  boss.flash = 0.12;
  world.score += core ? 25 : 8;
  if (core) {
    world.combo += 1;
    world.comboT = 0.55;
    world.events.push('weak');
    burst(world, corePos(boss).x, corePos(boss).y, '#fff3b0', 8, 40);
    world.shake = Math.max(world.shake, world.reduced ? 0 : 1.4);
    if (world.combo === 6 || world.combo === 12) {
      world.score += 80;
      if (!world.banner || world.banner.t < 0.25) world.banner = { text: world.labels.core, t: 0.6 };
      floater(world, world.player.x, world.player.y - 16, world.labels.core);
    }
  } else {
    world.events.push('bossHit');
    burst(world, world.boss.x, world.boss.y + 10, '#ffd0ea', 4, 28);
  }
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    defeat(world);
  }
}

function defeat(world) {
  const words = world.labels.praise || ['STARK!'];
  const text = words[world.praiseI % words.length];
  world.praiseI += 1;
  world.score += 1200 + world.lives * 120;
  world.lives = Math.min(world.maxLives, world.lives + 1);
  world.banner = { text, t: 1.35 };
  world.over = 'down';
  world.shake = world.reduced ? 0 : 8;
  world.flash = world.reduced ? 0.1 : 0.5;
  world.hitstop = world.reduced ? 0 : 0.1;
  world.events.push('down');
  burst(world, world.boss.x, world.boss.y, '#fff', 28, 70);
}

function movePlayer(world, dt) {
  const p = world.player;
  if (world.mode === 'plat') {
    const speed = 96;
    let ax = 0;
    if (world.aim) ax = world.aim.x - p.x;
    else ax = (world.pad.x || 0) * 70 + (world.keys.x || 0) * 70;
    if (world.aim) p.vx = Math.abs(ax) < 1.5 ? 0 : Math.sign(ax) * speed;
    else if (world.pad.x || world.keys.x) p.vx = ((world.pad.x || 0) + (world.keys.x || 0)) * speed;
    else p.vx = 0;
    p.vx = clamp(p.vx, -speed, speed);
    const maxX = world.boss ? world.boss.x - world.boss.def.hw - 8 : world.w - 12;
    p.x = clamp(p.x + p.vx * dt, 8, maxX);
    p.facing = 1;
    const jump = world.wantJump > 0 || (world.pad.jump && !world.jumpHeld);
    if (jump && (p.onGround || p.coyote > 0)) {
      p.vy = -312;
      p.onGround = false;
      p.coyote = 0;
      world.wantJump = 0;
      world.events.push('jump');
    }
    world.jumpHeld = !!world.pad.jump;
    world.wantJump = Math.max(0, world.wantJump - dt);
    p.vy = Math.min(460, p.vy + 920 * dt);
    const prev = p.y;
    p.y += p.vy * dt;
    p.onGround = false;
    if (p.vy >= 0) {
      for (const pl of world.platforms) {
        const left = p.x - p.w / 2;
        const right = p.x + p.w / 2;
        if (right <= pl.x || left >= pl.x + pl.w) continue;
        if (prev <= pl.y + 0.5 && p.y >= pl.y && p.y <= pl.y + 12) {
          p.y = pl.y;
          p.vy = 0;
          p.onGround = true;
        }
      }
    }
    if (p.y > world.h + 30) {
      p.y = 80;
      p.vy = 0;
    }
    p.coyote = p.onGround ? 0.12 : Math.max(0, p.coyote - dt);
    return;
  }
  const top = playTop(world);
  const bot = world.h - 12;
  if (world.aim) {
    p.x = clamp(world.aim.x, 8, world.w - 8);
    p.y = clamp(world.aim.y - 30, top, bot);
  } else {
    const x = (world.pad.x || 0) + (world.keys.x || 0);
    const y = (world.pad.y || 0) + (world.keys.y || 0);
    if (x || y) {
      p.x = clamp(p.x + x * 175 * dt, 8, world.w - 8);
      p.y = clamp(p.y + y * 175 * dt, top, bot);
    }
  }
}

function tickCat(world, dt) {
  const p = world.player;
  const tx = world.mode === 'plat' ? p.x - 14 * (p.facing || 1) : p.x - 12;
  const ty = world.mode === 'plat' ? p.y - 1 : p.y + 7;
  const k = Math.min(1, dt * 9);
  world.cat.x += (tx - world.cat.x) * k;
  world.cat.y += (ty - world.cat.y) * k;
}

function fire(world, dt) {
  if (world.mode === 'dodge' || world.over) return;
  world.fireCd -= dt;
  if (world.fireCd > 0) return;
  world.fireCd = world.diff.fire;
  const p = world.player;
  if (world.mode === 'plat') {
    const dir = 1;
    world.bullets.push({
      x: p.x + dir * 8, y: p.y - 9, vx: dir * 175, vy: 0,
      r: 2, team: 'ally', dmg: 1, life: 1.6,
    });
  } else {
    world.bullets.push({
      x: p.x, y: p.y - 8, vx: 0, vy: -220,
      r: 2, team: 'ally', dmg: 1, life: 1.6,
    });
  }
  world.muzzle = 0.05;
  world.events.push('shot');
}

function spawnFoe(world, b) {
  if (world.bullets.length > 220) {
    const i = world.bullets.findIndex((x) => x.team === 'foe');
    if (i >= 0) world.bullets.splice(i, 1);
  }
  world.bullets.push({ life: 5, dmg: 1, team: 'foe', grazed: false, ...b });
}

function muzzle(world, ox = 0, oy = 10) {
  const b = world.boss;
  return { x: b.x + ox, y: b.y + oy };
}

function applyStep(step, world) {
  const boss = world.boss;
  const kind = step.kind;
  if (kind === 'wait') return;
  if (kind === 'laser') return applyLaser(step, world);
  if (kind === 'focus') return applyFocus(step, world);
  if (kind === 'bar') return applyBar(step, world);
  if (kind === 'cannon') return applyCannon(step, world);
  if (kind === 'ring') return applyRing(step, world);
  if (kind === 'home') return applyHome(step, world);
  if (kind === 'curtain') return applyCurtain(step, world);
  if (kind === 'drop') return applyDrop(step, world);
  if (kind === 'arc') return applyArc(step, world);
  if (kind === 'shock') return applyShock(step, world);
}

function eyeList(boss) {
  return boss.def.eyes || [{ ox: -22, oy: -24 }, { ox: 22, oy: -24 }];
}

function applyLaser(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.48;
  const live = boss.stepT >= warn;
  const span = Math.max(0.05, step.dur - warn);
  const u = live ? clamp((boss.stepT - warn) / span, 0, 1) : 0;
  const ang = step.from + (step.to - step.from) * u;
  const eyes = step.eyes || [0];
  const list = eyeList(boss);
  for (const ei of eyes) {
    const e = list[ei] || list[0];
    const x = boss.x + e.ox;
    const y = boss.y + e.oy;
    const len = step.len || 280;
    const x2 = x + Math.sin(ang) * len;
    const y2 = y + Math.cos(ang) * len;
    boss.beams.push({ type: 'beam', x, y, x2, y2, ang, width: step.width || 8, live });
  }
  if (live && !boss.laserOn) {
    boss.laserOn = true;
    world.events.push('laser');
  }
}

function applyFocus(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.5;
  const live = boss.stepT >= warn;
  const span = Math.max(0.05, step.dur - warn);
  const u = live ? clamp((boss.stepT - warn) / span, 0, 1) : 0;
  const x = step.fromX + (step.toX - step.fromX) * u;
  const y = step.atY || 292;
  const list = eyeList(boss).slice(0, step.eyes || 2);
  for (const e of list) {
    const x1 = boss.x + e.ox;
    const y1 = boss.y + e.oy;
    boss.beams.push({
      type: 'beam', x: x1, y: y1, x2: x, y2: y,
      width: step.width || 8, live,
    });
  }
  boss.beams.push({ type: 'mark', x: x - 3, y: y - 3, w: 6, h: 6, live });
  if (live && !boss.laserOn) {
    boss.laserOn = true;
    world.events.push('laser');
  }
}

function applyBar(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.48;
  const live = boss.stepT >= warn;
  const span = Math.max(0.05, step.dur - warn);
  const u = live ? clamp((boss.stepT - warn) / span, 0, 1) : 0;
  const y = step.fromY + (step.toY - step.fromY) * u;
  const h = step.height || 8;
  boss.beams.push({ type: 'bar', x: 0, y, w: world.w, h, live });
  if (live && !boss.laserOn) {
    boss.laserOn = true;
    world.events.push('laser');
  }
}

function aimPoint(world, step) {
  const p = world.player;
  const py = world.mode === 'plat' ? p.y - 8 : p.y;
  const spread = (step.spread || 0) * (world.rng() - 0.5);
  return { x: clamp(p.x + spread * 40, 10, world.w - 10), y: py };
}

function applyCannon(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.4;
  const every = step.every ?? 0.34;
  const shots = step.shots ?? 3;
  const i = boss.fired;
  if (i < shots) {
    const fireAt = warn + i * every;
    const tellAt = fireAt - Math.min(0.36, warn);
    if (boss.stepT >= tellAt && boss.stepT < fireAt) {
      if (!boss.lock) boss.lock = aimPoint(world, step);
      const m = muzzle(world, step.ox || 0, step.oy ?? 8);
      boss.beams.push({ type: 'line', x: m.x, y: m.y, x2: boss.lock.x, y2: boss.lock.y, live: false });
    }
    if (boss.stepT >= fireAt) {
      const aim = boss.lock || aimPoint(world, step);
      const m = muzzle(world, step.ox || 0, step.oy ?? 8);
      const dx = aim.x - m.x;
      const dy = aim.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = step.speed || 92;
      spawnFoe(world, {
        x: m.x, y: m.y, vx: (dx / dist) * sp, vy: (dy / dist) * sp,
        r: step.r || 3.4, life: 4,
      });
      boss.fired += 1;
      boss.lock = null;
      world.events.push('cannon');
    }
  }
}

function applyRing(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.4;
  if (boss.fired || boss.stepT < warn) {
    if (!boss.fired) {
      const p = world.player;
      const py = world.mode === 'plat' ? p.y - 8 : p.y;
      boss.beams.push({ type: 'ring', x: boss.x, y: boss.y + 8, live: false });
      boss.beams.push({
        type: 'line', x: boss.x, y: boss.y,
        x2: p.x, y2: py, live: false,
      });
    }
    return;
  }
  const p = world.player;
  const py = world.mode === 'plat' ? p.y - 8 : p.y;
  const aim = Math.atan2(p.x - boss.x, py - (boss.y + 6));
  const count = step.count || 12;
  const gap = (step.gap || 0.9) * (world.diff.gap > 1 ? 1.25 : world.diff.gap < 1 ? 0.85 : 1);
  const sp = step.speed || 58;
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI + (i + 0.5) * (Math.PI * 2 / count);
    if (Math.abs(wrapPi(ang - aim)) < gap / 2) continue;
    spawnFoe(world, {
      x: boss.x, y: boss.y + 6,
      vx: Math.sin(ang) * sp, vy: Math.cos(ang) * sp,
      r: step.r || 2.8, life: 5,
    });
  }
  boss.fired = 1;
  world.events.push('cannon');
}

function applyHome(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.35;
  const every = step.every ?? 0.45;
  const shots = step.shots ?? 2;
  const i = boss.fired;
  if (i >= shots) return;
  const fireAt = warn + i * every;
  if (boss.stepT < fireAt) {
    const m = muzzle(world, 0, 0);
    const p = world.player;
    boss.beams.push({ type: 'line', x: m.x, y: m.y, x2: p.x, y2: world.mode === 'plat' ? p.y - 8 : p.y, live: false });
    return;
  }
  const m = muzzle(world, 0, 4);
  const p = world.player;
  const py = world.mode === 'plat' ? p.y - 8 : p.y;
  const dx = p.x - m.x;
  const dy = py - m.y;
  const dist = Math.hypot(dx, dy) || 1;
  const sp = step.speed || 40;
  spawnFoe(world, {
    x: m.x, y: m.y, vx: (dx / dist) * sp, vy: (dy / dist) * sp,
    r: step.r || 3.2, life: 6, homing: true, turn: step.turn || 1.6,
  });
  boss.fired += 1;
  world.events.push('cannon');
}

function applyCurtain(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.4;
  const cols = step.cols || 8;
  const gapMul = world.diff.gap > 1 ? 1 : world.diff.gap < 1 ? 0 : 0;
  const gapW = Math.max(2, (step.gap || 2) + gapMul);
  const colW = world.w / cols;
  const drift = (step.drift || 0.55) / world.diff.gap;
  const shift = world.t * drift;
  const gapStart = Math.floor(shift) % cols;
  const top = boss.y + boss.def.hh * 0.55;
  for (let c = 0; c < cols; c++) {
    const dist = (c - gapStart + cols) % cols;
    if (dist < gapW) {
      boss.beams.push({ type: 'safe', x: c * colW, y: top, w: colW, h: world.h - top, live: false });
    }
  }
  if (boss.stepT < warn) return;
  const every = step.every || 0.42;
  const rows = Math.floor((boss.stepT - warn) / every) + 1;
  while (boss.fired < rows && boss.fired < 24) {
    const rowShift = Math.floor((world.t - (rows - 1 - boss.fired) * every) * drift);
    const gs = ((rowShift % cols) + cols) % cols;
    for (let c = 0; c < cols; c++) {
      const dist = (c - gs + cols) % cols;
      if (dist < gapW) continue;
      spawnFoe(world, {
        x: (c + 0.5) * colW, y: top, vx: 0, vy: step.speed || 62,
        r: step.r || 2.7, life: 5,
      });
    }
    boss.fired += 1;
  }
}

function applyDrop(step, world) {
  const boss = world.boss;
  const warnLead = 0.36;
  const every = step.every ?? 0.42;
  const shots = step.shots ?? 4;
  const i = boss.fired;
  if (i >= shots) return;
  const fireAt = (step.warn ?? 0.2) + warnLead + i * every;
  const tellAt = fireAt - warnLead;
  if (boss.stepT >= tellAt && boss.stepT < fireAt) {
    if (boss.lock == null) boss.lock = clamp(world.player.x, 14, world.w - 14);
    boss.beams.push({ type: 'danger', x: boss.lock - 5, y: 20, w: 10, h: world.h, live: false });
  }
  if (boss.stepT >= fireAt) {
    const x = boss.lock ?? world.player.x;
    spawnFoe(world, {
      x, y: boss.y + 10, vx: 0, vy: step.speed || 110,
      r: step.r || 3.6, life: 4,
    });
    boss.fired += 1;
    boss.lock = null;
    world.events.push('cannon');
  }
}

function applyArc(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.4;
  const every = step.every ?? 0.45;
  const shots = step.shots ?? 3;
  const i = boss.fired;
  if (i >= shots) return;
  const fireAt = warn + i * every;
  const m = { x: boss.x - boss.def.hw + 4, y: boss.y - 10 };
  if (boss.stepT < fireAt) {
    if (boss.stepT > fireAt - 0.35) {
      const p = world.player;
      boss.beams.push({ type: 'line', x: m.x, y: m.y, x2: p.x, y2: p.y - 8, live: false });
    }
    return;
  }
  const p = world.player;
  const dx = p.x - m.x;
  const dy = (p.y - 10) - m.y;
  const dist = Math.hypot(dx, dy) || 1;
  const sp = step.speed || 86;
  spawnFoe(world, {
    x: m.x, y: m.y,
    vx: (dx / dist) * sp,
    vy: (dy / dist) * sp - 46,
    grav: step.grav ?? 240,
    r: step.r || 3.4,
    life: 4,
  });
  boss.fired += 1;
  world.events.push('cannon');
}

function applyShock(step, world) {
  const boss = world.boss;
  const warn = step.warn ?? 0.5;
  const live = boss.stepT >= warn;
  const y = step.y ?? 300;
  const h = step.band || 16;
  boss.beams.push({ type: 'shock', x: 0, y: y - h, w: step.reach || 118, h, live });
  if (live && !boss.laserOn) {
    boss.laserOn = true;
    world.events.push('laser');
  }
}

function pattern(world, dt) {
  const boss = world.boss;
  boss.beams = [];
  if (!boss.alive) return;
  const ph = phaseIndex(world);
  if (ph !== boss.phase) {
    boss.phase = ph;
    boss.step = 0;
    boss.stepT = 0;
    boss.fired = 0;
    boss.lock = null;
    boss.laserOn = false;
    world.flash = Math.max(world.flash, 0.18);
    world.events.push('phase');
    if (!world.banner || world.banner.t < 0.3) {
      world.banner = { text: `${world.labels.phase} ${ph + 1}`, t: 0.7 };
    }
  }
  const steps = boss.def.phases[boss.phase].steps;
  const step = steps[boss.step % steps.length];
  boss.stepT += dt / pace(world);
  const closed = (boss.def.coreClosedDuring || []).includes(step.kind);
  const warn = step.warn ?? 0.4;
  boss.coreOpen = !(closed && boss.stepT >= warn);
  applyStep(step, world);
  if (boss.stepT >= step.dur) {
    boss.stepT = 0;
    boss.step += 1;
    boss.fired = 0;
    boss.lock = null;
    boss.laserOn = false;
  }
}

function moveBullets(world, dt) {
  const p = world.player;
  const py = world.mode === 'plat' ? p.y - 8 : p.y;
  for (const b of world.bullets) {
    if (b.homing && b.team === 'foe') {
      const want = Math.atan2(p.x - b.x, py - b.y);
      const ang = angOf(b.vx, b.vy);
      const turn = (b.turn || 1.5) * (world.diff.gap < 1 ? 1.15 : world.diff.gap > 1 ? 0.8 : 1);
      const na = ang + clamp(wrapPi(want - ang), -turn * dt, turn * dt);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(na) * sp;
      b.vy = Math.cos(na) * sp;
    }
    if (b.grav) b.vy += b.grav * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < world.w + 20 && b.y > -30 && b.y < world.h + 30);
}

function playerHurtR(world) {
  return world.mode === 'plat' ? 0 : world.player.r;
}

function hitsPlayerCircle(world, x, y, rad) {
  const p = world.player;
  if (world.mode === 'plat') {
    const cx = clamp(x, p.x - p.w / 2, p.x + p.w / 2);
    const cy = clamp(y, p.y - p.h, p.y);
    return Math.hypot(x - cx, y - cy) < rad;
  }
  return Math.hypot(p.x - x, p.y - y) < p.r + rad;
}

function collide(world) {
  const boss = world.boss;
  const p = world.player;
  if (world.inv > 0 || world.over || !boss?.alive) {
    // ally bullets still count during invuln
  }
  if (boss?.alive && !world.over) {
    for (const beam of boss.beams) {
      if (!beam.live) continue;
      let hit = false;
      let near = false;
      if (beam.type === 'beam') {
        const d = distPointSeg(p.x, world.mode === 'plat' ? p.y - 8 : p.y, beam.x, beam.y, beam.x2, beam.y2);
        const body = world.mode === 'plat' ? 6 : p.r;
        hit = d < beam.width * 0.5 + body * 0.72;
        near = !hit && d < beam.width * 0.5 + body + 7;
      } else if (beam.type === 'bar') {
        const py = world.mode === 'plat' ? p.y - p.h / 2 : p.y;
        const rad = world.mode === 'plat' ? p.h / 2 : p.r;
        hit = py + rad > beam.y && py - rad < beam.y + beam.h;
        near = !hit && py + rad + 8 > beam.y && py - rad - 8 < beam.y + beam.h;
      } else if (beam.type === 'shock') {
        if (world.mode === 'plat' && p.onGround && Math.abs(p.y - (beam.y + beam.h)) < 6 && p.x < beam.x + beam.w) hit = true;
      }
      if (hit && world.inv <= 0) hurtPlayer(world);
      else if (near && boss.grazeCd <= 0 && world.inv <= 0) {
        boss.grazeCd = 0.4;
        world.score += 8;
        world.events.push('graze');
        if (world.mode === 'dodge') boss.grazeF += 0.012;
        floater(world, p.x, (world.mode === 'plat' ? p.y - 16 : p.y) - 10, '+');
      }
    }
    for (const b of world.bullets) {
      if (b.team !== 'foe') continue;
      const pr = world.mode === 'plat' ? 0 : p.r;
      if (world.inv <= 0 && hitsPlayerCircle(world, b.x, b.y, b.r)) {
        b.life = 0;
        hurtPlayer(world);
      } else if (!b.grazed && world.inv <= 0) {
        const py = world.mode === 'plat' ? p.y - 8 : p.y;
        const px = p.x;
        const d = Math.hypot(px - b.x, py - b.y);
        const body = world.mode === 'plat' ? 8 : pr;
        if (d < b.r + body + 8) {
          b.grazed = true;
          world.score += 8;
          world.events.push('graze');
          if (world.mode === 'dodge') boss.grazeF += 0.01;
        }
      }
    }
  }
  if (boss?.alive && world.mode !== 'dodge') {
    const core = corePos(boss);
    for (const b of world.bullets) {
      if (b.team !== 'ally' || b.life <= 0) continue;
      const cd = Math.hypot(b.x - core.x, b.y - core.y);
      if (boss.coreOpen && cd < core.r + b.r) {
        b.life = 0;
        hurtBoss(world, b.dmg * boss.def.coreHurt, true);
        continue;
      }
      if (Math.abs(b.x - boss.x) < boss.def.hw && Math.abs(b.y - boss.y) < boss.def.hh) {
        b.life = 0;
        hurtBoss(world, b.dmg * boss.def.bodyHurt, false);
      }
    }
  }
}

function tickFatigue(world, dt) {
  const boss = world.boss;
  if (!boss?.alive || world.mode !== 'dodge') return;
  const time = boss.def.fatigueTime || 28;
  boss.timeF += dt * world.diff.fatigue / time;
  const graze = Math.min(boss.grazeF, boss.timeF * 0.4 + 0.02);
  boss.fatigue = Math.min(1, boss.timeF + graze);
  if (boss.fatigue >= 1) {
    boss.fatigue = 1;
    boss.alive = false;
    defeat(world);
  }
}

function tickJuice(world, dt) {
  world.shake = Math.max(0, world.shake - dt * 16);
  world.flash = Math.max(0, world.flash - dt * 1.8);
  world.muzzle = Math.max(0, world.muzzle - dt);
  world.inv = Math.max(0, world.inv - dt);
  world.comboT = Math.max(0, world.comboT - dt);
  if (world.comboT <= 0) world.combo = 0;
  if (world.boss) {
    world.boss.flash = Math.max(0, world.boss.flash - dt);
    world.boss.grazeCd = Math.max(0, world.boss.grazeCd - dt);
  }
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }
  for (const q of world.particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.life -= dt;
  }
  world.particles = world.particles.filter((q) => q.life > 0);
  for (const f of world.floaters) {
    f.y -= 16 * dt;
    f.life -= dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}

function advance(world, dt) {
  if (!(dt > 0)) return;
  if (world.hitstop > 0) {
    const u = Math.min(world.hitstop, dt);
    world.hitstop -= u;
    tickJuice(world, u);
    dt -= u;
    if (dt <= 0) return;
  }
  if (world.over === 'dead' || world.over === 'clear') {
    tickJuice(world, dt);
    return;
  }
  if (world.over === 'down') {
    tickJuice(world, dt);
    tickCat(world, dt);
    if (!world.banner) {
      if (world.bossIndex + 1 >= world.bosses.length) {
        world.over = 'clear';
        world.banner = { text: world.labels.win, t: 2 };
        world.events.push('clear');
        world.flash = Math.max(world.flash, 0.4);
      } else {
        const keep = world.score;
        const lives = world.lives;
        beginBoss(world, world.bossIndex + 1, false);
        world.score = keep;
        world.lives = lives;
        world.events.push('next');
      }
    }
    return;
  }
  world.t += dt;
  if (world.aim) world.coach = false;
  placeBoss(world);
  movePlayer(world, dt);
  tickCat(world, dt);
  if (world.intro > 0) {
    world.intro -= dt;
    world.boss.beams = [];
    world.boss.coreOpen = true;
  } else {
    pattern(world, dt);
  }
  fire(world, dt);
  moveBullets(world, dt);
  collide(world);
  tickFatigue(world, dt);
  if (!world.over) world.score += dt * (world.mode === 'dodge' ? 80 : 12);
  tickJuice(world, dt);
}

/** Ein Simulationsschritt. dt in Sekunden, intern in 60-Hz-Stückchen. */
export function step(world, dt) {
  const all = [];
  let left = dt;
  if (!(left > 0)) {
    world.events = [];
    return world;
  }
  while (left > 0.00001) {
    const s = Math.min(1 / 60, left);
    world.events = [];
    advance(world, s);
    all.push(...world.events);
    left -= s;
    if (world.over === 'dead' || world.over === 'clear') break;
  }
  world.events = all;
  return world;
}

export function validateBoss(def) {
  const errors = [];
  if (!def.id) errors.push('id fehlt');
  if (!def.name) errors.push('name fehlt');
  if (!(def.hp > 0)) errors.push('hp');
  if (!def.phases?.length) errors.push('phases');
  const kinds = new Set(['wait', 'laser', 'focus', 'bar', 'cannon', 'ring', 'home', 'curtain', 'drop', 'arc', 'shock']);
  def.phases?.forEach((ph, i) => {
    if (!ph.steps?.length) errors.push(`phase ${i} leer`);
    ph.steps?.forEach((s, j) => {
      if (!kinds.has(s.kind)) errors.push(`unbekannt ${s.kind} @${i}.${j}`);
      if (!(s.dur > 0.2)) errors.push(`dur ${i}.${j}`);
      if (s.warn != null && !(s.warn < s.dur)) errors.push(`warn ${i}.${j}`);
      if ((s.kind === 'laser' || s.kind === 'focus' || s.kind === 'cannon' || s.kind === 'drop') && !(s.warn >= 0.28)) {
        errors.push(`zu kurzes Vorzeichen ${s.kind} @${i}.${j}`);
      }
    });
  });
  return errors;
}
