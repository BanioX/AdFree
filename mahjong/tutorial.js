// Mahjong – «So geht's»: vier kurze Schritte mit animierten Mini-Demos (gemeinsames Tutorial-Modul).

import { h, icon } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { tilesetById } from './data/tilesets.js';
import { BoardView } from './board.js';

const TW = 52; // Steinbreite in der Demo (CSS px)

/** Ein Demo-Stein: Wrapper (Position in % der Bühne) mit gezeichnetem Stein. */
function demoTile(stage, setId, face, x, y, z = 0) {
  const c = BoardView.tileImage(setId, face, TW);
  const el = h('div.td-tile', { style: { left: x + '%', top: y + '%', zIndex: String(10 + z) } }, c);
  stage.append(el);
  return el;
}

function reset(list) {
  for (const t of list) t.classList.remove('sel', 'gone', 'shake', 'hint', 'dim');
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
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
        const t = [demoTile(stage, setId, A, 22, 50), demoTile(stage, setId, B, 50, 50), demoTile(stage, setId, A, 78, 50)];
        return api.loop(async () => {
          reset(t);
          await api.sleep(400);
          await api.finger.tap(t[0]);
          t[0].classList.add('sel');
          await api.sleep(350);
          await api.finger.tap(t[2]);
          t[0].classList.add('gone'); t[2].classList.add('gone');
          await api.sleep(1100);
          api.finger.hide();
          await api.sleep(300);
        });
      },
    },
    {
      title: 'Brett abräumen',
      text: 'Räume alles ab – frei ist ein Stein mit Platz links oder rechts und nichts darauf.',
      demo(stage, api) {
        // Reihe aus drei Steinen: die mittlere ist eingeklemmt. Oben ein einzelner Partner.
        const row = [demoTile(stage, setId, A, 30, 64), demoTile(stage, setId, C, 50, 64), demoTile(stage, setId, A, 70, 64)];
        const solo = demoTile(stage, setId, C, 50, 27);
        const done = h('div.td-done', { html: icon('check', { size: 34, stroke: 3 }) });
        stage.append(done);
        const all = [...row, solo];
        return api.loop(async () => {
          reset(all);
          done.classList.remove('show');
          row[1].classList.add('dim');
          await api.sleep(400);
          await api.finger.tap(row[1]);
          shake(row[1]);
          sfx.play('thud');
          await api.sleep(500);
          await api.finger.tap(row[0]);
          row[0].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(row[2]);
          row[0].classList.add('gone'); row[2].classList.add('gone');
          row[1].classList.remove('dim');
          await api.sleep(500);
          await api.finger.tap(row[1]);
          row[1].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(solo);
          row[1].classList.add('gone'); solo.classList.add('gone');
          await api.sleep(300);
          done.classList.add('show');
          await api.sleep(1200);
          api.finger.hide();
          await api.sleep(300);
        });
      },
    },
    {
      title: `${groupName} & Co.`,
      text: 'Steine mit farbigem Rand passen zu jedem Stein ihrer Gruppe.',
      demo(stage, api) {
        const t = [demoTile(stage, setId, 34, 30, 50), demoTile(stage, setId, 36, 70, 50)];
        return api.loop(async () => {
          reset(t);
          await api.sleep(400);
          await api.finger.tap(t[0]);
          t[0].classList.add('sel');
          await api.sleep(350);
          await api.finger.tap(t[1]);
          t[0].classList.add('gone'); t[1].classList.add('gone');
          await api.sleep(1100);
          api.finger.hide();
          await api.sleep(300);
        });
      },
    },
    {
      title: 'Hilfe ist gratis',
      text: 'Tipp, Mischen und Zurück kosten nichts. Ohne Hilfe gibt es ★★★.',
      demo(stage, api) {
        const t = [demoTile(stage, setId, B, 24, 36), demoTile(stage, setId, A, 50, 36), demoTile(stage, setId, B, 76, 36)];
        const tools = h('div.td-tools', null,
          h('span', { html: icon('undo', { size: 22 }) }),
          h('span.hint', { html: icon('hint', { size: 22 }) }),
          h('span.shuffle', { html: icon('shuffle', { size: 22 }) }));
        stage.append(tools);
        const hintBtn = tools.children[1];
        return api.loop(async () => {
          reset(t);
          await api.sleep(400);
          await api.finger.tap(hintBtn);
          t[0].classList.add('hint'); t[2].classList.add('hint');
          await api.sleep(900);
          await api.finger.tap(t[0]);
          t[0].classList.remove('hint'); t[0].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(t[2]);
          t[0].classList.add('gone'); t[2].classList.add('gone');
          await api.sleep(1000);
          api.finger.hide();
          await api.sleep(300);
        });
      },
    },
  ];
}

