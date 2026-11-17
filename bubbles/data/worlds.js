// Welten der Levelkarte: je 20 Level teilen sich einen Namen, einen Himmel und Tierchen.
// Nach der letzten Welt beginnt die Liste von vorne (mit «II», «III» … im Namen) –
// die Level selbst sind trotzdem alle neu, denn sie werden aus der Levelnummer erzeugt.
//
// Felder:
//   name    Anzeigename der Welt
//   sky     drei Himmelsfarben von oben nach unten (Pastell!)
//   colors  bevorzugte Blasenfarben (ids aus data/colors.js), die ersten werden zuerst genommen
//   pets    Emoji, die in «Befreien»-Leveln in den Blasen stecken

export const LEVELS_PER_WORLD = 20;

export const WORLDS = [
  { name: 'Blumenwiese', sky: ['#ffd9e6', '#ffeedd', '#fff8ec'], colors: [1, 3, 4, 5, 7, 6, 2], pets: ['🐣', '🌸', '🐞'] },
  { name: 'Sonnenhügel', sky: ['#cfe9ff', '#e6f4ff', '#fff6e2'], colors: [2, 5, 3, 4, 1, 6, 7], pets: ['🐰', '🐿️', '🦔'] },
  { name: 'Seerosenteich', sky: ['#c9f0ea', '#e4faf5', '#fffbea'], colors: [4, 8, 7, 3, 6, 1, 2], pets: ['🐸', '🦆', '🐟'] },
  { name: 'Zauberwald', sky: ['#dcefd0', '#eef8e4', '#fffbea'], colors: [4, 2, 6, 1, 3, 5, 7], pets: ['🦊', '🦉', '🍄'] },
  { name: 'Wolkenschloss', sky: ['#e0dcff', '#efebff', '#fff4f4'], colors: [6, 7, 5, 3, 8, 1, 4], pets: ['🦄', '🐑', '⭐'] },
  { name: 'Kirschblüte', sky: ['#ffdbe9', '#fff0f6', '#fff8f0'], colors: [7, 4, 1, 3, 5, 6, 2], pets: ['🌸', '🐼', '🐦'] },
  { name: 'Sternenhimmel', sky: ['#d3d7ff', '#e9e3ff', '#fff1e6'], colors: [5, 3, 6, 1, 8, 2, 7], pets: ['⭐', '🦉', '🌙'] },
  { name: 'Lavendelfeld', sky: ['#e8dbff', '#f5eeff', '#fff7ef'], colors: [6, 3, 4, 7, 5, 2, 1], pets: ['🦋', '🐝', '🐞'] },
  { name: 'Zuckerwatte', sky: ['#ffd9f1', '#ece3ff', '#e0f2ff'], colors: [7, 8, 3, 6, 1, 5, 4], pets: ['🐱', '🐶', '🐹'] },
  { name: 'Herbstwald', sky: ['#ffe2c6', '#fff0de', '#fffaf1'], colors: [2, 1, 3, 4, 6, 5, 7], pets: ['🦔', '🐿️', '🍁'] },
  { name: 'Winterzauber', sky: ['#d8ecff', '#ecf6ff', '#f9fcff'], colors: [5, 8, 6, 7, 3, 1, 4], pets: ['🐧', '⛄', '🐰'] },
  { name: 'Meeresbucht', sky: ['#c6f0ff', '#e2faff', '#fff5e0'], colors: [8, 5, 2, 3, 1, 7, 4], pets: ['🐠', '🐢', '🐙'] },
];

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** Welt (0-basiert) mit Namen inkl. Durchgang, z.B. «Blumenwiese II». */
export function worldInfo(index) {
  const base = WORLDS[index % WORLDS.length];
  const round = Math.floor(index / WORLDS.length) + 1;
  const suffix = round < ROMAN.length ? ROMAN[round] : ` ${round}`;
  return { ...base, index, name: base.name + suffix };
}
