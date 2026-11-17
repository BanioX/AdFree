// Farbfluss – Tagesrätsel. Jeder Wochentag hat seinen eigenen Charakter.
// Index = Wochentag (0 = Sonntag … 6 = Samstag).
//   colors  Anzahl Farben
//   gross   'filled' (einige volle Gläser fassen 5–6) | 'empty' (ein leeres Glas fasst 6) | undefined
//   geheimnis true = verdeckte Schichten
//   name    kurzer Untertitel

export const dailyWeek = [
  { name: 'Sonntagsruhe', colors: 8, gross: 'empty' },
  { name: 'Sanfter Start', colors: 7 },
  { name: 'Farbenfroh', colors: 8 },
  { name: 'Geheimnisvoll', colors: 7, geheimnis: true },
  { name: 'Grosse Gläser', colors: 9, gross: 'filled' },
  { name: 'Feierabend', colors: 9 },
  { name: 'Wochenend-Knobelei', colors: 10 },
];
