import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.sn-demo', null, h('b'), h('b'), h('b'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row, 280); await api.sleep(300); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.sn-demo', null, h('b'), h('b.food'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.sn-demo', null, h('b'), h('b'), h('b'))); } },
  ];
}
