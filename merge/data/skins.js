// Kachel-Stile für «Verdoppeln».
//
// Jeder Stil ist eine Reihe von Kacheln «von klein nach gross».
// Kachel Nr. 1 ist die 2, Nr. 2 die 4, Nr. 3 die 8 … (jede Stufe verdoppelt den Wert).
// Wie man einen neuen Stil hinzufügt, steht in /merge/CONTENT.md.
//
// Felder eines Stils:
//   id      eindeutig, [a-z0-9-]
//   title   Anzeigename (deutsch, kurz)
//   icon    ein Emoji für die Auswahl
//   board   Farbe des Spielbretts
//   slot    Farbe der leeren Felder
//   ink     Schriftfarbe der kleinen Wert-Zahl auf den Kacheln
//   dark    optional true: dunkles Brett (Schrift im Menü wird hell)
//   numbers optional true: statt Bildern wird die Zahl gross gezeigt
//   tiles   [{ emoji, name, color, ink? }]  – mindestens 12 Kacheln
//            emoji: Bild der Kachel (bei numbers-Stilen leer lassen)
//            name:  deutscher Name (für das Album; bei numbers-Stilen weglassen)
//            color: Hintergrundfarbe der Kachel
//            ink:   optional eigene Schriftfarbe für diese Kachel
//
// Gibt es höhere Kacheln als Einträge, wird die letzte Kachel mit Glitzer wiederholt.

