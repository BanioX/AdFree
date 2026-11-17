// Mahjong – «So geht's»: vier kurze Schritte mit animierten Mini-Demos (gemeinsames Tutorial-Modul).
// Die Demo-Steine sind echte Stein-Sprites aus board.js (gewählter Steinsatz), auf einem kleinen Spieltisch.

import { h, icon } from '../shared/ui.js';
import { tilesetById } from './data/tilesets.js';
import { BoardView } from './board.js';

const TW = 52; // Steinbreite in der Demo (CSS px)
const SPARK = ['#e7a923', '#c0573e', '#2f8a73', '#f48fb1', '#5b8def'];

/** Kleiner Spieltisch als Hintergrund der Bühne (gleicher Look wie das Spielfeld). */
function table(stage) {
  stage.append(h('div.td-table'));
}

/** Ein Demo-Stein: Wrapper (Position in % der Bühne) mit gezeichnetem Stein. */
function demoTile(stage, setId, face, x, y, z = 0) {
  const c = BoardView.tileImage(setId, face, TW);
  const el = h('div.td-tile', { style: { left: x + '%', top: y + '%', zIndex: String(10 + z) } }, c);
  el.dataset.x = String(x);
  el.dataset.y = String(y);
  stage.append(el);
  return el;
}

/** Alle Steine ohne Übergang an ihren Platz zurück. */
function reset(list) {
  for (const t of list) {
    t.classList.add('still');
    t.classList.remove('sel', 'gone', 'shake', 'hint', 'dim', 'fly');
    t.style.left = t.dataset.x + '%';
    t.style.top = t.dataset.y + '%';
  }
  if (list[0]) void list[0].offsetWidth;
  for (const t of list) t.classList.remove('still');
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/** Funken wie im Spiel: kleine Sterne fliegen auseinander. */
function sparkle(stage, x, y) {
  const s = h('div.td-spark', { style: { left: x + '%', top: y + '%' } });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + (k % 2) * 0.25;
    const d = 34 + (k % 3) * 12;
    const i = h('i');
    i.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
    i.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
    i.style.background = SPARK[k % SPARK.length];
    s.append(i);
  }
  stage.append(s);
  setTimeout(() => s.remove(), 900);
}

/** Zwei Steine fliegen zusammen und verschwinden mit Funken (wie im Spiel). */
async function matchPair(stage, api, a, b) {
  const ax = +a.dataset.x, bx = +b.dataset.x, ay = +a.dataset.y, by = +b.dataset.y;
  const mx = (ax + bx) / 2, my = (ay + by) / 2 - 7;
  const l = ax <= bx ? a : b, r = l === a ? b : a;
  for (const t of [a, b]) { t.classList.add('fly', 'sel'); t.style.top = my + '%'; }
  l.style.left = (mx - 8.5) + '%';
  r.style.left = (mx + 8.5) + '%';
  await api.sleep(340);
  a.classList.add('gone'); b.classList.add('gone');
  sparkle(stage, mx, my);
}

/** Faces passend zum Steinsatz: [Paarbild, anderes Bild, drittes Bild]. */
function demoFaces(set) {
  return set.kind === 'drawn' ? [4, 13, 31] : [3, 12, 27];
}

export function tutorialSteps(setId) {
  const set = tilesetById(setId);
  const [A, B, C] = demoFaces(set);
  const groupName = set.bonusNames ? set.bonusNames[0] : 'Blumen';
  return [
    {
      title: 'Paare antippen',
      text: 'Tippe zwei gleiche Steine an – schon sind sie weg.',
      demo(stage, api) {
        table(stage);
        const t = [demoTile(stage, setId, A, 22, 50), demoTile(stage, setId, B, 50, 50), demoTile(stage, setId, A, 78, 50)];
        return api.loop(async () => {
          reset(t);
          await api.sleep(450);
          await api.finger.tap(t[0]);
          t[0].classList.add('sel');
          await api.sleep(350);
          await api.finger.tap(t[2]);
          api.finger.hide();
          await matchPair(stage, api, t[0], t[2]);
          await api.sleep(1300);
        });
      },
    },
    {
      title: 'Brett abräumen',
      text: 'Frei ist ein Stein mit Platz links oder rechts und nichts darauf.',
      demo(stage, api) {
        table(stage);
        // Reihe aus drei Steinen: die mittlere ist eingeklemmt. Oben ein einzelner Partner.
        const row = [demoTile(stage, setId, A, 28, 66), demoTile(stage, setId, C, 50, 66), demoTile(stage, setId, A, 72, 66)];
        const solo = demoTile(stage, setId, C, 50, 26);
        const done = h('div.td-done', null,
          h('span.td-check', { html: icon('check', { size: 30, stroke: 3 }) }),
          h('span.td-stars', null, [0, 1, 2].map(() => h('i', { html: icon('star', { size: 22 }) }))));
        stage.append(done);
        const all = [...row, solo];
        return api.loop(async () => {
          reset(all);
          done.classList.remove('show');
          row[1].classList.add('dim');
          await api.sleep(450);
          await api.finger.tap(row[1]);
          shake(row[1]);
          await api.sleep(600);
          await api.finger.tap(row[0]);
          row[0].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(row[2]);
          await matchPair(stage, api, row[0], row[2]);
          row[1].classList.remove('dim');
          await api.sleep(450);
          await api.finger.tap(row[1]);
          row[1].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(solo);
          api.finger.hide();
          await matchPair(stage, api, row[1], solo);
          await api.sleep(250);
          done.classList.add('show');
          await api.sleep(1700);
        });
      },
    },
    {
      title: `${groupName} & Co.`,
      text: 'Steine mit farbigem Rand passen zu jedem Stein ihrer Gruppe.',
      demo(stage, api) {
        table(stage);
        const t = [demoTile(stage, setId, 34, 27, 50), demoTile(stage, setId, 36, 73, 50)];
        const eq = h('div.td-eq', null, '=');
        stage.append(eq);
        return api.loop(async () => {
          reset(t);
          eq.classList.remove('gone');
          await api.sleep(500);
          await api.finger.tap(t[0]);
          t[0].classList.add('sel');
          await api.sleep(350);
          await api.finger.tap(t[1]);
          api.finger.hide();
          eq.classList.add('gone');
          await matchPair(stage, api, t[0], t[1]);
          await api.sleep(1300);
        });
      },
    },
    {
      title: 'Hilfe ist gratis',
      text: 'Tipp, Mischen und Rückgängig kosten nichts – ohne Hilfe gibt’s ★★★.',
      demo(stage, api) {
        table(stage);
        const t = [demoTile(stage, setId, B, 24, 36), demoTile(stage, setId, A, 50, 36), demoTile(stage, setId, B, 76, 36)];
        const tools = h('div.td-tools', null,
          h('span', { html: icon('undo', { size: 22 }) }),
          h('span.hint', { html: icon('hint', { size: 22 }) }),
          h('span.shuffle', { html: icon('shuffle', { size: 22 }) }));
        stage.append(tools);
        const hintBtn = tools.children[1];
        return api.loop(async () => {
          reset(t);
          await api.sleep(450);
          await api.finger.tap(hintBtn);
          t[0].classList.add('hint'); t[2].classList.add('hint');
          await api.sleep(900);
          await api.finger.tap(t[0]);
          t[0].classList.remove('hint'); t[0].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(t[2]);
          api.finger.hide();
          t[2].classList.remove('hint');
          await matchPair(stage, api, t[0], t[2]);
          await api.sleep(1200);
        });
      },
    },
  ];
}
