// Juwelen – «So geht's»: vier kurze Schritte, jeder mit einer kleinen, echten Spielszene.
// Die Mini-Bretter benutzen dieselben Juwelen-Bilder, Feldfarben und Effekte wie das Spiel.

import { h } from '../shared/ui.js';
import { L } from '../shared/i18n.js';
import { spriteURL, gemMain } from './sprites.js';
import { worlds } from './data/worlds.js';

const W0 = worlds[0];
const KIND_COLOR = (k) => (typeof k === 'number' ? k : /^[hvb]\d$/.test(k) ? +k[1] : -1);

/**
 * Kleines Spielbrett aus DOM-Elementen. rows: Zeilen mit Juwelen-Arten
 * (0–5 Farbe, 'h4' Blitz, 'b2' Bombe, 'rainbow', 'stone').
 */
class MiniBoard {
  constructor(rows) {
    this.h = rows.length;
    this.w = rows[0].length;
    this.el = h('div.m3t-board', { style: `--cols:${this.w};--rows:${this.h};--c1:${W0.cells[0]};--c2:${W0.cells[1]}` });
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) this.el.append(h('i.m3t-cell' + ((r + c) % 2 ? '.alt' : '')));
    }
    this.layer = h('div.m3t-layer');
    this.el.append(this.layer);
    this.load(rows);
  }

  load(rows, born = false) {
    this.layer.replaceChildren();
    this.grid = rows.map((row, r) => row.map((k, c) => this._gem(k, r, c)));
    if (born) this.layer.querySelectorAll('.m3t-gem').forEach((g) => g.classList.add('m3t-born'));
  }

  _gem(kind, r, c) {
    const img = h('img.m3t-gem', { src: spriteURL(String(kind), 72), alt: '', draggable: 'false' });
    img.kind = kind;
    this._place(img, r, c);
    this.layer.append(img);
    return img;
  }

  _place(el, r, c) { el.style.setProperty('--x', c); el.style.setProperty('--y', r); }

  at(r, c) { return this.grid[r][c]; }

  /** Tauscht zwei Nachbarn (mit Gleit-Animation). */
  swap([r1, c1], [r2, c2]) {
    const a = this.grid[r1][c1], b = this.grid[r2][c2];
    this.grid[r1][c1] = b; this.grid[r2][c2] = a;
    this._place(a, r2, c2); this._place(b, r1, c1);
  }

  /** Lässt Juwelen mit Glitzer verschwinden; liefert die entfernten Elemente. */
  pop(list, { burst = true } = {}) {
    const out = [];
    for (const [r, c] of list) {
      const g = this.grid[r][c];
      if (!g) continue;
      this.grid[r][c] = null;
      g.classList.add('m3t-pop');
      if (burst) this._burst(r, c, g.kind === 'stone' ? '#a2968c' : gemMain(KIND_COLOR(g.kind)));
      setTimeout(() => g.remove(), 420);
      out.push(g);
    }
    return out;
  }

  _burst(r, c, color) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5;
      const d = 0.55 + Math.random() * 0.35;
      const s = h('i.m3t-spark', { style: `--x:${c};--y:${r};--dx:${(Math.cos(a) * d).toFixed(2)};--dy:${(Math.sin(a) * d).toFixed(2)};background:${color}` });
      this.layer.append(s);
      setTimeout(() => s.remove(), 600);
    }
  }

  /** Verwandelt ein Juwel (z.B. in ein Sonderjuwel). */
  morph(r, c, kind) {
    const g = this.grid[r][c];
    g.kind = kind;
    g.src = spriteURL(String(kind), 72);
    g.classList.remove('m3t-born'); void g.offsetWidth; g.classList.add('m3t-born');
  }

  /** Lücken auffüllen: Juwelen rutschen nach unten, neue fallen von oben herein. fresh[c] = Arten von oben. */
  fall(fresh = {}) {
    for (let c = 0; c < this.w; c++) {
      const col = [];
      for (let r = this.h - 1; r >= 0; r--) if (this.grid[r][c]) col.push(this.grid[r][c]);
      const add = (fresh[c] || []).slice();
      const missing = this.h - col.length;
      for (let k = 0; k < missing; k++) {
        const kind = add.length ? add.pop() : (k + c) % 6;
        const g = this._gem(kind, -1 - k, c);
        g.classList.add('m3t-falling');
        col.push(g);
      }
      void this.layer.offsetWidth;
      col.forEach((g, k) => {
        const r = this.h - 1 - k;
        this.grid[r][c] = g;
        g.classList.add('m3t-falling');
        this._place(g, r, c);
      });
    }
    setTimeout(() => this.layer.querySelectorAll('.m3t-falling').forEach((g) => g.classList.remove('m3t-falling')), 520);
  }

  /** Lichtstrahl über eine ganze Reihe (Blitz-Juwel). */
  beam(r) {
    const b = h('i.m3t-beam', { style: `--y:${r}` });
    this.layer.append(b);
    setTimeout(() => b.remove(), 650);
  }
}

