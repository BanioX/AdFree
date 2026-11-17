// «So geht's» – kurzes Tutorial mit animierten Mini-Szenen (shared/tutorial.js).
//
// Jede Szene ist ein kleines DOM-Brett im aktuellen Aussehen. Koordinaten in «Einheiten»:
// die Szene ist 100 breit und 110 hoch (Seitenverhältnis fest), alles wird in % gesetzt.

import { h, icon } from '../../shared/ui.js';
import { showTutorial, maybeShowTutorial } from '../../shared/tutorial.js';
import { currentSkin } from './progress.js';
import { gemIconUrl } from './sprites.js';
import { GEM_BLOCK_COLOR } from '../core/board.js';

const ACCENT = '#f0a020';
const SW = 100, SH = 110;
const N = 5, CS = 14.5, BX = (SW - N * CS) / 2, BY = 3;

function at(el, x, y, w, hh) {
  el.style.left = (x / SW) * 100 + '%';
  el.style.top = (y / SH) * 100 + '%';
  if (w != null) el.style.width = (w / SW) * 100 + '%';
  if (hh != null) el.style.height = (hh / SH) * 100 + '%';
  return el;
}

function scene(stage) {
  const skin = currentSkin();
  const box = h('div.bt-scene.skin-' + skin.style);
  box.style.setProperty('--board-a', skin.board.bg[0]);
  box.style.setProperty('--board-b', skin.board.bg[1]);
  box.style.setProperty('--cell', skin.board.cell);
  stage.append(box);
  const board = at(h('div.bt-board'), BX - 2, BY - 2, N * CS + 4, N * CS + 4);
  box.append(board);
  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = at(h('div.bt-cell'), BX + c * CS, BY + r * CS, CS, CS);
      box.append(cell);
      cells.push(cell);
    }
  }
  const color = (i) => skin.colors[i];
  /** Stein (div) an Brett-Position oder freier Position. */
  const block = (ci, x, y, s = CS) => {
    const b = at(h('div.bt-block'), x, y, s, s);
    b.style.setProperty('--c', color(ci));
    return b;
  };
  const blocks = new Map();
  const set = (r, c, ci, gem) => {
    const k = r * N + c;
    if (blocks.has(k)) blocks.get(k).remove();
    const b = block(gem ? GEM_BLOCK_COLOR[gem] : ci, BX + c * CS, BY + r * CS);
    if (gem) b.append(h('img.bt-gem', { src: gemIconUrl(gem, 40), alt: '' }));
    box.append(b);
    blocks.set(k, b);
    return b;
  };
  const clearAll = () => { for (const b of blocks.values()) b.remove(); blocks.clear(); };
  /** Teil aus Zellen [[r,c]…], Ursprung (x,y), Zellgrösse s. */
  const piece = (cellsRC, ci, x, y, s) => {
    const wrap = h('div.bt-piece');
    const w = Math.max(...cellsRC.map((p) => p[1])) + 1;
    const hh = Math.max(...cellsRC.map((p) => p[0])) + 1;
    at(wrap, x, y, w * s, hh * s);
    for (const [r, c] of cellsRC) {
      const b = h('div.bt-block.in-piece');
      b.style.setProperty('--c', color(ci));
      b.style.left = (c / w) * 100 + '%';
      b.style.top = (r / hh) * 100 + '%';
      b.style.width = 100 / w + '%';
      b.style.height = 100 / hh + '%';
      wrap.append(b);
    }
    wrap.dims = { w, hh };
    box.append(wrap);
    return wrap;
  };
  const marker = (x, y) => { const m = at(h('div.bt-marker'), x, y, 1, 1); box.append(m); return m; };
  const text = (s, x, y) => { const t = at(h('div.bt-float'), x, y); t.textContent = s; box.append(t); return t; };
  return { box, cells, set, clearAll, piece, marker, text, blocks, skin };
}

const cellX = (c) => BX + c * CS;
const cellY = (r) => BY + r * CS;
const TRAY_Y = BY + N * CS + 9;
const TS = 8.5;

