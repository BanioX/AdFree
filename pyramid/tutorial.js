// Pyramide – «So geht's» (4 Schritte mit animierten Mini-Szenen).
import { h } from '../shared/ui.js';
import { cardCode } from '../lib/cards/deck.js';
import { miniCard, moveMini, tutStage } from '../lib/cards/shell.js';

const C = (s, r) => cardCode(s, r);
const CW = 50, GAP = 4, STEP = 36;
const px = (r, c, cx = 150) => cx - ((r + 1) * CW + r * GAP) / 2 + c * (CW + GAP);

function label(scene, text) {
  const l = h('div.pc-label.off', null, text);
  scene.parentNode.append(l);
  return l;
}

/** kleine Pyramide (3 Reihen) */
function miniPyramid(scene, codes, cx = 150, y0 = 12) {
  const els = [];
  let k = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c <= r; c++) {
      const el = miniCard(codes[k++], { x: px(r, c, cx), y: y0 + r * STEP });
      el.style.zIndex = 10 + r * 5 + c;
      scene.append(el);
      els.push(el);
    }
  }
  return els;
}

const flyAway = (el, x = 250, y = -110) => { moveMini(el, x, y, 18); el.classList.add('gone'); };
const reset = (el) => { el.classList.remove('gone', 'sel'); moveMini(el, el._ox, el._oy, 0); };
const remember = (els) => els.forEach((e) => { e._ox = e._x; e._oy = e._y; });

export const tutorialSteps = [
  {
    title: 'Summe 13',
    text: 'Tippe zwei freie Karten an, die zusammen 13 ergeben – sie verschwinden.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 160 });
      const els = miniPyramid(scene, [C(2, 9), C(0, 4), C(3, 12), C(1, 8), C(0, 6), C(3, 7)]);
      remember(els);
      els.slice(0, 3).forEach((e) => e.classList.add('dim'));
      const six = els[4], seven = els[5];
      const l = label(scene, '6 + 7 = 13');
      return api.loop(async () => {
        await api.finger.tap(six);
        six.classList.add('sel');
        await api.sleep(250);
        await api.finger.tap(seven);
        seven.classList.add('sel');
        l.classList.remove('off');
        await api.sleep(250);
        flyAway(six, 240, -90); flyAway(seven, 260, -90);
        els[2].classList.remove('dim');
        api.finger.hide();
        await api.sleep(1500);
        l.classList.add('off');
        [six, seven].forEach(reset);
        els[2].classList.add('dim');
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Werte & König',
    text: 'Ass zählt 1, Bube 11, Dame 12. Ein König ist schon 13 und geht allein.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 150 });
      const cards = [C(1, 1), C(0, 11), C(3, 12), C(2, 13)];
      const vals = ['1', '11', '12', '13'];
      const els = cards.map((c, i) => {
        const el = miniCard(c, { x: 26 + i * 64, y: 18 });
        scene.append(el);
        scene.append(h('div', { style: { position: 'absolute', left: (26 + i * 64) + 'px', top: '96px', width: '50px', textAlign: 'center', font: '900 17px/1 var(--font)', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)' } }, vals[i]));
        return el;
      });
      remember(els);
      const king = els[3];
      return api.loop(async () => {
        await api.sleep(500);
        await api.finger.tap(king);
        flyAway(king, 230, -120);
        api.finger.hide();
        await api.sleep(1400);
        reset(king);
        await api.sleep(600);
      }, 200);
    },
  },
  {
    title: 'Talon & Ablage',
    text: 'Tippe auf den Talon für eine neue Karte. Die oberste Ablagekarte spielt mit.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 150 });
      const s1 = miniCard(C(2, 3), { x: 20, y: 40, up: false });
      const s2 = miniCard(C(1, 4), { x: 22, y: 38, up: false });
      const pyr = miniCard(C(0, 9), { x: 210, y: 40 });
      const w0 = miniCard(C(3, 6), { x: 100, y: 40 });
      [s1, w0, s2, pyr].forEach((e, i) => { e.style.zIndex = 10 + i; scene.append(e); });
      remember([s1, s2, pyr, w0]);
      const l = label(scene, '4 + 9 = 13');
      return api.loop(async () => {
        await api.finger.tap(s2);
        moveMini(s2, 102, 38);
        s2.style.zIndex = 30;
        setTimeout(() => s2.classList.add('up'), 180);
        await api.sleep(650);
        await api.finger.tap(s2);
        s2.classList.add('sel');
        await api.finger.tap(pyr);
        pyr.classList.add('sel');
        l.classList.remove('off');
        await api.sleep(250);
        flyAway(s2, 240, -110); flyAway(pyr, 260, -110);
        api.finger.hide();
        await api.sleep(1500);
        l.classList.add('off');
        s2.classList.remove('up');
        s2.style.zIndex = 12;
        [s2, pyr].forEach(reset);
        await api.sleep(500);
      }, 300);
    },
  },
  {
    title: 'Ziel',
    text: 'Räume die ganze Pyramide ab. Tipp und Zurück helfen jederzeit – gratis.',
    demo(stage, api) {
      const { scene } = tutStage(stage, { w: 300, hgt: 160 });
      const codes = [C(2, 13), C(0, 5), C(3, 8), C(1, 3), C(0, 12), C(2, 10)];
      const els = miniPyramid(scene, codes);
      remember(els);
      const l = label(scene, 'Geschafft!');
      const order = [[3, 5], [4], [1, 2], [0]];
      return api.loop(async () => {
        api.finger.hide();
        await api.sleep(500);
        for (const grp of order) {
          grp.forEach((i, k) => flyAway(els[i], 236 + k * 18, -100));
          await api.sleep(520);
        }
        l.classList.remove('off');
        await api.sleep(1300);
        l.classList.add('off');
        els.forEach(reset);
        await api.sleep(700);
      }, 200);
    },
  },
];
