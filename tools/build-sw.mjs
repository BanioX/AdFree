// Schreibt die Liste aller App-Dateien und eine neue Version in sw.js,
// damit die App nach dem ersten Öffnen komplett offline läuft und Updates ankommen.
//   node tools/build-sw.mjs
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Was nicht ausgeliefert werden muss (Tests, Werkzeuge, Quellskripte, Doku).
const EXCLUDE_DIRS = new Set(['.git', '.github', 'tools', 'tests', 'src', 'node_modules', 'scratch', 'previews', 'preview', 'out']);
const INCLUDE_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.woff2']);
const EXCLUDE_FILES = new Set(['sw.js']);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      await walk(p, out);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (!INCLUDE_EXT.has(ext)) continue;
      if (EXCLUDE_FILES.has(e.name)) continue;
      if (/\.(test|spec)\.m?js$/.test(e.name)) continue;
      out.push(p);
    }
  }
  return out;
}

const files = (await walk(root)).sort();
const hash = createHash('sha256');
let bytes = 0;
for (const f of files) {
  const buf = await readFile(f);
  bytes += (await stat(f)).size;
  hash.update(path.relative(root, f));
  hash.update(buf);
}
const version = hash.digest('hex').slice(0, 10);
const list = ['./', ...files.map((f) => './' + path.relative(root, f).split(path.sep).join('/'))]
  // Ordner-URLs der Spiele (index.html wird per Ordner aufgerufen)
  .flatMap((u) => (u.endsWith('/index.html') && u !== './index.html' ? [u.slice(0, -'index.html'.length), u] : [u]));

const swPath = path.join(root, 'sw.js');
let sw = await readFile(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list, null, 2).replace(/"/g, "'")};`);
await writeFile(swPath, sw);
console.log(`sw.js: Version ${version}, ${list.length} Dateien, ${(bytes / 1024).toFixed(0)} KB`);
