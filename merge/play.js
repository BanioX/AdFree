// Verdoppeln – Spielansicht (freies Spiel und Etappen).

import { h, icon, soundButton, backButton, showModal, confirmDialog, celebrate, toast } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { createGame, move, isValidState, valueOf } from './logic.js';
import { bestMove } from './ai.js';
import { BoardView, bindInput, tileFace, SLIDE_MS } from './board.js';
import { modeById, undoRules } from './data/modes.js';
import { skinById, tileOf } from './data/skins.js';
import { makeLevel, starsFor, chapterTitle } from './levelgen.js';
import * as P from './progress.js';

const newSeed = () => Math.random().toString(36).slice(2, 10);

function tileName(skin, e) {
  const t = tileOf(skin, e);
  return skin.numbers ? String(valueOf(e)) : `${t.emoji} ${t.name || valueOf(e)}`;
}

/** Kleine Zieldarstellung (Kachel + Text). */
function goalChip(skin, goal) {
  const box = h('div.goal-tile');
  box.append(tileFace(skin, goal.e, { value: false }));
  return box;
}

function starsRow(n, cls = '') {
  const row = h('div.stars' + cls);
  for (let i = 0; i < 3; i++) {
    const s = h('span.star' + (i < n ? '.on' : ''));
    s.innerHTML = icon('star', { size: 30 });
    row.append(s);
  }
  return row;
}

/**
 * opts: { kind: 'free', mode } | { kind: 'level', n }
 * nav: { menu(), map(), free(mode), level(n) }
 */
