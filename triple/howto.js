// Dreierlei – «So geht's» mit animierten Mini-Demos (shared/tutorial.js).
// Szenen aus echten Spielsteinen (.tr-tile), Positionen in % der Bühne.

import { h, icon } from '../shared/ui.js';
import { showTutorial, maybeShowTutorial, markTutorialSeen } from '../shared/tutorial.js';
import { sfx } from '../shared/sfx.js';
import { getPref } from './progress.js';

export const ACCENT = '#8a63d2';
const ID = 'triple';

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
    await api.sleep(600);
    await api.finger.tap(low[0]);
    low[0].classList.add('nope');
    await api.sleep(500);
    low[0].classList.remove('nope');
    await api.finger.tap(top);
    sfx.play('tap');
    toTray(top, 0);
    await api.sleep(260);
    low.forEach((t) => t.classList.remove('covered'));
    await api.sleep(700);
    await api.finger.tap(right);
    sfx.play('tap');
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
    await api.sleep(700);
    await api.finger.tap(c);
    sfx.play('tap');
    move(lemon, slotX(3), TRAY_Y);
    toTray(c, 2);
    under.classList.remove('covered');
    await api.sleep(420);
    [a, b, c].forEach((t) => t.classList.add('pop'));
    sfx.play('pop');
    await api.sleep(380);
    move(lemon, slotX(0), TRAY_Y);
    await api.sleep(900);
    await api.finger.tap(side2);
    sfx.play('tap');
    toTray(side2, 1);
    await api.sleep(1400);
  });
}

// ---------- Schritt 3: Ablage & Hilfen ----------

function demoHelpers(stage, api) {
  const sc = scene(stage);
  tray(sc);
  const emo = ['🍒', '🍋', '🍐', '🥝', '🍑', '🍇'];
  const ts = emo.map((e, k) => tile(sc, e, slotX(k), TRAY_Y, 'in-tray'));
  const shelf = h('div.tr-demo-shelf');
  sc.append(shelf);
  const btn = h('div.tr-demo-helper', { html: '<span class="ic"></span><b>Auslagern</b>' });
  btn.querySelector('.ic').innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13.5h16v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M9 17h6"/><path d="M12 3.5v7M8.8 6.7L12 3.5l3.2 3.2"/></svg>';
  sc.append(btn);
  return api.loop(async () => {
    ts.forEach((t, k) => reset(t, slotX(k), TRAY_Y, ['in-tray']));
    shelf.classList.remove('show');
    btn.classList.remove('used');
    sc.querySelector('.tr-demo-tray').classList.add('warn');
    await api.sleep(900);
    await api.finger.tap(btn);
    sfx.play('whoosh');
    btn.classList.add('used');
    shelf.classList.add('show');
    sc.querySelector('.tr-demo-tray').classList.remove('warn');
    ts.slice(0, 3).forEach((t, k) => { t.classList.remove('in-tray'); t.classList.add('on-shelf'); move(t, 38 + k * 12, 52); });
    await api.sleep(450);
    ts.slice(3).forEach((t, k) => move(t, slotX(k), TRAY_Y));
    await api.sleep(2000);
  });
}

// ---------- Schritt 4: Sterne & Spielarten ----------

function demoStars(stage, api) {
  const sc = scene(stage);
  const fan = h('div.tr-demo-fan', null,
    h('div.tr-tile.static', null, h('span.tr-emo', null, '🐠')),
    h('div.tr-tile.static', null, h('span.tr-emo', null, '🌸')),
    h('div.tr-tile.static', null, h('span.tr-emo', null, '🍩')));
  const stars = h('div.tr-demo-stars', null, ...[0, 1, 2].map(() => h('span', { html: icon('star', { size: 40 }) })));
  const chips = h('div.tr-demo-chips', null, h('span', null, 'Level-Reihe'), h('span', null, 'Freies Spiel'));
  sc.append(fan, stars, chips);
  api.finger.hide();
  return api.loop(async () => {
    [...stars.children].forEach((s) => s.classList.remove('on'));
    await api.sleep(500);
    for (const s of stars.children) {
      s.classList.add('on');
      sfx.play('sparkle');
      await api.sleep(320);
    }
    await api.sleep(2200);
  });
}

// ---------- Öffentlich ----------

function steps() {
  return [
    { title: 'Steine antippen', text: 'Helle Steine sind frei – angetippt wandern sie in die Ablage.', demo: demoTap },
    { title: 'Drei gleiche', text: 'Drei gleiche Bilder in der Ablage verschwinden. Räume alles ab!', demo: demoTriple },
    { title: 'Hilfen gratis', text: 'Die Ablage hat 7 Plätze. Zurück, Auslagern, Mischen und Tipp helfen – je 1× pro Level.', demo: demoHelpers },
    { title: 'Sterne sammeln', text: 'Ohne Hilfen gibt es 3 Sterne. Die Level gehen nie aus – oder spiele frei nach Thema.', demo: demoStars },
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
