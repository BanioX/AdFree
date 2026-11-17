// Pixelzeichnung für die Retro-Bosse. Buffer ist immer 180×320.

import { VW, VH } from './sim.js';

export const PALS = {
  magenta: {
    bg0: '#240818', bg1: '#c2186a', bg2: '#3a0a28',
    cloud: '#e85a9a', hot: '#ffe6f4', mid: '#ff4d93', deep: '#6a1848',
    ink: '#1a0610', eye: '#fff7fb', core: '#ffe38a', wing: '#ffd0ea',
  },
  cyan: {
    bg0: '#031820', bg1: '#0c7c96', bg2: '#042830',
    cloud: '#3ec8e0', hot: '#e6fbff', mid: '#27c4de', deep: '#0a4e60',
    ink: '#021216', eye: '#f4ffff', core: '#fff1a0', wing: '#c8f6ff',
  },
  purple: {
    bg0: '#140828', bg1: '#6a28b8', bg2: '#1c0838',
    cloud: '#b07cff', hot: '#f6e6ff', mid: '#a05cff', deep: '#4a1888',
    ink: '#10041c', eye: '#fff', core: '#ffe38a', wing: '#e0c8ff',
  },
  green: {
    bg0: '#04180e', bg1: '#128a48', bg2: '#042814',
    cloud: '#3ddea0', hot: '#e6fff2', mid: '#2ecf86', deep: '#0c5834',
    ink: '#02140c', eye: '#f4fff8', core: '#fff1a0', wing: '#c8ffe4',
  },
  teal: {
    bg0: '#02141c', bg1: '#0a5870', bg2: '#031820',
    cloud: '#2aa8c4', hot: '#e4f8ff', mid: '#1a9cb8', deep: '#084458',
    ink: '#021016', eye: '#f4ffff', core: '#fff1a0', wing: '#c8f0ff',
  },
};

const RAW = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};
const FONT = Object.fromEntries(Object.entries(RAW).map(([k, rows]) => [k, rows.join('')]));

function bits(ch) {
  const s = FONT[ch] || FONT[' '];
  return s.padEnd(35, '0').slice(0, 35);
}

export function text(ctx, str, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = x;
  const s = String(str).toUpperCase();
  for (const ch of s) {
    const g = bits(ch);
    for (let i = 0; i < 35; i++) {
      if (g[i] === '1') ctx.fillRect(cx + (i % 5) * scale, y + ((i / 5) | 0) * scale, scale, scale);
    }
    cx += 6 * scale;
  }
  return cx - x;
}

export function textWidth(str, scale = 1) {
  return String(str).length * 6 * scale;
}

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function palOf(name) { return PALS[name] || PALS.magenta; }

function eyes(ctx, x, y, gap, pal, t, look, n = 2) {
  const ox = (look?.x || 0);
  const oy = (look?.y || 0);
  const blink = Math.sin(t * 0.7) > 0.97;
  if (n === 1) {
    px(ctx, x - 8, y - 6, 16, 12, pal.ink);
    if (!blink) {
      px(ctx, x - 6, y - 4, 12, 8, pal.eye);
      px(ctx, x - 2 + ox, y - 2 + oy, 4, 4, pal.ink);
    }
    return;
  }
  if (n === 3) {
    eyes(ctx, x, y - 8, 0, pal, t, look, 1);
    eyes(ctx, x, y + 4, 12, pal, t, look, 2);
    return;
  }
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    px(ctx, ex - 5, y - 4, 10, 8, pal.ink);
    if (!blink) {
      px(ctx, ex - 4, y - 3, 8, 6, pal.eye);
      px(ctx, ex - 2 + ox * s * 0 + ox, y - 1 + oy, 3, 3, pal.ink);
    }
  }
}

function lookOf(boss, player) {
  if (!player) return { x: 0, y: 0 };
  const dx = player.x - boss.x;
  const dy = (player.y || boss.y) - boss.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: Math.round((dx / d) * 1.4), y: Math.round((dy / d) * 1.2) };
}

