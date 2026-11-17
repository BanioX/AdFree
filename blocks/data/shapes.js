// Formen der Spielsteine (Polyominos).
//
//   rows    Zeichnung der Form: '#' = Block, '.' = leer. Alle Zeilen gleich lang.
//   weight  Wie häufig die Form kommt (relativ). Wird auf alle Drehungen verteilt.
//   tier    Grösse/Schwierigkeit: 0 klein … 3 gross. Am Anfang kommen kleine Formen häufiger.
//   rotate  true = alle 4 Drehungen erzeugen (doppelte werden automatisch entfernt)
//   mirror  true = zusätzlich gespiegelt
//   color   Farbindex 0–7 (die echten Farben kommen aus dem gewählten Aussehen, siehe skins.js)
//
// Neue Form: einfach eine Zeile ergänzen. Die Tests prüfen, dass jede Form zusammenhängend ist
// und in ein 5×5-Feld passt.

export const shapes = [
  { id: 'punkt', rows: ['#'], weight: 2.2, tier: 0, color: 7 },
  { id: 'zwei', rows: ['##'], weight: 3.4, tier: 0, rotate: true, color: 4 },
  { id: 'drei', rows: ['###'], weight: 3.6, tier: 0, rotate: true, color: 2 },
  { id: 'ecke', rows: ['##', '#.'], weight: 4, tier: 0, rotate: true, color: 3 },

  { id: 'vier', rows: ['####'], weight: 3, tier: 1, rotate: true, color: 5 },
  { id: 'quadrat', rows: ['##', '##'], weight: 4, tier: 1, color: 1 },
  { id: 'l', rows: ['#.', '#.', '##'], weight: 3.2, tier: 1, rotate: true, mirror: true, color: 6 },
  { id: 't', rows: ['###', '.#.'], weight: 2.4, tier: 1, rotate: true, color: 0 },
  { id: 's', rows: ['.##', '##.'], weight: 2, tier: 1, rotate: true, mirror: true, color: 3 },

  { id: 'fuenf', rows: ['#####'], weight: 2.2, tier: 2, rotate: true, color: 0 },
  { id: 'rechteck', rows: ['###', '###'], weight: 2.4, tier: 2, rotate: true, color: 4 },
  { id: 'grosse-ecke', rows: ['###', '#..', '#..'], weight: 2.6, tier: 2, rotate: true, color: 2 },
  { id: 'langes-l', rows: ['#...', '####'], weight: 1, tier: 2, rotate: true, mirror: true, color: 6 },

  { id: 'block', rows: ['###', '###', '###'], weight: 1.8, tier: 3, color: 5 },
  { id: 'plus', rows: ['.#.', '###', '.#.'], weight: 0.5, tier: 3, color: 7 },
  { id: 'brücke', rows: ['#.#', '###'], weight: 0.5, tier: 3, rotate: true, color: 1 },
];
