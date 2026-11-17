// «So geht's»: 4 kurze Schritte mit animierten Mini-Szenen (DOM, kein Canvas).

import { h } from '../shared/ui.js';
import { COLORS } from './data/colors.js';

const C = (k) => COLORS[k].base;

/** Kleine Szene: Himmel, Wolkendecke, Blasen an Positionen in % der Bühne. */
function scene(stage) {
  const root = h('div.bzt', null, h('div.bzt-ceil'));
  stage.prepend(root);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  line.setAttribute('class', 'bzt-line');
  line.setAttribute('viewBox', '0 0 100 100');
  line.setAttribute('preserveAspectRatio', 'none');
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  ln.setAttribute('vector-effect', 'non-scaling-stroke');
  line.append(ln);
  line.style.opacity = '0';
  root.append(line);
  const api = {
    root,
    bubble(x, y, col, extra = '', cls = '') {
      const b = h('div.bzt-b' + (cls ? '.' + cls : ''), null, extra);
      b.style.setProperty('--c', col);
      b.style.left = x + '%';
      b.style.top = y + '%';
      root.append(b);
      return b;
    },
    move(b, x, y) { b.style.left = x + '%'; b.style.top = y + '%'; },
    aim(x1, y1, x2, y2) {
      ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
      ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
      line.style.opacity = '1';
    },
    hideAim() { line.style.opacity = '0'; },
    clear() { root.querySelectorAll('.bzt-b, .bzt-pet, .bzt-label').forEach((n) => n.remove()); api.hideAim(); },
  };
  return api;
}

// Wabenraster der Mini-Szene (in %): 9 Spalten
const gx = (r, c) => 10 + c * 10 + (r & 1 ? 5 : 0);
const gy = (r) => 15 + r * 9.5;

