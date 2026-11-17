import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.ag-demo', null, h('b', null, 'T'), h('b', null, 'R'), h('b', null, 'A'));
      stage.append(row);
      return api.loop(async () => {
        for (const b of row.children) b.className = '';
        await api.finger.tap(row.children[2], 240);
        row.children[2].className = 'on';
        await api.finger.tap(row.children[1], 240);
        row.children[1].className = 'on';
        await api.sleep(500);
      });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage, api) {
      const word = h('div.ag-demo', null, h('b.on', null, 'A'), h('b.on', null, 'R'));
      stage.append(word);
      return api.loop(async () => { await api.finger.tap(word, 400); await api.sleep(500); });
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage, api) {
      const row = h('div.ag-demo', null, h('b.on', null, 'R'), h('b', null, 'A'), h('b', null, 'D'));
      stage.append(row);
      return api.loop(async () => { row.children[1].className = ''; await api.sleep(400); row.children[1].className = 'on'; await api.sleep(500); });
    } },
  ];
}
