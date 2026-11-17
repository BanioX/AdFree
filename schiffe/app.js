// Schiffe versenken – Flotte setzen, dann abwechselnd schiessen.

import { boot, stage, fillTools, onPress, bt } from '../lib/board/kit.js';
import { sfx } from '../shared/sfx.js';
import { h, toast, confirmDialog, sleep } from '../shared/ui.js';
import { FLEET, N, aiShot, begin, canPlace, cellsFor, clone, newGame, placeFleet, placeShip, shoot } from './logic.js';
import { tutorialSteps } from './tutorial.js';
import { tr } from './strings.js';

const ID = 'schiffe';

boot({
  id: ID,
  title: () => tr('title'),
  tagline: () => tr('tagline'),
  accent: '#1f7aa8',
  steps: () => tutorialSteps(),
  start(ctx) {
    let state = ctx.saved && ctx.saved.me ? revive(ctx.saved) : newGame();
    let hist = ctx.saved && ctx.saved.hist ? ctx.saved.hist.map(revive) : [];
    const diff = ctx.diff || 'mittel';
    let busy = false;
    let dead = false;
    let hint = -1;
    let finishing = false;

    const ui = stage({
      title: tr('title'),
      sub: '',
      onBack: () => ctx.exit(),
      onHelp: () => ctx.help(),
    });
    ctx.app.replaceChildren(ui.root);
    const board = h('div.sh-board');
    ui.board.append(board);

    function revive(saved) {
      const s = clone(saved);
      delete s.hist;
      delete s.diff;
      return s;
    }
    function persist() {
      const snap = clone(state);
      snap.diff = diff;
      snap.hist = hist.map((h0) => clone(h0));
      ctx.save(snap);
    }
    function look(kind, i) {
      if (kind === 'foe') {
        const v = state.seen[i];
        if (v === 1) return 'miss';
        if (v === 2) return 'hit';
        if (v === 3) return 'sunk';
        return '';
      }
      const shot = state.echo[i];
      if (shot === 3) return 'sunk';
      if (shot === 2) return 'hit';
      if (state.me[i]) return 'ship';
      if (shot === 1) return 'miss';
      return '';
    }
    function sea(kind) {
      const box = h('div', { class: 'sea ' + kind });
      for (let i = 0; i < N * N; i++) {
        const cell = h('i', { 'data-i': String(i) });
        const name = look(kind, i);
        if (name) cell.className = name;
        if (kind === 'foe' && i === hint) cell.classList.add('hint');
        box.append(cell);
      }
      return h('div', null, h('p.sea-label', null, kind === 'foe' ? tr('foe') : tr('you')), box);
    }
    function paint() {
      board.className = 'sh-board' + (state.phase === 'fight' ? ' fight' : '');
      board.replaceChildren();
      if (state.phase === 'fight') board.append(sea('foe'));
      board.append(sea('mine'));
      status();
      tools();
    }
    function status() {
      if (state.phase === 'place') ui.setStatus(tr('place', { n: FLEET[state.next] }));
      else if (state.over) ui.setStatus(state.winner === 1 ? tr('youWin') : tr('youLose'), state.winner === 1 ? 'good' : 'bad');
      else if (state.turn === 2) ui.setStatus(tr('theirShot'));
      else ui.setStatus(state.extra ? tr('again') : tr('yourShot'), state.extra ? 'good' : '');
    }
    function tools() {
      if (state.phase === 'place') {
        fillTools(ui.tools, [
          { icon: 'rotate', label: tr('turn'), onClick: turn },
          { icon: 'shuffle', label: tr('random'), onClick: randomFleet },
          { icon: 'refresh', label: bt('neu'), onClick: restart },
        ]);
        return;
      }
      fillTools(ui.tools, [
        { icon: 'undo', label: bt('undo'), disabled: !hist.length || busy, onClick: undo },
        { icon: 'hint', label: bt('hint'), disabled: busy || state.over || state.turn !== 1, onClick: showHint },
        { icon: 'refresh', label: bt('neu'), onClick: restart },
      ]);
    }
    function turn() {
      state.dir = state.dir === 'h' ? 'v' : 'h';
      clearGhost();
      sfx.play('click');
    }
    function clearGhost() {
      for (const cell of board.querySelectorAll('.ghost, .bad')) cell.classList.remove('ghost', 'bad');
    }
    function showGhost(i) {
      clearGhost();
      if (state.phase !== 'place') return;
      const len = FLEET[state.next];
      const cells = cellsFor(len, Math.floor(i / N), i % N, state.dir);
      if (!cells) return;
      const ok = !!canPlace(state.me, len, Math.floor(i / N), i % N, state.dir);
      for (const n of cells) {
        const el = board.querySelector('.mine [data-i="' + n + '"]');
        if (el) el.classList.add(ok ? 'ghost' : 'bad');
      }
    }
    function put(i) {
      if (dead || busy || state.phase !== 'place') return;
      const len = FLEET[state.next];
      const r = Math.floor(i / N);
      const c = i % N;
      if (!placeShip(state.me, state.meShips, len, r, c, state.dir)) {
        toast(tr('noFit'));
        sfx.play('error');
        return;
      }
      sfx.play('place');
      state.next += 1;
      if (state.next >= FLEET.length) startFight();
      else { paint(); persist(); }
    }
    function randomFleet() {
      if (dead || busy || state.phase !== 'place') return;
      const fleet = placeFleet(Math.random);
      if (!fleet) { toast(tr('noFit')); return; }
      state.me = fleet.grid;
      state.meShips = fleet.ships;
      state.next = FLEET.length;
      sfx.play('place');
      startFight();
    }
    function startFight() {
      const foe = placeFleet(Math.random);
      if (!foe) { toast(tr('noFit')); return; }
      begin(state, foe);
      hist = [];
      hint = -1;
      paint();
      persist();
    }
    async function fire(i) {
      if (dead || busy || state.over || state.phase !== 'fight' || state.turn !== 1) return;
      if (state.seen[i]) return;
      if (!state.extra) hist.push(clone(state));
      busy = true;
      hint = -1;
      const res = shoot(state, i);
      sfx.play(res && res.hit ? 'pop' : 'thud');
      if (res && res.sunk) toast(tr('sunk'));
      paint();
      persist();
      if (state.over) { busy = false; finish(); return; }
      if (state.turn === 2) await reply();
      else busy = false;
      if (!dead) tools();
    }
    async function reply() {
      while (!dead && state.turn === 2 && !state.over) {
        await sleep(260);
        if (dead || state.turn !== 2) return;
        const i = aiShot(state, diff);
        const before = state.meShips.filter((s) => s.hits === s.len).length;
        const res = shoot(state, i);
        sfx.play(res && res.hit ? 'pop' : 'click');
        paint();
        const after = state.meShips.filter((s) => s.hits === s.len).length;
        if (after > before) toast(tr('sunkYou'));
        if (state.over) { busy = false; persist(); finish(); return; }
      }
      busy = false;
      persist();
      if (!dead) tools();
    }
    function undo() {
      if (busy || !hist.length) return;
      const snap = hist.pop();
      state = snap;
      hint = -1;
      sfx.play('click');
      paint();
      persist();
    }
    function showHint() {
      if (busy || state.over || state.turn !== 1) return;
      const i = aiShot(state, 'schwer', Math.random, 1);
      if (i == null) { toast(tr('noHint')); return; }
      hint = i;
      paint();
      toast(tr('hint'));
    }
    async function restart(force) {
      if (!force && (state.phase === 'fight' || state.next)) {
        const ok = await confirmDialog(bt('newAsk'), bt('newText'), bt('newGame'));
        if (!ok || dead) return;
      }
      state = newGame();
      hist = [];
      hint = -1;
      finishing = false;
      paint();
      persist();
    }
    async function finish() {
      if (finishing || dead) return;
      finishing = true;
      status();
      tools();
      const kind = state.winner === 1 ? 'win' : 'lose';
      const choice = await ctx.finish(kind, {
        title: kind === 'win' ? tr('youWin') : tr('youLose'),
        text: tr('fleet'),
      });
      if (dead) return;
      if (choice === 'menu') ctx.exit();
      else restart(true);
    }

    board.addEventListener('pointerdown', (e) => {
      const el = e.target.closest && e.target.closest('.mine [data-i]');
      if (!el || state.phase !== 'place') return;
      showGhost(+el.dataset.i);
    });
    onPress(board, '.mine [data-i]', (el) => put(+el.dataset.i));
    onPress(board, '.foe [data-i]', (el) => fire(+el.dataset.i));

    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    paint();
    persist();
    window.__sp = { id: ID, state: () => state, busy: () => busy, fire, put };

    return {
      destroy() {
        dead = true;
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
});
