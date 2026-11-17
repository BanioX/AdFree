// Schnelles Antippen für Knöpfe, die oft kurz hintereinander getippt werden (Farbfelder, Tipp).
//
// Hintergrund: Die Doppeltipp-Sperre in shared/ui.js verwirft «click», wenn er weniger als
// 320 ms nach dem letzten Tippen kommt. Beim Malen (Feld tippen, sofort Farbe wechseln) würde
// so jeder zweite Tipp verschluckt. onTap löst deshalb schon bei pointerup aus und nimmt
// «click» nur noch für Tastatur/Bedienungshilfen.

export function onTap(el, fn, { slop = 12 } = {}) {
  let id = null, x = 0, y = 0, fired = -1e9;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    id = e.pointerId; x = e.clientX; y = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) > slop || el.disabled) return;
    fired = performance.now();
    fn(e);
  });
  el.addEventListener('pointercancel', () => { id = null; });
  el.addEventListener('click', (e) => {
    if (performance.now() - fired < 700) return;
    fn(e);
  });
}
