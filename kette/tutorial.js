import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.kk-demo', null, h('b.c0'), h('b.c0'), h('b.c0'), h('b.c1'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[1], 260); await api.sleep(300); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) { stage.append(h('div.kk-demo', null, h('b.c1'), h('b.c1'), h('b.c1'))); } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.kk-demo', null, h('b.c2'), h('b.c2'), h('b.c2'))); } },
  ];
}
