// Zahlen-Familie – App-Gerüst für Ziffern-Rätsel: Startbildschirm, Routen (#play/<stufe>, #daily),
// Erzeugung im Hintergrund (Web Worker), Statistik, Sterne, Tagesrätsel, Gewinnblatt.
//
//   runDigitApp({
//     id, accent, colors, title, tagline,
//     diffs: [{ id, label, sub }], modesLabel, defaultDiff, dailyDiff, dailySub,
//     workerUrl, generateSync(diffId, seed) → puzzle,
//     makeBoard(puzzle) → DigitBoard, candidates(st, i), helper(st, sel), onHelperTap(st, sel, api),
//     padCounts, tutorial() → steps, sizeLabel(puzzle) → '7×7',
//   });

import { setupPage, h, showModal, confirmDialog } from '../../shared/ui.js';
import { store, reportSummary, todayKey, markDailyDone, isDailyDone, dailyStreak } from '../../shared/storage.js';
import { gameMenu } from '../../shared/gamemenu.js';
import { showTutorial, tutorialSeen } from '../../shared/tutorial.js';
import { plural } from '../../shared/i18n.js';
import { makeRouter, winSheet, statStore, formatTime } from './hud.js';
import * as D from './digitgame.js';
import { digitPlay } from './digitplay.js';
import { T } from './digits-i18n.js';

