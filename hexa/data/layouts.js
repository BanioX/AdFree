// Wabenstapel – Brettformen.
// Jede Zeile ist eine Waben-Reihe; ungerade Reihen (1, 3, 5 …) sind um eine halbe Wabe nach rechts versetzt.
//   '.' = freies Feld   '#' = Stein (unbenutzbar, aber sichtbar)   '-' oder ' ' = kein Feld
// Breite höchstens 5 Zeichen in geraden und 5 in ungeraden Reihen, Höhe höchstens 7 Reihen (passt auf 375 px).

export const LAYOUTS = [
  { id: 'wabe', name: 'Wabe', rows: [
    '-...',
    '....',
    '.....',
    '....',
    '-...',
  ] },
  { id: 'feld', name: 'Feld', rows: [
    '....',
    '....',
    '.....',
    '....',
    '....',
  ] },
  { id: 'ring', name: 'Ring', rows: [
    '-...',
    '....',
    '..#..',
    '....',
    '-...',
  ] },
  { id: 'garten', name: 'Garten', rows: [
    '.....',
    '....',
    '.....',
    '....',
    '.....',
  ] },
  { id: 'herz', name: 'Herz', rows: [
    '.-.-.',
    '....',
    '.....',
    '....',
    '-...',
    '-..',
  ] },
  { id: 'turm', name: 'Turm', rows: [
    '-...',
    '...',
    '-...',
    '....',
    '.....',
    '....',
    '-...',
  ] },
  { id: 'blume', name: 'Blume', rows: [
    '-...',
    '.....',
    '..#..',
    '.....',
    '..#..',
    '....',
  ] },
  { id: 'insel', name: 'Insel', rows: [
    '.....',
    '.....',
    '.#.#.',
    '.....',
    '.....',
    '....',
  ] },
  { id: 'gross', name: 'Grosse Wabe', rows: [
    '-...',
    '....',
    '.....',
    '.....',
    '.....',
    '....',
    '-...',
  ] },
  { id: 'stern', name: 'Stern', rows: [
    '--.',
    '.....',
    '-....',
    '.....',
    '-....',
    '.....',
    '--.',
  ] },
];

export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
