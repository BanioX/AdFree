// Bäckerdutzend – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { cardCode } from '../lib/cards/deck.js';
import { suitSVG } from '../lib/cards/face.js';
import { tutStage, moveMini } from '../lib/cards/shell.js';
import { pile, home, tslot, tool, label, peek, STEP } from '../lib/cards/tutkit.js';

const C = cardCode; // (Farbe, Wert): 0 Pik, 1 Herz, 2 Kreuz, 3 Karo

export const tutorialSteps = [
  {
    title: 'Eins tiefer legen',
    text: 'Lege die oberste Karte eines Stapels auf eine Karte, die eins höher ist – die Farbe ist egal.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 40, 10, [C(3, 11), C(0, 4), C(2, 7)]);
      const b = pile(scene, 125, 10, [C(1, 12), C(3, 3), C(1, 8)]);
      const c = pile(scene, 210, 10, [C(0, 13), C(2, 10), C(0, 6)]);
      const l = label(scene, '7 auf 8, dann 6 auf 7');
      return api.loop(async () => {
        await api.finger.tap(peek(stage, a[2], 0.4));
        moveMini(a[2], 125, 10 + 3 * STEP); a[2].style.zIndex = 40;
        await api.sleep(500);
        await api.finger.tap(peek(stage, c[2], 0.4));
        moveMini(c[2], 125, 10 + 4 * STEP); c[2].style.zIndex = 41;
        l.show();
        api.finger.hide();
        await api.sleep(1700);
        l.hide();
        home([...a, ...b, ...c]);
        await api.sleep(600);
      }, 300);
    },
  },
  {
    title: 'Ablegen',
    text: 'Ziel: alle Karten nach Farbe sortiert von Ass bis König auf die Ablage oben.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      [0, 1, 2, 3].forEach((s) => tslot(scene, 64 + s * 58, 6, suitSVG(s), true));
      const a = pile(scene, 64, 92, [C(2, 9), C(3, 2), C(3, 1)]);
      const b = pile(scene, 180, 92, [C(0, 12), C(3, 3)]);
      const l = label(scene, 'Ass, 2, 3 … bis zum König');
      return api.loop(async () => {
        for (const [el, z] of [[a[2], 60], [a[1], 61], [b[1], 62]]) {
          await api.finger.tap(peek(stage, el, 0.5));
          moveMini(el, 238, 6); el.style.zIndex = z;
          await api.sleep(420);
        }
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
    title: 'Könige zuunterst',
    text: 'Beim Austeilen rutschen Könige nach unten – leere Stapel bleiben im klassischen Spiel leer.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const p = pile(scene, 70, 14, [C(3, 5), C(1, 9), C(0, 13), C(2, 2)]);
      tslot(scene, 180, 14, '<span style="font-size:12px">leer</span>');
      const l = label(scene, 'König rutscht nach unten');
      return api.loop(async () => {
        api.finger.hide();
        await api.sleep(500);
        // König zuunterst, die anderen rücken nach
        moveMini(p[2], 70, 14); p[2].style.zIndex = 9;
        moveMini(p[0], 70, 14 + STEP);
        moveMini(p[1], 70, 14 + 2 * STEP);
        l.show();
        await api.sleep(2000);
        l.hide();
        home(p);
        await api.sleep(700);
      }, 300);
    },
  },
  {
    title: 'Hilfen',
    text: 'Tipp zeigt einen guten Zug, Zurück nimmt Züge zurück – gratis und so oft du willst.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 200 });
      const a = pile(scene, 40, 8, [C(3, 9), C(1, 6)]);
      const b = pile(scene, 120, 8, [C(2, 7)]);
      const tH = tool(scene, 210, 22, 'hint', 'Tipp');
      const tU = tool(scene, 210, 92, 'undo', 'Zurück');
      return api.loop(async () => {
        await api.finger.tap(tH);
        tH.classList.add('press'); setTimeout(() => tH.classList.remove('press'), 160);
        b[0].classList.add('hint'); a[1].classList.add('hint');
        await api.sleep(900);
        b[0].classList.remove('hint'); a[1].classList.remove('hint');
        await api.finger.tap(peek(stage, a[1], 0.4));
        moveMini(a[1], 120, 8 + STEP); a[1].style.zIndex = 40;
        await api.sleep(800);
        await api.finger.tap(tU);
        tU.classList.add('press'); setTimeout(() => tU.classList.remove('press'), 160);
        home(a);
        api.finger.hide();
        await api.sleep(900);
      }, 300);
    },
  },
];
