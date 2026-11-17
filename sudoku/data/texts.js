// Texte für die Tipps («So kommst du weiter»). Ein Eintrag pro Technik aus logic/human.js.
// Jede Funktion bekommt den Schritt und Hilfsfunktionen und liefert { title, text }.
// Schweizer Rechtschreibung: «ss» statt «ß», Anführungszeichen «so».

import { unitType } from '../logic/board.js';

const list = (ds) => (ds.length <= 1 ? String(ds[0]) : ds.slice(0, -1).join(', ') + ' und ' + ds[ds.length - 1]);
const inUnit = (u) => ({ row: 'in dieser Reihe', col: 'in dieser Spalte', box: 'in diesem Block' })[unitType(u)];
const InUnit = (u) => { const s = inUnit(u); return s[0].toUpperCase() + s.slice(1); };
const ofUnit = (u) => ({ row: 'dieser Reihe', col: 'dieser Spalte', box: 'dieses Blocks' })[unitType(u)];
const lineName = (u) => (unitType(u) === 'row' ? 'Reihe' : 'Spalte');
const linesName = (u) => (unitType(u) === 'row' ? 'Reihen' : 'Spalten');
const otherLines = (u) => (unitType(u) === 'row' ? 'Spalten' : 'Reihen');

export const techniqueTexts = {
  fullHouse: (s) => ({
    title: 'Letztes freies Feld',
    text: `${InUnit(s.units[0])} fehlt nur noch eine Zahl – die ${s.place.d}.`,
  }),
  hiddenSingle: (s) => ({
    title: 'Nur hier möglich',
    text: `${InUnit(s.units[0])} passt die ${s.place.d} nur hier. Die anderen freien Felder sehen schon eine ${s.place.d}.`,
  }),
  nakedSingle: (s) => ({
    title: 'Einzige Zahl',
    text: `In dieses Feld passt nur noch die ${s.place.d}. Alle anderen Zahlen stehen schon in derselben Reihe, Spalte oder im selben Block.`,
  }),
  pointing: (s) => ({
    title: 'Zeiger',
    text: `Im markierten Block kann die ${s.digits[0]} nur in ${unitType(s.units[1]) === 'row' ? 'dieser Reihe' : 'dieser Spalte'} stehen. Darum fällt die ${s.digits[0]} im Rest der ${lineName(s.units[1])} weg.`,
  }),
  claiming: (s) => ({
    title: 'Block-Linie',
    text: `${InUnit(s.units[0])} kann die ${s.digits[0]} nur im markierten Block stehen. Darum fällt die ${s.digits[0]} in den übrigen Feldern des Blocks weg.`,
  }),
  nakedPair: (s) => ({
    title: 'Zwillinge',
    text: `Diese zwei Felder können nur ${list(s.digits)} enthalten. Darum fallen ${list(s.digits)} in den anderen Feldern ${ofUnit(s.units[0])} weg.`,
  }),
  hiddenPair: (s) => ({
    title: 'Verstecktes Paar',
    text: `Die ${list(s.digits)} passen ${inUnit(s.units[0])} nur in diese zwei Felder. Darum fallen dort alle anderen Notizen weg.`,
  }),
  nakedTriple: (s) => ({
    title: 'Drilling',
    text: `Diese drei Felder teilen sich die Zahlen ${list(s.digits)}. Darum fallen diese Zahlen in den anderen Feldern ${ofUnit(s.units[0])} weg.`,
  }),
  hiddenTriple: (s) => ({
    title: 'Versteckter Drilling',
    text: `Die Zahlen ${list(s.digits)} passen ${inUnit(s.units[0])} nur in diese drei Felder. Alle anderen Notizen dort fallen weg.`,
  }),
  nakedQuad: (s) => ({
    title: 'Vierling',
    text: `Diese vier Felder teilen sich die Zahlen ${list(s.digits)}. Darum fallen diese Zahlen in den anderen Feldern ${ofUnit(s.units[0])} weg.`,
  }),
  hiddenQuad: (s) => ({
    title: 'Versteckter Vierling',
    text: `Die Zahlen ${list(s.digits)} passen ${inUnit(s.units[0])} nur in diese vier Felder. Alle anderen Notizen dort fallen weg.`,
  }),
  xWing: (s) => ({
    title: 'X-Wing',
    text: `In zwei ${linesName(s.units[0])} kann die ${s.digits[0]} jeweils nur in denselben zwei ${otherLines(s.units[0])} stehen. Darum fällt die ${s.digits[0]} im Rest dieser ${otherLines(s.units[0])} weg.`,
  }),
  swordfish: (s) => ({
    title: 'Schwertfisch',
    text: `In drei ${linesName(s.units[0])} kann die ${s.digits[0]} nur in denselben drei ${otherLines(s.units[0])} stehen. Darum fällt die ${s.digits[0]} im Rest dieser ${otherLines(s.units[0])} weg.`,
  }),
  xyWing: (s) => {
    const [x, y, z] = s.digits;
    return {
      title: 'XY-Wing',
      text: `Das mittlere Feld ist ${x} oder ${y}. So oder so wird eines der beiden äusseren Felder zur ${z}. Darum fällt die ${z} in Feldern weg, die beide äusseren Felder sehen.`,
    };
  },
  xyzWing: (s) => ({
    title: 'XYZ-Wing',
    text: `Eines dieser drei Felder muss die gemeinsame Zahl enthalten. Darum fällt sie in Feldern weg, die alle drei sehen.`,
  }),
};

export function describeStep(step) {
  const fn = techniqueTexts[step.tech];
  if (!fn) return { title: 'Nächster Schritt', text: 'Schau dir die markierten Felder genau an.' };
  return fn(step);
}

export const hintTexts = {
  wrong: { title: 'Hier stimmt etwas nicht', text: 'Diese Zahl gehört nicht in dieses Feld. Entferne sie und versuch es nochmal.' },
  reveal: (d) => ({ title: 'Kleine Starthilfe', text: `In dieses Feld gehört die ${d}.` }),
  elimAction: 'Notizen anpassen',
  placeAction: 'Eintragen',
  wrongAction: 'Entfernen',
};
