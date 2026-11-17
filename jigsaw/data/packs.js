// Bildersammlungen (Packs) für «Puzzle».
//
// Jedes Bild wird beim Spielen frisch gemalt – aus Maler + Palette + Seed (Zufallszahl).
// Gleicher Seed = immer genau dasselbe Bild. Neues Bild = neue Zeile mit anderem Seed.
//
//   { id, title, painter, emoji, images: [ { id, title, palette, seed, opts?, painter? }, … ] }
//
//   painter  'berge' | 'wiese' | 'meer' | 'nacht' | 'muster' | 'ballone' | 'unterwasser' | 'bluete' | 'wald'
//   palette  Name aus data/palettes.js
//   opts     maler-spezifische Wünsche (siehe CONTENT.md), z.B. { lake: true } oder { style: 'wellen' }
//
// Die Reihenfolge hier ist die Reihenfolge im Menü.

export const packs = [
  {
    id: 'berge', title: 'Bergwelten', painter: 'berge', emoji: '🏔️',
    images: [
      { id: 'alpenglut', title: 'Alpenglühen', palette: 'alpenglut', seed: 101, opts: { lake: true } },
      { id: 'sommertag', title: 'Sommertag am Pass', palette: 'sommertag', seed: 102, opts: { lake: false } },
      { id: 'abendgold', title: 'Abendgold', palette: 'abendgold', seed: 103, opts: { lake: true } },
      { id: 'nebelmorgen', title: 'Nebelmorgen', palette: 'nebelblau', seed: 104, opts: { lake: true } },
      { id: 'herbstberge', title: 'Herbst in den Bergen', palette: 'herbst', seed: 105, opts: { lake: false } },
      { id: 'lavendelgipfel', title: 'Lila Gipfel', palette: 'lavendel', seed: 106, opts: { lake: true } },
      { id: 'morgenrot', title: 'Morgenrot', palette: 'morgenrot', seed: 107, opts: { lake: false } },
      { id: 'winterruhe', title: 'Winterruhe', palette: 'winter', seed: 108, opts: { lake: false, winter: true, snow: 0.5 } },
      { id: 'bergsee', title: 'Klarer Bergsee', palette: 'minze', seed: 109, opts: { lake: true } },
      { id: 'flamingoberge', title: 'Rosa Abend', palette: 'flamingo', seed: 110, opts: { lake: true } },
      { id: 'schneefall', title: 'Leiser Schneefall', palette: 'winter', seed: 111, opts: { lake: true, snowfall: true, snow: 0.5 } },
      { id: 'mondberge', title: 'Mondlicht', palette: 'tiefblau', seed: 112, opts: { lake: true, clouds: 1 } },
    ],
  },
  {
    id: 'wiesen', title: 'Blumenwiesen', painter: 'wiese', emoji: '🌼',
    images: [
      { id: 'wildblumen', title: 'Wildblumen', palette: 'sommertag', seed: 201, opts: { kind: 'wild' } },
      { id: 'mohnfeld', title: 'Mohnfeld', palette: 'sommertag', seed: 202, opts: { kind: 'mohn', tree: true } },
      { id: 'lavendelreihen', title: 'Lavendelreihen', palette: 'lavendel', seed: 203, opts: { kind: 'lavendel' } },
      { id: 'tulpenfeld', title: 'Tulpenfeld', palette: 'fruehling', seed: 204, opts: { kind: 'tulpen' } },
      { id: 'sonnenblumen', title: 'Sonnenblumen', palette: 'sommertag', seed: 205, opts: { kind: 'sonnen' } },
      { id: 'fruehlingswiese', title: 'Frühlingswiese', palette: 'fruehling', seed: 206, opts: { kind: 'wild', tree: true } },
      { id: 'minzwiese', title: 'Pastellwiese', palette: 'minze', seed: 207, opts: { kind: 'wild' } },
      { id: 'abendmohn', title: 'Mohn am Abend', palette: 'abendgold', seed: 208, opts: { kind: 'mohn' } },
      { id: 'lila-abend', title: 'Lavendel am Abend', palette: 'flamingo', seed: 209, opts: { kind: 'lavendel' } },
      { id: 'sonnenfeld', title: 'Goldenes Feld', palette: 'herbst', seed: 210, opts: { kind: 'sonnen' } },
      { id: 'morgenwiese', title: 'Morgentau', palette: 'morgenrot', seed: 211, opts: { kind: 'wild', tree: true } },
      { id: 'tulpenmorgen', title: 'Tulpen im Morgenlicht', palette: 'morgenrot', seed: 212, opts: { kind: 'tulpen' } },
    ],
  },
  {
    id: 'meer', title: 'Meer & Sonne', painter: 'meer', emoji: '🌅',
    images: [
      { id: 'abendglut', title: 'Abendglut', palette: 'glut', seed: 301, opts: { foreground: 'strand' } },
      { id: 'karibik', title: 'Türkise Bucht', palette: 'karibik', seed: 302, opts: { foreground: 'strand' } },
      { id: 'flamingo', title: 'Rosa Horizont', palette: 'flamingo', seed: 303, opts: { foreground: 'offen' } },
      { id: 'goldkueste', title: 'Goldene Küste', palette: 'abendgold', seed: 304, opts: { foreground: 'felsen' } },
      { id: 'morgenmeer', title: 'Morgen am Meer', palette: 'morgenrot', seed: 305, opts: { foreground: 'offen' } },
      { id: 'segeltoern', title: 'Segeltörn', palette: 'alpenglut', seed: 306, opts: { foreground: 'offen', boat: true } },
      { id: 'lilameer', title: 'Lila Stunde', palette: 'lavendel', seed: 307, opts: { foreground: 'strand' } },
      { id: 'stillesmeer', title: 'Stille See', palette: 'nebelblau', seed: 308, opts: { foreground: 'felsen' } },
      { id: 'palmenstrand', title: 'Palmenstrand', palette: 'glut', seed: 309, opts: { foreground: 'strand' } },
      { id: 'mondmeer', title: 'Mond über dem Meer', palette: 'tiefblau', seed: 310, opts: { foreground: 'offen' } },
      { id: 'minzmeer', title: 'Frische Brise', palette: 'minze', seed: 311, opts: { foreground: 'strand' } },
      { id: 'inselabend', title: 'Inselabend', palette: 'veilchen', seed: 312, opts: { foreground: 'felsen', islands: true } },
    ],
  },
  {
    id: 'nacht', title: 'Sternennächte', painter: 'nacht', emoji: '🌙',
    images: [
      { id: 'milchstrasse', title: 'Milchstrasse', palette: 'mitternacht', seed: 401, opts: { milkyway: true, aurora: false } },
      { id: 'polarlicht', title: 'Polarlicht', palette: 'polarlicht', seed: 402, opts: { aurora: true } },
      { id: 'huette', title: 'Hütte im Sternenlicht', palette: 'tiefblau', seed: 403, opts: { cabin: true, milkyway: true } },
      { id: 'veilchennacht', title: 'Veilchennacht', palette: 'veilchen', seed: 404, opts: { aurora: true, crescent: true } },
      { id: 'sternschnuppe', title: 'Sternschnuppe', palette: 'mitternacht', seed: 405, opts: { meteor: true, crescent: false } },
      { id: 'nordlichter', title: 'Tanzende Lichter', palette: 'polarlicht', seed: 406, opts: { aurora: true, milkyway: true } },
      { id: 'vollmond', title: 'Vollmond', palette: 'tiefblau', seed: 407, opts: { crescent: false, aurora: false } },
      { id: 'traumnacht', title: 'Traumnacht', palette: 'veilchen', seed: 408, opts: { milkyway: true } },
      { id: 'sichelmond', title: 'Sichelmond', palette: 'mitternacht', seed: 409, opts: { crescent: true, cabin: true } },
      { id: 'gruene-nacht', title: 'Grüne Nacht', palette: 'polarlicht', seed: 410, opts: { aurora: true, cabin: false } },
    ],
  },
  {
    id: 'muster', title: 'Farbspiele', painter: 'muster', emoji: '🎨',
    images: [
      { id: 'papierwellen', title: 'Papierwellen', palette: 'bonbon', seed: 501, opts: { style: 'wellen' } },
      { id: 'kreise', title: 'Seifenkreise', palette: 'pastell', seed: 502, opts: { style: 'kreise' } },
      { id: 'mosaik', title: 'Mosaik', palette: 'herbstlaub', seed: 503, opts: { style: 'mosaik' } },
      { id: 'boegen', title: 'Bögen & Kreise', palette: 'bauhaus', seed: 504, opts: { style: 'boegen' } },
      { id: 'aquarell', title: 'Aquarell', palette: 'bonbon', seed: 505, opts: { style: 'aquarell' } },
      { id: 'terrazzo', title: 'Terrazzo', palette: 'herbstlaub', seed: 506, opts: { style: 'terrazzo' } },
      { id: 'herbstwellen', title: 'Herbstwellen', palette: 'herbstlaub', seed: 507, opts: { style: 'wellen' } },
      { id: 'edelmosaik', title: 'Edelsteine', palette: 'edelstein', seed: 508, opts: { style: 'mosaik' } },
      { id: 'pastellboegen', title: 'Pastellbögen', palette: 'pastell', seed: 509, opts: { style: 'boegen' } },
      { id: 'meeresaquarell', title: 'Meeresaquarell', palette: 'meeresbrise', seed: 510, opts: { style: 'aquarell' } },
      { id: 'bonbonkreise', title: 'Bonbonkreise', palette: 'bonbon', seed: 511, opts: { style: 'kreise' } },
      { id: 'pastellwellen', title: 'Pastellwellen', palette: 'pastell', seed: 512, opts: { style: 'wellen' } },
    ],
  },
  {
    id: 'ballone', title: 'Ballonfahrt', painter: 'ballone', emoji: '🎈',
    images: [
      { id: 'sommerhimmel', title: 'Sommerhimmel', palette: 'sommertag', seed: 601 },
      { id: 'fruehlingsflug', title: 'Frühlingsflug', palette: 'fruehling', seed: 602 },
      { id: 'rosa-morgen', title: 'Rosa Morgen', palette: 'flamingo', seed: 603 },
      { id: 'herbstfahrt', title: 'Herbstfahrt', palette: 'herbst', seed: 604 },
      { id: 'abendflug', title: 'Abendflug', palette: 'abendgold', seed: 605 },
      { id: 'pastellhimmel', title: 'Pastellhimmel', palette: 'minze', seed: 606 },
      { id: 'lila-ballone', title: 'Lila Ballone', palette: 'lavendel', seed: 607 },
      { id: 'morgenfahrt', title: 'Morgenfahrt', palette: 'morgenrot', seed: 608 },
    ],
  },
  {
    id: 'unterwasser', title: 'Unterwasserwelt', painter: 'unterwasser', emoji: '🐠',
    images: [
      { id: 'korallenriff', title: 'Korallenriff', palette: 'tiefsee', seed: 701 },
      { id: 'lagune', title: 'Lagune', palette: 'lagune', seed: 702 },
      { id: 'fischschwarm', title: 'Fischschwarm', palette: 'tiefsee', seed: 703 },
      { id: 'sonnenriff', title: 'Sonnenriff', palette: 'lagune', seed: 704 },
      { id: 'blaues-wunder', title: 'Blaues Wunder', palette: 'tiefsee', seed: 705 },
      { id: 'flachwasser', title: 'Flachwasser', palette: 'lagune', seed: 706 },
      { id: 'meeresgarten', title: 'Meeresgarten', palette: 'tiefsee', seed: 707 },
      { id: 'tuerkiswelt', title: 'Türkiswelt', palette: 'lagune', seed: 708 },
    ],
  },
  {
    id: 'blueten', title: 'Blütenzweige', painter: 'bluete', emoji: '🌸',
    images: [
      { id: 'kirschbluete', title: 'Kirschblüte', palette: 'kirschbluete', seed: 801 },
      { id: 'abendblueten', title: 'Blüten im Abendlicht', palette: 'abendgold', seed: 802 },
      { id: 'lilaflieder', title: 'Fliederzweig', palette: 'lavendel', seed: 803 },
      { id: 'mandelbluete', title: 'Mandelblüte', palette: 'morgenrot', seed: 804 },
      { id: 'fruehlingszweig', title: 'Frühlingszweig', palette: 'minze', seed: 805 },
      { id: 'rosazweig', title: 'Rosa Zweig', palette: 'flamingo', seed: 806 },
      { id: 'apfelbluete', title: 'Apfelblüte', palette: 'kirschbluete', seed: 807 },
      { id: 'pfirsichbluete', title: 'Pfirsichblüte', palette: 'sommertag', seed: 808 },
    ],
  },
  {
    id: 'waelder', title: 'Stille Wälder', painter: 'wald', emoji: '🌲',
    images: [
      { id: 'morgenwald', title: 'Morgen im Wald', palette: 'wald', seed: 901 },
      { id: 'herbstwald', title: 'Herbstwald', palette: 'herbst', seed: 902 },
      { id: 'nebelwald', title: 'Nebelwald', palette: 'nebelblau', seed: 903 },
      { id: 'rosawald', title: 'Waldlichtung', palette: 'morgenrot', seed: 904 },
      { id: 'goldwald', title: 'Goldenes Licht', palette: 'abendgold', seed: 905 },
      { id: 'minzwald', title: 'Frischer Wald', palette: 'minze', seed: 906 },
      { id: 'lilawald', title: 'Zauberwald', palette: 'lavendel', seed: 907 },
      { id: 'winterwald', title: 'Winterwald', palette: 'winter', seed: 908 },
    ],
  },
];

