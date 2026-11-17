// Farbfluss – «So geht's»: animierte Mini-Demos für das gemeinsame Tutorial (/shared/tutorial.js).
//
// Jede Demo benutzt das ECHTE Spielfeld (view/board.js) in klein: dieselben Gläser, dasselbe
// Giessen mit Strahl, Korken und Funkeln wie im Spiel. Ein Finger tippt die Gläser an.
// Texte und Reihenfolge der Schritte stehen in data/texts.js (howTo).

import { h, icon } from '../../shared/ui.js';
import { liquids, hiddenLiquid } from '../data/colors.js';
import { applyPour, undoPour, cloneState } from '../logic/rules.js';
import { Board } from './board.js';
import { tubeHeight } from './glass.js';

const ACCENT = '#22a9b7';
const C = (id) => liquids.findIndex((x) => x.id === id);
const R = C('rot'), B = C('blau'), Y = C('gelb'), G = C('gruen'), P = C('pink');

/**
 * Baut eine kleine Szene mit dem echten Board. tubes = Farblisten (unten → oben).
 * Liefert Helfer, um Gläser anzutippen und zu giessen – alles läuft nur, solange der Schritt offen ist.
 */
function boardScene(stage, api, tubes, { bottom = 0, maxW = 44 } = {}) {
  const sc = h('div.tt-scene');
  const host = h('div.tt-board');
  if (bottom) host.style.bottom = bottom + 'px';
  const cv = h('canvas', { 'aria-hidden': 'true' });
  host.append(cv);
  sc.append(host);
  stage.prepend(sc); // Finger und Welle der Tutorial-API bleiben obenauf
  const start = { per: 4, tubes: tubes.map((l) => ({ cap: 4, l: l.slice(), h: 0 })) };
  let state = cloneState(start);
  const board = new Board(cv, {
    interactive: false, maxW, shelf: true, padY: 4, padX: 8, topRoom: 0.75, vAlign: 0.72,
    shelfColor: '#e6d8c2', accent: ACCENT,
    colorOf: (c) => liquids[c], hiddenColor: hiddenLiquid.color,
    symbols: () => false, speed: () => 0.85,
  });
  api.signal.addEventListener('abort', () => board.destroy(), { once: true });

  /** Punkt (in % der Bühne) mitten auf Glas i. */
  const at = (i) => {
    const c = board.tubeCenter(i);
    const s = stage.getBoundingClientRect();
    if (!c || !s.width) return { x: 50, y: 50 };
    return { x: ((c.x - s.left) / s.width) * 100, y: ((c.y - s.top) / s.height) * 100 };
  };

  const scene = {
    sc, board,
    get state() { return state; },
    reset(intro = true) {
      state = cloneState(start);
      board.setState(state, { intro });
    },
    at,
    async tap(i) { await api.finger.tap(at(i)); },
    /** Giesst von a nach b (wie im Spiel: antippen, antippen). */
    async pour(a, b) {
      await scene.tap(a);
      board.select(a);
      await api.sleep(260);
      await scene.tap(b);
      board.select(-1);
      const mv = applyPour(state, a, b);
      if (mv) board.pour(mv, state.tubes[mv.from].h, state.tubes[mv.to].h);
      return mv;
    },
    idle: () => Promise.race([board.whenIdle(), api.sleep(2500)]),
  };
  scene.reset(false);
  return scene;
}

/** Kleines Schild über einem Glas (✕ für «geht nicht», Text für Lob). */
function badge(scene, i, html, cls) {
  const b = h('div.tt-badge' + (cls ? '.' + cls : ''), { html });
  const p = scene.at(i);
  b.style.left = p.x + '%';
  const w = scene.board.w, t = scene.board.tubes[i];
  b.style.top = `calc(${p.y}% - ${(0.55 * tubeHeight(t ? t.cap : 4) + 0.6) * w}px)`;
  scene.sc.append(b);
  requestAnimationFrame(() => b.classList.add('show'));
  setTimeout(() => b.remove(), 1100);
  return b;
}

