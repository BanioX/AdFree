import { boot, stage, fillTools, bt } from '../lib/board/kit.js';
import { frameLoop } from '../lib/arcade/loop.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { built, land, newTower, slide } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'turm';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#c4843a',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.stack ? ctx.saved : newTower(ctx.diff);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.tw');
    ui.board.append(root);
    const mover = h('i.live');
    root.append(mover);

    function drawStack() {
      root.querySelectorAll('i:not(.live)').forEach((el) => el.remove());
      state.stack.forEach((piece, i) => {
        const el = h('i');
        el.style.left = (piece.x * 100) + '%';
        el.style.width = (piece.w * 100) + '%';
        el.style.bottom = (8 + i * 24) + 'px';
        root.insertBefore(el, mover);
      });
    }
    function paint() {
      mover.style.left = (state.x * 100) + '%';
      mover.style.width = (state.width * 100) + '%';
      mover.style.bottom = (8 + state.stack.length * 24) + 'px';
      mover.hidden = state.over || built(state);
      const left = Math.max(0, state.goal - state.stack.length);
      ui.setStatus(built(state) ? tr('win') : state.over ? tr('miss') : tr('go', { n: left }), built(state) ? 'win' : '');
    }
    function persist() {
      ctx.save({ x: state.x, dir: state.dir, speed: state.speed, width: state.width, stack: state.stack, goal: state.goal, over: state.over, perfect: state.perfect, diff });
    }
    async function restart(force) {
      if (!force && state.stack.length > 1 && !built(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newTower(diff);
      finishing = false;
      drawStack();
      paint();
      persist();
    }
    async function finish(kind) {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('miss'), text: String(state.stack.length) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    function drop() {
      if (finishing || state.over || built(state)) return;
      const before = state.perfect;
      state = land(state);
      sfx.play(state.perfect > before ? 'sparkle' : state.over ? 'thud' : 'place');
      if (state.perfect > before) toast(tr('perfect'));
      drawStack();
      paint();
      persist();
      if (built(state)) finish('win');
      else if (state.over) finish('lose');
    }
    let fromPointer = 0;
    root.addEventListener('pointerup', () => { fromPointer = performance.now(); drop(); });
    root.addEventListener('click', () => { if (fromPointer && performance.now() - fromPointer < 500) return; drop(); });
    fillTools(ui.tools, [{ icon: 'refresh', label: bt('neu'), onClick: () => restart(false) }]);
    drawStack();
    paint();
    const stop = frameLoop((dt) => {
      if (dead || finishing || state.over || built(state)) return;
      state = slide(state, dt);
      paint();
    });
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; stop(); } };
  },
});
