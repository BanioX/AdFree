// Steinsätze für Mahjong.
//
// Jeder Satz hat genau 42 verschiedene Bilder:
//   faces  – 34 normale Bilder (jedes kommt 2× oder 4× vor, gleiche Bilder passen zusammen)
//   bonus  – zwei Gruppen mit je 4 Bildern. Innerhalb einer Gruppe passt JEDES Bild zu jedem
//            (wie Blumen und Jahreszeiten beim klassischen Mahjong). Sie bekommen einen
//            farbigen Rand, damit man sie erkennt.
//
// kind: 'drawn' = von Hand gezeichnet (faces.js), 'emoji' = Emoji als Bild.
// edge: Farbe der Steinrückseite, edgeDark: deren Schattenfarbe.
//
// Einen neuen Emoji-Satz hinzufügen: Objekt unten ergänzen (34 + 4 + 4 verschiedene Emoji,
// gut unterscheidbar, keine Doppelten) – fertig. Der Test tests/content.test.mjs prüft das.

export const tilesets = [
  {
    id: 'klassisch',
    name: 'Klassisch',
    kind: 'drawn',
    edge: '#2f8a73',
    edgeDark: '#1d5e4e',
    bonusNames: ['Blumen', 'Jahreszeiten'],
  },
  {
    id: 'garten',
    name: 'Garten',
    kind: 'emoji',
    edge: '#d26a4a',
    edgeDark: '#9c4630',
    faces: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒',
      '🍑', '🍍', '🥥', '🥝', '🥕', '🌽', '🥦', '🍆', '🥒', '🌶️',
      '🍄', '🥔', '🧅', '🧄', '🥑', '🐝', '🐞', '🦋', '🐌', '🐛',
      '🌵', '🌳', '🌰', '🐸',
    ],
    bonus: [
      ['🌷', '🌹', '🌻', '🌼'],
      ['🌱', '☀️', '🍁', '❄️'],
    ],
    bonusNames: ['Blüten', 'Jahreszeiten'],
  },
  {
    id: 'tiere',
    name: 'Tiere',
    kind: 'emoji',
    edge: '#d99a2b',
    edgeDark: '#a26f12',
    faces: [
      '🐶', '🐱', '🐞', '🦓', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦜', '🦉',
      '🐴', '🦄', '🐢', '🐍', '🐙', '🦀', '🐠', '🦋', '🐳', '🦒',
      '🐘', '🦔', '🦩', '🐿️',
    ],
    bonus: [
      ['🌸', '🌺', '🌼', '🌷'],
      ['🌱', '☀️', '🍂', '⛄'],
    ],
    bonusNames: ['Blüten', 'Jahreszeiten'],
  },
  {
    id: 'naschwerk',
    name: 'Naschwerk',
    kind: 'emoji',
    edge: '#c96b9a',
    edgeDark: '#93466f',
    faces: [
      '🍩', '🍪', '🧁', '🍰', '🍟', '🍫', '🍬', '🍭', '🍮', '🍯',
      '🍦', '🍗', '🥧', '🥐', '🥨', '🥞', '🧇', '🍿', '🍕', '🍔',
      '🌭', '🥪', '🌮', '🍣', '🍙', '🍤', '🥟', '🧀', '🥚', '🥗',
      '🍝', '🍜', '🍱', '🍡',
    ],
    bonus: [
      ['☕', '🍵', '🧃', '🥤'],
      ['🍓', '🍒', '🍑', '🍋'],
    ],
    bonusNames: ['Getränke', 'Früchte'],
  },
];

export function tilesetById(id) {
  return tilesets.find((t) => t.id === id) || tilesets[0];
}
