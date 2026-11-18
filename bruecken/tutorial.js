import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.pz', { style: 'width:140px;grid-template-columns:repeat(3,1fr)' },
        h('button.isle', null, '2'), h('i'), h('button.isle', null, '1'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[0], 240); await api.finger.tap(row.children[2], 240); await api.sleep(300); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:140px;grid-template-columns:repeat(3,1fr)' },
        h('button.isle', null, '2'), h('i.h2', null, h('b'), h('b')), h('button.isle', null, '2')));
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:90px;grid-template-columns:repeat(2,1fr)' },
        h('button.isle', null, '3'), h('button.isle', null, '1')));
    } },
  ];
}
