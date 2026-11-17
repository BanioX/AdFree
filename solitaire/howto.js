// «So geht's»: kurze Schritte mit animierten Mini-Demos für /shared/tutorial.js.
// Die Demos bauen kleine Kartenszenen aus echten Kartengesichtern (faceHTML).

import { h, icon } from '../shared/ui.js';
import { makeCode } from './logic/rules.js';
import { faceHTML } from './cardface.js';

/** Karte für die Demo-Bühne. x/y in % der Bühne (linke obere Ecke). */
function demoCard(code, x, y, opts = {}) {
  const el = h('div.mini-card.tut-card-el' + (opts.up === false ? '' : '.up'));
  el.innerHTML = (code >= 0 ? faceHTML(code, opts.face || {}) : '<div class="face"></div>') + '<div class="back"></div>';
  place(el, x, y);
  return el;
}
function place(el, x, y) { el.style.left = x + '%'; el.style.top = y + '%'; }
function slot(x, y, label = '') {
  const el = h('div.tut-slot', null, label);
  place(el, x, y);
  return el;
}

function scene(stage) {
  const box = h('div.tut-felt');
  stage.append(box);
  return box;
}

export function tutorialSteps(face = {}) {
  const C = (s, r, x, y, o = {}) => demoCard(makeCode(s, r), x, y, { ...o, face });
  return [
    {
      title: 'Antippen oder ziehen',
      text: 'Tippe eine Karte an – sie springt auf den besten Platz. Oder zieh sie mit dem Finger.',
      demo(stage, api) {
        const box = scene(stage);
        // zwei Spalten: links rote 8, rechts verdeckt + schwarze 7
        const b1 = demoCard(-1, 22, 14, { up: false });
        const r8 = C(1, 8, 22, 24);
        const b2 = demoCard(-1, 58, 14, { up: false });
        const b3 = C(3, 4, 58, 22, { up: false });
        const s7 = C(0, 7, 58, 32);
        box.append(b1, r8, b2, b3, s7);
        return api.loop(async () => {
          place(s7, 58, 32); s7.classList.remove('moving');
          b3.classList.remove('up');
          await api.sleep(400);
          await api.finger.tap(s7);
          s7.classList.add('moving');
          place(s7, 22, 36);
          await api.sleep(380);
          b3.classList.add('up', 'flip');
          await api.sleep(1300);
          api.finger.hide();
          b3.classList.remove('flip');
        }, 400);
      },
    },
    {
      title: 'Ass bis König',
      text: 'Sammle jede Farbe der Reihe nach auf der Ablage. Liegt alles offen, beendet «Automatisch beenden» die Partie.',
      demo(stage, api) {
        const box = scene(stage);
        const xs = [8, 30, 52, 74];
        xs.forEach((x, i) => box.append(slot(x, 10, 'A')));
        const cards = [C(1, 1, 30, 56), C(1, 2, 42, 60), C(1, 3, 54, 64)];
        box.append(...cards);
        return api.loop(async () => {
          cards.forEach((c, i) => { c.classList.remove('moving'); place(c, 30 + i * 12, 56 + i * 4); c.style.zIndex = 3 - i; });
          await api.sleep(500);
          for (let i = 0; i < cards.length; i++) {
            await api.finger.tap(cards[i], 450);
            cards[i].classList.add('moving');
            cards[i].style.zIndex = 10 + i;
            place(cards[i], 8, 10);
            await api.sleep(420);
          }
          api.finger.hide();
          await api.sleep(1100);
        }, 300);
      },
    },
    {
      title: 'Tipp und Zurück',
      text: 'Ein Tipp zeigt einen guten Zug. Zurücknehmen geht unbegrenzt – ganz ohne Werbung.',
      demo(stage, api) {
        const box = scene(stage);
        const card = C(3, 9, 22, 18);
        const target = C(2, 10, 58, 12);
        box.append(target, card);
        const bar = h('div.tut-tools');
        const mk = (ic, label) => { const b = h('span.tut-tool', { html: icon(ic, { size: 18 }) }); b.append(label); bar.append(b); return b; };
        const hintB = mk('hint', 'Tipp');
        const undoB = mk('undo', 'Zurück');
        box.append(bar);
        return api.loop(async () => {
          card.classList.remove('moving', 'glow'); place(card, 22, 18);
          await api.sleep(300);
          await api.finger.tap(hintB, 500);
          card.classList.add('glow');
          await api.sleep(900);
          await api.finger.tap(card, 450);
          card.classList.remove('glow');
          card.classList.add('moving');
          place(card, 58, 22);
          await api.sleep(700);
          await api.finger.tap(undoB, 500);
          place(card, 22, 18);
          await api.sleep(900);
          api.finger.hide();
        }, 300);
      },
    },
    {
      title: 'Drei Spielarten',
      text: 'Klondike, Spider mit 1, 2 oder 4 Farben und FreeCell – dazu jeden Tag neue Tagesrätsel.',
      demo(stage, api) {
        api.finger.hide();
        const box = scene(stage);
        const groups = [
          { x: 6, label: 'Klondike', cards: [[-1], [1, 13], [0, 1]] },
          { x: 38, label: 'Spider', cards: [[0, 10], [0, 9], [0, 8]] },
          { x: 70, label: 'FreeCell', cards: [[3, 12], [2, 11], [1, 1]] },
        ];
        groups.forEach((g, gi) => {
          const wrap = h('div.tut-group' + (gi === 1 ? '.d1' : gi === 2 ? '.d2' : ''));
          g.cards.forEach((c, i) => {
            const el = c[0] < 0 ? demoCard(-1, g.x + i * 6, 22 + i * 4, { up: false }) : C(c[0], c[1], g.x + i * 6, 22 + i * 4);
            el.style.transform = `rotate(${(i - 1) * 8}deg)`;
            wrap.append(el);
          });
          const lab = h('b.tut-label', null, g.label);
          place(lab, g.x + 6, 74);
          wrap.append(lab);
          box.append(wrap);
        });
      },
    },
  ];
}
