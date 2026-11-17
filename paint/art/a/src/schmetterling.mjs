// Schmetterling auf Blüte – a symmetric butterfly with patterned wings resting on a cosmos flower.
import { Pic, DEG, smooth, tf, poly, circle, rect, sampleSmooth, polarPt, petalPts, leafHalves, starPts } from './lib.mjs';
import { union, intersect, subtract, offset, smoothPoly, circlePoly, ellipsePoly, shapePath, dropCrumbs } from './geom.mjs';

export const meta = { id: 'a-schmetterling', title: 'Schmetterling auf Blüte', category: 'Tiere' };

const MX = (pts) => pts.map((p) => [1000 - p[0], p[1], ...p.slice(2)]); // mirror to the right half

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    bgA: '#f7f2fc',
    bgB: '#e9def7',
    gold: '#ffe09a',
    indigo: '#283b6b',
    teal: '#22908f',
    turq: '#46c6c0',
    aqua: '#aee8e1',
    orange: '#ff9f43',
    white: '#ffffff',
    plum: '#4b3a63',
    lilac: '#8b78a6',
    pinkL: '#f9b3cf',
    pinkD: '#e86c9f',
    yellow: '#ffd25e',
    green1: '#8ccb7e',
    green2: '#4f9a5f',
  });

  // --- background: soft rings around the butterfly + sparkles
  const BC = [500, 430];
  pic.add(rect(0, 0, 1000, 1000), 'bgA');
  for (const [r, col] of [[650, 'bgB'], [530, 'bgA'], [420, 'bgB'], [310, 'bgA']]) pic.add(circle(BC[0], BC[1], r), col);
  for (const [x, y, s] of [[90, 90, 30], [905, 110, 26], [70, 470, 22], [930, 520, 24], [150, 870, 26], [860, 900, 28], [500, 60, 20]]) {
    pic.add(smooth(starPts(x, y, s, s * 0.38, 4, -Math.PI / 2), { k: 0.4 }), 'gold');
  }

  // --- leaves and flower (behind the butterfly)
  for (const [x, y, a, len, w, bend] of [[470, 880, 200, 330, 150, 0.1], [530, 880, -20, 330, 150, -0.1], [500, 900, 250, 200, 110, 0.06], [500, 900, -70, 200, 110, -0.06]]) {
    const [A, B] = leafHalves(x, y, a * DEG, len, w, { bend, n: 4 });
    pic.add(A, 'green1');
    pic.add(B, 'green2');
  }
  const FC = [500, 812];
  for (let k = 0; k < 8; k++) {
    const a = (-90 + 22.5 + k * 45) * DEG;
    pic.add(smooth(tf(petalPts(205, 150, { tip: 'notch', wAt: 0.62, shoulder: 0.85 }), { x: FC[0], y: FC[1], r: a })), k % 2 ? 'pinkL' : 'pinkD');
  }
  pic.add(circle(FC[0], FC[1], 66), 'orange');
  pic.add(circle(FC[0], FC[1], 44), 'yellow');

  // --- wings (left side built, right side mirrored)
  const FW = [[494, 316, 'c'], [452, 250], [380, 176], [290, 114], [196, 82], [124, 88], [88, 134], [92, 206], [128, 286], [186, 354], [268, 406], [364, 434], [446, 434], [494, 400, 'c']];
  const HW = [[494, 404, 'c'], [430, 424], [330, 456], [226, 502], [166, 568], [160, 642], [204, 702], [282, 726], [362, 706], [424, 654], [466, 582], [494, 490, 'c']];
  for (const side of [0, 1]) {
    const S = side ? MX : (p) => p;
    const sx = (x) => (side ? 1000 - x : x);
    const sa = (a) => (side ? 180 - a : a); // mirror angles (deg)
    const fwPoly = smoothPoly(S(FW), 1, 12), hwPoly = smoothPoly(S(HW), 1, 12);
    // one dark border/vein shape per side (fore + hind wing merged)
    pic.add(shapePath(union(fwPoly, hwPoly)), 'indigo');
    const hind = wingParts(S(HW), [sx(494), 440], [sa(118), sa(136), sa(154)].sort((a, b) => a - b), 138, side, 'hind');
    for (const c of hind.cells) {
      const vis = dropCrumbs(subtract(c.loops, offset(fwPoly, 8)), 300);
      if (vis.length) pic.add(shapePath(vis), c.color);
    }
    for (const p of hind.spots) if (!insideish(fwPoly, p, 26)) pic.add(circle(p[0], p[1], 11), 'white');
    const e = side ? [1000 - 246, 628] : [246, 628];
    pic.add(circle(e[0], e[1], 40), 'orange');
    pic.add(circle(e[0], e[1], 22), 'indigo');
    const fore = wingParts(S(FW), [sx(492), 382], [sa(196), sa(210), sa(224), sa(238)].sort((a, b) => a - b), 172, side, 'fore');
    for (const c of fore.cells) pic.add(shapePath(c.loops), c.color);
    for (const p of fore.spots) pic.add(circle(p[0], p[1], 11), 'white');
  }

  // --- body
  const abd = ellipsePoly(500, 522, 22, 122, 48);
  pic.add(shapePath([abd]), 'plum');
  for (const [y0, y1] of [[470, 500], [530, 560], [590, 616]]) pic.add(shapePath(intersect(abd, [[460, y0], [540, y0], [540, y1], [460, y1]])), 'lilac');
  pic.add(shapePath([ellipsePoly(500, 366, 31, 54, 48)]), 'lilac');
  pic.add(circle(500, 300, 27), 'plum');
  // antennae (decorative lines with club tips)
  pic.line('M490 280C478 240 462 200 432 170', 5, '#4b3a63');
  pic.line('M510 280C522 240 538 200 568 170', 5, '#4b3a63');
  pic.add(circle(430, 167, 11), 'plum');
  pic.add(circle(570, 167, 11), 'plum');

  return pic;
}

