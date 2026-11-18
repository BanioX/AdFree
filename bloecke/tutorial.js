import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.bl-demo', null, h('b'), h('b'), h('b'), h('b'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row, 240); await api.sleep(280); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.bl-demo', null, h('b'), h('b'), h('b'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.bl-demo', null, h('b'), h('b'))); } },
  ];
}
