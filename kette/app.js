import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { cleared, groupAt, hintIndex, newChain, pop } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'kette';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#4fa3e3',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.balls ? ctx.saved : newChain(ctx.diff, Date.now() % 100000);
    let tip = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.kk');
    ui.board.append(root);

    function persist() { ctx.save({ balls: state.balls.slice(), colors: state.colors, score: state.score, diff }); }
    function paint() {
      root.replaceChildren();
      const mark = tip >= 0 ? groupAt(state.balls, tip) : null;
      state.balls.forEach((color, i) => {
        const btn = h('button.c' + color, { type: 'button', 'data-i': String(i) });
        if (mark && i >= mark.a && i <= mark.b) btn.classList.add('tip');
        root.append(btn);
      });
      ui.setStatus(cleared(state) ? tr('win') : tr('left', { n: state.balls.length }), cleared(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: cleared(state), onClick: () => { tip = hintIndex(state); sfx.play('sparkle'); paint(); } },
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
      if (!force && state.score && !cleared(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newChain(diff, Date.now() % 100000);
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
      const choice = await ctx.finish('win', { title: tr('win'), text: String(state.score) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => {
      if (cleared(state)) return;
      const i = +el.dataset.i;
      const group = groupAt(state.balls, i);
      if (!group || group.n < 3) { sfx.play('error'); toast(tr('short')); return; }
      hist.push(state);
      tip = -1;
      state = pop(state, i);
      sfx.play('pop');
      paint();
      persist();
      if (cleared(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, hint: () => hintIndex(state) };
    return { destroy() { dead = true; } };
  },
});
