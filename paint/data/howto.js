// Farbenzauber – Texte für «So geht's» und kleine Tipps. Anleitung: ../CONTENT.md

/** Schritte im «So geht's»-Blatt (wird beim ersten Start automatisch gezeigt). */
export const HOWTO = [
  { emoji: '🖼️', title: 'Bild aussuchen', text: 'Wähle ein Bild aus der Galerie – oder mach aus deinem eigenen Foto ein Malbild.' },
  { emoji: '🎨', title: 'Farbe wählen', text: 'Tippe unten auf eine Farbe. Alle Felder mit dieser Nummer werden schraffiert.' },
  { emoji: '👆', title: 'Ausmalen', text: 'Tippe ein Feld an. Finger kurz halten und ziehen malt viele Felder auf einmal.' },
  { emoji: '🔍', title: 'Zoomen', text: 'Mit zwei Fingern vergrössern und verschieben. Kleine Nummern erscheinen beim Hineinzoomen.' },
  { emoji: '💡', title: 'Feld suchen', text: 'Die Glühbirne zeigt dir ein offenes Feld der gewählten Farbe.' },
  { emoji: '✨', title: 'Geniessen', text: 'Fertige Bilder kannst du als Zeitraffer ansehen und als Bild sichern.' },
];

/** Tipps, die einmalig während des Malens erscheinen: nach `after` ausgemalten Feldern. */
export const TIPS = [
  { id: 'brush', after: 6, text: 'Tipp: Finger kurz halten und ziehen – so malst du viele Felder auf einmal.' },
  { id: 'zoom', after: 25, text: 'Tipp: Mit zwei Fingern zoomen – dann siehst du auch die kleinen Nummern.' },
  { id: 'hint', after: 60, text: 'Tipp: Die Glühbirne oben zeigt dir ein Feld, das noch fehlt.' },
];
