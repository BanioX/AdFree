// Texte für Juwelen. Alles hier darf frei ergänzt werden.

/** Namen der sechs Juwelen (Reihenfolge = Farbnummer 0..5 in den Leveln). */
export const gemNames = [
  { one: 'Herz', many: 'Herzen' },          // 0 rot, Herzform
  { one: 'Bernstein', many: 'Bernsteine' }, // 1 orange, rund
  { one: 'Stern', many: 'Sterne' },         // 2 gelb, Stern
  { one: 'Smaragd', many: 'Smaragde' },     // 3 grün, Achteck
  { one: 'Saphir', many: 'Saphire' },       // 4 blau, Raute
  { one: 'Amethyst', many: 'Amethyste' },   // 5 violett, Dreieck
];

/** Lob bei Kettenreaktionen (Index = Kettenlänge, ab 2). */
export const praise = [
  null, null,
  'Schön!', 'Super!', 'Toll!', 'Wunderbar!', 'Fantastisch!', 'Traumhaft!', 'Unglaublich!', 'Juwelenregen!',
];

/** Lob beim Bauen von Sonderjuwelen. */
export const specialWords = {
  1: 'Blitz!', 2: 'Blitz!', 3: 'Bombe!', 4: 'Regenbogen!',
};

/** Kurze Erklärungen, die beim ersten Auftauchen eines Elements gezeigt werden. */
export const firstTips = {
  ice: { title: 'Neu: Eis', text: 'Unter manchen Juwelen liegt Eis. Lass genau dort Juwelen verschwinden, dann schmilzt es. Dickes Eis braucht zwei Treffer.' },
  item: { title: 'Neu: Eicheln', text: 'Bringe die Eicheln ganz nach unten ins Körbchen. Räume dazu die Juwelen darunter ab – sie fallen sogar durch Lücken.' },
  stone: { title: 'Neu: Steine', text: 'Steine bewegen sich nicht. Sie zerbrechen, wenn direkt daneben Juwelen verschwinden oder ein Sonderjuwel sie trifft.' },
};

/** Freundliche Sätze für das Ende eines Levels. */
export const winTitles = ['Geschafft!', 'Wunderbar!', 'Prima gemacht!', 'Bravo!', 'Herrlich!', 'Glänzend!'];
export const loseTitles = ['Fast geschafft!', 'Knapp daneben!', 'Beinahe!'];

/** Meilensteine im Entspannt-Modus (Punkte). */
export const zenMilestones = [2500, 5000, 10000, 20000, 35000, 50000, 75000, 100000, 150000, 200000, 300000, 500000];
