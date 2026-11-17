import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog, sleep } from '../shared/ui.js';
import { bestColor, done, flood, newFlood } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'farbklick';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#d0447c',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.grid ? ctx.saved : newFlood(ctx.diff, Date.now() % 100000);
    let tip = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.fk');
    ui.board.append(root);

    function persist() { ctx.save({ w: state.w, colors: state.colors, grid: state.grid.slice(), moves: state.moves, diff }); }
    function paint() {
      const grid = h('div.fk-grid');
      grid.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      state.grid.forEach((color) => grid.append(h('i.d' + color)));
      const colors = h('div.fk-colors');
      for (let c = 0; c < state.colors; c++) {
        const btn = h('button.d' + c, { type: 'button', 'data-color': String(c) });
        if (c === tip) btn.classList.add('tip');
        colors.append(btn);
      }
      root.replaceChildren(grid, colors);
      ui.setStatus(done(state) ? tr('win') : tr('moves', { n: state.moves }), done(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: done(state), onClick: () => { tip = bestColor(state); sfx.play('sparkle'); paint(); } },
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
      if (!force && state.moves && !done(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newFlood(diff, Date.now() % 100000);
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
      const choice = await ctx.finish('win', { title: tr('win'), text: tr('moves', { n: state.moves }) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-color]', (el) => {
      if (done(state)) return;
      const color = +el.dataset.color;
      const next = flood(state, color);
      if (next === state) return;
      hist.push(state);
      if (hist.length > 40) hist.shift();
      tip = -1;
      state = next;
      sfx.play('fill');
      paint();
      persist();
      if (done(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, best: () => bestColor(state) };
    return { destroy() { dead = true; } };
  },
});
