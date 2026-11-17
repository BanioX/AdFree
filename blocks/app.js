// Blockpuzzle – Einstieg und Hash-Routing.
//   #               Menü
//   #classic/8      Klassisch 8×8 (oder /10)
//   #karte          Levelkarte (Abenteuer)
//   #level/12       Abenteuer-Level 12

import { setupPage } from '../shared/ui.js';
import { mountMenu } from './ui/menu.js';
import { mountPlay } from './ui/play.js';
import { mountMap } from './ui/map.js';
import { showHelp } from './ui/sheets.js';
import { getSettings, saveSettings, getAdv, SIZES } from './ui/progress.js';

setupPage();

const app = document.getElementById('app');
let current = null;

function go(hash) {
  const target = '#' + hash;
  const now = location.hash || '#';
  if (now === target) route();
  else location.hash = hash;
}

const nav = {
  menu(tab) { if (tab) saveSettings({ tab }); go(''); },
  classic(size) { go(`classic/${size}`); },
  level(n) { go(`level/${n}`); },
  map() { go('karte'); },
  reload() { route(); },
};

function route() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (current && current.destroy) current.destroy();
  current = null;
  document.querySelectorAll('.sp-modal-backdrop').forEach((el) => el.remove());
  let m;
  try {
    if ((m = /^classic(?:\/(\d+))?$/.exec(hash))) {
      const size = SIZES.includes(Number(m[1])) ? Number(m[1]) : getSettings().size;
      saveSettings({ tab: 'classic', size });
      current = mountPlay(app, { mode: 'classic', size }, nav);
    } else if ((m = /^level\/(\d+)$/.exec(hash))) {
      const max = getAdv().max;
      const n = Math.max(1, Math.min(Number(m[1]), max));
      if (n !== Number(m[1])) { location.replace(`#level/${n}`); return; }
      saveSettings({ tab: 'adventure' });
      current = mountPlay(app, { mode: 'adventure', level: n }, nav);
    } else if (hash === 'karte') {
      current = mountMap(app, nav);
    } else {
      current = mountMenu(app, nav);
    }
  } catch (err) {
    console.warn('Blockpuzzle: Ansicht konnte nicht geöffnet werden', err);
    current = mountMenu(app, nav);
  }
  if (!getSettings().seenHelp) {
    saveSettings({ seenHelp: true });
    setTimeout(() => showHelp(), 300);
  }
}

window.addEventListener('hashchange', route);
route();