function coreGem(ctx, x, y, pal, open, t) {
  const c = open ? pal.core : pal.deep;
  px(ctx, x - 6, y - 6, 12, 12, pal.ink);
  px(ctx, x - 4, y - 4, 8, 8, c);
  if (open) {
    const g = (Math.sin(t * 6) > 0) ? pal.hot : pal.core;
    px(ctx, x - 2, y - 2, 4, 4, g);
  }
}

export function drawMech(ctx, boss, player, t) {
  const pal = palOf(boss.def.pal);
  const k = boss.def.kind;
  const x = boss.x | 0;
  const y = boss.y | 0;
  const look = lookOf(boss, player);
  const open = boss.coreOpen !== false;
  const flash = boss.flash > 0.04;
  const ink = flash ? pal.hot : pal.ink;
  const body = flash ? pal.hot : pal.deep;
  if (k === 'dock' || k === 'boeller') drawDock(ctx, x, y, pal, t, look, open, ink, body, k === 'boeller');
  else if (k === 'kiel') drawKiel(ctx, x, y, pal, t, look, open, ink, body);
  else if (k === 'krone' || k === 'wirbel') drawKrone(ctx, x, y, pal, t, look, open, ink, body, k === 'wirbel');
  else if (k === 'akte') drawAkte(ctx, x, y, pal, look, open, ink, body);
  else if (k === 'nimbus') drawNimbus(ctx, x, y, pal, t, look, open, ink, body);
  else if (k === 'leuchte') drawLeuchte(ctx, x, y, pal, t, look, open, ink, body);
  else if (k === 'lupe') drawGlut(ctx, x, y, pal, t, look, open, ink, body, true);
  else drawGlut(ctx, x, y, pal, t, look, open, ink, body, false);
  if (boss.def.core && open) {
    const phase = boss.phase || 0;
    const shift = (boss.def.coreByPhase && boss.def.coreByPhase[phase]) || {};
    const c = boss.def.core;
    coreGem(ctx, x + (shift.ox ?? c.ox), y + (shift.oy ?? c.oy), pal, true, t);
  }
}

function drawGlut(ctx, x, y, pal, t, look, open, ink, body, oneEye) {
  px(ctx, x - 28, y + 36, 16, 22, ink);
  px(ctx, x + 12, y + 36, 16, 22, ink);
  px(ctx, x - 32, y + 54, 22, 6, pal.mid);
  px(ctx, x + 10, y + 54, 22, 6, pal.mid);
  px(ctx, x - 46, y - 8, 92, 48, ink);
  px(ctx, x - 40, y - 2, 80, 36, body);
  px(ctx, x - 34, y + 6, 68, 22, pal.mid);
  px(ctx, x - 22, y + 14, 44, 12, pal.light || pal.hot);
  px(ctx, x - 40, y - 36, 80, 30, ink);
  px(ctx, x - 34, y - 30, 68, 18, body);
  px(ctx, x - 70, y - 42, 32, 26, ink);
  px(ctx, x + 38, y - 42, 32, 26, ink);
  px(ctx, x - 66, y - 36, 22, 12, pal.mid);
  px(ctx, x + 44, y - 36, 22, 12, pal.mid);
  px(ctx, x - 74, y - 6, 18, 12, ink);
  px(ctx, x + 56, y - 6, 18, 12, ink);
  px(ctx, x - 22, y - 64, 44, 32, ink);
  px(ctx, x - 16, y - 58, 32, 22, body);
  px(ctx, x - 2, y - 78, 4, 16, pal.mid);
  px(ctx, x - 5, y - 82, 10, 6, pal.hot);
  const bob = Math.sin(t * 3) * 1;
  px(ctx, x - 36, y + 28 + bob, 28, 6, pal.wing);
  if (oneEye) eyes(ctx, x, y - 48, 0, pal, t, look, 1);
  else eyes(ctx, x, y - 48, 10, pal, t, look, 2);
  if (!open) px(ctx, x - 5, y + 28, 10, 10, pal.deep);
}

