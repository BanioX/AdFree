// Stapel-Sortieren – Bausteine für die animierten Tutorial-Demos (echtes Mini-Spielfeld + Finger).
//
//   sortTutorial({ view, rules, names, core: {...}, goal: {...}, help: {...}, modes: {...} })
//   → Schritte für showTutorial()

import { h, icon } from '../../shared/ui.js';
import { createBoard } from './board.js';
import { cloneState, applyMove, pickCount } from './engine.js';

/** Baut ein echtes kleines Spielfeld in die Tutorial-Bühne. */
export function demoBoard(stage, api, view, state, rules, { tools = false } = {}) {
  const host = h('div.sb-demo' + (tools ? '.with-tools' : ''));
  stage.append(host);
  const board = createBoard(host, { ...view, maxPiece: Math.min(view.maxPiece || 40, 30) }, { lockComplete: rules.complete === 'lock' });
  api.signal.addEventListener('abort', () => board.destroy(), { once: true });
  let st;
  const reset = () => { st = cloneState(state); board.set(st); };
  reset();
  async function tapMove(from, to) {
    await api.finger.tap(board.stackEl(from), 520);
    board.lift(from, pickCount(st, from, rules));
    await api.sleep(320);
    await api.finger.tap(board.stackEl(to), 520);
    const rec = applyMove(st, from, to, rules);
    if (!rec) { board.drop(); return null; }
    await board.move(rec);
    board.refreshDone(st);
    return rec;
  }
  return { board, reset, tapMove, get state() { return st; }, host };
}

export function sortTutorial(o) {
  const { view, rules, names } = o;
  const steps = [
    {
      title: o.core.title,
      text: o.core.text,
      demo(stage, api) {
        const d = demoBoard(stage, api, view, o.core.state, rules);
        return api.loop(async () => {
          d.reset();
          await api.sleep(350);
          for (const [f, t] of o.core.moves) { await d.tapMove(f, t); await api.sleep(250); }
          api.finger.hide();
          await api.sleep(900);
        }, 300);
      },
    },
    {
      title: o.goal.title,
      text: o.goal.text,
      demo(stage, api) {
        const d = demoBoard(stage, api, view, o.goal.state, rules);
        return api.loop(async () => {
          d.reset();
          await api.sleep(350);
          for (const [f, t] of o.goal.moves) { await d.tapMove(f, t); await api.sleep(200); }
          api.finger.hide();
          await api.sleep(1500);
        }, 300);
      },
    },
    {
      title: o.help.title,
      text: o.help.text,
      demo(stage, api) {
        const d = demoBoard(stage, api, view, o.help.state, rules, { tools: true });
        const mk = (ic, label) => h('span.sb-demo-tool', null, h('i', { html: icon(ic, { size: 18 }) }), h('small', null, label));
        const tUndo = mk('undo', 'Zurück'), tHint = mk('hint', 'Tipp'), tExtra = mk('plus', names.extra);
        stage.append(h('div.sb-demo-tools', null, tUndo, tHint, tExtra));
        return api.loop(async () => {
          d.reset();
          await api.sleep(400);
          await api.finger.tap(tHint, 520);
          tHint.classList.add('on');
          const [hf, ht] = o.help.hint;
          d.board.flash(hf, 'hint-src', 1400);
          d.board.flash(ht, 'hint-dst', 1400);
          await api.sleep(1100);
          tHint.classList.remove('on');
          await api.finger.tap(tExtra, 520);
          tExtra.classList.add('on');
          d.state.stacks.push([]);
          d.board.addStack();
          await api.sleep(600);
          tExtra.classList.remove('on');
          const [f, t] = o.help.after;
          await d.tapMove(f, t === -1 ? d.state.stacks.length - 1 : t);
          await api.sleep(500);
          await api.finger.tap(tUndo, 520);
          tUndo.classList.add('on');
          await api.sleep(250);
          tUndo.classList.remove('on');
          api.finger.hide();
          await api.sleep(900);
        }, 300);
      },
    },
  ];
  if (o.modes) {
    steps.push({
      title: o.modes.title || 'Drei Arten zu spielen',
      text: o.modes.text,
      art: modesArt(o.modes.items),
    });
  }
  return steps;
}

function modesArt(items) {
  const wrap = h('div.sb-demo-modes');
  for (const it of items) wrap.append(h('div.sb-demo-mode', null, h('span', null, it.emoji), h('b', null, it.label), h('small', null, it.sub)));
  return wrap;
}
