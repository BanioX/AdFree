// Reversi gegen den Computer.

import { boot, stage, fillTools, onPress } from '../lib/board/kit.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { newGame, apply, flipsFor, counts, aiOptions } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'reversi';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function revive(raw) {
  if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== 64) return null;
  const s = newGame();
  s.cells = raw.cells.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last ?? null;
  s.passed = false;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function art() {
  const spec = ['', '', '', '', '', 'ai', 'me', '', '', 'me', 'ai', '', '', '', '', ''];
  return h('div.rv-art', null, ...spec.map((k) => h('i', { class: k })));
}

boot({
  id: ID,
  title: 'Reversi',
  tagline: 'Steine einschliessen und umdrehen',
  accent: '#1f8a4c',
  confetti: ['#1c8f58', '#f4f0e8', '#241c18', '#ffe27a', '#7dffc3'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    let hint = null;
    const fresh = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    let state = (ctx.saved && revive(ctx.saved)) || fresh;
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];

    const ui = stage({
      title: 'Reversi',
      sub: 'Du schwarz',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const score = h('div.rv-score', null, h('b.me', null, '2'), h('b.ai', null, '2'));
    const board = h('div.rv');
    const buttons = [];
    for (let i = 0; i < 64; i++) {
      const b = h('button.rv-cell', { type: 'button', 'data-i': String(i), 'aria-label': 'Feld' });
      buttons.push(b);
      board.append(b);
    }
    ui.board.append(score, board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => ({
      cells: state.cells.slice(), turn: state.turn, over: state.over, winner: state.winner, last: state.last,
    });
    function persist() {
      ctx.save({
        cells: state.cells, turn: state.turn, over: state.over, winner: state.winner,
        last: state.last, diff: state.diff, hist: state.hist.slice(-40),
      });
    }
    function paint(flip) {
      const [a, b] = counts(state);
      score.querySelector('.me').textContent = String(a);
      score.querySelector('.ai').textContent = String(b);
      ui.setSub(`Du ${a} · Computer ${b}`);
      const showCoach = state.hist.length === 0 && state.turn === 1 && !state.over && !store.get(ID + '.coach');
      for (let i = 0; i < 64; i++) {
        const btn = buttons[i];
        const v = state.cells[i];
        btn.className = 'rv-cell';
        if (state.last === i) btn.classList.add('last');
        if (hint === i) btn.classList.add('hint');
        btn.replaceChildren();
        if (v) {
          const d = h('i', { class: 'rv-disc ' + (v === 1 ? 'me' : 'ai') });
          if (flip && flip.has(i) && !reduced) d.classList.add('flip');
          btn.append(d);
        } else if (state.turn === 1 && !state.over && flipsFor(state.cells, i, 1).length) {
          btn.append(h('i.rv-dot'));
          if (showCoach && i === 19) btn.append(h('span.bd-coach'));
        }
      }
      board.classList.toggle('locked', busy || state.over);
    }
    function status() {
      if (state.over) {
        ui.setStatus(state.winner === 1 ? 'Du gewinnst!' : state.winner === 2 ? 'Computer gewinnt' : 'Unentschieden', state.winner === 1 ? 'win' : '');
      } else if (busy && state.turn === 2) ui.setStatus('Computer überlegt …', '');
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
      status();
      tools();
      const kind = state.winner === 1 ? 'win' : state.winner === 2 ? 'lose' : 'draw';
      const [a, b] = counts(state);
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? 'Mehr Steine!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: `Du ${a} · Computer ${b}`,
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart();
    }
    function restart() {
      finishing = false;
      hint = null;
      state = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
      busy = false;
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
      state.cells = prev.cells.slice();
      state.turn = prev.turn;
      state.over = prev.over;
      state.winner = prev.winner;
      state.last = prev.last;
      state._u = [];
      hint = null;
      sfx.play('click');
      persist();
      paint();
      status();
      tools();
    }
    async function onHint() {
      if (busy || state.over || state.turn !== 1) return;
      busy = true;
      tools();
      await sleep(16);
      hint = pickMove({ ...aiOptions('mittel'), state, difficulty: 'mittel', noise: { mittel: 0 } });
      busy = false;
      if (dead) return;
      paint();
      sfx.play('sparkle');
      toast('Dieses Feld sieht gut aus.');
      status();
      tools();
    }
    async function computer(changed) {
      while (!dead && !state.over && state.turn === 2) {
        status();
        await sleep(reduced ? 20 : 300);
        if (dead) return;
        const m = pickMove({ ...aiOptions(state.diff || 'mittel'), state });
        if (m == null) break;
        const before = state.cells.slice();
        apply(state, m);
        for (let i = 0; i < 64; i++) if (state.cells[i] !== before[i]) changed.add(i);
        paint(changed);
        sfx.play('pop');
        if (state.passed && !state.over) toast('Du musst passen.');
        changed.clear();
      }
    }
    async function play(i) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (!flipsFor(state.cells, i, 1).length) {
        sfx.play('error');
        return;
      }
      busy = true;
      hint = null;
      store.set(ID + '.coach', true);
      if (!state.extraWait) state.hist.push(snap());
      const before = state.cells.slice();
      apply(state, i);
      const changed = new Set();
      for (let k = 0; k < 64; k++) if (state.cells[k] !== before[k]) changed.add(k);
      paint(changed);
      sfx.play('place');
      persist();
      tools();
      if (state.over) { busy = false; return finish(); }
      if (state.turn === 1) {
        toast('Computer muss passen.');
        busy = false;
        status();
        tools();
        return;
      }
      await computer(changed);
      busy = false;
      if (dead) return;
      persist();
      tools();
      if (state.over) return finish();
      status();
    }
    const offPress = onPress(board, '.rv-cell', (el) => play(Number(el.dataset.i)));
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    paint();
    status();
    tools();
    persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy };
    return {
      destroy() {
        dead = true;
        offPress();
        window.removeEventListener('pagehide', onHide);
        if (window.__sp?.id === ID) delete window.__sp;
      },
    };
  },
});
