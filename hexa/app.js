// Wabenstapel – Startbildschirm, Spielansicht, Speichern und Hash-Routing.
//   #            Menü
//   #level/12    Level 12
//   #endless     Endlos-Spiel
//   #daily       Tagesbrett

import { setupPage, h, celebrate, showModal, confirmDialog, sleep, ease } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../shared/storage.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { maybeShowTutorial, showTutorial } from '../shared/tutorial.js';
import { playScreen, canvasStage, showWin, showStatsSheet, coachRing, floatText, progressBar, praise, fmt, hashParts } from '../lib/sorting/kit.js';
import { tone } from '../lib/sorting/audio.js';
import { newGame, place, bestMove, geometry, refillTray, clone } from './core/hexa.js';
import { levelParams } from './data/levels.js';
import { COLORS, SQ3, KY, drawStack, drawPad, drawTile, tileThickness, layerGap } from './render.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'hexa';
const ACCENT = '#e6a817';
setupPage();
const app = document.getElementById('app');

// ---------- Speicher ----------

const S = {
  progress: () => Object.assign({ level: 1, stars: {} }, store.get('hexa.progress', {})),
  saveProgress: (p) => store.set('hexa.progress', p),
  stats: () => Object.assign({ won: 0, tiles: 0, best: 0, games: 0, daily: 0, combo: 0 }, store.get('hexa.stats', {})),
  saveStats: (s) => store.set('hexa.stats', s),
  settings: () => Object.assign({ mode: 'level' }, store.get('hexa.settings', {})),
  saveSettings: (s) => store.set('hexa.settings', Object.assign(S.settings(), s)),
  run: (slot) => store.get('hexa.run.' + slot, null),
  saveRun: (slot, r) => store.set('hexa.run.' + slot, r),
  clearRun: (slot) => store.remove('hexa.run.' + slot),
};

function summary() {
  const p = S.progress();
  const st = S.stats();
  reportSummary(ID, `Level ${p.level}${st.best ? ` · Rekord ${fmt(st.best)}` : ''}`);
}

const totalStars = (p) => Object.values(p.stars).reduce((a, b) => a + b, 0);
const starsFor = (helpers) => (helpers === 0 ? 3 : helpers <= 2 ? 2 : 1);
const openHelp = () => showTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT });

// ---------- Routing ----------

let current = null;
function go(hash) {
  if ((location.hash || '#') === '#' + hash) route();
  else location.hash = hash;
}

function route() {
  if (current && current.destroy) current.destroy();
  current = null;
  document.querySelectorAll('.sp-modal-backdrop').forEach((el) => el.remove());
  const [name, a] = hashParts();
  try {
    if (name === 'level') {
      const max = S.progress().level;
      const n = Math.max(1, Math.min(max, parseInt(a, 10) || max));
      S.saveSettings({ mode: 'level' });
      current = mountPlay('level', n);
    } else if (name === 'endless') {
      S.saveSettings({ mode: 'endless' });
      current = mountPlay('endless', null);
    } else if (name === 'daily') {
      current = mountPlay('daily', todayKey());
    } else {
      current = mountMenu();
    }
  } catch (err) {
    console.warn('Wabenstapel: Ansicht konnte nicht geöffnet werden', err);
    current = mountMenu();
  }
}

// ---------- Startbildschirm ----------

