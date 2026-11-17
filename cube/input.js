// Gesten auf der Spielfläche: 1 Finger = drehen (bzw. Tipp), 2 Finger = zoomen/verschieben,
// Mausrad = zoomen. Pointer Events, damit es auf iPhone und Desktop gleich funktioniert.
//
// handlers: {
//   onDown(x, y), onTap(x, y),
//   onRotateStart(), onRotate(dx, dy, t), onRotateEnd(),
//   onPinchStart(), onPinch(factor, mx, my, dmx, dmy), onPinchEnd(),
//   onWheel(factor, x, y)
// }

const TAP_SLOP = 9;      // px Bewegung, ab der es kein Tipp mehr ist
const TAP_TIME = 550;    // ms

export function attachGestures(el, handlers) {
  const pts = new Map();
  let mode = 'none';
  let downX = 0, downY = 0, downT = 0, lastX = 0, lastY = 0;
  let pinchDist = 0, pinchMx = 0, pinchMy = 0;
  let rect = el.getBoundingClientRect();

  const rel = (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  const two = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (pts.size === 0) rect = el.getBoundingClientRect();
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = rel(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1) {
      mode = 'pending';
      downX = lastX = p.x; downY = lastY = p.y; downT = performance.now();
      handlers.onDown?.(p.x, p.y);
    } else if (pts.size === 2) {
      if (mode === 'rotate') handlers.onRotateEnd?.(false);
      mode = 'pinch';
      const t = two();
      pinchDist = t.d; pinchMx = t.mx; pinchMy = t.my;
      handlers.onPinchStart?.();
    }
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = rel(e);
    pts.set(e.pointerId, p);
    if (mode === 'pending') {
      if (Math.hypot(p.x - downX, p.y - downY) > TAP_SLOP) {
        mode = 'rotate';
        handlers.onRotateStart?.();
        // Bewegung seit dem Aufsetzen nicht verschlucken
        handlers.onRotate?.(p.x - lastX, p.y - lastY, performance.now());
        lastX = p.x; lastY = p.y;
      }
    } else if (mode === 'rotate') {
      handlers.onRotate?.(p.x - lastX, p.y - lastY, performance.now());
      lastX = p.x; lastY = p.y;
    } else if (mode === 'pinch' && pts.size >= 2) {
      const t = two();
      handlers.onPinch?.(t.d / pinchDist, t.mx, t.my, t.mx - pinchMx, t.my - pinchMy);
      pinchDist = t.d; pinchMx = t.mx; pinchMy = t.my;
    }
    e.preventDefault();
  };

  const onUp = (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = rel(e);
    pts.delete(e.pointerId);
    if (mode === 'pending') {
      mode = 'none';
      if (e.type === 'pointerup' && performance.now() - downT < TAP_TIME) handlers.onTap?.(p.x, p.y);
    } else if (mode === 'rotate') {
      mode = 'none';
      handlers.onRotateEnd?.(e.type === 'pointerup');
    } else if (mode === 'pinch') {
      if (pts.size < 2) {
        handlers.onPinchEnd?.();
        mode = pts.size === 1 ? 'after-pinch' : 'none';
      }
    } else if (pts.size === 0) {
      mode = 'none';
    }
    if (pts.size === 0 && mode === 'after-pinch') mode = 'none';
  };

  const onWheel = (e) => {
    e.preventDefault();
    rect = el.getBoundingClientRect();
    const p = rel(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    handlers.onWheel?.(Math.exp(-dy * 0.0016), p.x, p.y);
  };

  // Touch-Sequenzen auf der Spielfläche selbst behandeln (kein Scrollen/Zoomen des Browsers)
  const stopTouch = (e) => { if (e.cancelable) e.preventDefault(); };
  el.addEventListener('touchstart', stopTouch, { passive: false });
  el.addEventListener('touchmove', stopTouch, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  return {
    get active() { return pts.size > 0; },
    destroy() {
      el.removeEventListener('touchstart', stopTouch);
      el.removeEventListener('touchmove', stopTouch);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp);
      el.removeEventListener('wheel', onWheel);
    },
  };
}
