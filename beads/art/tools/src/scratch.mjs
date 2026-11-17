import { Grid, sym } from '../raster.mjs';
const P = { k: '#5a1a2b', r: '#ee3a4a', g: '#45b85a', y: '#ffe08a' };
export default [
  {
    id: 'erdbeere-c', title: 'Erdbeere C', category: 'Essen', palette: P,
    rows: [
      '.....kk.....',
      '....kggk....',
      '.kk.kggk.kk.',
      'kggkggggkggk',
      'kgggggggggg k'.replace(' ', ''),
      'krgggrrgggrk',
      'kryrgrrgryrk',
      'krrrrryrrrrk',
      '.kryrrrryrk.',
      '..krrryrrk..',
      '...kryrrk...',
      '....kkkk....',
    ],
  },
  {
    id: 'erdbeere-d', title: 'Erdbeere D', category: 'Essen', palette: P,
    rows: [
      '.....kk.....',
      '....kgk.....',
      '.kkkkgkkkkk.',
      'kgggggggggk.',
      'krgggrgggrk.',
      'krrgryrgrrk.',
      'kryrrrrryrk.',
      'krrrryrrrrk.',
      '.kryrrrryk..',
      '..krrrrrk...',
      '...kryrk....',
      '....kkk.....',
    ].map((r) => r.slice(0, 11)),
  },
  {
    id: 'kirschen-b', title: 'Kirschen B', category: 'Essen',
    palette: { k: '#5a1430', r: '#e5233f', p: '#ff8ea0', g: '#4caf50' },
    build() {
      const g = new Grid(12, 12);
      const ch = ['..kkk..', '.kpprk.', 'kpprrrk', 'kprrrrk', 'krrrrrk', '.krrrk.', '..kkk..'];
      g.stamp(5, 4, ch);
      g.stamp(0, 5, ch);
      g.stamp(3, 0, [
        '....kggg.',
        '...k.ggg.',
        '..k..k...',
        '.k...k...',
        'k........',
      ]);
      return g;
    },
  },
  {
    id: 'kirschen-c', title: 'Kirschen C', category: 'Essen',
    palette: { k: '#5a1430', r: '#e5233f', p: '#ff8ea0', g: '#4caf50' },
    build() {
      const g = new Grid(12, 12);
      const ch = ['..kkk..', '.kpprk.', 'kpprrrk', 'kprrrrk', 'krrrrrk', '.krrrk.', '..kkk..'];
      g.stamp(5, 4, ch);
      g.stamp(0, 5, ch);
      g.stamp(3, 0, [
        '...kkggg.',
        '..k..kggg',
        '.k....k..',
        'k.....k..',
      ]);
      return g;
    },
  },
];
