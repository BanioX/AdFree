// Schreibt die rows aller Bilder einer Datendatei in Normalform zurück (ein String pro Zeile).
//   node nonogram/tools/normalize.mjs <paket-id>
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const id = process.argv[2];
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', `${id}.js`);
const list = (await import(file + '?t=' + Date.now())).default;
let src = await readFile(file, 'utf8');
for (const def of list) {
  const at = src.indexOf(`id: '${def.id}'`);
  const rs = src.indexOf('rows: [', at);
  // Ende des rows-Arrays: erste Zeile, die nur aus Einrückung + "]," besteht
  const re = src.indexOf('\n', src.indexOf('],', src.lastIndexOf("',", src.indexOf('\n  },', rs))));
  const lineStart = src.lastIndexOf('\n', rs) + 1;
  const indent = src.slice(lineStart, rs);
  const body = def.rows.map((r) => `${indent}  '${r}',`).join('\n');
  const endIdx = src.indexOf('],', src.indexOf('\n' + indent + ']', rs));
  src = src.slice(0, rs) + `rows: [\n${body}\n${indent}]` + src.slice(endIdx + 1);
}
await writeFile(file, src);
console.log(`${list.length} Bilder normalisiert in ${file}`);
