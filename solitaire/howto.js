// «So geht's»: kurze Schritte mit animierten Mini-Demos für /shared/tutorial.js.
// Die Demos bauen kleine Kartenszenen aus echten Kartengesichtern (faceHTML) auf dem Spieltisch-Filz.
//
//   tutorialFor('klondike' | 'spider' | 'freecell', settings) → { id, steps }
//   Klondike = Grund-Tutorial (id 'solitaire'), Spider und FreeCell haben je ein eigenes,
//   das beim ersten Spiel dieser Spielart automatisch erscheint.

import { h, icon } from '../shared/ui.js';
import { makeCode } from './logic/rules.js';
import { faceHTML } from './cardface.js';

const SP = 0, HE = 1, KR = 2, KA = 3; // Pik, Herz, Kreuz, Karo

function place(el, x, y) { el.style.left = x + '%'; el.style.top = y + '%'; }

function scene(stage, cls = '') {
  const box = h('div.tut-felt' + cls);
  stage.append(box);
  return box;
}

/** Unsichtbarer Platzhalter in Kartengrösse – Zielpunkt für den Finger. */
function ghost(box, x, y) {
  const el = h('div.tut-ghost');
  place(el, x, y);
  box.append(el);
  return el;
}

function slot(box, x, y, label = '') {
  const el = h('div.tut-slot', null, label);
  place(el, x, y);
  box.append(el);
  return el;
}

/** Karte gleitet an einen Platz (ms = Dauer). */
function slide(el, x, y, ms = 380, z) {
  el.style.transition = `left ${ms}ms cubic-bezier(.3,.7,.3,1), top ${ms}ms cubic-bezier(.3,.7,.3,1)`;
  if (z != null) el.style.zIndex = z;
  place(el, x, y);
}
function jump(el, x, y, z) {
  el.style.transition = 'none';
  if (z != null) el.style.zIndex = z;
  place(el, x, y);
}

/** Kleiner Funkenregen über einem Element (wie beim Ablegen im Spiel). */
function burst(box, el) {
  const b = h('div.tut-burst');
  b.style.left = el.style.left;
  b.style.top = el.style.top;
  for (let i = 0; i < 8; i++) b.append(h('i', { style: { '--a': (i * 45) + 'deg' } }));
  box.append(b);
  setTimeout(() => b.remove(), 750);
}

function flipUp(el) {
  el.classList.add('up', 'flip');
  setTimeout(() => el.classList.remove('flip'), 320);
}

