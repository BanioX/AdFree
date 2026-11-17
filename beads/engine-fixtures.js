// Perlenbild – kleine eigene Ersatz-Muster. Werden nur verwendet, wenn die
// Muster-Bibliothek (/beads/art/index.js) nicht geladen werden kann.
// Format siehe DEV.md («Datenformat: Perlenbild»).

export const fixtures = [
  {
    id: 'fx-herz', title: 'Herz', category: 'Liebe',
    palette: { k: '#8e1b3b', r: '#ff4f79', w: '#ffd1dc' },
    rows: [
      '.kk...kk.',
      'krrk.krrk',
      'krwrkrrrk',
      'krrrrrrrk',
      '.krrrrrk.',
      '..krrrk..',
      '...krk...',
      '....k....',
    ],
  },
  {
    id: 'fx-tropfen', title: 'Tropfen', category: 'Natur',
    palette: { k: '#1d4e89', b: '#4fb3ff', w: '#d6f0ff' },
    rows: [
      '....k....',
      '...kbk...',
      '...kbk...',
      '..kbbbk..',
      '.kbbbbbk.',
      '.kbwbbbk.',
      'kbwbbbbbk',
      'kbwbbbbbk',
      'kbbbbbbbk',
      '.kbbbbbk.',
      '..kkkkk..',
    ],
  },
  {
    id: 'fx-pilz', title: 'Pilz', category: 'Natur',
    palette: { k: '#4a2a22', r: '#e8483b', w: '#fff6ea', c: '#f3d6a6' },
    rows: [
      '...kkkkk...',
      '..krrwrrk..',
      '.krwwwrrrk.',
      'krrwrrrwwrk',
      'krrrrrrwwrk',
      '.kkkkkkkkk.',
      '...kcccck..',
      '...kcccck..',
      '...kcccck..',
      '...kkkkkk..',
    ],
  },
  {
    id: 'fx-regenbogen', title: 'Regenbogen', category: 'Natur',
    palette: { r: '#ff5252', o: '#ffa726', y: '#ffe14d', g: '#5cc366', b: '#42a5f5' },
    rows: [
      '...rrrrrrr...',
      '..rooooooor..',
      '.royyyyyyyor.',
      'roygggggggyor',
      'roygbbbbbgyor',
      'roygb...bgyor',
      'roygb...bgyor',
    ],
  },
  {
    id: 'fx-boot', title: 'Segelboot', category: 'Dinge',
    palette: { k: '#3b2f2f', w: '#ffffff', r: '#ff7043', b: '#4fc3f7' },
    rows: [
      '.....k......',
      '.....kk.....',
      '.....kwk....',
      '.....kwwk...',
      '.....kwwwk..',
      '.....kwwwwk.',
      '.....kkkkkk.',
      'kkkkkkkkkkkk',
      '.krrrrrrrrk.',
      '..krrrrrrk..',
      'bbbbbbbbbbbb',
    ],
  },
  {
    id: 'fx-baum', title: 'Baum', category: 'Natur',
    palette: { k: '#2f4a1f', g: '#5cc85a', l: '#a8eb8a', b: '#9a6234' },
    rows: [
      '...kkkkk...',
      '..kgggggk..',
      '.kgglggggk.',
      'kgglgggggk.',
      'kggggggglgk',
      'kgggggglggk',
      '.kgggggggk.',
      '..kkkbkkk..',
      '....kbk....',
      '....kbk....',
      '...kkbkk...',
      '..kkkkkkk..',
    ],
  },
];

export default fixtures;
