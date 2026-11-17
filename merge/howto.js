// Verdoppeln – «So geht's»: kurzes Tutorial (shared/tutorial.js) mit animierten Mini-Brettern.
//
//   showHowTo()      jederzeit (Knopf «?» im Menü und im Spiel)
//   ensureHowTo()    nur beim allerersten Start, bevor das erste Spiel beginnt

import { h, icon } from '../shared/ui.js';
import { showTutorial, tutorialSeen, markTutorialSeen } from '../shared/tutorial.js';
import { tileFace } from './board.js';
import { valueOf } from './logic.js';
import { skinById } from './data/skins.js';
import * as P from './progress.js';

export const ID = 'merge';
const ACCENT = '#e2795a';
const fmt = P.formatNumber;

// ---------- Mini-Brett für die Demos ----------

function place(node, x, y) {
  node.style.transform = `translate(calc(${x} * (var(--c) + var(--g))), calc(${y} * (var(--c) + var(--g))))`;
}

/** Kleines Brett (cols × rows) im Spielstil. stones: [[x, y], …] */
function miniBoard(skin, cols, rows, { stones = [], cell = 54 } = {}) {
  const el = h('div.tb' + (skin.dark ? '.dark' : ''));
  el.style.setProperty('--cols', cols);
  el.style.setProperty('--rows', rows);
  el.style.setProperty('--c', cell + 'px');
  el.style.setProperty('--g', Math.round(cell * 0.13) + 'px');
  el.style.setProperty('--board', skin.board);
  el.style.setProperty('--slot', skin.slot);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const stone = stones.some(([sx, sy]) => sx === x && sy === y);
      const c = h('div.tb-cell' + (stone ? '.tb-stone' : ''), null, stone ? h('div.stone-in') : null);
      place(c, x, y);
      el.append(c);
    }
  }
  const fx = h('div.tb-fx');
  el.append(fx);
  const api = {
    el,
    /** Kachel hinzufügen; anim: 'spawn' | 'pop' | undefined */
    add(e, x, y, anim) {
      const t = h('div.tb-tile' + (anim ? '.' + anim : ''), null, tileFace(skin, e));
      place(t, x, y);
      el.insertBefore(t, fx);
      return t;
    },
    move(t, x, y) { place(t, x, y); },
    /** «+4» steigt über einer Stelle auf. */
    fly(text, x, y) {
      const f = h('div.tb-fly', null, text);
      place(f, x, y);
      fx.append(f);
      setTimeout(() => f.remove(), 900);
    },
    reset() { el.querySelectorAll('.tb-tile').forEach((n) => n.remove()); fx.textContent = ''; },
    fx,
  };
  return api;
}

/** Punkt (in % der Bühne) an einer relativen Stelle eines Elements. */
function pt(stage, el, fx, fy) {
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!s.width || !s.height) return { x: 50, y: 50 };
  return { x: ((r.left + r.width * fx - s.left) / s.width) * 100, y: ((r.top + r.height * fy - s.top) / s.height) * 100 };
}

/** Wischgeste von rechts nach links über dem Element; onMid feuert in der Mitte der Bewegung. */
async function swipeLeft(api, stage, el, onMid, fy = 0.5) {
  await api.finger.drag([pt(stage, el, 0.82, fy), pt(stage, el, 0.5, fy), pt(stage, el, 0.18, fy)], 420, (i) => { if (i === 1) onMid(); });
}

/** Zwei Kacheln verschmelzen: b rutscht auf a, danach erscheint die nächste Stufe. */
async function merge(api, b, a, b2, at, e) {
  b.move(a, at[0], at[1]);
  b.move(b2, at[0], at[1]);
  await api.sleep(170);
  a.remove(); b2.remove();
  const t = b.add(e, at[0], at[1], 'pop');
  b.fly('+' + fmt(valueOf(e)), at[0], at[1]);
  return t;
}

// ---------- Schritte ----------