export const STEPS = [
  {
    title: 'Ziehen und zielen',
    text: 'Zieh den Finger über das Feld – die Punkte zeigen den Weg, auch über die Wand. Loslassen schiesst.',
    demo(stage, api) {
      const s = scene(stage);
      return api.loop(async () => {
        s.clear();
        const row0 = [1, 1, 5, 5, 3, 3, 4, 4, 1];
        row0.forEach((k, c) => s.bubble(gx(0, c), gy(0), C(k)));
        s.bubble(gx(1, 1), gy(1), C(5));
        s.bubble(gx(1, 5), gy(1), C(4));
        const shot = s.bubble(50, 86, C(4));
        const tx = gx(1, 6), ty = gy(1);
        await api.finger.drag([{ x: 50, y: 70 }, { x: 70, y: 52 }, { x: 74, y: 45 }], 1100, (i, p) => s.aim(50, 86, p.x + (p.x - 50) * 0.4, p.y + (p.y - 86) * 0.4));
        s.aim(50, 86, tx, ty);
        await api.sleep(250);
        s.hideAim();
        api.finger.hide();
        s.move(shot, tx, ty);
        await api.sleep(520);
        // Drei Grüne: platzen
        const greens = [...s.root.querySelectorAll('.bzt-b')].filter((b) => b.style.getPropertyValue('--c') === C(4));
        greens.forEach((b, i) => setTimeout(() => b.classList.add('pop'), i * 70));
        await api.sleep(1200);
      }, 300);
    },
  },
  {
    title: 'Drei gleiche platzen',
    text: 'Triff mindestens zwei gleichfarbige Blasen. Was dann nicht mehr hängt, fällt herunter.',
    demo(stage, api) {
      const s = scene(stage);
      return api.loop(async () => {
        s.clear();
        [3, 3, 6, 6, 2, 2, 6, 3, 3].forEach((k, c) => s.bubble(gx(0, c), gy(0), C(k)));
        const blues = [s.bubble(gx(1, 3), gy(1), C(5)), s.bubble(gx(1, 4), gy(1), C(5))];
        const hang = [s.bubble(gx(2, 3), gy(2), C(1)), s.bubble(gx(2, 4), gy(2), C(7)), s.bubble(gx(3, 3), gy(3), C(1)), s.bubble(gx(3, 4), gy(3), C(7))];
        const shot = s.bubble(50, 86, C(5));
        await api.finger.drag([{ x: 50, y: 74 }, { x: 34, y: 56 }, { x: 30, y: 50 }], 900, (i, p) => s.aim(50, 86, p.x, p.y));
        s.aim(50, 86, gx(2, 2), gy(2));
        await api.sleep(200);
        s.hideAim();
        api.finger.hide();
        s.move(shot, gx(2, 2), gy(2));
        await api.sleep(520);
        [shot, ...blues].forEach((b, i) => setTimeout(() => b.classList.add('pop'), i * 80));
        await api.sleep(380);
        hang.forEach((b, i) => setTimeout(() => b.classList.add('fall'), i * 60));
        await api.sleep(1300);
      }, 300);
    },
  },
  {
    title: 'Tierchen befreien',
    text: 'Manche Level verstecken Tierchen in Blasen. Wer mit wenigen Schüssen gewinnt, bekommt drei Sterne.',
    demo(stage, api) {
      const s = scene(stage);
      return api.loop(async () => {
        s.clear();
        [1, 1, 4, 4, 4, 7, 7, 5, 5].forEach((k, c) => s.bubble(gx(0, c), gy(0), C(k)));
        const pet = s.bubble(gx(1, 4), gy(1), C(7), '🐣');
        const pinks = [s.bubble(gx(1, 5), gy(1), C(7)), pet];
        const shot = s.bubble(50, 86, C(7));
        const label = h('div.bzt-label', null, '★ ★ ★');
        await api.finger.drag([{ x: 50, y: 74 }, { x: 52, y: 52 }, { x: 53, y: 44 }], 800, (i, p) => s.aim(50, 86, p.x, p.y));
        s.aim(50, 86, gx(2, 4), gy(2));
        await api.sleep(200);
        s.hideAim();
        api.finger.hide();
        s.move(shot, gx(2, 4), gy(2));
        await api.sleep(520);
        [shot, ...pinks].forEach((b, i) => setTimeout(() => b.classList.add('pop'), i * 80));
        const p = h('div.bzt-pet', null, '🐣');
        p.style.left = pet.style.left; p.style.top = pet.style.top;
        s.root.append(p);
        await api.sleep(60);
        p.style.top = '-15%';
        p.style.opacity = '0';
        await api.sleep(700);
        s.root.append(label);
        await api.sleep(1200);
      }, 300);
    },
  },
  {
    title: 'Tauschen und zaubern',
    text: 'Tippe auf den Werfer, um die Kugeln zu tauschen. Treffer in Folge schenken Bombe, Regenbogen und Feuerkugel.',
    demo(stage, api) {
      const s = scene(stage);
      return api.loop(async () => {
        s.clear();
        [6, 6, 2, 2, 5, 5, 1, 1, 3].forEach((k, c) => s.bubble(gx(0, c), gy(0), C(k)));
        const cur = s.bubble(50, 86, C(1));
        const nxt = s.bubble(36, 89, C(5), '', 'small');
        const sp = [s.bubble(70, 88, '#5b62a8', '💣', 'special'), s.bubble(82, 88, '#ffd23a', '🌈', 'special'), s.bubble(94, 88, '#ff8a3a', '🔥', 'special')];
        sp.forEach((b) => { b.classList.add('small'); });
        await api.finger.tap({ x: 50, y: 86 });
        s.move(cur, 36, 89); cur.classList.add('small');
        s.move(nxt, 50, 86); nxt.classList.remove('small');
        await api.sleep(700);
        await api.finger.tap({ x: 82, y: 88 });
        s.move(sp[1], 50, 86); sp[1].classList.remove('small');
        await api.sleep(450);
        api.finger.hide();
        s.move(sp[1], gx(1, 4), gy(1));
        await api.sleep(520);
        const near = [...s.root.querySelectorAll('.bzt-b')].filter((b) => parseFloat(b.style.top) < 20 && Math.abs(parseFloat(b.style.left) - gx(1, 4)) < 12);
        [sp[1], ...near].forEach((b, i) => setTimeout(() => b.classList.add('pop'), i * 70));
        await api.sleep(1300);
      }, 300);
    },
  },
];
