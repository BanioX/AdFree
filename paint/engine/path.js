// SVG-Pfaddaten parsen (alle Befehle, absolut/relativ) und Begrenzungsrahmen berechnen.
// Reine Logik ohne DOM – läuft im Browser, im Worker und in node (Tests).
//
//   parsePath('M0 0Q50 100 100 0Z') -> [{t:'M',x,y}, {t:'C',x1,y1,x2,y2,x,y}, {t:'Z'}]
//   pathBBox(d) -> [x0, y0, x1, y1]  (Infinity-Werte, wenn nichts gezeichnet wird)

const isDigit = (c) => c >= 48 && c <= 57;

/**
 * Normalisiert einen Pfad in absolute M/L/C/Z-Segmente.
 * Bögen (A) und Quadratkurven (Q/T) werden in kubische Kurven umgewandelt.
 * Bei einem Syntaxfehler wird wie im Browser bis zur Fehlerstelle ausgewertet.
 */
export function parsePath(d) {
  const out = [];
  if (typeof d !== 'string') return out;
  const n = d.length;
  let i = 0;
  let cx = 0, cy = 0;       // aktueller Punkt
  let sx = 0, sy = 0;       // Start des Teilpfads
  let pcx = 0, pcy = 0;     // letzter kubischer Kontrollpunkt (für S)
  let pqx = 0, pqy = 0;     // letzter quadratischer Kontrollpunkt (für T)
  let prev = '';            // vorheriger Befehl (gross)
  let cmd = '';

  const skip = () => {
    while (i < n) {
      const c = d.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 44) i++;
      else break;
    }
  };
  const num = () => {
    skip();
    const start = i;
    let c = d.charCodeAt(i);
    if (c === 43 || c === 45) { i++; c = d.charCodeAt(i); }
    let digits = false;
    while (i < n && isDigit(d.charCodeAt(i))) { i++; digits = true; }
    if (d.charCodeAt(i) === 46) {
      i++;
      while (i < n && isDigit(d.charCodeAt(i))) { i++; digits = true; }
    }
    if (!digits) { i = start; return NaN; }
    c = d.charCodeAt(i);
    if (c === 101 || c === 69) {
      const save = i;
      i++;
      c = d.charCodeAt(i);
      if (c === 43 || c === 45) i++;
      let ed = false;
      while (i < n && isDigit(d.charCodeAt(i))) { i++; ed = true; }
      if (!ed) i = save;
    }
    return parseFloat(d.slice(start, i));
  };
  const flag = () => {
    skip();
    const c = d.charCodeAt(i);
    if (c === 48 || c === 49) { i++; return c === 49 ? 1 : 0; }
    return NaN;
  };
  const nums = (k) => {
    const a = new Array(k);
    for (let j = 0; j < k; j++) {
      a[j] = num();
      if (Number.isNaN(a[j])) return null;
    }
    return a;
  };

  const lineTo = (x, y) => { out.push({ t: 'L', x, y }); cx = x; cy = y; };
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    out.push({ t: 'C', x1, y1, x2, y2, x, y });
    pcx = x2; pcy = y2; cx = x; cy = y;
  };

  while (true) {
    skip();
    if (i >= n) break;
    const ch = d[i];
    if (/[MmZzLlHhVvCcSsQqTtAa]/.test(ch)) {
      cmd = ch;
      i++;
    } else if (!cmd || cmd === 'Z' || cmd === 'z') {
      break; // Zahl ohne Befehl -> Fehler
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    let ok = true;
    switch (C) {
      case 'M': {
        const a = nums(2);
        if (!a) { ok = false; break; }
        cx = a[0] + ox; cy = a[1] + oy; sx = cx; sy = cy;
        out.push({ t: 'M', x: cx, y: cy });
        cmd = rel ? 'l' : 'L'; // weitere Paare sind Linien
        break;
      }
      case 'Z':
        out.push({ t: 'Z' });
        cx = sx; cy = sy;
        break;
      case 'L': {
        const a = nums(2);
        if (!a) { ok = false; break; }
        lineTo(a[0] + ox, a[1] + oy);
        break;
      }
      case 'H': {
        const x = num();
        if (Number.isNaN(x)) { ok = false; break; }
        lineTo(x + ox, cy);
        break;
      }
      case 'V': {
        const y = num();
        if (Number.isNaN(y)) { ok = false; break; }
        lineTo(cx, y + oy);
        break;
      }
      case 'C': {
        const a = nums(6);
        if (!a) { ok = false; break; }
        cubicTo(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy);
        break;
      }
      case 'S': {
        const a = nums(4);
        if (!a) { ok = false; break; }
        let x1 = cx, y1 = cy;
        if (prev === 'C' || prev === 'S') { x1 = 2 * cx - pcx; y1 = 2 * cy - pcy; }
        cubicTo(x1, y1, a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy);
        break;
      }
      case 'Q': {
        const a = nums(4);
        if (!a) { ok = false; break; }
        const qx = a[0] + ox, qy = a[1] + oy, x = a[2] + ox, y = a[3] + oy;
        const x0 = cx, y0 = cy;
        cubicTo(x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0),
          x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y);
        pqx = qx; pqy = qy;
        break;
      }
      case 'T': {
        const a = nums(2);
        if (!a) { ok = false; break; }
        let qx = cx, qy = cy;
        if (prev === 'Q' || prev === 'T') { qx = 2 * cx - pqx; qy = 2 * cy - pqy; }
        const x = a[0] + ox, y = a[1] + oy;
        const x0 = cx, y0 = cy;
        cubicTo(x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0),
          x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y);
        pqx = qx; pqy = qy;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num();
        const fa = flag(), fs = flag();
        const x = num(), y = num();
        if ([rx, ry, rot, fa, fs, x, y].some(Number.isNaN)) { ok = false; break; }
        const ex = x + ox, ey = y + oy;
        const curves = arcToCubics(cx, cy, rx, ry, rot, fa, fs, ex, ey);
        if (!curves) lineTo(ex, ey);
        else for (const c of curves) cubicTo(c[0], c[1], c[2], c[3], c[4], c[5]);
        break;
      }
      default:
        ok = false;
    }
    if (!ok) break;
    prev = C;
    if (C !== 'Q' && C !== 'T') { pqx = cx; pqy = cy; }
    if (C !== 'C' && C !== 'S') { pcx = cx; pcy = cy; }
  }
  return out;
}

