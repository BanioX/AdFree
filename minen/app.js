import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, confirmDialog, sleep } from '../shared/ui.js';
import { hintCell, newField, reveal, toggleFlag, won } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'minen';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#3d7a4a',
  modeLabel: () => tr('level'),
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.open ? ctx.saved : newField(ctx.diff, Date.now() % 100000);
    let flagMode = false;
    let tip = -1;
    const diff = ctx.diff || 'mittel';
    const hist = [];
    let dead = false;
    let finishing = false;
    const ui = stage({ title: tr('title'), onBack: () => ctx.exit(), onHelp: () => ctx.help() });
    ctx.app.replaceChildren(ui.root);
    const root = h('div.pz');
    ui.board.append(root);

    function persist() {
      ctx.save({
        w: state.w, h: state.h, mines: state.mines, seed: state.seed,
        mine: state.mine, open: state.open.slice(), flag: state.flag.slice(), boom: state.boom, diff,
      });
    }
    function paint() {
      root.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
      root.replaceChildren();
      const n = state.w * state.h;
      for (let i = 0; i < n; i++) {
        const btn = h('button', { type: 'button', 'data-i': String(i) });
        if (state.open[i]) {
          btn.classList.add('open');
          if (state.mine && state.mine[i]) {
            btn.classList.add('mn-mine');
            btn.textContent = '●';
          } else if (state.mine) {
            const k = nearbySafe(i);
            if (k) {
              btn.textContent = String(k);
              btn.classList.add('mn-n' + Math.min(k, 5));
            }
          }
        } else if (state.flag[i]) {
          btn.textContent = '⚑';
          btn.classList.add('mn-flag');
        }
        if (i === tip) btn.classList.add('tip');
        root.append(btn);
      }
      const flags = state.flag.filter(Boolean).length;
      ui.setStatus(state.boom ? tr('boom') : won(state) ? tr('win') : tr('left', { n: Math.max(0, state.mines - flags) }), state.boom ? 'lose' : won(state) ? 'win' : '');
      fillTools(ui.tools, [
        { icon: 'star', label: flagMode ? tr('flag') : tr('dig'), onClick: () => { flagMode = !flagMode; paint(); } },
        { icon: 'hint', label: bt('hint'), disabled: state.boom || won(state), onClick: showHint },
        { icon: 'undo', label: bt('undo'), disabled: !hist.length, onClick: back },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function nearbySafe(i) {
      if (!state.mine) return 0;
      let n = 0;
      const w = state.w;
      const c = i % w;
      const r = Math.floor(i / w);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= w || nr >= state.h) continue;
          if (state.mine[nr * w + nc]) n++;
        }
      }
      return n;
    }
    function showHint() {
      tip = hintCell(state);
      sfx.play('sparkle');
      paint();
    }
    function back() {
      const prev = hist.pop();
      if (!prev) return;
      state = prev;
      tip = -1;
      paint();
      persist();
    }
    async function restart(force) {
      if (!force && state.open.some(Boolean) && !won(state) && !state.boom) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newField(diff, Date.now() % 100000);
      hist.length = 0;
      tip = -1;
      finishing = false;
      paint();
      persist();
    }
    async function finish(kind) {
      if (finishing || dead) return;
      finishing = true;
      await sleep(450);
      if (dead) return;
      const choice = await ctx.finish(kind, { title: kind === 'win' ? tr('win') : tr('boom'), text: '' });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }
    onPress(root, '[data-i]', (el) => {
      if (state.boom || won(state)) return;
      const i = +el.dataset.i;
      hist.push(structuredClone(state));
      if (hist.length > 40) hist.shift();
      tip = -1;
      state = flagMode ? toggleFlag(state, i) : reveal(state, i);
      sfx.play(state.boom ? 'error' : 'click');
      paint();
      persist();
      if (state.boom) finish('lose');
      else if (won(state)) finish('win');
    });
    paint();
    persist();
    window.__sp = { id: ID, state: () => state };
    return { destroy() { dead = true; } };
  },
});
