// Bilder von Team B (generiert von src/build.mjs) – von einfach nach reich.
export const pictures = [
  { id: 'b-cupcake', title: 'Cupcake mit Kirsche', category: 'Essen', load: () => import('./cupcake.js').then((m) => m.default) },
  { id: 'b-adventskranz', title: 'Adventskranz', category: 'Winter', load: () => import('./adventskranz.js').then((m) => m.default) },
  { id: 'b-cafe', title: 'Kaffee und Gipfeli', category: 'Essen', load: () => import('./cafe.js').then((m) => m.default) },
  { id: 'b-ballone', title: 'Heissluftballone', category: 'Landschaften', load: () => import('./ballone.js').then((m) => m.default) },
  { id: 'b-leuchtturm', title: 'Leuchtturm an der Küste', category: 'Landschaften', load: () => import('./leuchtturm.js').then((m) => m.default) },
  { id: 'b-lebkuchenhaus', title: 'Lebkuchenhaus', category: 'Winter', load: () => import('./lebkuchenhaus.js').then((m) => m.default) },
];
