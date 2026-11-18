import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { frameLoop } from '../lib/arcade/loop.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog, sleep } from '../shared/ui.js';
import { cellsOf, done, drop, fall, newWell, rotate, shift } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'bloecke';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#2f7de1',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.cells ? ctx.saved : newWell(ctx.diff, Date.now() % 100000);
    const diff = ctx.diff || 'mittel';
    const pace = diff === 'schwer' ? 320 : diff === 'leicht' ? 650 : 480;
    let acc = 0;
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.bl');
    ui.board.append(root);
    const grid = h('div.bl-grid');
    const keys = h('div.bl-keys', null,
      h('button', { type: 'button', 'data-act': 'left' }, tr('left')),
      h('button', { type: 'button', 'data-act': 'turn' }, tr('turn')),
      h('button', { type: 'button', 'data-act': 'right' }, tr('right')),
      h('button', { type: 'button', 'data-act': 'down' }, tr('down')));
    root.append(grid, keys);

    function persist() {
      ctx.save({ w: state.w, h: state.h, seed: state.seed, cells: state.cells.slice(), piece: state.piece, lines: state.lines, score: state.score, over: state.over, need: state.need, diff });
    }
    function paint() {
      const marks = Array(state.w * state.h).fill('');
      if (!state.over) for (const [c, r] of cellsOf(state.piece)) if (r >= 0) marks[r * state.w + c] = state.piece.k;
      grid.replaceChildren();
      for (let i = 0; i < marks.length; i++) {
        const kind = marks[i] || state.cells[i] || '';
        const cell = h('i');
        if (kind) cell.classList.add(kind);
        grid.append(cell);
      }
      const left = Math.max(0, state.need - state.lines);
      ui.setStatus(done(state) ? tr('win') : state.over ? tr('over') : tr('go', { n: left }), done(state) ? 'win' : '');
    }
    async function restart(force) {
      if (!force && state.score && !done(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newWell(diff, Date.now() % 100000);
      finishing = false;
      acc = 0;
      paint();
      persist();
    }
    async function finish(kind) {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('over'), text: String(state.score) });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    function act(name) {
      if (finishing || state.over || done(state)) return;
      const before = state.lines;
      if (name === 'left') state = shift(state, -1);
      else if (name === 'right') state = shift(state, 1);
      else if (name === 'turn') state = rotate(state);
      else if (name === 'down') state = drop(state);
      if (state.lines > before) sfx.play('fill');
      else sfx.play('click');
      paint();
      persist();
      if (done(state)) finish('win');
      else if (state.over) finish('lose');
    }
    onPress(root, '[data-act]', (el) => act(el.dataset.act));
    fillTools(ui.tools, [{ icon: 'refresh', label: bt('neu'), onClick: () => restart(false) }]);
    paint();
    const stop = frameLoop((dt) => {
      if (dead || finishing || state.over || done(state)) return;
      acc += dt;
      if (acc < pace) return;
      acc = 0;
      const before = state.lines;
      state = fall(state);
      if (state.lines > before) sfx.play('fill');
      paint();
      if (done(state)) finish('win');
      else if (state.over) finish('lose');
    });
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; stop(); } };
  },
});
