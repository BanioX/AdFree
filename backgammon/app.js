// Backgammon. Der Mensch spielt Weiss und zieht nach unten.

import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { aiPlay, apply, clone, newGame, plays, roll } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'backgammon';
const TOP = [12, 13, 14, 15, 16, 17, 'bar', 18, 19, 20, 21, 22, 23];
const BOT = [11, 10, 9, 8, 7, 6, 'bar', 5, 4, 3, 2, 1, 0];
const DOTS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#9a3b2f',
  steps: () => tutorialSteps(),
  start(ctx) {
    const saved = ctx.saved && ctx.saved.pts ? ctx.saved : null;
    let state = saved ? revive(saved) : newGame();
    let hist = saved && saved.hist ? saved.hist.map(revive) : [];
    let marked = !!(saved && saved.marked);
    const diff = ctx.diff || 'mittel';
    let picked = null;
    let options = [];
    let busy = false;
    let dead = false;
    let finishing = false;

    const ui = stage({
      title: tr('title'),
      sub: '',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    ctx.app.replaceChildren(ui.root);
    const board = h('div.bg');
    ui.board.append(board);

    function revive(raw) {
      const s = clone(raw);
      delete s.hist;
      delete s.diff;
      delete s.marked;
      return s;
    }
    function persist() {
      const snap = clone(state);
      snap.diff = diff;
      snap.marked = marked;
      snap.hist = hist.map((h0) => clone(h0));
      ctx.save(snap);
    }
    function stack(n) {
      const side = n > 0 ? 'w' : 'b';
      const count = Math.abs(n);
      const box = h('span');
      for (let i = 0; i < Math.min(count, 5); i++) box.append(h('i', { class: 'ck ' + side }));
      if (count > 5) box.append(h('b.more', null, String(count)));
      return box;
    }
    function point(i, edge) {
      const btn = h('button.pt', { type: 'button', 'data-i': String(i) });
      if (state.pts[i]) btn.append(stack(state.pts[i]));
      if (picked === i) btn.classList.add('on');
      if (options.some((m) => m.to === i)) btn.classList.add('go');
      if (edge === 'bot') btn.classList.add('bot');
      return btn;
    }
    function barBtn(edge) {
      const btn = h('button.bar', { type: 'button', 'data-from': 'bar' });
      if (edge === 'top' && state.barB) btn.append(stack(-state.barB));
      if (edge === 'bot' && state.barW) btn.append(stack(state.barW));
      if (picked === 'bar') btn.classList.add('on');
      return btn;
    }
    function dieBtn(value, used) {
      if (!value) return h('button.ready', { type: 'button', 'data-die': '1' }, tr('roll'));
      const btn = h('button', { type: 'button', 'data-die': '1' });
      if (used) btn.classList.add('used');
      const on = new Set(DOTS[value] || []);
      for (let i = 0; i < 9; i++) btn.append(h('i', { class: on.has(i) ? 'on' : '' }));
      return btn;
    }
    function paint() {
      const top = h('div.bg-row.top');
      const bot = h('div.bg-row.bot');
      for (const slot of TOP) top.append(slot === 'bar' ? barBtn('top') : point(slot, 'top'));
      for (const slot of BOT) bot.append(slot === 'bar' ? barBtn('bot') : point(slot, 'bot'));
      const dice = h('div.bg-dice');
      if (!state.face.length) dice.append(dieBtn(0, false), dieBtn(0, false));
      else {
        const left = state.dice.slice();
        for (const face of state.face) {
          const i = left.indexOf(face);
          const used = i < 0;
          if (i >= 0) left.splice(i, 1);
          dice.append(dieBtn(face, used));
        }
      }
      const tray = h('button.tray', { type: 'button', 'data-to': 'off' }, tr('off') + ' ' + state.offW);
      if (options.some((m) => m.to === 'off')) tray.classList.add('go');
      board.replaceChildren(
        h('div.bg-meta', null, h('span', null, tr('opp') + ' ' + state.offB), dice),
        top, bot, tray,
      );
      status();
      tools();
    }
    function status() {
      if (state.over) ui.setStatus(state.winner === 1 ? tr('youWin') : tr('youLose'), state.winner === 1 ? 'good' : 'bad');
      else if (state.turn === -1) ui.setStatus(tr('think'));
      else if (state.phase === 'roll') ui.setStatus(tr('roll'));
      else ui.setStatus(tr('your'));
    }
    function tools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !hist.length || busy, onClick: back },
        { icon: 'hint', label: bt('hint'), disabled: busy || state.over || state.turn !== 1 || state.phase !== 'move', onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    function firsts() {
      return plays(state).map((p) => p[0]).filter(Boolean);
    }
    function onDie() {
      if (dead || busy || state.over || state.turn !== 1 || state.phase !== 'roll') return;
      if (!marked) { hist.push(clone(state)); marked = true; }
      busy = true;
      roll(state);
      sfx.play('click');
      const any = firsts().length;
      busy = false;
      paint();
      persist();
      if (!any) {
        toast(tr('noMove'));
        pass();
      }
    }
    function chooseFrom(from) {
      const mine = from === 'bar' ? state.barW > 0 : state.pts[from] > 0;
      if (!mine) { picked = null; options = []; paint(); return; }
      picked = from;
      const seen = new Set();
      options = [];
      for (const m of firsts()) {
        if (m.from !== from) continue;
        const id = m.to + ':' + m.die;
        if (seen.has(id)) continue;
        seen.add(id);
        options.push(m);
      }
      sfx.play('click');
      paint();
    }
    async function chooseTo(to) {
      const m = options.filter((x) => x.to === to).sort((a, b) => b.die - a.die)[0];
      if (!m || busy) return;
      busy = true;
      const beforeBar = state.barB;
      apply(state, m);
      const i = state.dice.indexOf(m.die);
      if (i >= 0) state.dice.splice(i, 1);
      if (state.barB > beforeBar) toast(tr('hit'));
      picked = null;
      options = [];
      sfx.play('place');
      paint();
      persist();
      if (state.over) { busy = false; finish(); return; }
      if (!state.dice.length || !firsts().length) await pass();
      else busy = false;
    }
    async function pass() {
      busy = true;
      state.turn = -1;
      state.phase = 'roll';
      state.dice = [];
      picked = null;
      options = [];
      paint();
      await sleep(220);
      if (dead) return;
      roll(state);
      const play = aiPlay(state, diff);
      paint();
      for (const m of play) {
        if (dead) return;
        await sleep(180);
        apply(state, m);
        const i = state.dice.indexOf(m.die);
        if (i >= 0) state.dice.splice(i, 1);
        paint();
        if (state.over) break;
      }
      if (state.over) { busy = false; persist(); finish(); return; }
      state.turn = 1;
      state.phase = 'roll';
      state.dice = [];
      state.face = [];
      marked = false;
      busy = false;
      paint();
      persist();
    }
    function showHint() {
      const play = aiPlay(state, 'mittel');
      if (!play.length) { toast(tr('noMove')); return; }
      picked = play[0].from;
      options = [play[0]];
      paint();
      toast(tr('your'));
    }
    function back() {
      if (busy || !hist.length) return;
      state = hist.pop();
      marked = false;
      picked = null;
      options = [];
      sfx.play('click');
      paint();
      persist();
    }
    async function restart(force) {
      if (!force && (marked || hist.length || state.offW || state.offB)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newGame();
      hist = [];
      marked = false;
      picked = null;
      options = [];
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      const kind = state.winner === 1 ? 'win' : 'lose';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? tr('youWin') : tr('youLose'),
        text: tr('tagline'),
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }

    onPress(board, '[data-die]', () => onDie());
    onPress(board, '[data-i]', (el) => {
      if (busy || state.turn !== 1 || state.phase !== 'move') return;
      const i = +el.dataset.i;
      if (options.some((m) => m.to === i)) chooseTo(i);
      else chooseFrom(i);
    });
    onPress(board, '[data-from="bar"]', () => {
      if (busy || state.turn !== 1 || state.phase !== 'move') return;
      chooseFrom('bar');
    });
    onPress(board, '[data-to="off"]', () => {
      if (busy || state.turn !== 1 || state.phase !== 'move') return;
      if (options.some((m) => m.to === 'off')) chooseTo('off');
    });

    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    paint();
    persist();
    window.__sp = {
      id: ID,
      state: () => state,
      busy: () => busy,
      plays: () => plays(state),
    };
    return {
      destroy() {
        dead = true;
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
});
