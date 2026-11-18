// Eile mit Weile – kurze Runde gegen drei Farben.

import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { newGame, roll, move, legal, aiPick, clone, PIECES } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'eile';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLOT = 8.2;
const ORIGIN = 7;

function trackPos(index) {
  const side = Math.floor(index / 10);
  const i = index % 10;
  const a = ORIGIN;
  const b = ORIGIN + 10 * SLOT;
  if (side === 0) return { left: a + i * SLOT, top: b };
  if (side === 1) return { left: b, top: b - i * SLOT };
  if (side === 2) return { left: b - i * SLOT, top: a };
  return { left: a, top: a + i * SLOT };
}

function homePos(player, i) {
  if (player === 0) return { left: 42 + i * 7.2, top: 76 };
  if (player === 1) return { left: 76, top: 58 - i * 7.2 };
  if (player === 2) return { left: 58 - i * 7.2, top: 20 };
  return { left: 20, top: 42 + i * 7.2 };
}

const YARD = [
  [{ left: 22, top: 66 }, { left: 32, top: 76 }],
  [{ left: 70, top: 70 }, { left: 80, top: 80 }],
  [{ left: 70, top: 22 }, { left: 80, top: 32 }],
  [{ left: 22, top: 22 }, { left: 32, top: 32 }],
];

function piecePos(player, steps, index) {
  if (steps < 0) return YARD[player][index];
  if (steps >= 40) return homePos(player, steps - 40);
  return trackPos((player * 10 + steps) % 40);
}

const DOTS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function revive(raw) {
  if (!raw || !Array.isArray(raw.p) || raw.p.length !== 4) return null;
  const s = newGame();
  s.p = raw.p.map((row) => row.slice());
  s.turn = raw.turn | 0;
  s.dice = raw.dice | 0;
  s.face = raw.face | 0;
  s.phase = raw.phase === 'move' ? 'move' : 'roll';
  s.sixes = raw.sixes | 0;
  s.over = !!raw.over;
  s.winner = raw.winner ?? -1;
  s.last = raw.last || null;
  s.diff = raw.diff;
  s.hist = Array.isArray(raw.hist) ? raw.hist : [];
  return s;
}

