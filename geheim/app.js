import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { assign, decoded, encoded, hint, newPuzzle, solved } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'geheim';
const keysOf = (which) => (which === 'en' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ');

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#5b6b8c',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.text ? ctx.saved : newPuzzle(ctx.diff, Date.now(), which);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.gs');
    ui.board.append(root);

    function persist() { ctx.save({ ...state, diff, guess: { ...state.guess }, code: { ...state.code } }); }
    function paint() {
      const line = h('div.gs-line');
      for (const ch of encoded(state)) {
        if (state.code && Object.values(state.code).includes(ch)) {
          const btn = h('button', { type: 'button', 'data-sym': ch }, ch);
          if (state.sel === ch) btn.classList.add('on');
          line.append(btn);
        } else line.append(h('b', null, ch === ' ' ? '\u00a0' : ch));
      }
      const plain = h('div.gs-plain');
      for (const ch of decoded(state)) plain.append(h('b', null, ch === ' ' ? '\u00a0' : ch));
      const keys = h('div.gs-keys');
      const used = new Set(Object.values(state.guess));
      for (const ch of keysOf(which)) {
        const btn = h('button', { type: 'button', 'data-plain': ch }, ch);
        if (used.has(ch)) btn.classList.add('used');
        keys.append(btn);
      }
      root.replaceChildren(line, plain, keys);
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'good' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      state = hint(state);
      toast(tr('hint'));
      sfx.play('click');
      paint();
      persist();
      if (solved(state)) finish();
    }
    async function restart(force) {
      if (!force && Object.keys(state.guess).length && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newPuzzle(diff, Date.now(), which);
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
      const choice = await ctx.finish('win', { title: tr('win'), text: state.text });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-sym]', (el) => { state = { ...state, sel: el.dataset.sym }; sfx.play('click'); paint(); });
    onPress(root, '[data-plain]', (el) => {
      if (!state.sel || solved(state)) return;
      state = assign(state, state.sel, el.dataset.plain);
      sfx.play('place');
      paint();
      persist();
      if (solved(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, encoded: () => encoded(state) };
    return { destroy() { dead = true; } };
  },
});
