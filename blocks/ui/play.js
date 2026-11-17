// Spiel-Bildschirm (Klassisch und Abenteuer): HUD, Eingabe, Speichern, Sieg/Ende-Blätter.

import { h, icon, showModal, confirmDialog, celebrate, toast, soundButton, backButton, sleep } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';
import { Game } from '../core/game.js';
import { getLevel, goalLabel, worldOf } from '../core/levels.js';
import { bestMove } from '../core/bot.js';
import { praise as WORDS } from '../data/words.js';
import { gems as GEMS } from '../data/skins.js';
import { BoardView } from './view.js';
import { gemIconUrl } from './sprites.js';
import { pictureById, pictureThumbUrl } from './picture.js';
import { showHelp, skinPicker } from './sheets.js';
import {
  currentSkin, loadClassic, saveClassic, loadLevelSave, saveLevelSave,
  updateBest, bestScore, recordClassicGame, recordWin, recordTry, updateSummary,
} from './progress.js';

const fmt = (n) => Number(n || 0).toLocaleString('de-CH');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function mountPlay(app, opts, nav) {
  const classic = opts.mode === 'classic';
  let skin = currentSkin();
  let level = null;
  let game = null;
  let meta = {}; // zusätzliche Speicher-Infos (counted, recorded)

  if (classic) {
    const raw = loadClassic(opts.size);
    const saved = raw ? Game.deserialize(raw) : null;
    if (saved && saved.mode === 'classic' && saved.size === opts.size) {
      game = saved;
      meta = { counted: !!raw.counted, recordShown: !!raw.recordShown, startBest: raw.startBest ?? bestScore(opts.size) };
    } else {
      game = Game.classic(opts.size, Date.now());
      meta = { startBest: bestScore(opts.size) };
    }
  } else {
    level = getLevel(opts.level);
    const raw = loadLevelSave();
    const saved = raw && raw.level === opts.level ? Game.deserialize(raw) : null;
    if (saved) {
      game = saved;
      meta = { recorded: !!raw.recorded };
    } else {
      game = Game.fromLevel(level);
      recordTry();
    }
  }

  // ---------- DOM ----------
  app.className = `app blocks-play skin-${skin.id}`;
  app.innerHTML = '';
  const title = classic ? `Klassisch ${game.size}×${game.size}` : `Level ${game.level}`;
  const hintBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Tipp', html: icon('hint') });
  const moreBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Pause', html: icon('pause') });
  const top = h('header.topbar', null,
    backButton('#', () => leave()),
    h('div.title.center', null, title),
    hintBtn, moreBtn);

  const hud = h('div.hud');
  const stage = h('div.stage');
  app.append(top, hud, stage);

  const view = new BoardView(stage, skin);
  view.setGame(game);

  // ---------- HUD ----------
  let scoreShown = game.score;
  let scoreEl, bestEl, streakEl, movesEl, starsEl;
  const chipEls = new Map();
  const shownGems = { ...game.collected };

  function buildHud() {
    hud.innerHTML = '';
    if (classic) {
      hud.className = 'hud hud-classic';
      bestEl = h('div.hud-best', { html: `${icon('star', { size: 16 })}<span></span>` });
      scoreEl = h('div.hud-score', null, fmt(game.score));
      streakEl = h('div.hud-streak');
      hud.append(h('div.hud-side', null, bestEl), scoreEl, h('div.hud-side.right', null, streakEl));
    } else {
      hud.className = 'hud hud-adv';
      const goals = h('div.goals');
      for (const g of game.goalStatus()) {
        const id = g.type + (g.key || '');
        let iconEl;
        if (g.type === 'gems') iconEl = h('img.goal-ic', { src: gemIconUrl(g.key, 30), alt: GEMS[g.key].title });
        else if (g.type === 'picture') iconEl = h('img.goal-ic.pic', { src: pictureThumbUrl(pictureById(g.key), 30), alt: 'Bild' });
        else if (g.type === 'lines') iconEl = h('span.goal-ic.txt', { html: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="5" width="18" height="4" rx="2" fill="#f0a020"/><rect x="3" y="10.5" width="18" height="4" rx="2" fill="#ffc94a"/><rect x="3" y="16" width="18" height="4" rx="2" fill="#f0a020"/></svg>' });
        else iconEl = h('span.goal-ic.txt', { html: icon('star', { size: 20 }) });
        const val = h('b.goal-val');
        const chip = h('div.goal-chip', { 'data-goal': id }, iconEl, val);
        chipEls.set(id, { chip, val, g });
        goals.append(chip);
      }
      movesEl = h('b.moves-val');
      starsEl = h('div.moves-stars');
      hud.append(goals, h('div.moves', null, h('small', null, 'Teile'), movesEl, starsEl));
    }
    updateHud(true);
  }

  function updateHud(instant = false) {
    if (classic) {
      const best = Math.max(bestScore(game.size), game.score);
      bestEl.querySelector('span').textContent = fmt(best);
      animateScore(instant);
      if (game.streak >= 2) {
        streakEl.textContent = `Serie ×${game.streak}`;
        streakEl.classList.add('on');
      } else streakEl.classList.remove('on');
    } else {
      for (const s of game.goalStatus()) {
        const id = s.type + (s.key || '');
        const el = chipEls.get(id);
        if (!el) continue;
        let have = s.have;
        if (s.type === 'gems') have = Math.min(s.need, shownGems[s.key] || 0);
        const done = have >= s.need;
        el.chip.classList.toggle('done', done);
        if (s.type === 'gems') el.val.innerHTML = done ? icon('check', { size: 16 }) : String(s.need - have);
        else if (s.type === 'picture') el.val.innerHTML = done ? icon('check', { size: 16 }) : `${Math.floor((100 * s.have) / Math.max(1, s.need))}%`;
        else if (s.type === 'lines') el.val.innerHTML = done ? icon('check', { size: 16 }) : `${s.have}/${s.need}`;
        else el.val.innerHTML = done ? icon('check', { size: 16 }) : `${fmt(s.have)}/${fmt(s.need)}`;
      }
      movesEl.textContent = String(game.moves);
      const st = game.stars();
      starsEl.innerHTML = [1, 2, 3].map((k) => `<i class="${k <= st ? 'on' : ''}">${icon('star', { size: 13 })}</i>`).join('');
      const next = st === 3 ? game.par.three : st === 2 ? game.par.two : null;
      starsEl.title = next ? `${st} Sterne bis ${next} Teile` : '';
    }
  }

  let scoreRaf = 0;
  function animateScore(instant) {
    if (!scoreEl) return;
    cancelAnimationFrame(scoreRaf);
    if (instant) { scoreShown = game.score; scoreEl.textContent = fmt(scoreShown); return; }
    const from = scoreShown, to = game.score, t0 = performance.now();
    if (to > from) { scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump'); }
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 450);
      scoreShown = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      scoreEl.textContent = fmt(scoreShown);
      if (t < 1) scoreRaf = requestAnimationFrame(step);
    };
    scoreRaf = requestAnimationFrame(step);
  }

  view.gemTarget = (key) => {
    const el = chipEls.get('gems' + key);
    if (!el) return null;
    const r = el.chip.querySelector('.goal-ic').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  view.onGemArrive = (key) => {
    shownGems[key] = (shownGems[key] || 0) + 1;
    sfx.play('sparkle');
    const el = chipEls.get('gems' + key);
    if (el) { el.chip.classList.remove('bump'); void el.chip.offsetWidth; el.chip.classList.add('bump'); }
    updateHud();
  };

  buildHud();

  // ---------- Speichern ----------
  function save() {
    const data = { ...game.serialize(), ...meta };
    if (classic) saveClassic(game.size, data);
    else saveLevelSave(data);
  }
  save();
  updateSummary();

  // ---------- Eingabe ----------
  let locked = false;
  let pointerId = null;

  stage.addEventListener('pointerdown', (e) => {
    if (locked || game.over || game.won || pointerId != null) return;
    const p = view.fromClient(e.clientX, e.clientY);
    const slot = view.slotAt(p.x, p.y);
    if (slot < 0 || !game.tray[slot]) return;
    e.preventDefault();
    pointerId = e.pointerId;
    try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    hideIntro();
    view.startDrag(slot, p.x, p.y, e.pointerType);
    sfx.play('tap');
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId || !view.drag) return;
    const p = view.fromClient(e.clientX, e.clientY);
    view.updateDrag(p.x, p.y);
  });
  const finish = (e, cancel) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const d = view.drag;
    if (!d) return;
    if (!cancel && d.snap) commit(d.slot, d.snap.r, d.snap.c);
    else { view.cancelDrag(); sfx.play('thud'); }
  };
  stage.addEventListener('pointerup', (e) => finish(e, false));
  stage.addEventListener('pointercancel', (e) => finish(e, true));
  stage.addEventListener('lostpointercapture', (e) => { if (e.pointerId === pointerId) finish(e, true); });

  function commit(slot, r, c) {
    const res = game.place(slot, r, c);
    view.endDrag();
    if (!res) { view.cancelDrag(); return null; }
    save();
    sfx.play('place');
    if (navigator.vibrate) { try { navigator.vibrate(res.lines ? 18 : 8); } catch { /* ignore */ } }
    let praiseText = null;
    let sub = null;
    if (res.praise) praiseText = pick(WORDS[res.praise] || WORDS[2]);
    if (res.lines && res.streak >= 2) sub = `${WORDS.streak[0]} ×${res.streak}`;
    view.onPlaced(res, { praise: praiseText, sub });
    if (res.lines) {
      setTimeout(() => sfx.play('pop'), 70);
      if (res.lines >= 2 || res.streak >= 3) setTimeout(() => sfx.play('sparkle'), 200);
      if (res.perfect) setTimeout(() => sfx.play('complete'), 260);
    }
    if (res.refill) setTimeout(() => sfx.play('whoosh'), res.lines ? 330 : 140);

    if (classic) {
      const isRecord = updateBest(game.size, game.score);
      if (isRecord && meta.startBest > 0 && !meta.recordShown) {
        meta.recordShown = true;
        save();
        setTimeout(() => { toast('Neuer Rekord!'); sfx.play('sparkle'); }, 500);
      }
    }
    updateHud();
    updateSummary();
    if (res.won) { locked = true; setTimeout(() => winSequence(false), res.lines ? 900 : 400); }
    else if (res.over) { locked = true; setTimeout(() => overSequence(false), res.lines ? 900 : 500); }
    return res;
  }

  // ---------- Tipp, Pause ----------
  hintBtn.addEventListener('click', () => {
    if (locked || game.over || game.won) return;
    const m = bestMove(game);
    if (!m) return;
    sfx.play('sparkle');
    hideIntro();
    view.showHint(m);
  });

  moreBtn.addEventListener('click', async () => {
    sfx.play('click');
    const soundRow = h('div.sheet-row', null, h('span', null, 'Ton'), soundButton());
    const content = h('div', null,
      h('p.sheet-label', null, 'Aussehen'),
      skinPicker((sk) => { skin = sk; app.className = `app blocks-play skin-${sk.id}`; view.setSkin(sk); }),
      soundRow);
    const v = await showModal({
      title: 'Pause',
      content,
      buttons: [
        { label: 'Weiterspielen', value: 'resume', primary: true, icon: 'play' },
        { label: 'Neu starten', value: 'restart', icon: 'refresh' },
        { label: 'So geht\'s', value: 'help', icon: 'hint' },
        { label: 'Zum Menü', value: 'menu', ghost: true },
      ],
    });
    if (v === 'restart') {
      if (await confirmDialog('Neu starten?', classic ? 'Das laufende Spiel wird beendet.' : 'Das Level beginnt von vorn.', 'Neu starten')) restart();
    } else if (v === 'help') showHelp();
    else if (v === 'menu') leave();
  });

  function leave() {
    sfx.play('click');
    nav.menu(classic ? 'classic' : 'adventure');
  }

  function restart() {
    if (classic) {
      if (game.moves > 0 && !meta.counted) recordClassicGame(game);
      saveClassic(game.size, null);
    } else {
      saveLevelSave(null);
    }
    nav.reload();
  }

  // ---------- Level-Einstieg ----------
  let introEl = null;
  function showIntro() {
    if (classic || game.moves > 0 || game.won) return;
    const w = worldOf(game.level);
    const chips = h('div.intro-goals');
    for (const s of game.goalStatus()) {
      let txt;
      if (s.type === 'gems') txt = h('span.intro-goal', null, h('img', { src: gemIconUrl(s.key, 26), alt: '' }), `${s.need}× ${GEMS[s.key].title}`);
      else if (s.type === 'picture') txt = h('span.intro-goal', null, h('img', { src: pictureThumbUrl(pictureById(s.key), 26), alt: '' }), 'Bild aufdecken');
      else if (s.type === 'lines') txt = h('span.intro-goal', null, `${s.need} Linien abräumen`);
      else txt = h('span.intro-goal', null, `${fmt(s.need)} Punkte`);
      chips.append(txt);
    }
    introEl = h('div.level-intro', null,
      h('small', null, `${w.data.emoji} ${w.title}`),
      h('b', null, level && level.title ? level.title : `Level ${game.level}`),
      chips,
      h('span.intro-par', { html: `${icon('star', { size: 14 })}${icon('star', { size: 14 })}${icon('star', { size: 14 })} mit höchstens ${game.par.three} Teilen` }));
    stage.append(introEl);
    introEl.addEventListener('pointerdown', () => hideIntro());
    setTimeout(hideIntro, 2600);
  }
  function hideIntro() {
    if (!introEl) return;
    const el = introEl;
    introEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }

  // ---------- Sieg / Ende ----------
  async function winSequence(resumed) {
    locked = true;
    const stars = game.stars();
    const picId = game.goals && game.goals.picture;
    let rec = { first: false, newPic: false };
    if (!meta.recorded) {
      const gemsTotal = Object.values(game.collected).reduce((a, b) => a + b, 0);
      rec = recordWin(game.level, stars, picId, gemsTotal);
      meta.recorded = true;
      save();
      updateSummary();
    }
    view.startWin(resumed);
    if (!resumed) {
      sfx.play('complete');
      view.sparkleBoard(30);
      celebrate();
      await sleep(picId ? 1500 : 1100);
    }
    const starRow = h('div.win-stars', null, ...[1, 2, 3].map((k) => h('i' + (k <= stars ? '.on' : ''), { style: { animationDelay: `${0.15 + k * 0.18}s` }, html: icon('star', { size: 44 }) })));
    if (!resumed) [1, 2, 3].forEach((k) => { if (k <= stars) setTimeout(() => sfx.play('pop'), 300 + k * 180); });
    const parts = [starRow];
    if (picId) {
      const pic = pictureById(picId);
      parts.push(h('div.win-pic', null, h('img', { src: pictureThumbUrl(pic, 96), alt: pic.title }), h('span', null, rec.newPic ? `Neu im Album: «${pic.title}»` : `«${pic.title}»`)));
    }
    const hint = stars < 3 ? `Für ${stars + 1} Sterne: höchstens ${stars === 2 ? game.par.three : game.par.two} Teile.` : 'Perfekt – alle Sterne!';
    parts.push(h('p.win-line', null, `${game.moves} Teile · ${fmt(game.score)} Punkte`));
    parts.push(h('p.win-hint', null, hint));
    const v = await showModal({
      title: `Level ${game.level} geschafft!`,
      content: h('div.win', null, ...parts),
      dismissible: false,
      buttons: [
        { label: `Weiter zu Level ${game.level + 1}`, value: 'next', primary: true, icon: 'play' },
        { label: 'Nochmal spielen', value: 'again', icon: 'refresh' },
        { label: 'Levelkarte', value: 'map', ghost: true },
      ],
    });
    saveLevelSave(null);
    if (v === 'next') nav.level(game.level + 1);
    else if (v === 'again') nav.level(game.level, true);
    else nav.map();
  }

  async function overSequence(resumed) {
    locked = true;
    view.startGameOver();
    if (!resumed) {
      sfx.play('thud');
      view.shake(6);
      await sleep(900);
    }
    if (classic) {
      const isRecord = game.score > 0 && game.score >= bestScore(game.size) && game.score > (meta.startBest || 0);
      if (!meta.counted) {
        recordClassicGame(game);
        meta.counted = true;
        save();
        updateSummary();
      }
      if (isRecord && !resumed) { celebrate(); sfx.play('complete'); }
      const content = h('div.over', null,
        h('div.over-score', null, fmt(game.score)),
        h('p.over-best', { html: isRecord ? `${icon('star', { size: 16 })} Neuer Rekord!` : `Rekord: ${fmt(bestScore(game.size))}` }),
        h('p.over-line', null, `${game.lines} Linien · beste Kombo ${game.bestCombo || 0} · Serie ${game.bestStreak || 0}×`));
      const buttons = [];
      if (game.rescues === 0) buttons.push({ label: 'Neue Teile – weiterspielen', value: 'rescue', primary: true, icon: 'refresh' });
      buttons.push({ label: 'Neues Spiel', value: 'new', primary: game.rescues > 0, icon: 'play' });
      buttons.push({ label: 'Zum Menü', value: 'menu', ghost: true });
      const v = await showModal({ title: isRecord ? 'Super gespielt!' : 'Keine Züge mehr', content, dismissible: false, buttons });
      if (v === 'rescue') doRescue();
      else if (v === 'new') { saveClassic(game.size, null); nav.reload(); }
      else { saveClassic(game.size, null); nav.menu('classic'); }
    } else {
      const left = game.goalStatus().filter((s) => !s.done).map((s) => {
        if (s.type === 'gems') return `${s.need - s.have}× ${GEMS[s.key].title}`;
        if (s.type === 'picture') return `${s.need - s.have} Felder vom Bild`;
        if (s.type === 'lines') return `${s.need - s.have} Linien`;
        return `${fmt(s.need - s.have)} Punkte`;
      });
      const content = h('div.over', null,
        h('p', null, 'Kein Teil passt mehr aufs Brett.'),
        left.length ? h('p.over-line', null, `Es fehlen noch: ${left.join(', ')}`) : null);
      const buttons = [];
      if (game.rescues === 0) buttons.push({ label: 'Neue Teile (gratis)', value: 'rescue', primary: true, icon: 'refresh' });
      buttons.push({ label: 'Nochmal versuchen', value: 'again', primary: game.rescues > 0, icon: 'play' });
      buttons.push({ label: 'Levelkarte', value: 'map', ghost: true });
      const v = await showModal({ title: 'Kein Platz mehr', content, dismissible: false, buttons });
      if (v === 'rescue') doRescue();
      else if (v === 'again') { saveLevelSave(null); nav.level(game.level, true); }
      else { saveLevelSave(null); nav.map(); }
    }
  }

  function doRescue() {
    game.rescue();
    save();
    view.stopGameOver();
    view.newTray();
    sfx.play('whoosh');
    locked = false;
    updateHud();
    if (game.over) setTimeout(() => overSequence(false), 600);
  }

  // ---------- Start ----------
  const onHide = () => save();
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);

  if (game.won) setTimeout(() => winSequence(true), 200);
  else if (game.over) setTimeout(() => overSequence(true), 200);
  else showIntro();

  // Test-Zugang (für automatische Tests)
  window.__blocks = {
    get game() { return game; },
    view,
    level,
    hint: () => bestMove(game),
    place: (slot, r, c) => commit(slot, r, c),
    layout: () => {
      const L = view.L;
      const o = view.toClient(0, 0);
      return { ...L, left: o.x, top: o.y, slots: L.slots.map((s) => ({ ...s, x: s.x + o.x, y: s.y + o.y })) };
    },
    /** Finger-Weg (Bildschirm-Koordinaten), um Teil `slot` an (r, c) zu ziehen. */
    dragPlan: (slot, r, c) => {
      const v = game.tray[slot];
      if (!v) return null;
      const L = view.L;
      const p = view.trayPiecePos(slot, v);
      const from = view.toClient(p.x + (v.w * L.ts) / 2, p.y + (v.h * L.ts) / 2);
      const lift = Math.max(52, L.cs * 1.25);
      const to = view.toClient(L.bx + c * L.cs + (v.w * L.cs) / 2, L.by + r * L.cs + v.h * L.cs + lift);
      return { from, to };
    },
  };

  return {
    destroy() {
      cancelAnimationFrame(scoreRaf);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      view.destroy();
      if (window.__blocks && window.__blocks.view === view) delete window.__blocks;
    },
  };
}
