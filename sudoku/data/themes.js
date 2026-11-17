// Farbthemen für das Spielbrett. Neues Thema = neuer Eintrag.
//   accent  Akzentfarbe (Knöpfe, eigene Zahlen)
//   ink     Farbe der eigenen Zahlen
//   sel     ausgewähltes Feld
//   same    Felder mit derselben Zahl
//   peer    gleiche Reihe/Spalte/Block
//   line    feine Linien, thick: Block-Linien
//   wave    Farbe der «Welle», wenn eine Reihe/Spalte/Block fertig ist
//   cell    optional: Papierfarbe der Felder (Standard weiss)
//   given   optional: Farbe der vorgegebenen Zahlen (Standard fast schwarz)
//   unlock  optional: so viele Sterne braucht es zum Freischalten (ohne = von Anfang an da)

export const themes = [
  { id: 'blau', title: 'Blau', accent: '#4a7bd0', ink: '#3567c2', sel: '#c4d7f7', same: '#dce7fa', peer: '#eef3fb', line: '#e3e8f0', thick: '#a9b8d2', wave: '#9fc0f5' },
  { id: 'salbei', title: 'Salbei', accent: '#4f9a74', ink: '#3b8a62', sel: '#c5e5d3', same: '#dceee3', peer: '#eef6f1', line: '#e2ebe5', thick: '#a6c2b2', wave: '#9ad6b4' },
  { id: 'lavendel', title: 'Lavendel', accent: '#8a6fd1', ink: '#7457c4', sel: '#dcd2f6', same: '#e8e1f9', peer: '#f3effc', line: '#e8e3f1', thick: '#bcb0d9', wave: '#c4b2f2' },
  { id: 'rose', title: 'Rosé', accent: '#d0607f', ink: '#c24a6c', sel: '#f6cfda', same: '#f9e0e7', peer: '#fcf0f3', line: '#f0e3e7', thick: '#dbb0bd', wave: '#f3a9be' },
  { id: 'honig', title: 'Honig', accent: '#c98a1c', ink: '#b07612', sel: '#f5dfb3', same: '#f9ebcd', peer: '#fcf5e6', line: '#efe6d4', thick: '#d6bf91', wave: '#f2c86e' },
  { id: 'meer', title: 'Meer', accent: '#2f97a8', ink: '#1f8495', sel: '#c2e6ec', same: '#daf0f3', peer: '#edf7f9', line: '#dfebee', thick: '#9ec6cd', wave: '#8fd6e2' },
  // Mit Sternen freischaltbar (Sterne gibt es für jedes gelöste Rätsel)
  { id: 'koralle', title: 'Koralle', unlock: 3, accent: '#e0664f', ink: '#cc5038', sel: '#f8d3ca', same: '#fbe3dc', peer: '#fdf1ed', line: '#f1e3df', thick: '#e2b3a7', wave: '#f6ad9c' },
  { id: 'pergament', title: 'Pergament', unlock: 10, accent: '#a7713a', ink: '#8f5a24', sel: '#ecd9b8', same: '#f3e6cc', peer: '#f8efdc', line: '#ebdfc8', thick: '#cdb48b', wave: '#e8c48a', cell: '#fffaf0', given: '#4a3418' },
  { id: 'moos', title: 'Moos', unlock: 20, accent: '#6c8c2c', ink: '#5a7a1e', sel: '#dbe7bf', same: '#e7efd3', peer: '#f3f7e9', line: '#e5ebd8', thick: '#b7c697', wave: '#c6dc8e' },
  { id: 'pflaume', title: 'Pflaume', unlock: 35, accent: '#9a4d8c', ink: '#87397a', sel: '#ecd0e6', same: '#f3e0ef', peer: '#f9eff7', line: '#eee1eb', thick: '#cfa8c7', wave: '#e2a6d6' },
  { id: 'schiefer', title: 'Schiefer', unlock: 55, accent: '#566a88', ink: '#465a78', sel: '#d3dbe7', same: '#e2e8f0', peer: '#f1f4f8', line: '#e3e7ed', thick: '#a7b3c4', wave: '#b4c4dc', cell: '#fcfdfe' },
  { id: 'mitternacht', title: 'Mitternacht', unlock: 80, accent: '#3d43a6', ink: '#2f359a', sel: '#d2d4f5', same: '#e2e3f9', peer: '#f1f1fc', line: '#e4e4f2', thick: '#9c9fd6', wave: '#aeb2f2', cell: '#fdfcff', given: '#22234a' },
];

export const themeById = (id) => themes.find((t) => t.id === id) || themes[0];

/** Ist das Thema bei `stars` gesammelten Sternen verfügbar? */
export const themeUnlocked = (t, stars) => !t.unlock || stars >= t.unlock;

/** Nächstes noch gesperrtes Thema (oder null, wenn alles freigeschaltet ist). */
export function nextLockedTheme(stars) {
  return themes.filter((t) => t.unlock && stars < t.unlock).sort((a, b) => a.unlock - b.unlock)[0] || null;
}

/** Themen, die durch den Sprung von `before` auf `after` Sterne neu dazukommen. */
export function newlyUnlocked(before, after) {
  return themes.filter((t) => t.unlock && before < t.unlock && after >= t.unlock);
}