/** Für Zufallsbilder: welche Maler mit welchen Paletten gut aussehen. */
export const randomRecipes = [
  { painter: 'berge', palettes: ['alpenglut', 'sommertag', 'abendgold', 'nebelblau', 'herbst', 'lavendel', 'morgenrot', 'minze', 'flamingo', 'glut'] },
  { painter: 'wiese', palettes: ['sommertag', 'fruehling', 'minze', 'lavendel', 'morgenrot', 'abendgold', 'herbst'] },
  { painter: 'meer', palettes: ['glut', 'karibik', 'flamingo', 'abendgold', 'morgenrot', 'alpenglut', 'lavendel', 'nebelblau', 'tiefblau', 'veilchen'] },
  { painter: 'nacht', palettes: ['mitternacht', 'polarlicht', 'tiefblau', 'veilchen'] },
  { painter: 'muster', palettes: ['bonbon', 'bauhaus', 'meeresbrise', 'herbstlaub', 'pastell', 'edelstein'] },
  { painter: 'ballone', palettes: ['sommertag', 'fruehling', 'flamingo', 'herbst', 'abendgold', 'minze', 'lavendel', 'morgenrot'] },
  { painter: 'unterwasser', palettes: ['tiefsee', 'lagune'] },
  { painter: 'bluete', palettes: ['kirschbluete', 'abendgold', 'lavendel', 'morgenrot', 'minze', 'flamingo', 'sommertag'] },
  { painter: 'wald', palettes: ['wald', 'herbst', 'nebelblau', 'morgenrot', 'abendgold', 'minze', 'lavendel'] },
];

/** Namen für Zufallsbilder (Maler → Wörter). */
export const randomNames = {
  berge: ['Gipfelblick', 'Bergpanorama', 'Hohe Gipfel', 'Bergruhe', 'Talblick'],
  wiese: ['Blütenmeer', 'Sommerwiese', 'Blumenfeld', 'Wiesenglück', 'Blütenpracht'],
  meer: ['Meeresblick', 'Sonnenuntergang', 'Abend am Strand', 'Weites Meer', 'Küstenlicht'],
  nacht: ['Sternenhimmel', 'Nachtzauber', 'Sternenglanz', 'Mondnacht', 'Himmelslichter'],
  muster: ['Farbenspiel', 'Farbtraum', 'Formenspiel', 'Musterzauber', 'Buntes Allerlei'],
  ballone: ['Ballonzauber', 'Himmelsreise', 'Ballonfest', 'Luftreise'],
  unterwasser: ['Meerestiefe', 'Riffzauber', 'Unterwassertraum', 'Fischparade'],
  bluete: ['Blütenzauber', 'Blütentraum', 'Zweig im Frühling', 'Blütenregen'],
  wald: ['Waldstille', 'Waldzauber', 'Lichter im Wald', 'Tannenduft'],
};