/** Kleine Live-Vorschau eines Spielstands (Canvas). */
function boardArt(g) {
  const W = 230, H = 160;
  const cv = h('canvas.hx-art', { width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px' } });
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  const geo = geometry(g.layout);
  const L = computeLayout(geo, W, H, 0);
  ctx.fillStyle = '#fff6e2';
  ctx.fillRect(0, 0, W, H);
  geo.cells.forEach((c, i) => drawPad(ctx, L.cells[i].x, L.cells[i].y, L.s, c.stone ? 'stone' : 'pad'));
  geo.cells.forEach((c, i) => { if (g.stacks[i] && g.stacks[i].length) drawStack(ctx, L.cells[i].x, L.cells[i].y, L.s, g.stacks[i], { label: false }); });
  return cv;
}

function mountMenu() {
  summary();
  app.className = 'app hx-app';
  const set = S.settings();
  const mode = set.mode === 'endless' ? 'endless' : 'level';
  const p = S.progress();
  const st = S.stats();
  const runL = S.run('level');
  const runE = S.run('endless');
  let primary, art = null, secondary = [], stats, sections = [];

  if (mode === 'level') {
    const n = p.level;
    const lp = levelParams(n);
    const saved = runL && runL.g && runL.g.arg === n && !runL.g.won ? runL.g : null;
    if (saved && saved.placed > 0) art = boardArt(saved);
    primary = saved && saved.placed > 0
      ? { label: 'Weiterspielen', sub: `Level ${n} · ${fmt(saved.cleared)} von ${fmt(saved.goal)} Plättchen`, onClick: () => go('level/' + n) }
      : { label: n === 1 ? 'Spielen' : `Level ${n} spielen`, sub: `${lp.name}${lp.special ? ' · Spezial' : ''} · ${fmt(lp.goal)} Plättchen räumen`, onClick: () => go('level/' + n) };
    stats = [
      { label: 'Level gelöst', value: fmt(p.level - 1) },
      { label: 'Sterne', value: fmt(totalStars(p)) },
      { label: 'Abgeräumt', value: fmt(st.tiles) },
    ];
    sections.push(menuSection('Level', levelGrid(p)));
  } else {
    const saved = runE && runE.g && !runE.g.over ? runE.g : null;
    if (saved && saved.placed > 0) art = boardArt(saved);
    primary = saved && saved.placed > 0
      ? { label: 'Weiterspielen', sub: `${fmt(saved.score)} Punkte${st.best ? ` · Rekord ${fmt(st.best)}` : ''}`, onClick: () => go('endless') }
      : { label: 'Endlos spielen', sub: st.best ? `Rekord ${fmt(st.best)} Punkte` : 'So lange, bis das Brett voll ist', onClick: () => { S.clearRun('endless'); go('endless'); } };
    if (saved && saved.placed > 0) {
      secondary.push({ label: 'Neues Spiel', icon: 'plus', onClick: async () => {
        if (!(await confirmDialog('Neues Spiel?', 'Das laufende Endlos-Spiel wird beendet.', 'Neues Spiel'))) return;
        S.clearRun('endless');
        go('endless');
      } });
    }
    stats = [
      { label: 'Rekord', value: fmt(st.best) },
      { label: 'Spiele', value: fmt(st.games) },
      { label: 'Abgeräumt', value: fmt(st.tiles) },
    ];
  }
  secondary.push({ label: 'Statistik', icon: 'star', onClick: showStats });

  const menu = gameMenu({
    id: ID, title: 'Wabenstapel', tagline: 'Sechseck-Stapel nach Farben sortieren', accent: ACCENT,
    art,
    primary,
    daily: {
      label: 'Tagesbrett', done: isDailyDone(ID), streak: dailyStreak(ID), sub: '100 Plättchen räumen',
      onClick: () => go('daily'),
    },
    modes: {
      label: 'Modus', value: mode,
      options: [{ id: 'level', label: 'Level', sub: `bis ${p.level}` }, { id: 'endless', label: 'Endlos', sub: st.best ? `Rekord ${fmt(st.best)}` : 'ohne Ziel' }],
      onChange: (id) => { S.saveSettings({ mode: id }); route(); },
    },
    secondary,
    stats,
    sections,
    onHelp: openHelp,
    backHref: '../',
  });
  app.replaceChildren(menu);
  return { destroy() {} };
}

function levelGrid(p) {
  const wrap = h('div');
  const grid = h('div.pk-levels');
  let shown = Math.max(20, Math.ceil((p.level + 5) / 10) * 10);
  const render = () => {
    grid.replaceChildren();
    for (let n = 1; n <= shown; n++) {
      const lock = n > p.level;
      const s = p.stars[n] || 0;
      const b = h('button.pk-lv' + (n === p.level ? '.cur' : '') + (lock ? '.lock' : '') + (n % 10 === 0 ? '.special' : ''),
        { type: 'button', 'aria-label': `Level ${n}` },
        h('span', null, String(n)), h('small', null, lock ? '' : '★'.repeat(s)));
      if (!lock) b.addEventListener('click', () => { sfx.play('tap'); go('level/' + n); });
      grid.append(b);
    }
  };
  render();
  const more = h('button.btn.pk-more', { type: 'button' }, 'Mehr zeigen');
  more.addEventListener('click', () => { shown += 20; render(); });
  wrap.append(grid, more);
  return wrap;
}

function showStats() {
  const st = S.stats();
  const p = S.progress();
  showStatsSheet('Statistik', [
    { label: 'Level gelöst', value: fmt(p.level - 1) },
    { label: 'Sterne gesammelt', value: fmt(totalStars(p)) },
    { label: 'Plättchen abgeräumt', value: fmt(st.tiles) },
    { label: 'Endlos-Rekord', value: fmt(st.best) + ' Punkte' },
    { label: 'Endlos-Spiele', value: fmt(st.games) },
    { label: 'Tagesbretter gelöst', value: fmt(st.daily) },
    { label: 'Längste Kombo', value: fmt(st.combo) },
  ]);
}

// ---------- Geometrie ----------

function computeLayout(geo, w, hh, trayH) {
  let minX = Infinity, maxX = -Infinity, maxR = 0;
  for (const c of geo.cells) {
    const x = c.c + 0.5 * (c.r & 1);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxR = Math.max(maxR, c.r);
  }
  const unitsW = maxX - minX + 1;
  const unitsH = maxR * 1.5 * KY + 2 * KY + 0.7; // + Platz für hohe Stapel
  const boardH = hh - trayH;
  const s = Math.min((w - 24) / (unitsW * SQ3), (boardH - 16) / unitsH, 46);
  const ox = w / 2 - ((minX + maxX) / 2) * SQ3 * s;
  const top = (boardH - unitsH * s) / 2 + s * (KY + 0.7);
  const cells = geo.cells.map((c) => ({ x: ox + (c.c + 0.5 * (c.r & 1)) * SQ3 * s, y: top + c.r * 1.5 * KY * s }));
  return { s, cells };
}

// ---------- Spielansicht ----------

function mountPlay(kind, arg) {
  const slot = kind;
  const saved = S.run(slot);
  let g, hist = [];
  if (saved && saved.g && saved.g.kind === kind && (kind === 'endless' || saved.g.arg === arg) && !saved.g.won) {
    g = saved.g; hist = saved.hist || [];
  } else {
    g = newGame(kind, kind === 'endless' ? 'hexa-e-' + Date.now() : arg);
  }
  const geo = geometry(g.layout);
  app.className = 'app hx-app';

  const title = kind === 'level' ? `Level ${arg}` : kind === 'daily' ? 'Tagesbrett' : 'Endlos';
  const sub = () => (kind === 'level' ? `${g.name}${g.special ? ' · Spezial' : ''}` : kind === 'daily'
    ? new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })
    : `Rekord ${fmt(Math.max(S.stats().best, g.score))}`);
  const ui = playScreen({
    accent: ACCENT, title, sub: sub(), cls: 'hx-play' + (g.special ? '.hx-special' : ''),
    onBack: () => go(''),
    onHelp: openHelp,
    tools: [
      { id: 'undo', icon: 'undo', label: 'Zurück', onClick: () => undo() },
      { id: 'hint', icon: 'hint', label: 'Tipp', onClick: () => hint() },
      { id: 'reroll', icon: 'shuffle', label: 'Neue Stapel', onClick: () => reroll() },
    ],
  });
  app.replaceChildren(ui.root);

  // HUD
  let prog = null, scoreChip = null;
  if (g.goal) {
    prog = progressBar('🍯');
    ui.hud.append(prog.el);
  } else {
    scoreChip = h('div.pk-chip', null, h('span', null, '0'), h('small', null, 'Punkte'));
    ui.hud.append(scoreChip);
  }
  function updateHud() {
    if (prog) prog.set(g.cleared, g.goal);
    if (scoreChip) scoreChip.firstChild.textContent = fmt(g.score);
    ui.subEl.textContent = sub();
    ui.setTool('undo', { disabled: !hist.length });
  }

  // Sichtbarer Zustand (wird während Animationen schrittweise nachgeführt)
  let vis = g.stacks.map((s) => (s ? s.slice() : s));
  let trayVis = [];
  const flights = [];
  const pops = [];
  const sparks = [];
  const flightsStack = []; // landende Stapel
  let L = null;
  let trayPos = [];
  let trayY = 0;
  let drag = null;
  let selected = null;
  let hintMove = null;
  let busy = false;
  let coach = null;
  let destroyed = false;

  const stage = canvasStage(ui.stage, {
    draw, resize: (w, hh) => relayout(w, hh),
    keepAlive: () => sparks.length > 0 || !!hintMove || selected != null || !!coach,
  });

  function relayout(w, hh) {
    const s0 = Math.min(46, (w - 24) / (5.5 * SQ3));
    const trayH = Math.max(120, s0 * 2.9 + 24);
    L = computeLayout(geo, w, hh, trayH);
    trayY = hh - trayH / 2 + L.s * 0.35;
    const dx = Math.min(w / 3.1, L.s * 3.1);
    trayPos = [0, 1, 2].map((i) => ({ x: w / 2 + (i - 1) * dx, y: trayY }));
    syncTray(false);
    if (coach) placeCoach();
  }

  function syncTray(animate) {
    trayVis = g.tray.map((st, i) => (st ? { st: st.slice(), x: trayPos[i].x, y: trayPos[i].y, a: 1 } : null));
    if (animate) {
      trayVis.forEach((t, i) => {
        if (!t) return;
        const x1 = t.x;
        t.x = x1 + 260; t.a = 0;
        stage.tweens.add({ delay: i * 70, dur: 380, ease: ease.outBack, update: (k) => { t.x = x1 + 260 * (1 - k); t.a = Math.min(1, k * 2); } });
      });
    }
  }

  // ---------- Zeichnen ----------

  function draw(ctx, now, w, hh) {
    if (!L) return;
    const s = L.s;
    // Ablage-Untergrund
    const trayTop = trayY - s * 1.9;
    ctx.fillStyle = 'rgba(230, 168, 23, .10)';
    roundRect(ctx, 12, trayTop, w - 24, hh - trayTop - 8, 22);
    ctx.fill();
    // Felder
    const target = drag && drag.target != null ? drag.target : null;
    geo.cells.forEach((c, i) => {
      const p = L.cells[i];
      let kind = c.stone ? 'stone' : 'pad';
      if (!c.stone && i === target) kind = 'target';
      else if (!c.stone && hintMove && hintMove.cell === i) kind = 'hint';
      else if (!c.stone && selected != null && vis[i] && !vis[i].length) kind = 'free';
      drawPad(ctx, p.x, p.y, s, kind === 'free' ? 'pad' : kind, now);
      if (kind === 'free') {
        ctx.fillStyle = `rgba(230, 168, 23, ${0.25 + 0.15 * Math.sin(now / 250)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    });
    // Stapel
    geo.cells.forEach((c, i) => {
      const st = vis[i];
      if (st && st.length) drawStack(ctx, L.cells[i].x, L.cells[i].y, s, st, { label: !busy || !flights.length });
    });
    // Klärende Plättchen
    for (const p of pops) drawTile(ctx, p.x, p.y, s * p.sc, tileThickness(s), p.col, { alpha: p.a });
    // Fliegende Plättchen
    for (const f of flights) {
      const t = f.t;
      const x = f.x0 + (f.x1() - f.x0) * t;
      const y = f.y0 + (f.y1() - f.y0) * t - Math.sin(Math.PI * t) * s * 1.1;
      drawTile(ctx, x, y, s * (1 + 0.12 * Math.sin(Math.PI * t)), tileThickness(s), f.col, { flip: Math.cos(Math.PI * 2 * t) });
    }
    // Ablage
    trayVis.forEach((t, i) => {
      if (!t || (drag && drag.ti === i)) return;
      const lift = selected === i ? s * 0.35 + Math.sin(now / 200) * 2 : 0;
      if (hintMove && hintMove.ti === i) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now / 220);
        ctx.fillStyle = '#ffd36b';
        ctx.beginPath(); ctx.ellipse(t.x, t.y + s * 0.2, s * 1.15, s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      drawStack(ctx, t.x, t.y, s, t.st, { lift, alpha: t.a });
    });
    for (const f of flightsStack) drawStack(ctx, f.x, f.y, s, f.st, { label: false });
    // Gezogener Stapel
    if (drag && drag.moved) {
      const t = trayVis[drag.ti];
      if (t) drawStack(ctx, drag.x, drag.y, s, t.st, { scale: 1.06 });
    }
    // Funken
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 1;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (hintMove && now > hintMove.until) { hintMove = null; }
  }

  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Eingabe ----------

  function trayHit(x, y) {
    if (!L) return -1;
    let best = -1, bd = Infinity;
    trayVis.forEach((t, i) => {
      if (!t) return;
      const d = Math.hypot(x - t.x, (y - (t.y - t.st.length * layerGap(L.s, t.st.length) / 2)) * 0.8);
      if (d < L.s * 1.5 && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function cellAt(x, y, maxD = 1.1) {
    let best = null, bd = Infinity;
    geo.cells.forEach((c, i) => {
      if (c.stone || !vis[i] || vis[i].length) return;
      const p = L.cells[i];
      const d = Math.hypot(x - p.x, (y - p.y) / KY);
      if (d < L.s * maxD && d < bd) { bd = d; best = i; }
    });
    return best;
  }

  const cv = stage.cv;
  cv.addEventListener('pointerdown', (e) => {
    if (busy || g.over || g.won) return;
    sfx.unlock && sfx.unlock();
    const p = stage.local(e);
    const ti = trayHit(p.x, p.y);
    if (ti >= 0) {
      drag = { ti, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false, target: null, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch { /* egal */ }
      return;
    }
    if (selected != null) {
      const cell = cellAt(p.x, p.y, 1.0);
      if (cell != null) doPlace(selected, cell, null);
      else { selected = null; stage.invalidate(); }
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = stage.local(e);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) { drag.moved = true; selected = null; }
    if (drag.moved) {
      drag.x = p.x;
      drag.y = p.y - L.s * 1.3;
      drag.target = cellAt(drag.x, drag.y, 1.25);
      stage.invalidate();
    }
  });
  const end = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    if (!d.moved) {
      drag = null;
      selected = selected === d.ti ? null : d.ti;
      stage.invalidate();
      return;
    }
    if (d.target != null && e.type === 'pointerup') {
      doPlace(d.ti, d.target, { x: d.x, y: d.y });
      drag = null;
    } else {
      // zurück in die Ablage
      const t = trayVis[d.ti];
      drag = null;
      if (t) {
        const x0 = d.x, y0 = d.y, x1 = trayPos[d.ti].x, y1 = trayPos[d.ti].y;
        t.x = x0; t.y = y0;
        stage.tweens.add({ dur: 220, ease: ease.outCubic, update: (k) => { t.x = x0 + (x1 - x0) * k; t.y = y0 + (y1 - y0) * k; } });
      }
      stage.invalidate();
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  // ---------- Züge ----------

  function save() {
    S.saveRun(slot, { g, hist });
  }

  function flipSound(k) {
    tone({ name: 'hx-flip', gap: 35, freq: 520 + Math.min(k, 12) * 45, dur: 0.07, type: 'triangle', gain: 0.06 });
  }

  function moveTiles(e) {
    const s = L.s;
    const proms = [];
    for (let k = 0; k < e.n; k++) {
      proms.push(new Promise((res) => {
        let f = null;
        stage.tweens.add({
          delay: k * 75, dur: 300, ease: ease.inOutCubic,
          update(t) {
            if (!f) {
              const from = vis[e.from];
              const col = from.pop();
              const p0 = L.cells[e.from];
              f = {
                col, t: 0,
                x0: p0.x, y0: p0.y - from.length * layerGap(s, from.length + 1),
                x1: () => L.cells[e.to].x,
                y1: () => L.cells[e.to].y - vis[e.to].length * layerGap(s, vis[e.to].length + 1),
              };
              flights.push(f);
              flipSound(k);
            }
            f.t = t;
          },
          done() {
            if (f) { flights.splice(flights.indexOf(f), 1); vis[e.to].push(f.col); }
            res();
          },
        });
      }));
    }
    return Promise.all(proms);
  }

  function clearRun(e) {
    const s = L.s;
    const st = vis[e.cell];
    const p = L.cells[e.cell];
    const gap = layerGap(s, st.length);
    const base = st.length - e.n;
    const removed = st.splice(base, e.n);
    const proms = [];
    removed.forEach((col, i) => {
      const pp = { x: p.x, y: p.y - (base + i) * gap, col, a: 1, sc: 1 };
      const y0 = pp.y;
      pops.push(pp);
      proms.push(stage.tweens.add({
        delay: (removed.length - 1 - i) * 28, dur: 300, ease: ease.outCubic,
        update: (k) => { pp.y = y0 - k * s * 0.9; pp.sc = 1 + k * 0.25; pp.a = 1 - k; },
        done: () => pops.splice(pops.indexOf(pp), 1),
      }));
    });
    const c = COLORS[e.color % COLORS.length];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3.5;
      sparks.push({ x: p.x, y: p.y - (base + e.n / 2) * gap, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5, r: 1.8 + Math.random() * 2.5, life: 30 + Math.random() * 20, c: i % 3 ? c.top : '#fff3c4' });
    }
    sfx.play('sparkle');
    floatText(ui.stage, p.x, p.y - (base + 3) * gap - s, '+' + e.n);
    return Promise.all(proms);
  }

  async function playEvents(events) {
    for (const e of events) {
      if (destroyed) return;
      if (e.t === 'move') await moveTiles(e);
      else await clearRun(e);
    }
  }

  async function doPlace(ti, cell, from) {
    if (busy || !g.tray[ti]) return;
    busy = true;
    selected = null;
    hintMove = null;
    if (coach) { coach.remove(); coach = null; }
    hist.push(clone(g));
    if (hist.length > 15) hist.shift();
    const placed = g.tray[ti].slice();
    const trayBefore = g.tray.filter(Boolean).length;
    const res = place(g, ti, cell);
    if (!res) { hist.pop(); busy = false; return; }
    const t = trayVis[ti];
    trayVis[ti] = null;
    // Stapel landet
    const p = L.cells[cell];
    const start = from || (t ? { x: t.x, y: t.y } : { x: p.x, y: p.y - 40 });
    const fl = { st: placed, x: start.x, y: start.y };
    flightsStack.push(fl);
    await stage.tweens.add({
      dur: 170, ease: ease.outCubic,
      update: (k) => { fl.x = start.x + (p.x - start.x) * k; fl.y = start.y + (p.y - start.y) * k; },
    });
    flightsStack.splice(flightsStack.indexOf(fl), 1);
    vis[cell] = placed.slice();
    sfx.play('place');
    await sleep(60);
    await playEvents(res.events);
    if (destroyed) return;
    vis = g.stacks.map((s) => (s ? s.slice() : s));
    if (res.clears >= 2 || g.combo >= 2) {
      floatText(ui.stage, stage.w / 2, L.cells[cell].y - L.s * 2, praise(Math.min(5, g.combo)), { cls: 'big' });
    }
    if (trayBefore === 1 && g.tray.every(Boolean)) syncTray(true);
    // Statistik
    const st = S.stats();
    st.tiles += res.gained;
    st.combo = Math.max(st.combo, g.bestCombo);
    if (kind === 'endless') st.best = Math.max(st.best, g.score);
    S.saveStats(st);
    save();
    updateHud();
    busy = false;
    stage.invalidate();
    if (g.won) onWin();
    else if (g.over) onOver();
  }

  function undo() {
    if (busy || !hist.length) return;
    const helpers = g.helpers + 1;
    g = hist.pop();
    g.helpers = helpers;
    g.over = false;
    vis = g.stacks.map((s) => (s ? s.slice() : s));
    syncTray(false);
    selected = null; hintMove = null;
    sfx.play('whoosh');
    save();
    updateHud();
    stage.invalidate();
  }

  function hint() {
    if (busy || g.over || g.won) return;
    const m = bestMove(g);
    if (!m) return;
    g.helpers++;
    hintMove = { ti: m.ti, cell: m.cell, until: performance.now() + 4500 };
    save();
    stage.invalidate();
  }

  function reroll() {
    if (busy || g.over || g.won) return;
    hist.push(clone(g));
    if (hist.length > 15) hist.shift();
    g.helpers++;
    refillTray(g);
    syncTray(true);
    selected = null; hintMove = null;
    sfx.play('whoosh');
    save();
    updateHud();
  }

  // ---------- Ende ----------

  async function onWin() {
    await sleep(450);
    if (destroyed) return;
    const stars = starsFor(g.helpers);
    const st = S.stats();
    if (kind === 'level') {
      const pr = S.progress();
      pr.stars[arg] = Math.max(pr.stars[arg] || 0, stars);
      pr.level = Math.max(pr.level, arg + 1);
      S.saveProgress(pr);
      st.won++;
    } else if (kind === 'daily') {
      if (!isDailyDone(ID)) st.daily++;
      markDailyDone(ID);
    }
    S.saveStats(st);
    S.clearRun(slot);
    summary();
    sfx.play('complete');
    celebrate(COLORS.map((c) => c.top));
    const buttons = kind === 'level'
      ? [{ label: `Weiter zu Level ${arg + 1}`, value: 'next', primary: true }, { label: 'Zum Menü', value: 'menu', ghost: true }]
      : [{ label: 'Zum Menü', value: 'menu', primary: true }];
    const v = await showWin({
      title: kind === 'daily' ? 'Tagesbrett geschafft!' : `Level ${arg} geschafft!`,
      stars,
      text: stars < 3 ? 'Ohne Hilfen gibt es drei Sterne.' : 'Ganz ohne Hilfen – wunderbar!',
      rows: [{ label: 'Plättchen', value: fmt(g.cleared) }, { label: 'Züge', value: fmt(g.placed) }, { label: 'Beste Kombo', value: fmt(g.bestCombo) }],
      buttons,
    });
    if (destroyed) return;
    if (v === 'next') go('level/' + (arg + 1));
    else go('');
  }

  async function onOver() {
    await sleep(450);
    if (destroyed) return;
    sfx.play('thud');
    let text;
    if (kind === 'endless') {
      const st = S.stats();
      if (!g.counted) { g.counted = true; st.games++; S.saveStats(st); save(); }
      text = g.score >= st.best && g.score > 0 ? `${fmt(g.score)} Punkte – neuer Rekord!` : `${fmt(g.score)} Punkte (Rekord ${fmt(st.best)}).`;
    } else {
      text = `Noch ${fmt(g.goal - g.cleared)} Plättchen bis zum Ziel. Nimm einfach den letzten Zug zurück!`;
    }
    const buttons = [];
    if (hist.length) buttons.push({ label: 'Letzten Zug zurücknehmen', value: 'undo', primary: true, icon: 'undo' });
    buttons.push({ label: kind === 'endless' ? 'Neues Spiel' : 'Nochmal', value: 'again', primary: !hist.length, icon: 'refresh' });
    buttons.push({ label: 'Zum Menü', value: 'menu', ghost: true });
    const v = await showModal({ title: 'Kein Platz mehr', text, buttons });
    if (destroyed) return;
    if (v === 'undo') undo();
    else if (v === 'again') { S.clearRun(slot); route(); }
    else go('');
  }

  // ---------- Coach-Mark (Level 1) ----------

  function placeCoach() {
    const m = bestMove(g);
    if (!m || !trayVis[m.ti]) return;
    const t = trayVis[m.ti];
    coach.move(t.x, t.y - L.s * 0.4, L.s * 2.4);
    hintMove = { ti: m.ti, cell: m.cell, until: Infinity };
  }
  if (kind === 'level' && arg === 1 && g.placed === 0) {
    coach = coachRing(ui.stage, 0, 0, 80, { label: 'Ziehen!' });
    placeCoach();
  }

  updateHud();
  save();
  if (g.won) onWin();
  else if (g.over) onOver();

  // Test-Haken
  window.__hexa = {
    get g() { return g; },
    bestMove: () => bestMove(g),
    tray: (i) => { const t = trayVis[i]; if (!t) return null; const r = cv.getBoundingClientRect(); return { x: r.left + t.x, y: r.top + t.y - L.s * 0.3 }; },
    cell: (i) => { const r = cv.getBoundingClientRect(); return { x: r.left + L.cells[i].x, y: r.top + L.cells[i].y }; },
    idle: async () => { while (busy || stage.tweens.active()) await sleep(30); },
  };

  return {
    destroy() {
      destroyed = true;
      stage.destroy();
    },
  };
}

// ---------- Start ----------

window.addEventListener('hashchange', route);
route();
maybeShowTutorial({ id: ID, steps: tutorialSteps(), accent: ACCENT });
