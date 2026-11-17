// Welten der Levelkarte. Je 15 Level bilden eine Welt.
// Nach der letzten Welt beginnt die Liste von vorne (mit «II», «III», … im Namen) –
// die Level selbst werden endlos neu erzeugt.
//
//   name    Anzeigename der Welt
//   emoji   Symbol in der Kopfzeile der Welt
//   deco    Emoji, die links und rechts am Weg stehen
//   sky     Hintergrund-Verlauf des Spielbildschirms (oben, unten)
//   cells   die zwei Farben der Brettfelder (Schachbrett)
//   accent  Farbe von Weg und Knöpfen der Welt

export const worlds = [
  { name: 'Blütenwiese', emoji: '🌸', deco: ['🌷', '🌼', '🦋', '🌸'],
    sky: ['#ffe8f0', '#ffd3e2'], cells: ['#fff7fa', '#fce8f0'], accent: '#e2588c' },
  { name: 'Honigtal', emoji: '🍯', deco: ['🐝', '🌻', '🍯', '🌾'],
    sky: ['#fff3d6', '#ffe0a3'], cells: ['#fffaf0', '#fbefd6'], accent: '#e09a16' },
  { name: 'Mondsee', emoji: '🌙', deco: ['🌙', '⭐', '🦢', '💧'],
    sky: ['#e6f0ff', '#cddfff'], cells: ['#f7faff', '#e6eefb'], accent: '#4f7fd9' },
  { name: 'Kristallhöhle', emoji: '💎', deco: ['💎', '🔮', '✨', '🪨'],
    sky: ['#efe6ff', '#dccbff'], cells: ['#faf7ff', '#ece4fa'], accent: '#8a5ad6' },
  { name: 'Waldlichtung', emoji: '🍄', deco: ['🍄', '🌲', '🦔', '🍀'],
    sky: ['#e7f7e4', '#cdeec8'], cells: ['#f8fdf6', '#e6f4e2'], accent: '#3f9a52' },
  { name: 'Korallenbucht', emoji: '🐚', deco: ['🐚', '🐠', '🌊', '🦀'],
    sky: ['#ffe9e2', '#ffd0c2'], cells: ['#fff8f5', '#fbe7e0'], accent: '#e2694a' },
  { name: 'Sternenhimmel', emoji: '✨', deco: ['⭐', '🌟', '🪐', '☄️'],
    sky: ['#e4e6ff', '#c9ccf7'], cells: ['#f7f7ff', '#e7e8fa'], accent: '#5b5fd0' },
  { name: 'Herbstgarten', emoji: '🍁', deco: ['🍁', '🍂', '🎃', '🌰'],
    sky: ['#ffeedd', '#ffd9b8'], cells: ['#fff9f3', '#fbeadb'], accent: '#d4692a' },
  { name: 'Schneegipfel', emoji: '❄️', deco: ['❄️', '⛄', '🏔️', '🌨️'],
    sky: ['#e8f6fb', '#cbe9f4'], cells: ['#f8fdff', '#e4f2f8'], accent: '#3c9ac0' },
  { name: 'Rosenschloss', emoji: '🌹', deco: ['🌹', '🏰', '👑', '💐'],
    sky: ['#ffe6ea', '#f9cbd4'], cells: ['#fff7f8', '#fae5e9'], accent: '#c9405c' },
  { name: 'Teegarten', emoji: '🍵', deco: ['🍵', '🌿', '🫖', '🌸'],
    sky: ['#eef6e0', '#dcecc0'], cells: ['#fafdf4', '#ecf3de'], accent: '#6c9a2e' },
  { name: 'Regenbogenland', emoji: '🌈', deco: ['🌈', '☁️', '🦄', '🎈'],
    sky: ['#fdeefe', '#e6e2ff'], cells: ['#fffaff', '#f1ebfb'], accent: '#b05cc9' },
];