function drawDock(ctx, x, y, pal, t, look, open, ink, body, twin) {
  px(ctx, x - 16, y + 28, 12, 30, ink);
  px(ctx, x + 6, y + 28, 12, 30, ink);
  px(ctx, x - 22, y - 20, 44, 52, ink);
  px(ctx, x - 16, y - 14, 32, 40, body);
  px(ctx, x - 10, y - 4, 20, 16, pal.mid);
  px(ctx, x - 48, y - 28, 28, 18, ink);
  px(ctx, x + 22, y - 28, 28, 18, ink);
  px(ctx, x - 62, y - 8, 28, 8, ink);
  px(ctx, x + 36, y - 8, twin ? 28 : 16, 8, ink);
  if (!twin) {
    const glow = Math.sin(t * 10) > 0 ? pal.hot : pal.core;
    px(ctx, x - 70, y - 6, 10, 4, glow);
  }
  px(ctx, x - 14, y - 52, 28, 24, ink);
  px(ctx, x - 10, y - 48, 20, 16, body);
  px(ctx, x - 16, y - 30, 32, 6, pal.hot);
  eyes(ctx, x, y - 40, 6, pal, t, look, 2);
  px(ctx, x + 18, y - 8, 8, 14, pal.mid);
}

function drawKiel(ctx, x, y, pal, t, look, open, ink, body) {
  px(ctx, x - 70, y + 8, 140, 28, ink);
  px(ctx, x - 60, y + 4, 120, 16, body);
  px(ctx, x - 78, y + 20, 16, 10, pal.mid);
  px(ctx, x + 62, y + 20, 16, 10, pal.mid);
  px(ctx, x - 18, y - 28, 36, 36, ink);
  px(ctx, x - 12, y - 22, 24, 24, body);
  px(ctx, x - 40, y - 10, 18, 12, ink);
  px(ctx, x + 22, y - 10, 18, 12, ink);
  px(ctx, x - 36, y - 22, 10, 10, pal.mid);
  px(ctx, x + 26, y - 22, 10, 10, pal.mid);
  eyes(ctx, x, y - 14, 7, pal, t, look, 2);
  const wag = Math.sin(t * 2) * 3;
  px(ctx, x - 4, y - 48 + wag, 8, 18, pal.mid);
  px(ctx, x - 6, y - 54 + wag, 12, 6, pal.hot);
}

function drawKrone(ctx, x, y, pal, t, look, open, ink, body, spiral) {
  px(ctx, x - 20, y + 30, 14, 26, ink);
  px(ctx, x + 8, y + 30, 14, 26, ink);
  px(ctx, x - 36, y - 16, 72, 48, ink);
  px(ctx, x - 30, y - 10, 60, 36, body);
  px(ctx, x - 58, y - 36, 36, 22, ink);
  px(ctx, x + 22, y - 36, 36, 22, ink);
  px(ctx, x - 16, y - 58, 32, 28, ink);
  px(ctx, x - 10, y - 52, 20, 18, body);
  for (const dx of [-18, -4, 10]) px(ctx, x + dx, y - 74, 8, 16, pal.mid);
  px(ctx, x - 16, y - 78, 8, 6, pal.hot);
  px(ctx, x + 8, y - 80, 8, 6, pal.hot);
  eyes(ctx, x, y - 44, 8, pal, t, look, spiral ? 3 : 2);
  if (spiral) {
    const a = t * 3;
    px(ctx, x + Math.sin(a) * 10 - 2, y - 86, 4, 4, pal.hot);
  }
}

function drawAkte(ctx, x, y, pal, look, open, ink, body) {
  px(ctx, x - 28, y - 36, 56, 108, ink);
  px(ctx, x - 22, y - 30, 44, 96, body);
  for (let i = 0; i < 4; i++) px(ctx, x - 18, y - 8 + i * 16, 36, 3, pal.mid);
  px(ctx, x - 22, y - 48, 44, 30, ink);
  px(ctx, x - 16, y - 42, 32, 18, body);
  px(ctx, x - 40, y - 10, 14, 28, ink);
  px(ctx, x + 26, y + 10, 16, 10, pal.mid);
  eyes(ctx, x, y - 34, 8, pal, 0, look, 2);
  px(ctx, x - 8, y + 40, 16, 10, ink);
}

