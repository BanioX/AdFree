// Schach. Der Mensch spielt Weiss und beginnt.

import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, showModal, confirmDialog, sleep } from '../shared/ui.js';
import { aiMove, apply, clone, finishIf, inCheck, key, legal, newGame } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'schach';
const GLYPH = {
  1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚',
  '-1': '♟', '-2': '♞', '-3': '♝', '-4': '♜', '-5': '♛', '-6': '♚',
};

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#4a5568',
  steps: () => tutorialSteps(),
  start(ctx) {
    const saved = ctx.saved && ctx.saved.board ? ctx.saved : null;
    let state = saved ? revive(saved) : newGame();
    let seen = saved && saved.seen ? { ...saved.seen } : { [key(state)]: 1 };
    let hist = saved && saved.hist ? saved.hist.map(reviveSnap) : [];
    let mark = saved && saved.mark ? saved.mark : null;
    const diff = ctx.diff || 'mittel';
    let sel = -1;
    let targets = new Set();
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
    const grid = h('div.ch');
    ui.board.append(grid);

    function revive(raw) {
      const s = clone(raw);
      delete s.seen;
      delete s.hist;
      delete s.mark;
      delete s.diff;
      return s;
    }
    function reviveSnap(raw) {
      return { state: revive(raw.state), seen: { ...raw.seen }, mark: raw.mark };
    }
    function snapshot() {
      return { state: clone(state), seen: { ...seen }, mark: mark ? { ...mark } : null };
    }
    function persist() {
      const snap = clone(state);
      snap.diff = diff;
      snap.seen = { ...seen };
      snap.mark = mark;
      snap.hist = hist.map((h0) => ({ state: clone(h0.state), seen: { ...h0.seen }, mark: h0.mark }));
      ctx.save(snap);
    }
    function paint() {
      grid.replaceChildren();
      for (let r = 7; r >= 0; r--) {
        for (let f = 0; f < 8; f++) {
          const i = r * 8 + f;
          const cell = h('button', { type: 'button', 'data-i': String(i) });
          if (((r + f) & 1) === 1) cell.classList.add('lt');
          if (mark && (mark.from === i || mark.to === i)) cell.classList.add('mv');
          if (i === sel) cell.classList.add('sel');
          const piece = state.board[i];
          if (targets.has(i)) cell.classList.add(piece ? 'cap' : 'dot');
          if (piece) cell.append(h('b', { class: piece > 0 ? 'w' : 'b' }, GLYPH[piece]));
          grid.append(cell);
        }
      }
      status();
      tools();
    }
    function status() {
      if (state.over) {
        const good = state.result === 1;
        ui.setStatus(state.result === 0 ? tr('draw') : good ? tr('mateWin') : tr('mateLose'), good ? 'good' : state.result === 0 ? '' : 'bad');
      } else if (busy && state.turn === -1) ui.setStatus(tr('think'));
      else if (inCheck(state, 1)) ui.setStatus(tr('check'), 'bad');
      else ui.setStatus(tr('your'));
    }
    function tools() {
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !hist.length || busy, onClick: back },
        { icon: 'hint', label: bt('hint'), disabled: busy || state.over || state.turn !== 1, onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: () => restart(false) },
      ]);
    }
    async function onCell(i) {
      if (dead || busy || state.over || state.turn !== 1) return;
      if (sel >= 0 && targets.has(i)) {
        const options = legal(state).filter((m) => m.from === sel && m.to === i);
        if (!options.length) return;
        let m = options[0];
        if (options.length > 1) {
          busy = true;
          const kind = await showModal({
            title: tr('promo'),
            dismissible: true,
            buttons: [5, 4, 3, 2].map((n) => ({ label: tr(['queen', 'rook', 'bishop', 'knight'][5 - n]), value: n, primary: n === 5 })),
          });
          if (!kind || dead) { busy = false; tools(); return; }
          m = options.find((x) => Math.abs(x.promo) === kind) || m;
        }
        await play(m);
        return;
      }
      if (state.board[i] > 0) {
        sel = i;
        targets = new Set(legal(state).filter((m) => m.from === i).map((m) => m.to));
        sfx.play('click');
        paint();
        return;
      }
      sel = -1;
      targets = new Set();
      paint();
    }
    async function play(m) {
      busy = true;
      hist.push(snapshot());
      apply(state, m);
      mark = { from: m.from, to: m.to };
      sel = -1;
      targets = new Set();
      finishIf(state, seen);
      sfx.play(m.captured ? 'pop' : 'place');
      paint();
      persist();
      if (state.over) { busy = false; finish(); return; }
      if (inCheck(state, -1)) toast(tr('check'));
      await reply();
    }
    async function reply() {
      busy = true;
      paint();
      await sleep(160);
      if (dead || state.turn !== -1 || state.over) { busy = false; return; }
      const m = aiMove(state, diff);
      if (!m) { busy = false; finishIf(state, seen); finish(); return; }
      apply(state, m);
      mark = { from: m.from, to: m.to };
      finishIf(state, seen);
      sfx.play(m.captured ? 'pop' : 'click');
      busy = false;
      paint();
      persist();
      if (!state.over && inCheck(state, 1)) toast(tr('check'));
      if (state.over) finish();
    }
    function back() {
      if (busy || !hist.length) return;
      const snap = hist.pop();
      state = snap.state;
      seen = snap.seen;
      mark = snap.mark;
      sel = -1;
      targets = new Set();
      sfx.play('click');
      paint();
      persist();
    }
    function showHint() {
      if (busy || state.over || state.turn !== 1) return;
      const m = aiMove(state, 'mittel');
      if (!m) return;
      sel = m.from;
      targets = new Set([m.to]);
      mark = { from: m.from, to: m.to };
      paint();
      toast(tr('hint'));
    }
    async function restart(force) {
      if (!force && (hist.length || state.full > 1 || state.turn !== 1)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newGame();
      seen = { [key(state)]: 1 };
      hist = [];
      mark = null;
      sel = -1;
      targets = new Set();
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      status();
      tools();
      const kind = state.result === 1 ? 'win' : state.result === -1 ? 'lose' : 'draw';
      const title = state.reason && state.reason !== 'mate' ? tr(state.reason) : (kind === 'win' ? tr('mateWin') : kind === 'lose' ? tr('mateLose') : tr('draw'));
      const choice = await ctx.finish(kind, { title, text: tr('tagline') });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }

    onPress(grid, 'button', (el) => onCell(+el.dataset.i));
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy, moves: () => legal(state) };

    return {
      destroy() {
        dead = true;
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
});
