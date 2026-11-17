// Baut alle Bilder von Team B: node paint/art/b/src/build.mjs [name …]
// Schreibt ../<name>.js (Puzzle-Module) und ../index.js (Bildliste).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { regionStats, closeRaster } from '../tools/raster.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..');

// Reihenfolge = von einfach nach reich.
export const ORDER = [
  'cupcake',
  'adventskranz',
  'cafe',
  'ballone',
  'leuchtturm',
  'lebkuchenhaus',
  'unterwasser',
  'bergsee',
  'schloss',
  'winterdorf',
];

const only = process.argv.slice(2);
const entries = [];
for (const name of ORDER) {
  if (!existsSync(join(here, `${name}.mjs`))) continue;
  const mod = await import(pathToFileURL(join(here, `${name}.mjs`)).href);
  const pic = mod.default();
  const { id, title, category } = pic.meta;
  entries.push({ id, title, category, name });
  if (only.length && !only.includes(name)) continue;
  let pruned = 0;
  if (pic.shapes.some((s) => s.prune)) {
    for (let round = 0; round < 4; round++) {
      const r = pic.prune(await regionStats(pic.toPuzzle()));
      pruned += r;
      if (!r) break;
    }
  }
  // zerfallene Formen an verdeckten Linien teilen, Reststücke an Nachbarn anhängen
  let patched = 0;
  let splitted = 0;
  for (let round = 0; round < 4 && pic.meta.patch !== false; round++) {
    const filler = pic.shapes.map((s) => !!s.prune);
    const st = await regionStats(pic.toPuzzle(), { small: 160, fillerMax: 1500, filler, minSplit: 300 });
    const splits = st.splits.filter((sp) => !pic.shapes[sp.k].prune && pic.meta.split !== false);
    if (splits.length) {
      splitted += pic.applySplits(splits);
      continue;
    }
    if (!st.patches.length) break;
    patched += pic.applyPatches(st.patches);
  }
  if (pic.shapes.some((s) => s.alt)) pic.recolor(await regionStats(pic.toPuzzle()));
  const pz = pic.save(join(outDir, `${name}.js`));
  mkdirSync(join(here, '../tools/out'), { recursive: true });
  writeFileSync(join(here, `../tools/out/${pz.id}.groups.json`), JSON.stringify(pic.shapes.map((s) => s.g || '')));
  console.log(
    `${name.padEnd(14)} ${String(pz.shapes.length).padStart(4)} Bereiche ${String(pz.palette.length).padStart(3)} Farben` +
      (pruned ? `  (${pruned} Füllformen entfernt)` : '') +
      (patched ? `  (${patched} Stücke geflickt)` : '') +
      (splitted ? `  (${splitted} Teilungen)` : ''),
  );
}

const lines = entries.map(
  (e) =>
    `  { id: '${e.id}', title: '${e.title}', category: '${e.category}', load: () => import('./${e.name}.js').then((m) => m.default) },`,
);
writeFileSync(
  join(outDir, 'index.js'),
  `// Bilder von Team B (generiert von src/build.mjs) – von einfach nach reich.\nexport const pictures = [\n${lines.join('\n')}\n];\n`,
);
await closeRaster();
