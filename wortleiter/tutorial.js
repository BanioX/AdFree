import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    { title: tr('tut1'), text: tr('tut1t'), demo(stage, api) {
      const row = h('div.wl-demo', null, h('b', null, 'R'), h('b', null, 'O'), h('b', null, 'T'));
      stage.append(row);
      return api.loop(async () => { row.children[0].className = ''; await api.finger.tap(row.children[0], 300); row.children[0].className = 'on'; await api.sleep(500); });
    } },
    { title: tr('tut2'), text: tr('tut2t'), demo(stage, api) {
      const row = h('div.wl-demo', null, h('b.on', null, 'B'), h('b', null, 'O'), h('b', null, 'T'));
      stage.append(row);
      return api.loop(async () => { await api.finger.tap(row.children[0], 300); await api.sleep(500); });
    } },
    { title: tr('tut3'), text: tr('tut3t'), demo(stage) {
      stage.append(h('div.wl-demo', null, h('b', null, 'ROT'), h('b.on', null, 'BOT')));
    } },
  ];
}
