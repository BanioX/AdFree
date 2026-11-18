import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog } from '../shared/ui.js';
import { currentLang } from '../lib/words/lexicon.js';
import { done, hint, newPuzzle, submit, typeLetter } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'wabenwort';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#e6a317',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    const which = currentLang();
    let state = ctx.saved && ctx.saved.letters ? ctx.saved : newPuzzle(ctx.diff, Date.now() ^ (Math.random() * 1e9), which);
    const diff = ctx.diff || 'mittel';
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.hb');
    ui.board.append(root);

    function persist() {
      ctx.save({ ...state, diff, found: state.found.slice(), bonus: state.bonus.slice(), letters: state.letters.slice(), words: state.words.slice() });
    }
    function paint() {
      const hive = h('div.hb-hive');
      const around = state.letters.filter((ch) => ch !== state.center);
      const mid = h('button.mid', { type: 'button', 'data-ch': state.center }, state.center);
      mid.style.left = '50%';
      mid.style.top = '50%';
      hive.append(mid);
      around.forEach((ch, i) => {
        const a = -Math.PI / 2 + (i / around.length) * Math.PI * 2;
        const btn = h('button', { type: 'button', 'data-ch': ch }, ch);
        btn.style.left = (50 + Math.cos(a) * 34) + '%';
        btn.style.top = (50 + Math.sin(a) * 36) + '%';
        hive.append(btn);
      });
      const found = h('div.hb-found');
      for (const w of state.found) found.append(h('b', null, w));
      for (const w of state.bonus) found.append(h('i', null, w));
      root.replaceChildren(
        h('div.hb-entry', null, state.entry || '·'),
        hive,
        h('div.hb-actions', null,
          h('button', { type: 'button', 'data-act': 'clear' }, tr('clear')),
          h('button.ok', { type: 'button', 'data-act': 'ok' }, '✓')),
        found);
      const left = state.words.filter((w) => !state.found.includes(w)).length;
      ui.setStatus(left ? tr('need', { n: left }) : tr('done'), left ? '' : 'good');
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !state.found.length && !state.bonus.length, onClick: undo },
        { icon: 'hint', label: bt('hint'), disabled: done(state), onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function take(kind, next) {
      state = next;
      if (kind === 'found') sfx.play('fill');
      else if (kind === 'bonus') { sfx.play('sparkle'); toast(tr('bonus')); }
      else if (kind) { if (kind === 'no') sfx.play('error'); toast(tr(kind)); }
      paint();
      persist();
      if (done(state)) finish();
    }
    function undo() {
      if (state.bonus.length) state = { ...state, bonus: state.bonus.slice(0, -1) };
      else if (state.found.length) state = { ...state, found: state.found.slice(0, -1) };
      else return;
      paint();
      persist();
    }
    function showHint() {
      state = hint(state);
      toast(tr('hint'));
      paint();
      persist();
      if (done(state)) finish();
    }
    async function restart(force) {
      if (!force && state.found.length) {
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
    onPress(root, '[data-ch]', (el) => { state = typeLetter(state, el.dataset.ch); sfx.play('click'); paint(); });
    onPress(root, '[data-act="clear"]', () => { state = { ...state, entry: '' }; paint(); });
    onPress(root, '[data-act="ok"]', () => { const r = submit(state, which); take(r.kind, r.state); });
    onPress(root, '.hb-entry', () => { state = { ...state, entry: [...state.entry].slice(0, -1).join('') }; paint(); });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, words: () => state.words.slice() };
    return { destroy() { dead = true; } };
  },
});
