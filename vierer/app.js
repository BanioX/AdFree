// Vier in einer Reihe – gegen den Computer, drei Stärken.

import { boot, stage, fillTools } from '../lib/board/kit.js';
import { store } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { pickMove } from '../lib/board/ai.js';
import { newGame, apply, undo, aiOptions } from './logic.js';
import { tutorialSteps } from './tutorial.js';

const ID = 'vierer';
const ACCENT = '#2f7de1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function revive(raw) {
  if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== 42 || !Array.isArray(raw.h)) return null;
  const s = newGame();
  s.cells = raw.cells.slice();
  s.h = raw.h.slice();
  s.turn = raw.turn === 2 ? 2 : 1;
  s.n = raw.n | 0;
  s.over = !!raw.over;
  s.winner = raw.winner || 0;
  s.last = raw.last || null;
  s.line = raw.line || null;
  s.diff = raw.diff;
  s._u = Array.isArray(raw._u) ? raw._u : [];
  return s;
}

function art() {
  // Kleines Brett mit einer fast fertigen Viererreihe.
  const cells = [
    '', 'me', 'me', 'me', 'me', '', 'ai',
    'ai', '', '', '', '', 'me', '',
    '', '', 'ai', '', '', '', '',
    '', '', '', '', '', '', '',
    '', '', '', '', '', '', '',
    '', '', '', '', '', '', '',
  ];
  const board = h('div.c4-art');
  for (let r = 5; r >= 0; r--) {
    for (let c = 0; c < 7; c++) board.append(h('i', { class: cells[r * 7 + c] || '' }));
  }
  return board;
}

