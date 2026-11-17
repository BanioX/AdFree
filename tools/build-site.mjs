// Baut die auslieferbare Website nach dist/ (für Cloudflare Pages oder jeden statischen Host).
// Kopiert nur Laufzeit-Dateien (ohne Tests, Werkzeuge, Quellskripte, Vorschaubilder)
// und schreibt die Offline-Cache-Liste samt Version in dist/sw.js.
//
//   node tools/build-site.mjs           → dist/
//
// Cloudflare Pages: Build command «node tools/build-site.mjs», Build output directory «dist».
import { readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

const EXCLUDE_DIRS = new Set(['.git', '.github', 'tools', 'tests', 'src', 'node_modules', 'dist', 'out', 'screenshots', 'shots', 'preview', 'previews', 'scratch']);
const INCLUDE_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.woff2', '.txt']);
const ROOT_EXTRA = ['_headers', '_redirects'];

async function walk(dir, list = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      await walk(p, list);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      const rel = path.relative(root, p);
      if (!INCLUDE_EXT.has(ext) && !ROOT_EXTRA.includes(rel)) continue;
      if (/\.(test|spec)\.m?js$/.test(e.name)) continue;
      list.push(p);
    }
  }
  return list;
}

await rm(out, { recursive: true, force: true });
const files = (await walk(root)).sort();
const hash = createHash('sha256');
let bytes = 0;
for (const f of files) {
  const rel = path.relative(root, f);
  const dest = path.join(out, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(f, dest);
  const buf = await readFile(f);
  bytes += buf.length;
  hash.update(rel);
  hash.update(buf);
}

// Offline-Cache: alle Dateien ausser sw.js und den Host-Konfigurationsdateien
const version = hash.digest('hex').slice(0, 10);
const urls = ['./'];
for (const f of files) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  if (rel === 'sw.js' || ROOT_EXTRA.includes(rel)) continue;
  if (rel.endsWith('/index.html')) urls.push('./' + rel.slice(0, -'index.html'.length));
  urls.push('./' + rel);
}
urls.push('./ready.json');
const swPath = path.join(out, 'sw.js');
let sw = await readFile(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(urls, null, 2).replace(/"/g, "'")};`);
await writeFile(swPath, sw);
await writeFile(path.join(out, '.nojekyll'), '');

// Welche Spiele sind fertig (haben eine index.html)? Die Startseite zeigt die übrigen als «Bald».
const { pathToFileURL } = await import('node:url');
const { games } = await import(pathToFileURL(path.join(root, 'games.js')).href);
const { existsSync } = await import('node:fs');
const ready = games.filter((g) => existsSync(path.join(root, g.id, 'index.html'))).map((g) => g.id);
await writeFile(path.join(out, 'ready.json'), JSON.stringify(ready));
console.log(`ready.json: ${ready.length} von ${games.length} Spielen fertig`);
console.log(`dist/: ${files.length} Dateien, ${(bytes / 1024 / 1024).toFixed(1)} MB, Cache-Version ${version}`);
