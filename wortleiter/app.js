import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { back, choices, hintStep, newLadder, play, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'wortleiter';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#2a9d8f',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.start ? { ...ctx.saved, chain: ctx.saved.chain.slice() } : newLadder(ctx.diff, Date.now(), which);
    state.which = which;
    let sel = -1;
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.wl');
    ui.board.append(root);

    function persist() { ctx.save({ start: state.start, goal: state.goal, chain: state.chain.slice(), len: state.len, diff, which }); }
    function paint() {
      const chain = h('div.wl-chain');
      state.chain.slice(0, -1).forEach((w) => chain.append(h('div', null, ...[...w].map((ch) => h('b', null, ch)))));
      const now = h('div.wl-now');
      [...state.chain.at(-1)].forEach((ch, i) => {
        const btn = h('button', { type: 'button', 'data-slot': String(i) }, ch);
        if (i === sel) btn.classList.add('on');
        now.append(btn);
      });
      const opts = h('div.wl-opts');
      if (sel >= 0) {
        const list = choices(state, sel, which);
        if (!list.length) opts.append(h('span', null, tr('none')));
        for (const ch of list) opts.append(h('button', { type: 'button', 'data-ch': ch }, ch));
      }
      root.replaceChildren(h('div.wl-goal', null, tr('goal', { word: state.goal })), chain, now, opts);
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'good' : '');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: state.chain.length < 2, onClick: () => { state = back(state); sel = -1; paint(); persist(); } },
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      const next = hintStep(state, which);
      if (next === state) { toast(tr('none')); return; }
      state = next;
      sel = -1;
      toast(tr('hint'));
      sfx.play('click');
      paint();
      persist();
      if (solved(state)) finish();
    }
    async function restart(force) {
      if (!force && state.chain.length > 1 && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newLadder(diff, Date.now(), which);
      sel = -1;
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      sfx.play('complete');
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish('win', { title: tr('win'), text: state.goal });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-slot]', (el) => { sel = +el.dataset.slot; sfx.play('click'); paint(); });
    onPress(root, '[data-ch]', (el) => {
      state = play(state, sel, el.dataset.ch, which);
      sel = -1;
      sfx.play('place');
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
