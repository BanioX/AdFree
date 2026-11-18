import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { filled, hint, newPuzzle } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'kreuzwort';
const keysOf = (which) => (which === 'en' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ');

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#3a6ea5',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.mask ? ctx.saved : newPuzzle(ctx.diff, Date.now(), which);
    let sel = state.clues[0];
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.xw');
    ui.board.append(root);

    function key(r, c) { return r + ',' + c; }
    function persist() { ctx.save({ mask: state.mask, clues: state.clues, fill: { ...state.fill }, which, diff }); }
    function numbers() {
      const map = {};
      for (const clue of state.clues) if (map[key(clue.r, clue.c)] == null) map[key(clue.r, clue.c)] = clue.n;
      return map;
    }
    function paint() {
      const nums = numbers();
      const grid = h('div.xw-grid');
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (state.mask[r][c] === '#') { grid.append(h('i')); continue; }
          const btn = h('button', { type: 'button', 'data-cell': key(r, c) }, state.fill[key(r, c)] || '');
          if (sel && sel.r === r && sel.c === c) btn.classList.add('on');
          if (nums[key(r, c)]) btn.append(h('s', null, String(nums[key(r, c)])));
          grid.append(btn);
        }
      }
      const clues = h('div.xw-clues');
      for (const clue of state.clues) {
        clues.append(h('button', { type: 'button', 'data-clue': String(clue.n) + clue.dir }, (clue.dir === 'a' ? tr('across') : tr('down')) + ' ' + clue.n + '  ' + clue.text));
      }
      const keys = h('div.xw-keys');
      for (const ch of keysOf(which)) keys.append(h('button', { type: 'button', 'data-ch': ch }, ch));
      root.replaceChildren(grid, clues, keys);
      ui.setStatus(filled(state) ? tr('win') : (sel ? (sel.dir === 'a' ? tr('across') : tr('down')) + ' ' + sel.n + ': ' + sel.text : tr('go')), filled(state) ? 'good' : '');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: filled(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function showHint() {
      state = hint(state);
      toast(tr('hint'));
      paint();
      persist();
      if (filled(state)) finish();
    }
    async function restart(force) {
      if (!force && Object.keys(state.fill).length && !filled(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newPuzzle(diff, Date.now(), which);
      sel = state.clues[0];
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
      const choice = await ctx.finish('win', { title: tr('win'), text: '' });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-cell]', (el) => {
      const [r, c] = el.dataset.cell.split(',').map(Number);
      sel = state.clues.find((clue) => clue.r === r && clue.c === c) || { r, c, dir: 'a', n: '', text: '' };
      sfx.play('click');
      paint();
    });
    onPress(root, '[data-clue]', (el) => {
      const id = el.dataset.clue;
      sel = state.clues.find((clue) => String(clue.n) + clue.dir === id) || sel;
      paint();
    });
    onPress(root, '[data-ch]', (el) => {
      if (!sel || filled(state)) return;
      state = { ...state, fill: { ...state.fill, [key(sel.r, sel.c)]: el.dataset.ch } };
      sfx.play('place');
      paint();
      persist();
      if (filled(state)) finish();
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
