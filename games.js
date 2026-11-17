// Spiele-Katalog von Spielpause.
// Ein neues Spiel hinzufügen:
//   1. Ordner /<id>/ mit index.html anlegen (Gerüst siehe DEV.md)
//   2. Kachel-Icon /icons/games/<id>.svg (quadratisch, ohne Text)
//   3. Eintrag hier ergänzen – fertig. Die Startseite zeigt es automatisch.
//
// Felder:
//   id        Ordnername, eindeutig
//   title     Name des Spiels (kurz!)
//   tile      optional: Name auf der Kachel mit weichen Trennstellen (\u00AD)
//   title_en, subtitle_en, tile_en   englische Fassung (Pflicht für neue Spiele)
//   subtitle  Ein Satz, worum es geht
//   category  eine der KATEGORIEN unten
//   color     Akzentfarbe des Spiels
//   daily     true, wenn das Spiel ein Tagesrätsel unter "<id>/#daily" anbietet
//   added     Datum (JJJJ-MM-TT), an dem das Spiel dazukam – zeigt 14 Tage lang «Neu»

export const categories = [
  { id: 'kreativ', title: 'Kreativ & Malen', title_en: 'Creative & Coloring' },
  { id: 'logik', title: 'Logikrätsel', title_en: 'Logic Puzzles' },
  { id: 'zahlen', title: 'Zahlen', title_en: 'Numbers' },
  { id: 'karten', title: 'Karten & Patience', title_en: 'Cards & Solitaire' },
  { id: 'steine', title: 'Mahjong & Steine', title_en: 'Mahjong & Tiles' },
  { id: 'brett', title: 'Brettspiele', title_en: 'Board Games' },
  { id: 'woerter', title: 'Wörter', title_en: 'Words' },
  { id: 'sortieren', title: 'Sortieren & Ordnen', title_en: 'Sorting' },
  { id: 'action', title: 'Kombinieren', title_en: 'Match & Combine' },
  { id: 'gedaechtnis', title: 'Gedächtnis & Wissen', title_en: 'Memory & Trivia' },
  { id: 'retro', title: 'Retro-Ecke', title_en: 'Retro Corner' },
];