/** Zieht ein Teil (mit Finger) aus der Ablage auf die Brett-Position (r, c). */
async function dragPiece(api, sc, pc, r, c, ghostCells) {
  const { w, hh } = pc.dims;
  const lift = 15;
  const grabX = parseFloat(pc.style.left) / 100 * SW + (w * TS) / 2;
  const grabY = parseFloat(pc.style.top) / 100 * SH + (hh * TS) / 2;
  const from = sc.marker(grabX, grabY);
  const tx = cellX(c), ty = cellY(r);
  const to = sc.marker(tx + (w * CS) / 2, ty + hh * CS + lift - 4);
  await api.finger.moveTo(from, 500);
  pc.classList.add('lifted');
  // Teil wächst auf Brettgrösse und schwebt über dem Finger
  pc.style.transition = 'left .85s cubic-bezier(.45,.05,.3,1), top .85s cubic-bezier(.45,.05,.3,1), width .25s, height .25s';
  at(pc, grabX - (w * CS) / 2, grabY - hh * CS - lift + 4, w * CS, hh * CS);
  const drag = api.finger.drag([from, to], 850);
  drag.catch(() => {}); // Abbruch beim Schrittwechsel ist normal
  await api.sleep(650);
  at(pc, tx, ty - lift);
  await api.sleep(500);
  if (ghostCells) for (const [gr, gc] of ghostCells) sc.cells[gr * N + gc].classList.add('ghost');
  await drag;
  from.remove();
  to.remove();
}

function resetPiece(pc, x, y) {
  pc.style.transition = 'none';
  pc.classList.remove('lifted', 'gone');
  at(pc, x, y, pc.dims.w * TS, pc.dims.hh * TS);
}