function steps(skin) {
  return [
    {
      title: 'Wischen',
      text: 'Alle Kacheln rutschen mit – zwei gleiche verschmelzen zur nächsten Stufe.',
      demo(stage, api) {
        const b = miniBoard(skin, 3, 3);
        stage.append(h('div.tb-wrap', null, b.el));
        return api.loop(async () => {
          b.reset();
          const a1 = b.add(1, 0, 0, 'spawn');
          const a2 = b.add(1, 2, 0, 'spawn');
          const c = b.add(2, 1, 2, 'spawn');
          await api.sleep(500);
          await swipeLeft(api, stage, b.el, () => {
            b.move(c, 0, 2);
            merge(api, b, a1, a2, [0, 0], 2).then(() => b.add(1, 2, 1, 'spawn')).catch(() => {});
          });
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Ziel-Kachel bauen',
      text: 'Verschmilz weiter, bis die Ziel-Kachel da ist – danach darfst du weiterspielen.',
      demo(stage, api) {
        const goalE = 5;
        const chip = h('div.tb-goal', null, h('span', null, 'Ziel'), h('div.tb-goal-tile', null, tileFace(skin, goalE, { value: false })),
          h('b', null, fmt(valueOf(goalE))), h('i.tb-check', { html: icon('check', { size: 18 }) }));
        const b = miniBoard(skin, 4, 1);
        stage.append(h('div.tb-wrap.col', null, chip, b.el));
        return api.loop(async () => {
          b.reset();
          chip.classList.remove('done');
          const x1 = b.add(3, 0, 0, 'spawn');
          const x2 = b.add(4, 1, 0, 'spawn');
          const y1 = b.add(3, 3, 0, 'spawn');
          await api.sleep(600);
          let n1;
          await swipeLeft(api, stage, b.el, () => { n1 = merge(api, b, x1, y1, [0, 0], 4); n1.catch(() => {}); b.move(x2, 1, 0); });
          await api.sleep(250);
          const z = await n1;
          await api.sleep(400);
          await swipeLeft(api, stage, b.el, () => {
            merge(api, b, z, x2, [0, 0], 5).then(() => { chip.classList.add('done'); }).catch(() => {});
          });
          await api.sleep(1600);
        }, 300);
      },
    },
    {
      title: 'Zurück und Tipp',
      text: '«Tipp» zeigt einen guten Zug, «Zurück» nimmt einen Zug zurück.',
      demo(stage, api) {
        const b = miniBoard(skin, 3, 3, { cell: 44 });
        const undoB = h('div.tb-tool', { html: icon('undo', { size: 20 }) }, h('span', null, 'Zurück'));
        const hintB = h('div.tb-tool', { html: icon('hint', { size: 20 }) }, h('span', null, 'Tipp'));
        stage.append(h('div.tb-wrap.col', null, b.el, h('div.tb-tools', null, undoB, hintB)));
        return api.loop(async () => {
          b.reset();
          const a = b.add(2, 1, 0, 'spawn');
          const c = b.add(2, 2, 0, 'spawn');
          const d = b.add(1, 2, 2, 'spawn');
          await api.sleep(500);
          await api.finger.tap(hintB, 550);
          const arrow = h('div.hint-arrow', { html: '<svg viewBox="0 0 100 100"><path d="M18 42h40V24l30 26-30 26V58H18z"/></svg>' });
          arrow.style.setProperty('--rot', '180deg');
          b.fx.append(arrow);
          await api.sleep(900);
          let m;
          await swipeLeft(api, stage, b.el, () => {
            arrow.remove();
            b.move(d, 0, 2);
            m = merge(api, b, a, c, [0, 0], 3);
            m.catch(() => {});
          });
          const t = await m;
          await api.sleep(500);
          await api.finger.tap(undoB, 550);
          t.remove();
          b.add(2, 1, 0);
          b.add(2, 2, 0);
          b.move(d, 2, 2);
          b.el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220 });
          await api.sleep(1200);
        }, 300);
      },
    },
    {
      title: 'Etappen',
      text: 'Steine bleiben liegen – mit wenigen Zügen gibt es mehr Sterne.',
      demo(stage, api) {
        const b = miniBoard(skin, 3, 3, { stones: [[0, 1]], cell: 46 });
        const stars = h('div.tb-stars', null, [0, 1, 2].map(() => h('span', { html: icon('star', { size: 26 }) })));
        stage.append(h('div.tb-wrap.col', null, stars, b.el));
        return api.loop(async () => {
          b.reset();
          stars.querySelectorAll('span').forEach((s) => s.classList.remove('on'));
          const a = b.add(2, 2, 1, 'spawn');
          const c = b.add(1, 2, 0, 'spawn');
          const d = b.add(1, 0, 0, 'spawn');
          await api.sleep(500);
          await swipeLeft(api, stage, b.el, () => {
            b.move(a, 1, 1);
            merge(api, b, d, c, [0, 0], 2).catch(() => {});
          }, 0.5);
          await api.sleep(500);
          for (const s of stars.querySelectorAll('span')) {
            s.classList.add('on');
            await api.sleep(220);
          }
          await api.sleep(1300);
        }, 300);
      },
    },
  ];
}

// ---------- Öffentliche Funktionen ----------

let open = null;

export function showHowTo() {
  if (open) return open;
  const skin = skinById(P.getProg().skin);
  open = showTutorial({ id: ID, steps: steps(skin), accent: ACCENT }).finally(() => { open = null; });
  return open;
}

/** Ältere Spielstände: altes «So geht's» schon gesehen → Tutorial nicht nochmals aufdrängen. */
export function howToSeen() {
  if (!tutorialSeen(ID) && P.getProg().seenHelp) markTutorialSeen(ID);
  return tutorialSeen(ID);
}

export async function ensureHowTo() {
  if (howToSeen()) return;
  await showHowTo();
}
