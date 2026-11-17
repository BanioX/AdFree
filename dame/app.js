// Dame gegen den Computer.

import { boot, stage, fillTools } from '../lib/board/kit.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { newGame, moves, apply, aiOptions, sideOf, judge } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'dame';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function revive(raw) {
  if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== 64) return null;
  const s = newGame();
  s.cells = raw.cells.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.quiet = raw.quiet | 0;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last ?? null;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function art() {
  const board = h('div.dm-art');
  const mine = new Set([40, 42, 44, 49, 51, 53, 56, 58]);
  const cpu = new Set([1, 3, 8, 10, 17, 19]);
  const king = 26;
  for (let i = 0; i < 64; i++) {
    const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
    const cell = h('i', { class: dark ? 'dark' : '' });
    if (i === king) cell.append(h('b', { class: 'me king' }));
    else if (mine.has(i)) cell.append(h('b', { class: 'me' }));
    else if (cpu.has(i)) cell.append(h('b', { class: 'ai' }));
    board.append(cell);
  }
  return board;
}

boot({
  id: ID,
  title: 'Dame',
  tagline: 'Schlagen, bis die Dame fliegt',
  accent: '#c45c26',
  confetti: ['#f4e2c4', '#c45c26', '#3a2418', '#ffe27a', '#fff'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    let sel = null;
    let hintTo = null;
    const fresh = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    let state = (ctx.saved && revive(ctx.saved)) || fresh;
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];

    const ui = stage({
      title: 'Dame',
      sub: 'Du hell',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.dm');
    const squares = [];
    for (let i = 0; i < 64; i++) {
      const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
      const el = dark
        ? h('button.dm-sq.dark', { type: 'button', 'data-i': String(i), 'aria-label': 'Feld' })
        : h('div.dm-sq');
      squares.push(el);
      board.append(el);
    }
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => ({
      cells: state.cells.slice(), turn: state.turn, quiet: state.quiet,
      over: state.over, winner: state.winner, last: state.last,
    });
    function persist() {
      ctx.save({
        cells: state.cells, turn: state.turn, quiet: state.quiet, over: state.over,
        winner: state.winner, last: state.last, diff: state.diff, hist: state.hist.slice(-30),
      });
    }
    function legal() {
      return state.over ? [] : moves(state);
    }
    function paint() {
      const list = legal();
      const froms = new Set(list.map((m) => m.from));
      if (sel != null && !froms.has(sel)) sel = null;
      if (sel == null && list.length && list[0].taken.length && froms.size === 1) sel = [...froms][0];
      const dests = sel == null ? [] : list.filter((m) => m.from === sel);
      let me = 0;
      let ai = 0;
      for (const p of state.cells) {
        if (sideOf(p) === 1) me++;
        else if (sideOf(p) === 2) ai++;
      }
      ui.setSub(`Du ${me} · Computer ${ai}`);
      const showCoach = state.hist.length === 0 && state.turn === 1 && !state.over && !store.get(ID + '.coach');
      const coachAt = showCoach ? (list[0] && list[0].from) : null;
      for (let i = 0; i < 64; i++) {
        const el = squares[i];
        if (!el.dataset.i) continue;
        el.className = 'dm-sq dark';
        if (sel === i) el.classList.add('sel');
        if (state.last === i) el.classList.add('last');
        if (hintTo === i) el.classList.add('hint');
        el.replaceChildren();
        const p = state.cells[i];
        if (p) {
          const disc = h('i', { class: 'dm-pc ' + (sideOf(p) === 1 ? 'me' : 'ai') + (p >= 3 ? ' king' : '') });
          if (state.last === i && !reduced) disc.classList.add('in');
          el.append(disc);
        }
        if (dests.some((m) => m.to === i)) el.append(h('i.dm-dot'));
        if (coachAt === i) el.append(h('span.bd-coach'));
        if (froms.has(i) && list[0] && list[0].taken.length && sel == null) el.classList.add('must');
      }
    }
    function status() {
      if (state.over) {
        ui.setStatus(state.winner === 1 ? 'Du gewinnst!' : state.winner === 2 ? 'Computer gewinnt' : 'Unentschieden', state.winner === 1 ? 'win' : '');
      } else if (busy && state.turn === 2) ui.setStatus('Computer überlegt …', '');
      else if (moves(state).some((m) => m.taken.length)) ui.setStatus('Du musst schlagen', 'you');
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
      sel = null;
      status();
      tools();
      paint();
      const kind = state.winner === 1 ? 'win' : state.winner === 2 ? 'lose' : 'draw';
      let me = 0;
      let ai = 0;
      for (const p of state.cells) {
        if (sideOf(p) === 1) me++;
        else if (p) ai++;
      }
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? 'Gewonnen!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: kind === 'draw' ? 'Niemand kommt weiter.' : `Du ${me} · Computer ${ai}`,
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart();
    }
    function restart() {
      finishing = false;
      sel = null;
      hintTo = null;
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
      state.quiet = prev.quiet | 0;
      state.over = !!prev.over;
      state.winner = prev.winner || 0;
      state.last = prev.last ?? null;
      state._u = [];
      sel = null;
      hintTo = null;
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
      const m = pickMove({ ...aiOptions(state), noise: 0, difficulty: 'mittel' });
      busy = false;
      if (dead || !m) return;
      sel = m.from;
      hintTo = m.to;
      paint();
      sfx.play('sparkle');
      toast('Dieser Zug sieht gut aus.');
      status();
      tools();
    }
    async function computer() {
      while (!dead && !state.over && state.turn === 2) {
        status();
        await sleep(reduced ? 16 : 200);
        if (dead || state.over || state.turn !== 2) return;
        const m = pickMove(aiOptions(state));
        if (m == null) { judge(state); break; }
        apply(state, m);
        paint();
        sfx.play(m.taken.length ? 'pop' : 'place');
      }
    }
    async function playMove(m) {
      if (dead || busy || state.over || state.turn !== 1 || !m) return;
      busy = true;
      hintTo = null;
      sel = null;
      store.set(ID + '.coach', true);
      state.hist.push(snap());
      apply(state, m);
      paint();
      sfx.play(m.taken.length ? 'pop' : 'place');
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
      const list = legal();
      const piece = state.cells[i];
      if (sel != null) {
        const opts = list.filter((m) => m.from === sel && m.to === i);
        if (opts.length) {
          playMove(opts[0]);
          return;
        }
      }
      if (sideOf(piece) === 1 && list.some((m) => m.from === i)) {
        sel = i;
        hintTo = null;
        sfx.play('tap');
        paint();
        return;
      }
      if (piece || sel != null) sfx.play('error');
    }
    board.addEventListener('pointerup', (e) => {
      const el = e.target.closest?.('[data-i]');
      if (!el) return;
      onTap(Number(el.dataset.i));
    });
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    paint();
    status();
    tools();
    persist();
    window.__sp = {
      id: ID,
      state: () => state,
      busy: () => busy,
      moves: () => legal(),
    };
    return {
      destroy() {
        dead = true;
        window.removeEventListener('pagehide', onHide);
        if (window.__sp && window.__sp.id === ID) delete window.__sp;
      },
    };
  },
});
