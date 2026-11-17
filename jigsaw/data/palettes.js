// Farbpaletten für die gemalten Puzzle-Bilder.
//
// Jede Palette hat dieselben Rollen, damit jede Palette mit jedem Maler funktioniert:
//   sky      Himmel von oben nach unten (2–4 Farben). Unterwasser: Wasser von oben nach unten.
//   sun      Sonne / Mond / Lichtfarbe
//   far      Farbe der fernsten Ebene (Berge, Hügel, Wald …)
//   near     Farbe der nächsten, dunkelsten Ebene
//   haze     Dunst/Nebel (optional, sonst unterste Himmelsfarbe)
//   ground   Wiese/Boden im Vordergrund (optional)
//   accents  Akzentfarben: Blumen, Ballone, Fische, Muster … (3–8 Farben)

export const palettes = {
  morgenrot: {
    title: 'Morgenrot',
    sky: ['#56679f', '#d99ab0', '#fbd6b6'], sun: '#fff0d4', far: '#c4a0c2', near: '#3b3858', haze: '#f6d1cc',
    ground: '#7d9a5c', accents: ['#f4a8bb', '#ffe08a', '#ffffff', '#b9a2e8'],
  },
  alpenglut: {
    title: 'Alpenglühen',
    sky: ['#34437a', '#cf7489', '#f8c58e'], sun: '#ffe7b4', far: '#e2a39d', near: '#2b2645', haze: '#f2c0a6',
    ground: '#6f8a4a', accents: ['#ff9f7a', '#ffd36e', '#ffffff', '#f37a9a'],
  },
  sommertag: {
    title: 'Sommertag',
    sky: ['#3f8fd8', '#94caf0', '#e6f4fa'], sun: '#fffbe6', far: '#93b9d6', near: '#2c6449', haze: '#d9eaf3',
    ground: '#78b354', accents: ['#ff5d6c', '#ffd23f', '#ffffff', '#b07cf0', '#ff9ec4'],
  },
  abendgold: {
    title: 'Abendgold',
    sky: ['#38306a', '#c25b6c', '#ffb25a'], sun: '#fff0a8', far: '#ad5e7a', near: '#1f1a33', haze: '#f59a70',
    ground: '#5a5a3a', accents: ['#ffcf5c', '#ff7b54', '#ffe8a3', '#ff9ec4'],
  },
  nebelblau: {
    title: 'Nebelblau',
    sky: ['#8aa4c6', '#c8d5e6', '#eef1f5'], sun: '#ffffff', far: '#b1c1d5', near: '#33465c', haze: '#e5eaf1',
    ground: '#6f8f7a', accents: ['#f2c6a0', '#ffffff', '#c7d6f0', '#f3a6b8'],
  },
  herbst: {
    title: 'Herbstzeit',
    sky: ['#79a2c8', '#efd0ae', '#fbe8cf'], sun: '#fff2d2', far: '#c69878', near: '#55291c', haze: '#f3dbc0',
    ground: '#a8893a', accents: ['#e8752a', '#c7402d', '#f2b33d', '#8a9a3a', '#ffd9a0'],
  },
  lavendel: {
    title: 'Lavendel',
    sky: ['#7779c4', '#c6b2e6', '#f6e0ee'], sun: '#fff5e8', far: '#a596ce', near: '#3c3064', haze: '#ebdaf0',
    ground: '#6f8e5a', accents: ['#9b7fe0', '#c9a3f0', '#ffe0f0', '#ffffff', '#ffd27a'],
  },
  mitternacht: {
    title: 'Mitternacht',
    sky: ['#0a0f2e', '#1b2858', '#3a5788'], sun: '#fff6d4', far: '#22325e', near: '#060a1a', haze: '#2d4573',
    ground: '#18243a', accents: ['#9ef0c8', '#7ad3ff', '#f5a3ff', '#ffe8a0'],
  },
  polarlicht: {
    title: 'Polarlicht',
    sky: ['#040a1d', '#0c223e', '#1a4858'], sun: '#f6f2d8', far: '#13283f', near: '#030711', haze: '#1e4a58',
    ground: '#0e1a24', accents: ['#4dffb4', '#36d1c4', '#b98cff', '#ff8fc8'],
  },
  tiefblau: {
    title: 'Tiefblau',
    sky: ['#070d24', '#162a5e', '#4a5f9e'], sun: '#fdf3d0', far: '#26386c', near: '#080b1e', haze: '#3b4f8a',
    ground: '#151c38', accents: ['#ffd27a', '#8fd8ff', '#ffffff', '#ff9ec4'],
  },
  veilchen: {
    title: 'Veilchennacht',
    sky: ['#140b2e', '#3a1f62', '#7a4a8e'], sun: '#ffeedd', far: '#3d2660', near: '#0f0820', haze: '#5a3a7a',
    ground: '#1a1030', accents: ['#ff9ad5', '#b98cff', '#7af0e0', '#ffe8a0'],
  },
  karibik: {
    title: 'Karibik',
    sky: ['#1d6bb0', '#78c3e7', '#f2e6c2'], sun: '#fffbe0', far: '#27a0b6', near: '#0a5876', haze: '#cdeeed',
    ground: '#e9d3a0', accents: ['#ffffff', '#ffd166', '#ef476f', '#06d6a0', '#ff9f68'],
  },
  flamingo: {
    title: 'Flamingo',
    sky: ['#664a90', '#f08cab', '#ffd3a6'], sun: '#fff1c0', far: '#c3779b', near: '#392858', haze: '#ffc7ae',
    ground: '#8a6a7a', accents: ['#ff8fab', '#ffd6a5', '#fdffb6', '#ffffff', '#a0c4ff'],
  },
  glut: {
    title: 'Abendglut',
    sky: ['#291645', '#b5384c', '#ff983a'], sun: '#ffe69c', far: '#88304f', near: '#190e21', haze: '#ff8850',
    ground: '#3a2430', accents: ['#ffd166', '#ff6b35', '#ffe8c2', '#ff9ec4'],
  },
  minze: {
    title: 'Minze',
    sky: ['#79c4bc', '#c3e9df', '#f5fbf1'], sun: '#fffdf0', far: '#95cbb6', near: '#2c6b5f', haze: '#e0f3eb',
    ground: '#86bf7a', accents: ['#ff9aa2', '#ffdac1', '#ffffff', '#c7ceea', '#ffd36e'],
  },
  wueste: {
    title: 'Wüstensand',
    sky: ['#3b6ca6', '#efc28b', '#fbe2bd'], sun: '#fff2cc', far: '#e2a76a', near: '#874828', haze: '#f6d5a8',
    ground: '#d9a05e', accents: ['#2f6b3b', '#c2562a', '#ffe0a3', '#5a8a3a'],
  },
  winter: {
    title: 'Winterlicht',
    sky: ['#6b8bc6', '#c7d6ef', '#f4eff6'], sun: '#fff9ee', far: '#c1d0e8', near: '#37496f', haze: '#edf0f8',
    ground: '#eef3fb', accents: ['#ffffff', '#ffb36b', '#d65a5a', '#2f6b55', '#ffd27a'],
  },
  kirschbluete: {
    title: 'Kirschblüte',
    sky: ['#98c2e6', '#f4d8e4', '#fff3ea'], sun: '#fff9f0', far: '#c6cce4', near: '#5a3838', haze: '#fce7ec',
    ground: '#a8c98a', accents: ['#ffc2d4', '#ff9ebb', '#f27598', '#ffffff', '#ffe9a8'],
  },
  tiefsee: {
    title: 'Tiefsee',
    sky: ['#62d2e2', '#1e84b3', '#0a2d5a'], sun: '#e9fbff', far: '#1a5a80', near: '#0a2440', haze: '#2a8ab0',
    ground: '#e4cf9c', accents: ['#ff7f6a', '#ffd166', '#ff9ad5', '#7af0c8', '#f8f3e6', '#b48cff'],
  },
  lagune: {
    title: 'Lagune',
    sky: ['#8ae6e0', '#2fb2c4', '#0f5a7a'], sun: '#f2ffff', far: '#2a7f95', near: '#0c3550', haze: '#46b8c8',
    ground: '#f1dfae', accents: ['#ffb36b', '#ff6f91', '#ffe66d', '#ffffff', '#9b8cff'],
  },
  // Vor allem für Muster
  bonbon: {
    title: 'Bonbon',
    sky: ['#fff6ef', '#ffe9e0'], sun: '#ffffff', far: '#ffd6e0', near: '#6b3a6e', haze: '#fff2ea',
    accents: ['#ff8fab', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f15bb5'],
  },
  bauhaus: {
    title: 'Bauhaus',
    sky: ['#f4ecdf', '#efe3d0'], sun: '#fff8ea', far: '#c9b79c', near: '#2b2d42', haze: '#f6efe4',
    accents: ['#e4572e', '#f3a712', '#29335c', '#669bbc', '#a8c686', '#2b2d42'],
  },
  meeresbrise: {
    title: 'Meeresbrise',
    sky: ['#f2fbfb', '#e0f4f5'], sun: '#ffffff', far: '#9db4c0', near: '#253237', haze: '#eef8f8',
    accents: ['#c2dfe3', '#9db4c0', '#5c6b73', '#253237', '#f4a261', '#e0fbfc'],
  },
  herbstlaub: {
    title: 'Herbstlaub',
    sky: ['#fbf3e6', '#f4e6cf'], sun: '#fff7e8', far: '#e9c46a', near: '#264653', haze: '#fbf3e6',
    accents: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  },
  pastell: {
    title: 'Pastell',
    sky: ['#fffaf5', '#fff1ea'], sun: '#ffffff', far: '#d8d0f0', near: '#5a4e7a', haze: '#fff8f2',
    accents: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'],
  },
  edelstein: {
    title: 'Edelstein',
    sky: ['#1b1b3a', '#2a2350'], sun: '#fff4d6', far: '#3d3a7a', near: '#0f0e24', haze: '#2c2a55',
    accents: ['#e63977', '#f7b32b', '#2ec4b6', '#7b5cff', '#3a86ff', '#ff6b6b'],
  },
  wald: {
    title: 'Waldgrün',
    sky: ['#a9cbd6', '#dcebdc', '#f4f6e6'], sun: '#fffbe6', far: '#a7c4b4', near: '#1f3d2e', haze: '#e3efe4',
    ground: '#5f8a45', accents: ['#e8453c', '#ffffff', '#ffd36e', '#c58bd6'],
  },
  fruehling: {
    title: 'Frühling',
    sky: ['#7cc0ee', '#c3e5f7', '#f4fbf0'], sun: '#fffde8', far: '#a6d0c0', near: '#3c7a4a', haze: '#e8f5ee',
    ground: '#8cc65e', accents: ['#ff6f91', '#ffc75f', '#ffffff', '#c493ff', '#ff9671', '#4fc3f7'],
  },
};

export const paletteIds = Object.keys(palettes);
