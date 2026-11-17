// Wollknäuel – Strickstücke für den Strickkorb.
// Jede fertige Spule wird zu einem Strickstück in ihrer Farbe. Neue Arten werden freigeschaltet,
// sobald insgesamt «at» Stücke gestrickt sind. Formen als SVG-Pfade im Raster 0 0 48 48:
//   body   Hauptform (bekommt Wollfarbe + Strickmuster)
//   trim   optionale Akzente (Bündchen, Bommel …) in hellerem Ton
//   lines  optionale Ziernähte (dunkler Strich)

export const ITEMS = [
  {
    id: 'topflappen', name: 'Topflappen', at: 0,
    body: 'M9 13h30a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3z',
    trim: 'M8 9.5a4.5 4.5 0 1 1 0 .1zM8 11.5a2.5 2.5 0 1 0 0-.1z',
    lines: 'M6 22h36M6 33h36',
  },
  {
    id: 'socke', name: 'Socke', at: 6,
    body: 'M15 5h15v21c0 1.6.8 2.7 2.4 3.5l6 3c4 2 5 6.6 2.3 9.6-1.8 2-4.7 2.5-7.2 1.3L18.5 38C14 35.8 12 32.4 12 28V8a3 3 0 0 1 3-3z',
    trim: 'M15 5h15v6H12V8a3 3 0 0 1 3-3z',
    lines: 'M30 31c-2 1.5-3 4-2.5 6.5',
  },
  {
    id: 'muetze', name: 'Mütze', at: 14,
    body: 'M8 34c0-11 7-20 16-20s16 9 16 20z',
    trim: 'M6 33h36v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM24 4.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10z',
    lines: 'M24 15v18M16 18c-2 4-3 9-3 15M32 18c2 4 3 9 3 15',
  },
  {
    id: 'schal', name: 'Schal', at: 26,
    body: 'M10 8h28v9H21v22h-9V17h-2a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3z',
    trim: 'M12 39h9v3h-9z',
    lines: 'M13 42v3M16.5 42v3M20 42v3M30 8v9M24 8v9',
  },
  {
    id: 'handschuh', name: 'Fäustling', at: 40,
    body: 'M17 36V14c0-5 3.5-9 8.5-9S34 9 34 14v8.5l3-3c1.8-1.8 4.6-1.4 5.6.9.6 1.4.3 3-.8 4.2L34 33v3z',
    trim: 'M15.5 35h20v7a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2z',
    lines: 'M17.5 38.5h16',
  },
  {
    id: 'pulli', name: 'Pullover', at: 58,
    body: 'M17 6h14l11 6-4 10-5-2.5V42H15V19.5L10 22 6 12z',
    trim: 'M19 6h10c0 3-2.2 5-5 5s-5-2-5-5zM15 38h18v4H15z',
    lines: 'M15 26h18M15 31h18',
  },
  {
    id: 'herz', name: 'Herzkissen', at: 80,
    body: 'M24 42C10 33 5 26 5 18.5 5 12.6 9.6 8 15.2 8c3.7 0 6.8 2 8.8 5 2-3 5.1-5 8.8-5C38.4 8 43 12.6 43 18.5 43 26 38 33 24 42z',
    lines: 'M24 16v18M17 22l7 7 7-7',
  },
  {
    id: 'decke', name: 'Kuscheldecke', at: 110,
    body: 'M7 9h34v24l-7 9H7z',
    trim: 'M34 42v-9h7z',
    lines: 'M7 17h34M7 25h34M15 9v33M23 9v33',
  },
];

/** Art des n-ten Strickstücks (0-basiert): reihum durch alle bis dahin freigeschalteten Arten. */
export function itemFor(n) {
  const open = ITEMS.filter((it) => it.at <= n);
  return open[n % open.length];
}
