import { dict } from '../shared/i18n.js';

export const tr = dict({
  de: {
    title: 'Binärrätsel',
    tagline: 'Nullen und Einsen, gleich viele',
    level: 'Stufe',
    go: 'Tippe: leer, 0, 1',
    win: 'Das Gitter stimmt',
    hint: 'Hier kommt eine {n} hin',
    tut1: 'Feld tippen',
    tut1t: 'Jedes Tippen wechselt leer, 0 und 1. Vorgegebene Felder bleiben.',
    tut2: 'Gleich viele',
    tut2t: 'In jeder Zeile und Spalte gleich viele 0 und 1. Nie drei gleiche hintereinander.',
    tut3: 'Einmalig',
    tut3t: 'Keine Zeile und keine Spalte darf einer anderen gleichen.',
  },
  en: {
    title: 'Binary',
    tagline: 'Zeros and ones, the same count',
    level: 'Level',
    go: 'Tap: empty, 0, 1',
    win: 'The grid is right',
    hint: 'A {n} belongs here',
    tut1: 'Tap a square',
    tut1t: 'Each tap cycles empty, 0 and 1. Given squares stay.',
    tut2: 'The same count',
    tut2t: 'Every row and column has the same number of 0s and 1s. Never three alike in a row.',
    tut3: 'Unique',
    tut3t: 'No row or column may match another.',
  },
});