boot({
  id: ID,
  title: 'Vier in einer Reihe',
  tagline: 'Vier gleiche Steine in einer Linie',
  accent: ACCENT,
  confetti: ['#ffd23a', '#ff5a6a', '#5aa2f6', '#ffffff', '#ffb199'],
  steps: tutorialSteps,
  art,
  summary({ diff, bag, saved }) {
    if (saved && !saved.over) return 'Partie läuft';
    if (!bag.played) return 'Bereit für die erste Partie';
    return `${bag.wins} ${bag.wins === 1 ? 'Sieg' : 'Siege'}`;
  },
  start(ctx) {
    let dead = false;
    let busy = false;
    let ghost = null;
    let state = (ctx.saved && revive(ctx.saved)) || Object.assign(newGame(), { diff: ctx.diff });
    state.diff = state.diff || ctx.diff;

    const ui = stage({
      title: 'Vier in einer Reihe',
      sub: 'Du gelb · Computer rot',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    const board = h('div.c4');
    const holes = [];
    for (let c = 0; c < 7; c++) {
      const col = h('button.c4-col', { type: 'button', 'data-c': String(c), 'aria-label': `Reihe ${c + 1}` });
      holes[c] = [];
      for (let r = 5; r >= 0; r--) {
        const hole = h('div.c4-hole', { 'data-r': String(r) });
        holes[c][r] = hole;
        col.append(hole);
      }
      board.append(col);
    }
    ui.board.append(board);
    ctx.app.replaceChildren(ui.root);

    const lineSet = () => {
      const set = new Set();
      if (state.line) for (const [r, c] of state.line) set.add(r + ',' + c);
      return set;
    };

    function paint(fall) {
      const wins = lineSet();
      const showCoach = !state.n && !store.get(ID + '.coach') && state.turn === 1 && !state.over;
      for (let c = 0; c < 7; c++) {
        for (let r = 0; r < 6; r++) {
          const hole = holes[c][r];
          hole.replaceChildren();
          hole.classList.toggle('win', wins.has(r + ',' + c));
          const v = state.cells[r * 7 + c];
          if (v) {
            const d = h('i', { class: 'c4-disc ' + (v === 1 ? 'me' : 'ai') });
            if (fall && fall.r === r && fall.c === c && !reduced) {
              d.classList.add('fall');
              d.style.setProperty('--rows', String(5 - r));
            }
            hole.append(d);
          } else if (ghost && ghost.c === c && ghost.r === r) {
            hole.append(h('i', { class: 'c4-disc ' + (state.turn === 1 ? 'me' : 'ai') + ' ghost' }));
          }
          if (showCoach && c === 3 && r === state.h[3]) hole.append(h('span.bd-coach'));
        }
      }
      board.classList.toggle('locked', busy || state.over);
    }

    function persist() {
      ctx.save({
        cells: state.cells, h: state.h, turn: state.turn, n: state.n,
        over: state.over, winner: state.winner, last: state.last, line: state.line,
        diff: state.diff, _u: state._u,
      });
    }

    function status() {
      if (state.over) {
        if (state.winner === 1) ui.setStatus('Du gewinnst!', 'win');
        else if (state.winner === 2) ui.setStatus('Computer gewinnt', 'lose');
        else ui.setStatus('Unentschieden', '');
      } else if (busy && state.turn === 2) ui.setStatus('Computer überlegt …', '');
      else ui.setStatus('Du bist am Zug', 'you');
    }

    function paintTools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: 'Zurück', disabled: busy || !state._u.length, onClick: onUndo },
        { icon: 'hint', label: 'Tipp', disabled: busy || state.over || state.turn !== 1, onClick: onHint },
        { icon: 'refresh', label: 'Neu', disabled: busy, onClick: onNew },
      ]);
    }

    async function finishIfNeeded() {
      if (!state.over) return false;
      status();
      paintTools();
      const kind = state.winner === 1 ? 'win' : state.winner === 2 ? 'lose' : 'draw';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? 'Vier in einer Reihe!' : kind === 'lose' ? 'Knapp!' : 'Unentschieden',
        text: kind === 'win'
          ? 'Deine Steine bilden eine Linie.'
          : kind === 'lose'
            ? 'Der Computer war diesmal schneller.'
            : 'Das Brett ist voll – unentschieden.',
      });
      if (dead) return true;
      if (choice === 'menu') ctx.exit();
      else restart();
      return true;
    }

    function restart() {
      state = Object.assign(newGame(), { diff: ctx.diff });
      busy = false;
      ghost = null;
      persist();
      paint();
      status();
      paintTools();
    }

    async function onNew() {
      if (state.n && !state.over) {
        if (!(await confirmDialog('Neue Partie?', 'Die laufende Partie wird beendet.', 'Neu starten'))) return;
      }
      if (dead) return;
      restart();
    }

    function onUndo() {
      if (busy || !state._u.length) return;
      if (state.turn === 1 && state._u.length >= 2) { undo(state); undo(state); }
      else undo(state);
      ghost = null;
      sfx.play('click');
      persist();
      paint();
      status();
      paintTools();
    }

    async function onHint() {
      if (busy || state.over || state.turn !== 1) return;
      busy = true;
      paintTools();
      ui.setStatus('Einen Moment …', '');
      await sleep(20);
      if (dead) return;
      const col = pickMove({ ...aiOptions('mittel'), state, difficulty: 'mittel', noise: { mittel: 0 } });
      busy = false;
      if (dead || col == null || state.h[col] >= 6) { status(); paintTools(); return; }
      ghost = { c: col, r: state.h[col] };
      paint();
      sfx.play('sparkle');
      toast('Diese Reihe sieht gut aus.');
      status();
      paintTools();
    }

    async function play(col) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (state.h[col] >= 6) {
        sfx.play('error');
        toast('Diese Reihe ist voll.');
        const colEl = board.querySelector(`[data-c="${col}"]`);
        if (colEl) { colEl.classList.remove('sp-shake'); void colEl.offsetWidth; colEl.classList.add('sp-shake'); }
        return;
      }
      busy = true;
      ghost = null;
      store.set(ID + '.coach', true);
      apply(state, col);
      const mine = state.last;
      paint(mine);
      sfx.play('place');
      persist();
      paintTools();
      if (await finishIfNeeded()) return;
      status();
      await sleep(reduced ? 30 : 320);
      if (dead) return;
      const colAi = pickMove({ ...aiOptions(state.diff || ctx.diff), state });
      if (colAi == null) { busy = false; status(); paintTools(); return; }
      apply(state, colAi);
      paint(state.last);
      sfx.play(state.winner === 2 ? 'thud' : 'pop');
      persist();
      busy = false;
      paintTools();
      if (await finishIfNeeded()) return;
      status();
    }

    let hold = null;
    const colOf = (e) => {
      const el = e.target.closest?.('.c4-col');
      return el ? Number(el.dataset.c) : null;
    };
    board.addEventListener('pointerdown', (e) => {
      if (busy || state.over) return;
      const c = colOf(e);
      if (c == null) return;
      hold = c;
      board.setPointerCapture?.(e.pointerId);
      if (state.h[c] < 6) { ghost = { c, r: state.h[c] }; paint(); }
    });
    board.addEventListener('pointermove', (e) => {
      if (hold == null || busy) return;
      const c = colOf(e);
      if (c == null || state.h[c] >= 6) return;
      if (!ghost || ghost.c !== c) { ghost = { c, r: state.h[c] }; paint(); }
    });
    board.addEventListener('pointerup', (e) => {
      if (hold == null) return;
      const c = colOf(e);
      const chosen = c == null ? hold : c;
      hold = null;
      ghost = null;
      play(chosen);
    });
    board.addEventListener('pointercancel', () => { hold = null; ghost = null; paint(); });

    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);

    paint();
    status();
    paintTools();
    persist();

    window.__sp = {
      id: ID,
      state: () => state,
      drop: (c) => play(c),
      busy: () => busy,
    };

    return {
      destroy() {
        dead = true;
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onHide);
        if (window.__sp && window.__sp.id === ID) delete window.__sp;
      },
    };
  },
});
