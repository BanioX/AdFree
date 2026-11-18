import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { backspace, canAdd, done, hint, newPuzzle, submit, typeLetter } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'wortkreis';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#7a4dd6',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.letters ? ctx.saved : newPuzzle(ctx.diff, Date.now() ^ (Math.random() * 1e9), which);
    if (!state.min) state.min = 3;
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.wk');
    ui.board.append(root);

    function persist() {
      const snap = { ...state, diff, found: state.found.slice(), bonus: state.bonus.slice(), letters: state.letters.slice(), words: state.words.slice() };
      ctx.save(snap);
    }
    function paint() {
      const entry = h('div.wk-entry', null, state.entry || '·');
      const wheel = h('div.wk-wheel');
      state.letters.forEach((ch, i) => {
        const n = state.letters.length;
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const btn = h('button', { type: 'button', 'data-ch': ch }, ch);
        btn.style.left = (50 + Math.cos(a) * 38) + '%';
        btn.style.top = (50 + Math.sin(a) * 38) + '%';
        if (!canAdd(state, ch)) btn.classList.add('used');
        wheel.append(btn);
      });
      const actions = h('div.wk-actions', null,
        h('button', { type: 'button', 'data-act': 'clear' }, tr('clear')),
        h('button.ok', { type: 'button', 'data-act': 'ok' }, '✓'));
      const found = h('div.wk-found');
      for (const w of state.found) found.append(h('b', null, w));
      for (const w of state.bonus) found.append(h('i', null, w));
      root.replaceChildren(entry, wheel, actions, found);
      const left = state.words.filter((w) => !state.found.includes(w)).length;
      ui.setStatus(left ? tr('need', { n: left }) : tr('done'), left ? '' : 'good');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !state.found.length && !state.bonus.length, onClick: undo },
        { icon: 'hint', label: bt('hint'), disabled: done(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function push(next, kind) {
      state = next;
      if (kind === 'found') sfx.play('fill');
      else if (kind === 'bonus') { sfx.play('sparkle'); toast(tr('bonus')); }
      else if (kind === 'no') { sfx.play('error'); toast(tr('no')); }
      else if (kind === 'short') toast(tr('short'));
      else if (kind === 'repeat') toast(tr('repeat'));
      paint();
      persist();
      if (done(state)) finish();
    }
    function undo() {
      if (state.bonus.length) state = { ...state, bonus: state.bonus.slice(0, -1) };
      else if (state.found.length) state = { ...state, found: state.found.slice(0, -1) };
      else return;
      sfx.play('click');
      paint();
      persist();
    }
    function showHint() {
      if (done(state)) return;
      state = hint(state);
      toast(tr('hint'));
      sfx.play('click');
      paint();
      persist();
      if (done(state)) finish();
    }
    async function restart(force) {
      if (!force && (state.found.length || state.entry)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newPuzzle(diff, Date.now() ^ (Math.random() * 1e9), which);
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      const choice = await ctx.finish('win', { title: tr('done'), text: tr('found') + ' ' + state.found.length });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }

    onPress(root, '[data-ch]', (el) => {
      if (dead || done(state)) return;
      state = typeLetter(state, el.dataset.ch);
      sfx.play('click');
      paint();
    });
    onPress(root, '[data-act="clear"]', () => { state = { ...state, entry: '' }; paint(); });
    onPress(root, '[data-act="ok"]', () => {
      if (dead || done(state)) return;
      const res = submit(state, which);
      push(res.state, res.kind);
    });
    onPress(root, '.wk-entry', () => { state = backspace(state); paint(); });

    paint();
    persist();
    window.__sp = { id: ID, state: () => state, words: () => state.words.slice() };
    return { destroy() { dead = true; } };
  },
});
