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
//   subtitle  Ein Satz, worum es geht
//   category  eine der KATEGORIEN unten
//   color     Akzentfarbe des Spiels
//   daily     true, wenn das Spiel ein Tagesrätsel unter "<id>/#daily" anbietet
//   added     Datum (JJJJ-MM-TT), an dem das Spiel dazukam – zeigt 14 Tage lang «Neu»

export const categories = [
  { id: 'kreativ', title: 'Kreativ' },
  { id: 'logik', title: 'Logik' },
  { id: 'karten', title: 'Karten & Steine' },
  { id: 'woerter', title: 'Wörter' },
  { id: 'action', title: 'Kombinieren' },
];

export const games = [
  { id: 'paint', title: 'Farbenzauber', tile: 'Farben\u00ADzauber', subtitle: 'Malen nach Zahlen', category: 'kreativ', color: '#ff6f7d', added: '2026-11-17' },
  { id: 'beads', title: 'Perlenbild', tile: 'Perlen\u00ADbild', subtitle: 'Steine sortieren, Bild legen', category: 'kreativ', color: '#3f8ef0', added: '2026-11-17' },
  { id: 'cube', title: 'Pfeilwürfel', tile: 'Pfeil\u00ADwürfel', subtitle: '3D-Pfeilrätsel', category: 'logik', color: '#f29a1f', added: '2026-11-17' },
  { id: 'solitaire', title: 'Solitär', subtitle: 'Klondike, Spider & FreeCell', category: 'karten', color: '#2f9e6e', daily: true, added: '2026-11-17' },
  { id: 'mahjong', title: 'Mahjong', subtitle: 'Gleiche Steine paarweise abräumen', category: 'karten', color: '#c0573e', daily: true, added: '2026-11-17' },
  { id: 'triple', title: 'Dreierlei', subtitle: 'Drei Gleiche sammeln', category: 'karten', color: '#8a63d2', added: '2026-11-17' },
  { id: 'sudoku', title: 'Sudoku', subtitle: 'Zahlen 1–9 logisch einsetzen', category: 'logik', color: '#4a7bd0', daily: true, added: '2026-11-17' },
  { id: 'nonogram', title: 'Bilderrätsel', tile: 'Bilder\u00ADrätsel', subtitle: 'Zahlen lösen, Bild entdecken', category: 'logik', color: '#e0699a', daily: true, added: '2026-11-17' },
  { id: 'sort', title: 'Farbfluss', subtitle: 'Farben in Gläser sortieren', category: 'logik', color: '#2bb3c0', daily: true, added: '2026-11-17' },
  { id: 'blocks', title: 'Blockpuzzle', tile: 'Block\u00ADpuzzle', subtitle: 'Reihen füllen und abräumen', category: 'logik', color: '#f0a020', added: '2026-11-17' },
  { id: 'merge', title: 'Verdoppeln', tile: 'Verdop\u00ADpeln', subtitle: 'Gleiche Kacheln verschmelzen', category: 'logik', color: '#e2795a', added: '2026-11-17' },
  { id: 'wordsearch', title: 'Wortsuche', tile: 'Wort\u00ADsuche', subtitle: 'Versteckte Wörter finden', category: 'woerter', color: '#5a9e3c', daily: true, added: '2026-11-17' },
  { id: 'wordle', title: 'Wortrate', subtitle: 'Das Wort in sechs Versuchen', category: 'woerter', color: '#d9a21b', daily: true, added: '2026-11-17' },
  { id: 'match3', title: 'Juwelen', subtitle: 'Drei in einer Reihe', category: 'action', color: '#d0447c', added: '2026-11-17' },
  { id: 'bubbles', title: 'Blasenzauber', tile: 'Blasen\u00ADzauber', subtitle: 'Seifenblasen abschiessen', category: 'action', color: '#4fa3e3', added: '2026-11-17' },
  { id: 'jigsaw', title: 'Puzzle', subtitle: 'Bilder Teil für Teil', category: 'kreativ', color: '#9a6b4f', added: '2026-11-17' },
];

export function gameById(id) {
  return games.find((g) => g.id === id) || null;
}