export function runDigitApp(cfg) {
  const ID = cfg.id;
  const K = {
    game: (slot) => `${ID}.game.${slot}`,
    next: `${ID}.next`,
    diff: `${ID}.diff`,
    coach: `${ID}.coachDone`,
    pre: `${ID}.pre`,
  };
  const stats = statStore(`${ID}.stats`, { won: {}, best: {}, perfect: 0, daily: 0, time: 0, stars: 0, started: 0 });
  const diffIds = cfg.diffs.map((d) => d.id);
  const diffById = (id) => cfg.diffs.find((d) => d.id === id) || cfg.diffs[0];

  setupPage();
  document.documentElement.style.setProperty('--accent', cfg.accent);
  const app = document.getElementById('app');
  let view = null;
  let token = 0;

  const loadSlot = (slot) => { const st = store.get(K.game(slot), null); return D.validState(st) ? st : null; };
  const saveSlot = (slot, st) => store.set(K.game(slot), st);
  const nextNumber = (diff) => (store.get(K.next, {}) || {})[diff] || 1;
  const bumpNumber = (diff, n) => store.update(K.next, {}, (o) => { o[diff] = Math.max(o[diff] || 1, n + 1); return o; });
  const curDiff = () => { const d = store.get(K.diff, cfg.defaultDiff || diffIds[0]); return diffIds.includes(d) ? d : diffIds[0]; };
  const wonTotal = () => { const s = stats.get(); return Object.values(s.won).reduce((a, b) => a + b, 0) + s.daily; };
  const running = (slot) => { const st = loadSlot(slot); return st && !st.done ? st : null; };
  const seedFor = (diff, n) => `${ID}:${diff}:${n}`;
  const isGold = (n) => n > 0 && n % 10 === 0;

  // ---------- Erzeugung (Worker mit Rückfall auf Hauptthread) ----------
  let worker = null;
  let reqId = 0;
  const pending = new Map();
  function failWorker() {
    worker = false;
    for (const [, q] of pending) setTimeout(() => { try { q.res(cfg.generateSync(q.diff, q.seed)); } catch (e) { q.rej(e); } }, 20);
    pending.clear();
  }
  function generate(diff, seed) {
    if (worker === null && cfg.workerUrl && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(cfg.workerUrl, { type: 'module' });
        worker.onmessage = (e) => {
          const q = pending.get(e.data.id);
          if (!q) return;
          pending.delete(e.data.id);
          if (e.data.error) { try { q.res(cfg.generateSync(q.diff, q.seed)); } catch (err) { q.rej(err); } } else q.res(e.data.puzzle);
        };
        worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); failWorker(); };
      } catch { worker = false; }
    }
    return new Promise((res, rej) => {
      if (worker) {
        const id = ++reqId;
        pending.set(id, { res, rej, diff, seed });
        worker.postMessage({ id, diff, seed });
      } else {
        setTimeout(() => { try { res(cfg.generateSync(diff, seed)); } catch (e) { rej(e); } }, 30);
      }
    });
  }

  /** Rätsel Nr. n einer Stufe – aus dem Vorrat oder frisch erzeugt. */
  function puzzleFor(diff, n) {
    const pre = store.get(K.pre, {}) || {};
    const hit = pre[diff];
    if (hit && hit.n === n && hit.puzzle && hit.puzzle.sol) return Promise.resolve(hit.puzzle);
    return generate(diff, seedFor(diff, n));
  }

  /** Nächstes Rätsel im Hintergrund vorbereiten, damit «Spielen» sofort startet. */
  let prepping = false;
  function prepareNext(diff) {
    if (prepping || worker === false || !cfg.workerUrl) return;
    const n = nextNumber(diff);
    const pre = store.get(K.pre, {}) || {};
    if (pre[diff] && pre[diff].n === n) return;
    prepping = true;
    generate(diff, seedFor(diff, n)).then((puzzle) => {
      store.update(K.pre, {}, (o) => { o[diff] = { n, puzzle }; return o; });
    }).catch(() => {}).finally(() => { prepping = false; });
  }

  // ---------- Texte ----------
  function summaryText() {
    const d = curDiff();
    const st = running(d);
    const parts = [];
    if (st) parts.push(`${diffById(d).label} · ${T('nr', { n: st.meta.number })} · ${T('percent', { n: Math.round(D.progress(st) * 100) })}`);
    else parts.push(wonTotal() ? T('solvedN', { n: wonTotal() }) : T('ready'));
    if (isDailyDone(ID)) parts.push(T('dailyDone'));
    return parts.join(' · ');
  }

  // ---------- Tutorial ----------
  let tutorialOpen = null;
  function showHowTo() {
    if (tutorialOpen) return tutorialOpen;
    tutorialOpen = showTutorial({ id: ID, steps: cfg.tutorial(), accent: cfg.accent }).finally(() => { tutorialOpen = null; });
    return tutorialOpen;
  }

  // ---------- Router ----------
  const go = makeRouter(route);

  function route() {
    token++;
    if (view) { try { view.teardown(); } catch { /* ignore */ } view = null; }
    const [name, arg] = (location.hash || '').replace(/^#/, '').split('/');
    if (name === 'play' && diffIds.includes(arg)) return showGame(arg);
    if (name === 'daily') return showGame('daily');
    return showMenu();
  }

  function startNew(diff) {
    store.remove(K.game(diff));
    go('play/' + diff);
  }

  // ---------- Menü ----------
  function primaryFor(diff) {
    const spec = diffById(diff);
    const st = running(diff);
    if (st) {
      const pct = Math.round(D.progress(st) * 100);
      return { label: T('resume'), sub: `${spec.label} · ${T('nr', { n: st.meta.number })} · ${T('percent', { n: pct })}`, onClick: () => go('play/' + diff) };
    }
    const n = nextNumber(diff);
    return { label: T('play'), sub: `${spec.label} · ${T('puzzleNo', { n })}${isGold(n) ? ' · ★' : ''}`, onClick: () => go('play/' + diff) };
  }

  function secondaryFor(diff) {
    const list = [];
    if (running(diff)) {
      list.push({
        label: T('newPuzzle'), icon: 'plus',
        onClick: async () => {
          const st = running(diff);
          if (st && D.progress(st) > 0 && !(await confirmDialog(T('confirmNew'), T('confirmNewText'), T('newPuzzle')))) return;
          startNew(diff);
        },
      });
    }
    list.push({ label: T('stats'), icon: 'star', onClick: () => showStats() });
    return list;
  }

  function dailyInfo() {
    const st = loadSlot('daily');
    const today = st && st.meta.day === todayKey();
    let sub = cfg.dailySub || diffById(cfg.dailyDiff).label;
    if (today && !st.done && D.progress(st) > 0) sub = T('percent', { n: Math.round(D.progress(st) * 100) });
    return { label: T('daily'), done: isDailyDone(ID), sub, streak: dailyStreak(ID), onClick: () => go('daily') };
  }

  function menuStats() {
    const s = stats.get();
    const d = curDiff();
    const streak = dailyStreak(ID);
    return [
      { label: T('solved'), value: wonTotal() },
      { label: T('stars'), value: `★ ${s.stars}` },
      { label: T('bestTime'), value: s.best[d] ? formatTime(s.best[d]) : '–' },
      { label: T('streak'), value: streak ? `🔥 ${streak}` : '0' },
    ];
  }

  function showMenu() {
    reportSummary(ID, summaryText());
    let diff = curDiff();
    const menu = gameMenu({
      id: ID,
      title: cfg.title,
      tagline: cfg.tagline,
      accent: cfg.accent,
      primary: primaryFor(diff),
      daily: dailyInfo(),
      modes: {
        label: cfg.modesLabel || T('difficulty'),
        value: diff,
        options: cfg.diffs.map((d) => ({ id: d.id, label: d.label, sub: d.sub })),
        onChange(id) {
          diff = id;
          store.set(K.diff, id);
          menu.update({ primary: primaryFor(id), secondary: secondaryFor(id), stats: menuStats() });
          prepareNext(id);
        },
      },
      secondary: secondaryFor(diff),
      stats: menuStats(),
      sections: cfg.menuSections ? cfg.menuSections() : null,
      onHelp: () => showHowTo(),
      backHref: '../',
    });
    app.replaceChildren(menu);
    setTimeout(() => { if (!location.hash) prepareNext(diff); }, 600);
  }

  async function showStats() {
    const s = stats.get();
    const tile = (v, l) => h('div', null, h('b', null, String(v)), h('small', null, l));
    const rows = cfg.diffs.map((d) => h('div.nx-win-tiles', null,
      tile(s.won[d.id] || 0, `${d.label} · ${T('solved')}`), tile(s.best[d.id] ? formatTime(s.best[d.id]) : '–', T('bestTime'))));
    const content = h('div.nx-win.dp-stats', null, ...rows,
      h('div.nx-win-tiles', null, tile(s.daily, T('dailyN')), tile(s.perfect, T('perfect'))),
      h('div.nx-win-tiles', null, tile(`★ ${s.stars}`, T('starsTotal')), tile(formatTime(s.time), T('playTime'))));
    await showModal({ title: T('stats'), content, buttons: [{ label: T('close'), value: true, primary: true }] });
  }

  // ---------- Spiel ----------
  function playSub(slot, st) {
    const size = cfg.sizeLabel ? cfg.sizeLabel(st.puzzle) : '';
    if (slot === 'daily') return [T('sameForAll'), size].filter(Boolean).join(' · ');
    return [T('puzzleNo', { n: st.meta.number }), st.meta.gold ? '★ ' + T('gold') : size].filter(Boolean).join(' · ');
  }

  function showLoading(slot) {
    const isDaily = slot === 'daily';
    const back = h('button.icon-btn', { type: 'button', 'aria-label': T('back'), onclick: () => go('') });
    back.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
    app.replaceChildren(h('div.nx-screen.dp-play', null,
      h('header.topbar.nx-top', null, back, h('div.nx-title', null, h('b', null, isDaily ? T('daily') : diffById(slot).label), h('small', null, ''))),
      h('main.nx-main.dp-main', null, h('div.dp-loading', null, h('div.dp-spinner'), h('span', null, T('loading'))))));
  }

  function showGame(slot) {
    const my = token;
    const isDaily = slot === 'daily';
    if (!isDaily) store.set(K.diff, slot);
    let st = loadSlot(slot);
    if (isDaily && st && st.meta.day !== todayKey()) st = null;
    if (st) return mount(slot, st);
    showLoading(slot);
    const day = todayKey();
    const n = isDaily ? 0 : nextNumber(slot);
    const diff = isDaily ? cfg.dailyDiff : slot;
    const seed = isDaily ? `${ID}:daily:${day}` : seedFor(slot, n);
    const p = isDaily ? generate(diff, seed) : puzzleFor(slot, n);
    p.then((puzzle) => {
      if (my !== token) return;
      const fresh = D.newState(puzzle, { diff, slot, number: n, day: isDaily ? day : null, gold: !isDaily && isGold(n) });
      if (!isDaily) {
        bumpNumber(slot, n);
        store.update(K.pre, {}, (o) => { if (o[slot] && o[slot].n <= n) delete o[slot]; return o; });
      }
      stats.update((s) => { s.started++; });
      saveSlot(slot, fresh);
      mount(slot, fresh);
    }).catch((e) => { console.warn(e); if (my === token) go(''); });
  }

  function mount(slot, st) {
    const isDaily = slot === 'daily';
    const coach = !store.get(K.coach, false) && wonTotal() === 0;
    view = digitPlay(app, st, {
      title: isDaily ? T('daily') : diffById(slot).label,
      sub: playSub(slot, st),
      className: st.meta.gold ? 'dp-gold' : '',
      makeBoard: (p) => cfg.makeBoard(p, st),
      candidates: cfg.candidates,
      helper: cfg.helper,
      onHelperTap: cfg.onHelperTap,
      onBlockTap: cfg.onBlockTap,
      padCounts: cfg.padCounts,
      coach,
      coachDigitText: cfg.coachDigitText,
      cardPad: cfg.cardPad,
      onCoachDone: () => store.set(K.coach, true),
      save: (s) => {
        const cur = store.get(K.game(slot), null);
        if (cur && cur.created && cur.created !== s.created) return; // nie ein neueres Rätsel überschreiben
        saveSlot(slot, s);
        reportSummary(ID, summaryText());
      },
      onWin: (s) => onWin(slot, s),
      onBack: () => go(''),
      onHelp: () => showHowTo(),
    });
    window.__dp = { api: view.api, slot, get state() { return view && view.api.state; } };
    if (!isDaily) setTimeout(() => prepareNext(slot), 1500);
  }

  async function onWin(slot, st) {
    const isDaily = slot === 'daily';
    const base = D.starsFor(st);
    const earned = base * (st.meta.gold ? 2 : 1);
    let newBest = false;
    if (!st.counted) {
      st.counted = true;
      stats.update((s) => {
        s.time += Math.round(st.elapsed || 0);
        if (st.mistakes === 0 && st.hints === 0) s.perfect++;
        s.stars += earned;
        if (isDaily) s.daily++;
        else {
          s.won[slot] = (s.won[slot] || 0) + 1;
          if (!s.best[slot] || st.elapsed < s.best[slot]) { newBest = !!s.best[slot]; s.best[slot] = Math.round(st.elapsed); }
        }
      });
      if (isDaily) markDailyDone(ID, st.meta.day);
      saveSlot(slot, st);
    }
    reportSummary(ID, summaryText());
    const streak = dailyStreak(ID);
    const titles = [T('winA'), T('winB'), T('winC')];
    const v = await winSheet({
      title: isDaily ? T('winDaily') : titles[(st.meta.number || 0) % 3],
      stars: isDaily ? null : base,
      badge: isDaily ? '🗓️' : (st.meta.gold ? '🏅' : null),
      tiles: [
        { value: formatTime(st.elapsed), label: T('time') },
        { value: st.mistakes, label: T('mistakes') },
        { value: st.hints, label: st.hints === 1 ? T('hint1') : T('hintsN') },
      ],
      note: newBest ? T('newBest')
        : isDaily ? T('dailyNote', { n: plural(streak, [T('day'), T('days')], [T('day'), T('days')]) })
          : st.meta.gold ? `★ ${T('gold')} · +${earned} ${T('stars')}`
            : `${diffById(slot).label} · ${T('puzzleNo', { n: st.meta.number })}`,
      colors: cfg.colors,
      buttons: isDaily
        ? [{ label: T('menu'), value: 'menu', primary: true }]
        : [{ label: T('next'), value: 'next', primary: true, icon: 'play' }, { label: T('menu'), value: 'menu', ghost: true }],
    });
    if (v === 'next') startNew(slot);
    else go('');
  }

  route();
  if (!tutorialSeen(ID)) showHowTo();
  return { go, generate };
}
