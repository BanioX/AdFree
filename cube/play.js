// Spiel-Ansicht eines Levels.

import { sfx } from '../shared/sfx.js';
import { icon, h, showModal, confirmDialog, celebrate, soundButton, ease } from '../shared/ui.js';
import { generateLevel, specialFor, themeFor } from './generator.js';
import { PRAISE, CHAPTER_SIZE } from './data/levels.js';
import { showHowto } from './howto.js';
import { makeCube } from './geometry.js';
import { Game } from './game.js';
import { CubeRenderer } from './render.js';
import { attachGestures } from './input.js';
import { qMul, qAxisAngle, qNorm, qSlerp, qToMat, clamp, smoothstep, add, scale } from './math.js';
import { loadCurrent, saveCurrent, clearCurrent, completeLevel, bumpStats, recordWin, loadSettings } from './progress.js';

import { Q_DEFAULT } from './view.js';
export { Q_DEFAULT };

/** Die 24 Drehlagen eines Würfels (als Quaternionen). */
const CUBE_ORIENTS = (() => {
  const gens = [qAxisAngle([1, 0, 0], Math.PI / 2), qAxisAngle([0, 1, 0], Math.PI / 2)];
  const key = (q) => Array.from(qToMat(q), (v) => Math.round(v)).join(',');
  const list = [[0, 0, 0, 1]];
  const seen = new Set([key(list[0])]);
  for (let i = 0; i < list.length; i++) {
    for (const g of gens) {
      const q = qNorm(qMul(g, list[i]));
      const k = key(q);
      if (!seen.has(k)) { seen.add(k); list.push(q); }
    }
  }
  return list;
})();
/** Schöne Blickwinkel: 3/4 von links, 3/4 von rechts, eher frontal. */
const NICE_TILTS = [
  Q_DEFAULT,
  qNorm(qMul(qAxisAngle([1, 0, 0], 0.5), qAxisAngle([0, 1, 0], 0.68))),
  qNorm(qMul(qAxisAngle([1, 0, 0], 0.3), qAxisAngle([0, 1, 0], -0.3))),
  qNorm(qMul(qAxisAngle([1, 0, 0], 0.3), qAxisAngle([0, 1, 0], 0.3))),
];

const PARTICLE_COLORS = ['#f29a1f', '#ffc766', '#fff1d6', '#d48a35', '#ffffff'];
const CONFETTI = ['#f29a1f', '#ffd23f', '#ff7a59', '#3f8ef0', '#34a86a', '#ee6fb7'];

const TAP_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7"/><path d="M12 1.8v2M12 20.2v2M1.8 12h2M20.2 12h2" opacity=".55"/></svg>';
const SWIPE_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12h17"/><path d="M7 8.5L3.5 12 7 15.5M17 8.5l3.5 3.5-3.5 3.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';

// Uhr für Animationen (für Tests verlangsambar)
let timeScale = 1;
let clockBase = 0;
let realBase = 0;
const clock = () => clockBase + (performance.now() - realBase) * timeScale;
function setTimeScale(k) {
  clockBase = clock();
  realBase = performance.now();
  timeScale = k;
}

