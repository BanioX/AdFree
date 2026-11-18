import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { move, newBoard, route, stuck, won } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'farbkugel';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#8a63d2',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.balls ? ctx.saved : newBoard(ctx.diff, Date.now() % 100000);
    let sel = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.fk5');
    ui.board.append(root);

    function persist() {
      ctx.save({
        balls: state.balls.slice(), colors: state.colors, upcoming: state.upcoming.slice(),
        lines: state.lines, need: state.need, score: state.score, rng: state.rng, diff,
      });
    }
    function paint() {
      const next = h('div.fk5-next');
      for (const color of state.upcoming) next.append(h('i.b' + color));
      const grid = h('div.fk5-grid');
      state.balls.forEach((color, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) });
        if (color >= 0) btn.append(h('i.b' + color));
        if (i === sel) btn.classList.add('on');
        grid.append(btn);
      });
      root.replaceChildren(next, grid);
      const left = Math.max(0, state.need - state.lines);
      ui.setStatus(won(state) ? tr('win') : tr('need', { n: left }), won(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      sel = -1;
      paint();
      persist();
    }
    async function restart(force) {
      if (!force && state.score && !won(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newBoard(diff, Date.now() % 100000);
      hist.length = 0;
      sel = -1;
      finishing = false;
      paint();
      persist();
    }
    async function finish(kind) {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('full'), text: String(state.score) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => {
      if (won(state)) return;
      const i = +el.dataset.i;
      if (state.balls[i] >= 0) { sel = i; sfx.play('click'); paint(); return; }
      if (sel < 0) return;
      if (!route(state.balls, sel, i)) { sfx.play('error'); toast(tr('blocked')); return; }
      hist.push(state);
      if (hist.length > 30) hist.shift();
      const before = state.lines;
      state = move(state, sel, i);
      sel = -1;
      sfx.play(state.lines > before ? 'sparkle' : 'place');
      paint();
      persist();
      if (won(state)) finish('win');
      else if (stuck(state)) finish('lose');
    });
    paint();
    persist();
    window.__sp = {
      id: ID,
      state: () => state,
      pair() {
        const balls = state.balls;
        const from = balls.findIndex((v) => v >= 0);
        const to = balls.findIndex((v, i) => v < 0 && route(balls, from, i));
        return { from, to };
      },
    };
    return { destroy() { dead = true; } };
  },
});