function steps() {
  return [
    {
      title: 'Teile ziehen',
      text: 'Ziehe ein Teil aus der Ablage an einen freien Platz.',
      demo(stage, api) {
        const sc = scene(stage);
        const L = [[0, 0], [1, 0], [2, 0], [2, 1]];
        const pc = sc.piece(L, 6, 18, TRAY_Y, TS);
        const p2 = sc.piece([[0, 0], [0, 1]], 4, 46, TRAY_Y + 4, TS);
        const p3 = sc.piece([[0, 0], [1, 0], [1, 1]], 3, 70, TRAY_Y, TS);
        void p2; void p3;
        return api.loop(async () => {
          sc.clearAll();
          sc.cells.forEach((c) => c.classList.remove('ghost'));
          resetPiece(pc, 18, TRAY_Y);
          sc.set(4, 0, 1); sc.set(4, 4, 5); sc.set(3, 4, 5);
          await api.sleep(400);
          await dragPiece(api, sc, pc, 2, 1, L.map(([r, c]) => [r + 2, c + 1]));
          pc.classList.add('gone');
          sc.cells.forEach((c) => c.classList.remove('ghost'));
          for (const [r, c] of L) sc.set(r + 2, c + 1, 6).classList.add('drop');
          api.finger.hide();
          await api.sleep(1300);
        }, 300);
      },
    },
    {
      title: 'Reihen abräumen',
      text: 'Volle Zeilen und Spalten verschwinden – mehrere zugleich geben Bonus.',
      demo(stage, api) {
        const sc = scene(stage);
        const I = [[0, 0], [1, 0], [2, 0]];
        const pc = sc.piece(I, 2, 22, TRAY_Y - 2, TS);
        sc.piece([[0, 0], [0, 1], [1, 0], [1, 1]], 1, 44, TRAY_Y, TS);
        sc.piece([[0, 0]], 7, 72, TRAY_Y + 4, TS);
        return api.loop(async () => {
          sc.clearAll();
          resetPiece(pc, 22, TRAY_Y - 2);
          const rows = ['.....', '6...2', '00.13', '45.67', '12.30'];
          rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') sc.set(r, c, Number(ch)); }));
          await api.sleep(400);
          await dragPiece(api, sc, pc, 2, 2, I.map(([r]) => [r + 2, 2]));
          pc.classList.add('gone');
          sc.cells.forEach((c) => c.classList.remove('ghost'));
          for (let r = 2; r < 5; r++) sc.set(r, 2, 2).classList.add('drop');
          api.finger.hide();
          await api.sleep(180);
          for (let r = 2; r < 5; r++) for (let c = 0; c < N; c++) sc.blocks.get(r * N + c).classList.add('flash');
          const t = sc.text('Fantastisch!', 50, BY + 3.5 * CS);
          await api.sleep(420);
          for (let r = 2; r < 5; r++) for (let c = 0; c < N; c++) sc.blocks.get(r * N + c).classList.add('pop');
          await api.sleep(1300);
          t.remove();
        }, 300);
      },
    },
    {
      title: 'Platz lassen',
      text: 'Lass Platz für grosse Teile – die Glühbirne zeigt gratis einen guten Zug.',
      demo(stage, api) {
        const sc = scene(stage);
        const big = sc.piece([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], 5, 16, TRAY_Y - 1, 7.5);
        const sq = sc.piece([[0, 0], [0, 1], [1, 0], [1, 1]], 1, 46, TRAY_Y + 1, TS);
        const hint = at(h('div.bt-hintbtn', { html: icon('hint', { size: 20 }) }), 80, TRAY_Y);
        sc.box.append(hint);
        const rows = ['1.330', '1..6.', '22.65', '.44..', '7.1.0'];
        rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') sc.set(r, c, Number(ch)); }));
        return api.loop(async () => {
          big.classList.add('nofit');
          sc.cells.forEach((c) => c.classList.remove('ghost', 'hint'));
          await api.sleep(700);
          await api.finger.tap(hint);
          for (const [r, c] of [[0, 1], [0, 2], [1, 1], [1, 2]]) sc.cells[r * N + c].classList.add('hint');
          sq.classList.add('glow');
          await api.sleep(1600);
          sq.classList.remove('glow');
          api.finger.hide();
          await api.sleep(400);
        }, 400);
      },
    },
    {
      title: 'Abenteuer',
      text: 'Sammle Edelsteine, decke Bilder auf und hol dir drei Sterne.',
      demo(stage, api) {
        const sc = scene(stage);
        const chip = at(h('div.bt-goal'), 70, -1);
        const cnt = h('b', null, '2');
        chip.append(h('img', { src: gemIconUrl('r', 36), alt: '' }), cnt);
        sc.box.append(chip);
        const D = [[0, 0], [1, 0]];
        const pc = sc.piece(D, 4, 38, TRAY_Y, TS);
        sc.piece([[0, 0], [1, 0], [1, 1]], 3, 66, TRAY_Y, TS);
        return api.loop(async () => {
          sc.clearAll();
          resetPiece(pc, 38, TRAY_Y);
          cnt.textContent = '2';
          chip.classList.remove('done');
          const rows = ['.....', '.....', '.....', '3...2', '1r.r6'];
          rows.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === 'r') sc.set(r, c, 0, 'r');
            else if (ch !== '.') sc.set(r, c, Number(ch));
          }));
          await api.sleep(400);
          // senkrechter Zweier füllt die Lücke in der untersten Reihe
          await dragPiece(api, sc, pc, 3, 2, [[3, 2], [4, 2]]);
          pc.classList.add('gone');
          api.finger.hide();
          sc.cells.forEach((c) => c.classList.remove('ghost'));
          sc.set(3, 2, 4);
          sc.set(4, 2, 4);
          await api.sleep(160);
          const gems = [];
          for (let c = 0; c < N; c++) {
            const b = sc.blocks.get(4 * N + c);
            b.classList.add('flash');
            const g = b.querySelector('.bt-gem');
            if (g) gems.push(b);
          }
          await api.sleep(380);
          for (let c = 0; c < N; c++) sc.blocks.get(4 * N + c).classList.add('pop');
          for (const [k, b] of gems.entries()) {
            const fly = at(h('img.bt-fly', { src: gemIconUrl('r', 40), alt: '' }), parseFloat(b.style.left) / 100 * SW, parseFloat(b.style.top) / 100 * SH, CS, CS);
            sc.box.append(fly);
            await api.sleep(60);
            fly.style.transition = `left .6s cubic-bezier(.5,0,.3,1) ${k * 0.12}s, top .6s cubic-bezier(.5,-.4,.3,1) ${k * 0.12}s`;
            at(fly, 71, -1);
            setTimeout(() => { fly.remove(); cnt.textContent = String(Math.max(0, 1 - k)); if (k === gems.length - 1) { chip.classList.add('done'); cnt.innerHTML = icon('check', { size: 14 }); } }, 650 + k * 120);
          }
          await api.sleep(1900);
        }, 300);
      },
    },
  ];
}

export function showHelp() {
  return showTutorial({ id: 'blocks', steps: steps(), accent: ACCENT });
}

export function maybeShowHelp() {
  return maybeShowTutorial({ id: 'blocks', steps: steps(), accent: ACCENT });
}
