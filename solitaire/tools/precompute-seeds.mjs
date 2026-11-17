// Sucht beweisbar lösbare Partie-Nummern und schreibt sie nach tools/out/<name>.json.
// Jede Lösung wird vollständig mit der Regel-Engine nachgespielt (replayWins) – nur dann zählt sie.
//
//   node solitaire/tools/precompute-seeds.mjs <modus> <anzahl> [--from 1] [--name klondike1] [--threads 3] [--nodes N]
//   node solitaire/tools/precompute-seeds.mjs --write      # erzeugt solitaire/data/seeds.js aus allen out/*.json
//
// Modus: klondike1 | klondike3 | freecell | spider1 | spider2 | spider4
// Beispiele (siehe CONTENT.md):
//   node solitaire/tools/precompute-seeds.mjs klondike1 2000 --from 1
//   node solitaire/tools/precompute-seeds.mjs klondike1 1100 --from 1000001 --name daily-klondike1

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

if (!isMainThread) {
  const { solveSeed } = await import('../logic/solve.js');
  const { replayWins } = await import('../logic/replay.js');
  const { newDeal } = await import('../logic/rules.js');
  const { mode, nodes } = workerData;
  parentPort.on('message', (seed) => {
    const opts = { wantMoves: true };
    if (nodes) opts.maxNodes = nodes;
    let ok = false, n = 0;
    try {
      const r = solveSeed(mode, seed, opts);
      n = r.nodes;
      ok = !!(r.solved && r.moves && replayWins(newDeal(mode, seed), r.moves));
    } catch (e) {
      ok = false;
    }
    parentPort.postMessage({ seed, ok, nodes: n });
  });
} else {
  const args = process.argv.slice(2);
  if (args[0] === '--write') {
    await writeData();
  } else {
    const mode = args[0];
    const count = +args[1] || 100;
    const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
    const from = +opt('from', 1);
    const name = opt('name', mode);
    const threads = +opt('threads', 3);
    const nodes = +opt('nodes', 0);
    await run({ mode, count, from, name, threads, nodes });
  }
}

async function run({ mode, count, from, name, threads, nodes }) {
  await mkdir(outDir, { recursive: true });
  const results = new Map();
  let next = from;
  let contiguous = from - 1; // alle Nummern bis hier geprüft
  let found = 0;
  let done = false;
  const t0 = Date.now();
  const workers = [];
  await new Promise((resolve) => {
    let active = 0;
    const feed = (w) => {
      if (done) { w.terminate(); if (--active === 0) resolve(); return; }
      w.postMessage(next++);
    };
    for (let i = 0; i < threads; i++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { mode, nodes } });
      workers.push(w);
      active++;
      w.on('message', ({ seed, ok }) => {
        results.set(seed, ok);
        while (results.has(contiguous + 1)) {
          contiguous++;
          if (results.get(contiguous)) found++;
          if (found >= count) { done = true; break; }
        }
        if ((contiguous - from) % 100 === 0) {
          process.stdout.write(`\r${name}: ${found}/${count} lösbar, geprüft bis ${contiguous} (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
        }
        feed(w);
      });
      feed(w);
    }
  });
  const seeds = [];
  for (let s = from; s <= contiguous; s++) if (results.get(s)) seeds.push(s);
  const data = { mode, from, to: contiguous, seeds: seeds.slice(0, count), nodes: nodes || null };
  data.to = data.seeds[data.seeds.length - 1];
  await writeFile(path.join(outDir, name + '.json'), JSON.stringify(data));
  console.log(`\n${name}: ${data.seeds.length} lösbare Partien zwischen ${from} und ${data.to} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

async function writeData() {
  const files = (await readdir(outDir)).filter((f) => f.endsWith('.json')).sort();
  const lists = {};
  for (const f of files) lists[f.replace(/\.json$/, '')] = JSON.parse(await readFile(path.join(outDir, f), 'utf8'));
  const lines = [
    '// Beweisbar lösbare Partie-Nummern (automatisch erzeugt von tools/precompute-seeds.mjs – nicht von Hand ändern).',
    '// Jede Nummer wurde von einem Löser gewonnen und die Lösung mit der Regel-Engine nachgespielt.',
    '// from/to: geprüfter Bereich. Nach dem Ende der Liste prüft die App weitere Nummern ab to+1 selbst.',
    '',
  ];
  const fmt = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 20) out.push('    ' + arr.slice(i, i + 20).join(', ') + ',');
    return out.join('\n');
  };
  const block = (key, d) => `  ${JSON.stringify(key)}: { mode: '${d.mode}', from: ${d.from}, to: ${d.to}, seeds: [\n${fmt(d.seeds)}\n  ] },`;
  const normal = Object.entries(lists).filter(([k]) => !k.startsWith('daily-'));
  const daily = Object.entries(lists).filter(([k]) => k.startsWith('daily-'));
  lines.push('export const SOLVABLE = {');
  for (const [k, d] of normal) lines.push(block(k, d));
  lines.push('};', '');
  lines.push('// Tagesrätsel: Tag n (seit 1.1.2026) spielt seeds[n % Länge]. Für alle gleich.');
  lines.push('export const DAILY = {');
  for (const [k, d] of daily) lines.push(block(k.replace(/^daily-/, ''), d));
  lines.push('};', '');
  const target = path.join(here, '..', 'data', 'seeds.js');
  await writeFile(target, lines.join('\n'));
  console.log('geschrieben:', target, Object.keys(lists).join(', '));
}
