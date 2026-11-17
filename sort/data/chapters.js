// Farbfluss – Kapitel. Alle `size` Level beginnt ein neues Kapitel mit eigenem Namen
// und eigener Hintergrundstimmung. Nach dem letzten Kapitel geht es von vorne los
// (mit «II», «III», … hinter dem Namen).
//
//   name  Name des Kapitels
//   emoji ein Bild für Menü und Level-Übersicht
//   bg    [oben, unten] – sanfter Verlauf hinter den Gläsern (hell halten!)
//   shelf Farbe des Regalbretts

export const CHAPTER_SIZE = 15;

export const chapters = [
  { name: 'Morgentau', emoji: '🌱', bg: ['#f3fbf4', '#fdf6ea'], shelf: '#e9dcc8' },
  { name: 'Lagune', emoji: '🐚', bg: ['#e8f8f8', '#fbf4e6'], shelf: '#e4d6be' },
  { name: 'Kirschblüte', emoji: '🌸', bg: ['#fdeef3', '#fcf5ec'], shelf: '#ecd8cc' },
  { name: 'Sonnenhof', emoji: '🌻', bg: ['#fff6da', '#fdf1e4'], shelf: '#ecd7b4' },
  { name: 'Lavendelfeld', emoji: '💜', bg: ['#f2edfd', '#fbf5ee'], shelf: '#e2d6dc' },
  { name: 'Meeresgrund', emoji: '🐠', bg: ['#e4f2fb', '#f3f6f0'], shelf: '#d8d9cf' },
  { name: 'Herbstwald', emoji: '🍁', bg: ['#fdefe2', '#f8efe2'], shelf: '#e5cfb3' },
  { name: 'Polarlicht', emoji: '✨', bg: ['#e9f7f1', '#efecfb'], shelf: '#dcd8e2' },
  { name: 'Zuckerwatte', emoji: '🍭', bg: ['#fdeefa', '#eaf3fd'], shelf: '#e6d6e4' },
  { name: 'Wüstenrose', emoji: '🌵', bg: ['#fbefe4', '#f6ead9'], shelf: '#e3c9ad' },
  { name: 'Bergsee', emoji: '🏔️', bg: ['#e6f1f8', '#eef6ef'], shelf: '#d6dacf' },
  { name: 'Sternschnuppe', emoji: '🌠', bg: ['#eceefb', '#fbf3ea'], shelf: '#dcd6d6' },
];
