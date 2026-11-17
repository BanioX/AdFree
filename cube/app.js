// Pfeilwürfel – Einstieg und Hash-Routing.
//   #            → Startbildschirm (Levelauswahl)
//   #play/12     → Level 12 spielen (Neuladen setzt genau dort fort)

import { setupPage } from '../shared/ui.js';
import { mountMenu } from './menu.js';
import { mountPlay } from './play.js';
import { loadProgress } from './progress.js';
import { maybeShowHowto } from './howto.js';

setupPage();

const root = document.getElementById('app');
let screen = null;

const urlFor = (hash) => location.pathname + location.search + (hash ? '#' + hash : '');

const nav = {
  menu() {
    // Kam das Spiel per Push aus dem Startbildschirm, zurückblättern statt einen zweiten Menü-Eintrag anzulegen
    if (screen && screen.kind === 'play' && history.state && history.state.cubeFromMenu) history.back();
    else go('', true);
  },
  play(level) { go(`play/${level}`, !!(screen && screen.kind === 'play')); },
  /** Level gelöst: Adresse schon aufs nächste Level setzen (Neuladen auf dem Gewinn-Blatt geht weiter). */
  solved(level) { history.replaceState(history.state, '', urlFor(`play/${level + 1}`)); },
};

function go(hash, replace) {
  if (replace) history.replaceState(history.state, '', urlFor(hash));
  else history.pushState({ cubeFromMenu: !!(screen && screen.kind === 'menu') }, '', urlFor(hash));
  route();
}

function target() {
  const m = /^#play\/(\d+)/.exec(location.hash);
  if (!m) return { kind: 'menu', key: 'menu' };
  const { unlocked } = loadProgress();
  let level = parseInt(m[1], 10);
  if (!(level >= 1)) level = 1;
  if (level > unlocked) {
    // Noch nicht freigeschaltet → das höchste spielbare Level öffnen
    level = unlocked;
    history.replaceState(history.state, '', urlFor(`play/${level}`));
  }
  return { kind: 'play', level, key: 'play/' + level };
}

function route(force = true) {
  const t = target();
  if (!force && screen && screen.key === t.key) return;
  if (screen) { screen.destroy(); screen = null; }
  window.scrollTo(0, 0);
  screen = t.kind === 'play' ? mountPlay(root, t.level, nav) : mountMenu(root, nav);
  screen.kind = t.kind;
  screen.key = t.key;
  // Allererster Start: kurze Anleitung zeigen (danach über «?» erreichbar)
  if (!tutorialShown) { tutorialShown = true; maybeShowHowto(); }
}
let tutorialShown = false;

// Zurück-Geste / manuell geänderter Hash
window.addEventListener('popstate', () => route(false));
window.addEventListener('hashchange', () => route(false));
route();
