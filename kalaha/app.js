// Kalaha gegen den Computer.

import { boot, stage, fillTools } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { newGame, apply, moves, aiOptions } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'kalaha';
const SEED = ['#6b3a1f', '#8a4b28', '#a86432', '#c4843a', '#7a3e45', '#5c6b32'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function revive(raw) {
  if (!raw || !Array.isArray(raw.p) || raw.p.length !== 14) return null;
  const s = newGame();
  s.p = raw.p.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last ?? null;
  s.extra = !!raw.extra;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function dots(n) {
  const box = h('span.ka-seeds');
  for (let i = 0; i < Math.min(n, 6); i++) {
    const seed = h('i.ka-seed');
    seed.style.background = SEED[i % SEED.length];
    box.append(seed);
  }
  return box;
}

function art() {
  const pits = h('div.pits');
  for (let i = 0; i < 12; i++) pits.append(h('i'));
  return h('div.ka-art', null, h('span'), pits, h('span'));
}

boot({
  id: ID,
  title: 'Kalaha',
  tagline: 'Samen säen, Vorrat füllen',
  accent: '#c4843a',
  confetti: ['#f0c27a', '#c4843a', '#6b3a1f', '#fff3', '#8a4b28'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    let state = (ctx.saved && revive(ctx.saved)) || Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];
    let popped = new Set();

    const ui = stage({
      title: 'Kalaha',
      sub: 'Dein Vorrat rechts',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.ka');
    const storeAi = h('div.ka-store', { 'data-pit': '13', 'aria-label': 'Vorrat des Computers' });
    const storeMe = h('div.ka-store', { 'data-pit': '6', 'aria-label': 'Dein Vorrat' });
    const aiRow = h('div.ka-row');
    const myRow = h('div.ka-row');
    const pits = [];
    for (const i of [12, 11, 10, 9, 8, 7]) {
      const el = h('div.ka-pit', { 'data-pit': String(i) });
      pits[i] = el;
      aiRow.append(el);
    }
    for (let i = 0; i < 6; i++) {
      const el = h('button.ka-pit.mine', { type: 'button', 'data-pit': String(i), 'aria-label': `Mulde ${i + 1}` });
      pits[i] = el;
      myRow.append(el);
    }
    board.append(storeAi, h('div.ka-pits', null, aiRow, myRow), storeMe);
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => ({ p: state.p.slice(), turn: state.turn, over: state.over, winner: state.winner, last: state.last, extra: false });
    function persist() {
      ctx.save({
        p: state.p, turn: state.turn, over: state.over, winner: state.winner,
        last: state.last, extra: state.extra, diff: state.diff, hist: state.hist.slice(-30),
      });
    }
    function fill(el, n, label) {
      el.replaceChildren(dots(n), h('b', null, String(n)));
      if (label) el.append(h('small', null, label));
      if (popped.has(Number(el.dataset.pit))) el.classList.add('pop');
    }
    function paint() {
      fill(storeAi, state.p[13], 'Computer');
      fill(storeMe, state.p[6], 'Du');
      for (let i = 0; i < 14; i++) {
        if (i === 6 || i === 13 || !pits[i]) continue;
        const el = pits[i];
        el.classList.toggle('on', state.turn === 1 && i < 6 && state.p[i] > 0 && !state.over);
        el.replaceChildren(dots(state.p[i]), h('b', null, String(state.p[i])));
        if (popped.has(i)) el.classList.add('pop');
        if (!state.hist.length && !state.over && i === 2 && state.turn === 1) el.append(h('span.bd-coach'));
      }
      board.classList.toggle('locked', busy || state.over);
      ui.setSub(`Du ${state.p[6]} · Computer ${state.p[13]}`);
    }
    function status() {
      if (state.over) ui.setStatus(state.winner === 1 ? 'Du gewinnst!' : state.winner === 2 ? 'Computer gewinnt' : 'Unentschieden', state.winner === 1 ? 'win' : '');
      else if (state.turn === 2) ui.setStatus('Computer sät …', '');
      else if (state.extra) ui.setStatus('Noch einmal!', 'you');
      else ui.setStatus('Du bist am Zug', 'you');
    }
    function tools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: 'Zurück', disabled: busy || !state.hist.length, onClick: onUndo },
        { icon: 'hint', label: 'Tipp', disabled: busy || state.over || state.turn !== 1, onClick: onHint },
        { icon: 'refresh', label: 'Neu', disabled: busy, onClick: onNew },
      ]);
    }
    let finishing = false;
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      const kind = state.winner === 1 ? 'win' : state.winner === 2 ? 'lose' : 'draw';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? 'Voller Vorrat!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: `Du ${state.p[6]} Samen · Computer ${state.p[13]}`,
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart();
    }
    function restart() {
      finishing = false;
      state = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
      busy = false;
      popped = new Set();
      persist();
      paint();
      status();
      tools();
    }
    async function onNew() {
      if (state.hist.length && !state.over) {
        if (!(await confirmDialog('Neue Partie?', 'Die laufende Partie wird beendet.', 'Neu starten'))) return;
      }
      if (!dead) restart();
    }
    function onUndo() {
      const prev = state.hist.pop();
      if (!prev) return;
      state.p = prev.p.slice();
      state.turn = prev.turn;
      state.over = false;
      state.winner = 0;
      state.last = prev.last;
      state.extra = false;
      state._u = [];
      sfx.play('click');
      persist();
      paint();
      status();
      tools();
    }
    async function onHint() {
      if (busy || state.turn !== 1 || state.over) return;
      busy = true;
      const pit = pickMove({ ...aiOptions('mittel'), state, difficulty: 'mittel', noise: { mittel: 0 } });
      busy = false;
      if (dead || pit == null) return;
      pits[pit].classList.add('pop');
      sfx.play('sparkle');
      toast('Diese Mulde sieht gut aus.');
    }
    function mark(before) {
      popped = new Set();
      for (let i = 0; i < 14; i++) if (state.p[i] !== before[i]) popped.add(i);
    }
    async function computer() {
      while (!dead && !state.over && state.turn === 2) {
        status();
        tools();
        await sleep(reduced ? 16 : 320);
        if (dead) return;
        const pit = pickMove({ ...aiOptions(state.diff || 'mittel'), state });
        if (pit == null) break;
        const before = state.p.slice();
        apply(state, pit);
        mark(before);
        paint();
        sfx.play(state.extra ? 'sparkle' : 'place');
      }
    }
    async function play(pit) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (pit < 0 || pit > 5 || !state.p[pit]) {
        sfx.play('error');
        toast('Diese Mulde ist leer.');
        return;
      }
      busy = true;
      if (!state.extra) state.hist.push(snap());
      const before = state.p.slice();
      apply(state, pit);
      mark(before);
      paint();
      sfx.play(state.extra ? 'sparkle' : 'place');
      persist();
      if (state.over) { busy = false; return finish(); }
      if (state.turn === 1) {
        busy = false;
        status();
        tools();
        return;
      }
      await computer();
      busy = false;
      if (dead) return;
      persist();
      tools();
      if (state.over) return finish();
      status();
    }
    board.addEventListener('pointerup', (e) => {
      const el = e.target.closest?.('[data-pit]');
      if (!el || !el.classList.contains('mine')) return;
      play(Number(el.dataset.pit));
    });
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    paint();
    status();
    tools();
    persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy, moves: () => moves(state) };
    return { destroy() { dead = true; window.removeEventListener('pagehide', onHide); } };
  },
});
