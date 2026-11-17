// Wortrate – «So geht's»: Schritte für das gemeinsame Tutorial (/shared/tutorial.js).
// Jede Demo ist eine kleine, echte Wortrate-Szene (Kacheln, Tasten, Umdrehen).

import { h } from '../shared/ui.js';
import { scoreGuess } from './logic.js';

const ANSWER = 'BLÜTE';

function tile(letter = '', state = 'empty') {
  const t = h('div.tile', { 'data-state': state });
  t.textContent = letter;
  return t;
}

function row(n = 5) {
  const r = h('div.row.wd-row');
  for (let i = 0; i < n; i++) r.append(tile());
  return r;
}

function setRow(r, word, state = 'tbd') {
  [...r.children].forEach((t, i) => {
    t.textContent = word[i] || '';
    t.dataset.state = word[i] ? state : 'empty';
  });
}

async function flipTo(t, state, api) {
  if (!t.animate) { t.dataset.state = state; return; }
  const a = t.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 150, fill: 'forwards' });
  await api.sleep(150);
  t.dataset.state = state;
  a.cancel();
  t.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0)' }], { duration: 180 });
  await api.sleep(180);
}

async function reveal(r, word, api, gap = 170) {
  const sc = scoreGuess(word, ANSWER);
  const tiles = [...r.children];
  for (let i = 0; i < tiles.length; i++) {
    flipTo(tiles[i], sc[i], api).catch(() => {});
    await api.sleep(gap);
  }
  await api.sleep(250);
}

function hop(tiles) {
  tiles.forEach((t, i) => t.animate && t.animate([
    { transform: 'translateY(0)' }, { transform: 'translateY(-30%)', offset: 0.4 }, { transform: 'translateY(0)' },
  ], { duration: 460, delay: i * 80, easing: 'ease-out' }));
}

export function tutorialSteps() {
  return [
    {
      title: 'Wort eintippen',
      text: 'Tippe ein Wort mit fünf Buchstaben und bestätige mit der Pfeiltaste.',
      demo(stage, api) {
        const r = row();
        const keys = {};
        const kb = h('div.wd-keys');
        for (const ch of ['M', 'B', 'E', 'U', 'L', '⏎']) {
          const k = h('span.wd-key' + (ch === '⏎' ? '.enter' : ''), null, ch);
          keys[ch] = k;
          kb.append(k);
        }
        stage.append(h('div.wd-demo', null, r, kb));
        return api.loop(async () => {
          setRow(r, '');
          let typed = '';
          for (const ch of 'BLUME') {
            await api.finger.tap(keys[ch], 380);
            keys[ch].classList.add('down');
            typed += ch;
            setRow(r, typed);
            r.children[typed.length - 1].animate?.([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 160 });
            await api.sleep(90);
            keys[ch].classList.remove('down');
          }
          await api.finger.tap(keys['⏎'], 420);
          api.finger.hide();
          await reveal(r, 'BLUME', api);
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Farben lesen',
      text: 'Grün: richtige Stelle. Gelb: im Wort, aber woanders. Grau: kommt nicht vor.',
      demo(stage, api) {
        const r = row();
        const label = h('div.wd-label');
        stage.append(h('div.wd-demo', null, r, label));
        const sc = scoreGuess('BETON', ANSWER);
        const texts = { correct: 'B steht richtig', present: 'E ist im Wort', absent: 'O fehlt ganz' };
        return api.loop(async () => {
          setRow(r, 'BETON');
          label.className = 'wd-label';
          label.textContent = '';
          api.finger.hide();
          await api.sleep(300);
          await reveal(r, 'BETON', api);
          for (const idx of [0, 1, 3]) {
            await api.finger.moveTo(r.children[idx], 420);
            label.textContent = texts[sc[idx]];
            label.className = 'wd-label show ' + sc[idx];
            await api.sleep(1100);
          }
          api.finger.hide();
          await api.sleep(500);
        }, 200);
      },
    },
    {
      title: 'Sechs Versuche',
      text: 'Nutze die Hinweise und finde das Wort in höchstens sechs Versuchen.',
      demo(stage, api) {
        const rows = [row(), row(), row()];
        const board = h('div.wd-board', null, rows);
        stage.append(h('div.wd-demo.small', null, board));
        api.finger.hide();
        return api.loop(async () => {
          rows.forEach((r) => setRow(r, ''));
          await api.sleep(400);
          for (const [i, w] of ['BETON', 'BLUME', 'BLÜTE'].entries()) {
            for (let n = 1; n <= 5; n++) { setRow(rows[i], [...w].slice(0, n).join('')); await api.sleep(110); }
            await api.sleep(200);
            await reveal(rows[i], w, api, 140);
          }
          hop([...rows[2].children]);
          await api.sleep(1800);
        }, 200);
      },
    },
    {
      title: 'Tageswort & Endlos',
      text: 'Jeden Tag ein neues Wort für alle – oder endlos weiterraten mit 4, 5 oder 6 Buchstaben.',
      demo(stage, api) {
        const daily = h('div.wd-card', null, h('span.wd-ico', null, '☀️'), h('b', null, 'Tageswort'), h('span.wd-check', null, '✓'));
        const endless = h('div.wd-card', null, h('span.wd-ico.inf', null, '∞'), h('b', null, 'Endlos'));
        const chips = h('div.wd-chips', null, ['4', '5', '6'].map((n) => h('span.wd-chip' + (n === '5' ? '.on' : ''), null, n)));
        stage.append(h('div.wd-demo', null, h('div.wd-cards', null, daily, endless), chips));
        return api.loop(async () => {
          daily.classList.remove('done');
          await api.finger.tap(daily, 500);
          daily.classList.add('done');
          await api.sleep(800);
          const c = [...chips.children];
          for (const i of [2, 0, 1]) {
            await api.finger.tap(c[i], 380);
            c.forEach((x, j) => x.classList.toggle('on', j === i));
            await api.sleep(250);
          }
          await api.finger.tap(endless, 450);
          endless.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220 });
          await api.sleep(900);
        }, 300);
      },
    },
  ];
}