/** Schwebender Text im Spielstil (z.B. «+60», «Blitz!»). */
function floatText(board, r, c, text, color = '#d0447c') {
  const t = h('b.m3t-float', { style: `--x:${c};--y:${r};--col:${color}` }, text);
  board.layer.append(t);
  setTimeout(() => t.remove(), 1000);
}

/** Juwelen-Bilder zu einem Ziel fliegen lassen (wie im Spiel zur Zielanzeige). */
function flyTo(stage, gems, target) {
  const s = stage.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  gems.forEach((g, k) => {
    const r = g.getBoundingClientRect();
    const f = h('img.m3t-fly', { src: g.src, alt: '', style: `left:${r.left - s.left}px;top:${r.top - s.top}px;width:${r.width}px;height:${r.height}px` });
    stage.append(f);
    const dx = t.left + t.width * 0.25 - (r.left + r.width / 2);
    const dy = t.top + t.height / 2 - (r.top + r.height / 2);
    const anim = f.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 18}px) scale(1.1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.9 },
    ], { duration: 520, delay: k * 70, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
    anim.onfinish = () => f.remove();
  });
}

function bump(el) { el.classList.remove('m3t-bump'); void el.offsetWidth; el.classList.add('m3t-bump'); }

const scene = (stage, ...children) => {
  const wrap = h('div.m3t-scene', { style: `--sky1:${W0.sky[0]};--sky2:${W0.sky[1]}` }, ...children);
  stage.append(wrap);
  return wrap;
};

/** Ein Wisch von Juwel a nach b mit dem animierten Finger, danach Tausch. */
async function swipe(api, board, a, b) {
  await api.finger.drag([board.at(...a), board.at(...b)], 380);
  board.swap(a, b);
  await api.sleep(240);
}

