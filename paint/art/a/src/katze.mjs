// Katze am Fenster – a tabby cat on the windowsill, evening town outside, curtains and potted plants.
import { intersect, subtract, union, smoothPoly, ellipsePoly, shapePath } from './geom.mjs';
import { Pic, DEG, poly, smooth, tf, circle, ellipse, polarPt, lerp, sampleSmooth, rect, rrect, mirrorX, leafHalves, crescentPts } from './lib.mjs';

export const meta = { id: 'a-katze', title: 'Katze am Fenster', category: 'Tiere' };

const arcWindow = (x0, x1, yb, inset = 0) => {
  const cx = (x0 + x1) / 2, r = (x1 - x0) / 2 - inset, ys = 400;
  const pts = [[x0 + inset, yb - inset]];
  for (let k = 0; k <= 32; k++) pts.push(polarPt(cx, ys, r, Math.PI + (k / 32) * Math.PI));
  pts.push([x1 - inset, yb - inset]);
  return pts;
};

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    wall1: '#f4e8d8',
    wall2: '#e7d3bd',
    frame: '#fdf9f2',
    sky1: '#3d4c8c',
    sky2: '#6c6fb5',
    sky3: '#eaa8b6',
    moon: '#fbefb6',
    roof: '#2e3864',
    cur1: '#98c0b0',
    cur2: '#6f9f8f',
    cur3: '#4f7f72',
    wood: '#b9845b',
    pot: '#dc7a50',
    cat1: '#f8f2ea',
    cat2: '#aca8b8',
    cat3: '#6d6982',
    pink: '#f2a1a8',
    green: '#86c06d',
  });
  const add = (loops, col) => loops.length && pic.add(shapePath(loops), col);

  // --- striped wallpaper and wainscot
  pic.add('M0 0H1000V1000H0Z', 'wall1');
  for (let x = 50; x < 1000; x += 100) pic.add(rect(x, 0, 50, 772), 'wall2');
  pic.add(rect(0, 772, 1000, 228), 'wall2');
  for (let i = 0; i < 4; i++) pic.add(rrect(30 + i * 245, 820, 205, 150, 16), 'wall1');

  // --- the view outside, clipped to the glass
  const glass = arcWindow(230, 770, 724, 24);
  pic.add(poly(glass), 'sky1');
  add(intersect(glass, [[0, 330], [1000, 300], [1000, 1000], [0, 1000]]), 'sky2');
  add(intersect(glass, [[0, 500], [1000, 470], [1000, 1000], [0, 1000]]), 'sky3');
  add(intersect(glass, crescentPts(640, 240, 58, -26, -16, 52)), 'moon');
  for (const [x, y, r] of [[330, 250, 22], [420, 340, 18], [700, 400, 18], [300, 400, 18], [450, 210, 20]]) {
    pic.add(poly([[x, y - r], [x + r * 0.3, y - r * 0.3], [x + r, y], [x + r * 0.3, y + r * 0.3], [x, y + r], [x - r * 0.3, y + r * 0.3], [x - r, y], [x - r * 0.3, y - r * 0.3]]), 'moon');
  }
  // rooftops with lit windows
  const roofs = [[200, 600], [290, 560, 'c'], [330, 600, 'c'], [330, 540], [380, 500, 'c'], [430, 540, 'c'], [430, 580], [520, 580, 'c'], [560, 530, 'c'], [600, 580, 'c'], [640, 580], [640, 520], [700, 470, 'c'], [760, 520, 'c'], [800, 520], [800, 800], [200, 800]];
  add(intersect(glass, roofs), 'roof');
  for (const [x, y] of [[270, 600], [370, 560], [400, 610], [550, 610], [690, 540], [710, 600]]) pic.add(rect(x, y, 24, 26), 'moon');

  // --- window frame with mullions (one shape with four panes cut out)
  const outer = arcWindow(230, 770, 730, 0);
  const panes = [
    intersect(glass, [[0, 0], [488, 0], [488, 440], [0, 440]]),
    intersect(glass, [[512, 0], [1000, 0], [1000, 440], [512, 440]]),
    intersect(glass, [[0, 464], [488, 464], [488, 1000], [0, 1000]]),
    intersect(glass, [[512, 464], [1000, 464], [1000, 1000], [512, 1000]]),
  ];
  pic.add(shapePath(subtract(outer, ...panes)), 'frame', { evenodd: true });

  // --- curtains with folds and tie-backs, rod
  const drape = (side) => {
    const xIn = (y) => (y < 560 ? lerp(330, 262, Math.pow(y / 560, 1.6)) : lerp(262, 300, (y - 560) / 340));
    const xOut = (y) => (y < 560 ? lerp(130, 170, y / 560) : lerp(170, 110, (y - 560) / 340));
    const cols = ['cur1', 'cur2', 'cur1', 'cur3'];
    for (let f = 0; f < 4; f++) {
      const L = [], R = [];
      for (let k = 0; k <= 24; k++) {
        const y = 80 + (k / 24) * 820;
        const a = xOut(y), b = xIn(y);
        L.push([lerp(a, b, f / 4) + Math.sin(y / 60 + f) * 4, y]);
        R.push([lerp(a, b, (f + 1) / 4) + Math.sin(y / 60 + f + 1) * 4, y]);
      }
      let pts = [...L, ...R.reverse()];
      if (side < 0) pts = mirrorX(pts, 500);
      pic.add(poly(pts), cols[f]);
    }
    const tie = side > 0 ? [216, 560] : [784, 560];
    pic.add(ellipse(tie[0], tie[1], 46, 21, side * -8 * DEG), 'pink');
  };
  drape(1);
  drape(-1);
  pic.add(rrect(90, 60, 820, 24, 12), 'wood');
  pic.add(circle(92, 72, 22), 'wood');
  pic.add(circle(908, 72, 22), 'wood');

  // --- windowsill
  pic.add(rect(200, 718, 600, 30), 'wood');
  pic.add(rrect(170, 744, 660, 28, 10), 'frame');

  // --- plants: trailing ivy (left) and geranium (right)
  pic.add(poly([[250, 650], [350, 650], [338, 722], [262, 722]]), 'pot');
  pic.add(rrect(242, 640, 116, 22, 8), 'wood');
  for (const [x, y, a, s, c] of [[280, 640, -150, 60, 'green'], [320, 636, -40, 64, 'cur3'], [300, 620, -95, 66, 'green'], [252, 690, 160, 56, 'cur3'], [230, 760, 110, 52, 'green'], [244, 830, 80, 50, 'cur3'], [350, 690, 20, 54, 'green']]) {
    const [A, B] = leafHalves(x, y, a * DEG, s, s * 0.62, { n: 3 });
    pic.add(A, c);
    pic.add(B, c === 'green' ? 'cur3' : 'green');
  }
  pic.add(poly([[650, 660], [750, 660], [738, 722], [662, 722]]), 'pot');
  pic.add(rrect(642, 650, 116, 22, 8), 'wood');
  for (const [x, y, a] of [[660, 640, -150], [740, 640, -30], [700, 610, -90]]) {
    const [A, B] = leafHalves(x, y, a * DEG, 70, 44, { n: 3 });
    pic.add(A, 'green');
    pic.add(B, 'cur3');
  }
  for (const [x, y, r] of [[672, 580, 30], [730, 565, 28], [700, 530, 26]]) {
    const pts = [];
    for (let k = 0; k < 10; k++) pts.push(polarPt(x, y, r * (k % 2 ? 0.78 : 1), (k / 10) * Math.PI * 2));
    pic.add(smooth(pts), 'pink');
    pic.add(circle(x, y, 10.5), 'moon');
  }

  // --- the cat
  const tail = sampleSmooth([[580, 712], [650, 728], [640, 752], [520, 752], [420, 744]], { steps: 10 });
  {
    const L = [], R = [];
    tail.forEach((p, i) => {
      const a = tail[Math.max(0, i - 1)], b = tail[Math.min(tail.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, w = 15 - 4 * (i / tail.length);
      L.push([p[0] - (dy / m) * w, p[1] + (dx / m) * w]);
      R.push([p[0] + (dy / m) * w, p[1] - (dx / m) * w]);
    });
    const tp = [...L, ...R.reverse()];
    pic.add(poly(tp), 'cat2');
    add(intersect(tp, [[400, 700], [470, 700], [470, 800], [400, 800]]), 'cat3');
    add(intersect(tp, [[540, 700], [575, 700], [575, 800], [540, 800]]), 'cat3');
  }
  const body = smoothPoly([[430, 722], [410, 650], [422, 570], [458, 520], [542, 520], [578, 570], [590, 650], [570, 722]], 1, 12);
  pic.add(poly(body), 'cat2');
  for (const s of [-1, 1]) {
    for (const y of [585, 640]) {
      const band = [[500 + s * 50, y - 12], [500 + s * 120, y - 22], [500 + s * 120, y + 2], [500 + s * 50, y + 6]];
      add(intersect(body, s > 0 ? band : band.reverse()), 'cat3');
    }
  }
  pic.add(smooth([[466, 536], [534, 536], [550, 600], [536, 664], [500, 700], [464, 664], [450, 600]]), 'cat1');
  pic.add(ellipse(470, 714, 28, 16), 'cat1');
  pic.add(ellipse(530, 714, 28, 16), 'cat1');
  // head and ears
  for (const s of [-1, 1]) {
    const ear = [[500 + s * 76, 446, 'c'], [500 + s * 66, 362, 'c'], [500 + s * 18, 414, 'c']];
    const inner = [[500 + s * 64, 430, 'c'], [500 + s * 60, 384, 'c'], [500 + s * 32, 416, 'c']];
    pic.add(poly(ear), 'cat2');
    pic.add(poly(inner), 'pink');
  }
  const head = smoothPoly([[408, 474], [426, 424], [468, 398], [532, 398], [574, 424], [592, 474], [574, 516], [532, 536], [468, 536], [426, 516]], 1, 10);
  pic.add(poly(head), 'cat2');
  for (const dx of [-26, 0, 26]) add(intersect(head, smoothPoly([[500 + dx - 8, 392], [500 + dx + 8, 392], [500 + dx + 5, 432, 'c'], [500 + dx - 5, 432, 'c']])), 'cat3');
  for (const s of [-1, 1]) add(intersect(head, [[500 + s * 60, 470], [500 + s * 100, 456], [500 + s * 100, 476], [500 + s * 62, 486]].map((p) => p)), 'cat3');
  pic.add(shapePath(union(ellipsePoly(484, 500, 26, 19, 32), ellipsePoly(516, 500, 26, 19, 32))), 'cat1');
  for (const s of [-1, 1]) {
    pic.add(ellipse(500 + s * 32, 458, 21, 15, s * 8 * DEG), 'green');
    pic.add(ellipse(500 + s * 32, 458, 8.5, 14), 'roof');
  }
  pic.add(smooth([[485, 484, 'c'], [515, 484, 'c'], [500, 504, 'c']], { k: 0.6 }), 'pink');

  return pic;
}
