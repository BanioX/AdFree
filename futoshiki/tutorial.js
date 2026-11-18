import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.fu-demo', null, h('b', null, ''), h('b', null, '2'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[0], 260); await api.sleep(300); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) {
      stage.append(h('div.fu-demo', null, h('b', null, '1'), h('b', null, '2'), h('b', null, '3')));
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.fu-demo', null, h('b', null, '1'), '‹', h('b', null, '3')));
    } },
  ];
}
