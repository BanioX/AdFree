// Wortsuche – Spielfeld: Buchstabenraster (DOM) + Kapseln (SVG), Wisch-/Tipp-Eingabe, Animationen.
// Kennt keine Spielregeln: meldet nur Auswahlen (start, end) an onSelect.

import { snapEnd, lineCells, wordCells, wordEnd } from './logic.js';

/** Farben der gefundenen Wörter (Kapseln und Wortliste), der Reihe nach. */
export const CAP_COLORS = [
  '#ff8fa3', '#ffb35c', '#f7d44a', '#9bd36a', '#5ccfc0', '#6db7ff',
  '#a991ff', '#f497d2', '#7fd39e', '#ff9b7a', '#c99cf0', '#7ccfe9',
];

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export class Board {
  /**
   * pz: Rätsel, opts: { onSelect(a, b), onStep(cells) }
   */
  constructor(pz, opts = {}) {
    this.pz = pz;
    this.n = pz.size;
    this.opts = opts;
    this.locked = false;
    this.cell = 30;
    this.found = new Map(); // index -> { line, color }
    this.drag = null;
    this.anchor = null;
    this.tween = null;

    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.style.setProperty('--n', this.n);
    this.inner = document.createElement('div');
    this.inner.className = 'board-inner';
    this.svg = svg('svg', { class: 'caps', viewBox: `0 0 ${this.n} ${this.n}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    this.gFound = svg('g', { class: 'g-found' });
    this.gHint = svg('g', { class: 'g-hint' });
    this.gSel = svg('g', { class: 'g-sel' });
    this.svg.append(this.gFound, this.gHint, this.gSel);
    this.letters = document.createElement('div');
    this.letters.className = 'letters';
    this.spans = [];
    for (let r = 0; r < this.n; r++) {
      const row = [...pz.grid[r]];
      for (let c = 0; c < this.n; c++) {
        const s = document.createElement('span');
        s.textContent = row[c];
        this.letters.append(s);
        this.spans.push(s);
      }
    }
    this.fx = document.createElement('div');
    this.fx.className = 'board-fx';
    this.inner.append(this.svg, this.letters, this.fx);
    this.el.append(this.inner);

    // Auswahl-Kapsel (zwei Linien: Rand + Füllung)
    this.selOuter = svg('line', { class: 'sel-outer' });
    this.selInner = svg('line', { class: 'sel-inner' });
    this.gSel.append(this.selOuter, this.selInner);
    this.gSel.style.display = 'none';

    this.el.addEventListener('pointerdown', (e) => this.onDown(e));
    this.el.addEventListener('pointermove', (e) => this.onMove(e));
    this.el.addEventListener('pointerup', (e) => this.onUp(e));
    this.el.addEventListener('pointercancel', () => this.cancelDrag());
    this.el.addEventListener('lostpointercapture', () => { if (this.drag) this.onUp(null); });
    // Wischgesten nicht an den globalen Doppeltipp-Schutz weiterreichen (touch-action: none genügt hier),
    // sonst würde ein schneller Tipp auf «Tipp» direkt nach einem Wisch verschluckt.
    this.el.addEventListener('touchend', (e) => e.stopPropagation());
  }

  // ---------- Layout ----------

  resize(sizePx) {
    const pad = Math.round(Math.max(6, Math.min(12, sizePx * 0.025)));
    this.size = sizePx;
    this.pad = pad;
    this.cell = (sizePx - 2 * pad) / this.n;
    this.el.style.width = sizePx + 'px';
    this.el.style.height = sizePx + 'px';
    this.el.style.setProperty('--pad', pad + 'px');
    this.el.style.setProperty('--cell', this.cell + 'px');
  }

  /** Bildschirmkoordinaten der Zellmitte (für Tests und Effekte). */
  cellCenterClient(r, c) {
    const rect = this.inner.getBoundingClientRect();
    const cs = rect.width / this.n;
    return { x: rect.left + (c + 0.5) * cs, y: rect.top + (r + 0.5) * cs };
  }

  // ---------- Eingabe ----------

  pos(e) {
    const rect = this.inner.getBoundingClientRect();
    const cs = rect.width / this.n;
    return { px: (e.clientX - rect.left) / cs, py: (e.clientY - rect.top) / cs };
  }

  onDown(e) {
    if (this.locked || this.drag) return;
    if (e.button != null && e.button > 0) return;
    const { px, py } = this.pos(e);
    if (px < -0.4 || py < -0.4 || px > this.n + 0.4 || py > this.n + 0.4) return;
    e.preventDefault();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const cell = {
      r: Math.max(0, Math.min(this.n - 1, Math.floor(py))),
      c: Math.max(0, Math.min(this.n - 1, Math.floor(px))),
    };
    this.drag = { id: e.pointerId, start: cell, end: cell, moved: false, x0: e.clientX, y0: e.clientY };
    this.showSel(cell, cell, true);
    this.highlight([cell]);
    if (this.opts.onStep) this.opts.onStep([cell]);
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > Math.max(6, this.cell * 0.3)) d.moved = true;
    const { px, py } = this.pos(e);
    const end = snapEnd(d.start, px, py, this.n);
    if (end.r !== d.end.r || end.c !== d.end.c) {
      d.end = end;
      if (this.anchor) this.clearAnchor();
      const cells = lineCells(d.start, end);
      this.highlight(cells);
      this.showSel(d.start, end, false);
      if (this.opts.onStep) this.opts.onStep(cells);
    }
  }

  onUp(e) {
    const d = this.drag;
    if (!d || (e && e.pointerId !== d.id)) return;
    this.drag = null;
    const same = d.start.r === d.end.r && d.start.c === d.end.c;
    if (!same) {
      this.finish(d.start, d.end);
      return;
    }
    // Tipp ohne Bewegung: Anfangs-/Endbuchstabe per Antippen
    const cell = d.start;
    if (this.anchor && !(this.anchor.r === cell.r && this.anchor.c === cell.c) && lineCells(this.anchor, cell)) {
      const a = this.anchor;
      this.clearAnchor();
      this.showSel(a, cell, true);
      this.highlight(lineCells(a, cell));
      this.finish(a, cell);
      return;
    }
    if (this.anchor && this.anchor.r === cell.r && this.anchor.c === cell.c) {
      this.clearAnchor();
      this.hideSel();
      if (this.opts.onStep) this.opts.onStep([]);
      return;
    }
    this.anchor = cell;
    this.showSel(cell, cell, true);
    this.gSel.classList.add('anchor');
    this.highlight([cell]);
    if (this.opts.onStep) this.opts.onStep([cell]);
  }

  finish(a, b) {
    if (this.opts.onStep) this.opts.onStep([]);
    const res = this.opts.onSelect ? this.opts.onSelect(a, b) : null;
    if (!res) this.reject(a, b);
    else this.hideSel();
  }

  cancelDrag() {
    this.drag = null;
    this.hideSel();
    this.highlight([]);
    if (this.opts.onStep) this.opts.onStep([]);
  }

  clearAnchor() {
    this.anchor = null;
    this.gSel.classList.remove('anchor');
  }

  // ---------- Auswahl-Kapsel ----------

  showSel(a, b, instant) {
    this.gSel.style.display = '';
    this.selTarget = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
    if (instant || !this.selCur) {
      this.selCur = { ...this.selTarget };
      this.drawSel();
      return;
    }
    // Startpunkt springt sofort, Endpunkt gleitet weich hinterher (Gummiband)
    this.selCur.r1 = a.r;
    this.selCur.c1 = a.c;
    if (!this.tween) {
      const step = () => {
        const t = this.selTarget, cur = this.selCur;
        if (!t) { this.tween = null; return; }
        cur.r2 += (t.r2 - cur.r2) * 0.5;
        cur.c2 += (t.c2 - cur.c2) * 0.5;
        if (Math.abs(t.r2 - cur.r2) < 0.01 && Math.abs(t.c2 - cur.c2) < 0.01) {
          cur.r2 = t.r2; cur.c2 = t.c2;
          this.drawSel();
          this.tween = null;
          return;
        }
        this.drawSel();
        this.tween = requestAnimationFrame(step);
      };
      this.tween = requestAnimationFrame(step);
    }
  }

  drawSel() {
    const s = this.selCur;
    for (const l of [this.selOuter, this.selInner]) {
      l.setAttribute('x1', s.c1 + 0.5);
      l.setAttribute('y1', s.r1 + 0.5);
      l.setAttribute('x2', s.c2 + 0.5);
      l.setAttribute('y2', s.r2 + 0.5);
    }
  }

  hideSel() {
    this.gSel.style.display = 'none';
    this.selTarget = null;
    this.selCur = null;
    if (this.tween) { cancelAnimationFrame(this.tween); this.tween = null; }
    if (!this.anchor) this.highlight([]);
  }

  highlight(cells) {
    if (this.hl) for (const s of this.hl) s.classList.remove('on');
    this.hl = cells.map(({ r, c }) => this.spans[r * this.n + c]);
    for (const s of this.hl) s.classList.add('on');
  }

  reject(a, b) {
    // Kapsel kurz rötlich aufleuchten lassen und ausblenden
    const g = svg('g', { class: 'g-reject' });
    const l = svg('line', { x1: a.c + 0.5, y1: a.r + 0.5, x2: b.c + 0.5, y2: b.r + 0.5 });
    g.append(l);
    this.svg.append(g);
    setTimeout(() => g.remove(), 420);
    this.hideSel();
    this.highlight([]);
    this.el.classList.remove('nudge');
    void this.el.offsetWidth;
    this.el.classList.add('nudge');
  }

  // ---------- Gefundene Wörter ----------

  /** Zeichnet eine Kapsel für ein gefundenes Wort. animate: Pop + Buchstabenwelle + Schwebetext. */
  addFound(index, colorIdx, animate = false) {
    const p = this.pz.words[index];
    const e = wordEnd(p);
    const color = CAP_COLORS[colorIdx % CAP_COLORS.length];
    const line = svg('line', {
      class: 'cap' + (animate ? ' cap-in' : ''),
      x1: p.c + 0.5, y1: p.r + 0.5, x2: e.c + 0.5, y2: e.r + 0.5,
      stroke: color,
    });
    this.gFound.append(line);
    this.found.set(index, { line, color });
    const cells = wordCells(p);
    for (const { r, c } of cells) this.spans[r * this.n + c].classList.add('got');
    if (animate) {
      cells.forEach(({ r, c }, i) => this.bump(this.spans[r * this.n + c], 'pop', i * 45));
      this.floatText('+ ' + p.label, (p.c + e.c) / 2 + 0.5, (p.r + e.r) / 2 + 0.5, color);
    }
  }

  /** Bereits gefundenes Wort kurz aufblinken lassen. */
  flashFound(index) {
    const f = this.found.get(index);
    if (!f) return;
    f.line.classList.remove('cap-flash');
    void f.line.getBoundingClientRect();
    f.line.classList.add('cap-flash');
  }

  bump(span, cls, delay = 0) {
    span.classList.remove(cls);
    span.style.animationDelay = delay + 'ms';
    void span.offsetWidth;
    span.classList.add(cls);
    const done = () => { span.classList.remove(cls); span.style.animationDelay = ''; };
    span.addEventListener('animationend', done, { once: true });
  }

  floatText(text, x, y, color) {
    const el = document.createElement('div');
    el.className = 'float-word';
    el.textContent = text;
    el.style.left = (x / this.n) * 100 + '%';
    el.style.top = (y / this.n) * 100 + '%';
    el.style.setProperty('--c', color);
    this.fx.append(el);
    setTimeout(() => el.remove(), 1300);
  }

  /** Tipp: die ersten `count` Buchstaben eines Wortes pulsieren lassen. */
  showHint(index, count = 1) {
    this.clearHint();
    const p = this.pz.words[index];
    const cells = wordCells(p).slice(0, count);
    cells.forEach(({ r, c }, i) => {
      const ring = svg('circle', { class: 'hint-ring', cx: c + 0.5, cy: r + 0.5, r: 0.44 });
      ring.style.animationDelay = i * 120 + 'ms';
      this.gHint.append(ring);
      this.bump(this.spans[r * this.n + c], 'hinted', i * 120);
    });
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.clearHint(), 3600);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    this.gHint.replaceChildren();
  }

  /** Coach-Mark beim ersten Spiel: pulsierender Ring am Wortanfang + wandernde Geisterkapsel. */
  coach(index) {
    this.clearCoach();
    const p = this.pz.words[index];
    if (!p) return;
    const e = wordEnd(p);
    const g = svg('g', { class: 'g-coach' });
    g.append(
      svg('line', { class: 'coach-ghost', x1: p.c + 0.5, y1: p.r + 0.5, x2: e.c + 0.5, y2: e.r + 0.5, pathLength: 1 }),
      svg('circle', { class: 'coach-ring', cx: p.c + 0.5, cy: p.r + 0.5, r: 0.47 }));
    this.svg.insertBefore(g, this.gSel);
    this.coachG = g;
  }

  clearCoach() {
    if (this.coachG) { this.coachG.remove(); this.coachG = null; }
  }

  /** Siegeswelle über alle Buchstaben. */
  winWave() {
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) this.bump(this.spans[r * this.n + c], 'wave', (r + c) * 38);
    }
    this.el.classList.add('won');
  }

  setLocked(v) {
    this.locked = !!v;
    if (v) this.cancelDrag();
  }
}
