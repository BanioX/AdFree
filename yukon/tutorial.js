// Yukon – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { cardCode } from '../lib/cards/deck.js';
import { suitSVG } from '../lib/cards/face.js';
import { tutStage, moveMini } from '../lib/cards/shell.js';
import { pile, home, moveGroup, flip, tslot, tool, label, peek, STEP } from '../lib/cards/tutkit.js';

const C = cardCode; // (Farbe, Wert): 0 Pik, 1 Herz, 2 Kreuz, 3 Karo

export const tutorialSteps = [
  {
    title: 'Ganze Stapel ziehen',
    text: 'Jede offene Karte wandert mit allem darüber auf eine Karte eins höher in der anderen Farbe.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 50, 8, [C(2, 4), C(3, 7), C(1, 9), C(0, 5), C(2, 12)], { down: 2 });
      const b = pile(scene, 190, 8, [C(1, 3), C(0, 10)], { down: 1 });
      const l = label(scene, '9 auf 10 – mit allem darüber');
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
    title: 'Ablegen',
    text: 'Ziel: alle Karten nach Farbe sortiert von Ass bis König auf die Ablage oben.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const slots = [0, 1, 2, 3].map((s) => tslot(scene, 64 + s * 58, 6, suitSVG(s), true));
      const a = pile(scene, 64, 92, [C(0, 9), C(1, 2), C(1, 1)]);
      const b = pile(scene, 180, 92, [C(2, 6), C(1, 3)]);
      const l = label(scene, 'Ass, 2, 3 … bis zum König');
      void slots;
      return api.loop(async () => {
        await api.finger.tap(peek(stage, a[2], 0.5));
        moveMini(a[2], 122, 6); a[2].style.zIndex = 60;
        await api.sleep(450);
        await api.finger.tap(peek(stage, a[1], 0.5));
        moveMini(a[1], 122, 6); a[1].style.zIndex = 61;
        await api.sleep(450);
        await api.finger.tap(peek(stage, b[1], 0.5));
        moveMini(b[1], 122, 6); b[1].style.zIndex = 62;
        l.show();
        api.finger.hide();
        await api.sleep(1600);
        l.hide();
        home([...a, ...b]);
        await api.sleep(600);
      }, 300);
    },
  },
  {
    title: 'Leere Spalte',
    text: 'In eine leere Spalte darf nur ein König – zusammen mit allem, was auf ihm liegt.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      tslot(scene, 190, 8, 'K');
      const a = pile(scene, 60, 8, [C(3, 2), C(2, 8), C(0, 13), C(1, 12), C(2, 11)], { down: 2 });
      const l = label(scene, 'Nur Könige auf leere Plätze');
      return api.loop(async () => {
        await api.finger.drag([peek(stage, a[2]), { x: 70, y: 22 }], 800, () => {});
        moveGroup(a.slice(2), 190, 8);
        await api.sleep(420);
        flip(a[1]);
        l.show();
        api.finger.hide();
        await api.sleep(1700);
        l.hide();
        home(a);
        await api.sleep(600);
      }, 300);
    },
  },
  {
    title: 'Hilfen',
    text: 'Tipp zeigt einen guten Zug, Zurück nimmt Züge zurück – gratis und so oft du willst.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 40, 8, [C(3, 3), C(1, 6), C(0, 2)], { down: 1 });
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
