// Kleine Raster-Werkzeuge zum Zeichnen der Perlenbild-Muster (nur für die Build-Skripte).
// Ein Raster ist ein Gitter aus Zeichen; '.' = leer. Koordinaten: x nach rechts, y nach unten.
// Geometrie (Kreise, Polygone) wird an den Zellmittelpunkten (x + .5, y + .5) getestet.

export class Grid {
  constructor(w, h, fill = '.') {
    this.w = w;
    this.h = h;
    this.a = Array.from({ length: h }, () => Array(w).fill(fill));
  }

  static parse(rows) {
    const g = new Grid(rows[0].length, rows.length);
    rows.forEach((r, y) => {
      if (r.length !== g.w) throw new Error(`Zeile ${y} hat Länge ${r.length} statt ${g.w}: "${r}"`);
      for (let x = 0; x < g.w; x++) g.a[y][x] = r[x];
    });
    return g;
  }

  clone() {
    const g = new Grid(this.w, this.h);
    g.a = this.a.map((r) => r.slice());
    return g;
  }

  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.a[y][x] : undefined; }

  /** opt.on: nur auf diese Zeichen malen; opt.not: diese Zeichen nicht übermalen */
  ok(x, y, opt) {
    if (!this.in(x, y)) return false;
    const cur = this.a[y][x];
    if (opt?.on != null && !opt.on.includes(cur)) return false;
    if (opt?.not != null && opt.not.includes(cur)) return false;
    return true;
  }

  set(x, y, c, opt) {
    if (c != null && this.ok(x, y, opt)) this.a[y][x] = c;
    return this;
  }

  /** Malt jede Zelle, deren Mittelpunkt test(px, py) erfüllt. c darf eine Funktion (x, y, cur) sein. */
  paint(test, c, opt) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!test(x + 0.5, y + 0.5, x, y)) continue;
        const v = typeof c === 'function' ? c(x, y, this.a[y][x]) : c;
        this.set(x, y, v, opt);
      }
    }
    return this;
  }

  rect(x, y, w, h, c, opt) {
    return this.paint((px, py) => px > x && px < x + w && py > y && py < y + h, c, opt);
  }

  ellipse(cx, cy, rx, ry, c, opt) {
    return this.paint((px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1.0001, c, opt);
  }

  circle(cx, cy, r, c, opt) { return this.ellipse(cx, cy, r, r, c, opt); }

  poly(pts, c, opt) {
    return this.paint((px, py) => pointInPoly(px, py, pts), c, opt);
  }

  /** Bresenham-Linie zwischen Zellen (ganzzahlig). */
  line(x0, y0, x1, y1, c, opt) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, opt);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** Setzt ein ASCII-Teilbild an (x, y). Zeichen in skip (Standard '.') bleiben durchsichtig. */
  stamp(x0, y0, rows, opt = {}) {
    const skip = opt.skip ?? '.';
    rows.forEach((r, dy) => {
      for (let dx = 0; dx < r.length; dx++) {
        const ch = r[dx];
        if (skip.includes(ch)) continue;
        this.set(x0 + dx, y0 + dy, opt.map?.[ch] ?? ch, opt);
      }
    });
    return this;
  }

  /** Legt ein anderes Raster darüber ('.' ist durchsichtig). */
  over(other, dx = 0, dy = 0, opt) {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const v = other.a[y][x];
        if (v !== '.') this.set(x + dx, y + dy, v, opt);
      }
    }
    return this;
  }

  /** Neues leeres Raster gleicher Grösse (für Ebenen). */
  layer() { return new Grid(this.w, this.h); }

  replace(from, to, opt) {
    return this.paint((_, __, x, y) => from.includes(this.a[y][x]), to, opt);
  }

  /**
   * Umriss aussen: Zellen aus `on` (Standard '.'), die (4er-Nachbarschaft, optional 8er)
   * an eine Zelle aus `of` grenzen, werden zu c.
   */
  outline(c, { of, on = '.', diag = false } = {}) {
    const inside = (x, y) => {
      const v = this.get(x, y);
      return v !== undefined && (of ? of.includes(v) : v !== '.');
    };
    const hits = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!on.includes(this.a[y][x]) || inside(x, y)) continue;
        let n = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
        if (!n && diag) n = inside(x - 1, y - 1) || inside(x + 1, y - 1) || inside(x - 1, y + 1) || inside(x + 1, y + 1);
        if (n) hits.push([x, y]);
      }
    }
    for (const [x, y] of hits) this.a[y][x] = c;
    return this;
  }

  /** Umriss innen: Zellen aus `of`, die an etwas ausserhalb von `of` (oder den Rand) grenzen, werden zu c. */
  innerOutline(c, { of, diag = false, edge = true } = {}) {
    const inside = (x, y) => {
      const v = this.get(x, y);
      if (v === undefined) return edge;
      return of.includes(v);
    };
    const hits = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!of.includes(this.a[y][x])) continue;
        let out = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        if (!out && diag) out = !inside(x - 1, y - 1) || !inside(x + 1, y - 1) || !inside(x - 1, y + 1) || !inside(x + 1, y + 1);
        if (out) hits.push([x, y]);
      }
    }
    for (const [x, y] of hits) this.a[y][x] = c;
    return this;
  }

  /**
   * Rand-Schattierung: Zellen mit Zeichen `ch`, deren Nachbar Richtung Licht (dx,dy) nicht zur
   * Region gehört, werden `hi`; Zellen, deren Nachbar in Gegenrichtung nicht zur Region gehört, `lo`.
   */
  rimShade(ch, { hi, lo, region, lx = -1, ly = -1, hiDepth = 1, loDepth = 1 } = {}) {
    region = region ?? ch;
    const inR = (x, y) => { const v = this.get(x, y); return v !== undefined && region.includes(v); };
    const res = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.a[y][x] !== ch) continue;
        let v = null;
        if (lo) {
          for (let d = 1; d <= loDepth && !v; d++) {
            if ((lx && !inR(x - lx * d, y)) || (ly && !inR(x, y - ly * d))) v = lo;
          }
        }
        if (hi) {
          for (let d = 1; d <= hiDepth && !v; d++) {
            if ((lx && !inR(x + lx * d, y)) || (ly && !inR(x, y + ly * d))) v = hi;
          }
        }
        if (v) res.push([x, y, v]);
      }
    }
    for (const [x, y, v] of res) this.a[y][x] = v;
    return this;
  }

  /** Spiegelt die linke Hälfte nach rechts (oder umgekehrt mit fromRight). */
  mirrorX({ fromRight = false, map } = {}) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < Math.floor(this.w / 2); x++) {
        const xs = fromRight ? this.w - 1 - x : x;
        const xd = fromRight ? x : this.w - 1 - x;
        const v = this.a[y][xs];
        this.a[y][xd] = map?.[v] ?? v;
      }
    }
    return this;
  }

  /** Füllt die zusammenhängende Fläche (4er) ab (x, y) mit c. */
  flood(x, y, c) {
    const from = this.get(x, y);
    if (from === undefined || from === c) return this;
    const st = [[x, y]];
    while (st.length) {
      const [px, py] = st.pop();
      if (this.get(px, py) !== from) continue;
      this.a[py][px] = c;
      st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    return this;
  }

  count(ch) {
    let n = 0;
    for (const r of this.a) for (const v of r) if (v === ch) n++;
    return n;
  }

  rows() { return this.a.map((r) => r.join('')); }
  toString() { return this.rows().join('\n'); }
}

export function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Halbe Zeilen spiegeln: sym(['ab', ...], odd) -> volle Zeilen. Bei odd ist das letzte Zeichen die Mitte. */
export function sym(halfRows, odd = false, map = {}) {
  return halfRows.map((r) => {
    const left = r;
    const mid = odd ? left.slice(0, -1) : left;
    const right = [...mid].reverse().map((c) => map[c] ?? c).join('');
    return left + right;
  });
}

export function rows(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Zeichnet ein Objekt als eigene Ebene: draw(layer) füllt die Form, danach bekommt sie einen
 * Umriss in `outline` (aussen, 4er-Nachbarschaft) und wird über g gelegt.
 */
export function obj(g, draw, outline = 'k', opt = {}) {
  const l = g.layer();
  draw(l);
  if (outline) l.outline(outline, { diag: !!opt.diag });
  g.over(l, 0, 0, opt.paint);
  return l;
}
