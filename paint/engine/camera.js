// Kamera-Mathematik (reine Logik): Einpassen, Grenzen, Gummiband, Zoom um einen Punkt, Interpolation.
// Kamera = { s, x, y }: Bildschirm(CSS-px) = Einheit * s + (x, y), relativ zur Bühne.

const C = 0.55;

/** Apple-artiges Gummiband: Überschuss o -> sichtbarer Überschuss (< D). */
export function rubber(o, D) {
  if (o <= 0) return 0;
  return (1 - 1 / ((o * C) / D + 1)) * D;
}

export function unrubber(y, D) {
  if (y <= 0) return 0;
  const q = Math.min(y / D, 0.995);
  return (D / C) * (q / (1 - q));
}

/** vp = { W, H, VW, VH, pad, minS, maxS } */
export function fitCamera(vp) {
  const s = Math.max(1e-6, Math.min((vp.VW - 2 * vp.pad) / vp.W, (vp.VH - 2 * vp.pad) / vp.H));
  return { s, x: (vp.VW - vp.W * s) / 2, y: (vp.VH - vp.H * s) / 2 };
}

export function axisRange(size, s, view, pad) {
  const pic = size * s;
  if (pic <= view - 2 * pad) {
    const c = (view - pic) / 2;
    return [c, c];
  }
  return [view - pad - pic, pad];
}

export function clampScale(s, vp) {
  return Math.min(vp.maxS, Math.max(vp.minS, s));
}

/** Harte Grenzen. */
export function clampCam(cam, vp) {
  const s = clampScale(cam.s, vp);
  // Skalierung um die Bühnenmitte korrigieren, falls nötig
  let { x, y } = cam;
  if (s !== cam.s) {
    const cx = vp.VW / 2, cy = vp.VH / 2;
    x = cx - ((cx - x) * s) / cam.s;
    y = cy - ((cy - y) * s) / cam.s;
  }
  const [xl, xh] = axisRange(vp.W, s, vp.VW, vp.pad);
  const [yl, yh] = axisRange(vp.H, s, vp.VH, vp.pad);
  return { s, x: Math.min(xh, Math.max(xl, x)), y: Math.min(yh, Math.max(yl, y)) };
}

export function softScale(sRaw, vp) {
  if (sRaw > vp.maxS) return vp.maxS * Math.exp(rubber(Math.log(sRaw / vp.maxS), 0.45));
  if (sRaw < vp.minS) return vp.minS * Math.exp(-rubber(Math.log(vp.minS / sRaw), 0.35));
  return sRaw;
}

export function unsoftScale(s, vp) {
  if (s > vp.maxS) return vp.maxS * Math.exp(unrubber(Math.log(s / vp.maxS), 0.45));
  if (s < vp.minS) return vp.minS * Math.exp(-unrubber(Math.log(vp.minS / s), 0.35));
  return s;
}

function softAxis(v, lo, hi, D) {
  if (v > hi) return hi + rubber(v - hi, D);
  if (v < lo) return lo - rubber(lo - v, D);
  return v;
}

function unsoftAxis(v, lo, hi, D) {
  if (v > hi) return hi + unrubber(v - hi, D);
  if (v < lo) return lo - unrubber(lo - v, D);
  return v;
}

/** Weiche Grenzen für eine Translation bei gegebener (bereits weicher) Skalierung. */
export function softTranslate(x, y, s, vp) {
  const [xl, xh] = axisRange(vp.W, s, vp.VW, vp.pad);
  const [yl, yh] = axisRange(vp.H, s, vp.VH, vp.pad);
  return { x: softAxis(x, xl, xh, vp.VW), y: softAxis(y, yl, yh, vp.VH) };
}

export function unsoftTranslate(x, y, s, vp) {
  const [xl, xh] = axisRange(vp.W, s, vp.VW, vp.pad);
  const [yl, yh] = axisRange(vp.H, s, vp.VH, vp.pad);
  return { x: unsoftAxis(x, xl, xh, vp.VW), y: unsoftAxis(y, yl, yh, vp.VH) };
}

/** Ist die Kamera ausserhalb der harten Grenzen? */
export function isOutOfBounds(cam, vp, eps = 0.5) {
  const c = clampCam(cam, vp);
  return Math.abs(c.s - cam.s) / cam.s > 1e-4 || Math.abs(c.x - cam.x) > eps || Math.abs(c.y - cam.y) > eps;
}

/** Zoomt so, dass der Bildschirmpunkt (sx, sy) fest bleibt. */
export function zoomAround(cam, sx, sy, s) {
  return { s, x: sx - ((sx - cam.x) * s) / cam.s, y: sy - ((sy - cam.y) * s) / cam.s };
}

export function toUnits(cam, sx, sy) {
  return [(sx - cam.x) / cam.s, (sy - cam.y) / cam.s];
}

export function toScreen(cam, ux, uy) {
  return [ux * cam.s + cam.x, uy * cam.s + cam.y];
}

/** Kamera, die den Einheitspunkt (ux, uy) mit Skalierung s in die Bühnenmitte setzt. */
export function centerOn(ux, uy, s, vp) {
  return { s, x: vp.VW / 2 - ux * s, y: vp.VH / 2 - uy * s };
}

/**
 * Interpolation zwischen zwei Kameras: Skalierung logarithmisch, Mittelpunkt so gewichtet,
 * dass die Bewegung dann passiert, wenn man weit herausgezoomt ist (wirkt ruhig).
 */
export function lerpCam(a, b, t, VW, VH) {
  const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t);
  const ua = [(VW / 2 - a.x) / a.s, (VH / 2 - a.y) / a.s];
  const ub = [(VW / 2 - b.x) / b.s, (VH / 2 - b.y) / b.s];
  let w = t;
  const den = 1 / a.s - 1 / b.s;
  if (Math.abs(den) > 1e-9 && Math.abs(a.s - b.s) / Math.max(a.s, b.s) > 0.02) w = (1 / a.s - 1 / s) / den;
  const ux = ua[0] + (ub[0] - ua[0]) * w;
  const uy = ua[1] + (ub[1] - ua[1]) * w;
  return { s, x: VW / 2 - ux * s, y: VH / 2 - uy * s };
}
