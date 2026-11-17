// Farbfluss – Zugang zur Level-Erzeugung und zum Löser.
// Läuft bevorzugt in einem Web Worker; fällt sonst auf den Hauptthread zurück.

let worker = null;
let broken = false;
let seq = 0;
const pending = new Map();
const memo = new Map();

async function inline(type, arg) {
  const [L, S] = await Promise.all([import('./logic/levels.js'), import('./logic/solver.js')]);
  if (type === 'level') return L.buildLevel(arg);
  if (type === 'daily') return L.buildDaily(arg);
  if (type === 'hint') return S.hint(arg);
  return null;
}

function failAll() {
  broken = true;
  if (worker) { try { worker.terminate(); } catch { /* ignore */ } }
  worker = null;
  const list = [...pending.values()];
  pending.clear();
  for (const p of list) p.fallback();
}

function getWorker() {
  if (worker || broken) return worker;
  try {
    worker = new Worker(new URL('./logic/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data || {};
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
    };
    worker.onerror = (e) => { e.preventDefault && e.preventDefault(); failAll(); };
  } catch {
    broken = true;
    worker = null;
  }
  return worker;
}

function call(type, arg, timeoutMs = 8000) {
  const w = getWorker();
  if (!w) return inline(type, arg);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const p = {
      resolve, reject,
      fallback: () => inline(type, arg).then(resolve, reject),
      timer: setTimeout(() => {
        // Worker hängt (sollte nicht passieren): im Hauptthread rechnen
        if (pending.has(id)) { pending.delete(id); p.fallback(); }
      }, timeoutMs),
    };
    pending.set(id, p);
    w.postMessage({ id, type, arg });
  });
}

function cached(key, fn) {
  if (memo.has(key)) return memo.get(key);
  const pr = fn().catch((err) => { memo.delete(key); throw err; });
  memo.set(key, pr);
  if (memo.size > 12) memo.delete(memo.keys().next().value);
  return pr;
}

export const engine = {
  level: (n) => cached('L' + n, () => call('level', n)),
  daily: (day) => cached('D' + day, () => call('daily', day)),
  hint: (state) => call('hint', state),
};
