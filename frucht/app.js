import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { COLS, ROWS, drop, full, newBowl, won } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'frucht';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#e25b4a',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.grid ? ctx.saved : newBowl(ctx.diff, Date.now() % 100000);
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.fr');
    ui.board.append(root);

    function persist() {
      ctx.save({
        cols: state.cols, rows: state.rows, grid: state.grid.slice(),
        current: state.current, next: state.next, goal: state.goal,
        score: state.score, seed: state.seed, rng: state.rng, diff: state.diff,
      });
    }
    function paint() {
      const preview = h('div.fr-next', null,
        h('b.f' + state.current),
        h('b.small.f' + state.next));
      const grid = h('div.fr-grid');
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = state.grid[r * COLS + c];
          const btn = h('button', { type: 'button', 'data-c': String(c) });
          if (v) btn.append(h('i.f' + v));
          grid.append(btn);
        }
      }
      root.replaceChildren(preview, grid);
      ui.setStatus(won(state) ? tr('win') : tr('goal', { n: state.goal }) + ' · ' + tr('score', { n: state.score }), won(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      paint();
      persist();
    }
    async function restart(force) {
      if (!force && state.score && !won(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newBowl(diff, Date.now() % 100000);
      hist.length = 0;
      finishing = false;
      paint();
      persist();
    }
    async function finish(kind) {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('bowl'), text: tr('score', { n: state.score }) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-c]', (el) => {
      if (won(state) || full(state)) return;
      const col = +el.dataset.c;
      const before = state.grid[col] ? 'top' : '';
      const next = drop(state, col);
      if (next === state) { sfx.play('error'); toast(tr('full')); return; }
      hist.push(state);
      if (hist.length > 30) hist.shift();
      const jumped = next.score - state.score;
      state = next;
      sfx.play(jumped > 12 ? 'sparkle' : 'pop');
      if (jumped > 20) toast(tr('super'));
      paint();
      const piece = root.querySelector('.fr-grid button[data-c="' + col + '"] i');
      if (piece) piece.classList.add('pop');
      persist();
      if (won(state)) finish('win');
      else if (full(state)) finish('lose');
      else if (before) { /* column was not the point */ }
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