function drawNimbus(ctx, x, y, pal, t, look, open, ink, body) {
  const puff = (dx, dy, w) => {
    px(ctx, x + dx, y + dy, w, w * 0.6, pal.cloud);
    px(ctx, x + dx + 4, y + dy - 4, w * 0.6, w * 0.4, pal.hot);
  };
  puff(-50, -30, 36);
  puff(16, -36, 40);
  puff(-20, -48, 28);
  px(ctx, x - 28, y - 16, 56, 78, ink);
  px(ctx, x - 22, y - 10, 44, 66, body);
  px(ctx, x - 14, y - 28, 28, 22, ink);
  eyes(ctx, x, y - 20, 7, pal, t, look, 2);
  px(ctx, x - 8, y + 36, 16, 16, ink);
}

function drawLeuchte(ctx, x, y, pal, t, look, open, ink, body) {
  px(ctx, x - 22, y - 16, 44, 96, ink);
  px(ctx, x - 16, y - 10, 32, 84, body);
  px(ctx, x - 10, y + 8, 20, 8, pal.mid);
  px(ctx, x - 18, y - 36, 36, 28, ink);
  px(ctx, x - 30, y - 48, 60, 16, pal.mid);
  const sweep = Math.sin(t * 1.4) * 10;
  px(ctx, x - 8 + sweep, y - 58, 16, 12, pal.hot);
  px(ctx, x - 4 + sweep, y - 54, 8, 6, pal.eye);
  px(ctx, x - 36, y + 4, 12, 16, ink);
  px(ctx, x + 24, y + 4, 12, 16, ink);
  eyes(ctx, x, y - 24, 6, pal, t, look, 2);
}

export function drawShip(ctx, p, t, inv, muzzle, pal) {
  if (inv > 0 && ((t * 18) | 0) % 2 === 0) return;
  const x = p.x | 0;
  const y = p.y | 0;
  px(ctx, x - 1, y - 7, 2, 4, pal.hot);
  px(ctx, x - 4, y - 3, 8, 6, pal.wing);
  px(ctx, x - 7, y + 1, 4, 3, pal.mid);
  px(ctx, x + 3, y + 1, 4, 3, pal.mid);
  px(ctx, x - 2, y - 1, 4, 4, pal.eye);
  if (muzzle > 0) px(ctx, x - 1, y - 11, 2, 3, pal.core);
  const flame = (t * 20) % 2 ? pal.core : pal.hot;
  px(ctx, x - 1, y + 4, 2, 3, flame);
}

export function drawHero(ctx, p, t, inv, pal) {
  if (inv > 0 && ((t * 18) | 0) % 2 === 0) return;
  const x = p.x | 0;
  const y = (p.y | 0);
  const dir = p.facing || 1;
  const step = Math.abs(p.vx) > 4 ? (((t * 10) | 0) % 2) : 0;
  px(ctx, x - 3, y - 14, 6, 5, pal.hot);
  px(ctx, x - 1 + dir, y - 13, 2, 2, pal.ink);
  px(ctx, x - 4, y - 9, 8, 6, pal.wing);
  px(ctx, x + dir * 3, y - 8, 3, 5, pal.mid);
  px(ctx, x - 3, y - 3, 2, 3 + step, pal.ink);
  px(ctx, x + 1, y - 3, 2, 4 - step, pal.ink);
}

export function drawCat(ctx, c, t, pal) {
  const x = c.x | 0;
  const y = (c.y | 0) + Math.round(Math.sin(t * 8) * 1);
  px(ctx, x - 3, y - 6, 7, 5, pal.hot);
  px(ctx, x - 3, y - 8, 2, 3, pal.hot);
  px(ctx, x + 2, y - 8, 2, 3, pal.hot);
  px(ctx, x - 2, y - 5, 1, 1, pal.ink);
  px(ctx, x + 2, y - 5, 1, 1, pal.ink);
  px(ctx, x + 4, y - 3, 3, 1, pal.mid);
}

