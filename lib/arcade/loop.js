// requestAnimationFrame-Schleife. dt ist in Millisekunden, gedeckelt,
// damit ein Hänger keinen Sprung erzeugt. Bei reduzierter Bewegung bleibt dt klein.

export function frameLoop(fn) {
  let id = 0;
  let last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now) => {
    const dt = last ? Math.min(reduced ? 16 : 32, now - last) : 16;
    last = now;
    fn(dt, now);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
