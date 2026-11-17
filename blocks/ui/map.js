// Levelkarte des Abenteuers: Welten mit je 20 Leveln, Sterne, Schlösser.

import { h, icon, toast, showModal, soundButton, backButton } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';
import { worldOf, goalTypeOf } from '../core/levels.js';
import { worlds, LEVELS_PER_WORLD } from '../data/worlds.js';
import { getAdv, totalStars, loadLevelSave, saveLevelSave } from './progress.js';
import { showAlbum } from './sheets.js';
import { GOAL_EMOJI } from './menu.js';

export function mountMap(app, nav) {
  const a = getAdv();
  const sv = loadLevelSave();
  const playing = sv && !sv.won && sv.moves > 0 ? sv.level : null;
  app.className = 'app blocks-map';
  app.innerHTML = '';
  const albumBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Album', html: icon('image') });
  albumBtn.addEventListener('click', () => { sfx.play('click'); showAlbum(); });
  const top = h('header.topbar', null,
    backButton('#', () => { sfx.play('click'); nav.menu('adventure'); }),
    h('div.title.center', null, 'Abenteuer'),
    albumBtn,
    soundButton());

  const list = h('main.map');
  list.append(h('div.map-head', { html: `${icon('star', { size: 18 })}<b>${totalStars(a)}</b><span>Sterne gesammelt · Level ${a.max} ist dran</span>` }));
  const curWorld = worldOf(a.max).index;
  const count = Math.max(worlds.length, curWorld + 2);
  let currentEl = null;
  for (let wi = 0; wi < count; wi++) {
    const w = worldOf(wi * LEVELS_PER_WORLD + 1);
    let stars = 0, done = 0;
    for (let n = w.first; n <= w.last; n++) { stars += a.stars[n] | 0; if (a.stars[n]) done++; }
    const locked = w.first > a.max;
    const grid = h('div.level-grid');
    for (let n = w.first; n <= w.last; n++) {
      const st = a.stars[n] | 0;
      const isLocked = n > a.max;
      const isCur = n === a.max;
      const cls = ['lv'];
      if (isLocked) cls.push('locked');
      if (isCur) cls.push('current');
      if (st) cls.push('done');
      if (n === playing) cls.push('playing');
      const b = h('button', { class: cls.join(' '), type: 'button', 'aria-label': `Level ${n}` });
      if (isLocked) b.append(h('span.lv-num', null, String(n)), h('span.lv-lock', { html: icon('lock', { size: 12 }) }));
      else {
        b.append(h('span.lv-goal', null, GOAL_EMOJI[goalTypeOf(n)]), h('span.lv-num', null, String(n)),
          h('span.lv-stars', { html: [1, 2, 3].map((k) => `<i class="${k <= st ? 'on' : ''}">${icon('star', { size: 11 })}</i>`).join('') }));
      }
      b.addEventListener('click', async () => {
        if (isLocked) { sfx.play('tap'); toast(`Zuerst Level ${a.max} schaffen`); return; }
        sfx.play('click');
        if (playing && n !== playing) {
          // Es gibt nur einen Abenteuer-Spielstand: nicht stillschweigend überschreiben.
          const v = await showModal({
            title: `Level ${playing} ist angefangen`,
            text: `Wenn du Level ${n} startest, geht dein Spielstand in Level ${playing} verloren.`,
            buttons: [
              { label: `Weiter mit Level ${playing}`, value: 'resume', primary: true, icon: 'play' },
              { label: `Level ${n} starten`, value: 'start' },
              { label: 'Abbrechen', value: 'cancel', ghost: true },
            ],
          });
          if (v === 'resume') nav.level(playing);
          else if (v === 'start') { saveLevelSave(null); nav.level(n); }
          return;
        }
        nav.level(n);
      });
      if (isCur) currentEl = b;
      grid.append(b);
    }
    const card = h('section.world-card' + (locked ? '.locked' : ''), { style: `--world:${w.data.color};--tint:${w.data.tint}` },
      h('div.world-head', null,
        h('span.world-emoji', null, w.data.emoji),
        h('div.kv', null, h('small', null, `Welt ${wi + 1}`), h('b', null, w.title)),
        h('span.world-stars', { html: `${icon('star', { size: 14 })}${stars}/${LEVELS_PER_WORLD * 3}` })),
      h('div.progress', null, h('i', { style: { width: `${(100 * done) / LEVELS_PER_WORLD}%` } })),
      grid);
    list.append(card);
  }
  const scroller = h('div.scroll', null, list);
  app.append(top, scroller);
  if (currentEl) {
    requestAnimationFrame(() => {
      const r = currentEl.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      scroller.scrollTop += r.top - sr.top - sr.height / 2 + r.height / 2;
    });
  }
  return { destroy() {} };
}
