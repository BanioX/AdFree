// Farbenzauber – Texte für «So geht's» und kleine Tipps. Anleitung: ../CONTENT.md
//
// HOWTO: 3–4 Schritte für das animierte Tutorial (shared/tutorial.js). `demo` wählt die kleine
// animierte Szene aus ../tutorial.js: 'tap' | 'goal' | 'brush' | 'hint'.

export const HOWTO = [
  { demo: 'tap', title: 'Farbe wählen, tippen', text: 'Wähle unten eine Farbe und tippe die Felder mit derselben Nummer an.' },
  { demo: 'goal', title: 'Bild vollenden', text: 'Male alle Felder aus – dann leuchtet dein Bild in allen Farben.' },
  { demo: 'brush', title: 'Pinsel und Zoom', text: 'Finger halten und ziehen malt viele Felder. Mit zwei Fingern zoomst du.' },
  { demo: 'hint', title: 'Hilfe und Fotos', text: 'Die Glühbirne zeigt ein offenes Feld. Aus eigenen Fotos werden neue Malbilder.' },
];

/** Tipps, die einmalig während des Malens erscheinen: nach `after` ausgemalten Feldern. */
export const TIPS = [
  { id: 'brush', after: 6, text: 'Tipp: Finger kurz halten und ziehen – so malst du viele Felder auf einmal.' },
  { id: 'zoom', after: 25, text: 'Tipp: Mit zwei Fingern zoomen – dann siehst du auch die kleinen Nummern.' },
  { id: 'hint', after: 60, text: 'Tipp: Die Glühbirne oben zeigt dir ein Feld, das noch fehlt.' },
];
