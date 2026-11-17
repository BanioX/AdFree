// Startbildschirm, Schleife und Pause für die Retro-Bossspiele.

import { gameMenu } from '../../shared/gamemenu.js';
import { maybeShowTutorial, showTutorial, tutorialSeen } from '../../shared/tutorial.js';
import { store, reportSummary } from '../../shared/storage.js';
import { h, setupPage, soundButton, backButton, celebrate } from '../../shared/ui.js';
import { lang } from '../../shared/i18n.js';
import { createWorld, step } from './sim.js';
import { drawWorld, fitView, blit, cssToWorld, palOf, drawMech } from './draw.js';
import { bindStage, readPad } from './input.js';
import { react } from './audio.js';

export function bootRetro(cfg) {
  setupPage();
  const app = document.getElementById('app');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = Object.assign({ diff: 'normal', best: 0, clears: 0, bosses: 0, run: null }, store.get(cfg.id, {}));
  if (!state.diff) state.diff = 'normal';
  let diff = state.diff;
  let view = 'menu';
  let token = 0;
  let stopInput = () => {};
  let raf = 0;
  let artFrame = 0;
  document.title = cfg.t('docTitle');

  const labels = () => ({
    core: cfg.t('core'),
    win: cfg.t('win'),
    phase: cfg.t('phase'),
    down: cfg.t('down'),
    drag: cfg.t('drag'),
    tired: cfg.t('tired'),
    praise: [cfg.t('p1'), cfg.t('p2'), cfg.t('p3'), cfg.t('p4')],
  });

  function persist() {
    state.diff = diff;
    store.set(cfg.id, state);
    const best = Math.floor(state.best || 0);
    reportSummary(cfg.id, cfg.t('summary', { n: best }));
  }
  persist();

  function help(force) {
    const fn = force || tutorialSeen(cfg.id) ? showTutorial : maybeShowTutorial;
    return fn({ id: cfg.id, steps: cfg.steps(), accent: cfg.accent });
  }

  function showMenu() {
    token++;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(artFrame);
    stopInput();
    view = 'menu';
    const resume = state.run && state.run.diff === diff;
    const menu = gameMenu({
      id: cfg.id,
      title: cfg.t('title'),
      tagline: cfg.t('tagline'),
      accent: cfg.accent,
      art: makeArt(),
      primary: {
        label: resume ? cfg.t('resume') : cfg.t('play'),
        sub: resume ? cfg.t('resumeSub', { name: state.run.name, score: Math.floor(state.run.score) }) : cfg.t('diff_' + diff),
        onClick: () => openPlay(!resume),
      },
      modes: {
        label: cfg.t('difficulty'),
        value: diff,
        options: [
          { id: 'sanft', label: cfg.t('diff_sanft') },
          { id: 'normal', label: cfg.t('diff_normal') },
          { id: 'wild', label: cfg.t('diff_wild') },
        ],
        onChange: (id) => {
          diff = id;
          persist();
          showMenu();
        },
      },
      stats: [
        { label: cfg.t('statBest'), value: Math.floor(state.best) },
        { label: cfg.t('statBosses'), value: state.bosses },
        { label: cfg.t('statClears'), value: state.clears },
      ],
      sections: [h('p', { style: 'text-align:center;color:var(--text-2);margin:10px 0 0;font-size:14px' }, cfg.t('pad'))],
      onHelp: () => help(true),
    });
    app.replaceChildren(menu);
  }

  function makeArt() {
    const canvas = h('canvas', { width: '180', height: '110' });
    const ctx = canvas.getContext('2d');
    const def = cfg.bosses(lang)[0];
    const pal = palOf(def.pal);
    let t = 0;
    const frame = () => {
      t += 0.016;
      ctx.fillStyle = pal.bg1;
      ctx.fillRect(0, 0, 180, 110);
      const boss = { def, x: 90, y: 72, coreOpen: true, flash: 0, phase: 0, beams: [] };
      drawMech(ctx, boss, { x: 90, y: 180 }, t);
      artFrame = requestAnimationFrame(frame);
    };
    artFrame = requestAnimationFrame(frame);
    return canvas;
  }

  function openPlay(fresh) {
    if (location.hash !== '#play') history.pushState({ rx: cfg.id }, '', location.pathname + location.search + '#play');
    showPlay(fresh);
  }

  async function showPlay(fresh) {
    const my = ++token;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(artFrame);
    stopInput();
    view = 'play';
    if (!tutorialSeen(cfg.id)) await help(false);
    if (my !== token) return;
    const saved = !fresh && state.run && state.run.diff === diff ? state.run : null;
    if (fresh) state.run = null;
    const world = createWorld({
      mode: cfg.mode,
      diff,
      bosses: cfg.bosses(lang),
      bossIndex: saved ? saved.bossIndex : 0,
      score: saved ? saved.score : 0,
      lives: saved ? saved.lives : undefined,
      labels: labels(),
      coach: !store.get(cfg.id + '.coach', false),
      reduced,
      rng: Math.random,
    });
    const root = h('div.rx-play');
    const back = backButton('../', (e) => { e.preventDefault(); exit(); });
    const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': cfg.t('help') });
    helpBtn.innerHTML = '<span class="gm-q">?</span>';
    helpBtn.addEventListener('click', async () => {
      paused = true;
      await help(true);
      paused = false;
    });
    const title = h('div.title.center', null, cfg.t('title'));
    const top = h('div.topbar.rx-top', null, back, title, helpBtn, soundButton());
    const stage = h('div.rx-stage');
    const canvas = h('canvas');
    stage.append(canvas);
    const overlay = h('div.rx-overlay');
    overlay.hidden = true;
    stage.append(overlay);
    root.append(top, stage);
    app.replaceChildren(root);

    const buf = document.createElement('canvas');
    buf.width = 180;
    buf.height = 320;
    const bctx = buf.getContext('2d');
    let paused = false;
    let shown = null;
    let last = 0;
    let viewBox = fitView(canvas);

    const toWorld = (p) => cssToWorld(canvas, viewBox, p.x + canvas.getBoundingClientRect().left, p.y + canvas.getBoundingClientRect().top);

    stopInput = bindStage(stage, {
      down: (p) => { if (!world.over) { world.aim = toWorld(p); world.releaseAim = false; } },
      move: (p) => { if (!world.over) { world.aim = toWorld(p); world.releaseAim = false; } },
      up: (p, tap) => {
        if (world.over) return;
        world.aim = toWorld(p);
        world.releaseAim = true;
        if (tap && cfg.mode === 'plat') world.wantJump = 0.16;
        if (!store.get(cfg.id + '.coach')) store.set(cfg.id + '.coach', true);
      },
      cancel: () => { world.releaseAim = false; world.aim = null; },
      keys: (k) => { world.keys.x = k.x; world.keys.y = k.y; },
      jump: () => { world.wantJump = 0.16; },
      pause: () => { paused = !paused; },
    });

    window.__sp = {
      player: () => ({ x: world.player.x, y: world.player.y, lives: world.lives }),
      boss: () => world.boss && { hp: world.boss.hp, name: world.boss.def.name, fatigue: world.boss.fatigue },
      over: () => world.over,
      score: () => world.score,
      aim: () => world.aim,
    };

    const snapshot = () => {
      if (world.over === 'dead' || world.over === 'clear') {
        state.run = null;
      } else {
        state.run = {
          diff, bossIndex: world.bossIndex, score: world.score, lives: world.lives,
          name: world.boss?.def.name || '',
        };
      }
      state.best = Math.max(state.best || 0, world.score);
      persist();
    };

    function panel(kind) {
      overlay.hidden = false;
      overlay.replaceChildren(h('div.rx-panel', null,
        h('h2', null, kind === 'clear' ? cfg.t('clearTitle') : kind === 'pause' ? cfg.t('pause') : cfg.t('hitTitle')),
        h('p', null, cfg.t(kind === 'clear' ? 'clearText' : 'hitText', { n: Math.floor(world.score) })),
        h('button.btn.primary', { type: 'button', onclick: () => { overlay.hidden = true; shown = null; if (kind === 'pause') { paused = false; return; } openPlay(true); } }, cfg.t(kind === 'pause' ? 'goOn' : 'again')),
        h('button.btn', { type: 'button', onclick: () => exit() }, cfg.t('menu'))));
    }

    function frame(now) {
      if (token !== my) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      viewBox = fitView(canvas);
      const pad = readPad();
      if (pad) {
        world.pad.x = pad.x;
        world.pad.y = pad.y;
        world.pad.jump = pad.jump;
        if (pad.jumpEdge) world.wantJump = 0.16;
        if (pad.pauseEdge) paused = !paused;
      } else {
        world.pad.x = 0;
        world.pad.y = 0;
        world.pad.jump = false;
      }
      if (!paused && !document.hidden && shown !== 'pause') step(world, dt);
      if (world.releaseAim) { world.releaseAim = false; world.aim = null; }
      react(world.events);
      if (world.events.includes('down')) {
        state.bosses = (state.bosses || 0) + 1;
        snapshot();
      }
      if (world.over === 'clear' && shown !== 'clear') {
        shown = 'clear';
        state.clears = (state.clears || 0) + 1;
        state.run = null;
        state.best = Math.max(state.best || 0, world.score);
        persist();
        celebrate([cfg.accent, '#fff1a8', '#ffe6f4', '#fff']);
        panel('clear');
      } else if (world.over === 'dead' && shown !== 'dead') {
        shown = 'dead';
        state.run = null;
        state.best = Math.max(state.best || 0, world.score);
        persist();
        panel('dead');
      } else if (paused && shown !== 'pause' && !world.over) {
        shown = 'pause';
        panel('pause');
      }
      if (!paused && shown === 'pause') shown = null;
      drawWorld(bctx, world);
      blit(canvas, buf, viewBox, world.shake, reduced);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function exit() {
      snapshot();
      token++;
      cancelAnimationFrame(raf);
      stopInput();
      window.__sp = null;
      if (history.state && history.state.rx === cfg.id) history.back();
      else {
        history.replaceState(null, '', location.pathname + location.search);
        showMenu();
      }
    }
  }

  window.addEventListener('popstate', () => {
    if (location.hash === '#play') {
      if (view !== 'play') showPlay(false);
    } else if (view !== 'menu') showMenu();
  });

  if (location.hash === '#play') showPlay(false);
  else showMenu();
}
