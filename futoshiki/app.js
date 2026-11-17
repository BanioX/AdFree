import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { hintCell, newPuzzle, put, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'futoshiki';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#6a4cc4',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.grid ? ctx.saved : newPuzzle(ctx.diff, Date.now() % 100000);
    let sel = state.grid.findIndex((v) => v == null);
    if (sel < 0) sel = 0;
    let tip = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.fu');
    ui.board.append(root);

    function persist() {
      ctx.save({ n: state.n, solution: state.solution, clues: state.clues, fixed: state.fixed, grid: state.grid.slice(), diff });
    }
    function sign(a, b) {
      const clue = state.clues.find((item) => item.a === a && item.b === b);
      if (!clue) return '';
      const horiz = b === a + 1;
      if (clue.lt) return horiz ? '‹' : '∧';
      return horiz ? '›' : '∨';
    }
    function paint() {
      const n = state.n;
      const span = n * 2 - 1;
      const grid = h('div.fu-grid');
      grid.style.gridTemplateColumns = Array.from({ length: span }, (_, i) => (i % 2 ? '16px' : '42px')).join(' ');
      grid.style.gridTemplateRows = Array.from({ length: span }, (_, i) => (i % 2 ? '16px' : '42px')).join(' ');
      for (let r = 0; r < span; r++) {
        for (let c = 0; c < span; c++) {
          if (r % 2 === 0 && c % 2 === 0) {
            const i = (r / 2) * n + c / 2;
            const v = state.grid[i];
            const btn = h('button', { type: 'button', 'data-i': String(i) }, v == null ? '' : String(v));
            if (i === sel) btn.classList.add('on');
            if (state.fixed[i] != null) btn.classList.add('given');
            if (i === tip) btn.classList.add('tip');
            grid.append(btn);
          } else if (r % 2 === 0 && c % 2 === 1) {
            const a = (r / 2) * n + (c - 1) / 2;
            grid.append(h('i', null, sign(a, a + 1)));
          } else if (r % 2 === 1 && c % 2 === 0) {
            const a = ((r - 1) / 2) * n + c / 2;
            grid.append(h('i', null, sign(a, a + n)));
          } else grid.append(h('i'));
        }
      }
      const nums = h('div.fu-nums');
      for (let v = 1; v <= n; v++) nums.append(h('button', { type: 'button', 'data-n': String(v) }, String(v)));
      root.replaceChildren(grid, nums);
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      tip = hintCell(state);
      if (tip >= 0) {
        sel = tip;
        toast(tr('hint', { n: state.solution[tip] }));
      }
      sfx.play('sparkle');
      paint();
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      tip = -1;
      paint();
      persist();
    }
    async function restart(force) {
      const dirty = state.grid.some((v, i) => v !== state.fixed[i]);
      if (!force && dirty && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newPuzzle(diff, Date.now() % 100000);
      sel = state.grid.findIndex((v) => v == null);
      hist.length = 0;
      tip = -1;
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish('win', { title: tr('win'), text: '' });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => { sel = +el.dataset.i; tip = -1; sfx.play('click'); paint(); });
    onPress(root, '[data-n]', (el) => {
      if (solved(state) || state.fixed[sel] != null) return;
      hist.push(state);
      state = put(state, sel, +el.dataset.n);
      tip = -1;
      sfx.play('place');
      paint();
      persist();
      if (solved(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
