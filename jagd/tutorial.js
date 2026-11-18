import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.jg-demo', null, h('b', null, 'H'), h('b', null, '_'), h('b', null, '_'), h('b', null, '_'));
      stage.append(row);
      return api.loop(async () => { row.children[1].textContent = '_'; await api.finger.tap(row.children[0], 300); row.children[1].textContent = 'A'; await api.sleep(600); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.jg-flower', null, h('i'), h('i'), h('i'), h('b'), h('s'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage, api) {
      const row = h('div.jg-demo', null, h('b', null, 'H'), h('b', null, 'A'), h('b', null, '_'), h('b', null, 'S'));
      stage.append(row);
      return api.loop(async () => { row.children[2].textContent = '_'; await api.sleep(400); row.children[2].textContent = 'U'; await api.sleep(600); });
    } },
  ];
}