export function mountPlay(app, opts, nav) {
  const prog = P.getProg();
  const isLevel = opts.kind === 'level';
  const mode = isLevel ? null : modeById(opts.mode);
  const level = isLevel ? makeLevel(opts.n) : null;
  const slot = isLevel ? 'etappe' : mode.id;
  const statKey = isLevel ? 'etappen' : mode.id;
  const skin = skinById(isLevel ? level.skin : prog.skin);

  let alive = true;
  let locked = false;
  let save = P.loadSave(slot);
  const fits = save && isValidState(save.state) && (isLevel
    ? save.n === level.n && save.state.size === level.size
    : save.mode === mode.id && save.state.size === mode.size);
  if (!fits) save = null;

  function freshSave() {
    const state = isLevel
      ? createGame({ size: level.size, walls: level.walls, seed: newSeed(), goal: level.goal })
      : createGame({ size: mode.size, seed: newSeed(), target: mode.target });
    P.getProg().played[statKey] = (P.getProg().played[statKey] | 0) + 1;
    P.saveProg();
    return {
      kind: opts.kind, mode: mode && mode.id, n: level && level.n, state, hist: [],
      undos: undoRules.start, refill: undoRules.refillEvery, winSeen: false, recordShown: false,
    };
  }
  if (!save) { save = freshSave(); P.writeSave(slot, save); }

  // ---------- Aufbau ----------
  app.className = 'app play' + (skin.dark ? ' dark-skin' : '');
  app.textContent = '';
  app.style.setProperty('--board', skin.board);
  document.body.classList.add('in-play');

  const back = backButton(isLevel ? '#etappen' : '#', () => (isLevel ? nav.map() : nav.menu()));
  const title = h('div.title-wrap',
    h('div.title', null, isLevel ? `Etappe ${level.n}` : mode.title),
    h('div.subtitle', null, isLevel ? chapterTitle(level.gci) : mode.sub));
  const top = h('header.topbar', null, back, title, soundButton());

  const scoreVal = h('div.val', null, '0');
  const scoreBox = h('div.stat.score', null, h('div.lbl', null, 'Punkte'), scoreVal);
  const sideVal = h('div.val', null, '0');
  const sideLbl = h('div.lbl', null, isLevel ? 'Züge' : 'Rekord');
  const sideBox = h('div.stat', null, sideLbl, sideVal);
  const goalLbl = h('div.lbl', null, 'Ziel');
  const goalInfo = h('div.goal-info');
  const goalBox = h('div.stat.goal', null, goalChip(skin, save.state.goal), h('div.goal-txt', null, goalLbl, goalInfo));
  const hud = h('div.hud', null, scoreBox, sideBox, goalBox);

  const stage = h('main.stage');
  const boardWrap = h('div.board-wrap');
  stage.append(boardWrap);

  const undoBadge = h('span.badge');
  const undoBtn = h('button.tool', { type: 'button', 'aria-label': 'Rückgängig' });
  undoBtn.innerHTML = icon('undo', { size: 24 });
  undoBtn.append(h('span', null, 'Zurück'), undoBadge);
  const hintBtn = h('button.tool', { type: 'button', 'aria-label': 'Tipp' });
  hintBtn.innerHTML = icon('hint', { size: 24 });
  hintBtn.append(h('span', null, 'Tipp'));
  const newBtn = h('button.tool', { type: 'button', 'aria-label': isLevel ? 'Neu starten' : 'Neues Spiel' });
  newBtn.innerHTML = icon('refresh', { size: 24 });
  newBtn.append(h('span', null, isLevel ? 'Neustart' : 'Neu'));
  const tools = h('footer.tools', null, undoBtn, hintBtn, newBtn);

  app.append(top, hud, stage, tools);

  const board = new BoardView(boardWrap, { size: save.state.size, walls: save.state.walls, skin });
  board.renderAll(save.state);

  // Brettgrösse an verfügbaren Platz anpassen
  const fit = () => {
    const w = stage.clientWidth - 28, hh = stage.clientHeight - 12;
    const s = Math.max(160, Math.floor(Math.min(w, hh, 560)));
    boardWrap.style.width = s + 'px';
    boardWrap.style.height = s + 'px';
  };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  fit();

  // ---------- Anzeige ----------
  let shownScore = save.state.score;
  let scoreAnim = 0;
  function setScore(v, animateIt) {
    cancelAnimationFrame(scoreAnim);
    if (!animateIt) { shownScore = v; scoreVal.textContent = P.formatNumber(v); return; }
    const from = shownScore, t0 = performance.now();
    const stepFn = (t) => {
      const k = Math.min(1, (t - t0) / 260);
      shownScore = Math.round(from + (v - from) * (1 - (1 - k) ** 3));
      scoreVal.textContent = P.formatNumber(shownScore);
      if (k < 1) scoreAnim = requestAnimationFrame(stepFn);
    };
    scoreAnim = requestAnimationFrame(stepFn);
  }

  function flyUp(gained) {
    const f = h('span.fly', null, '+' + P.formatNumber(gained));
    scoreBox.append(f);
    const a = f.animate([
      { transform: 'translate(-50%, 4px) scale(.8)', opacity: 0 },
      { transform: 'translate(-50%, -8px) scale(1.05)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 },
    ], { duration: 820, easing: 'cubic-bezier(.2,.7,.3,1)' });
    a.onfinish = () => f.remove();
  }

  function updateHud() {
    const s = save.state;
    if (isLevel) {
      sideVal.textContent = String(s.moves);
      const st = s.moves <= level.par ? 3 : s.moves <= level.par2 ? 2 : 1;
      sideBox.dataset.stars = '★'.repeat(st);
    } else {
      const best = Math.max(P.getProg().best[mode.id] | 0, s.score);
      sideVal.textContent = P.formatNumber(best);
    }
    if (s.goal.type === 'count') {
      goalLbl.textContent = 'Ziel';
      goalInfo.textContent = `${Math.min(s.made, s.goal.n)} / ${s.goal.n}`;
    } else {
      goalLbl.textContent = s.won && !isLevel ? 'Geschafft' : 'Ziel';
      goalInfo.textContent = P.formatNumber(valueOf(s.goal.e));
    }
    goalBox.classList.toggle('done', !!s.won);
    undoBadge.textContent = String(save.undos);
    undoBtn.classList.toggle('empty', save.undos <= 0 || !save.hist.length);
  }
  setScore(save.state.score, false);
  updateHud();

  function persist() { P.writeSave(slot, save); }

  // ---------- Züge ----------
  function onMerge(m) {
    if (!alive) return;
    if (m.e >= 5) board.burst(m.at, tileOf(skin, m.e).color);
  }

  function onDir(dir) {
    if (locked || !alive) return;
    board.clearHint();
    const prev = save.state;
    const res = move(prev, dir);
    if (!res.moved) { board.nudge(dir); return; }
    save.hist.push(prev);
    if (save.hist.length > undoRules.history) save.hist.shift();
    save.state = res.state;
    save.refill -= 1;
    if (save.refill <= 0) {
      save.refill = undoRules.refillEvery;
      if (save.undos < undoRules.max) {
        save.undos += 1;
        undoBtn.classList.remove('sp-pop'); void undoBtn.offsetWidth; undoBtn.classList.add('sp-pop');
      }
    }
    board.animate(res, onMerge);

    // Klang
    if (res.merges.length) sfx.play(res.merges.length >= 3 ? 'sparkle' : 'pop');
    else sfx.play('tap');

    // Punkte
    if (res.gained) { setScore(res.state.score, true); flyUp(res.gained); }

    // Fortschritt, Rekord, Album
    const p = P.getProg();
    p.moves = (p.moves | 0) + 1;
    p.merges = (p.merges | 0) + res.merges.length;
    let newRecord = false;
    if (!isLevel) {
      if (res.state.score > (p.best[mode.id] | 0)) {
        if ((p.best[mode.id] | 0) > 0 && !save.recordShown) newRecord = true;
        p.best[mode.id] = res.state.score;
      }
      if (res.state.maxE > (p.bestTile[mode.id] | 0)) p.bestTile[mode.id] = res.state.maxE;
    }
    P.saveProg();
    let found = null;
    for (const m of res.merges) if (P.discover(skin.id, m.e) && m.e >= 4) found = m.e;
    if (res.spawn) P.discover(skin.id, res.spawn.e);
    if (found && !res.won) {
      setTimeout(() => { if (alive) { sfx.play('sparkle'); toast('Neu im Album: ' + tileName(skin, found)); } }, SLIDE_MS + 120);
    } else if (newRecord) {
      save.recordShown = true;
      toast('Neuer Rekord!');
    } else if (!isLevel && save.state.won && res.newMax > save.state.goal.e) {
      toast('Neue Höchstkachel: ' + tileName(skin, res.newMax));
    }

    persist();
    updateHud();
    P.report();

    if (res.won) {
      locked = true;
      setTimeout(() => alive && (isLevel ? showLevelDone() : showWin()), SLIDE_MS + 330);
    } else if (res.over) {
      locked = true;
      setTimeout(() => alive && showOver(), SLIDE_MS + 520);
    }
  }

  function undo() {
    if (!alive) return;
    if (!save.hist.length) { toast('Noch kein Zug gemacht'); return; }
    if (save.undos <= 0) {
      sfx.play('error');
      toast(`Nächstes Rückgängig in ${save.refill} ${save.refill === 1 ? 'Zug' : 'Zügen'}`);
      return;
    }
    save.state = save.hist.pop();
    save.undos -= 1;
    locked = false;
    board.renderAll(save.state);
    board.layer.animate([{ opacity: 0.35, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    sfx.play('whoosh');
    setScore(save.state.score, true);
    persist();
    updateHud();
  }

  function hint() {
    if (locked || !alive) return;
    const d = bestMove(save.state);
    if (!d) return;
    sfx.play('tap');
    board.hint(d);
  }

  async function restart(askFirst = true) {
    const s = save.state;
    if (askFirst && s.moves > 0 && !s.over && !(s.won && isLevel)) {
      const ok = await confirmDialog(isLevel ? 'Etappe neu starten?' : 'Neues Spiel?',
        'Der aktuelle Spielstand geht verloren.', isLevel ? 'Neu starten' : 'Neues Spiel', 'Abbrechen');
      if (!ok || !alive) return;
    }
    save = freshSave();
    locked = false;
    persist();
    board.renderAll(save.state);
    for (const t of board.tiles.values()) {
      t.face.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    sfx.play('whoosh');
    setScore(save.state.score, false);
    updateHud();
    if (isLevel && level.tip) setTimeout(() => alive && toast(level.tip, 3200), 350);
  }

  // ---------- Blätter ----------
  async function showWin(quiet) {
    if (!quiet) sfx.play('complete');
    celebrate(skin.tiles.slice(3, 9).map((t) => t.color).concat(['#ffd23f', '#ff7a59']));
    const p = P.getProg();
    p.won[statKey] = (p.won[statKey] | 0) + 1;
    P.saveProg();
    save.winSeen = true;
    persist();
    const big = h('div.sheet-tile', null, tileFace(skin, save.state.goal.e));
    const content = h('div.sheet-content', null, big,
      h('p', null, `Du hast ${tileName(skin, save.state.goal.e)} erreicht – mit ${P.formatNumber(save.state.score)} Punkten.`),
      h('p.small', null, 'Du kannst weiterspielen und noch grössere Kacheln bauen.'));
    const v = await showModal({
      title: 'Geschafft!', content, dismissible: false,
      buttons: [
        { label: 'Weiterspielen', value: 'go', primary: true, icon: 'play' },
        { label: 'Neues Spiel', value: 'new' },
        { label: 'Zum Menü', value: 'menu', ghost: true },
      ],
    });
    if (!alive) return;
    if (v === 'new') restart(false);
    else if (v === 'menu') nav.menu();
    else { locked = false; }
  }

  async function showOver(quiet) {
    if (!quiet) sfx.play('thud');
    const s = save.state;
    const p = P.getProg();
    const canUndo = save.undos > 0 && save.hist.length > 0;
    const content = h('div.sheet-content');
    const top = h('div.sheet-tile.small', null, tileFace(skin, Math.max(1, s.maxE)));
    content.append(top);
    if (isLevel) {
      content.append(h('p', null, `Das Brett ist voll. ${s.goal.type === 'count' ? `Geschafft: ${s.made} von ${s.goal.n}.` : `Ziel war ${tileName(skin, s.goal.e)}.`}`));
    } else {
      const isBest = s.score > 0 && s.score >= (p.best[mode.id] | 0);
      content.append(h('div.score-line', null,
        h('div', null, h('div.lbl', null, 'Punkte'), h('div.big', null, P.formatNumber(s.score))),
        h('div', null, h('div.lbl', null, 'Rekord'), h('div.big', null, P.formatNumber(p.best[mode.id] | 0)))));
      if (isBest) content.append(h('p.record', null, '🏆 Neuer Rekord!'));
    }
    if (canUndo) content.append(h('p.small', null, `Du hast noch ${save.undos}× Rückgängig.`));
    const buttons = [];
    if (canUndo) buttons.push({ label: 'Rückgängig', value: 'undo', primary: true, icon: 'undo' });
    buttons.push({ label: isLevel ? 'Nochmal versuchen' : 'Neues Spiel', value: 'new', primary: !canUndo, icon: 'refresh' });
    buttons.push({ label: isLevel ? 'Zur Karte' : 'Zum Menü', value: 'menu', ghost: true });
    const v = await showModal({ title: 'Keine Züge mehr', content, buttons, dismissible: false });
    if (!alive) return;
    if (v === 'undo') undo();
    else if (v === 'new') restart(false);
    else if (isLevel) nav.map(); else nav.menu();
  }

  async function showLevelDone(quiet) {
    const s = save.state;
    const stars = starsFor(level, s.moves);
    const already = save.winSeen;
    if (!already) {
      P.recordLevel(level.n, stars);
      const p = P.getProg();
      p.won.etappen = (p.won.etappen | 0) + 1;
      P.saveProg();
      save.winSeen = true;
      persist();
      P.report();
    }
    if (!quiet) sfx.play('complete');
    celebrate(skin.tiles.slice(3, 9).map((t) => t.color).concat(['#ffd23f']));
    const row = starsRow(stars, '.big');
    const content = h('div.sheet-content', null, row,
      h('p', null, `Ziel erreicht in ${s.moves} Zügen.`),
      stars < 3 ? h('p.small', null, `Für ${stars === 2 ? '3' : '2'} Sterne: höchstens ${stars === 2 ? level.par : level.par2} Züge.`) : h('p.small', null, 'Perfekt – alle drei Sterne!'));
    row.querySelectorAll('.star.on').forEach((el, i) => {
      el.animate([{ transform: 'scale(0) rotate(-40deg)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }],
        { duration: 420, delay: 250 + i * 180, easing: 'ease-out', fill: 'backwards' });
      if (!quiet) setTimeout(() => alive && sfx.play('sparkle'), 300 + i * 180);
    });
    const v = await showModal({
      title: `Etappe ${level.n} geschafft!`, content, dismissible: false,
      buttons: [
        { label: 'Nächste Etappe', value: 'next', primary: true, icon: 'play' },
        { label: 'Nochmal spielen', value: 'again' },
        { label: 'Zur Karte', value: 'map', ghost: true },
      ],
    });
    if (!alive) return;
    if (v === 'next') { P.clearSave('etappe'); nav.level(level.n + 1); }
    else if (v === 'again') restart(false);
    else { P.clearSave('etappe'); nav.map(); }
  }

  // ---------- Eingabe ----------
  undoBtn.addEventListener('click', () => { sfx.play('click'); undo(); });
  hintBtn.addEventListener('click', hint);
  newBtn.addEventListener('click', () => { sfx.play('click'); restart(true); });
  const unbind = bindInput(app, onDir, { undo, u: undo, Backspace: undo, h: hint, n: () => restart(true) });

  // Zustand nach dem Laden
  const s0 = save.state;
  if (s0.won && !save.winSeen) { locked = true; setTimeout(() => alive && (isLevel ? showLevelDone(true) : showWin(true)), 300); }
  else if (s0.won && isLevel) { locked = true; setTimeout(() => alive && showLevelDone(true), 300); }
  else if (s0.over) { locked = true; setTimeout(() => alive && showOver(true), 300); }
  else if (isLevel && level.tip && s0.moves === 0) setTimeout(() => alive && toast(level.tip, 3200), 400);

  P.report();

  return {
    destroy() {
      alive = false;
      unbind();
      ro.disconnect();
      cancelAnimationFrame(scoreAnim);
      board.destroy();
      app.style.removeProperty('--board');
      document.body.classList.remove('in-play');
    },
  };
}