export const skins = [
  {
    id: 'zahlen',
    title: 'Zahlen',
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
    icon: '🍓',
    board: '#ecdcc8',
    slot: '#f6ece0',
    ink: '#6b5442',
    tiles: [
      { emoji: '🫐', name: 'Heidelbeere', color: '#e4e3fa' },
      { emoji: '🍒', name: 'Kirsche', color: '#ffe0e5' },
      { emoji: '🍓', name: 'Erdbeere', color: '#ffd5d3' },
      { emoji: '🥝', name: 'Kiwi', color: '#e2f2cf' },
      { emoji: '🍋', name: 'Zitrone', color: '#fff2bf' },
      { emoji: '🍑', name: 'Pfirsich', color: '#ffe0cb' },
      { emoji: '🍎', name: 'Apfel', color: '#ffd2cd' },
      { emoji: '🍐', name: 'Birne', color: '#edf4c6' },
      { emoji: '🍊', name: 'Orange', color: '#ffdfba' },
      { emoji: '🥭', name: 'Mango', color: '#ffe8ad' },
      { emoji: '🍇', name: 'Trauben', color: '#e9dbf7' },
      { emoji: '🥥', name: 'Kokosnuss', color: '#efe3d5' },
      { emoji: '🍍', name: 'Ananas', color: '#fff0b5' },
      { emoji: '🍈', name: 'Melone', color: '#e5f3cd' },
      { emoji: '🍉', name: 'Wassermelone', color: '#ffd8de' },
      { emoji: '🎃', name: 'Riesenkürbis', color: '#ffdbb5' },
    ],
  },
  {
    id: 'tiere',
    title: 'Tiere',
    icon: '🐱',
    board: '#e5dccb',
    slot: '#f3ede2',
    ink: '#6b5442',
    tiles: [
      { emoji: '🐞', name: 'Marienkäfer', color: '#ffdfdb' },
      { emoji: '🐝', name: 'Biene', color: '#fff0bf' },
      { emoji: '🦋', name: 'Schmetterling', color: '#dee9ff' },
      { emoji: '🐭', name: 'Maus', color: '#ebebf3' },
      { emoji: '🐹', name: 'Hamster', color: '#fbe5cd' },
      { emoji: '🐰', name: 'Häschen', color: '#f6e6f0' },
      { emoji: '🐱', name: 'Kätzchen', color: '#fff0cf' },
      { emoji: '🦊', name: 'Fuchs', color: '#ffdbc2' },
      { emoji: '🐶', name: 'Hund', color: '#f1e2d2' },
      { emoji: '🐼', name: 'Panda', color: '#e5edf0' },
      { emoji: '🦁', name: 'Löwe', color: '#ffe6b5' },
      { emoji: '🐻', name: 'Bär', color: '#ecdbcb' },
      { emoji: '🦒', name: 'Giraffe', color: '#fff0c6' },
      { emoji: '🐘', name: 'Elefant', color: '#e1e7ef' },
      { emoji: '🐳', name: 'Wal', color: '#d6ebfb' },
    ],
  },
  {
    id: 'suesses',
    title: 'Süsses',
    icon: '🧁',
    board: '#efd9d6',
    slot: '#f9ecea',
    ink: '#7a4f55',
    tiles: [
      { emoji: '🍬', name: 'Bonbon', color: '#ffdff0' },
      { emoji: '🍭', name: 'Lutscher', color: '#f6dfff' },
      { emoji: '🍪', name: 'Guetzli', color: '#f5e3ca' },
      { emoji: '🍩', name: 'Donut', color: '#ffd8e6' },
      { emoji: '🧁', name: 'Cupcake', color: '#e7dfff' },
      { emoji: '🍫', name: 'Schoggi', color: '#eedbcb' },
      { emoji: '🧇', name: 'Waffel', color: '#fbe7c1' },
      { emoji: '🥞', name: 'Pfannkuchen', color: '#fdeccb' },
      { emoji: '🍮', name: 'Caramelköpfli', color: '#fff0c2' },
      { emoji: '🍯', name: 'Honigtopf', color: '#ffe6a8' },
      { emoji: '🍦', name: 'Softglace', color: '#fcecdf' },
      { emoji: '🍨', name: 'Coupe', color: '#e3efff' },
      { emoji: '🥧', name: 'Wähe', color: '#f8e1c6' },
      { emoji: '🍰', name: 'Tortenstück', color: '#ffe2e7' },
      { emoji: '🎂', name: 'Geburtstagstorte', color: '#fcdff0' },
    ],
  },
  {
    id: 'blumen',
    title: 'Blumen',
    icon: '🌷',
    board: '#d9e4cf',
    slot: '#ebf2e4',
    ink: '#4f6143',
    tiles: [
      { emoji: '🌱', name: 'Keimling', color: '#e3f5d4' },
      { emoji: '🍀', name: 'Kleeblatt', color: '#d9f1d2' },
      { emoji: '🌼', name: 'Gänseblümchen', color: '#fff5c9' },
      { emoji: '🌸', name: 'Kirschblüte', color: '#ffe2ee' },
      { emoji: '🌷', name: 'Tulpe', color: '#ffdce6' },
      { emoji: '🌹', name: 'Rose', color: '#ffd4da' },
      { emoji: '🌺', name: 'Hibiskus', color: '#ffd9d2' },
      { emoji: '🌻', name: 'Sonnenblume', color: '#fff0bd' },
      { emoji: '🪷', name: 'Lotusblüte', color: '#fbdff0' },
      { emoji: '💐', name: 'Blumenstrauss', color: '#f4e2fa' },
      { emoji: '🪴', name: 'Topfpflanze', color: '#e0f0da' },
      { emoji: '🌵', name: 'Kaktus', color: '#e2f2da' },
      { emoji: '🌴', name: 'Palme', color: '#ddf1ea' },
      { emoji: '🌳', name: 'Laubbaum', color: '#daeed0' },
      { emoji: '🌲', name: 'Tanne', color: '#d5ebd9' },
    ],
  },
  {
    id: 'weltall',
    title: 'Weltall',
    icon: '🪐',
    dark: true,
    board: '#2e2b5a',
    slot: '#3b3870',
    ink: '#ffffff',
    tiles: [
      { emoji: '✨', name: 'Sternenstaub', color: '#4a4790' },
      { emoji: '🪨', name: 'Gesteinsbrocken', color: '#535096' },
      { emoji: '☄️', name: 'Komet', color: '#5c50a0' },
      { emoji: '🌑', name: 'Neumond', color: '#4f5aa8' },
      { emoji: '🌓', name: 'Halbmond', color: '#5865b5' },
      { emoji: '🌕', name: 'Vollmond', color: '#6a6fc2' },
      { emoji: '🌍', name: 'Erde', color: '#4b7cc4' },
      { emoji: '🪐', name: 'Ringplanet', color: '#7a62c6' },
      { emoji: '☀️', name: 'Sonne', color: '#c4743f' },
      { emoji: '⭐', name: 'Stern', color: '#c3943a' },
      { emoji: '🌟', name: 'Riesenstern', color: '#d0a23a' },
      { emoji: '🌠', name: 'Sternschnuppe', color: '#975dc0' },
      { emoji: '💫', name: 'Sternwirbel', color: '#ad5bb0' },
      { emoji: '🌌', name: 'Milchstrasse', color: '#5e45a8' },
    ],
  },
  {
    id: 'meer',
    title: 'Meer',
    icon: '🐬',
    board: '#cbe2ec',
    slot: '#e2f0f6',
    ink: '#3d5d6e',
    tiles: [
      { emoji: '🫧', name: 'Bläschen', color: '#e8f5fb' },
      { emoji: '🐚', name: 'Muschel', color: '#fbe5de' },
      { emoji: '🦐', name: 'Crevette', color: '#ffdfd4' },
      { emoji: '🐟', name: 'Fischli', color: '#dbebfb' },
      { emoji: '🐠', name: 'Tropenfisch', color: '#fff0ca' },
      { emoji: '🐡', name: 'Kugelfisch', color: '#f3ebcf' },
      { emoji: '🦀', name: 'Krabbe', color: '#ffd7d0' },
      { emoji: '🦑', name: 'Tintenfisch', color: '#ffdfe8' },
      { emoji: '🐙', name: 'Krake', color: '#f5dbf0' },
      { emoji: '🐢', name: 'Schildkröte', color: '#ddf1da' },
      { emoji: '🦭', name: 'Robbe', color: '#e4e7ee' },
      { emoji: '🐬', name: 'Delfin', color: '#d3eafb' },
      { emoji: '🦈', name: 'Hai', color: '#dde6f0' },
      { emoji: '🐋', name: 'Blauwal', color: '#d0e1fa' },
      { emoji: '🏝️', name: 'Schatzinsel', color: '#fff0c6' },
    ],
  },
  {
    id: 'bauernhof',
    title: 'Bauernhof',
    icon: '🐄',
    board: '#e6d9bd',
    slot: '#f3ead5',
    ink: '#6a5634',
    tiles: [
      { emoji: '🥚', name: 'Ei', color: '#fff5e3' },
      { emoji: '🐣', name: 'Schlüpfling', color: '#fff1c4' },
      { emoji: '🐤', name: 'Küken', color: '#ffeeb0' },
      { emoji: '🐔', name: 'Huhn', color: '#ffe4da' },
      { emoji: '🦆', name: 'Ente', color: '#e0f0e4' },
      { emoji: '🐇', name: 'Kaninchen', color: '#f0ebe6' },
      { emoji: '🐈', name: 'Hofkatze', color: '#ffeacf' },
      { emoji: '🐑', name: 'Schaf', color: '#ebe7f1' },
      { emoji: '🐐', name: 'Geiss', color: '#eee4d6' },
      { emoji: '🐖', name: 'Schwein', color: '#ffdde5' },
      { emoji: '🐄', name: 'Kuh', color: '#e6edf3' },
      { emoji: '🐎', name: 'Pferd', color: '#efdeca' },
      { emoji: '🚜', name: 'Traktor', color: '#dff0d6' },
      { emoji: '🏡', name: 'Bauernhaus', color: '#ffeed4' },
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