function bands(ctx, pal) {
  for (let y = 0; y < VH; y += 4) {
    const u = y / VH;
    ctx.fillStyle = u < 0.08 ? pal.bg0 : u > 0.9 ? pal.bg2 : pal.bg1;
    ctx.fillRect(0, y, VW, 4);
  }
}

export function drawWorld(ctx, world) {
  const boss = world.boss;
  const pal = palOf(boss?.def.pal || 'magenta');
  bands(ctx, pal);
  ctx.fillStyle = pal.hot;
  for (const s of world.stars) {
    const x = ((s.x - world.t * s.sp * 0.15) % VW + VW) % VW;
    const y = ((s.y + world.t * 2) % VH + VH) % VH;
    if (Math.sin(world.t * 3 + s.tw) > -0.2) ctx.fillRect(x | 0, y | 0, s.s, s.s);
  }
  for (const c of world.clouds) {
    const x = ((c.x - world.t * c.sp * 0.2) % (VW + 40) + VW + 40) % (VW + 40) - 20;
    ctx.fillStyle = pal.cloud;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x | 0, c.y | 0, c.w, 6);
    ctx.fillRect((x + 6) | 0, (c.y - 4) | 0, c.w * 0.6, 5);
    ctx.globalAlpha = 1;
  }
  if (world.mode !== 'plat') {
    ctx.fillStyle = pal.bg0;
    ctx.beginPath();
    ctx.arc(VW - 16, VH - 4, 42, Math.PI, 0);
    ctx.fill();
  } else {
    for (const pl of world.platforms) {
      const h = Math.max(pl.h || 8, 8);
      px(ctx, pl.x, pl.y, pl.w, h, pal.ink);
      px(ctx, pl.x, pl.y, pl.w, 3, pal.hot);
    }
  }
  if (boss) {
    for (const b of boss.beams) paintBeam(ctx, b, pal);
    drawMech(ctx, boss, world.player, world.t);
  }
  for (const b of world.bullets) {
    const c = b.team === 'ally' ? pal.hot : pal.core;
    px(ctx, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, b.team === 'ally' ? pal.eye : pal.ink);
    px(ctx, b.x - b.r + 1, b.y - b.r + 1, Math.max(1, b.r * 2 - 2), Math.max(1, b.r * 2 - 2), c);
  }
  if (world.mode === 'plat') drawHero(ctx, world.player, world.t, world.inv, pal);
  else drawShip(ctx, world.player, world.t, world.inv, world.muzzle, pal);
  drawCat(ctx, world.cat, world.t, pal);
  for (const q of world.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    px(ctx, q.x, q.y, q.s, q.s, q.color);
    ctx.globalAlpha = 1;
  }
  for (let y = 0; y < VH; y += 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, y, VW, 1);
  }
  hud(ctx, world, pal);
  if (world.coach) {
    const y = (world.player.y + 16) | 0;
    text(ctx, world.labels.drag || 'ZIEH', (VW - textWidth(world.labels.drag || 'ZIEH', 1)) / 2, Math.min(VH - 16, y), pal.hot, 1);
  }
  if (world.banner && world.banner.t > 0) {
    const sc = 2;
    const w = textWidth(world.banner.text, sc);
    const a = Math.min(1, world.banner.t * 2);
    ctx.globalAlpha = a;
    px(ctx, (VW - w) / 2 - 4, 188, w + 8, 18, pal.ink);
    text(ctx, world.banner.text, (VW - w) / 2, 190, pal.hot, sc);
    ctx.globalAlpha = 1;
  }
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, world.flash)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 6, VH);
  ctx.fillRect(VW - 6, 0, 6, VH);
}

