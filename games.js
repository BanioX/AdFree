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
