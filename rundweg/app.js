import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { generate, act, paint, solved, hint } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'rundweg';

function fresh(diff) {
  const base = Date.now() % 100000;
  for (let k = 0; k < 8; k++) {
    try { return generate(diff, base + k * 13 + 1); } catch { /* nächster Keim */ }
  }
  return generate(diff, 1);
}

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#7b5ea7',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.clue ? ctx.saved : fresh(ctx.diff);
    const diff = state.diff || ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.pz');
    ui.board.append(root);

    function persist() { ctx.save(state); }
    function draw() {
      root.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      root.replaceChildren();
      for (let i = 0; i < state.w * state.h; i++) {
        const cell = paint(state, i);
        const btn = h('button', { type: 'button', 'data-i': String(i), 'aria-label': cell.aria || tr('title') }, cell.text);
        btn.className = cell.cls;
        root.append(btn);
      }
      const done = solved(state);
      ui.setStatus(done ? tr('win') : tr('go'), done ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: done, onClick: showHint },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      const prev = JSON.parse(JSON.stringify(state));
      const res = hint(state);
      if (!res.ok) { state = prev; toast(tr('none')); return; }
      hist.push(prev);
      toast(tr('hint'));
      sfx.play('sparkle');
      draw();
      persist();
      if (res.win) finish();
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      draw();
      persist();
    }
    async function restart(force) {
      if (!force && hist.length && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = fresh(diff);
      hist.length = 0;
      finishing = false;
      draw();
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
      const prev = JSON.parse(JSON.stringify(state));
      const res = act(state, +el.dataset.i);
      if (!res.ok) { state = prev; return; }
      hist.push(prev);
      if (hist.length > 80) hist.shift();
      sfx.play(res.sound || 'click');
      draw();
      persist();
      if (res.win) finish();
    });
    draw();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
