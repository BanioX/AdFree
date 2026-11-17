// Gipfel – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { h } from '../shared/ui.js';
import { cardCode } from '../lib/cards/deck.js';
import { miniCard, moveMini, tutStage } from '../lib/cards/shell.js';

const C = (s, r) => cardCode(s, r);

function label(scene, text) {
  const l = h('div.pc-label.off', null, text);
  scene.parentNode.append(l);
  return l;
}
function plus(scene, text, x, y) {
  const el = h('div.pc-float', { style: { left: x + 'px', top: y + 'px', fontSize: '17px' } }, text);
  scene.append(el);
  setTimeout(() => el.remove(), 1000);
}
const remember = (els) => els.forEach((e) => { e._ox = e._x; e._oy = e._y; e._oz = e.style.zIndex; });
const reset = (els) => els.forEach((e) => { e.classList.remove('gone'); moveMini(e, e._ox, e._oy, 0); e.style.zIndex = e._oz; });

export const tutorialSteps = [
  {
    title: 'Eins höher oder tiefer',
    text: 'Tippe eine freie Karte, die im Wert direkt an die Ablage passt.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 170 });
      const back1 = miniCard(C(0, 5), { x: 98, y: 4, up: false });
      const back2 = miniCard(C(1, 5), { x: 152, y: 4, up: false });
      const row = [C(1, 8), C(2, 2), C(3, 9)].map((c, i) => miniCard(c, { x: 72 + i * 54, y: 30 }));
      const waste = miniCard(C(0, 7), { x: 125, y: 100 });
      [back1, back2, ...row].forEach((e, i) => { e.style.zIndex = 10 + i; scene.append(e); });
      waste.style.zIndex = 5; scene.append(waste);
      remember([...row, waste]);
      const l = label(scene, '7 → 8 → 9');
      return api.loop(async () => {
        await api.finger.tap(row[0]);
        row[0].style.zIndex = 40; moveMini(row[0], 125, 100);
        await api.sleep(450);
        await api.finger.tap(row[2]);
        row[2].style.zIndex = 41; moveMini(row[2], 125, 100);
        l.classList.remove('off');
        api.finger.hide();
        await api.sleep(1500);
        l.classList.add('off');
        reset(row);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Serie & Punkte',
    text: 'Je länger deine Serie ohne Talon, desto mehr Punkte bringt jede Karte.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 170 });
      const row = [C(2, 5), C(1, 6), C(0, 7), C(3, 8)].map((c, i) => miniCard(c, { x: 46 + i * 54, y: 18 }));
      const waste = miniCard(C(2, 4), { x: 125, y: 100 });
      waste.style.zIndex = 5; scene.append(waste);
      row.forEach((e, i) => { e.style.zIndex = 10 + i; scene.append(e); });
      remember(row);
      return api.loop(async () => {
        for (let i = 0; i < row.length; i++) {
          await api.finger.tap(row[i], 420);
          row[i].style.zIndex = 40 + i; moveMini(row[i], 125, 100);
          plus(scene, `+${(i + 1) * 10}`, 150, 92);
          await api.sleep(260);
        }
        api.finger.hide();
        await api.sleep(1300);
        reset(row);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Talon',
    text: 'Nichts passt? Tippe auf den Talon – das gibt eine neue Ablagekarte.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 150 });
      const stock = [C(0, 2), C(1, 11), C(3, 4), C(2, 12)].map((c, i) => miniCard(c, { x: 30 + i * 9, y: 40, up: false }));
      stock.forEach((e, i) => { e.style.zIndex = 10 + i; scene.append(e); });
      const waste = miniCard(C(1, 3), { x: 150, y: 40 });
      waste.style.zIndex = 5; scene.append(waste);
      remember(stock);
      const l = label(scene, 'Leicht: König ↔ Ass passt auch');
      return api.loop(async () => {
        await api.finger.tap(stock[3]);
        stock[3].style.zIndex = 40; moveMini(stock[3], 150, 40);
        setTimeout(() => stock[3].classList.add('up'), 170);
        await api.sleep(500);
        await api.finger.tap(stock[2]);
        stock[2].style.zIndex = 41; moveMini(stock[2], 150, 40);
        setTimeout(() => stock[2].classList.add('up'), 170);
        l.classList.remove('off');
        api.finger.hide();
        await api.sleep(1600);
        l.classList.add('off');
        stock.forEach((e) => e.classList.remove('up'));
        reset(stock);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Ziel',
    text: 'Räume alle drei Gipfel ab – jeder Gipfel bringt einen Bonus.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 160 });
      const els = [];
      const codes = [C(0, 13), C(1, 1), C(2, 12), C(3, 2), C(0, 11), C(1, 3), C(2, 10), C(3, 4), C(0, 9)];
      // drei Mini-Gipfel: je 1 Spitze + 2 darunter
      for (let p = 0; p < 3; p++) {
        const cx = 50 + p * 100;
        const top = miniCard(codes[p * 3], { x: cx - 25, y: 10, up: false });
        const l = miniCard(codes[p * 3 + 1], { x: cx - 45, y: 46 });
        const r = miniCard(codes[p * 3 + 2], { x: cx - 5, y: 46 });
        top.style.zIndex = 10; l.style.zIndex = 20; r.style.zIndex = 21;
        scene.append(top, l, r);
        els.push([top, l, r]);
      }
      remember(els.flat());
      const lab = label(scene, '+150  +150  +300');
      return api.loop(async () => {
        api.finger.hide();
        await api.sleep(400);
        for (const [top, l, r] of els) {
          for (const c of [l, r]) { c.style.zIndex = 50; moveMini(c, 125, 112); await api.sleep(240); }
          top.classList.add('up');
          await api.sleep(300);
          top.style.zIndex = 51; moveMini(top, 125, 112);
          await api.sleep(320);
        }
        lab.classList.remove('off');
        await api.sleep(1500);
        lab.classList.add('off');
        els.forEach(([t]) => t.classList.remove('up'));
        reset(els.flat());
        await api.sleep(600);
      }, 200);
    },
  },
];
