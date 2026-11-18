// Verdoppeln – Einstieg und Hash-Routing.
//   #                 Menü
//   #spiel/<modus>    freies Spiel (Modi siehe data/modes.js)
//   #etappen          Etappen-Karte
//   #etappe/<n>       Etappe n
//   #album            Album der entdeckten Kacheln

import { setupPage } from '../shared/ui.js';
import { modes } from './data/modes.js';
import { mountMenu, mountMap, mountAlbum } from './screens.js';
import { showHowTo, ensureHowTo, howToSeen } from './howto.js';
import { mountPlay } from './play.js';
import { getProg, saveProg } from './progress.js';
import { t } from './i18n.js';

setupPage();
document.title = t('pageTitle');

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

/** Erst das Tutorial (nur beim allerersten Mal), dann ins Spiel. */
async function start(fn) {
  await ensureHowTo();
  fn();
}
const menuOpts = { start, onHelp: showHowTo };

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (current && current.destroy) current.destroy();
  current = null;
  document.querySelectorAll('.sp-modal-backdrop').forEach((el) => el.remove());
  document.querySelectorAll('.sp-toast.show').forEach((el) => el.classList.remove('show'));
  let m;
  try {
    if ((m = /^spiel\/([a-z0-9-]+)$/.exec(hash)) && modes.some((x) => x.id === m[1])) {
      saveProg({ mode: m[1], tab: 'free' });
      current = mountPlay(app, { kind: 'free', mode: m[1] }, nav, { onHelp: showHowTo });
    } else if ((m = /^etappe\/(\d+)$/.exec(hash))) {
      const max = getProg().levelMax;
      const n = Math.max(1, Math.min(Number(m[1]), max));
      if (n !== Number(m[1])) { location.replace('#etappe/' + n); return; }
      saveProg({ tab: 'levels' });
      current = mountPlay(app, { kind: 'level', n }, nav, { onHelp: showHowTo });
    } else if (hash === 'etappen') {
      current = mountMap(app, nav);
    } else if (hash === 'album') {
      current = mountAlbum(app, nav);
    } else {
      current = mountMenu(app, nav, menuOpts);
    }
  } catch (err) {
    console.warn('Verdoppeln: Ansicht konnte nicht geöffnet werden', err);
    current = mountMenu(app, nav, menuOpts);
  }
  // Beim allerersten Start: «So geht's» (bevor das erste Spiel beginnt)
  if (!howToSeen()) setTimeout(() => { if (!howToSeen()) showHowTo(); }, 350);
}

window.addEventListener('hashchange', route);
route();