function art() {
  return h('div.ey-art', null,
    h('i.p0'), h('i.p1'), h('i.p2'), h('i.p3'));
}

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#e23d4a',
  confetti: ['#e23d4a', '#2f7de1', '#e6b325', '#2f9e6e', '#fff'],
  steps: tutorialSteps,
  art,
  start(ctx) {
    let dead = false;
    let busy = false;
    const fresh = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
    let state = (ctx.saved && revive(ctx.saved)) || fresh;
    state.diff = state.diff || ctx.diff;
    if (!state.hist) state.hist = [];

    const ui = stage({
      title: tr('title'),
      sub: tr('sub'),
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.ey');
    for (let i = 0; i < 40; i++) {
      const pos = trackPos(i);
      const owner = i % 10 === 0 ? ' p' + (i / 10) : '';
      board.append(h('i', { class: 'ey-cell' + owner, style: `left:${pos.left}%;top:${pos.top}%` }));
    }
    for (let pl = 0; pl < 4; pl++) {
      for (let i = 0; i < 4; i++) {
        const pos = homePos(pl, i);
        board.append(h('i.ey-home.p' + pl, { style: `left:${pos.left}%;top:${pos.top}%` }));
      }
    }
    const pieces = h('div.ey-pieces');
    const die = h('button.ey-die', { type: 'button' });
    board.append(pieces, die);
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const snap = () => clone(state);
    function persist() {
      ctx.save({
        p: state.p, turn: state.turn, dice: state.dice, face: state.face, phase: state.phase,
        sixes: state.sixes, over: state.over, winner: state.winner, last: state.last,
        diff: state.diff, hist: state.hist.slice(-24),
      });
    }
    function paintDie() {
      const n = state.face || 0;
      die.className = 'ey-die' + (state.turn === 0 && state.phase === 'roll' && !busy && !state.over ? ' ready' : '');
      die.setAttribute('aria-label', tr('roll'));
      die.replaceChildren();
      if (!n) {
        die.append(h('b', null, tr('roll')));
        return;
      }
      const face = h('span.ey-face');
      const on = new Set(DOTS[n] || []);
      for (let i = 0; i < 9; i++) {
        const dot = h('i');
        if (!on.has(i)) dot.className = 'off';
        face.append(dot);
      }
      die.append(face);
    }
    function paint() {
      const opts = state.turn === 0 ? legal(state) : [];
      pieces.replaceChildren();
      for (let pl = 0; pl < 4; pl++) {
        for (let i = 0; i < PIECES; i++) {
          const pos = piecePos(pl, state.p[pl][i], i);
          const btn = h('button.ey-pc.p' + pl, {
            type: 'button',
            'data-pl': String(pl),
            'data-i': String(i),
            style: `left:${pos.left}%;top:${pos.top}%`,
            'aria-label': tr(['you', 'blue', 'yellow', 'green'][pl]),
          });
          if (pl === 0 && opts.includes(i)) btn.classList.add('on');
          if (state.last && state.last.player === pl && state.last.piece === i) btn.classList.add('last');
          pieces.append(btn);
        }
      }
      paintDie();
      const home = [0, 1, 2, 3].map((pl) => state.p[pl].filter((s) => s >= 40).length);
      ui.setSub(tr('homes', {
        you: tr('you'), blue: tr('blue'), yellow: tr('yellow'), green: tr('green'),
        a: home[0], b: home[1], c: home[2], d: home[3],
      }));
    }
    function status() {
      if (state.over) ui.setStatus(state.winner === 0 ? bt('youWinShort') : tr(['you', 'blue', 'yellow', 'green'][state.winner]) + ' ' + tr('wins'), state.winner === 0 ? 'win' : '');
      else if (state.turn !== 0) ui.setStatus(tr(['you', 'blue', 'yellow', 'green'][state.turn]) + ' ' + tr('turn'), '');
      else if (state.phase === 'roll') ui.setStatus(state.sixes ? tr('rollAgain') : tr('roll'), 'you');
      else ui.setStatus(tr('tap'), 'you');
    }
    function tools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: busy || !state.hist.length, onClick: onUndo },
        { icon: 'hint', label: bt('hint'), disabled: busy || state.over || state.turn !== 0 || state.phase !== 'move', onClick: onHint },
        { icon: 'refresh', label: bt('neu'), disabled: busy, onClick: onNew },
      ]);
    }
    let finishing = false;
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      status();
      tools();
      const kind = state.winner === 0 ? 'win' : 'lose';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? tr('allHome') : bt('close'),
        text: kind === 'win' ? tr('both') : tr('first', { name: tr(['you', 'blue', 'yellow', 'green'][state.winner]) }),
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart();
    }
    function restart() {
      finishing = false;
      state = Object.assign(newGame(), { diff: ctx.diff, hist: [] });
      busy = false;
      persist();
      paint();
      status();
      tools();
    }
    async function onNew() {
      if (state.hist.length && !state.over) {
        if (!(await confirmDialog(tr('newRound'), tr('endRound'), bt('restart')))) return;
      }
      if (!dead) restart();
    }
    function onUndo() {
      const prev = state.hist.pop();
      if (!prev) return;
      state.p = prev.p;
      state.turn = prev.turn;
      state.dice = prev.dice;
      state.face = prev.face || 0;
      state.phase = prev.phase;
      state.sixes = prev.sixes;
      state.over = prev.over;
      state.winner = prev.winner;
      state.last = prev.last;
      sfx.play('click');
      persist();
      paint();
      status();
      tools();
    }
    function onHint() {
      const list = legal(state);
      if (!list.length) return;
      const piece = aiPick(state, 'schwer', () => 0);
      const btn = pieces.querySelector(`[data-pl="0"][data-i="${piece}"]`);
      if (btn) btn.classList.add('hint');
      sfx.play('sparkle');
      toast(tr('hint'));
    }
    async function opponents() {
      while (!dead && !state.over && state.turn !== 0) {
        status();
        paint();
        await sleep(reduced ? 16 : 180);
        if (dead || state.over || state.turn === 0) return;
        const value = 1 + Math.floor(Math.random() * 6);
        const result = roll(state, value);
        paint();
        sfx.play('tap');
        if (result === 'move') {
          await sleep(reduced ? 16 : 160);
          if (dead) return;
          const piece = aiPick(state, state.diff || 'mittel');
          if (piece != null) {
            move(state, piece);
            sfx.play('place');
            paint();
          }
        }
      }
    }
    async function afterHuman() {
      await opponents();
      busy = false;
      if (dead) return;
      persist();
      paint();
      tools();
      if (state.over) return finish();
      status();
    }
    async function onDie() {
      if (dead || busy || state.over || state.turn !== 0) return;
      if (state.phase === 'move') {
        const list = legal(state);
        if (list.length === 1) playPiece(list[0]);
        return;
      }
      busy = true;
      tools();
      if (state.sixes === 0) state.hist.push(snap());
      const value = 1 + Math.floor(Math.random() * 6);
      const result = roll(state, value);
      paint();
      sfx.play('tap');
      if (result === 'pass') {
        toast(tr('noMove'));
        await afterHuman();
        return;
      }
      const list = legal(state);
      if (list.length === 1) {
        await sleep(reduced ? 16 : 220);
        if (!dead) playPiece(list[0]);
        return;
      }
      busy = false;
      status();
      tools();
      persist();
    }
    function playPiece(index) {
      if (dead || state.over || state.turn !== 0 || state.phase !== 'move') return;
      if (!legal(state).includes(index)) { sfx.play('error'); return; }
      busy = true;
      move(state, index);
      sfx.play('place');
      paint();
      persist();
      if (state.over) { busy = false; finish(); return; }
      if (state.turn === 0 && state.phase === 'roll') {
        busy = false;
        status();
        tools();
        toast(tr('again'));
        return;
      }
      afterHuman();
    }
    const offDie = onPress(die, 'button', () => onDie());
    const offPc = onPress(pieces, '.ey-pc', (el) => {
      if (el.dataset.pl !== '0') return;
      playPiece(Number(el.dataset.i));
    });
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
        offDie();
        offPc();
        window.removeEventListener('pagehide', onHide);
        if (window.__sp && window.__sp.id === ID) delete window.__sp;
      },
    };
  },
});
