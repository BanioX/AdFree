import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const box = h('div.mw-demo', null, h('b'), h('i'));
      stage.append(box);
      return api.loop(async () => { await api.finger.tap(box, 280); await api.sleep(280); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.mw-demo', null, h('i'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.mw-demo', null, h('b'))); } },
  ];
}
