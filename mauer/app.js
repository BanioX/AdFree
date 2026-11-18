import { boot, stage, fillTools, bt } from '../lib/board/kit.js';
import { frameLoop } from '../lib/arcade/loop.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { cleared, newWall, stepBall } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'mauer';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#c45c26',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.bricks ? ctx.saved : newWall(ctx.diff);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.mw');
    ui.board.append(root);
    const ball = h('i.ball');
    const pad = h('i.pad');
    root.append(ball, pad);

    function placePaddle(clientX) {
      const rect = root.getBoundingClientRect();
      state = { ...state, paddle: Math.max(0.12, Math.min(0.88, (clientX - rect.left) / rect.width)) };
    }
    root.addEventListener('pointerdown', (e) => placePaddle(e.clientX));
    root.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') placePaddle(e.clientX); });
    root.addEventListener('click', (e) => placePaddle(e.clientX));
    function paint(full) {
      if (full) {
        root.querySelectorAll('.brick').forEach((el) => el.remove());
        state.bricks.forEach((brick) => {
          if (!brick.on) return;
          const el = h('i.brick');
          el.style.left = (brick.c / state.cols * 100) + '%';
          el.style.top = (8 + brick.r * 8) + '%';
          el.style.width = (100 / state.cols - 1) + '%';
          el.style.height = '6.2%';
          root.insertBefore(el, ball);
        });
      } else {
        const nodes = root.querySelectorAll('.brick');
        let n = 0;
        state.bricks.forEach((brick) => { if (brick.on) n += 1; });
        if (nodes.length !== n) paint(true);
      }
      ball.style.left = (state.ball.x * 100) + '%';
      ball.style.top = (state.ball.y * 100) + '%';
      pad.style.left = ((state.paddle - 0.11) * 100) + '%';
      pad.style.width = '22%';
      const left = state.bricks.filter((b) => b.on).length;
      ui.setStatus(cleared(state) ? tr('win') : tr('go', { n: left }), cleared(state) ? 'win' : '');
    }
    async function restart(force) {
      if (!force && state.score && !cleared(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newWall(diff);
      finishing = false;
      paint(true);
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
    paint(true);
    let shownMiss = false;
    const stop = frameLoop((dt) => {
      if (dead || finishing || cleared(state)) return;
      const next = stepBall(state, dt, state.paddle);
      if (next.score > state.score) sfx.play('pop');
      if (next.dropped && !shownMiss) { shownMiss = true; toast(tr('miss')); }
      if (!next.dropped) shownMiss = false;
      const rebuilt = next.bricks.filter((b) => b.on).length !== state.bricks.filter((b) => b.on).length;
      if (next.score !== state.score) {
        ctx.save({ cols: next.cols, rows: next.rows, bricks: next.bricks, score: next.score, ball: next.ball, paddle: next.paddle, diff });
      }
      state = next;
      paint(rebuilt);
      if (cleared(state)) finish();
    });
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; stop(); } };
  },
});
