import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.seed', null, '3'), h('button.unk', null, ''), h('button.sea', null, ''));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[1], 280); await api.sleep(360); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.land', null, ''), h('button.seed', null, '2'), h('button.sea', null, '')));
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.sea', null, ''), h('button.sea', null, ''), h('button.land', null, '')));
    } },
  ];
}
