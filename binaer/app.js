import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { hintCell, newPuzzle, setCell, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'binaer';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#4a6fa5',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.grid ? ctx.saved : newPuzzle(ctx.diff, Date.now() % 100000);
    let tip = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.pz');
    ui.board.append(root);

    function persist() {
      ctx.save({ w: state.w, solution: state.solution, fixed: state.fixed, grid: state.grid.slice(), diff });
    }
    function paint() {
      root.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      root.replaceChildren();
      state.grid.forEach((v, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) }, v == null ? '' : String(v));
        if (state.fixed[i] != null) btn.classList.add('given');
        if (v === 0) btn.classList.add('bn0');
        if (v === 1) btn.classList.add('bn1');
        if (i === tip) btn.classList.add('tip');
        root.append(btn);
      });
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      tip = hintCell(state);
      if (tip >= 0) toast(tr('hint', { n: state.solution[tip] }));
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
    onPress(root, '[data-i]', (el) => {
      if (solved(state)) return;
      const i = +el.dataset.i;
      if (state.fixed[i] != null) return;
      hist.push(state);
      if (hist.length > 60) hist.shift();
      tip = -1;
      state = setCell(state, i);
      sfx.play('click');
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
