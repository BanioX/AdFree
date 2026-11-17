// Farbenzauber – Einstieg: Bibliothek laden, Galerie und Mal-Ansicht aufbauen, Hash-Routing.
//   #gallery          Galerie
//   #paint/<id>       Mal-Ansicht (Neuladen setzt genau dort fort)

import { setupPage } from '../shared/ui.js';
import { loadLibrary } from './library.js';
import { createGallery } from './gallery.js';
import { createPaintView } from './view.js';
import { updateSummary } from './state.js';

setupPage();

const app = document.getElementById('app');
const debug = new URLSearchParams(location.search).get('debug') === '1';
const lib = await loadLibrary({ debug });

let fromGallery = false;

const gallery = createGallery(lib, {
  onOpen: (item) => {
    fromGallery = true;
    location.hash = '#paint/' + item.id;
  },
});

const view = createPaintView(lib, {
  debug,
  onBack: () => {
    if (fromGallery) {
      fromGallery = false;
      history.back();
    } else {
      location.replace('#gallery');
    }
  },
});

app.innerHTML = '';
app.append(gallery.el, view.el);

function route() {
  const m = /^#paint\/([a-z0-9-]+)$/i.exec(location.hash);
  if (m) {
    gallery.el.classList.add('hidden');
    if (view.currentId !== m[1]) view.open(m[1]);
  } else {
    view.close();
    gallery.show();
  }
}

window.addEventListener('hashchange', route);
route();
updateSummary();
