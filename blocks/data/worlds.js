// Welten im Abenteuer-Modus. Jede Welt hat LEVELS_PER_WORLD Level.
// Nach der letzten Welt geht es endlos weiter (die Welten wiederholen sich mit «II», «III», …).
//
//   id     eindeutig, [a-z0-9-]
//   title  Anzeigename
//   emoji  Symbol der Welt
//   color  Akzentfarbe der Welt (Kartenrand, Fortschrittsbalken)
//   tint   heller Hintergrund der Weltkarte

export const LEVELS_PER_WORLD = 20;

export const worlds = [
  { id: 'morgentau', title: 'Morgentau', emoji: '🌱', color: '#5bb35a', tint: '#eaf7e4' },
  { id: 'bluetenwiese', title: 'Blütenwiese', emoji: '🌸', color: '#e8679a', tint: '#fdebf2' },
  { id: 'beerengarten', title: 'Beerengarten', emoji: '🍓', color: '#e0474c', tint: '#fde9e7' },
  { id: 'sonnenstrand', title: 'Sonnenstrand', emoji: '🐚', color: '#f0a020', tint: '#fff3dc' },
  { id: 'korallenriff', title: 'Korallenriff', emoji: '🐠', color: '#20a6c8', tint: '#e2f6fb' },
  { id: 'herbstwald', title: 'Herbstwald', emoji: '🍁', color: '#d0682c', tint: '#fcede1' },
  { id: 'kristallhoehle', title: 'Kristallhöhle', emoji: '💎', color: '#7a5bd8', tint: '#efeafd' },
  { id: 'schneetal', title: 'Schneetal', emoji: '❄️', color: '#4a8fd8', tint: '#e8f1fc' },
  { id: 'sternennacht', title: 'Sternennacht', emoji: '✨', color: '#3d4aa8', tint: '#e8eaf8' },
  { id: 'wolkenschloss', title: 'Wolkenschloss', emoji: '☁️', color: '#6aa5d8', tint: '#eef5fc' },
  { id: 'zauberwald', title: 'Zauberwald', emoji: '🍄', color: '#b0478a', tint: '#f8e8f2' },
  { id: 'regenbogen', title: 'Regenbogenland', emoji: '🌈', color: '#e85a7a', tint: '#fff0ea' },
];