/** Point roughly inside polygon (or within margin of it)? */
function insideish(pg, p, margin) {
  let wn = 0, d2 = Infinity;
  for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) {
    const [ax, ay] = pg[j], [bx, by] = pg[i];
    const ex = bx - ax, ey = by - ay, wx = p[0] - ax, wy = p[1] - ay;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
    d2 = Math.min(d2, (wx - ex * t) ** 2 + (wy - ey * t) ** 2);
    const cr = ex * wy - ey * wx;
    if (ay <= p[1]) { if (by > p[1] && cr > 0) wn++; } else if (by <= p[1] && cr < 0) wn--;
  }
  return wn !== 0 || Math.sqrt(d2) < margin;
}

/** Wing cells (two zones between veins) and spot centres along the outer edge. */
function wingParts(outline, root, veins, zoneR, side, kind) {
  const W = smoothPoly(outline, 1, 12);
  const inner = offset(W, -30);
  const lo = veins[0] - 70, hi = veins[veins.length - 1] + 70;
  const edges = [lo, ...veins, hi];
  const wedgePoly = (a1, a2) => {
    const pts = [root];
    for (let t = 0; t <= 8; t++) pts.push(polarPt(root[0], root[1], 900, (a1 + ((a2 - a1) * t) / 8) * DEG));
    return pts;
  };
  const zoneIn = circlePoly(root[0], root[1], zoneR - 6, 72);
  const zoneOut = circlePoly(root[0], root[1], zoneR + 6, 72);
  const n = edges.length - 1;
  const cells = [];
  for (let k = 0; k < n; k++) {
    const cell = dropCrumbs(offset(intersect(inner, wedgePoly(edges[k], edges[k + 1])), -6), 200);
    if (!cell.length) continue;
    const cIn = dropCrumbs(intersect(cell, zoneIn), 300);
    const cOut = dropCrumbs(subtract(cell, zoneOut), 300);
    if (cIn.length) cells.push({ loops: cIn, color: 'teal' });
    if (cOut.length) {
      const tipCell = kind === 'fore' && k === (side ? 1 : n - 2);
      cells.push({ loops: cOut, color: tipCell ? 'orange' : k % 2 ? 'aqua' : 'turq' });
    }
  }
  const edge = sampleSmooth(outline, { closed: true, steps: 16 });
  let last = null;
  const spots = [];
  for (const p of edge) {
    if (Math.abs(p[0] - root[0]) < (kind === 'fore' ? 230 : 160)) continue;
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 46) continue;
    last = p;
    const dx = root[0] - p[0], dy = root[1] - p[1], L = Math.hypot(dx, dy);
    spots.push([p[0] + (dx / L) * 16, p[1] + (dy / L) * 16]);
  }
  return { cells, spots };
}
