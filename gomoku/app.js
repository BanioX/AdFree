// Fünf in einer Reihe gegen den Computer.

import { boot, stage, fillTools, onPress } from '../lib/board/kit.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { newGame, apply, N, aiOptions } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'gomoku';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STARS = [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];

function revive(raw) {
  if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== N * N) return null;
  const s = newGame();
  s.cells = raw.cells.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.n = raw.n | 0;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last ?? null;
  s.line = raw.line || null;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function art() {
  const box = h('div.go-art');
  const place = (x, y, cls) => {
    const i = h('i', { class: cls });
    i.style.left = (18 + x * 22) + 'px';
    i.style.top = (18 + y * 22) + 'px';
    box.append(i);
  };
  [[1, 2], [2, 2], [3, 2], [4, 2]].forEach(([x, y]) => place(x, y, 'me'));
  place(2, 1, 'ai'); place(3, 3, 'ai');
  return box;
}

boot({
  id: ID,
  title: 'Fünf in einer Reihe',
  tagline: 'Fünf Steine in einer Linie',
  accent: '#8a5a2b',
  confetti: ['#1c1614', '#f4efe6', '#e4c07a', '#e23b4a', '#fff'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    let hint = null;
    let state = (ctx.saved && revive(ctx.saved)) || Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];

    const ui = stage({
      title: 'Fünf in einer Reihe',
      sub: 'Du schwarz',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.go');
    board.append(h('div.go-lines'));
    for (const [r, c] of STARS) {
      const s = h('i.go-star');
      s.style.left = ((c + 0.5) * 100 / N) + '%';
      s.style.top = ((r + 0.5) * 100 / N) + '%';
      board.append(s);
    }
    const buttons = [];
    for (let i = 0; i < N * N; i++) {
      const r = (i / N) | 0;
      const c = i % N;
      const b = h('button.go-cell', { type: 'button', 'data-i': String(i), 'aria-label': 'Feld' });
      b.style.left = (c * 100 / N) + '%';
      b.style.top = (r * 100 / N) + '%';
      buttons.push(b);
      board.append(b);
    }
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => ({ cells: state.cells.slice(), turn: state.turn, n: state.n, last: state.last, line: state.line });
    function persist() {
      ctx.save({
        cells: state.cells, turn: state.turn, n: state.n, over: state.over, winner: state.winner,
        last: state.last, line: state.line, diff: state.diff, hist: state.hist.slice(-40),
      });
    }
    const wins = () => new Set(state.line || []);
    function paint() {
      const w = wins();
      const coach = !state.n && !store.get(ID + '.coach');
      const mid = ((N / 2) | 0) * N + ((N / 2) | 0);
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        b.className = 'go-cell';
        if (w.has(i)) b.classList.add('win');
        if (hint === i && !state.cells[i]) b.classList.add('hint');
        b.replaceChildren();
        const v = state.cells[i];
        if (v) {
          const stone = h('i', { class: 'go-stone ' + (v === 1 ? 'me' : 'ai') });
          if (state.last === i) stone.classList.add('mark');
          b.append(stone);
        } else if (coach && i === mid) b.append(h('span.bd-coach'));
      }
      board.classList.toggle('locked', busy || !!state.over);
    }
    function status() {
      if (state.over) ui.setStatus(state.winner === 1 ? 'Fünf in einer Reihe!' : state.winner === 2 ? 'Computer gewinnt' : 'Unentschieden', state.winner === 1 ? 'win' : '');
      else if (busy && state.turn === 2) ui.setStatus('Computer überlegt …', '');
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
        title: kind === 'win' ? 'Fünf in einer Reihe!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: kind === 'win' ? 'Deine Steine bilden eine Linie.' : 'Diesmal war der Computer schneller.',
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
      persist(); paint(); status(); tools();
    }
    async function onNew() {
      if (state.n && !state.over) {
        if (!(await confirmDialog('Neue Partie?', 'Die laufende Partie wird beendet.', 'Neu starten'))) return;
      }
      if (!dead) restart();
    }
    function onUndo() {
      const prev = state.hist.pop();
      if (!prev) return;
      state.cells = prev.cells.slice();
      state.turn = prev.turn;
      state.n = prev.n;
      state.last = prev.last;
      state.line = prev.line;
      state.over = false;
      state.winner = 0;
      state._u = [];
      hint = null;
      sfx.play('click');
      persist(); paint(); status(); tools();
    }
    async function onHint() {
      if (busy || state.over || state.turn !== 1) return;
      busy = true;
      tools();
      ui.setStatus('Einen Moment …', '');
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
    async function play(i) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (state.cells[i]) { sfx.play('error'); return; }
      busy = true;
      hint = null;
      store.set(ID + '.coach', true);
      state.hist.push(snap());
      apply(state, i);
      paint();
      sfx.play('place');
      persist();
      tools();
      if (state.over) { busy = false; return finish(); }
      status();
      await sleep(reduced ? 16 : 240);
      if (dead) return;
      const m = pickMove({ ...aiOptions(state.diff || 'mittel'), state });
      if (m != null) {
        apply(state, m);
        paint();
        sfx.play(state.winner === 2 ? 'thud' : 'pop');
      }
      busy = false;
      persist();
      tools();
      if (state.over) return finish();
      status();
    }
    const offPress = onPress(board, '.go-cell', (el) => play(Number(el.dataset.i)));
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    paint(); status(); tools(); persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy };
    return { destroy() { dead = true; offPress(); window.removeEventListener('pagehide', onHide); } };
  },
});
