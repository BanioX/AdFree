import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { builtList, cycle, hintPair, newPuzzle, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'bruecken';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#1f7aa8',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.islands ? ctx.saved : newPuzzle(ctx.diff, Date.now() % 100000);
    if (!state.built) state.built = {};
    let sel = null;
    let tip = null;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.pz');
    ui.board.append(root);

    function persist() {
      ctx.save({ w: state.w, h: state.h, islands: state.islands, solution: state.solution, built: { ...state.built }, diff });
    }
    function paint() {
      const mark = {};
      for (const br of builtList(state)) {
        const A = state.islands[br.a];
        const B = state.islands[br.b];
        if (A.r === B.r) {
          for (let c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) mark[A.r + ',' + c] = 'h' + br.n;
        } else {
          for (let r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) mark[r + ',' + A.c] = 'v' + br.n;
        }
      }
      const at = {};
      state.islands.forEach((isle, i) => { at[isle.r + ',' + isle.c] = i; });
      root.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      root.replaceChildren();
      for (let r = 0; r < state.h; r++) {
        for (let c = 0; c < state.w; c++) {
          const id = at[r + ',' + c];
          if (id == null) {
            const kind = mark[r + ',' + c];
            const cell = h('i');
            if (kind) {
              cell.className = kind;
              cell.append(h('b'));
              if (kind.endsWith('2')) cell.append(h('b'));
            }
            root.append(cell);
          } else {
            const btn = h('button.isle', { type: 'button', 'data-i': String(id) }, String(state.islands[id].n));
            if (sel === id) btn.classList.add('on');
            if (tip && tip.includes(id)) btn.classList.add('tip');
            root.append(btn);
          }
        }
      }
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      tip = hintPair(state);
      if (tip) sfx.play('sparkle');
      paint();
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      sel = null;
      tip = null;
      paint();
      persist();
    }
    async function restart(force) {
      if (!force && Object.keys(state.built).length && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newPuzzle(diff, Date.now() % 100000);
      hist.length = 0;
      sel = null;
      tip = null;
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
      tip = null;
      if (sel == null || sel === i) {
        sel = sel === i ? null : i;
        sfx.play('click');
        paint();
        return;
      }
      const next = cycle(state, sel, i);
      if (next === state || JSON.stringify(next.built) === JSON.stringify(state.built)) {
        toast(tr('bad'));
        sel = i;
        paint();
        return;
      }
      hist.push(state);
      if (hist.length > 40) hist.shift();
      state = next;
      sel = null;
      sfx.play('place');
      paint();
      persist();
      if (solved(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, pair: () => state.solution[0] };
    return { destroy() { dead = true; } };
  },
});
