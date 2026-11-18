import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.fr-demo', null, h('b.f1'), h('b.f2'), h('b.f3'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[1], 260); await api.sleep(320); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.fr-demo', null, h('b.f1'), h('b.f1'), h('b.f2'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.fr-demo', null, h('b.f6'))); } },
  ];
}
