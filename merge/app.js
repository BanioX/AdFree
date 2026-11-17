// Verdoppeln – Einstieg und Hash-Routing.
//   #                 Menü
//   #spiel/<modus>    freies Spiel (Modi siehe data/modes.js)
//   #etappen          Etappen-Karte
//   #etappe/<n>       Etappe n
//   #album            Album der entdeckten Kacheln

import { setupPage } from '../shared/ui.js';
import { modes } from './data/modes.js';
import { mountMenu, mountMap, mountAlbum, showHelp } from './screens.js';
import { mountPlay } from './play.js';
import { getProg, saveProg } from './progress.js';

setupPage();

const app = document.getElementById('app');
let current = null;

function go(hash) {
  const target = '#' + hash;
  if ((location.hash || '#') === target) route();
  else location.hash = hash;
}

const nav = {
  menu: () => go(''),
  free: (mode) => go('spiel/' + mode),
  map: () => go('etappen'),
  level: (n) => go('etappe/' + n),
  album: () => go('album'),
};

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (current && current.destroy) current.destroy();
  current = null;
  document.querySelectorAll('.sp-modal-backdrop').forEach((el) => el.remove());
  let m;
  try {
    if ((m = /^spiel\/([a-z0-9-]+)$/.exec(hash)) && modes.some((x) => x.id === m[1])) {
      saveProg({ mode: m[1], tab: 'free' });
      current = mountPlay(app, { kind: 'free', mode: m[1] }, nav);
    } else if ((m = /^etappe\/(\d+)$/.exec(hash))) {
      const max = getProg().levelMax;
      const n = Math.max(1, Math.min(Number(m[1]), max));
      if (n !== Number(m[1])) { location.replace('#etappe/' + n); return; }
      saveProg({ tab: 'levels' });
      current = mountPlay(app, { kind: 'level', n }, nav);
    } else if (hash === 'etappen') {
      current = mountMap(app, nav);
    } else if (hash === 'album') {
      current = mountAlbum(app, nav);
    } else {
      current = mountMenu(app, nav);
    }
  } catch (err) {
    console.warn('Verdoppeln: Ansicht konnte nicht geöffnet werden', err);
    current = mountMenu(app, nav);
  }
  if (!getProg().seenHelp) {
    saveProg({ seenHelp: true });
    setTimeout(() => showHelp(), 350);
  }
}

window.addEventListener('hashchange', route);
route();
