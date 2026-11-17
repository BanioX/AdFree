// Wollknäuel – Wollschlaufen nach Farben auf Spulen sortieren.
// Eigene Wendung: Eine volle, einfarbige Spule wird sofort verstrickt. Das Strickstück wandert in den
// Strickkorb (Sammlung) und die Spule ist wieder frei.
// Regeln, Generator, Löser und App-Hülle kommen aus /lib/sorting/.

import { h } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { store } from '../shared/storage.js';
import { menuSection } from '../shared/gamemenu.js';
import { runSortGame } from '../lib/sorting/shell.js';
import { sortTutorial } from '../lib/sorting/tutorial.js';
import { tone, noise } from '../lib/sorting/audio.js';
import { YARNS } from './data/colors.js';
import { ITEMS, itemFor } from './data/items.js';
import { CHAPTERS, CHAPTER_SIZE, levelParams, zenParams, hardParams, dailyParams } from './data/levels.js';

const ID = 'yarn';
const RULES = { move: 'group', complete: 'clear' };
const NAMES = { stack: 'Spule', stacks: 'Spulen', piece: 'Schlaufe', pieces: 'Schlaufen', extra: '+1 Spule', extraLong: 'Eine leere Spule dazu' };

// ---------- Strickstücke ----------
let uid = 0;
export function itemSvg(it, ci, { size = 48, locked = false } = {}) {
  const y = YARNS[ci % YARNS.length];
  const id = 'kn' + (++uid);
  const fill = locked ? '#ddd5cb' : y.c, dark = locked ? '#b9afa3' : y.d, light = locked ? '#ebe5dd' : y.l;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
<defs><pattern id="${id}" width="4.6" height="4.2" patternUnits="userSpaceOnUse"><path d="M.6 .8l1.7 2.6 1.7-2.6" fill="none" stroke="${light}" stroke-width=".9" opacity="${locked ? 0.4 : 0.6}"/></pattern></defs>
<path d="${it.body}" fill="${fill}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>
<path d="${it.body}" fill="url(#${id})"/>
${it.trim ? `<path d="${it.trim}" fill="${light}" fill-rule="evenodd" stroke="${dark}" stroke-width="1.6" stroke-linejoin="round"/>` : ''}
${it.lines ? `<path d="${it.lines}" fill="none" stroke="${dark}" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>` : ''}
</svg>`;
}

const BASKET_KEY = `${ID}.basket`;
const loadBasket = () => Object.assign({ total: 0, types: {} }, store.get(BASKET_KEY, {}));
let lastWon = null; // { items: [{ it, ci }], unlocked: [it] }

/** Farben der fertigen Spulen in der Reihenfolge, in der sie verstrickt wurden. */
function knitOrder(run) {
  return run.hist.filter((r) => r.cleared).map((r) => r.color);
}

function addToBasket(order) {
  const b = loadBasket();
  const before = new Set(ITEMS.filter((it) => it.at <= b.total).map((it) => it.id));
  const items = [];
  for (const ci of order) {
    const it = itemFor(b.total);
    const t = b.types[it.id] || { n: 0, c: ci };
    t.n++; t.c = ci;
    b.types[it.id] = t;
    b.total++;
    items.push({ it, ci });
  }
  store.set(BASKET_KEY, b);
  const unlocked = ITEMS.filter((it) => it.at <= b.total && !before.has(it.id));
  return { items, unlocked };
}

// ---------- Aussehen ----------
let basketEl = null;
let basketCount = null;
let pendingFly = 0;
let lastDone = null;

const view = {
  aspect: 1.45, step: 0.94, padTop: 0.5, padBottom: 0.42, side: 0.1, liftTop: -0.7, maxPiece: 40, gapX: 0.36, gapY: 0.5,
  makeStack() {
    return h('div.yn-spool', null, h('i.yn-core'), h('i.yn-flange.bottom'), h('i.yn-flange.top'));
  },
  makePiece(color) {
    const y = YARNS[color % YARNS.length];
    const el = h('div.yn-loop', null, h('i'));
    el.style.setProperty('--c', y.c);
    el.style.setProperty('--d', y.d);
    el.style.setProperty('--l', y.l);
    el.style.setProperty('--a', `${108 + ((color * 7) % 14)}deg`);
    return el;
  },
  travel(el, on) { el.classList.toggle('wiggle', on); },
  /** Volle Spule: Schlaufen wickeln sich ab, ein Strickstück entsteht und fliegt in den Korb. */
  clear(els, color, i, board) {
    const r = board.stackRect(i);
    const m = board.metrics;
    if (!r || !m) return Promise.resolve();
    els.forEach((el, k) => { el.style.transitionDelay = `${(els.length - 1 - k) * 40}ms`; el.classList.add('unwind'); });
    const stage = board.host.closest('.sg-stage');
    const target = stage && basketEl && stage.contains(basketEl) ? basketEl : null;
    const it = itemFor(loadBasket().total + (target && hudRun ? Math.max(0, knitOrder(hudRun).length - 1) : 0));
    const size = Math.max(44, Math.min(72, m.pw * 1.25));
    const item = h('div.yn-item', { html: itemSvg(it, color, { size }) });
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.55;
    Object.assign(item.style, { left: cx - size / 2 + 'px', top: cy - size / 2 + 'px', width: size + 'px', height: size + 'px' });
    board.fx.append(item);
    board.burst(i, [YARNS[color % YARNS.length].l, '#ffffff', YARNS[color % YARNS.length].c], 10);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
        if (!target) {
          item.classList.add('fade');
          setTimeout(() => item.remove(), 600);
          return;
        }
        const hb = board.host.getBoundingClientRect();
        const tb = target.getBoundingClientRect();
        const dx = tb.left + tb.width * 0.3 - (hb.left + cx);
        const dy = tb.top + tb.height / 2 - (hb.top + cy);
        const anim = item.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(.8)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
        ], { duration: 650, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
        anim.onfinish = () => {
          item.remove();
          pendingFly = Math.max(0, pendingFly - 1);
          target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump');
          paintBasket();
        };
      }, 520);
    });
  },
};

function doneCount(state, run) {
  const present = new Set();
  for (const s of state.stacks) for (const c of s) present.add(c);
  return Math.max(0, (run.colors || 0) - present.size);
}
let hudState = null, hudRun = null;
function paintBasket() {
  if (!basketCount || !hudState) return;
  const done = doneCount(hudState, hudRun);
  basketCount.textContent = `${Math.max(0, done - pendingFly)}/${hudRun.colors}`;
}

// ---------- Klänge ----------
const sounds = {
  lift() {
    if (!sfx.output()) return;
    noise({ name: 'fwip', gap: 60, dur: 0.09, gain: 0.06, freq: 1100, q: 0.8 });
  },
  land() {
    if (!sfx.output()) return;
    tone({ name: 'puff', gap: 60, freq: 240, to: 170, dur: 0.1, type: 'sine', gain: 0.09 });
    noise({ dur: 0.05, gain: 0.04, freq: 600, q: 0.7, type: 'lowpass' });
  },
  complete() {
    if (!sfx.output()) return;
    [523, 659, 784, 1047].forEach((f, k) => tone({ freq: f, dur: 0.5, type: 'sine', gain: 0.055, delay: 0.25 + k * 0.08 }));
  },
};

// ---------- Tutorial ----------
function tutorial() {
  return sortTutorial({
    view, rules: RULES, names: NAMES,
    core: {
      title: 'Wolle umwickeln',
      text: 'Tippe zwei Spulen an – die obersten Schlaufen gleicher Farbe wandern hinüber.',
      state: { cap: 3, stacks: [[1, 0, 0], [2, 2], [2, 1], []] },
      moves: [[0, 3], [2, 0]],
    },
    goal: {
      title: 'Spule voll, Stück fertig',
      text: 'Eine volle Spule in einer Farbe wird verstrickt – und ist danach wieder frei.',
      state: { cap: 3, stacks: [[0, 0], [1, 1, 0], [1]] },
      moves: [[1, 0], [2, 1]],
    },
    help: {
      title: 'Hilfe ist gratis',
      text: 'Rückgängig, Tipp und Extra-Spule helfen jederzeit und kosten höchstens einen Stern.',
      state: { cap: 3, stacks: [[0, 1, 0], [1, 0, 1], []] },
      hint: [0, 2],
      after: [1, -1],
    },
    modes: {
      title: 'Dein Strickkorb',
      text: 'Alles Gestrickte sammelt sich im Korb – und es kommen immer neue Stücke dazu.',
      items: [
        { emoji: '🧦', label: 'Sammeln', sub: 'Socken, Mützen, Schals …' },
        { emoji: '🌿', label: 'Entspannt', sub: 'endlos, ohne Sterne' },
        { emoji: '🧠', label: 'Knifflig', sub: 'wild bewickelt' },
        { emoji: '📅', label: 'Tagesrätsel', sub: 'jeden Tag neu' },
      ],
    },
  });
}

// ---------- Strickkorb im Menü ----------
function basketSection() {
  const b = loadBasket();
  const grid = h('div.yn-basket-grid');
  for (const it of ITEMS) {
    const t = b.types[it.id];
    const open = b.total >= it.at;
    const card = h('div.yn-basket-card' + (open ? '' : '.locked'), null,
      h('span.yn-basket-art', { html: itemSvg(it, t ? t.c : 0, { size: 44, locked: !t }) }),
      h('b', null, open ? it.name : '???'),
      h('small', null, t ? `× ${t.n}` : (open ? 'bald' : `ab ${it.at} Stück`)));
    grid.append(card);
  }
  const head = h('p.yn-basket-sum', null, b.total ? `${b.total} Strickstücke gesammelt` : 'Fülle Spulen, um Strickstücke zu sammeln.');
  return menuSection('Strickkorb', h('div.card.yn-basket', null, head, grid));
}

function winExtra() {
  if (!lastWon || !lastWon.items.length) return null;
  const row = h('div.yn-won');
  lastWon.items.slice(0, 12).forEach(({ it, ci }, k) => {
    const s = h('span', { html: itemSvg(it, ci, { size: 40 }) });
    s.style.animationDelay = `${0.3 + k * 0.07}s`;
    row.append(s);
  });
  const box = h('div.yn-won-box', null, h('small', null, 'Neu im Strickkorb'), row);
  if (lastWon.unlocked.length) box.append(h('p.yn-unlock', null, `Neu freigeschaltet: ${lastWon.unlocked.map((u) => u.name).join(', ')}!`));
  return box;
}

runSortGame({
  id: ID,
  title: 'Wollknäuel',
  tagline: 'Wolle nach Farben aufwickeln',
  accent: '#d65c8e',
  rules: RULES,
  names: NAMES,
  view,
  chapters: CHAPTERS,
  chapterSize: CHAPTER_SIZE,
  level: levelParams,
  zen: zenParams,
  hard: hardParams,
  daily: dailyParams,
  dailyLabel: 'Wolle des Tages',
  tutorial,
  sounds,
  winEmoji: '🧶',
  showcase: { cap: 4, stacks: [[0, 0, 0], [1, 2, 1], [2, 1, 2, 2], [], [1, 4], [4, 4, 4, 3]] },
  confetti: (run) => YARNS.slice(0, Math.min(run.colors || 6, YARNS.length)).map((y) => y.c),
  sections: () => [basketSection()],
  decorate(root) {
    basketCount = h('b');
    basketEl = h('div.yn-basket-pill', { 'aria-label': 'Strickkorb' }, h('span', null, '🧺'), basketCount);
    pendingFly = 0;
    lastDone = null;
    root.querySelector('.sg-stage').append(basketEl);
  },
  hud(state, run) {
    hudState = state; hudRun = run;
    const d = doneCount(state, run);
    if (lastDone != null && d > lastDone) pendingFly += d - lastDone; // Stück ist noch unterwegs
    else if (lastDone != null && d < lastDone) pendingFly = 0;        // Rückgängig/Neustart
    lastDone = d;
    paintBasket();
  },
  onWin(run) {
    lastWon = addToBasket(knitOrder(run));
  },
  winExtra,
});
