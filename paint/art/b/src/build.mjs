// Baut alle Bilder von Team B: node paint/art/b/src/build.mjs [name …]
// Schreibt ../<name>.js (Puzzle-Module) und ../index.js (Bildliste).

import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

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
  const pz = pic.save(join(outDir, `${name}.js`));
  console.log(`${name.padEnd(14)} ${String(pz.shapes.length).padStart(4)} Bereiche ${String(pz.palette.length).padStart(3)} Farben`);
}

const lines = entries.map(
  (e) =>
    `  { id: '${e.id}', title: '${e.title}', category: '${e.category}', load: () => import('./${e.name}.js').then((m) => m.default) },`,
);
writeFileSync(
  join(outDir, 'index.js'),
  `// Bilder von Team B (generiert von src/build.mjs) – von einfach nach reich.\nexport const pictures = [\n${lines.join('\n')}\n];\n`,
);