export function tutorialFor(family, face = {}) {
  const card = (code, x, y, up = true) => {
    const el = h('div.mini-card.tut-card-el' + (up ? '.up' : ''));
    el.innerHTML = (code >= 0 ? faceHTML(code, face) : '<div class="face"></div>') + '<div class="back"></div>';
    place(el, x, y);
    return el;
  };
  const C = (s, r, x, y, up = true) => card(makeCode(s, r), x, y, up);

  // ---------------------------------------------------------------- Grund-Schritte

  const redOnBlack = {
    title: 'Rot auf Schwarz',
    text: 'Lege Karten absteigend Rot auf Schwarz – antippen oder ziehen.',
    demo(stage, api) {
      const box = scene(stage);
      const n9 = C(SP, 9, 10, 14);
      const hB = C(KR, 12, 42, 14, false), r8 = C(HE, 8, 42, 25);
      const hC = C(KA, 4, 74, 14, false), k7 = C(KR, 7, 74, 25);
      box.append(n9, hB, r8, hC, k7);
      const g7 = ghost(box, 10, 36);
      return api.loop(async () => {
        jump(r8, 42, 25, 2); jump(k7, 74, 25, 2);
        hB.classList.remove('up'); hC.classList.remove('up');
        await api.sleep(350);
        await api.finger.tap(r8);
        slide(r8, 10, 25, 380, 3);
        await api.sleep(380);
        flipUp(hB);
        await api.sleep(450);
        const d = api.finger.drag([k7, g7], 650);
        await api.sleep(650);
        k7.classList.add('lifted');
        slide(k7, 10, 36, 650, 4);
        await d;
        k7.classList.remove('lifted');
        flipUp(hC);
        await api.sleep(1300);
        api.finger.hide();
      }, 300);
    },
  };

  const aceToKing = {
    title: 'Ass bis König',
    text: 'Sammle jede Farbe vom Ass bis zum König auf den vier Ablagen.',
    demo(stage, api) {
      const box = scene(stage);
      const xs = [7, 29, 51, 73];
      const slots = xs.map((x) => slot(box, x, 8, 'A'));
      box.append(C(SP, 1, xs[1], 8), C(SP, 2, xs[1], 8), C(KR, 1, xs[2], 8));
      const a = C(HE, 1, 10, 52), hid = C(KA, 9, 42, 48, false), two = C(HE, 2, 42, 58), three = C(HE, 3, 74, 52);
      box.append(a, hid, two, three);
      const start = [[a, 10, 52], [two, 42, 58], [three, 74, 52]];
      return api.loop(async () => {
        start.forEach(([el, x, y]) => jump(el, x, y, 2));
        slots[0].classList.remove('done');
        await api.sleep(350);
        let z = 10;
        for (const [el] of start) {
          await api.finger.tap(el, 480);
          slide(el, xs[0], 8, 400, z++);
          await api.sleep(400);
          burst(box, el);
          await api.sleep(150);
        }
        api.finger.hide();
        slots[0].classList.add('done');
        await api.sleep(1400);
      }, 300);
    },
  };

  const helpers = {
    title: 'Tipp und Zurück',
    text: 'Tipp zeigt einen guten Zug, und Zurück geht so oft du willst.',
    demo(stage, api) {
      const box = scene(stage);
      const c = C(SP, 9, 16, 12);
      const target = C(KA, 10, 62, 8);
      box.append(target, c);
      const bar = h('div.tut-tools');
      const mk = (ic, label) => { const b = h('span.tut-tool', { html: icon(ic, { size: 18 }) }); b.append(label); bar.append(b); return b; };
      const hintB = mk('hint', 'Tipp');
      const undoB = mk('undo', 'Zurück');
      box.append(bar);
      return api.loop(async () => {
        c.classList.remove('glow'); target.classList.remove('glow'); jump(c, 16, 12, 2);
        await api.sleep(300);
        await api.finger.tap(hintB, 500);
        c.classList.add('glow'); target.classList.add('glow');
        await api.sleep(900);
        await api.finger.tap(c, 450);
        c.classList.remove('glow'); target.classList.remove('glow');
        slide(c, 62, 18, 380, 3);
        await api.sleep(800);
        await api.finger.tap(undoB, 500);
        slide(c, 16, 12, 380, 3);
        await api.sleep(1000);
        api.finger.hide();
      }, 300);
    },
  };

  const variants = {
    title: 'Drei Spielarten',
    text: 'Klondike, Spider oder FreeCell – dazu jeden Tag drei Tagesrätsel.',
    demo(stage, api) {
      const box = scene(stage, '.small');
      const seg = h('div.tut-seg');
      const names = ['Klondike', 'Spider', 'FreeCell'];
      const tabs = names.map((n) => { const t = h('span', null, n); seg.append(t); return t; });
      box.append(seg);
      const views = [h('div.tut-view'), h('div.tut-view'), h('div.tut-view')];
      // Klondike: Talon + Spalten mit verdeckten Karten
      const xs = [6, 25, 44, 63, 82];
      views[0].append(card(-1, 6, 24, false), C(KA, 5, 25, 24));
      [[KR, 13], [HE, 6], [SP, 11], [KA, 8]].forEach(([s, r], i) => {
        for (let k = 0; k <= i; k++) views[0].append(card(-1, xs[i + 1], 50 + k * 4, false));
        views[0].append(C(s, r, xs[i + 1], 50 + (i + 1) * 4));
      });
      // Spider: lange Pik-Folgen
      [0, 1, 2, 3, 4].forEach((i) => {
        const top = 13 - i;
        for (let k = 0; k < 5 - (i % 2); k++) views[1].append(C(SP, top - k, xs[i], 24 + k * 9));
      });
      // FreeCell: vier Zellen, alles offen
      [6, 25, 44, 63].forEach((x, i) => views[2].append(h('div.tut-slot.cell', { style: { left: x + '%', top: '24%' } })));
      views[2].append(C(HE, 4, 25, 24));
      [[[SP, 9], [HE, 8], [KR, 7]], [[KA, 12], [KR, 11]], [[HE, 13], [SP, 12], [KA, 11], [SP, 10]], [[KR, 6], [KA, 5]], [[SP, 3], [HE, 2]]]
        .forEach((col, i) => col.forEach(([s, r], k) => views[2].append(C(s, r, xs[i], 50 + k * 7))));
      box.append(...views);
      const show = (i) => {
        tabs.forEach((t, k) => t.classList.toggle('on', k === i));
        views.forEach((v, k) => v.classList.toggle('on', k === i));
      };
      show(0);
      return api.loop(async () => {
        for (let i = 0; i < 3; i++) {
          await api.finger.tap(tabs[i], 520);
          show(i);
          await api.sleep(1100);
        }
        api.finger.hide();
        await api.sleep(300);
      }, 200);
    },
  };

  // ---------------------------------------------------------------- Spider

  const spiderRun = {
    title: 'Gleiche Farbe ziehen',
    text: 'Gleichfarbige Folgen ziehst du gemeinsam auf eine höhere Karte.',
    demo(stage, api) {
      const box = scene(stage);
      const n9 = C(SP, 9, 10, 14);
      const hB = C(SP, 12, 42, 10, false), b8 = C(SP, 8, 42, 20), b7 = C(SP, 7, 42, 31);
      const hC = C(SP, 5, 74, 10, false), c4 = C(SP, 4, 74, 20);
      box.append(n9, hB, b8, b7, hC, c4);
      const g8 = ghost(box, 10, 25);
      return api.loop(async () => {
        jump(b8, 42, 20, 2); jump(b7, 42, 31, 3);
        hB.classList.remove('up');
        await api.sleep(350);
        const d = api.finger.drag([b8, g8], 700);
        await api.sleep(650);
        b8.classList.add('lifted'); b7.classList.add('lifted');
        slide(b8, 10, 25, 700, 4); slide(b7, 10, 36, 700, 5);
        await d;
        b8.classList.remove('lifted'); b7.classList.remove('lifted');
        flipUp(hB);
        await api.sleep(1400);
        api.finger.hide();
      }, 300);
    },
  };

  const spiderComplete = {
    title: 'König bis Ass',
    text: 'Eine volle Folge vom König bis zum Ass räumt sich von selbst ab.',
    demo(stage, api) {
      const box = scene(stage, '.small');
      const f = slot(box, 80, 6, '');
      const run = [];
      for (let r = 13; r >= 2; r--) run.push(C(SP, r, 10, 4 + (13 - r) * 5.4));
      const ace = C(SP, 1, 46, 30);
      box.append(...run, ace);
      const gA = ghost(box, 10, 4 + 12 * 5.4);
      const all = [...run, ace];
      const pill = h('div.tut-pill', null, 'Folge komplett!');
      box.append(pill);
      return api.loop(async () => {
        run.forEach((el, k) => jump(el, 10, 4 + k * 5.4, 2 + k));
        jump(ace, 46, 30, 2);
        pill.classList.remove('show');
        await api.sleep(400);
        const d = api.finger.drag([ace, gA], 650);
        await api.sleep(650);
        slide(ace, 10, 4 + 12 * 5.4, 650, 20);
        await d;
        api.finger.hide();
        await api.sleep(250);
        for (let k = all.length - 1; k >= 0; k--) {
          slide(all[k], 80, 6, 320, 40 + (all.length - k));
          await api.sleep(55);
        }
        await api.sleep(300);
        burst(box, f);
        pill.classList.add('show');
        await api.sleep(1500);
      }, 300);
    },
  };

  const spiderDeal = {
    title: 'Neue Karten geben',
    text: 'Tippe den Stapel, und jede Spalte bekommt eine neue Karte.',
    demo(stage, api) {
      const box = scene(stage, '.small');
      const xs = [4, 23, 42, 61, 80];
      const stock = [card(-1, 80, 6, false), card(-1, 81.5, 6, false), card(-1, 83, 6, false)];
      box.append(...stock);
      const tops = [[SP, 10], [SP, 6], [SP, 13], [SP, 3], [SP, 8]];
      xs.forEach((x, i) => { box.append(card(-1, x, 40, false), C(tops[i][0], tops[i][1], x, 47)); });
      const fresh = [[SP, 9], [SP, 2], [SP, 12], [SP, 7], [SP, 5]].map(([s, r]) => C(s, r, 83, 6, false));
      box.append(...fresh);
      return api.loop(async () => {
        fresh.forEach((el) => { el.classList.remove('up'); jump(el, 83, 6, 1); el.style.opacity = '0'; });
        await api.sleep(350);
        fresh.forEach((el) => { el.style.opacity = ''; });
        await api.finger.tap(stock[2], 520);
        for (let i = 0; i < fresh.length; i++) {
          slide(fresh[i], xs[i], 57, 380, 10 + i);
          setTimeout(() => flipUp(fresh[i]), 200);
          await api.sleep(90);
        }
        await api.sleep(700);
        api.finger.hide();
        await api.sleep(900);
      }, 300);
    },
  };

  // ---------------------------------------------------------------- FreeCell

  const fcOpen = {
    title: 'Alles liegt offen',
    text: 'Lege absteigend Rot auf Schwarz – jede Karte ist von Anfang an sichtbar.',
    demo(stage, api) {
      const box = scene(stage);
      const s6 = C(SP, 6, 10, 14);
      const bQ = C(KR, 12, 42, 14), h5 = C(HE, 5, 42, 25);
      const cK = C(KA, 13, 74, 14), k4 = C(KR, 4, 74, 25);
      box.append(s6, bQ, h5, cK, k4);
      const g4 = ghost(box, 10, 36);
      return api.loop(async () => {
        jump(h5, 42, 25, 2); jump(k4, 74, 25, 2);
        await api.sleep(350);
        await api.finger.tap(h5);
        slide(h5, 10, 25, 380, 3);
        await api.sleep(700);
        const d = api.finger.drag([k4, g4], 650);
        await api.sleep(650);
        k4.classList.add('lifted');
        slide(k4, 10, 36, 650, 4);
        await d;
        k4.classList.remove('lifted');
        await api.sleep(1300);
        api.finger.hide();
      }, 300);
    },
  };

  const fcCells = {
    title: 'Vier freie Zellen',
    text: 'Parke einzelne Karten oben links, um darunterliegende freizulegen.',
    demo(stage, api) {
      const box = scene(stage);
      const xs = [7, 29, 51, 73];
      const cells = xs.map((x) => { const s = slot(box, x, 8); s.classList.add('cell'); return s; });
      const ace = C(KA, 1, 40, 46), nine = C(KR, 9, 40, 57);
      box.append(C(SP, 7, 7, 8), ace, nine);
      return api.loop(async () => {
        jump(nine, 40, 57, 3);
        ace.classList.remove('glow');
        cells[1].classList.remove('pulse');
        await api.sleep(350);
        cells[1].classList.add('pulse');
        const d = api.finger.drag([nine, cells[1]], 650);
        await api.sleep(650);
        nine.classList.add('lifted');
        slide(nine, xs[1], 8, 650, 5);
        await d;
        nine.classList.remove('lifted');
        cells[1].classList.remove('pulse');
        await api.sleep(250);
        ace.classList.add('glow');
        api.finger.hide();
        await api.sleep(1500);
      }, 300);
    },
  };

  if (family === 'spider') return { id: 'solitaire-spider', title: 'Spider', steps: [spiderRun, spiderComplete, spiderDeal, helpers] };
  if (family === 'freecell') return { id: 'solitaire-freecell', title: 'FreeCell', steps: [fcOpen, fcCells, aceToKing, helpers] };
  return { id: 'solitaire', title: 'Solitär', steps: [redOnBlack, aceToKing, helpers, variants] };
}
