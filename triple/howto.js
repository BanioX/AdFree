// Dreierlei – «So geht's» mit animierten Mini-Demos (shared/tutorial.js).
// Szenen aus echten Spielsteinen (.tr-tile) und den echten Hilfe-Knöpfen, Positionen in % der Bühne.
// Die Demos sind stumm – Klänge gibt es nur bei echten Spielereignissen.

import { h, icon } from '../shared/ui.js';
import { L } from '../shared/i18n.js';
import { showTutorial, maybeShowTutorial, markTutorialSeen } from '../shared/tutorial.js';
import { getPref } from './progress.js';
import { ACCENT, HELPER_INFO, sparkBurst, floatText } from './bits.js';

export { ACCENT };
const ID = 'triple';
const FX_COLORS = ['#e2525c', '#ffd23f', '#ffffff', '#ff8fb1'];

// ---------- Bausteine ----------

function scene(stage) {
  const s = h('div.tr-demo');
  stage.prepend(s);
  return s;
}

function move(el, x, y, animate = true) {
  if (!animate) el.style.transition = 'none';
  el.style.left = x + '%';
  el.style.top = y + '%';
  if (!animate) { void el.offsetWidth; el.style.transition = ''; }
}

function tile(sc, emo, x, y, cls = '') {
  const el = h('div.tr-tile.static.dt' + (cls ? '.' + cls : ''), null, h('span.tr-emo', null, emo));
  sc.append(el);
  move(el, x, y, false);
  return el;
}

const TRAY_Y = 84;
const slotX = (k) => 14 + k * 12;

function tray(sc) {
  const t = h('div.tr-demo-tray', null, ...Array.from({ length: 7 }, () => h('i')));
  sc.append(t);
  return t;
}

/** Stein in die Ablage fliegen lassen. */
function toTray(el, k) {
  el.classList.add('in-tray');
  el.classList.remove('covered');
  move(el, slotX(k), TRAY_Y);
}

function reset(el, x, y, cls = []) {
  el.className = 'tr-tile static dt';
  for (const c of cls) el.classList.add(c);
  move(el, x, y, false);
}

// ---------- Schritt 1: Stein antippen ----------

function demoTap(stage, api) {
  const sc = scene(stage);
  tray(sc);
  const low = [tile(sc, '🍋', 38, 30, 'covered'), tile(sc, '🍇', 62, 30, 'covered')];
  const top = tile(sc, '🍓', 50, 40);
  const left = tile(sc, '🍒', 22, 44);
  const right = tile(sc, '🍓', 78, 44);
  return api.loop(async () => {
    reset(low[0], 38, 30, ['covered']);
    reset(low[1], 62, 30, ['covered']);
    reset(top, 50, 40);
    reset(left, 22, 44);
    reset(right, 78, 44);
    await api.sleep(500);
    // verdeckter Stein: wackelt nur
    await api.finger.tap(low[0]);
    low[0].classList.add('nope');
    await api.sleep(500);
    low[0].classList.remove('nope');
    // heller Stein: fliegt in die Ablage, darunter wird es hell
    await api.finger.tap(top);
    toTray(top, 0);
    await api.sleep(260);
    low.forEach((t) => t.classList.add('freed'));
    low.forEach((t) => t.classList.remove('covered'));
    await api.sleep(700);
    await api.finger.tap(right);
    toTray(right, 1);
    await api.sleep(1500);
  });
}

// ---------- Schritt 2: Drei gleiche ----------

function demoTriple(stage, api) {
  const sc = scene(stage);
  tray(sc);
  const a = tile(sc, '🍓', slotX(0), TRAY_Y, 'in-tray');
  const b = tile(sc, '🍓', slotX(1), TRAY_Y, 'in-tray');
  const lemon = tile(sc, '🍋', slotX(2), TRAY_Y, 'in-tray');
  const under = tile(sc, '🍇', 50, 30, 'covered');
  const c = tile(sc, '🍓', 50, 40);
  const side1 = tile(sc, '🍐', 26, 38);
  const side2 = tile(sc, '🍋', 74, 38);
  return api.loop(async () => {
    reset(a, slotX(0), TRAY_Y, ['in-tray']);
    reset(b, slotX(1), TRAY_Y, ['in-tray']);
    reset(lemon, slotX(2), TRAY_Y, ['in-tray']);
    reset(under, 50, 30, ['covered']);
    reset(c, 50, 40);
    reset(side1, 26, 38);
    reset(side2, 74, 38);
    await api.sleep(600);
    await api.finger.tap(c);
    move(lemon, slotX(3), TRAY_Y);
    toTray(c, 2);
    under.classList.remove('covered');
    await api.sleep(380);
    [a, b, c].forEach((t) => t.classList.add('glow'));
    await api.sleep(200);
    [a, b, c].forEach((t) => t.classList.add('pop'));
    sparkBurst(sc, slotX(1), TRAY_Y, FX_COLORS, { n: 10, dist: 26, unit: '%' });
    floatText(sc, L('Super!', 'Great!'), slotX(1), TRAY_Y - 22, { unit: '%' });
    await api.sleep(380);
    move(lemon, slotX(0), TRAY_Y);
    await api.sleep(900);
    await api.finger.tap(side2);
    toTray(side2, 1);
    await api.sleep(1300);
  });
}

// ---------- Schritt 3: Ablage & Hilfen ----------

