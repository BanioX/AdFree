// Kachel-Stile für «Verdoppeln».
//
// Jeder Stil ist eine Reihe von Kacheln «von klein nach gross».
// Kachel Nr. 1 ist die 2, Nr. 2 die 4, Nr. 3 die 8 … (jede Stufe verdoppelt den Wert).
// Wie man einen neuen Stil hinzufügt, steht in /merge/CONTENT.md.
//
// Felder eines Stils:
//   id      eindeutig, [a-z0-9-]
//   title   Anzeigename (deutsch, kurz)
//   title_en  Anzeigename auf Englisch
//   icon    ein Emoji für die Auswahl
//   board   Farbe des Spielbretts
//   slot    Farbe der leeren Felder
//   ink     Schriftfarbe der kleinen Wert-Zahl auf den Kacheln
//   dark    optional true: dunkles Brett (Schrift im Menü wird hell)
//   numbers optional true: statt Bildern wird die Zahl gross gezeigt
//   tiles   [{ emoji, name, name_en, color, ink? }]  – mindestens 12 Kacheln
//            emoji: Bild der Kachel (bei numbers-Stilen leer lassen)
//            name:  deutscher Name (für das Album; bei numbers-Stilen weglassen)
//            name_en: englischer Name (Pflicht, wenn name gesetzt ist)
//            color: Hintergrundfarbe der Kachel
//            ink:   optional eigene Schriftfarbe für diese Kachel
//
// Gibt es höhere Kacheln als Einträge, wird die letzte Kachel mit Glitzer wiederholt.

