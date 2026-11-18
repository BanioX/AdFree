import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog, sleep } from '../shared/ui.js';
import { hintCell, newPuzzle, press, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'lichter';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#e6a317',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.on ? ctx.saved : newPuzzle(ctx.diff, Date.now() % 100000);
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
      ctx.save({ w: state.w, h: state.h, on: state.on.slice(), need: state.need.slice(), diff });
    }
    function paint() {
      root.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      root.replaceChildren();
      state.on.forEach((lit, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) });
        if (lit) btn.classList.add('lit');
        if (i === tip) btn.classList.add('tip');
        root.append(btn);
      });
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: () => { tip = hintCell(state); sfx.play('sparkle'); paint(); } },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
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
      if (!force && hist.length && !solved(state)) {
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
      hist.push(state);
      if (hist.length > 40) hist.shift();
      tip = -1;
      state = press(state, +el.dataset.i);
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
