import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { current, hint, newRound, solved, take, undo } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'anagramm';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#d4564e',
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
    const root = h('div.ag');
    ui.board.append(root);
    function persist() { ctx.save({ ...state, diff, tiles: state.tiles.slice(), picked: state.picked.slice() }); }
    function paint() {
      const word = h('div.ag-word');
      state.picked.forEach((index, n) => {
        word.append(h('button', { type: 'button', 'data-back': '1' }, state.tiles[index]));
        if (n === 0) { /* keep */ }
      });
      if (!state.picked.length) word.append(h('button', { type: 'button', disabled: 'true' }, '·'));
      const tiles = h('div.ag-tiles');
      state.tiles.forEach((ch, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) }, ch);
        if (state.picked.includes(i)) btn.classList.add('used');
        tiles.append(btn);
      });
      root.replaceChildren(word, tiles);
      ui.setStatus(solved(state) ? tr('win') : tr('go'), solved(state) ? 'good' : '');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !state.picked.length, onClick: back },
        { icon: 'hint', label: bt('hint'), disabled: solved(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function back() { state = undo(state); paint(); persist(); }
    function showHint() {
      state = hint(state);
      toast(tr('hint'));
      sfx.play('click');
      paint();
      persist();
      if (solved(state)) finish();
    }
    async function restart(force) {
      if (!force && state.picked.length && !solved(state)) {
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
      sfx.play(solved(state) ? 'fill' : 'click');
      paint();
      persist();
      if (solved(state)) finish();
    });
    onPress(root, '[data-back]', () => back());
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, current: () => current(state) };
    return { destroy() { dead = true; } };
  },
});
