import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.g0.star', null, '★'), h('button.g1', null, ''), h('button.g2.dot', null, '·'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[1], 280); await api.sleep(360); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.g0.star', null, '★'), h('button.g1', null, ''), h('button.g3', null, '')));
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.g0.star', null, '★'), h('button.g4', null, ''), h('button.g2.star', null, '★')));
    } },
  ];
}