export function mountPlay(root, levelNum, nav) {
  const level = generateLevel(levelNum);
  const sp = specialFor(levelNum);
  const theme = themeFor(levelNum);
  const relax = loadSettings().mode === 'relax';
  const geo = makeCube(level.N);
  const saved = loadCurrent(levelNum);
  let game = new Game(level, geo, saved);
  if (saved && game.hearts <= 0) game = new Game(level, geo);

  // ---------- DOM ----------
  root.className = 'app cube-play';
  root.innerHTML = '';
  const back = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zur Levelauswahl', html: icon('back') });
  const title = h('div.lvl-title', null,
    h('b', null, `Level ${levelNum}`),
    sp ? h('span.special', { html: `${icon('sparkle', { size: 13 })}${sp.title}` }) : h('span.chapter-name', null, `Kapitel ${theme.chapter} · ${theme.name}`));
  const heartsEl = h('div.hearts' + (relax ? '.relax' : ''), { 'aria-label': 'Herzen' });
  const helpBtn = h('button.icon-btn.help-btn', { type: 'button', 'aria-label': 'So geht’s', html: '<span class="gm-q">?</span>' });
  helpBtn.addEventListener('click', () => { sfx.play('click'); saveNow(); showHowto(); });
  const top = h('header.topbar', null, back, title, h('div.spacer'), heartsEl, helpBtn, soundButton());
  const canvas = h('canvas.cube-canvas', { 'aria-label': 'Würfel mit Pfeilen' });
  const pill = h('div.pill');
  const bubble = h('div.bubble.hidden');
  const stage = h('div.stage', null, canvas, pill, bubble);
  const mkTool = (cls, ic, label, onClick) => {
    const b = h(`button.tool.${cls}`, { type: 'button', 'aria-label': label },
      h('span.circle', { html: icon(ic) }), h('span.lbl', null, label));
    b.addEventListener('click', onClick);
    return b;
  };
  const tools = h('nav.tools', null,
    mkTool('view', 'rotate', 'Ansicht', () => resetView()),
    mkTool('hint', 'hint', 'Tipp', () => doHint()),
    mkTool('restart', 'refresh', 'Neustart', () => askRestart()));
  root.append(top, stage, tools);

  // ---------- Zustand ----------
  const renderer = new CubeRenderer(canvas);
  renderer.setLevel(geo, level.arrows);
  renderer.setTheme(theme);
  const view = { q: saved && Array.isArray(saved.q) && saved.q.length === 4 ? qNorm(saved.q) : Q_DEFAULT.slice(), zoom: 1, panX: 0, panY: 0, shakeX: 0 };
  let vel = [0, 0, 0];       // Winkelgeschwindigkeit (Kamera-Raum, rad/ms)
  let viewAnim = null;
  let anims = [];
  const hidden = new Set();  // Pfeile, die gerade animiert werden
  const busy = new Set();    // Pfeile, die gerade anstossen (nicht erneut antippbar)
  const highlights = new Map();
  let particles = [];
  let shake = null;
  let fade = null;
  let locked = false;
  let ended = false;
  let destroyed = false;
  let dragging = false;
  let lastMoveT = 0;
  let ignoreTap = false;
  let lastHint = -1;
  let rotatedAmount = 0;
  let tutorial = null;
  let tutTimer = 0;
  let bubbleTimer = 0;
  let saveTimer = 0;
  let lastMotion = -1e9;

  // ---------- Herzen & Anzeige ----------
  function renderHearts(lostIndex = -1) {
    heartsEl.innerHTML = '';
    if (relax) {
      heartsEl.append(h('span.relax-chip', { html: `${icon('heart', { size: 16, fill: true })}<span>Entspannt</span>` }));
      heartsEl.setAttribute('aria-label', 'Entspannt – ohne Herzen');
      return;
    }
    for (let i = 0; i < game.maxHearts; i++) {
      const full = i < game.hearts;
      const el = h('span.heart' + (full ? '.full' : ''), { html: icon('heart', { size: 22, fill: full }) });
      if (i === lostIndex) el.classList.add('lost');
      heartsEl.append(el);
    }
    heartsEl.setAttribute('aria-label', `${game.hearts} von ${game.maxHearts} Herzen`);
  }
  function updatePill(pop = false) {
    const r = game.remaining;
    pill.textContent = r === 0 ? 'Alle Pfeile draussen!' : r === 1 ? 'Noch 1 Pfeil' : `Noch ${r} Pfeile`;
    if (pop) { pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); }
  }
  renderHearts();
  updatePill();

  // ---------- Speichern ----------
  // Spielzeit (nur solange die Seite sichtbar ist)
  let activeSince = document.visibilityState === 'visible' ? performance.now() : 0;
  function flushTime() {
    if (activeSince) {
      const ms = Math.min(30 * 60000, performance.now() - activeSince);
      if (ms > 500) bumpStats({ playMs: ms });
    }
    activeSince = document.visibilityState === 'visible' && !destroyed ? performance.now() : 0;
  }
  function saveNow() {
    flushTime();
    if (ended) return;
    saveCurrent({ level: levelNum, ...game.serialize(), q: view.q.map((v) => +v.toFixed(5)) });
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }
  const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); else activeSince = performance.now(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', saveNow);

  // ---------- Render-Schleife (schläft, wenn nichts passiert) ----------
  let raf = 0;
  let lastT = 0;
  const kick = () => { if (!raf && !destroyed) raf = requestAnimationFrame(frame); };

  function frame(t) {
    raf = 0;
    if (destroyed) return;
    const dt = (lastT ? Math.min(48, t - lastT) : 16) * timeScale;
    lastT = t;
    const now = clock();
    let active = dragging;

    // Schwung nach dem Loslassen
    const sp = Math.hypot(vel[0], vel[1], vel[2]);
    if (!dragging && sp > 0.00002) {
      view.q = qNorm(qMul(qAxisAngle(vel, sp * dt), view.q));
      const damp = Math.exp(-dt / 330);
      vel = [vel[0] * damp, vel[1] * damp, vel[2] * damp];
      active = true;
      if (sp * damp <= 0.00002) { vel = [0, 0, 0]; saveSoon(); }
    }

    // Weiche Kamerafahrten (Tipp, Ansicht zurücksetzen, Intro)
    if (viewAnim) {
      const p = clamp((now - viewAnim.t0) / viewAnim.dur, 0, 1);
      const e = viewAnim.ease(p);
      view.q = qSlerp(viewAnim.q0, viewAnim.q1, e);
      view.zoom = viewAnim.z0 + (viewAnim.z1 - viewAnim.z0) * e;
      view.panX = viewAnim.px0 * (1 - e);
      view.panY = viewAnim.py0 * (1 - e);
      if (p >= 1) { viewAnim = null; saveSoon(); }
      active = true;
    }

    // Erschütterung beim Anstossen
    view.shakeX = 0;
    if (shake) {
      const age = now - shake.t0;
      if (age > 340) shake = null;
      else { view.shakeX = Math.sin(age * 0.075) * 5.5 * Math.exp(-age / 110); active = true; }
    }

    // Pfeil-Animationen
    const drawAnims = [];
    if (anims.length) {
      const keep = [];
      for (const an of anims) {
        const age = now - an.t0;
        if (an.kind === 'exit') {
          const p = clamp(age / an.dur, 0, 1);
          const e = (x) => 0.3 * x + 0.7 * x * x;
          const eh = e(p);
          const et = e(clamp((p - 0.1) / 0.9, 0, 1));
          const a = an.travel * et;
          const b = an.path.len + an.travel * eh;
          if (!an.emitted && b >= an.path.edgeArc) { an.emitted = true; puff(an); }
          const alpha = 1 - smoothstep(an.path.edgeArc - 0.6, an.path.edgeArc + 1.25, a);
          const pass = renderer.vis[an.path.headFace] ? 'front' : 'back';
          drawAnims.push({ id: an.id, a, b, alpha, color: 'blue', glow: Math.max(0, 1 - p * 1.6), pass });
          if (p < 1) keep.push(an); else hidden.delete(an.id);
        } else if (an.kind === 'bump') {
          let s;
          if (age < 0) {
            s = 0;
          } else if (age < an.tf) {
            const x = age / an.tf;
            s = an.reach * x * x;
          } else {
            if (!an.contact) { an.contact = true; onContact(an); }
            const q = clamp((age - an.tf) / an.tb, 0, 1);
            s = an.reach * Math.exp(-4.6 * q) * Math.cos(q * Math.PI * 1.7);
          }
          const done = age >= an.tf + an.tb;
          drawAnims.push({ id: an.id, a: s, b: an.path.len + s, alpha: 1, color: done ? 'ink' : 'blue', glow: age < an.tf + 120 ? 0.8 : 0, pass: 'front' });
          if (!done) keep.push(an);
          else { hidden.delete(an.id); busy.delete(an.id); if (an.after) an.after(); }
        }
      }
      anims = keep;
      active = true;
    }

    // Hervorhebungen
    const hl = new Map();
    for (const [id, st] of highlights) {
      const age = now - st.t0;
      if (age > st.dur || game.removed[id]) { highlights.delete(id); continue; }
      const p = age / st.dur;
      if (st.kind === 'hint') {
        const k = 0.5 + 0.5 * Math.sin(age * 0.0075);
        hl.set(id, { color: 'blue', k, mix: 1 - smoothstep(0.85, 1, p) });
      } else {
        hl.set(id, { color: 'red', k: 1 - p, mix: 1 - smoothstep(0.45, 1, p) });
      }
      active = true;
    }

    // Partikel
    if (particles.length) {
      const keep = [];
      for (const pt of particles) {
        pt.age = (now - pt.t0) / pt.life;
        if (pt.age >= 1) continue;
        const k = dt;
        pt.p = [pt.p[0] + pt.v[0] * k, pt.p[1] + pt.v[1] * k, pt.p[2] + pt.v[2] * k];
        const d = Math.exp(-dt / 260);
        pt.v = [pt.v[0] * d, pt.v[1] * d, pt.v[2] * d];
        keep.push(pt);
      }
      particles = keep;
      active = true;
    }

    // Während sich die Ansicht bewegt, sparen wir uns den feinen Tintenschatten (Bildrate);
    // danach blendet er weich wieder ein.
    const moving = dragging || !!viewAnim || Math.hypot(vel[0], vel[1], vel[2]) > 0.00002;
    if (moving) lastMotion = now;
    const shadowK = moving ? 0 : clamp((now - lastMotion) / 220, 0, 1);
    if (shadowK < 1) active = true;

    let fadeK = 1;
    if (fade) {
      fadeK = clamp((now - fade.t0) / fade.dur, 0, 1);
      if (fadeK >= 1) fade = null; else active = true;
    }

    renderer.draw(view, {
      removed: game.removed,
      hidden,
      anims: drawAnims,
      highlights: hl,
      particles,
      fade: fadeK,
      shadowK,
    });

    if (active) kick(); else lastT = 0;
  }

  function puff(an) {
    const { edge, D, n } = an.path;
    const now = clock();
    for (let i = 0; i < 12; i++) {
      const spread = [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];
      const v = add(add(scale(D, 0.0016 + Math.random() * 0.0022), scale(spread, 0.0026)), scale(n, 0.0006 + Math.random() * 0.001));
      particles.push({
        p: add(edge, scale(spread, 0.04)), v, t0: now, age: 0,
        life: 360 + Math.random() * 260,
        size: 0.05 + Math.random() * 0.07,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      });
    }
  }

  // ---------- Grösse ----------
  const ro = new ResizeObserver(() => resize());
  function resize() {
    const r = stage.getBoundingClientRect();
    // Deckel 2.5: auf 3x-Displays nicht sichtbar, spart aber ~30 % Pixel
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    renderer.resize(r.width, r.height, dpr);
    lastT = 0;
    kick();
  }
  ro.observe(stage);
  resize();

  // ---------- Ansicht ----------
  function clampPan() {
    const maxPan = Math.max(0, view.zoom - 1) * renderer.baseScale * 1.7;
    view.panX = clamp(view.panX, -maxPan, maxPan);
    view.panY = clamp(view.panY, -maxPan, maxPan);
  }
  function animateView(q1, z1, dur, easing = ease.inOutCubic) {
    viewAnim = { q0: view.q, q1, z0: view.zoom, z1, px0: view.panX, py0: view.panY, t0: clock(), dur, ease: easing };
    vel = [0, 0, 0];
    kick();
  }
  function resetView() {
    sfx.play('click');
    animateView(Q_DEFAULT, 1, 650);
  }

  function zoomAt(factor, mx, my, dmx = 0, dmy = 0) {
    const z0 = view.zoom;
    const z1 = clamp(z0 * factor, 0.75, 2.8);
    const cx = renderer.cx - view.shakeX, cy = renderer.cy;
    view.panX += (mx - cx) * (1 - z1 / z0) + dmx;
    view.panY += (my - cy) * (1 - z1 / z0) + dmy;
    view.zoom = z1;
    clampPan();
    viewAnim = null;
    kick();
  }

  // ---------- Gesten ----------
  const gestures = attachGestures(canvas, {
    onDown() {
      // Ein schnell drehender Würfel wird durch Antippen nur angehalten
      const sp = Math.hypot(vel[0], vel[1], vel[2]);
      ignoreTap = sp > 0.0012;
      vel = [0, 0, 0];
    },
    onTap(x, y) {
      if (ignoreTap) { ignoreTap = false; return; }
      tapAt(x, y);
    },
    onRotateStart() { dragging = true; viewAnim = null; lastMoveT = performance.now(); kick(); },
    onRotate(dx, dy, t) {
      const S = renderer.S || 100;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0) return;
      const ang = dist / (S * 1.5);
      const axis = [dy / dist, dx / dist, 0];
      view.q = qNorm(qMul(qAxisAngle(axis, ang), view.q));
      const dtm = Math.max(4, t - lastMoveT);
      lastMoveT = t;
      const w = Math.min(0.012, ang / dtm);
      vel = [vel[0] * 0.35 + axis[0] * w * 0.65, vel[1] * 0.35 + axis[1] * w * 0.65, 0];
      rotatedAmount += ang;
      if (tutorial === 'swipe' && rotatedAmount > 0.9) hideBubble(true);
      kick();
    },
    onRotateEnd(withInertia) {
      dragging = false;
      if (!withInertia || performance.now() - lastMoveT > 70) vel = [0, 0, 0];
      saveSoon();
      kick();
    },
    onPinchStart() { dragging = false; vel = [0, 0, 0]; viewAnim = null; },
    onPinch(f, mx, my, dmx, dmy) { zoomAt(f, mx, my, dmx, dmy); },
    onPinchEnd() { saveSoon(); },
    onWheel(f, x, y) { zoomAt(f, x, y); },
  });

  // ---------- Spiel-Logik ----------
  const skip = (i) => game.removed[i] || busy.has(i);

  function tapAt(x, y) {
    if (locked) return;
    const id = renderer.hitTest(x, y, skip);
    if (id < 0) return;
    tapArrow(id);
  }

  function tapArrow(id) {
    if (locked || game.removed[id] || busy.has(id)) return false;
    highlights.delete(id);
    const res = game.check(id);
    if (res.free) {
      game.remove(id);
      const path = renderer.exitPath(id);
      const travel = path.edgeArc + 1.3;
      const dur = clamp(300 + travel * 26, 360, 640);
      anims.push({ kind: 'exit', id, t0: clock(), dur, travel, path, emitted: false });
      hidden.add(id);
      sfx.play('whoosh');
      bumpStats({ arrows: 1 });
      updatePill(true);
      if (tutorial === 'tap') { hideBubble(true); if (levelNum === 1) setTimeout(() => { if (!destroyed && !ended && rotatedAmount < 0.9) showBubble('swipe'); }, 900); }
      clearTimeout(tutTimer);
      if (game.won) onWin();
      else saveNow();
      kick();
      return true;
    }
    // Blockiert: vorrutschen bis zum Hindernis, anstossen, zurückfedern
    const path = renderer.exitPath(id);
    const reach = Math.max(0.18, res.dist + 1 - 0.68);
    const tf = Math.min(330, 110 + reach * 30);
    busy.add(id);
    hidden.add(id);
    // Liegt die Spitze (und damit das Hindernis) auf einer abgewandten Seite? Erst hindrehen.
    let delay = 0;
    if (renderer.facing[path.headFace] < 0.3) {
      rotateToArrow(id, 460);
      delay = 400;
    }
    anims.push({ kind: 'bump', id, blocker: res.blocker, t0: clock() + delay, tf, tb: 430, reach, path, contact: false });
    sfx.play('tap');
    kick();
    return false;
  }

  function onContact(an) {
    sfx.play('thud');
    highlights.set(an.blocker, { kind: 'flash', t0: clock(), dur: 950 });
    shake = { t0: clock() };
    try { navigator.vibrate?.(30); } catch { /* ignore */ }
    if (ended || locked) return;
    bumpStats({ mistakes: 1 });
    if (relax) { game.mistakes++; saveNow(); return; }
    const before = game.hearts;
    const left = game.loseHeart();
    renderHearts(before - 1);
    heartsEl.classList.remove('sp-shake'); void heartsEl.offsetWidth; heartsEl.classList.add('sp-shake');
    if (left <= 0) {
      locked = true;
      ended = true; // nichts mehr speichern – «Nochmal» startet frisch
      clearCurrent();
      an.after = () => setTimeout(showLose, 250);
    } else {
      saveNow();
    }
  }

  async function showLose() {
    if (destroyed) return;
    sfx.play('error');
    const v = await showModal({
      title: 'Keine Herzen mehr',
      html: '<p>Kein Problem – die Pfeile warten auf dich.<br>Probier es gleich nochmal!</p>',
      buttons: [
        { label: 'Nochmal', value: 'retry', primary: true, icon: 'refresh' },
        { label: 'Levelauswahl', value: 'menu', ghost: true },
      ],
      dismissible: false,
    });
    if (destroyed) return;
    if (v === 'menu') nav.menu();
    else restart();
  }

  function onWin() {
    locked = true;
    ended = true;
    if (tutorial) hideBubble(true);
    const stars = game.stars();
    flushTime();
    const res = completeLevel(levelNum, stars);
    recordWin(stars);
    setTimeout(() => showWin(stars, res), 720);
  }

  async function showWin(stars, res) {
    if (destroyed) return;
    sfx.play('complete');
    celebrate(CONFETTI);
    const pool = PRAISE[stars] || PRAISE[1];
    const msg = pool[(levelNum * 7 + game.mistakes) % pool.length];
    const nsp = specialFor(levelNum + 1);
    const newChapter = levelNum % CHAPTER_SIZE === 0;
    const nth = themeFor(levelNum + 1);
    const teaser = nsp ? `Als Nächstes: Spezial «${nsp.title}» ${nsp.emoji || ''}`.trim()
      : newChapter ? `Neues Kapitel: ${nth.name}` : null;
    const starRow = h('div.win-stars');
    for (let i = 0; i < 3; i++) {
      const st = h('span.win-star' + (i < stars ? '.on' : ''), { html: icon('star', { size: 56 }), style: { '--i': i } });
      starRow.append(st);
    }
    const content = h('div.win', null,
      starRow,
      h('p.win-msg', null, msg),
      res.best > stars ? h('p.win-best', null, `Bestleistung: ${res.best} ${res.best === 1 ? 'Stern' : 'Sterne'}`) : null,
      teaser ? h('p.win-next', null, teaser) : null);
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.play(i === 2 ? 'sparkle' : 'pop'), 380 + i * 200);
    const v = await showModal({
      title: `Level ${levelNum} gelöst!`,
      content,
      buttons: [
        { label: 'Weiter', value: 'next', primary: true, icon: 'play' },
        { label: 'Levelauswahl', value: 'menu', ghost: true },
      ],
      dismissible: false,
    });
    if (destroyed) return;
    if (v === 'menu') nav.menu();
    else nav.play(levelNum + 1);
  }

  async function askRestart() {
    sfx.play('click');
    if (locked) return;
    if (game.removedCount > 0) {
      const ok = await confirmDialog('Level neu starten?', 'Alle Pfeile kommen zurück an ihren Platz.', 'Neu starten', 'Abbrechen');
      if (!ok || destroyed) return;
    }
    restart();
  }

  function restart() {
    game = new Game(level, geo);
    anims = [];
    hidden.clear();
    busy.clear();
    highlights.clear();
    particles = [];
    locked = false;
    ended = false;
    lastHint = -1;
    renderHearts();
    updatePill();
    intro(true);
    saveNow();
  }

  // ---------- Tipp ----------
  function doHint() {
    if (locked) return;
    const free = game.freeIds().filter((i) => !busy.has(i));
    if (!free.length) return;
    const scored = free.map((i) => ({ i, v: renderer.visibility(i) })).sort((a, b) => b.v - a.v || a.i - b.i);
    let pick = scored[0];
    if (lastHint >= 0 && highlights.has(lastHint)) {
      const k = scored.findIndex((s) => s.i === lastHint);
      if (k >= 0) pick = scored[(k + 1) % scored.length];
    }
    for (const id of [...highlights.keys()]) if (highlights.get(id).kind === 'hint') highlights.delete(id);
    lastHint = pick.i;
    bumpStats({ hints: 1 });
    highlights.set(pick.i, { kind: 'hint', t0: clock(), dur: 5200 });
    sfx.play('sparkle');
    if (pick.v < 0.62 || !renderer.tapPointFor(pick.i, skip)) rotateToArrow(pick.i);
    kick();
  }

  /** Dreht den Würfel weich so, dass Pfeil id gut sichtbar ist. */
  function rotateToArrow(id, dur = 700) {
    const target = targetFor(id);
    animateView(target, Math.min(view.zoom, 1.3), dur);
  }

  /** Wählt eine aufrechte, schöne Ansicht, in der Pfeil id gut sichtbar ist (nahe der aktuellen). */
  function targetFor(id) {
    const a = level.arrows[id];
    const head = a.cells[a.cells.length - 1];
    const hn = geo.faces[geo.faceOf(head)].n;
    const normals = a.cells.map((c) => geo.faces[geo.faceOf(c)].n);
    let best = null, bestScore = -Infinity;
    for (const tilt of NICE_TILTS) {
      for (const o of CUBE_ORIENTS) {
        const q = qNorm(qMul(tilt, o));
        const M = qToMat(q);
        const z = (n) => M[6] * n[0] + M[7] * n[1] + M[8] * n[2];
        const hz = z(hn);
        if (hz < 0.3) continue;
        let body = 0;
        for (const n of normals) body += Math.max(0, z(n));
        body /= normals.length;
        const d = Math.abs(q[0] * view.q[0] + q[1] * view.q[1] + q[2] * view.q[2] + q[3] * view.q[3]);
        const ang = 2 * Math.acos(Math.min(1, d));
        const score = hz * 1.3 + body * 0.7 - ang * 0.22;
        if (score > bestScore) { bestScore = score; best = q; }
      }
    }
    return best || view.q;
  }

  // ---------- Tutorial-Blase ----------
  function showBubble(kind, text) {
    tutorial = kind;
    clearTimeout(bubbleTimer);
    bubble.innerHTML = '';
    const ic = kind === 'tap' ? TAP_ICON : kind === 'swipe' ? SWIPE_ICON : icon('sparkle', { size: 24 });
    const msg = text || (kind === 'tap' ? 'Tippe auf einen Pfeil, dessen Weg frei ist' : 'Wische, um den Würfel zu drehen');
    bubble.append(h('span.bubble-ic', { html: ic }), h('span', null, msg));
    bubble.classList.remove('hidden', 'out');
    stage.classList.add('tut');
  }
  function hideBubble(animated) {
    tutorial = null;
    stage.classList.remove('tut');
    if (animated) {
      bubble.classList.add('out');
      setTimeout(() => { if (!tutorial) bubble.classList.add('hidden'); }, 300);
    } else bubble.classList.add('hidden');
  }

  // ---------- Start ----------
  function intro(fresh) {
    const start = fresh ? qNorm(qMul(qAxisAngle([0, 1, 0], 1.35), qMul(qAxisAngle([1, 0, 0], -0.25), Q_DEFAULT))) : view.q;
    view.q = start;
    view.zoom = fresh ? 0.78 : 0.9;
    view.panX = 0; view.panY = 0;
    animateView(fresh ? Q_DEFAULT : start, 1, fresh ? 1050 : 420, ease.outCubic);
    if (fresh) fade = { t0: clock() + 250, dur: 450 };
    kick();
  }

  const fresh = !saved || game.removedCount === 0;
  intro(fresh && !(saved && saved.q));
  if (fresh && levelNum === 1) {
    showBubble('tap');
    // Wer zögert, bekommt sanft einen freien Pfeil gezeigt
    tutTimer = setTimeout(() => {
      if (destroyed || game.removedCount > 0) return;
      const free = game.freeIds().map((i) => ({ i, v: renderer.visibility(i) })).sort((a, b) => b.v - a.v);
      if (free.length) { highlights.set(free[0].i, { kind: 'hint', t0: clock(), dur: 4200 }); kick(); }
    }, 6500);
  } else if (levelNum === 2 && fresh) {
    showBubble('swipe');
  }
  if (sp && fresh) {
    bubbleTimer = setTimeout(() => {
      if (destroyed || tutorial) return;
      showBubble('special', `${sp.title}: ${sp.text}`);
      bubbleTimer = setTimeout(() => { if (tutorial === 'special') hideBubble(true); }, 3400);
    }, 650);
  }
  if (!saved) saveNow();

  back.addEventListener('click', () => { sfx.play('click'); saveNow(); nav.menu(); });

  // ---------- Test-/Debug-Zugang ----------
  const debug = {
    get level() { return levelNum; },
    get N() { return level.N; },
    get arrowCount() { return game.n; },
    get remaining() { return game.remaining; },
    get hearts() { return game.hearts; },
    get mistakes() { return game.mistakes; },
    get removedIds() { return game.removedOrder.slice(); },
    get view() { return { q: view.q.slice(), zoom: view.zoom, panX: view.panX, panY: view.panY }; },
    get animating() { return anims.length > 0 || !!viewAnim || Math.hypot(...vel) > 0.00002; },
    freeIds: () => game.freeIds().filter((i) => !busy.has(i)),
    blockedIds: () => { const out = []; for (let i = 0; i < game.n; i++) if (!game.removed[i] && !game.check(i).free) out.push(i); return out; },
    visibility: (i) => renderer.visibility(i),
    /** Dreht sofort (ohne Animation), sodass Pfeil i sichtbar ist. */
    showArrow(i) { viewAnim = null; vel = [0, 0, 0]; view.zoom = 1; view.panX = 0; view.panY = 0; view.q = targetFor(i); renderer.draw(view, { removed: game.removed, hidden }); kick(); },
    /** Seiten-Koordinaten (clientX/Y) für einen Tipp auf Pfeil i – oder null. */
    tapPoint(i) {
      const p = renderer.tapPointFor(i, skip);
      if (!p) return null;
      const r = canvas.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    },
    hitTest(clientX, clientY) { const r = canvas.getBoundingClientRect(); return renderer.hitTest(clientX - r.left, clientY - r.top, skip); },
    tap: (i) => tapArrow(i),
    setTimeScale,
    get highlightCount() { return highlights.size; },
    headFacing: (i) => renderer.facing[geo.faceOf(level.arrows[i].cells[level.arrows[i].cells.length - 1])],
    restartQuiet: () => restart(),
    /** Dreht den Würfel per Kamerafahrt (für Bildraten-Messungen ohne Eingabe-Events). */
    spin(ms = 2000, opts = null) {
      renderer.debugOpts = opts || {};
      animateView(qNorm(qMul(qAxisAngle([0.2, 1, 0], 3), view.q)), view.zoom, ms, (t) => t);
      setTimeout(() => { renderer.debugOpts = {}; }, ms + 50);
    },
    /** Zeichnet n Bilder mit Drehung und misst die mittlere Zeit (ms). */
    bench(n = 60, flush = false, opts = {}) {
      Object.assign(renderer.debugOpts = renderer.debugOpts || {}, opts);
      const t0 = performance.now();
      let q = view.q;
      const step = qAxisAngle([0.3, 1, 0.1], 0.05);
      for (let i = 0; i < n; i++) {
        q = qNorm(qMul(step, q));
        renderer.draw({ ...view, q }, { removed: game.removed, hidden, anims: [], highlights: new Map(), particles: [] });
        if (flush) renderer.ctx.getImageData(0, 0, 1, 1);
      }
      renderer.debugOpts = {};
      kick();
      return (performance.now() - t0) / n;
    },
  };
  window.__cube = debug;

  return {
    destroy() {
      saveNow();
      destroyed = true;
      activeSince = 0;
      clearTimeout(saveTimer);
      clearTimeout(tutTimer);
      clearTimeout(bubbleTimer);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      gestures.destroy();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', saveNow);
      if (window.__cube === debug) window.__cube = null;
    },
  };
}
