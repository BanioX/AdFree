import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { guess, hint, lost, newRound, won } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'jagd';
const keysOf = (which) => (which === 'en' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ');

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#e05a8a',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.word ? ctx.saved : newRound(ctx.diff, Date.now(), which);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.jg');
    ui.board.append(root);

    function persist() { ctx.save({ ...state, diff, guesses: state.guesses.slice() }); }
    function paint() {
      const flower = h('div.jg-flower');
      const petals = Math.max(0, 6 - state.wrong);
      for (let i = 0; i < petals; i++) flower.append(h('i'));
      if (state.wrong < 7) { flower.append(h('b')); flower.append(h('s')); }
      const word = h('div.jg-word');
      for (const ch of state.word) word.append(h('b', null, state.guesses.includes(ch) || lost(state) ? ch : ''));
      const keys = h('div.jg-keys');
      for (const ch of keysOf(which)) {
        const btn = h('button', { type: 'button', 'data-ch': ch }, ch);
        if (state.guesses.includes(ch)) btn.classList.add(state.word.includes(ch) ? 'good' : 'bad');
        keys.append(btn);
      }
      root.replaceChildren(flower, word, keys);
      ui.setStatus(won(state) ? tr('win') : lost(state) ? tr('lose', { word: state.word }) : tr('left', { n: state.max - state.wrong }), won(state) ? 'good' : lost(state) ? 'bad' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: won(state) || lost(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      state = hint(state);
      sfx.play('click');
      paint();
      persist();
      end();
    }
    async function restart(force) {
      if (!force && state.guesses.length && !won(state) && !lost(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newRound(diff, Date.now(), which);
      finishing = false;
      paint();
      persist();
    }
    async function end() {
      if (finishing || dead || (!won(state) && !lost(state))) return;
      finishing = true;
      const kind = won(state) ? 'win' : 'lose';
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('lose', { word: state.word }), text: state.word });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-ch]', (el) => {
      if (won(state) || lost(state)) return;
      const before = state.wrong;
      state = guess(state, el.dataset.ch);
      sfx.play(state.wrong === before ? 'fill' : 'thud');
      paint();
      persist();
      end();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
