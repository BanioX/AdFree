// Mühle gegen den Computer.

import { boot, stage, fillTools, onPress } from '../lib/board/kit.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { PTS, MILLS, newGame, moves, apply, count, aiOptions } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'muehle';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pct = (n) => (8 + (n / 6) * 84).toFixed(2);

function revive(raw) {
  if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== 24 || !Array.isArray(raw.left)) return null;
  const s = newGame();
  s.cells = raw.cells.slice();
  s.left = raw.left.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last ?? null;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function art() {
  const board = h('div.mu-art');
  const mine = new Set([0, 1, 9]);
  const cpu = new Set([2, 14, 23]);
  for (let i = 0; i < 24; i++) {
    const [x, y] = PTS[i];
    const dot = h('i', { style: `left:${pct(x)}%;top:${pct(y)}%` });
    if (mine.has(i)) dot.classList.add('me');
    if (cpu.has(i)) dot.classList.add('ai');
    board.append(dot);
  }
  return board;
}

boot({
  id: ID,
  title: 'Mühle',
  tagline: 'Drei in einer Linie, Stein weg',
  accent: '#8b5a2b',
  confetti: ['#f0c27a', '#8b5a2b', '#fff', '#e7c27a', '#5c3a1e'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    let sel = null;
    let pending = null;
    const fresh = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    let state = (ctx.saved && revive(ctx.saved)) || fresh;
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];

    const ui = stage({
      title: 'Mühle',
      sub: 'Du hell',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.mu');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'mu-lines');
    for (const mill of MILLS) {
      const a = PTS[mill[0]];
      const b = PTS[mill[2]];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pct(a[0]));
      line.setAttribute('y1', pct(a[1]));
      line.setAttribute('x2', pct(b[0]));
      line.setAttribute('y2', pct(b[1]));
      svg.append(line);
    }
    board.append(svg);
    const points = [];
    for (let i = 0; i < 24; i++) {
      const [x, y] = PTS[i];
      const b = h('button.mu-pt', {
        type: 'button',
        'data-i': String(i),
        'aria-label': 'Punkt',
        style: `left:${pct(x)}%;top:${pct(y)}%`,
      });
      points.push(b);
      board.append(b);
    }
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => ({
      cells: state.cells.slice(), left: state.left.slice(), turn: state.turn,
      over: state.over, winner: state.winner, last: state.last,
    });
    function persist() {
      ctx.save({
        cells: state.cells, left: state.left, turn: state.turn, over: state.over,
        winner: state.winner, last: state.last, diff: state.diff, hist: state.hist.slice(-30),
      });
    }
    function same(m, partial) {
      if (!partial) return false;
      if (partial.place != null) return m.place === partial.place;
      return m.from === partial.from && m.to === partial.to;
    }
    function paint() {
      const list = state.over ? [] : moves(state);
      const me = count(state, 1);
      const ai = count(state, 2);
      ui.setSub(state.left[1] || state.left[2]
        ? `Du ${me} · noch ${state.left[1]}`
        : `Du ${me} · Computer ${ai}`);
      const showCoach = !state.hist.length && state.left[1] === 9 && !store.get(ID + '.coach');
      const dests = sel == null ? [] : list.filter((m) => m.from === sel);
      const takes = pending ? list.filter((m) => same(m, pending) && m.remove != null).map((m) => m.remove) : [];
      for (let i = 0; i < 24; i++) {
        const el = points[i];
        el.className = 'mu-pt';
        if (sel === i) el.classList.add('sel');
        if (state.last === i) el.classList.add('last');
        if (takes.includes(i)) el.classList.add('take');
        if (showCoach && i === 0) el.classList.add('coach');
        el.replaceChildren();
        const ghostHere = pending && pending.place === i;
        const v = state.cells[i];
        if (v || ghostHere) {
          el.append(h('i', {
            class: 'mu-pc ' + ((v || 1) === 1 ? 'me' : 'ai') + (ghostHere && !v ? ' ghost' : ''),
          }));
        } else if (dests.some((m) => m.to === i)) el.append(h('i.mu-dot'));
      }
    }
    function status() {
      if (state.over) {
        ui.setStatus(state.winner === 1 ? 'Du gewinnst!' : state.winner === 2 ? 'Computer gewinnt' : 'Unentschieden', state.winner === 1 ? 'win' : '');
      } else if (pending) ui.setStatus('Nimm einen Stein weg', 'you');
      else if (busy && state.turn === 2) ui.setStatus('Computer überlegt …', '');
      else if (state.left[1] > 0) ui.setStatus('Setze einen Stein', 'you');
      else if (state.left[1] === 0 && state.left[2] === 0 && count(state, 1) <= 3) ui.setStatus('Du darfst fliegen', 'you');
      else ui.setStatus('Zieh einen Stein', 'you');
    }
    function tools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: 'Zurück', disabled: busy || !state.hist.length, onClick: onUndo },
        { icon: 'hint', label: 'Tipp', disabled: busy || state.over || state.turn !== 1 || pending, onClick: onHint },
        { icon: 'refresh', label: 'Neu', disabled: busy, onClick: onNew },
      ]);
    }
    let finishing = false;
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      pending = null;
      sel = null;
      status();
      tools();
      paint();
      const kind = state.winner === 1 ? 'win' : state.winner === 2 ? 'lose' : 'draw';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? 'Gewonnen!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: `Du ${count(state, 1)} · Computer ${count(state, 2)}`,
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart();
    }
    function restart() {
      finishing = false;
      pending = null;
      sel = null;
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
      state.left = prev.left.slice();
      state.turn = prev.turn;
      state.over = !!prev.over;
      state.winner = prev.winner || 0;
      state.last = prev.last ?? null;
      state._u = [];
      pending = null;
      sel = null;
      sfx.play('click');
      persist();
      paint();
      status();
      tools();
    }
    async function onHint() {
      if (busy || state.over || state.turn !== 1 || pending) return;
      busy = true;
      tools();
      await sleep(16);
      const m = pickMove({ ...aiOptions(state), noise: 0, difficulty: 'leicht' });
      busy = false;
      if (dead || !m) return;
      if (m.place != null) pending = null, sel = null, points[m.place].classList.add('hint');
      else { sel = m.from; pending = null; }
      paint();
      if (m.place != null) points[m.place].classList.add('hint');
      else if (m.to != null) points[m.to].classList.add('hint');
      sfx.play('sparkle');
      toast('Dieser Punkt sieht gut aus.');
      status();
      tools();
    }
    async function computer() {
      while (!dead && !state.over && state.turn === 2) {
        status();
        await sleep(reduced ? 16 : 220);
        if (dead || state.over || state.turn !== 2) return;
        const m = pickMove(aiOptions(state));
        if (m == null) break;
        apply(state, m);
        paint();
        sfx.play(m.remove != null ? 'pop' : 'place');
      }
    }
    async function play(m) {
      if (dead || busy || state.over || state.turn !== 1 || !m) return;
      busy = true;
      pending = null;
      sel = null;
      store.set(ID + '.coach', true);
      state.hist.push(snap());
      apply(state, m);
      paint();
      sfx.play(m.remove != null ? 'pop' : 'place');
      persist();
      tools();
      if (state.over) { busy = false; return finish(); }
      await computer();
      busy = false;
      if (dead) return;
      persist();
      paint();
      tools();
      if (state.over) return finish();
      status();
    }
    function onTap(i) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (pending) {
        const m = moves(state).find((mv) => same(mv, pending) && mv.remove === i);
        if (m) { play(m); return; }
        sfx.play('error');
        return;
      }
      const list = moves(state);
      if (state.left[1] > 0) {
        const opts = list.filter((m) => m.place === i);
        if (!opts.length) { sfx.play('error'); return; }
        if (opts.some((m) => m.remove != null)) {
          pending = { place: i };
          paint();
          status();
          toast('Nimm einen Stein weg.');
          return;
        }
        play(opts[0]);
        return;
      }
      if (sel != null) {
        const opts = list.filter((m) => m.from === sel && m.to === i);
        if (opts.length) {
          if (opts.some((m) => m.remove != null)) {
            pending = { from: sel, to: i };
            paint();
            status();
            toast('Nimm einen Stein weg.');
            return;
          }
          play(opts[0]);
          return;
        }
      }
      if (state.cells[i] === 1 && list.some((m) => m.from === i)) {
        sel = i;
        sfx.play('tap');
        paint();
        return;
      }
      if (state.cells[i] || sel != null) sfx.play('error');
    }
    const offPress = onPress(board, '.mu-pt', (el) => onTap(Number(el.dataset.i)));
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    paint();
    status();
    tools();
    persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy, moves: () => moves(state) };
    return {
      destroy() {
        dead = true;
        offPress();
        window.removeEventListener('pagehide', onHide);
        if (window.__sp && window.__sp.id === ID) delete window.__sp;
      },
    };
  },
});
