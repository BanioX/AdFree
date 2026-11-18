// Wabenstapel – Level-Parameter. Level werden aus einem festen Seed erzeugt (für alle gleich)
// und vom Test-Bot auf Fairness geprüft (tests/logic.test.mjs). Endlos: jedes Spiel neu gemischt.
//
// Ein Level besteht aus:
//   layout   Brettform-ID aus layouts.js
//   colors   Anzahl Farben (3–6)
//   goal     so viele Plättchen müssen abgeräumt werden
//   prefill  so viele Stapel liegen zu Beginn schon auf dem Brett
//   sizes    Gewichte für Stapelhöhen 2,3,4,5,6
//   runs     Gewichte für 1, 2 oder 3 Farbabschnitte pro Stapel
//   preferP  Wahrscheinlichkeit, dass die oberste Farbe eines neuen Stapels schon auf dem Brett liegt

// Kapitel: je 10 Level, das 10. ist ein «Spezial»-Level (goldener Rahmen, grösseres Ziel).
export const CHAPTERS = [
  { name: 'Blütenhonig', layouts: ['wabe', 'feld', 'wabe', 'ring', 'feld'], colors: [3, 3, 4, 4, 4, 4, 4, 4, 4, 4] },
  { name: 'Lindenhonig', layouts: ['garten', 'ring', 'herz', 'feld', 'garten'], colors: [4, 4, 4, 4, 5, 4, 4, 5, 4, 5] },
  { name: 'Waldhonig', layouts: ['turm', 'blume', 'garten', 'herz', 'gross'], colors: [4, 5, 4, 5, 5, 4, 5, 5, 5, 5] },
  { name: 'Akazienhonig', layouts: ['insel', 'gross', 'stern', 'blume', 'turm'], colors: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { name: 'Rapshonig', layouts: ['stern', 'gross', 'insel', 'garten', 'herz'], colors: [5, 5, 6, 5, 5, 6, 5, 5, 6, 6] },
];

export const LEVEL_NAMES = CHAPTERS.map((c) => c.name);

export function chapterOf(n) {
  return Math.floor((n - 1) / 10);
}

export function levelParams(n) {
  n = Math.max(1, n | 0);
  const ch = chapterOf(n);
  const chap = CHAPTERS[ch % CHAPTERS.length];
  const loop = Math.floor(ch / CHAPTERS.length); // nach 50 Leveln: Runde 2, 3 … (etwas grössere Ziele)
  const i = (n - 1) % 10;
  const special = i === 9;
  const layout = special ? 'gross' : chap.layouts[i % chap.layouts.length];
  const colors = Math.min(6, chap.colors[i] + (loop > 0 && i % 3 === 2 ? 1 : 0));
  const base = n <= 1 ? 30 : n <= 3 ? 40 : 40 + Math.min(80, Math.round(n * 2.2));
  const goal = Math.round((base + loop * 10) * (special ? 1.4 : 1) / 10) * 10;
  return {
    seed: 'hexa-level-' + n,
    layout, colors, goal,
    prefill: n < 3 ? 0 : Math.min(7, 1 + Math.floor(n / 6)),
    sizes: n < 4 ? [4, 4, 3, 1, 0] : [3, 4, 4, 2, 1],
    runs: n < 3 ? [6, 3, 0] : n < 20 ? [4, 4, 2] : [3, 4, 3],
    preferP: n < 6 ? 0.65 : n < 20 ? 0.5 : 0.4,
    special,
    name: chap.name,
  };
}

export function ENDLESS(seed) {
  return {
    seed: seed == null ? 'hexa-endless' : seed,
    layout: 'garten', colors: 4, goal: 0, prefill: 0,
    sizes: [3, 4, 4, 2, 1], runs: [4, 4, 2], preferP: 0.55,
  };
}

export const DAILY_LAYOUTS = ['garten', 'herz', 'blume', 'insel', 'gross', 'stern', 'turm'];

export function DAILY(dayKey) {
  // Jeden Tag andere Form (Wochentag), 5 Farben, Ziel 100.
  const d = new Date(dayKey + 'T12:00:00');
  const wd = isNaN(d) ? 0 : d.getDay();
  return {
    seed: 'hexa-daily-' + dayKey,
    layout: DAILY_LAYOUTS[wd % DAILY_LAYOUTS.length], colors: 5, goal: 100, prefill: 3,
    sizes: [3, 4, 4, 2, 1], runs: [4, 4, 2], preferP: 0.55,
    name: 'Tagesbrett',
  };
}
