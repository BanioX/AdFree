import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.pz', { style: 'width:148px;grid-template-columns:repeat(3,1fr)' },
        h('button.open.mn-n1', null, '1'), h('button', null, ''), h('button', null, ''));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[1], 280); await api.sleep(400); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:96px;grid-template-columns:repeat(2,1fr)' },
        h('button.mn-flag', null, '⚑'), h('button.open.mn-n1', null, '1')));
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.pz', { style: 'width:96px;grid-template-columns:repeat(2,1fr)' },
        h('button.tip', null, ''), h('button.open', null, '')));
    } },
  ];
}
