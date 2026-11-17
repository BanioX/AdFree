// Farbthemen für das Spielbrett. Neues Thema = neuer Eintrag.
//   accent  Akzentfarbe (Knöpfe, eigene Zahlen)
//   ink     Farbe der eigenen Zahlen
//   sel     ausgewähltes Feld
//   same    Felder mit derselben Zahl
//   peer    gleiche Reihe/Spalte/Block
//   line    feine Linien, thick: Block-Linien
//   wave    Farbe der «Welle», wenn eine Reihe/Spalte/Block fertig ist

export const themes = [
  { id: 'blau', title: 'Blau', accent: '#4a7bd0', ink: '#3567c2', sel: '#c4d7f7', same: '#dce7fa', peer: '#eef3fb', line: '#e3e8f0', thick: '#a9b8d2', wave: '#9fc0f5' },
  { id: 'salbei', title: 'Salbei', accent: '#4f9a74', ink: '#3b8a62', sel: '#c5e5d3', same: '#dceee3', peer: '#eef6f1', line: '#e2ebe5', thick: '#a6c2b2', wave: '#9ad6b4' },
  { id: 'lavendel', title: 'Lavendel', accent: '#8a6fd1', ink: '#7457c4', sel: '#dcd2f6', same: '#e8e1f9', peer: '#f3effc', line: '#e8e3f1', thick: '#bcb0d9', wave: '#c4b2f2' },
  { id: 'rose', title: 'Rosé', accent: '#d0607f', ink: '#c24a6c', sel: '#f6cfda', same: '#f9e0e7', peer: '#fcf0f3', line: '#f0e3e7', thick: '#dbb0bd', wave: '#f3a9be' },
  { id: 'honig', title: 'Honig', accent: '#c98a1c', ink: '#b07612', sel: '#f5dfb3', same: '#f9ebcd', peer: '#fcf5e6', line: '#efe6d4', thick: '#d6bf91', wave: '#f2c86e' },
  { id: 'meer', title: 'Meer', accent: '#2f97a8', ink: '#1f8495', sel: '#c2e6ec', same: '#daf0f3', peer: '#edf7f9', line: '#dfebee', thick: '#9ec6cd', wave: '#8fd6e2' },
];

export const themeById = (id) => themes.find((t) => t.id === id) || themes[0];