/**
 * Wandelt einen elliptischen Bogen (SVG-Endpunkt-Parametrisierung) in kubische Kurven um.
 * Rückgabe: Array von [x1,y1,x2,y2,x,y] oder null (dann gerade Linie).
 */
export function arcToCubics(x1, y1, rx, ry, angleDeg, fa, fs, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return null;
  const phi = (angleDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  // Radien korrigieren
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const rx2 = rx * rx, ry2 = ry * ry;
  let num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  if (num < 0) num = 0;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = den === 0 ? 0 : Math.sqrt(num / den);
  if (fa === fs) coef = -coef;
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  else if (fs && dth < 0) dth += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9));
  const delta = dth / segs;
  const t = (4 / 3) * Math.tan(delta / 4);
  const res = [];
  let a1 = th1;
  for (let k = 0; k < segs; k++) {
    const a2 = a1 + delta;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    // Punkte auf dem Einheitskreis, dann skalieren/drehen/verschieben
    const p = [
      [c1 - t * s1, s1 + t * c1],
      [c2 + t * s2, s2 - t * c2],
      [c2, s2],
    ].map(([ux, uy]) => {
      const X = ux * rx, Y = uy * ry;
      return [cosP * X - sinP * Y + cx, sinP * X + cosP * Y + cy];
    });
    res.push([p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]]);
    a1 = a2;
  }
  // Endpunkt exakt setzen
  if (res.length) { res[res.length - 1][4] = x2; res[res.length - 1][5] = y2; }
  return res;
}

function cubicExtrema(p0, p1, p2, p3, out) {
  // Ableitung: a t^2 + b t + c
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);
  const push = (t) => {
    if (t > 0 && t < 1) {
      const mt = 1 - t;
      out.push(mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3);
    }
  };
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) push(-c / b);
    return;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return;
  const sq = Math.sqrt(disc);
  push((-b + sq) / (2 * a));
  push((-b - sq) / (2 * a));
}

/** Begrenzungsrahmen [x0,y0,x1,y1] der gezeichneten Segmente. */
export function segmentsBBox(segs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const inc = (x, y) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  let px = 0, py = 0, sx = 0, sy = 0;
  const tmp = [];
  for (const s of segs) {
    if (s.t === 'M') { px = s.x; py = s.y; sx = px; sy = py; continue; }
    if (s.t === 'Z') { inc(px, py); px = sx; py = sy; continue; }
    inc(px, py);
    inc(s.x, s.y);
    if (s.t === 'C') {
      tmp.length = 0;
      cubicExtrema(px, s.x1, s.x2, s.x, tmp);
      for (const v of tmp) { if (v < x0) x0 = v; if (v > x1) x1 = v; }
      tmp.length = 0;
      cubicExtrema(py, s.y1, s.y2, s.y, tmp);
      for (const v of tmp) { if (v < y0) y0 = v; if (v > y1) y1 = v; }
    }
    px = s.x; py = s.y;
  }
  return [x0, y0, x1, y1];
}

export function pathBBox(d) {
  return segmentsBBox(parsePath(d));
}

/**
 * Wandelt Segmente in Polygone (Liste von [x,y,x,y,...]) um – für Tests/Geometrie.
 * tol: maximale Sehnenlänge-Abweichung grob über Unterteilungsanzahl.
 */
export function flattenPath(d, steps = 12) {
  const polys = [];
  let cur = null;
  let px = 0, py = 0;
  for (const s of parsePath(d)) {
    if (s.t === 'M') { cur = [s.x, s.y]; polys.push(cur); px = s.x; py = s.y; continue; }
    if (s.t === 'Z') { if (cur) { px = cur[0]; py = cur[1]; } cur = null; continue; }
    if (!cur) { cur = [px, py]; polys.push(cur); }
    if (s.t === 'L') cur.push(s.x, s.y);
    else if (s.t === 'C') {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, mt = 1 - t;
        const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, e = t * t * t;
        cur.push(a * px + b * s.x1 + c * s.x2 + e * s.x, a * py + b * s.y1 + c * s.y2 + e * s.y);
      }
    }
    px = s.x; py = s.y;
  }
  return polys;
}

/** Fläche nach Gerade/Ungerade- bzw. Vorzeichen-Regel ist komplex; hier: Summe der Betragsflächen. */
export function polygonArea(poly) {
  let a = 0;
  for (let k = 0, m = poly.length; k < m; k += 2) {
    const x0 = poly[k], y0 = poly[k + 1];
    const x1 = poly[(k + 2) % m], y1 = poly[(k + 3) % m];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}
