// Aussehen (Skins) des Blockpuzzles.
//
//   id       eindeutig
//   title    Anzeigename
//   style    Zeichenstil der Steine: 'jewel' (geschliffen, glänzend), 'soft' (weich, pastell),
//            'wood' (Holz mit Maserung). Neue Skins können einen bestehenden Stil mit neuen Farben nutzen.
//   colors   genau 8 Steinfarben (Index 0–7, siehe shapes.js)
//   board    Brett: bg = Verlauf [oben, unten], cell = leeres Feld, edge = Rand/Linie,
//            cover = verdecktes Feld (Bild-Level), coverMark = Muster darauf
//   gray     Farbe für Steine, die gerade nicht passen / bei «Keine Züge mehr»
//   page     optional: Hintergrundfarbe der Spielseite
//   unlock   optional: so viele Sterne (Abenteuer) braucht es, bis das Aussehen frei wird

export const skins = [
  {
    id: 'juwelen', title: 'Juwelen', style: 'jewel',
    colors: ['#ee3a5c', '#ff8a24', '#ffc928', '#22c07a', '#19b3dd', '#4069f2', '#9b55ee', '#ff5fae'],
    board: { bg: ['#3a2f66', '#2a2250'], cell: '#43387a', edge: '#231c44', cover: '#5b4fa0', coverMark: '#8e82d8' },
    gray: '#8a86a3',
  },
  {
    id: 'pastell', title: 'Pastell', style: 'soft',
    colors: ['#ff9fb2', '#ffbf8f', '#ffe08a', '#a6e3b8', '#94d8ea', '#a9c1ff', '#cdb2ff', '#ffb6dc'],
    board: { bg: ['#ffffff', '#fbf4ec'], cell: '#f2e9de', edge: '#e6d9c9', cover: '#e3d7f5', coverMark: '#c6b4ea' },
    gray: '#d6cfc6',
  },
  {
    id: 'holz', title: 'Holz', style: 'wood',
    colors: ['#c0583f', '#d9893b', '#e8c27a', '#8f9e4c', '#5d8fa6', '#6b5b9a', '#8a5a3b', '#d1847a'],
    board: { bg: ['#d9a46c', '#c48a50'], cell: '#b47c45', edge: '#8a5a2c', cover: '#e3c08f', coverMark: '#c99a62' },
    gray: '#a49484',
  },
  {
    id: 'bonbon', title: 'Bonbon', style: 'jewel',
    colors: ['#ff5d8f', '#ff9a5a', '#ffd84a', '#5fd6a0', '#4fd0e8', '#7c8cff', '#c27bff', '#ff8fd8'],
    board: { bg: ['#ffe4ef', '#ffd2e4'], cell: '#ffc3da', edge: '#f4a8c6', cover: '#fff3f8', coverMark: '#ff9cc4' },
    gray: '#cdb3bf',
  },
  {
    id: 'meeresglas', title: 'Meeresglas', style: 'soft', unlock: 20,
    colors: ['#ff8f8f', '#ffb877', '#ffe07a', '#7fdcb0', '#6fd3e6', '#7fa8ff', '#b39bff', '#ff9ccf'],
    board: { bg: ['#dcf4f4', '#bfe7ea'], cell: '#cdeef0', edge: '#a3d4da', cover: '#eefafa', coverMark: '#8ccbd3' },
    gray: '#b4c9cc',
  },
  {
    id: 'sternennacht', title: 'Sternennacht', style: 'jewel', unlock: 50,
    colors: ['#ff4f7b', '#ff9c3a', '#ffe14d', '#3fe0a0', '#3fd0ff', '#5f86ff', '#b26bff', '#ff6fd0'],
    board: { bg: ['#1f2856', '#121736'], cell: '#2a336e', edge: '#0d1130', cover: '#3a4590', coverMark: '#7d8ae0' },
    gray: '#7a7f9e',
  },
];

/** Aussehen, die bei `stars` Sternen frei sind. */
export function skinUnlocked(skin, stars) {
  return !skin.unlock || stars >= skin.unlock;
}

// Edelsteine (Ziel «Edelsteine sammeln»). Zeichen im Level-Brett → Edelstein.
export const gems = {
  r: { title: 'Rubin', color: '#e8304a', light: '#ff8a9c', dark: '#9c1028' },
  b: { title: 'Saphir', color: '#2f7cf0', light: '#8cc0ff', dark: '#163f9c' },
  g: { title: 'Smaragd', color: '#18b06a', light: '#7ef0b4', dark: '#0a6a3c' },
  y: { title: 'Topas', color: '#ffb800', light: '#ffe58a', dark: '#b06a00' },
  p: { title: 'Amethyst', color: '#9a4ee8', light: '#d4a8ff', dark: '#5a1ea0' },
};
export const GEM_KEYS = ['r', 'b', 'g', 'y', 'p'];
