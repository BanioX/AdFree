// Zeiger für die Spielfläche.
// Safari bricht pointer-Gesten bei einem Neuzeichnen manchmal ab (pointercancel).
// Die letzte Position bleibt dann stehen, und ein späterer click zählt als Tippen.

export function bindStage(el, handlers) {
  let pid = null;
  let gotUp = true;
  let last = null;
  let downAt = 0;
  let downPos = null;
  let sx = 0;
  let sy = 0;

  const rel = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (p) => {
    gotUp = false;
    downAt = performance.now();
    downPos = p;
    last = p;
    sx = 0;
    sy = 0;
    handlers.down(p);
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.isPrimary === false) return;
    if (e.button != null && e.button !== 0) return;
    pid = e.pointerId;
    down(rel(e));
  });

  const move = (e) => {
    if (pid == null || e.pointerId !== pid) return;
    const p = rel(e);
    if (last) {
      sx += p.x - last.x;
      sy += p.y - last.y;
    }
    last = p;
    handlers.move(p);
  };
  el.addEventListener('pointermove', move);
  window.addEventListener('pointermove', move);

  const finish = (e, cancelled) => {
    if (pid == null || (e && e.pointerId != null && e.pointerId !== pid)) return;
    pid = null;
    const p = e && e.clientX != null ? rel(e) : last;
    if (cancelled) {
      gotUp = false;
      handlers.cancel(p || last);
      return;
    }
    gotUp = true;
    const tap = !!(p && downPos && performance.now() - downAt < 280 && Math.hypot(p.x - downPos.x, p.y - downPos.y) < 16);
    const flick = sy < -26 && Math.abs(sy) > Math.abs(sx);
    handlers.up(p || last, tap || flick);
  };
  const onUp = (e) => finish(e, false);
  const onCancel = (e) => finish(e, true);
  const onLost = () => { if (pid != null) finish(null, true); };
  el.addEventListener('pointerup', onUp);
  window.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  window.addEventListener('pointercancel', onCancel);
  el.addEventListener('lostpointercapture', onLost);

  // Touch läuft auf Safari oft weiter, wenn der Pointer abgebrochen wurde.
  const touchPoint = (e) => {
    const t = e.changedTouches[0] || e.touches[0];
    if (!t) return last;
    const r = el.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  el.addEventListener('touchmove', (e) => {
    if (pid != null) return;
    e.preventDefault();
    const p = touchPoint(e);
    if (!p) return;
    last = p;
    handlers.move(p);
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    if (pid != null) return;
    const p = touchPoint(e);
    if (!p || gotUp) return;
    gotUp = true;
    handlers.up(p, true);
  }, { passive: false });

  el.addEventListener('click', (e) => {
    if (performance.now() - downAt < 500 && gotUp) return;
    const p = rel(e);
    gotUp = true;
    handlers.down(p);
    handlers.up(p, true);
  });

  const keys = { x: 0, y: 0 };
  const setKey = (e, on) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.x = on ? -1 : (keys.x < 0 ? 0 : keys.x);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.x = on ? 1 : (keys.x > 0 ? 0 : keys.x);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.y = on ? -1 : (keys.y < 0 ? 0 : keys.y);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') keys.y = on ? 1 : (keys.y > 0 ? 0 : keys.y);
    else return false;
    if (on) e.preventDefault();
    handlers.keys(keys);
    return true;
  };
  const onKeyDown = (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      handlers.jump();
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') handlers.pause();
    setKey(e, true);
  };
  const onKeyUp = (e) => setKey(e, false);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

let prevButtons = [];

export function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const g of pads) if (g) pad = g;
  if (!pad) return null;
  const dead = 0.2;
  let x = pad.axes[0] || 0;
  let y = pad.axes[1] || 0;
  if (Math.abs(x) < dead) x = 0;
  if (Math.abs(y) < dead) y = 0;
  const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  if (b(14)) x = -1;
  if (b(15)) x = 1;
  if (b(12)) y = -1;
  if (b(13)) y = 1;
  const jump = b(0);
  const pause = b(9);
  const jumpEdge = jump && !prevButtons[0];
  const pauseEdge = pause && !prevButtons[9];
  prevButtons = pad.buttons.map((btn) => btn.pressed);
  return { x, y, jump, jumpEdge, pauseEdge, connected: true };
}
