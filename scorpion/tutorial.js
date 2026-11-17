// Skorpion – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { cardCode } from '../lib/cards/deck.js';
import { tutStage, moveMini, miniCard } from '../lib/cards/shell.js';
import { pile, home, moveGroup, flip, tslot, tool, label, peek, STEP } from '../lib/cards/tutkit.js';

const C = cardCode; // (Farbe, Wert): 0 Pik, 1 Herz, 2 Kreuz, 3 Karo

/** Krone für die Ablage-Plätze (fertige Reihen). */
export const CROWN = '<svg class="sc-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5l4.6 3.6L12 5l4.4 7.1L21 8.5l-1.8 9.5H4.8z" fill="currentColor"/><rect x="4.8" y="19" width="14.4" height="2.2" rx="1" fill="currentColor"/></svg>';

export const tutorialSteps = [
  {
    title: 'Farbreihen bauen',
    text: 'Lege eine offene Karte samt allem darüber auf die Karte gleicher Farbe, die eins höher ist.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 50, 8, [C(2, 4), C(0, 6), C(1, 8), C(2, 3), C(0, 11)], { down: 2 });
      const b = pile(scene, 190, 8, [C(3, 2), C(1, 9)], { down: 1 });
      const l = label(scene, 'Herz 8 auf Herz 9');
      return api.loop(async () => {
        await api.finger.tap(peek(stage, a[2]));
        moveGroup(a.slice(2), 190, 8 + 9 + STEP);
        await api.sleep(420);
        flip(a[1]);
        l.show();
        api.finger.hide();
        await api.sleep(1700);
        l.hide();
        home([...a, ...b]);
        await api.sleep(600);
      }, 300);
    },
  },
  {
    title: 'König bis Ass',
    text: 'Liegt eine Farbe komplett vom König bis zum Ass, wird die Reihe abgeräumt.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 210 });
      const slot = tslot(scene, 222, 6, CROWN, true);
      const run = pile(scene, 30, 6, Array.from({ length: 12 }, (_, i) => C(0, 13 - i)), { step: 10 });
      const ace = pile(scene, 130, 40, [C(3, 9), C(0, 1)]);
      const l = label(scene, 'Reihe komplett!');
      void slot;
      return api.loop(async () => {
        await api.finger.tap(peek(stage, ace[1], 0.4));
        moveMini(ace[1], 30, 6 + 12 * 10);
        ace[1].style.zIndex = 30;
        await api.sleep(500);
        api.finger.hide();
        l.show();
        const all = [...run, ace[1]];
        for (let i = all.length - 1; i >= 0; i--) {
          moveMini(all[i], 222, 6);
          all[i].style.zIndex = 60 + (all.length - i);
          await api.sleep(55);
        }
        await api.sleep(1500);
        l.hide();
        home([...run, ...ace]);
        await api.sleep(700);
      }, 300);
    },
  },
  {
    title: 'Reserve',
    text: 'Die drei Reservekarten teilst du einmal aus – in leere Spalten passen nur Könige.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const cols = [
        pile(scene, 80, 8, [C(1, 5), C(2, 9)]),
        pile(scene, 140, 8, [C(3, 12), C(0, 4)]),
        pile(scene, 200, 8, [C(2, 7), C(1, 2)]),
      ];
      tslot(scene, 14, 8, '<span style="font-size:11px">Reserve</span>', true).style.zIndex = 1;
      const res = [C(0, 8), C(1, 10), C(3, 6)].map((code, i) => {
        const el = miniCard(code, { x: 14 + i * 3, y: 8 - i, up: false });
        el.style.zIndex = 20 + i;
        el._home = { x: 14 + i * 3, y: 8 - i, z: 20 + i, up: false };
        scene.append(el);
        return el;
      });
      const l = label(scene, 'Je eine Karte auf die ersten Spalten');
      return api.loop(async () => {
        await api.finger.tap(res[2]);
        for (let i = 0; i < 3; i++) {
          const card = res[2 - i];
          moveMini(card, 80 + i * 60, 8 + 2 * STEP);
          card.style.zIndex = 40 + i;
          flip(card);
          await api.sleep(150);
        }
        api.finger.hide();
        l.show();
        await api.sleep(1800);
        l.hide();
        home([...res, ...cols.flat()]);
        await api.sleep(600);
      }, 300);
    },
  },
  {
    title: 'Hilfen',
    text: 'Tipp zeigt einen guten Zug, Zurück nimmt Züge zurück – gratis und so oft du willst.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 40, 8, [C(1, 3), C(2, 6), C(0, 2)], { down: 1 });
      const b = pile(scene, 130, 8, [C(2, 7)]);
      const tH = tool(scene, 200, 22, 'hint', 'Tipp');
      const tU = tool(scene, 200, 92, 'undo', 'Zurück');
      return api.loop(async () => {
        await api.finger.tap(tH);
        tH.classList.add('press'); setTimeout(() => tH.classList.remove('press'), 160);
        b[0].classList.add('hint'); a[1].classList.add('hint');
        await api.sleep(900);
        b[0].classList.remove('hint'); a[1].classList.remove('hint');
        await api.finger.tap(peek(stage, a[1]));
        moveGroup(a.slice(1), 130, 8 + STEP);
        await api.sleep(420);
        flip(a[0]);
        await api.sleep(700);
        await api.finger.tap(tU);
        tU.classList.add('press'); setTimeout(() => tU.classList.remove('press'), 160);
        home(a);
        api.finger.hide();
        await api.sleep(900);
      }, 300);
    },
  },
];
