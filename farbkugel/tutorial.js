import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.fk5-demo', null, h('b.b0'), h('b'), h('b.b1'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[0], 240); await api.finger.tap(row.children[1], 240); await api.sleep(280); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.fk5-demo', null, h('b.b2'), h('b.b2'), h('b.b2'), h('b.b2'), h('b.b2'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.fk5-demo', null, h('b.b4'), h('b.b0'), h('b.b3'))); } },
  ];
}