const DEMOS = {
  /** Kernaktion: antippen, antippen – die oberste Farbe fliesst hinüber. */
  tap(stage, api) {
    const s = boardScene(stage, api, [[Y, B, G], [B, Y, R], [G, R]]);
    return api.loop(async () => {
      s.reset(false);
      await api.sleep(250);
      await s.pour(1, 2);
      api.finger.hide();
      await s.idle();
      await api.sleep(1100);
    }, 200);
  },

  /** Ziel: jedes Glas eine Farbe – volle Gläser bekommen einen Korken. */
  goal(stage, api) {
    const s = boardScene(stage, api, [[R, R, R], [Y, Y, Y, R], [B, B, B, B], [Y]]);
    return api.loop(async () => {
      s.reset(false);
      await api.sleep(250);
      await s.pour(1, 0);
      await s.idle();
      badge(s, 0, 'Schön!', 'praise');
      await api.sleep(250);
      await s.pour(3, 1);
      api.finger.hide();
      await s.idle();
      badge(s, 1, 'Super!', 'praise');
      await api.sleep(350);
      s.board.celebrate();
      await api.sleep(1500);
    }, 200);
  },

  /** Regel: nur auf dieselbe Farbe oder ins leere Glas. */
  rule(stage, api) {
    const s = boardScene(stage, api, [[B, R], [G, B], []]);
    return api.loop(async () => {
      s.reset(false);
      await api.sleep(250);
      await s.tap(0);
      s.board.select(0);
      await api.sleep(260);
      await s.tap(1);
      s.board.select(-1);
      s.board.shake(1);
      badge(s, 1, icon('close', { size: 16 }), 'bad');
      await api.sleep(700);
      await s.pour(0, 2);
      api.finger.hide();
      await s.idle();
      await api.sleep(1100);
    }, 200);
  },

  /** Hilfen: Tipp zeigt den Zug, Zurück nimmt ihn zurück, +1 Glas gibt Platz. */
  help(stage, api) {
    const s = boardScene(stage, api, [[B, R], [G, R], [P, B]], { bottom: 74, maxW: 40 });
    const row = h('div.tt-tools');
    const mk = (ic, label, cls) => {
      const b = h('div.tt-tool' + (cls ? '.' + cls : ''), null, h('span.ic', { html: icon(ic, { size: 20 }) }), h('span', null, label));
      row.append(b);
      return b;
    };
    const bUndo = mk('undo', 'Zurück'), bHint = mk('hint', 'Tipp', 'hint'), bExtra = mk('plus', '+1 Glas', 'extra');
    s.sc.append(row);
    const press = async (b) => {
      await api.finger.tap(b, 520);
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    };
    return api.loop(async () => {
      s.reset(false);
      await api.sleep(300);
      // Tipp: Pfeile zeigen den nächsten guten Zug
      await press(bHint);
      s.board.setHint({ from: 0, to: 1 });
      await api.sleep(900);
      const mv = await s.pour(0, 1);
      s.board.setHint(null);
      await s.idle();
      await api.sleep(300);
      // Zurück: der Zug wird rückgängig gemacht
      await press(bUndo);
      undoPour(s.state, mv);
      s.board.sync(s.state);
      s.board.shake(0);
      await api.sleep(700);
      // +1 Glas: ein leeres Glas kommt dazu
      await press(bExtra);
      const t = { cap: 4, l: [], h: 0 };
      s.state.tubes.push(t);
      s.board.addTube(t);
      api.finger.hide();
      await api.sleep(1600);
    }, 200);
  },
};

/** Schritte für showTutorial aus den Texten in data/texts.js. */
export function tutorialSteps(howTo) {
  return howTo.map((s) => ({
    title: s.title,
    text: s.text,
    demo: DEMOS[s.demo] || undefined,
  }));
}