export const tutorialSteps = [
  {
    title: L('Juwelen tauschen', 'Swap jewels'),
    text: L('Wische ein Juwel zum Nachbarn, damit drei gleiche in einer Reihe stehen.', 'Swipe a jewel to its neighbour to line up three of a kind.'),
    demo(stage, api) {
      const start = [[4, 3, 5, 2], [1, 2, 0, 3], [0, 0, 3, 5], [5, 1, 4, 4]];
      const board = new MiniBoard(start);
      scene(stage, board.el);
      return api.loop(async () => {
        board.load(start, true);
        await api.sleep(350);
        await swipe(api, board, [1, 2], [2, 2]);
        board.pop([[2, 0], [2, 1], [2, 2]]);
        floatText(board, 2, 1, '+30');
        await api.sleep(380);
        api.finger.hide();
        board.fall({ 0: [2], 1: [5], 2: [1] });
        await api.sleep(1500);
      }, 200);
    },
  },
  {
    title: L('Ziele erfüllen', 'Reach the goals'),
    text: L('Sammle, was oben steht, bevor die Züge ausgehen.', 'Collect what the top bar shows before you run out of moves.'),
    demo(stage, api) {
      const start = [[0, 0, 4, 2], [1, 5, 0, 3], [0, 0, 3, 5]];
      const board = new MiniBoard(start);
      const moves = h('b', null, '5');
      const count = h('b', null, '6');
      const movesBox = h('div.m3t-moves', null, moves, h('small', null, L('Züge', 'Moves')));
      const goal = h('div.m3t-goal', null, h('img', { src: spriteURL('0', 72), alt: '' }), count);
      const stars = h('div.m3t-stars', null, ...[0, 1, 2].map(() => h('span', null, '★')));
      scene(stage, h('div.m3t-hud', null, movesBox, goal), board.el, stars);
      const collect = async (cells, left, mv, fresh) => {
        const gone = board.pop(cells);
        flyTo(stage, gone, goal);
        await api.sleep(560);
        count.textContent = left > 0 ? String(left) : '✓';
        goal.classList.toggle('done', left === 0);
        bump(goal);
        moves.textContent = String(mv);
        bump(movesBox);
        board.fall(fresh);
      };
      return api.loop(async () => {
        board.load(start, true);
        count.textContent = '6'; moves.textContent = '5';
        goal.classList.remove('done');
        stars.classList.remove('show');
        await api.sleep(300);
        await swipe(api, board, [1, 2], [2, 2]);
        await collect([[2, 0], [2, 1], [2, 2]], 3, 4, { 0: [3], 1: [1], 2: [0] });
        await api.sleep(500);
        await swipe(api, board, [0, 2], [1, 2]);
        api.finger.hide();
        await collect([[1, 0], [1, 1], [1, 2]], 0, 3, { 0: [4], 1: [2], 2: [5] });
        await api.sleep(250);
        stars.classList.add('show');
        await api.sleep(1700);
      }, 200);
    },
  },
  {
    title: L('Sonderjuwelen bauen', 'Make special jewels'),
    text: L('Vier oder mehr gleiche ergeben ein Sonderjuwel mit Extra-Kraft.', 'Match four or more to create a special jewel with extra power.'),
    demo(stage, api) {
      const start = [[2, 5, 4, 3, 1], [4, 4, 1, 4, 2], [3, 4, 5, 4, 3]];
      const board = new MiniBoard(start);
      const legend = h('div.m3t-legend', null,
        ...[['h4', L('4 in Reihe', '4 in a row')], ['b0', L('L oder T', 'L or T')], ['rainbow', L('5 in Reihe', '5 in a row')]].map(([k, label]) =>
          h('span', null, h('img', { src: spriteURL(k, 72), alt: '' }), h('small', null, label))));
      scene(stage, board.el, legend);
      return api.loop(async () => {
        board.load(start, true);
        legend.firstChild.classList.remove('on');
        await api.sleep(300);
        // 4 Saphire in einer Reihe → Blitz
        await swipe(api, board, [0, 2], [1, 2]);
        board.pop([[1, 0], [1, 1], [1, 3]]);
        board.morph(1, 2, 'h4');
        floatText(board, 1, 2, L('Blitz!', 'Zap!'), '#1c6fd1');
        legend.firstChild.classList.add('on');
        await api.sleep(420);
        board.fall({ 0: [1], 1: [2], 3: [5] });
        await api.sleep(800);
        // Blitz in eine Dreierreihe ziehen → räumt die ganze Reihe ab
        await swipe(api, board, [1, 2], [2, 2]);
        api.finger.hide();
        board.beam(2);
        board.pop([[2, 1], [2, 2], [2, 3]]);
        await api.sleep(120);
        board.pop([[2, 0], [2, 4]]);
        await api.sleep(380);
        board.fall({ 0: [2], 1: [3], 2: [0], 3: [1], 4: [5] });
        await api.sleep(1500);
      }, 200);
    },
  },
  {
    title: L('Hilfen sind gratis', 'Free helpers'),
    text: L('Hammer, Mischen und Tipp helfen dir – ohne Warten, ohne Leben.', 'Hammer, shuffle and hint help you – no waiting, no lives.'),
    demo(stage, api) {
      const start = [[2, 5, 3, 1], [1, 'stone', 4, 2], [3, 4, 1, 5]];
      const board = new MiniBoard(start);
      const tool = (ic, label) => h('div.m3-tool.m3t-tool', null, h('span.m3-tool-ic', null, ic), h('small', null, label));
      const hammer = tool('🔨', 'Hammer'), shuffle = tool('🔀', L('Mischen', 'Shuffle')), hint = tool('💡', L('Tipp', 'Hint'));
      scene(stage, board.el, h('div.m3t-tools', null, hammer, shuffle, hint));
      return api.loop(async () => {
        board.load(start, true);
        await api.sleep(300);
        await api.finger.tap(hammer, 520);
        hammer.classList.add('on');
        await api.sleep(250);
        await api.finger.tap(board.at(1, 1), 520);
        hammer.classList.remove('on');
        board.el.classList.add('m3t-shake');
        board.pop([[1, 1]]);
        await api.sleep(380);
        board.el.classList.remove('m3t-shake');
        board.fall({ 1: [0] });
        await api.sleep(700);
        await api.finger.tap(shuffle, 520);
        api.finger.hide();
        board.layer.classList.add('m3t-mix');
        await api.sleep(320);
        board.load([[4, 1, 5, 3], [2, 3, 0, 1], [5, 2, 4, 2]], true);
        board.layer.classList.remove('m3t-mix');
        await api.sleep(1400);
      }, 200);
    },
  },
];
