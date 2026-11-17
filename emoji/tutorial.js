import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage) { stage.append(h('div.ey-demo', null, '🌙')); } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage, api) {
      const row = h('div.ey-demo', null, h('b', null, 'M'), h('b', null, 'X'), h('b', null, 'O'));
      stage.append(row);
      return api.loop(async () => {
        row.children[0].className = '';
        await api.finger.tap(row.children[0], 250);
        row.children[0].className = 'on';
        await api.sleep(400);
      });
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage, api) {
      const row = h('div.ey-demo', null, h('b.on', null, 'M'), h('b.on', null, 'O'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row, 300); await api.sleep(400); });
    } },
  ];
}
