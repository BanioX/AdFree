import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { current, hint, newRound, solved, take, undo } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'emoji';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#f0a020',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.word && ctx.saved.which === which ? ctx.saved : newRound(ctx.diff, Date.now(), which);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.ey');
    ui.board.append(root);

    function persist() {
      ctx.save({ emoji: state.emoji, word: state.word, bank: state.bank.slice(), picks: state.picks.slice(), which, len: state.len, diff });
    }
    function paint() {
      const built = current(state);
      const word = h('div.ey-word');
      if (built) word.append(h('button', { type: 'button', 'data-back': '1' }, built));
      const bank = h('div.ey-bank');
      state.bank.forEach((ch, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) }, ch);
        if (state.picks.includes(i)) btn.classList.add('used');
        bank.append(btn);
      });
      root.replaceChildren(h('div.ey-emoji', { 'aria-hidden': 'true' }, state.emoji), word, bank);
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'good' : '');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !state.picks.length, onClick: () => { state = undo(state); paint(); persist(); } },
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      state = hint(state);
      sfx.play('sparkle');
      paint();
      persist();
      if (solved(state)) finish();
    }
    async function restart(force) {
      if (!force && state.picks.length && !solved(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newRound(diff, Date.now(), which);
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
      const choice = await ctx.finish('win', { title: tr('win'), text: state.word });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => {
      if (solved(state)) return;
      state = take(state, +el.dataset.i);
      sfx.play('click');
      paint();
      persist();
      if (solved(state)) finish();
    });
    onPress(root, '[data-back]', () => {
      state = undo(state);
      paint();
      persist();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