function paintBeam(ctx, b, pal) {
  if (b.type === 'beam') {
    const dx = b.x2 - b.x;
    const dy = b.y2 - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.ceil(len / 3);
    ctx.fillStyle = b.live ? pal.hot : pal.mid;
    ctx.globalAlpha = b.live ? 0.9 : 0.35;
    for (let i = 0; i < n; i++) {
      const x = b.x + (dx / len) * i * 3;
      const y = b.y + (dy / len) * i * 3;
      ctx.fillRect(x - b.width / 2, y - b.width / 2, b.width, b.width);
    }
    ctx.globalAlpha = 1;
  } else if (b.type === 'bar' || b.type === 'shock') {
    ctx.globalAlpha = b.live ? 0.9 : 0.28;
    ctx.fillStyle = b.live ? pal.hot : pal.core;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
  } else if (b.type === 'line') {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = pal.core;
    const dx = b.x2 - b.x;
    const dy = b.y2 - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.ceil(len / 4);
    for (let i = 0; i < n; i++) ctx.fillRect(b.x + (dx / len) * i * 4, b.y + (dy / len) * i * 4, 2, 2);
    ctx.globalAlpha = 1;
  } else if (b.type === 'safe') {
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = pal.eye;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
  } else if (b.type === 'danger') {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = pal.core;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
  } else if (b.type === 'mark') {
    ctx.fillStyle = pal.hot;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  } else if (b.type === 'ring') {
    ctx.strokeStyle = pal.hot;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(b.x - 8, b.y - 8, 16, 16);
    ctx.globalAlpha = 1;
  }
}

function hud(ctx, world, pal) {
  const boss = world.boss;
  const barW = 164;
  const x = 8;
  const y = 8;
  px(ctx, x, y, barW, 8, pal.ink);
  let frac = 1;
  let label = boss?.def.bar || boss?.def.name || '';
  if (boss) {
    if (world.mode === 'dodge') {
      frac = 1 - boss.fatigue;
      if (boss.fatigue > 0.82) label = world.labels.tired || label;
    } else frac = boss.hp / boss.maxHp;
  }
  px(ctx, x + 1, y + 1, Math.max(0, (barW - 2) * clamp01(frac)), 6, frac < 0.34 ? pal.core : pal.hot);
  text(ctx, label, x, y + 11, pal.hot, 1);
  const score = String(Math.floor(world.score)).padStart(7, '0').slice(-7);
  const sw = textWidth('SCORE ' + score, 1);
  text(ctx, 'SCORE ' + score, VW - 8 - sw, y + 11, pal.eye, 1);
  for (let i = 0; i < world.lives; i++) heart(ctx, 8 + i * 8, 30, pal.hot);
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    text(ctx, f.text, f.x, f.y, pal.hot, 1);
    ctx.globalAlpha = 1;
  }
}

function heart(ctx, x, y, c) {
  px(ctx, x, y, 2, 2, c);
  px(ctx, x + 3, y, 2, 2, c);
  px(ctx, x, y + 2, 5, 2, c);
  px(ctx, x + 1, y + 4, 3, 1, c);
  px(ctx, x + 2, y + 5, 1, 1, c);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function fitView(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const bw = Math.max(2, Math.round(r.width * dpr));
  const bh = Math.max(2, Math.round(r.height * dpr));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  const sc = Math.min(bw / VW, bh / VH);
  const isc = Math.floor(sc);
  const scale = isc >= 2 ? isc : sc;
  const ox = Math.floor((bw - VW * scale) / 2);
  const oy = Math.floor((bh - VH * scale) / 2);
  return { scale, ox, oy, bw, bh };
}

export function blit(canvas, buf, view, shake, reduced) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07060c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mag = reduced ? 0 : shake;
  const sx = (Math.random() - 0.5) * mag * view.scale;
  const sy = (Math.random() - 0.5) * mag * view.scale;
  ctx.drawImage(buf, view.ox + sx, view.oy + sy, VW * view.scale, VH * view.scale);
}

export function cssToWorld(canvas, view, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const px = ((clientX - r.left) / r.width) * canvas.width;
  const py = ((clientY - r.top) / r.height) * canvas.height;
  return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
}