export const skins = [
  {
    id: 'zahlen',
    title: 'Zahlen',
    title_en: 'Numbers',
    icon: '🔢',
    numbers: true,
    board: '#e6d7c6',
    slot: '#f2e8dc',
    ink: '#6b5442',
    tiles: [
      { color: '#fbf3e8', ink: '#8a6c55' },
      { color: '#f8e4c8', ink: '#8a6c55' },
      { color: '#f8b98a', ink: '#ffffff' },
      { color: '#f49f74', ink: '#ffffff' },
      { color: '#ef8370', ink: '#ffffff' },
      { color: '#e6657c', ink: '#ffffff' },
      { color: '#d873b1', ink: '#ffffff' },
      { color: '#b17dd9', ink: '#ffffff' },
      { color: '#8b88e6', ink: '#ffffff' },
      { color: '#5f9be6', ink: '#ffffff' },
      { color: '#3cb6c6', ink: '#ffffff' },
      { color: '#35b98b', ink: '#ffffff' },
      { color: '#86bd45', ink: '#ffffff' },
      { color: '#eeae2a', ink: '#ffffff' },
      { color: '#e8753d', ink: '#ffffff' },
      { color: '#4b3358', ink: '#ffffff' },
    ],
  },
  {
    id: 'fruechte',
    title: 'Früchte',
    title_en: 'Fruit',
    icon: '🍓',
    board: '#ecdcc8',
    slot: '#f6ece0',
    ink: '#6b5442',
    tiles: [
      { emoji: '🫐', name: 'Heidelbeere', name_en: 'Blueberry', color: '#e4e3fa' },
      { emoji: '🍒', name: 'Kirsche', name_en: 'Cherry', color: '#ffe0e5' },
      { emoji: '🍓', name: 'Erdbeere', name_en: 'Strawberry', color: '#ffd5d3' },
      { emoji: '🥝', name: 'Kiwi', name_en: 'Kiwi', color: '#e2f2cf' },
      { emoji: '🍋', name: 'Zitrone', name_en: 'Lemon', color: '#fff2bf' },
      { emoji: '🍑', name: 'Pfirsich', name_en: 'Peach', color: '#ffe0cb' },
      { emoji: '🍎', name: 'Apfel', name_en: 'Apple', color: '#ffd2cd' },
      { emoji: '🍐', name: 'Birne', name_en: 'Pear', color: '#edf4c6' },
      { emoji: '🍊', name: 'Orange', name_en: 'Orange', color: '#ffdfba' },
      { emoji: '🥭', name: 'Mango', name_en: 'Mango', color: '#ffe8ad' },
      { emoji: '🍇', name: 'Trauben', name_en: 'Grapes', color: '#e9dbf7' },
      { emoji: '🥥', name: 'Kokosnuss', name_en: 'Coconut', color: '#efe3d5' },
      { emoji: '🍍', name: 'Ananas', name_en: 'Pineapple', color: '#fff0b5' },
      { emoji: '🍈', name: 'Melone', name_en: 'Melon', color: '#e5f3cd' },
      { emoji: '🍉', name: 'Wassermelone', name_en: 'Watermelon', color: '#ffd8de' },
      { emoji: '🎃', name: 'Riesenkürbis', name_en: 'Giant pumpkin', color: '#ffdbb5' },
    ],
  },
  {
    id: 'tiere',
    title: 'Tiere',
    title_en: 'Animals',
    icon: '🐱',
    board: '#e5dccb',
    slot: '#f3ede2',
    ink: '#6b5442',
    tiles: [
      { emoji: '🐞', name: 'Marienkäfer', name_en: 'Ladybug', color: '#ffdfdb' },
      { emoji: '🐝', name: 'Biene', name_en: 'Bee', color: '#fff0bf' },
      { emoji: '🦋', name: 'Schmetterling', name_en: 'Butterfly', color: '#dee9ff' },
      { emoji: '🐭', name: 'Maus', name_en: 'Mouse', color: '#ebebf3' },
      { emoji: '🐹', name: 'Hamster', name_en: 'Hamster', color: '#fbe5cd' },
      { emoji: '🐰', name: 'Häschen', name_en: 'Bunny', color: '#f6e6f0' },
      { emoji: '🐱', name: 'Kätzchen', name_en: 'Kitten', color: '#fff0cf' },
      { emoji: '🦊', name: 'Fuchs', name_en: 'Fox', color: '#ffdbc2' },
      { emoji: '🐶', name: 'Hund', name_en: 'Dog', color: '#f1e2d2' },
      { emoji: '🐼', name: 'Panda', name_en: 'Panda', color: '#e5edf0' },
      { emoji: '🦁', name: 'Löwe', name_en: 'Lion', color: '#ffe6b5' },
      { emoji: '🐻', name: 'Bär', name_en: 'Bear', color: '#ecdbcb' },
      { emoji: '🦒', name: 'Giraffe', name_en: 'Giraffe', color: '#fff0c6' },
      { emoji: '🐘', name: 'Elefant', name_en: 'Elephant', color: '#e1e7ef' },
      { emoji: '🐳', name: 'Wal', name_en: 'Whale', color: '#d6ebfb' },
    ],
  },
  {
    id: 'suesses',
    title: 'Süsses',
    title_en: 'Sweets',
    icon: '🧁',
    board: '#efd9d6',
    slot: '#f9ecea',
    ink: '#7a4f55',
    tiles: [
      { emoji: '🍬', name: 'Bonbon', name_en: 'Candy', color: '#ffdff0' },
      { emoji: '🍭', name: 'Lutscher', name_en: 'Lollipop', color: '#f6dfff' },
      { emoji: '🍪', name: 'Guetzli', name_en: 'Cookie', color: '#f5e3ca' },
      { emoji: '🍩', name: 'Donut', name_en: 'Donut', color: '#ffd8e6' },
      { emoji: '🧁', name: 'Cupcake', name_en: 'Cupcake', color: '#e7dfff' },
      { emoji: '🍫', name: 'Schoggi', name_en: 'Chocolate', color: '#eedbcb' },
      { emoji: '🧇', name: 'Waffel', name_en: 'Waffle', color: '#fbe7c1' },
      { emoji: '🥞', name: 'Pfannkuchen', name_en: 'Pancakes', color: '#fdeccb' },
      { emoji: '🍮', name: 'Caramelköpfli', name_en: 'Caramel flan', color: '#fff0c2' },
      { emoji: '🍯', name: 'Honigtopf', name_en: 'Honey pot', color: '#ffe6a8' },
      { emoji: '🍦', name: 'Softglace', name_en: 'Soft serve', color: '#fcecdf' },
      { emoji: '🍨', name: 'Coupe', name_en: 'Sundae', color: '#e3efff' },
      { emoji: '🥧', name: 'Wähe', name_en: 'Pie', color: '#f8e1c6' },
      { emoji: '🍰', name: 'Tortenstück', name_en: 'Slice of cake', color: '#ffe2e7' },
      { emoji: '🎂', name: 'Geburtstagstorte', name_en: 'Birthday cake', color: '#fcdff0' },
    ],
  },
  {
    id: 'blumen',
    title: 'Blumen',
    title_en: 'Flowers',
    icon: '🌷',
    board: '#d9e4cf',
    slot: '#ebf2e4',
    ink: '#4f6143',
    tiles: [
      { emoji: '🌱', name: 'Keimling', name_en: 'Sprout', color: '#e3f5d4' },
      { emoji: '🍀', name: 'Kleeblatt', name_en: 'Lucky clover', color: '#d9f1d2' },
      { emoji: '🌼', name: 'Gänseblümchen', name_en: 'Daisy', color: '#fff5c9' },
      { emoji: '🌸', name: 'Kirschblüte', name_en: 'Cherry blossom', color: '#ffe2ee' },
      { emoji: '🌷', name: 'Tulpe', name_en: 'Tulip', color: '#ffdce6' },
      { emoji: '🌹', name: 'Rose', name_en: 'Rose', color: '#ffd4da' },
      { emoji: '🌺', name: 'Hibiskus', name_en: 'Hibiscus', color: '#ffd9d2' },
      { emoji: '🌻', name: 'Sonnenblume', name_en: 'Sunflower', color: '#fff0bd' },
      { emoji: '🪷', name: 'Lotusblüte', name_en: 'Lotus', color: '#fbdff0' },
      { emoji: '💐', name: 'Blumenstrauss', name_en: 'Bouquet', color: '#f4e2fa' },
      { emoji: '🪴', name: 'Topfpflanze', name_en: 'Potted plant', color: '#e0f0da' },
      { emoji: '🌵', name: 'Kaktus', name_en: 'Cactus', color: '#e2f2da' },
      { emoji: '🌴', name: 'Palme', name_en: 'Palm tree', color: '#ddf1ea' },
      { emoji: '🌳', name: 'Laubbaum', name_en: 'Leafy tree', color: '#daeed0' },
      { emoji: '🌲', name: 'Tanne', name_en: 'Fir tree', color: '#d5ebd9' },
    ],
  },
  {
    id: 'weltall',
    title: 'Weltall',
    title_en: 'Space',
    icon: '🪐',
    dark: true,
    board: '#2e2b5a',
    slot: '#3b3870',
    ink: '#ffffff',
    tiles: [
      { emoji: '✨', name: 'Sternenstaub', name_en: 'Stardust', color: '#4a4790' },
      { emoji: '🪨', name: 'Gesteinsbrocken', name_en: 'Space rock', color: '#535096' },
      { emoji: '☄️', name: 'Komet', name_en: 'Comet', color: '#5c50a0' },
      { emoji: '🌑', name: 'Neumond', name_en: 'New moon', color: '#4f5aa8' },
      { emoji: '🌓', name: 'Halbmond', name_en: 'Half moon', color: '#5865b5' },
      { emoji: '🌕', name: 'Vollmond', name_en: 'Full moon', color: '#6a6fc2' },
      { emoji: '🌍', name: 'Erde', name_en: 'Earth', color: '#4b7cc4' },
      { emoji: '🪐', name: 'Ringplanet', name_en: 'Ringed planet', color: '#7a62c6' },
      { emoji: '☀️', name: 'Sonne', name_en: 'Sun', color: '#c4743f' },
      { emoji: '⭐', name: 'Stern', name_en: 'Star', color: '#c3943a' },
      { emoji: '🌟', name: 'Riesenstern', name_en: 'Giant star', color: '#d0a23a' },
      { emoji: '🌠', name: 'Sternschnuppe', name_en: 'Shooting star', color: '#975dc0' },
      { emoji: '💫', name: 'Sternwirbel', name_en: 'Star swirl', color: '#ad5bb0' },
      { emoji: '🌌', name: 'Milchstrasse', name_en: 'Milky Way', color: '#5e45a8' },
    ],
  },
  {
    id: 'meer',
    title: 'Meer',
    title_en: 'Ocean',
    icon: '🐬',
    board: '#cbe2ec',
    slot: '#e2f0f6',
    ink: '#3d5d6e',
    tiles: [
      { emoji: '🫧', name: 'Bläschen', name_en: 'Bubbles', color: '#e8f5fb' },
      { emoji: '🐚', name: 'Muschel', name_en: 'Seashell', color: '#fbe5de' },
      { emoji: '🦐', name: 'Crevette', name_en: 'Shrimp', color: '#ffdfd4' },
      { emoji: '🐟', name: 'Fischli', name_en: 'Little fish', color: '#dbebfb' },
      { emoji: '🐠', name: 'Tropenfisch', name_en: 'Tropical fish', color: '#fff0ca' },
      { emoji: '🐡', name: 'Kugelfisch', name_en: 'Pufferfish', color: '#f3ebcf' },
      { emoji: '🦀', name: 'Krabbe', name_en: 'Crab', color: '#ffd7d0' },
      { emoji: '🦑', name: 'Tintenfisch', name_en: 'Squid', color: '#ffdfe8' },
      { emoji: '🐙', name: 'Krake', name_en: 'Octopus', color: '#f5dbf0' },
      { emoji: '🐢', name: 'Schildkröte', name_en: 'Turtle', color: '#ddf1da' },
      { emoji: '🦭', name: 'Robbe', name_en: 'Seal', color: '#e4e7ee' },
      { emoji: '🐬', name: 'Delfin', name_en: 'Dolphin', color: '#d3eafb' },
      { emoji: '🦈', name: 'Hai', name_en: 'Shark', color: '#dde6f0' },
      { emoji: '🐋', name: 'Blauwal', name_en: 'Blue whale', color: '#d0e1fa' },
      { emoji: '🏝️', name: 'Schatzinsel', name_en: 'Treasure island', color: '#fff0c6' },
    ],
  },
  {
    id: 'bauernhof',
    title: 'Bauernhof',
    title_en: 'Farm',
    icon: '🐄',
    board: '#e6d9bd',
    slot: '#f3ead5',
    ink: '#6a5634',
    tiles: [
      { emoji: '🥚', name: 'Ei', name_en: 'Egg', color: '#fff5e3' },
      { emoji: '🐣', name: 'Schlüpfling', name_en: 'Hatchling', color: '#fff1c4' },
      { emoji: '🐤', name: 'Küken', name_en: 'Chick', color: '#ffeeb0' },
      { emoji: '🐔', name: 'Huhn', name_en: 'Hen', color: '#ffe4da' },
      { emoji: '🦆', name: 'Ente', name_en: 'Duck', color: '#e0f0e4' },
      { emoji: '🐇', name: 'Kaninchen', name_en: 'Rabbit', color: '#f0ebe6' },
      { emoji: '🐈', name: 'Hofkatze', name_en: 'Barn cat', color: '#ffeacf' },
      { emoji: '🐑', name: 'Schaf', name_en: 'Sheep', color: '#ebe7f1' },
      { emoji: '🐐', name: 'Geiss', name_en: 'Goat', color: '#eee4d6' },
      { emoji: '🐖', name: 'Schwein', name_en: 'Pig', color: '#ffdde5' },
      { emoji: '🐄', name: 'Kuh', name_en: 'Cow', color: '#e6edf3' },
      { emoji: '🐎', name: 'Pferd', name_en: 'Horse', color: '#efdeca' },
      { emoji: '🚜', name: 'Traktor', name_en: 'Tractor', color: '#dff0d6' },
      { emoji: '🏡', name: 'Bauernhaus', name_en: 'Farmhouse', color: '#ffeed4' },
    ],
  },
];

export const DEFAULT_SKIN = 'fruechte';

export function skinById(id) {
  return skins.find((s) => s.id === id) || skins.find((s) => s.id === DEFAULT_SKIN) || skins[0];
}

/** Kachel-Darstellung für Stufe e (1 = 2). Über das Ende hinaus: letzte Kachel mit Glitzer. */
export function tileOf(skin, e) {
  const list = skin.tiles;
  const i = Math.max(0, e - 1);
  if (i < list.length) return { ...list[i], extra: 0 };
  return { ...list[list.length - 1], extra: i - list.length + 1 };
}
