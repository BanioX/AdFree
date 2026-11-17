// Startbildschirm des Pfeilwürfels: grosser Spielen-Knopf, drehender Vorschau-Würfel, Levelauswahl.

import { sfx } from '../shared/sfx.js';
import { icon, h, toast, soundButton, backButton } from '../shared/ui.js';
import { generateLevel } from './generator.js';
import { makeCube } from './geometry.js';
import { CubeRenderer } from './render.js';
import { qMul, qAxisAngle, qNorm } from './math.js';
import { loadProgress, loadAnyCurrent, totalStars, solvedCount, ensureSummary } from './progress.js';

export function mountMenu(root, nav) {
  const prog = loadProgress();
  ensureSummary();
  const next = prog.unlocked;
  const cur = loadAnyCurrent();
  const resume = cur && cur.level === next && Array.isArray(cur.removed) && cur.removed.length > 0;
  const nextLevel = generateLevel(next);

  root.className = 'app cube-menu';
  root.innerHTML = '';

  const top = h('header.topbar', null,
    backButton('../'),
    h('div.title', null, 'Pfeilwürfel'),
    soundButton());

  // ---------- Hero ----------
  const heroCanvas = h('canvas.hero-cube', { 'aria-hidden': 'true' });
  const playBtn = h('button.btn.primary.block.play-btn', { type: 'button' });
  playBtn.innerHTML = icon('play', { size: 22 });
  playBtn.append(document.createTextNode(resume ? `Weiterspielen – Level ${next}` : `Spielen – Level ${next}`));
  playBtn.addEventListener('click', () => { sfx.play('click'); nav.play(next); });

  const solved = solvedCount(prog);
  const stars = totalStars(prog);
  const stats = solved === 0 ? h('div.hero-stats', null, 'Würfel drehen, freie Pfeile antippen') : h('div.hero-stats', null,
    h('span.stat', null, h('b', null, String(solved)), ' gelöst'),
    h('span.dot', null, '·'),
    h('span.stat.stars', { html: `${icon('star', { size: 16 })}<span><b>${stars}</b> ${stars === 1 ? 'Stern' : 'Sterne'}</span>` }));

  const hero = h('section.hero.card', null,
    h('div.hero-stage', null, heroCanvas,
      nextLevel.special ? h('span.hero-badge', { html: `${icon('sparkle', { size: 14 })}Spezial` }) : null),
    h('div.hero-text', null,
      h('p.hero-kicker', null, resume ? 'Angefangen' : solved === 0 ? 'Willkommen!' : 'Als Nächstes'),
      h('h1.hero-title', null, `Level ${next}`),
      stats),
    playBtn);

  // ---------- Levelraster ----------
  const maxShow = Math.ceil((next + 30) / 5) * 5;
  const grid = h('div.level-grid');
  for (let L = 1; L <= maxShow; L++) {
    const st = prog.stars[L] | 0;
    const locked = L > next;
    const current = L === next;
    const special = L % 10 === 0;
    const cls = ['level-tile'];
    if (locked) cls.push('locked');
    if (current) cls.push('current');
    if (st > 0) cls.push('done');
    if (special) cls.push('special');
    const tile = h('button', { class: cls.join(' '), type: 'button', 'aria-label': `Level ${L}${locked ? ' (gesperrt)' : ''}` });
    if (special) tile.append(h('span.tile-badge', { html: icon('sparkle', { size: 12 }) }));
    if (locked) {
      tile.append(h('span.num', null, String(L)), h('span.tile-lock', { html: icon('lock', { size: 13 }) }));
    } else {
      const row = h('span.tile-stars');
      for (let i = 0; i < 3; i++) row.append(h('span' + (i < st ? '.on' : ''), { html: icon('star', { size: 12 }) }));
      tile.append(h('span.num', null, String(L)), row);
    }
    tile.addEventListener('click', () => {
      if (locked) { sfx.play('tap'); toast(`Löse zuerst Level ${next}`); return; }
      sfx.play('click');
      nav.play(L);
    });
    grid.append(tile);
  }

  const main = h('main.menu', null,
    hero,
    h('div.sec-head', null, h('h2', null, 'Levelauswahl'),
      h('span.sec-meta', { html: `<span class="legend-badge">${icon('sparkle', { size: 11 })}</span>Spezial` })),
    grid,
    h('p.menu-foot', null, 'Dreh den Würfel, finde Pfeile mit freiem Weg und tippe sie an. Unendlich viele Level – ganz ohne Werbung.'));
  const scroll = h('div.scroll', null, main);
  root.append(top, scroll);

  // ---------- Drehender Vorschau-Würfel ----------
  const renderer = new CubeRenderer(heroCanvas, { mini: true });
  const geo = makeCube(nextLevel.N);
  renderer.setLevel(geo, nextLevel.arrows);
  const removed = new Uint8Array(nextLevel.arrows.length);
  if (cur && cur.level === next && Array.isArray(cur.removed)) {
    for (const id of cur.removed) if (id >= 0 && id < removed.length) removed[id] = 1;
  }
  let raf = 0;
  let destroyed = false;
  const t0 = performance.now();
  const tilt = qAxisAngle([1, 0, 0], 0.5);
  function frame(t) {
    raf = 0;
    if (destroyed) return;
    const a = -0.68 + (t - t0) * 0.00028;
    const q = qNorm(qMul(tilt, qAxisAngle([0, 1, 0], a)));
    renderer.draw({ q, zoom: 1, panX: 0, panY: 0 }, { removed, traces: true });
    if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
  }
  const resize = () => {
    const r = heroCanvas.getBoundingClientRect();
    renderer.resize(r.width, r.height, Math.min(3, window.devicePixelRatio || 1));
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(heroCanvas);
  resize();
  const onVis = () => { if (document.visibilityState === 'visible' && !raf && !destroyed) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
