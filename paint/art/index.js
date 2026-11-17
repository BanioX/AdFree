// Bild-Bibliothek von Farbenzauber: fasst die Bilder von Team A (./a/) und Team B (./b/) zusammen.
// Fehlt ein Teil (noch nicht fertig, Fehler), wird er einfach übersprungen.
//
//   export const pictures = [{ id, title, category, load: () => Promise<Puzzle> }, …]

const parts = await Promise.allSettled([import('./a/index.js'), import('./b/index.js')]);

const seen = new Set();
export const pictures = [];

for (const r of parts) {
  if (r.status !== 'fulfilled' || !r.value) continue;
  const list = r.value.pictures || r.value.default;
  if (!Array.isArray(list)) continue;
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || typeof p.load !== 'function' || seen.has(p.id)) continue;
    if (!/^[a-z0-9-]+$/.test(p.id)) continue;
    seen.add(p.id);
    pictures.push({
      id: p.id,
      title: typeof p.title === 'string' ? p.title : p.id,
      category: typeof p.category === 'string' ? p.category : 'Weitere',
      load: p.load,
    });
  }
}

export default pictures;
