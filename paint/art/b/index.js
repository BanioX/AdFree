// Bilder von Team B (generiert von src/build.mjs) – von einfach nach reich.
export const pictures = [
  { id: 'b-cupcake', title: 'Cupcake mit Kirsche', category: 'Essen', load: () => import('./cupcake.js').then((m) => m.default) },
  { id: 'b-adventskranz', title: 'Adventskranz', category: 'Winter', load: () => import('./adventskranz.js').then((m) => m.default) },
];
