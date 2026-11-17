import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.gs-demo', null, h('b', null, 'K'), h('b', null, 'M'), h('b', null, 'P'));
      stage.append(row);
      return api.loop(async () => { row.children[0].className = ''; await api.finger.tap(row.children[0], 300); row.children[0].className = 'on'; await api.sleep(500); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage, api) {
      const row = h('div.gs-demo', null, h('b.on', null, 'A'), h('b', null, 'B'), h('b', null, 'C'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[0], 300); await api.sleep(500); });
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) { stage.append(h('div.gs-demo', null, h('b', null, 'DIE SONNE'))); } },
  ];
}
