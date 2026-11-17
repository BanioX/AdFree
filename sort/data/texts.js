// Farbfluss – Texte. Einfach erweitern: neue Einträge in die Listen schreiben.

/** Lob nach einem gelösten Level (zufällig gewählt). */
export const praise = [
  'Wunderbar!', 'Herrlich!', 'Fantastisch!', 'Prima gemacht!', 'Super!', 'Grossartig!',
  'Wie gemalt!', 'Bravo!', 'Toll sortiert!', 'Einfach schön!', 'Perfekt im Fluss!', 'Klasse!',
  'Meisterhaft!', 'Zauberhaft!', 'Spitze!', 'Farbenfroh gelöst!',
];

/** Kleine Tipps, die im Menü abwechselnd erscheinen. */
export const tips = [
  'Ein leeres Glas ist Gold wert – fülle es nicht zu früh.',
  'Rückgängig ist gratis und unbegrenzt. Probieren erlaubt!',
  'Mit dem Tipp-Knopf zeigt dir Farbfluss den nächsten guten Zug.',
  'Farben, die schon unten liegen, sind ein guter Startpunkt.',
  'Unter «Optionen» gibt es Farbsymbole – hilfreich bei ähnlichen Farben.',
  'Fertige Gläser bekommen einen Korken und sind versiegelt.',
  'Grosse Gläser fassen 5 oder 6 Schichten – perfekte Zwischenlager.',
  'In Geheimnis-Leveln zeigt sich eine «?»-Schicht erst, wenn sie oben liegt.',
  'Jeden Tag wartet ein neues Tagesrätsel – für alle gleich.',
  'Mit «+1 Glas» bekommst du einmal pro Level ein leeres Glas dazu.',
];

/**
 * «So geht's» (animiertes Tutorial, 3–4 Schritte). Pro Schritt: Titel (2–4 Wörter), ein kurzer
 * Satz und demo = Name der Mini-Szene in view/tutorial.js ('tap' | 'goal' | 'rule' | 'help').
 */
export const howTo = [
  { demo: 'tap', title: 'Antippen und giessen', text: 'Tippe ein Glas an, dann ein zweites – die oberste Farbe fliesst hinüber.' },
  { demo: 'goal', title: 'Jedes Glas eine Farbe', text: 'Fülle jedes Glas mit nur einer Farbe – dann ploppt ein Korken drauf.' },
  { demo: 'rule', title: 'Gleiche Farbe oder leer', text: 'Giessen geht nur auf dieselbe Farbe oder in ein leeres Glas.' },
  { demo: 'help', title: 'Hilfen sind gratis', text: 'Tipp und Zurück so oft du willst, dazu ein Extra-Glas pro Level.' },
];

/** Kurzes Lob, wenn ein Glas fertig wird (Korken). Index = Kombo (1, 2, 3+ fertige Gläser nacheinander). */
export const corkPraise = ['Schön!', 'Prima!', 'Toll!', 'Super!', 'Herrlich!', 'Fein!'];
export const comboPraise = ['', '', 'Doppelt! ×2', 'Dreifach! ×3', 'Kombo ×4!', 'Fantastisch! ×5', 'Unglaublich! ×6'];

/** Einführung, wenn eine Besonderheit zum ersten Mal vorkommt. */
export const featureIntro = {
  geheimnis: {
    title: 'Geheimnis-Level',
    text: 'Die «?»-Schichten sind verdeckt. Ihre Farbe zeigt sich erst, wenn sie ganz oben liegen.',
  },
  gross: {
    title: 'Grosse Gläser',
    text: 'Manche Gläser fassen 5 oder 6 Schichten. Pro Farbe gibt es aber weiterhin genau 4.',
  },
  symbols: {
    title: 'Viele Farben!',
    text: 'Ab jetzt gibt es ähnliche Töne. Mit Farbsymbolen trägt jede Farbe ein eigenes Zeichen – jederzeit änderbar unter «Optionen».',
  },
};

/** Text, wenn sich nichts mehr bewegen lässt. */
export const stuck = {
  title: 'Festgefahren',
  text: 'Hier geht es nicht mehr weiter. Mach etwas rückgängig, nimm ein Extra-Glas oder beginne neu.',
};
