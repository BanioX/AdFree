import { boot, stage, fillTools, bt } from '../lib/board/kit.js';
import { frameLoop } from '../lib/arcade/loop.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { newSnake, reached, step, turn } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'schlange';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#3c8d4e',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.snake ? ctx.saved : newSnake(ctx.diff, Date.now() % 100000);
    const diff = ctx.diff || 'mittel';
    const pace = diff === 'schwer' ? 110 : diff === 'leicht' ? 180 : 140;
    let acc = 0;
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.sn');
    ui.board.append(root);

    function persist() {
      ctx.save({ w: state.w, h: state.h, seed: state.seed, snake: state.snake.slice(), dir: state.dir, food: state.food, score: state.score, blocked: false, goal: state.goal, diff });
    }
    function paint() {
      const need = state.snake.length + (state.food >= 0 ? 1 : 0);
      while (root.children.length < need) root.append(h('i'));
      while (root.children.length > need) root.lastChild.remove();
      state.snake.forEach((cell, i) => {
        const el = root.children[i];
        el.className = i === 0 ? 'head' : '';
        el.style.transform = `translate(${(cell % state.w) * 100}%, ${Math.floor(cell / state.w) * 100}%)`;
      });
      if (state.food >= 0) {
        const food = root.children[state.snake.length];
        food.className = 'food';
        food.style.transform = `translate(${(state.food % state.w) * 100}%, ${Math.floor(state.food / state.w) * 100}%)`;
      }
      const left = Math.max(0, state.goal - state.snake.length);
      ui.setStatus(reached(state) ? tr('win') : tr('go', { n: left }), reached(state) ? 'win' : '');
    }
    function aim(clientX, clientY) {
      if (finishing || reached(state)) return;
      const rect = root.getBoundingClientRect();
      const head = state.snake[0];
      const hx = ((head % state.w) + 0.5) / state.w * rect.width;
      const hy = (Math.floor(head / state.w) + 0.5) / state.h * rect.height;
      const x = clientX - rect.left - hx;
      const y = clientY - rect.top - hy;
      const next = Math.abs(x) > Math.abs(y) ? turn(state, x > 0 ? 1 : -1, 0) : turn(state, 0, y > 0 ? 1 : -1);
      if (next !== state) { state = next; sfx.play('click'); }
    }
    root.addEventListener('pointerup', (e) => aim(e.clientX, e.clientY));
    root.addEventListener('click', (e) => aim(e.clientX, e.clientY));
    async function restart(force) {
      if (!force && state.score && !reached(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newSnake(diff, Date.now() % 100000);
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
    fillTools(ui.tools, [{ icon: 'refresh', label: bt('neu'), onClick: () => restart(false) }]);
    paint();
    const stop = frameLoop((dt) => {
      if (dead || finishing || reached(state)) return;
      acc += dt;
      if (acc < pace) return;
      acc = 0;
      const next = step(state);
      if (next.blocked && !state.blocked) toast(tr('self'));
      else if (next.score > state.score) sfx.play('pop');
      state = next;
      paint();
      persist();
      if (reached(state)) finish();
    });
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; stop(); } };
  },
});
