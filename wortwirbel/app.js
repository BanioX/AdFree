import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { done, extend, newBoard, score, wordFrom } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'wortwirbel';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#3c8d4e',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.grid ? ctx.saved : newBoard(ctx.diff, Date.now(), which);
    let path = [];
    let zeit = false;
    let left = 0;
    let clock = null;
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.ww');
    ui.board.append(root);

    function persist() {
      ctx.save({ grid: state.grid.slice(), words: state.words.slice(), paths: state.paths, found: state.found.slice(), bonus: state.bonus || [], min: state.min, diff });
    }
    if (!state.bonus) state.bonus = [];
    function paint() {
      const grid = h('div.ww-grid');
      state.grid.forEach((ch, i) => {
        const btn = h('button', { type: 'button', 'data-i': String(i) }, ch);
        if (path.includes(i)) btn.classList.add('on');
        grid.append(btn);
      });
      const found = h('div.ww-found');
      for (const w of state.found) found.append(h('b', null, w));
      for (const w of state.bonus) found.append(h('i', null, w));
      root.replaceChildren(
        h('div.ww-entry', null, wordFrom(state.grid, path) || (zeit ? left + 's' : '·')),
        grid,
        h('div.ww-actions', null,
          h('button', { type: 'button', 'data-act': 'clear' }, tr('clear')),
          h('button.ok', { type: 'button', 'data-act': 'ok' }, '✓')),
        found);
      const n = state.words.filter((w) => !state.found.includes(w)).length;
      ui.setStatus(n ? tr('need', { n }) : tr('done'), n ? '' : 'good');
      fillTools(ui.tools, [
        { icon: 'hint', label: bt('hint'), disabled: done(state), onClick: showHint },
        { icon: 'bolt', label: zeit ? left + 's' : tr('time'), onClick: arm },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function arm() {
      if (zeit || done(state)) return;
      zeit = true;
      left = 60;
      clock = setInterval(() => {
        left -= 1;
        paint();
        if (left <= 0) { clearInterval(clock); toast(tr('timeUp')); finish(true); }
      }, 1000);
      paint();
    }
    function showHint() {
      const word = state.words.find((w) => !state.found.includes(w));
      if (!word) return;
      state = { ...state, found: state.found.concat(word) };
      path = [];
      toast(word);
      paint();
      persist();
      if (done(state)) finish(false);
    }
    function submit() {
      const res = score(state, path, which);
      path = [];
      if (res.kind === 'found') {
        state = { ...state, found: state.found.concat(res.word) };
        sfx.play('fill');
      } else if (res.kind === 'bonus') {
        state = { ...state, bonus: state.bonus.concat(res.word) };
        sfx.play('sparkle');
        toast(tr('bonus'));
      } else if (res.kind) {
        if (res.kind === 'no') sfx.play('error');
        toast(tr(res.kind));
      }
      paint();
      persist();
      if (done(state)) finish(false);
    }
    async function restart(force) {
      if (!force && state.found.length && !done(state)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      if (clock) clearInterval(clock);
      zeit = false;
      state = newBoard(diff, Date.now(), which);
      path = [];
      finishing = false;
      paint();
      persist();
    }
    async function finish(timeUp) {
      if (finishing || dead) return;
      finishing = true;
      if (clock) clearInterval(clock);
      sfx.play(timeUp ? 'thud' : 'complete');
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(timeUp ? 'draw' : 'win', {
        title: timeUp ? tr('timeUp') : tr('done'),
        text: String(state.found.length),
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => { path = extend(path, +el.dataset.i); sfx.play('click'); paint(); });
    onPress(root, '[data-act="clear"]', () => { path = []; paint(); });
    onPress(root, '[data-act="ok"]', submit);
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, pathOf: (w) => state.paths[w] };
    return { destroy() { dead = true; if (clock) clearInterval(clock); } };
  },
});
