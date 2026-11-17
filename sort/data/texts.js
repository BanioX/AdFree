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
  'In den Einstellungen gibt es Farbsymbole – hilfreich bei ähnlichen Farben.',
  'Fertige Gläser bekommen einen Korken und sind versiegelt.',
  'Grosse Gläser fassen 5 oder 6 Schichten – perfekte Zwischenlager.',
  'In Geheimnis-Leveln zeigt sich eine «?»-Schicht erst, wenn sie oben liegt.',
  'Jeden Tag wartet ein neues Tagesrätsel – für alle gleich.',
  'Mit «+1 Glas» bekommst du einmal pro Level ein leeres Glas dazu.',
];

/** Erklärung «So geht's» (Titel + Text pro Schritt; art = kleine Illustration). */
export const howTo = [
  { art: 'tap', title: 'Antippen und giessen', text: 'Tippe ein Glas an, dann ein anderes: Die oberste Farbe fliesst hinüber.' },
  { art: 'rule', title: 'Gleiche Farbe oder leer', text: 'Giessen geht nur auf dieselbe Farbe oder in ein leeres Glas – und nur, solange Platz ist.' },
  { art: 'goal', title: 'Ziel', text: 'Sortiere, bis jedes Glas nur noch eine Farbe enthält. Fertige Gläser bekommen einen Korken.' },
  { art: 'help', title: 'Hilfen – alle gratis', text: 'Rückgängig, Tipp und Neustart so oft du willst. «+1 Glas» einmal pro Level (dann höchstens zwei Sterne).' },
];

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
};

/** Text, wenn sich nichts mehr bewegen lässt. */
export const stuck = {
  title: 'Festgefahren',
  text: 'Kein Zug mehr möglich. Mach etwas rückgängig, hol dir ein extra Glas oder beginne neu.',
};