export const games = [
  { id: 'paint', title: 'Farbenzauber', tile: 'Farben\u00ADzauber', subtitle: 'Malen nach Zahlen', title_en: 'Color Magic', subtitle_en: 'Color by number', category: 'kreativ', color: '#ff6f7d', added: '2026-11-17' },
  { id: 'beads', title: 'Perlenbild', tile: 'Perlen\u00ADbild', subtitle: 'Steine sortieren, Bild legen', title_en: 'Bead Art', subtitle_en: 'Sort gems, build a picture', category: 'kreativ', color: '#3f8ef0', added: '2026-11-17' },
  { id: 'cube', title: 'Pfeilwürfel', tile: 'Pfeil\u00ADwürfel', subtitle: '3D-Pfeilrätsel', title_en: 'Arrow Cube', subtitle_en: '3D arrow puzzle', category: 'logik', color: '#f29a1f', added: '2026-11-17' },
  { id: 'solitaire', title: 'Solitär', subtitle: 'Klondike, Spider & FreeCell', title_en: 'Solitaire', subtitle_en: 'Klondike, Spider & FreeCell', category: 'karten', color: '#2f9e6e', daily: true, added: '2026-11-17' },
  { id: 'mahjong', title: 'Mahjong', subtitle: 'Gleiche Steine paarweise abräumen', title_en: 'Mahjong', subtitle_en: 'Match free tiles in pairs', category: 'steine', color: '#c0573e', daily: true, added: '2026-11-17' },
  { id: 'triple', title: 'Dreierlei', subtitle: 'Drei Gleiche sammeln', title_en: 'Triple Tiles', subtitle_en: 'Collect three of a kind', category: 'steine', color: '#8a63d2', added: '2026-11-17' },
  { id: 'sudoku', title: 'Sudoku', subtitle: 'Zahlen 1–9 logisch einsetzen', title_en: 'Sudoku', subtitle_en: 'Place 1–9 with logic', category: 'zahlen', color: '#4a7bd0', daily: true, added: '2026-11-17' },
  { id: 'nonogram', title: 'Bilderrätsel', tile: 'Bilder\u00ADrätsel', subtitle: 'Zahlen lösen, Bild entdecken', title_en: 'Picture Logic', subtitle_en: 'Solve the clues, reveal a picture', category: 'logik', color: '#e0699a', daily: true, added: '2026-11-17' },
  { id: 'sort', title: 'Farbfluss', subtitle: 'Farben in Gläser sortieren', title_en: 'Color Flow', subtitle_en: 'Sort colors into glasses', category: 'sortieren', color: '#2bb3c0', daily: true, added: '2026-11-17' },
  { id: 'blocks', title: 'Blockpuzzle', tile: 'Block\u00ADpuzzle', subtitle: 'Reihen füllen und abräumen', title_en: 'Block Puzzle', subtitle_en: 'Fill rows and clear them', category: 'action', color: '#f0a020', added: '2026-11-17' },
  { id: 'merge', title: 'Verdoppeln', tile: 'Verdop\u00ADpeln', subtitle: 'Gleiche Kacheln verschmelzen', title_en: 'Double Up', subtitle_en: 'Merge matching tiles', category: 'zahlen', color: '#e2795a', added: '2026-11-17' },
  { id: 'wordsearch', title: 'Wortsuche', tile: 'Wort\u00ADsuche', subtitle: 'Versteckte Wörter finden', title_en: 'Word Search', subtitle_en: 'Find the hidden words', category: 'woerter', color: '#5a9e3c', daily: true, added: '2026-11-17' },
  { id: 'wordle', title: 'Wortrate', subtitle: 'Das Wort in sechs Versuchen', title_en: 'Word Guess', subtitle_en: 'The word in six tries', category: 'woerter', color: '#d9a21b', daily: true, added: '2026-11-17' },
  { id: 'match3', title: 'Juwelen', subtitle: 'Drei in einer Reihe', title_en: 'Jewels', subtitle_en: 'Three in a row', category: 'action', color: '#d0447c', added: '2026-11-17' },
  { id: 'bubbles', title: 'Blasenzauber', tile: 'Blasen\u00ADzauber', subtitle: 'Seifenblasen abschiessen', title_en: 'Bubble Magic', subtitle_en: 'Aim and pop the bubbles', category: 'action', color: '#4fa3e3', added: '2026-11-17' },
  { id: 'jigsaw', title: 'Puzzle', subtitle: 'Bilder Teil für Teil', title_en: 'Jigsaw', subtitle_en: 'Pictures piece by piece', category: 'kreativ', color: '#9a6b4f', added: '2026-11-17' },
  { id: 'vierer', title: 'Vier in einer Reihe', title_en: 'Four in a Row', tile: 'Vier in\u00A0einer Reihe', tile_en: 'Four in\u00A0a Row', subtitle: 'Vier Steine in einer Linie', subtitle_en: 'Four matching discs in a line', category: 'brett', color: '#2f7de1', added: '2026-11-17' },
  { id: 'reversi', title: 'Reversi', subtitle: 'Steine einschliessen und umdrehen', subtitle_en: 'Trap discs and flip them', category: 'brett', color: '#1f8a4c', added: '2026-11-17' },
  { id: 'kalaha', title: 'Kalaha', subtitle: 'Samen säen, Vorrat füllen', subtitle_en: 'Sow seeds and fill your store', category: 'brett', color: '#c4843a', added: '2026-11-17' },
  { id: 'gomoku', title: 'Fünf in einer Reihe', title_en: 'Five in a Row', tile: 'Fünf in\u00A0einer Reihe', tile_en: 'Five in\u00A0a Row', subtitle: 'Fünf Steine in einer Linie', subtitle_en: 'Five stones in a line', category: 'brett', color: '#8a5a2b', added: '2026-11-17' },
  { id: 'dame', title: 'Dame', title_en: 'Draughts', subtitle: 'Schlagen, bis die Dame fliegt', subtitle_en: 'Jump until the king flies', category: 'brett', color: '#c45c26', added: '2026-11-17' },
  { id: 'muehle', title: 'Mühle', title_en: 'Nine Men’s Morris', tile_en: 'Nine Men’s\u00A0Morris', subtitle: 'Drei in einer Linie, Stein weg', subtitle_en: 'Three in a row, take a stone', category: 'brett', color: '#8b5a2b', added: '2026-11-17' },
  { id: 'eile', title: 'Eile mit Weile', title_en: 'Ludo', tile: 'Eile mit\u00A0Weile', tile_en: 'Ludo', subtitle: 'Kurze Runde, vier Farben', subtitle_en: 'A short race, four colours', category: 'brett', color: '#e23d4a', added: '2026-11-17' },
  { id: 'schiffe', title: 'Schiffe versenken', title_en: 'Battleship', tile: 'Schiffe\u00A0versenken', tile_en: 'Battleship', subtitle: 'Flotte setzen, Treffer suchen', subtitle_en: 'Place a fleet, hunt the hits', category: 'brett', color: '#1f7aa8', added: '2026-11-17' },
  { id: 'schach', title: 'Schach', title_en: 'Chess', subtitle: 'Weiss gegen den Computer', subtitle_en: 'White against the computer', category: 'brett', color: '#4a5568', added: '2026-11-17' },
  { id: 'backgammon', title: 'Backgammon', tile: 'Backgammon', subtitle: 'Würfeln, ziehen, abtragen', subtitle_en: 'Roll, move, bear off', category: 'brett', color: '#9a3b2f', added: '2026-11-17' },
  { id: 'wortkreis', title: 'Wortkreis', title_en: 'Word Wheel', tile: 'Wortkreis', tile_en: 'Word Wheel', subtitle: 'Wörter aus dem Buchstabenrad', subtitle_en: 'Words from the letter wheel', category: 'woerter', color: '#7a4dd6', added: '2026-11-17' },
  { id: 'wabenwort', title: 'Wabenwort', title_en: 'Honeycomb', tile: 'Wabenwort', tile_en: 'Honeycomb', subtitle: 'Sieben Buchstaben, die Mitte muss rein', subtitle_en: 'Seven letters, the centre is required', category: 'woerter', color: '#e6a317', added: '2026-11-17' },
  { id: 'jagd', title: 'Buchstabenjagd', title_en: 'Letter Hunt', tile: 'Buchstaben\u00ADjagd', tile_en: 'Letter Hunt', subtitle: 'Den Begriff Buchstabe für Buchstabe', subtitle_en: 'The word, one letter at a time', category: 'woerter', color: '#e05a8a', added: '2026-11-17' },
  { id: 'anagramm', title: 'Anagramm', title_en: 'Anagram', subtitle: 'Buchstaben in die richtige Reihe', subtitle_en: 'Put the letters in the right order', category: 'woerter', color: '#d4564e', added: '2026-11-17' },
  { id: 'wortleiter', title: 'Wortleiter', title_en: 'Word Ladder', tile: 'Wortleiter', tile_en: 'Word Ladder', subtitle: 'Ein Buchstabe pro Stufe', subtitle_en: 'One letter each rung', category: 'woerter', color: '#2a9d8f', added: '2026-11-17' },
  { id: 'geheim', title: 'Geheimschrift', title_en: 'Secret Script', tile: 'Geheim\u00ADschrift', tile_en: 'Secret Script', subtitle: 'Jeden Buchstaben zurücksetzen', subtitle_en: 'Put every letter back', category: 'woerter', color: '#5b6b8c', added: '2026-11-17' },
  { id: 'wortwirbel', title: 'Wortwirbel', title_en: 'Word Swirl', tile: 'Wortwirbel', tile_en: 'Word Swirl', subtitle: 'Wörter im Buchstabenfeld', subtitle_en: 'Words in the letter grid', category: 'woerter', color: '#3c8d4e', added: '2026-11-17' },
  { id: 'kreuzwort', title: 'Kreuzworträtsel', title_en: 'Mini Crossword', tile: 'Kreuzwort\u00ADrätsel', tile_en: 'Mini\u00A0Crossword', subtitle: 'Kleines Gitter, eigene Rätsel', subtitle_en: 'A small grid, its own puzzles', category: 'woerter', color: '#3a6ea5', added: '2026-11-17' },
  { id: 'emoji', title: 'Emoji-Rätsel', title_en: 'Emoji Riddle', tile: 'Emoji-Rätsel', tile_en: 'Emoji Riddle', subtitle: 'Bilder erraten, Buchstaben tippen', subtitle_en: 'Guess the picture, tap the letters', category: 'woerter', color: '#f0a020', added: '2026-11-17' },
  { id: 'minen', title: 'Minensucher', title_en: 'Minesweeper', tile: 'Minen\u00ADsucher', tile_en: 'Minesweeper', subtitle: 'Zahlen lesen, Minen meiden', subtitle_en: 'Read the numbers, avoid the mines', category: 'logik', color: '#3d7a4a', added: '2026-11-17' },
  { id: 'bruecken', title: 'Brücken', title_en: 'Bridges', tile: 'Brücken', tile_en: 'Bridges', subtitle: 'Inseln verbinden, ohne Kreuzung', subtitle_en: 'Join the islands, no crossings', category: 'logik', color: '#1f7aa8', added: '2026-11-17' },
  { id: 'binaer', title: 'Binärrätsel', title_en: 'Binary', tile: 'Binär\u00ADrätsel', tile_en: 'Binary', subtitle: 'Nullen und Einsen, gleich viele', subtitle_en: 'Zeros and ones, the same count', category: 'logik', color: '#4a6fa5', added: '2026-11-17' },
  { id: 'lichter', title: 'Lichter aus', title_en: 'Lights Out', tile: 'Lichter aus', tile_en: 'Lights Out', subtitle: 'Tippen löscht das Licht und die Nachbarn', subtitle_en: 'A tap flips a light and its neighbours', category: 'logik', color: '#e6a317', added: '2026-11-17' },
  { id: 'futoshiki', title: 'Grösser-Kleiner', title_en: 'Futoshiki', tile: 'Grösser-\u00ADKleiner', tile_en: 'Futoshiki', subtitle: 'Zahlen mit Zeichen dazwischen', subtitle_en: 'Numbers with signs between them', category: 'logik', color: '#6a4cc4', added: '2026-11-17' },
  { id: 'frucht', title: 'Früchte-Fusion', title_en: 'Fruit Merge', tile: 'Früchte-\u00ADFusion', tile_en: 'Fruit Merge', subtitle: 'Fallen lassen und verschmelzen', subtitle_en: 'Drop them and let them fuse', category: 'action', color: '#e25b4a', added: '2026-11-17' },
  { id: 'kette', title: 'Kugelkette', title_en: 'Ball Chain', tile: 'Kugelkette', tile_en: 'Ball Chain', subtitle: 'Drei gleiche Kugeln weg tippen', subtitle_en: 'Tap three matching balls', category: 'action', color: '#4fa3e3', added: '2026-11-17' },
  { id: 'farbklick', title: 'Farbklicker', title_en: 'Color Flood', tile: 'Farb\u00ADklicker', tile_en: 'Color Flood', subtitle: 'Die Ecke frisst die Farbe', subtitle_en: 'The corner swallows the colour', category: 'action', color: '#d0447c', added: '2026-11-17' },
  { id: 'farbkugel', title: 'Farbkugeln', title_en: 'Color Lines', tile: 'Farbkugeln', tile_en: 'Color Lines', subtitle: 'Fünf in einer Reihe räumen', subtitle_en: 'Clear five in a row', category: 'action', color: '#8a63d2', added: '2026-11-17' },
  { id: 'schlange', title: 'Schlängel', title_en: 'Snake', tile: 'Schlängel', tile_en: 'Snake', subtitle: 'Tippe die Richtung, sammle Futter', subtitle_en: 'Tap a direction, gather food', category: 'action', color: '#3c8d4e', added: '2026-11-17' },
  { id: 'mauer', title: 'Mauerbrecher', title_en: 'Brick Break', tile: 'Mauer\u00ADbrecher', tile_en: 'Brick Break', subtitle: 'Schläger ziehen, Steine treffen', subtitle_en: 'Drag the paddle, hit the bricks', category: 'action', color: '#c45c26', added: '2026-11-17' },
  { id: 'turm', title: 'Turmbau', title_en: 'Tower', tile: 'Turmbau', tile_en: 'Tower', subtitle: 'Tippe, der Block fällt', subtitle_en: 'Tap, the block drops', category: 'action', color: '#c4843a', added: '2026-11-17' },
  { id: 'bloecke', title: 'Fallende Blöcke', title_en: 'Falling Blocks', tile: 'Fallende\u00A0Blöcke', tile_en: 'Falling\u00A0Blocks', subtitle: 'Schieben, drehen, Reihen leeren', subtitle_en: 'Slide, turn, clear the rows', category: 'action', color: '#2f7de1', added: '2026-11-17' },
  { id: 'sterne', title: 'Sternenhimmel', title_en: 'Star Battle', tile: 'Sternenhimmel', tile_en: 'Star Battle', subtitle: 'Ein Stern pro Zeile, Spalte und Gebiet', subtitle_en: 'One star per row, column and region', category: 'logik', color: '#2c3e73', added: '2026-11-17' },
  { id: 'zelte', title: 'Zelte & Bäume', title_en: 'Tents & Trees', tile: 'Zelte & Bäume', tile_en: 'Tents & Trees', subtitle: 'Neben jedem Baum steht ein Zelt', subtitle_en: 'One tent beside every tree', category: 'logik', color: '#3f8f4a', added: '2026-11-17' },
  { id: 'hochhaus', title: 'Hochhäuser', title_en: 'Skyscrapers', tile: 'Hochhäuser', tile_en: 'Skyscrapers', subtitle: 'Wie viele Häuser siehst du?', subtitle_en: 'How many buildings do you see?', category: 'logik', color: '#5c6bc0', added: '2026-11-17' },
  { id: 'inseln', title: 'Inseln', title_en: 'Islands', tile: 'Inseln', tile_en: 'Islands', subtitle: 'Die Zahl ist eine Insel dieser Grösse', subtitle_en: 'The number is an island of that size', category: 'logik', color: '#1f8f86', added: '2026-11-17' },
  { id: 'rundweg', title: 'Rundweg', title_en: 'Loop', tile: 'Rundweg', tile_en: 'Loop', subtitle: 'Eine Schlaufe, die Zahlen zählen die Kanten', subtitle_en: 'One loop, the numbers count the edges', category: 'logik', color: '#7b5ea7', added: '2026-11-17' },
  { id: 'riesen', title: 'Riesenjagd', title_en: 'Giant Hunt', tile: 'Riesen\u00ADjagd', tile_en: 'Giant Hunt', subtitle: 'Schiff gegen riesige Mechs', subtitle_en: 'A ship against giant mechs', category: 'retro', color: '#e23d8a', added: '2026-11-17' },
  { id: 'ausweichen', title: 'Ausweichen', title_en: 'Dodge', tile: 'Aus\u00ADweichen', tile_en: 'Dodge', subtitle: 'Halt durch, bis der Riese müde ist', subtitle_en: 'Last until the giant tires', category: 'retro', color: '#14b8c7', added: '2026-11-17' },
];

/** Titel/Untertitel/Kachelname in der aktuellen Sprache */
export function gameText(g, lang) {
  const en = lang === 'en';
  return {
    title: (en && g.title_en) || g.title,
    subtitle: (en && g.subtitle_en) || g.subtitle,
    tile: (en && (g.tile_en || g.title_en)) || g.tile || g.title,
  };
}

export function gameById(id) {
  return games.find((g) => g.id === id) || null;
}
