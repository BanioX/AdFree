import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const g = h('div.ww-demo', null, h('b', null, 'B'), h('b', null, 'A'), h('b', null, 'U'), h('b', null, 'M'), h('b', null, 'E'), h('b', null, 'N'));
      stage.append(g);
      return api.loop(async () => {
        for (const b of g.children) b.className = '';
        await api.finger.tap(g.children[0], 220);
        g.children[0].className = 'on';
        await api.finger.tap(g.children[1], 220);
        g.children[1].className = 'on';
        await api.sleep(500);
      });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage, api) {
      const row = h('div.ww-demo', null, h('b.on', null, 'B'), h('b.on', null, 'A'), h('b.on', null, 'U'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row, 300); await api.sleep(500); });
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.ww-demo', null, h('b', null, 'BAUM'))); } },
  ];
}
