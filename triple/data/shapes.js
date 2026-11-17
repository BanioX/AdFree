// Dreierlei – Grundformen der Level.
//
// Eine Form ist ein kleines Raster aus '#' (hier liegt ein Stein) und '.' (leer).
// Das ist die unterste Ebene. Die oberen Ebenen erzeugt der Generator automatisch daraus
// (versetzt um einen halben Stein, nach innen geschrumpft, als Türmchen …).
//
// Regeln:
//   - höchstens 7 Spalten breit und 8 Zeilen hoch (sonst werden die Steine auf dem iPhone zu klein)
//   - alle Zeilen gleich lang
//   - möglichst symmetrisch (sieht handgemacht aus)
//   - mindestens 10 '#'
//
// Neue Form: Eintrag anhängen – fertig (siehe CONTENT.md).

export const shapes = [
  // ---------- kleine Formen (für die ersten Level und «Klein») ----------
  {
    id: 'herzlein', title: 'Herzlein',
    rows: [
      '.#.#.',
      '#####',
      '#####',
      '.###.',
      '..#..',
    ],
  },
  {
    id: 'tropfen', title: 'Tropfen',
    rows: [
      '..#..',
      '.###.',
      '#####',
      '#####',
      '.###.',
    ],
  },
  {
    id: 'knopf', title: 'Knopf',
    rows: [
      '.###.',
      '#####',
      '##.##',
      '#####',
      '.###.',
    ],
  },
  {
    id: 'kleeblume', title: 'Blümchen',
    rows: [
      '.#.#.',
      '#####',
      '.###.',
      '#####',
      '.#.#.',
    ],
  },
  {
    id: 'fenster', title: 'Fenster',
    rows: [
      '##.##',
      '##.##',
      '.....',
      '##.##',
      '##.##',
    ],
  },
  {
    id: 'schiffchen', title: 'Schiffchen',
    rows: [
      '..#...',
      '..##..',
      '..###.',
      '######',
      '.####.',
    ],
  },
  {
    id: 'stufen', title: 'Treppchen',
    rows: [
      '##....',
      '###...',
      '####..',
      '#####.',
      '######',
    ],
  },
  {
    id: 'laterne', title: 'Laterne',
    rows: [
      '..#..',
      '.###.',
      '#####',
      '.###.',
      '#####',
      '.###.',
    ],
  },
  {
    id: 'herzchen', title: 'Herzchen',
    rows: [
      '.##.##.',
      '#######',
      '#######',
      '.#####.',
      '..###..',
      '...#...',
    ],
  },
  {
    id: 'quadrat', title: 'Kissen',
    rows: [
      '.####.',
      '######',
      '######',
      '######',
      '.####.',
    ],
  },
  {
    id: 'dreieck', title: 'Pyramide',
    rows: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '#######',
    ],
  },
  {
    id: 'kleeblatt', title: 'Kleeblatt',
    rows: [
      '.##.##.',
      '###.###',
      '.#####.',
      '..###..',
      '.#####.',
      '###.###',
      '.##.##.',
    ],
  },
  {
    id: 'wolke', title: 'Wolke',
    rows: [
      '..##...',
      '.####..',
      '.#####.',
      '#######',
      '#######',
      '.#####.',
    ],
  },
  // ---------- mittlere und grosse Formen ----------
  {
    id: 'herz', title: 'Herz',
    rows: [
      '.##.##.',
      '#######',
      '#######',
      '#######',
      '.#####.',
      '..###..',
      '...#...',
    ],
  },
  {
    id: 'raute', title: 'Raute',
    rows: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '.#####.',
      '..###..',
      '...#...',
    ],
  },
  {
    id: 'kreis', title: 'Mond',
    rows: [
      '..###..',
      '.#####.',
      '#######',
      '#######',
      '#######',
      '.#####.',
      '..###..',
    ],
  },
  {
    id: 'ring', title: 'Kranz',
    rows: [
      '..###..',
      '.#####.',
      '##...##',
      '##...##',
      '##...##',
      '.#####.',
      '..###..',
    ],
  },
  {
    id: 'blume', title: 'Blume',
    rows: [
      '..###..',
      '.##.##.',
      '###.###',
      '#######',
      '###.###',
      '.##.##.',
      '..###..',
    ],
  },
  {
    id: 'spirale', title: 'Spirale',
    rows: [
      '#######',
      '......#',
      '#####.#',
      '#...#.#',
      '#.###.#',
      '#.....#',
      '#######',
    ],
  },
  {
    id: 'gitter', title: 'Gitter',
    rows: [
      '#######',
      '#.#.#.#',
      '#######',
      '#.#.#.#',
      '#######',
      '#.#.#.#',
      '#######',
    ],
  },
  {
    id: 'kreuz', title: 'Kreuz',
    rows: [
      '..###..',
      '..###..',
      '#######',
      '#######',
      '#######',
      '..###..',
      '..###..',
    ],
  },
  {
    id: 'stern', title: 'Stern',
    rows: [
      '...#...',
      '..###..',
      '#######',
      '.#####.',
      '..###..',
      '.##.##.',
      '##...##',
    ],
  },
  {
    id: 'schmetterling', title: 'Schmetterling',
    rows: [
      '##...##',
      '###.###',
      '#######',
      '.#####.',
      '#######',
      '###.###',
      '##...##',
    ],
  },
  {
    id: 'tanne', title: 'Tanne',
    rows: [
      '...#...',
      '..###..',
      '.#####.',
      '..###..',
      '.#####.',
      '#######',
      '..###..',
      '..###..',
    ],
  },
  {
    id: 'pilz', title: 'Pilz',
    rows: [
      '..###..',
      '.#####.',
      '#######',
      '#######',
      '..###..',
      '..###..',
      '.#####.',
    ],
  },
  {
    id: 'haus', title: 'Häuschen',
    rows: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '##.#.##',
      '##.#.##',
      '#######',
    ],
  },
  {
    id: 'katze', title: 'Katze',
    rows: [
      '#.....#',
      '##...##',
      '#######',
      '#.###.#',
      '#######',
      '.#####.',
      '..###..',
    ],
  },
  {
    id: 'sanduhr', title: 'Sanduhr',
    rows: [
      '#######',
      '.#####.',
      '..###..',
      '...#...',
      '..###..',
      '.#####.',
      '#######',
    ],
  },
  {
    id: 'schleife', title: 'Schleife',
    rows: [
      '#.....#',
      '##...##',
      '###.###',
      '#######',
      '###.###',
      '##...##',
      '#.....#',
    ],
  },
  {
    id: 'krone', title: 'Krone',
    rows: [
      '#..#..#',
      '##.#.##',
      '#######',
      '#######',
      '#######',
      '.#####.',
    ],
  },
  {
    id: 'bogen', title: 'Torbogen',
    rows: [
      '.#####.',
      '#######',
      '##...##',
      '##...##',
      '##...##',
      '##...##',
    ],
  },
  {
    id: 'welle', title: 'Welle',
    rows: [
      '##.....',
      '###....',
      '.###...',
      '..###..',
      '...###.',
      '....###',
      '.....##',
    ],
  },
  {
    id: 'turm', title: 'Turm',
    rows: [
      '#.#.#.#',
      '#######',
      '.#####.',
      '.#####.',
      '.#####.',
      '.#####.',
      '#######',
    ],
  },
  {
    id: 'tasse', title: 'Tasse',
    rows: [
      '.#.#...',
      '.......',
      '#####..',
      '#######',
      '#####.#',
      '######.',
      '.###...',
    ],
  },
  {
    id: 'blatt', title: 'Blatt',
    rows: [
      '....###',
      '..#####',
      '.######',
      '#######',
      '######.',
      '#####..',
      '###....',
    ],
  },
  {
    id: 'brille', title: 'Brille',
    rows: [
      '.##.##.',
      '#######',
      '##.#.##',
      '#######',
      '.##.##.',
    ],
  },
];

export function shapeById(id) {
  return shapes.find((s) => s.id === id) || null;
}