function demoHelpers(stage, api) {
  const sc = scene(stage);
  const tr = tray(sc);
  const emo = ['🍒', '🍋', '🍐', '🥝', '🍑', '🍇'];
  const ts = emo.map((e, k) => tile(sc, e, slotX(k), TRAY_Y, 'in-tray'));
  const shelf = h('div.tr-demo-shelf');
  sc.append(shelf);
  // die echten Hilfe-Knöpfe, verkleinert
  const bar = h('div.tr-demo-helpers');
  const btn = {};
  for (const k of ['undo', 'stash', 'shuffle', 'hint']) {
    const info = HELPER_INFO[k];
    const badge = h('span.tr-badge', null, '1');
    const b = h('div.tr-helper', null, h('span.tr-helper-ic', { html: info.icon() }, badge), h('span.tr-helper-label', null, info.label()));
    btn[k] = { b, badge };
    bar.append(b);
  }
  sc.append(bar);
  return api.loop(async () => {
    ts.forEach((t, k) => reset(t, slotX(k), TRAY_Y, ['in-tray']));
    shelf.classList.remove('show');
    btn.stash.b.classList.remove('used', 'press');
    btn.stash.badge.textContent = '1';
    tr.classList.add('warn');
    await api.sleep(900);
    await api.finger.moveTo(btn.stash.b, 600);
    btn.stash.b.classList.add('press');
    await api.finger.press();
    btn.stash.b.classList.remove('press');
    btn.stash.b.classList.add('used');
    btn.stash.badge.textContent = '0';
    shelf.classList.add('show');
    tr.classList.remove('warn');
    ts.slice(0, 3).forEach((t, k) => { t.classList.remove('in-tray'); t.classList.add('on-shelf'); move(t, 38 + k * 12, 52); });
    await api.sleep(450);
    ts.slice(3).forEach((t, k) => move(t, slotX(k), TRAY_Y));
    api.finger.hide();
    await api.sleep(2000);
  });
}

// ---------- Schritt 4: Sterne & Spielarten ----------

function demoModes(stage, api) {
  const sc = scene(stage);
  const fanTiles = [0, 1, 2].map(() => h('div.tr-tile.static', null, h('span.tr-emo', null, '🍓')));
  const fan = h('div.tr-demo-fan', null, ...fanTiles);
  const stars = h('div.tr-demo-stars', null, ...[0, 1, 2].map(() => h('span', { html: icon('star', { size: 40 }) })));
  const segLv = h('span', null, L('Level-Reihe', 'Levels'));
  const segFree = h('span', null, L('Freies Spiel', 'Free play'));
  const seg = h('div.tr-demo-seg', null, segLv, segFree);
  sc.append(fan, stars, seg);
  const setMode = (free) => {
    segLv.classList.toggle('on', !free);
    segFree.classList.toggle('on', free);
    stars.classList.toggle('off', free);
  };
  const flip = (emo) => fanTiles.forEach((t, k) => {
    t.animate([{ transform: 'scale(1)' }, { transform: 'scaleX(.05) scaleY(.9)', offset: 0.5 }, { transform: 'scale(1)' }],
      { duration: 380, delay: k * 70, easing: 'ease-in-out' });
    setTimeout(() => { t.firstChild.textContent = emo; }, 190 + k * 70);
  });
  return api.loop(async () => {
    setMode(false);
    fanTiles.forEach((t) => { t.firstChild.textContent = '🍓'; });
    [...stars.children].forEach((s) => s.classList.remove('on'));
    api.finger.hide();
    await api.sleep(400);
    for (const s of stars.children) { s.classList.add('on'); await api.sleep(300); }
    await api.sleep(900);
    await api.finger.tap(segFree);
    setMode(true);
    for (const emo of ['🐠', '🌸', '🍩']) { await api.sleep(320); flip(emo); await api.sleep(520); }
    await api.sleep(500);
    await api.finger.tap(segLv);
    setMode(false);
    flip('🍓');
    await api.sleep(500);
  }, 400);
}

// ---------- Öffentlich ----------

function steps() {
  return [
    {
      title: L('Steine antippen', 'Tap free tiles'),
      text: L('Helle Steine sind frei – angetippt wandern sie in die Ablage.', 'Bright tiles are free – tap one to send it to the tray.'),
      demo: demoTap,
    },
    {
      title: L('Drei Gleiche', 'Match three'),
      text: L('Drei gleiche Bilder in der Ablage verschwinden – räume alles ab.', 'Three alike in the tray vanish – clear the whole board.'),
      demo: demoTriple,
    },
    {
      title: L('Hilfen gratis', 'Free helpers'),
      text: L('Die Ablage hat 7 Plätze – wird es eng, helfen vier Gratis-Hilfen.', 'The tray holds 7 – when it gets tight, four free helpers step in.'),
      demo: demoHelpers,
    },
    {
      title: L('Sterne & Themen', 'Stars & themes'),
      text: L('Ohne Hilfen gibt es 3 Sterne – oder spiele frei nach Thema.', 'No helpers earns 3 stars – or play freely by theme.'),
      demo: demoModes,
    },
  ];
}

export function showHelp() {
  return showTutorial({ id: ID, steps: steps(), accent: ACCENT });
}

/** Beim allerersten Start (frühere Versionen merkten sich «helpSeen»). */
export function maybeShowHelp() {
  if (getPref('helpSeen', false)) { markTutorialSeen(ID); return Promise.resolve(false); }
  return maybeShowTutorial({ id: ID, steps: steps(), accent: ACCENT });
}
